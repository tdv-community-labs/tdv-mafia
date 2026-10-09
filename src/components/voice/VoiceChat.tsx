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

// ── Types ─────────────────────────────────────────────────────────────────────

interface PeerInfo {
  readonly userId: string;
  readonly faction?: string; // 'MAFIA' | 'TOWN' | etc.
  readonly isAlive: boolean;
}

interface VoiceChatProps {
  readonly lobbyId: string;
  readonly myUserId: string;
  readonly myFaction: string | null; // null = unknown (lobby phase)
  readonly phase: GamePhase;
  readonly peers: PeerInfo[]; // all OTHER players (not self)
  readonly myIsAlive?: boolean;
  readonly onSpeakingChange: (speakingIds: Set<string>) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const POLL_INTERVAL_MS = 1500;
const SPEAKING_THRESHOLD = 20; // RMS amplitude threshold (0-255)
const SPEAKING_CHECK_INTERVAL_MS = 150;

// ── Helpers ───────────────────────────────────────────────────────────────────

function isMicAllowedByPhase(phase: GamePhase, myFaction: string | null, isAlive: boolean): boolean {
  if (phase === 'LOBBY' || phase === 'ENDED') return false;
  if (!isAlive) return false;
  if (phase === 'NIGHT_BUFFER') return myFaction === 'MAFIA' || myFaction === 'YAKUZA';
  return true; // DAY phases — all living can speak
}

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
  const analyserMapRef = useRef<Map<string, { analyser: AnalyserNode; data: Uint8Array<ArrayBuffer> }>>(new Map());
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speakingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const myAnalyserRef = useRef<{ analyser: AnalyserNode; data: Uint8Array<ArrayBuffer> } | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const micAllowed = isMicAllowedByPhase(phase, myFaction, myIsAlive);

  // ── Speaking Detection ─────────────────────────────────────────────────────

  const checkSpeaking = useCallback(() => {
    const newSpeaking = new Set<string>();

    // Check self
    if (myAnalyserRef.current) {
      myAnalyserRef.current.analyser.getByteTimeDomainData(myAnalyserRef.current.data);
      const rms = computeRMS(myAnalyserRef.current.data);
      if (rms > SPEAKING_THRESHOLD) newSpeaking.add(myUserId);
    }

    // Check remote peers
    for (const [peerId, entry] of analyserMapRef.current.entries()) {
      entry.analyser.getByteTimeDomainData(entry.data);
      const rms = computeRMS(entry.data);
      if (rms > SPEAKING_THRESHOLD) newSpeaking.add(peerId);
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
  }, [myUserId, onSpeakingChange]);

  function computeRMS(data: Uint8Array<ArrayBuffer>): number {
    let sum = 0;
    for (const v of data) {
      const centered = v - 128;
      sum += centered * centered;
    }
    return Math.sqrt(sum / data.length);
  }

  // ── Setup Analyser for a MediaStream ──────────────────────────────────────

  const setupAnalyser = useCallback(
    (stream: MediaStream, peerId: string | '__self__'): void => {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const data = new Uint8Array(analyser.fftSize) as Uint8Array<ArrayBuffer>;
      source.connect(analyser);

      if (peerId === '__self__') {
        myAnalyserRef.current = { analyser, data };
      } else {
        analyserMapRef.current.set(peerId, { analyser, data });
      }
    },
    []
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

        // Create or reuse audio element
        let audioEl = remoteAudioRefs.current.get(remotePeerId);
        if (!audioEl) {
          audioEl = new Audio();
          audioEl.autoplay = true;
          remoteAudioRefs.current.set(remotePeerId, audioEl);
        }
        audioEl.srcObject = remoteStream;

        // Set up analyser for speaking detection
        setupAnalyser(remoteStream, remotePeerId);
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
          analyserMapRef.current.delete(remotePeerId);
        }
      };

      peerConnectionsRef.current.set(remotePeerId, pc);
      return pc;
    },
    [lobbyId, myUserId, setupAnalyser]
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
        // Remote peer announced readiness — initiate if we have higher ID (deterministic caller)
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
      setupAnalyser(stream, '__self__');

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
  }, [lobbyId, myUserId, pollSignaling, setupAnalyser, checkSpeaking]);

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

    // Stop timers
    if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
    if (speakingTimerRef.current) { clearInterval(speakingTimerRef.current); speakingTimerRef.current = null; }

    analyserMapRef.current.clear();
    myAnalyserRef.current = null;

    setSpeakingIds(new Set());
    onSpeakingChange(new Set());
    setConnectedPeerIds(new Set());
    setVoiceActive(false);
    setMicEnabled(false);
  }, [lobbyId, myUserId, onSpeakingChange]);

  // ── Apply phase-based mic mute ─────────────────────────────────────────────

  useEffect(() => {
    if (!localStreamRef.current) return;
    const allowed = isMicAllowedByPhase(phase, myFaction, myIsAlive);
    for (const track of localStreamRef.current.getAudioTracks()) {
      track.enabled = allowed && micEnabled;
    }
  }, [phase, myFaction, myIsAlive, micEnabled]);

  // ── Selective Remote Audio Gating (Zero-Knowledge Hearing) ───────────────
  useEffect(() => {
    for (const [peerId, audioEl] of remoteAudioRefs.current.entries()) {
      const peer = peers.find((p) => p.userId === peerId);
      if (!peer || !peer.isAlive) {
        // Living players cannot hear dead players, and dead cannot broadcast to living
        audioEl.muted = true;
        continue;
      }
      if (phase === 'NIGHT_BUFFER') {
        const isTeammate =
          (myFaction === 'MAFIA' && peer.faction === 'MAFIA') ||
          (myFaction === 'YAKUZA' && peer.faction === 'YAKUZA');
        audioEl.muted = !isTeammate;
      } else {
        audioEl.muted = !myIsAlive;
      }
    }
  }, [phase, myFaction, peers, myIsAlive]);

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
      audioCtxRef.current?.close();
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
        for (const track of localStreamRef.current.getAudioTracks()) {
          track.enabled = next && micAllowed;
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

      {/* Dead Player Notice */}
      {!myIsAlive && (
        <span className="text-xs text-zinc-400 bg-zinc-800/60 border border-zinc-700 px-2.5 py-1 rounded-lg font-medium inline-flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-zinc-400" />
          <span>Ölüm Sükutu: Ruhlar səs kanalında danışa bilməz</span>
        </span>
      )}

      {/* Night phase warning */}
      {nightMuted && myIsAlive && (
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
