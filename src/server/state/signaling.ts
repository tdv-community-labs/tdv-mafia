/**
 * WebRTC Signaling Store
 * Holds SDP offers/answers and ICE candidates for P2P voice chat connection setup.
 * Messages are short-lived (TTL 30s) — once consumed they are removed.
 */

export type SignalType = 'offer' | 'answer' | 'candidate' | 'ready' | 'bye';

export interface SignalMessage {
  readonly id: string;
  readonly lobbyId: string;
  readonly fromPeerId: string;
  readonly toPeerId: string; // '*' means broadcast to all peers in the lobby
  readonly type: SignalType;
  readonly payload: unknown;
  readonly createdAt: number;
}

const TTL_MS = 30_000; // Messages expire after 30 seconds

class SignalingStore {
  /** Keyed by lobbyId → list of pending messages */
  private readonly messages: Map<string, SignalMessage[]> = new Map();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Periodically clean up expired messages
    if (typeof setInterval !== 'undefined') {
      this.cleanupTimer = setInterval(() => this.cleanup(), 10_000);
    }
  }

  /** Post a new signaling message */
  public post(msg: Omit<SignalMessage, 'id' | 'createdAt'>): SignalMessage {
    const full: SignalMessage = {
      ...msg,
      id: `sig-${Math.random().toString(36).substring(2, 10)}`,
      createdAt: Date.now(),
    };
    const existing = this.messages.get(msg.lobbyId) ?? [];
    this.messages.set(msg.lobbyId, [...existing, full]);
    return full;
  }

  /**
   * Consume all pending messages addressed TO a specific peer.
   * Consumed messages are removed from the store.
   */
  public consume(lobbyId: string, peerId: string): SignalMessage[] {
    const all = this.messages.get(lobbyId) ?? [];
    const now = Date.now();
    const forPeer: SignalMessage[] = [];
    const remaining: SignalMessage[] = [];

    for (const msg of all) {
      if (now - msg.createdAt > TTL_MS) continue; // Skip expired
      if (msg.toPeerId === peerId || (msg.toPeerId === '*' && msg.fromPeerId !== peerId)) {
        forPeer.push(msg);
      } else {
        remaining.push(msg);
      }
    }

    this.messages.set(lobbyId, remaining);
    return forPeer;
  }

  /** Remove all expired messages across all lobbies */
  private cleanup(): void {
    const now = Date.now();
    for (const [lobbyId, msgs] of this.messages.entries()) {
      const fresh = msgs.filter((m) => now - m.createdAt <= TTL_MS);
      if (fresh.length === 0) {
        this.messages.delete(lobbyId);
      } else {
        this.messages.set(lobbyId, fresh);
      }
    }
  }

  /** Destroy all messages for a lobby (e.g. game ended) */
  public clearLobby(lobbyId: string): void {
    this.messages.delete(lobbyId);
  }

  public dispose(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }
}

// Singleton — shared across all Next.js route handler invocations in the same Node process
const globalSig = globalThis as unknown as {
  __tdv_signaling_store?: SignalingStore;
};

export const signalingStore =
  globalSig.__tdv_signaling_store ?? (globalSig.__tdv_signaling_store = new SignalingStore());
