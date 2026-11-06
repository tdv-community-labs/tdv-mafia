'use client';

/**
 * VoiceChat — WebRTC Mesh P2P Voice Chat Component
 *
 * Architecture:
 *  - Each browser peer creates one RTCPeerConnection per remote peer (full mesh)
 *  - SDP Offer/Answer and ICE candidates exchanged through /api/signaling/[lobbyId]
 *  - Polling every 1.5s for new signaling messages (stops once all peers connected)
 *  - Web Audio API AnalyserNode for real-time speaking detection
 *  - Game-phase muting: LOBBY=off, NIGHT_BUFFER=mafia-only, DAY=all
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, Wifi, AlertTriangle, Radio } from 'lucide-react';
import { GamePhase } from '../../types/game';
import {
  calculatePlayerPan,
  isMicAllowedByPhase,
  computeRMS,
  VAD_HANGOVER_MS,
  DEFAULT_SPEAKING_THRESHOLD,
} from '../../utils/spatialAudio';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PeerInfo {
  readonly userId: string;
  readonly faction?: string; // 'MAFIA' | 'TOWN' | etc.
  readonly isAlive: boolean;
}

export interface VoiceChatProps {
  readonly lobbyId: string;
  readonly myUserId: string;
  readonly myFaction: string | null; // null = unknown (lobby phase)
  readonly phase: GamePhase;
  readonly peers: PeerInfo[]; // all OTHER players (not self)
  readonly myIsAlive?: boolean;
  readonly onSpeakingChange: (speakingIds: Set<string>) => void;
  readonly accusedPlayerId?: string | null;
  readonly playerOrder?: readonly string[];
}

interface RemoteAudioPipeline {
  source: MediaStreamAudioSourceNode;
  gain: GainNode;
  panner: StereoPannerNode | null;
  analyser: AnalyserNode;
  data: Uint8Array<ArrayBuffer>;
  lastSpokeAt: number;
}

interface LocalAudioPipeline {
  analyser: AnalyserNode;
  data: Uint8Array<ArrayBuffer>;
  lastSpokeAt: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const POLL_INTERVAL_MS = 1500;
const SPEAKING_THRESHOLD = DEFAULT_SPEAKING_THRESHOLD; // RMS amplitude threshold (0-255)
const SPEAKING_CHECK_INTERVAL_MS = 150;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function postSignal(
  lobbyId: string,
  fromPeerId: string,
  toPeerId: string,
  type: string,
  payload: unknown
): Promise<void> {
  try {
    await fetch(`/api/signaling/${lobbyId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromPeerId, toPeerId, type, payload }),
    });
  } catch {
    // Network error — ignore, will retry on next poll
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VoiceChat({
  lobbyId,
  myUserId,
  myFaction,
  phase,
  peers,
  myIsAlive = true,
  onSpeakingChange,
  accusedPlayerId = null,
  playerOrder = [],
}: VoiceChatProps) {
  const [micEnabled, setMicEnabled] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [connectedPeerIds, setConnectedPeerIds] = useState<Set<string>>(new Set());
  const [speakingIds, setSpeakingIds] = useState<Set<string>>(new Set());
  const [voiceActive, setVoiceActive] = useState(false); // User toggled voice on

  // Refs — stable across renders
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const pipelinesRef = useRef<Map<string, RemoteAudioPipeline>>(new Map());
  const localPipelineRef = useRef<LocalAudioPipeline | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speakingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterVoiceGainRef = useRef<GainNode | null>(null);

  const isAccusedSelf = accusedPlayerId === myUserId;
  const micAllowed = isMicAllowedByPhase(phase, myFaction, myIsAlive, isAccusedSelf);

  // ── Web Audio Context Initializer ──────────────────────────────────────────
  const getOrCreateAudioCtx = useCallback((): AudioContext => {
    if (!audioCtxRef.current) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtxClass();
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(1.0, ctx.currentTime);
      masterGain.connect(ctx.destination);
      masterVoiceGainRef.current = masterGain;
      audioCtxRef.current = ctx;
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }, []);

  // ── Dynamic Spatial & Phase Gain Routing ───────────────────────────────────
  const updateSpatialRouting = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;

    const totalSeats = playerOrder && playerOrder.length > 0 ? playerOrder.length : peers.length + 1;
    const myIndex = playerOrder && playerOrder.length > 0 ? Math.max(0, playerOrder.indexOf(myUserId)) : 0;

    for (const [peerId, pipeline] of pipelinesRef.current.entries()) {
      const peer = peers.find((p) => p.userId === peerId);
      const peerIsAlive = peer?.isAlive ?? false;
      const peerFaction = peer?.faction ?? null;
      const isAccused = peerId === accusedPlayerId;

      // Calculate Stereo Pan
      let pan = 0.0;
      if (playerOrder && playerOrder.length > 0) {
        const pIdx = playerOrder.indexOf(peerId);
        if (pIdx >= 0) {
          pan = calculatePlayerPan(pIdx, totalSeats, myIndex, 'TABLE');
        }
      } else {
        const pIdx = peers.findIndex((p) => p.userId === peerId);
        if (pIdx >= 0) {
          pan = calculatePlayerPan(pIdx + 1, totalSeats, myIndex, 'TABLE');
        }
      }

      if (pipeline.panner) {
        if (phase === 'TRIAL_DEFENSE' && isAccused) {
          // Accused speaker is centered on courtroom podium
          pipeline.panner.pan.setValueAtTime(0.0, now);
        } else {
          pipeline.panner.pan.setValueAtTime(pan, now);
        }
      }

      // Calculate Gain (Spotlight vs Silence vs Faction vs Normal)
      let targetGain = 1.0;
      if (phase === 'LOBBY' || phase === 'ENDED' || !myIsAlive || !peerIsAlive) {
        targetGain = 0.0;
      } else if (phase === 'TRIAL_DEFENSE') {
        if (isAccused) {
          targetGain = 1.3; // Podium Spotlight Boost (+2.5dB)
        } else {
          targetGain = 0.0; // Podium Silence for non-accused peers
        }
      } else if (phase === 'NIGHT_BUFFER') {
        const isTeammate =
          (myFaction === 'MAFIA' && peerFaction === 'MAFIA') ||
          (myFaction === 'YAKUZA' && peerFaction === 'YAKUZA');
        targetGain = isTeammate ? 1.0 : 0.0;
      } else {
        targetGain = 1.0;
      }

      pipeline.gain.gain.setValueAtTime(targetGain, now);
    }
  }, [accusedPlayerId, myFaction, myIsAlive, myUserId, peers, phase, playerOrder]);

  // Keep spatial routing in sync with phase, seats, and peers
  useEffect(() => {
    updateSpatialRouting();
  }, [updateSpatialRouting]);

  // ── Smoothed Speaking Detection (350ms Hangover VAD) ──────────────────────
  const checkSpeaking = useCallback(() => {
    const now = Date.now();
    const newSpeaking = new Set<string>();

    // Check self
    if (localPipelineRef.current && micEnabled && micAllowed) {
      localPipelineRef.current.analyser.getByteTimeDomainData(localPipelineRef.current.data);
      const rms = computeRMS(localPipelineRef.current.data);
      if (rms > SPEAKING_THRESHOLD) {
        localPipelineRef.current.lastSpokeAt = now;
        newSpeaking.add(myUserId);
      } else if (now - localPipelineRef.current.lastSpokeAt < VAD_HANGOVER_MS) {
        newSpeaking.add(myUserId);
      }
    }

    // Check remote peers
    for (const [peerId, pipeline] of pipelinesRef.current.entries()) {
      const peer = peers.find((p) => p.userId === peerId);
      if (!peer || !peer.isAlive) continue;

      pipeline.analyser.getByteTimeDomainData(pipeline.data);
      const rms = computeRMS(pipeline.data);
      if (rms > SPEAKING_THRESHOLD) {
        pipeline.lastSpokeAt = now;
        newSpeaking.add(peerId);
      } else if (now - pipeline.lastSpokeAt < VAD_HANGOVER_MS) {
        newSpeaking.add(peerId);
      }
    }

    setSpeakingIds((prev) => {
      const changed =
        newSpeaking.size !== prev.size ||
        [...newSpeaking].some((id) => !prev.has(id));
      if (changed) {
        onSpeakingChange(newSpeaking);
        return newSpeaking;
      }
      return prev;
    });
  }, [micAllowed, micEnabled, myUserId, onSpeakingChange, peers]);

  // ── Setup Web Audio Pipelines ──────────────────────────────────────────────
  const setupLocalPipeline = useCallback(
    (stream: MediaStream): void => {
      const ctx = getOrCreateAudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const data = new Uint8Array(analyser.fftSize) as Uint8Array<ArrayBuffer>;
      source.connect(analyser); // Analyser only, do not play back to self

      localPipelineRef.current = {
        analyser,
        data,
        lastSpokeAt: 0,
      };
    },
    [getOrCreateAudioCtx]
  );

  const setupRemoteAudioPipeline = useCallback(
    (stream: MediaStream, peerId: string): void => {
      const ctx = getOrCreateAudioCtx();

      // Clean up existing pipeline if any
      const existing = pipelinesRef.current.get(peerId);
      if (existing) {
        try {
          existing.source.disconnect();
          existing.gain.disconnect();
          existing.panner?.disconnect();
          existing.analyser.disconnect();
        } catch {}
      }

      const source = ctx.createMediaStreamSource(stream);
      const gain = ctx.createGain();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const data = new Uint8Array(analyser.fftSize) as Uint8Array<ArrayBuffer>;

      // Branch to analyser for local client VAD
      source.connect(analyser);

      // Branch to gain and stereo panner
      source.connect(gain);

      let panner: StereoPannerNode | null = null;
      if (typeof ctx.createStereoPanner === 'function') {
        panner = ctx.createStereoPanner();
        gain.connect(panner);
        if (masterVoiceGainRef.current) {
          panner.connect(masterVoiceGainRef.current);
        } else {
          panner.connect(ctx.destination);
        }
      } else {
        if (masterVoiceGainRef.current) {
          gain.connect(masterVoiceGainRef.current);
        } else {
          gain.connect(ctx.destination);
        }
      }

      pipelinesRef.current.set(peerId, {
        source,
        gain,
        panner,
        analyser,
        data,
        lastSpokeAt: 0,
      });

      updateSpatialRouting();
    },
    [getOrCreateAudioCtx, updateSpatialRouting]
  );

  // ── Create RTCPeerConnection for a remote peer ─────────────────────────────
  const createPeerConnection = useCallback(
    (remotePeerId: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });

      // Add local audio track
      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) {
          pc.addTrack(track, localStreamRef.current);
        }
      }

      // Handle incoming audio track
      pc.ontrack = (evt) => {
        const remoteStream = evt.streams[0];
        if (!remoteStream) return;

        // Maintain muted audio element for stream drain / autoplay keepalive
        let audioEl = remoteAudioRefs.current.get(remotePeerId);
        if (!audioEl) {
          audioEl = new Audio();
          audioEl.autoplay = true;
          remoteAudioRefs.current.set(remotePeerId, audioEl);
        }
        audioEl.muted = true;
        audioEl.srcObject = remoteStream;

        // Connect into Web Audio Spatial Graph
        setupRemoteAudioPipeline(remoteStream, remotePeerId);
      };

      // Send ICE candidates to remote peer
      pc.onicecandidate = (evt) => {
        if (evt.candidate) {
          postSignal(lobbyId, myUserId, remotePeerId, 'candidate', evt.candidate.toJSON());
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setConnectedPeerIds((prev) => new Set([...prev, remotePeerId]));
        } else if (
          pc.connectionState === 'disconnected' ||
          pc.connectionState === 'failed' ||
          pc.connectionState === 'closed'
        ) {
          setConnectedPeerIds((prev) => {
            const next = new Set(prev);
            next.delete(remotePeerId);
            return next;
          });
          const pipeline = pipelinesRef.current.get(remotePeerId);
          if (pipeline) {
            try {
              pipeline.source.disconnect();
              pipeline.gain.disconnect();
              pipeline.panner?.disconnect();
              pipeline.analyser.disconnect();
            } catch {}
            pipelinesRef.current.delete(remotePeerId);
          }
        }
      };

      peerConnectionsRef.current.set(remotePeerId, pc);
      return pc;
    },
    [lobbyId, myUserId, setupRemoteAudioPipeline]
  );

  // ── Initiate connection to a peer (caller role) ────────────────────────────
  const initiateConnection = useCallback(
    async (remotePeerId: string): Promise<void> => {
      const existing = peerConnectionsRef.current.get(remotePeerId);
      if (existing && existing.signalingState !== 'closed') return;

      const pc = createPeerConnection(remotePeerId);
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      await postSignal(lobbyId, myUserId, remotePeerId, 'offer', offer);
    },
    [lobbyId, myUserId, createPeerConnection]
  );

  // ── Process incoming signaling messages ────────────────────────────────────
  const processSignal = useCallback(
    async (msg: {
      fromPeerId: string;
      type: string;
      payload: unknown;
    }): Promise<void> => {
      const { fromPeerId, type, payload } = msg;

      if (type === 'ready') {
        if (myUserId > fromPeerId) {
          await initiateConnection(fromPeerId);
        }
        return;
      }

      if (type === 'offer') {
        let pc = peerConnectionsRef.current.get(fromPeerId);
        if (!pc || pc.signalingState === 'closed') {
          pc = createPeerConnection(fromPeerId);
        }
        await pc.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await postSignal(lobbyId, myUserId, fromPeerId, 'answer', answer);
        return;
      }

      if (type === 'answer') {
        const pc = peerConnectionsRef.current.get(fromPeerId);
        if (pc && pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit));
        }
        return;
      }

      if (type === 'candidate') {
        const pc = peerConnectionsRef.current.get(fromPeerId);
        if (pc && pc.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload as RTCIceCandidateInit));
          } catch {
            // Stale candidate — ignore
          }
        }
        return;
      }

      if (type === 'bye') {
        const pc = peerConnectionsRef.current.get(fromPeerId);
        if (pc) {
          pc.close();
          peerConnectionsRef.current.delete(fromPeerId);
        }
        const pipeline = pipelinesRef.current.get(fromPeerId);
        if (pipeline) {
          try {
            pipeline.source.disconnect();
            pipeline.gain.disconnect();
            pipeline.panner?.disconnect();
            pipeline.analyser.disconnect();
          } catch {}
          pipelinesRef.current.delete(fromPeerId);
        }
      }
    },
    [myUserId, lobbyId, createPeerConnection, initiateConnection]
  );

  // ── Poll for signaling messages ────────────────────────────────────────────
  const pollSignaling = useCallback(async () => {
    try {
      const res = await fetch(`/api/signaling/${lobbyId}?peerId=${myUserId}`);
      if (!res.ok) return;
      const data = await res.json() as { messages: Array<{ fromPeerId: string; type: string; payload: unknown }> };
      for (const msg of data.messages ?? []) {
        await processSignal(msg);
      }
    } catch {
      // Network unavailable — retry next tick
    }
  }, [lobbyId, myUserId, processSignal]);

  // ── Start Voice ────────────────────────────────────────────────────────────
  const startVoice = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      setHasPermission(true);
      setupLocalPipeline(stream);

      // Announce readiness to all peers
      await postSignal(lobbyId, myUserId, '*', 'ready', null);

      // Start polling
      if (!pollTimerRef.current) {
        pollTimerRef.current = setInterval(pollSignaling, POLL_INTERVAL_MS);
      }

      // Start speaking detection
      if (!speakingTimerRef.current) {
        speakingTimerRef.current = setInterval(checkSpeaking, SPEAKING_CHECK_INTERVAL_MS);
      }

      setVoiceActive(true);
    } catch {
      setHasPermission(false);
    }
  }, [lobbyId, myUserId, pollSignaling, setupLocalPipeline, checkSpeaking]);

  // ── Stop Voice ─────────────────────────────────────────────────────────────
  const stopVoice = useCallback(async () => {
    // Announce goodbye
    await postSignal(lobbyId, myUserId, '*', 'bye', null);

    // Stop local stream tracks
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;

    // Close all peer connections
    for (const pc of peerConnectionsRef.current.values()) {
      pc.close();
    }
    peerConnectionsRef.current.clear();

    // Stop audio elements
    for (const el of remoteAudioRefs.current.values()) {
      el.pause();
      el.srcObject = null;
    }
    remoteAudioRefs.current.clear();

    // Clean up Web Audio remote pipelines
    for (const pipeline of pipelinesRef.current.values()) {
      try {
        pipeline.source.disconnect();
        pipeline.gain.disconnect();
        pipeline.panner?.disconnect();
        pipeline.analyser.disconnect();
      } catch {}
    }
    pipelinesRef.current.clear();
    localPipelineRef.current = null;

    // Stop timers
    if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
    if (speakingTimerRef.current) { clearInterval(speakingTimerRef.current); speakingTimerRef.current = null; }

    setSpeakingIds(new Set());
    onSpeakingChange(new Set());
    setConnectedPeerIds(new Set());
    setVoiceActive(false);
    setMicEnabled(false);
  }, [lobbyId, myUserId, onSpeakingChange]);

  // ── Apply phase-based mic mute ─────────────────────────────────────────────
  useEffect(() => {
    if (!localStreamRef.current) return;
    const isAccused = accusedPlayerId === myUserId;
    const allowed = isMicAllowedByPhase(phase, myFaction, myIsAlive, isAccused);
    for (const track of localStreamRef.current.getAudioTracks()) {
      track.enabled = allowed && micEnabled;
    }
  }, [phase, myFaction, myIsAlive, micEnabled, accusedPlayerId, myUserId]);

  // ── Connect to newly joined peers ─────────────────────────────────────────
  useEffect(() => {
    if (!voiceActive) return;
    for (const peer of peers) {
      if (!peer.isAlive) continue;
      const existing = peerConnectionsRef.current.get(peer.userId);
      if (!existing || existing.connectionState === 'closed' || existing.connectionState === 'failed') {
        // Will connect when they respond to our 'ready' broadcast or send their own
      }
    }
  }, [peers, voiceActive]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopVoice();
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mic Toggle ────────────────────────────────────────────────────────────
  const handleMicToggle = () => {
    if (!voiceActive) {
      startVoice();
      setMicEnabled(true);
    } else {
      const next = !micEnabled;
      setMicEnabled(next);
      if (localStreamRef.current) {
        const isAccused = accusedPlayerId === myUserId;
        const allowed = isMicAllowedByPhase(phase, myFaction, myIsAlive, isAccused);
        for (const track of localStreamRef.current.getAudioTracks()) {
          track.enabled = next && allowed;
        }
      }
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (phase === 'LOBBY' || phase === 'ENDED') return null;

  const isActuallyMuted = !micEnabled || !micAllowed;
  const nightMuted = micEnabled && !micAllowed;

  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl border border-blue-500/20 dark:border-blue-500/10 bg-blue-50/50 dark:bg-blue-950/20 backdrop-blur-xl shadow-[0_0_20px_rgba(59,130,246,0.1)] flex-wrap transition-all duration-300">
      {/* Mic Toggle Button */}
      <button
        type="button"
        onClick={handleMicToggle}
        disabled={!myIsAlive}
        title={!myIsAlive ? 'Ölüm Sükutu (Danışmaq qadağandır)' : isActuallyMuted ? 'Mikrofonu aç' : 'Mikrofonu söndür'}
        className={`inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[44px] min-w-[44px] rounded-2xl font-bold text-sm select-none shadow-sm transition-transform duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
          isActuallyMuted
            ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/25 hover:bg-rose-500/15'
            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20'
        }`}
      >
        {isActuallyMuted ? (
          <MicOff className="w-5 h-5 text-rose-500" />
        ) : (
          <Mic className="w-5 h-5 text-emerald-500" />
        )}
        <span>
          {!voiceActive
            ? 'Səs Çata Qoşul'
            : !myIsAlive
            ? 'Ruhlar Danışa Bilməz'
            : phase === 'TRIAL_DEFENSE' && !isAccusedSelf
            ? 'Kürsü Rejimi (Müttəhim Danışır)'
            : isActuallyMuted
            ? 'Mikrofon Bağlıdır'
            : 'Danışırsınız'}
        </span>
      </button>

      {/* Connected peer count */}
      {voiceActive && (
        <span className="text-xs text-zinc-500 dark:text-zinc-400 inline-flex items-center gap-1.5 font-medium">
          <Radio className="w-4 h-4 text-blue-500" />
          {connectedPeerIds.size > 0 ? (
            <span className="text-blue-600 dark:text-blue-400 font-semibold">{connectedPeerIds.size} oyunçu qoşulub</span>
          ) : (
            <span>Digər oyunçuların qoşulması gözlənilir...</span>
          )}
        </span>
      )}

      {/* Trial Defense Accused Podium Banner */}
      {phase === 'TRIAL_DEFENSE' && isAccusedSelf && myIsAlive && (
        <span className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-lg font-bold inline-flex items-center gap-1.5 animate-pulse">
          <Radio className="w-4 h-4 shrink-0 text-emerald-500" />
          <span>Kürsüdəsiniz: Müdafiə çıxışınız məhkəmə zalına yayımlanır (+2.5dB)</span>
        </span>
      )}

      {/* Trial Defense Silence for Non-Accused */}
      {phase === 'TRIAL_DEFENSE' && !isAccusedSelf && myIsAlive && (
        <span className="text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg font-medium inline-flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
          <span>Kürsü Rejimi: Yalnız müttəhimin çıxışına icazə verilir</span>
        </span>
      )}

      {/* Dead Player Notice */}
      {!myIsAlive && (
        <span className="text-xs text-zinc-400 bg-zinc-800/60 border border-zinc-700 px-2.5 py-1 rounded-lg font-medium inline-flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-zinc-400" />
          <span>Ölüm Sükutu: Ruhlar səs kanalında danışa bilməz</span>
        </span>
      )}

      {/* Night phase warning */}
      {nightMuted && myIsAlive && phase !== 'TRIAL_DEFENSE' && (
        <span className="text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg font-medium inline-flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
          <span>Gecə fazasında yalnız mafiya fraksiyası danışa bilər</span>
        </span>
      )}

      {/* Microphone permission denied */}
      {hasPermission === false && (
        <span className="text-xs text-rose-700 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-lg font-medium inline-flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>Mikrofon icazəsi verilmədi. Brauzer ayarlarından icazə verin.</span>
        </span>
      )}

      {/* Speaking indicators for self */}
      {voiceActive && !isActuallyMuted && speakingIds.has(myUserId) && (
        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold px-3 py-1 rounded-full bg-emerald-500/10 ring-2 ring-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Danışırsınız
        </span>
      )}
    </div>
  );
}
