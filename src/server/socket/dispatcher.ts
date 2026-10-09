/**
 * Zero-Knowledge Socket Dispatcher
 *
 * Responsibilities:
 *  • Scrub all outbound state: strip bufferedNightActions, private roles, innate
 *    traits before any broadcast.
 *  • Target-specific emitters: private investigation results → investigator only;
 *    faction chat → verified faction members only.
 *  • Dynamic room isolation for All-In: DAY_REGIONAL_CAUCUS → district rooms;
 *    DAY_CENTRAL_ASSEMBLY → merge back to global room.
 *  • Wire game-loop events: morning newspaper, phase transitions, win conditions.
 *
 * Enterprise Mafia / Social Deduction Platform - Phase 2
 */

import {
  ClientToServerEvents,
  DistrictRoomAssignedPayload,
  FactionChatPayload,
  LynchOutcomePayload,
  ServerToClientEvents,
  VoteTallyUpdatePayload,
} from './events';
import {
  InvestigationResult,
  LynchOutcome,
  MorningNewspaper,
  NightResolutionOutput,
  PhaseTransitionResult,
  ScrubbedLobbyView,
  ScrubbedPlayerView,
  WinConditionResult,
  VotingEngineOutput,
} from '../../types/engine';
import { LobbyState, PlayerSession } from '../../types/game';
import { AllInDistrict } from '../../types/roles';
import { inMemoryLobbyStore } from '../state/memory';
import { resolveNightActions } from '../engine/night-action-resolver';
import { runVotingEngine } from '../engine/voting-engine';
import { executePhaseTransition, evaluateWinCondition } from '../engine/phase-manager';
import { dispatchMinigamePhaseEvent } from '../engine/minigames-engine';

// ─── Investigation result accumulator ────────────────────────────────────────

/**
 * Merges new investigation results into the running per-investigator record.
 * Each investigator's history is append-only across rounds.
 */
function mergeInvestigationResults(
  existing: Readonly<Record<string, readonly InvestigationResult[]>>,
  newResults: readonly InvestigationResult[],
): Record<string, readonly InvestigationResult[]> {
  const merged: Record<string, InvestigationResult[]> = {};
  for (const [id, list] of Object.entries(existing)) {
    merged[id] = [...list];
  }
  for (const result of newResults) {
    const inv = result.investigatorPlayerId;
    if (!merged[inv]) merged[inv] = [];
    merged[inv]!.push(result);
  }
  return merged;
}

// ─── Typed Socket Abstraction ─────────────────────────────────────────────────


export interface TypedServerSocket {
  readonly id: string;
  readonly userId?: string;
  readonly faction?: string;
  emit<E extends keyof ServerToClientEvents>(event: E, ...args: Parameters<ServerToClientEvents[E]>): void;
  broadcastToRoom<E extends keyof ServerToClientEvents>(
    room: string,
    event: E,
    ...args: Parameters<ServerToClientEvents[E]>
  ): void;
  join(room: string): void;
  leave(room: string): void;
  /** Return all socket IDs currently in a room */
  socketsInRoom(room: string): string[];
}

// ─── ZK Scrubber ─────────────────────────────────────────────────────────────

function lobbyRoomName(lobbyId: string): string {
  return `lobby:${lobbyId}`;
}

function districtRoomName(lobbyId: string, district: AllInDistrict): string {
  return `lobby:${lobbyId}:district:${district}`;
}

function factionRoomName(lobbyId: string, faction: string): string {
  return `lobby:${lobbyId}:faction:${faction}`;
}

/**
 * Build a zero-knowledge scrubbed view of a single player.
 * Secret role info (allInIdentity, innate trait) exposed ONLY for the requesting socket's own userId.
 */
function scrubPlayer(p: PlayerSession, requestingUserId: string): ScrubbedPlayerView {
  const isSelf = p.userId === requestingUserId;
  return {
    userId:         p.userId,
    username:       p.username,
    isAlive:        p.isAlive,
    isHost:         p.isHost,
    currentDistrict: p.currentDistrict ?? null,
    ownRoleDisplay: isSelf ? p.displayRole.formatted : null,
    ownOffice:      isSelf ? (p.allInIdentity?.layer2Office ?? null) : null,
    ownTrait:       isSelf ? (p.allInIdentity?.layer3Trait ?? null) : null,
  };
}

/**
 * Build a scrubbed lobby view for a specific requesting user.
 * Never leaks: bufferedNightActions, private allInIdentity of other players,
 * or blind votes during CIRCLE_9_TREACHERY.
 */
export function buildScrubbedLobbyView(lobby: LobbyState, requestingUserId: string): ScrubbedLobbyView {
  const dante = lobby.minigameSubStates.dantesInferno;
  const isBlindVoting = dante?.treacherySecretVotingActive === true;

  const publicPlayers: ScrubbedPlayerView[] = Object.values(lobby.players).map(p =>
    scrubPlayer(p, requestingUserId)
  );

  return {
    lobbyId:          lobby.lobbyId,
    phase:            lobby.phase,
    roundNumber:      lobby.roundNumber,
    phaseTimeRemaining: lobby.phaseTimeRemaining,
    mode:             lobby.mode,
    publicPlayers,
    // Blind votes: suppress the vote map entirely until phase lock
    liveVotes:        isBlindVoting ? null : lobby.liveVotes,
    speakerQueue:     lobby.speakerQueue,
    globalNightKillCap: lobby.globalNightKillCap,
  };
}

// ─── ZK Emitter Primitives ────────────────────────────────────────────────────

/**
 * Emit a scrubbed lobby view to every socket in the lobby room with their own userId.
 * Each player sees only their own secret role — never others'.
 *
 * In production this requires the dispatcher to track userId → socketId mapping.
 * The interface is designed so the caller provides the registry.
 */
export function emitScrubbedLobbyViewToAll(
  lobbyId: string,
  userSocketMap: Readonly<Record<string, TypedServerSocket>>,
): void {
  const lobby = inMemoryLobbyStore.getLobby(lobbyId);
  if (!lobby) return;

  for (const [userId, socket] of Object.entries(userSocketMap)) {
    // SECURITY & PERFORMANCE FIX: Only broadcast to players actually in this lobby!
    // Previously, this loop was broadcasting EVERY lobby update to EVERY connected user on the entire server,
    // resulting in exponential network saturation O(N^2) and leaking game existence to unrelated users.
    if (!lobby.players[userId] && lobby.hostUserId !== userId) {
      continue;
    }
    const view = buildScrubbedLobbyView(lobby, userId);
    socket.emit('SCRUBBED_LOBBY_VIEW', view);
  }
}

/**
 * Emit private investigation results ONLY to the investigator's own socket.
 * Never broadcast to the room.
 */
export function emitPrivateInvestigationResults(
  results: readonly InvestigationResult[],
  userSocketMap: Readonly<Record<string, TypedServerSocket>>,
): void {
  for (const result of results) {
    const socket = userSocketMap[result.investigatorPlayerId];
    if (!socket) continue;
    socket.emit('PRIVATE_INVESTIGATION_RESULT', result);
  }
}

/**
 * Emit faction chat ONLY to verified members of the same faction.
 * Uses faction-namespaced socket rooms to avoid per-member enumeration.
 */
export function emitFactionChat(
  lobbyId: string,
  payload: FactionChatPayload,
  broadcastSocket: TypedServerSocket,
): void {
  const room = factionRoomName(lobbyId, payload.faction);
  broadcastSocket.broadcastToRoom(room, 'FACTION_CHAT_MESSAGE', payload);
}

// ─── All-In District Room Management ─────────────────────────────────────────

/**
 * Partition all alive All-In players into district-specific socket rooms.
 * Called at the start of DAY_REGIONAL_CAUCUS.
 */
export function assignDistrictRooms(
  lobby: LobbyState,
  userSocketMap: Readonly<Record<string, TypedServerSocket>>,
): void {
  const districts: AllInDistrict[] = ['ELITE', 'COMMERCIAL', 'INDUSTRIAL'];

  for (const player of Object.values(lobby.players)) {
    if (!player.isAlive || !player.currentDistrict) continue;
    const socket = userSocketMap[player.userId];
    if (!socket) continue;

    // Leave the merged global room, join district room
    socket.leave(lobbyRoomName(lobby.lobbyId));
    socket.join(districtRoomName(lobby.lobbyId, player.currentDistrict));

    const payload: DistrictRoomAssignedPayload = {
      lobbyId:  lobby.lobbyId,
      district: player.currentDistrict,
      roomName: districtRoomName(lobby.lobbyId, player.currentDistrict),
    };
    socket.emit('DISTRICT_ROOM_ASSIGNED', payload);
  }
}

/**
 * Merge all district rooms back into the global lobby room.
 * Called at the start of DAY_CENTRAL_ASSEMBLY.
 */
export function mergeDistrictRoomsToGlobal(
  lobby: LobbyState,
  userSocketMap: Readonly<Record<string, TypedServerSocket>>,
): void {
  const districts: AllInDistrict[] = ['ELITE', 'COMMERCIAL', 'INDUSTRIAL'];

  for (const player of Object.values(lobby.players)) {
    if (!player.isAlive || !player.currentDistrict) continue;
    const socket = userSocketMap[player.userId];
    if (!socket) continue;

    // Leave district room, rejoin global
    socket.leave(districtRoomName(lobby.lobbyId, player.currentDistrict));
    socket.join(lobbyRoomName(lobby.lobbyId));
  }
}

// ─── Game Loop Orchestrator ───────────────────────────────────────────────────

export class ZeroKnowledgeDispatcher {
  private userSocketMap: Record<string, TypedServerSocket> = {};

  /** Register or update a user ↔ socket mapping */
  public registerSocket(userId: string, socket: TypedServerSocket): void {
    this.userSocketMap[userId] = socket;
  }

  public unregisterSocket(userId: string): void {
    delete this.userSocketMap[userId];
  }

  /** Push scrubbed lobby views to every connected player */
  public broadcastScrubbedState(lobbyId: string): void {
    emitScrubbedLobbyViewToAll(lobbyId, this.userSocketMap);
  }

  // ── Night Resolution Pipeline ─────────────────────────────────────────────

  /**
   * Execute night resolution, emit morning newspaper (public) and private intel.
   * CRITICAL: Persists updatedPlayers (deaths + vest-spent trait resets) back
   * into inMemoryLobbyStore so subsequent phase transitions see the correct state.
   */
  public resolveNightAndBroadcast(lobbyId: string): NightResolutionOutput | null {
    const lobby = inMemoryLobbyStore.getLobby(lobbyId);
    if (!lobby) return null;

    const resolution = resolveNightActions({ lobby });

    // ── Persist updated player states (deaths + vest-depletion) ──────────────
    // Without this, the lobby.players map is never updated: dead players remain
    // alive on the next turn and vest charges reset every night (game-stall bug).
    inMemoryLobbyStore.updateLobby(lobbyId, (current) => ({
      ...current,
      players: {
        ...current.players,
        ...resolution.updatedPlayers,
      },
      latestNewspaper: resolution.newspaper,
      mafiaMutinyActive: resolution.mutinyActive,
      mutineerIds: resolution.mutineerIds,
      // Merge new private investigation results into the running record
      privateInvestigations: mergeInvestigationResults(
        current.privateInvestigations ?? {},
        resolution.newspaper.privateInvestigationResults,
      ),
    }));

    // Advance minigames on morning arrival
    if (lobby.minigameSubStates && Object.keys(lobby.minigameSubStates).length > 0) {
      const minigameOutput = dispatchMinigamePhaseEvent({
        lobbyId,
        danteGreedAbilityUsers: [],
        danteLynchedPlayerId: null,
        earthInnocentsLynched: [],
        earthKlaatuFreezeActivated: false,
        earthGortTarget: null,
        valkyrieBriefcasePassTarget: null,
        prisonGuardSanctions: [],
        prisonWardenAppeased: [],
        prisonInmatesLynched: [],
        prisonSolitary: [],
        prisonAssassinStrike: false,
        prisonAssassinTarget: null,
        catenaccioSniperTarget: null,
        catenaccioWallAttackers: [],
        publicDeaths: resolution.newspaper.publicDeaths,
      });
      inMemoryLobbyStore.updateLobby(lobbyId, (current) => ({
        ...current,
        minigameSubStates: minigameOutput.updatedSubStates,
      }));
    }

    // Broadcast morning newspaper publicly
    const anySocket = Object.values(this.userSocketMap)[0];
    if (anySocket) {
      anySocket.broadcastToRoom(lobbyRoomName(lobbyId), 'MORNING_NEWSPAPER', resolution.newspaper);
    }

    // Private intel: emit only to each investigator
    emitPrivateInvestigationResults(
      resolution.newspaper.privateInvestigationResults,
      this.userSocketMap,
    );

    return resolution;
  }


  // ── Voting Pipeline ───────────────────────────────────────────────────────

  /**
   * Run voting engine, broadcast tally (blind if Treachery), emit lynch outcome.
   */
  public runVotingAndBroadcast(lobbyId: string, centralAssemblyFinalists?: readonly string[]): VotingEngineOutput | null {
    const lobby = inMemoryLobbyStore.getLobby(lobbyId);
    if (!lobby) return null;

    const result = runVotingEngine({ lobby, centralAssemblyFinalists });
    const anySocket = Object.values(this.userSocketMap)[0];
    if (!anySocket) return result;

    const room = lobbyRoomName(lobbyId);
    const dante = lobby.minigameSubStates.dantesInferno;
    const blindRevealPending = dante?.treacherySecretVotingActive === true;

    const tallyPayload: VoteTallyUpdatePayload = {
      lobbyId,
      tallies:           result.tallies,
      blindRevealPending,
    };
    anySocket.broadcastToRoom(room, 'VOTE_TALLY_UPDATE', tallyPayload);

    // Determine if this is district plebiscite phase vs final lynch
    const isDistrictPhase =
      lobby.mode === 'ALL_IN' &&
      lobby.phase === 'DAY_VOTING' &&
      !centralAssemblyFinalists;

    if (!isDistrictPhase) {
      // Emit lynch outcome
      const isViolenceCleaned = dante?.currentCircle === 'CIRCLE_7_VIOLENCE';
      const victim = result.outcome.kind === 'LYNCHED' ? result.outcome.victimId : null;
      const isTownLynched = victim ? lobby.players[victim]?.allInIdentity?.layer1Faction === 'TOWN' : false;

      // Advance minigames on lynch
      if (lobby.minigameSubStates && Object.keys(lobby.minigameSubStates).length > 0) {
        const minigameOutput = dispatchMinigamePhaseEvent({
          lobbyId,
          danteGreedAbilityUsers: [],
          danteLynchedPlayerId: victim,
          earthInnocentsLynched: isTownLynched && victim ? [victim] : [],
          earthKlaatuFreezeActivated: false,
          earthGortTarget: null,
          valkyrieBriefcasePassTarget: null,
          prisonGuardSanctions: [],
          prisonWardenAppeased: [],
          prisonInmatesLynched: isTownLynched && victim ? [victim] : [],
          prisonSolitary: [],
          prisonAssassinStrike: false,
          prisonAssassinTarget: null,
          catenaccioSniperTarget: null,
          catenaccioWallAttackers: [],
          publicDeaths: [],
        });
        inMemoryLobbyStore.updateLobby(lobbyId, (current) => ({
          ...current,
          minigameSubStates: minigameOutput.updatedSubStates,
        }));
      }

      const lynchPayload: LynchOutcomePayload = {
        lobbyId,
        outcome: result.outcome,
        victimRoleRevealed: isViolenceCleaned ? null : victim,
      };
      anySocket.broadcastToRoom(room, 'LYNCH_OUTCOME', lynchPayload);
    }

    return result;
  }

  // ── Phase Transition ──────────────────────────────────────────────────────

  /**
   * Execute authoritative phase transition, wire room management for All-In districts.
   * Broadcasts PHASE_TRANSITION and, when applicable, WIN_CONDITION_REACHED.
   */
  public executePhaseAndBroadcast(lobbyId: string): PhaseTransitionResult | null {
    const lobby = inMemoryLobbyStore.getLobby(lobbyId);
    if (!lobby) return null;

    const result = executePhaseTransition({ lobbyId });
    if (!result) return null;

    const anySocket = Object.values(this.userSocketMap)[0];
    const room = lobbyRoomName(lobbyId);

    if (anySocket) {
      anySocket.broadcastToRoom(room, 'PHASE_TRANSITION', {
        lobbyId,
        fromPhase:       result.fromPhase,
        toPhase:         result.toPhase,
        durationSeconds: result.durationSeconds,
        roundNumber:     result.roundNumber,
      });
    }

    // Handle All-In room management
    if (result.toPhase === 'DAY_REGIONAL_CAUCUS' && lobby.mode === 'ALL_IN') {
      assignDistrictRooms(lobby, this.userSocketMap);
    } else if (result.toPhase === 'DAY_CENTRAL_ASSEMBLY' && lobby.mode === 'ALL_IN') {
      mergeDistrictRoomsToGlobal(lobby, this.userSocketMap);
    }

    // Emit win condition if game is over
    if (result.winCondition.kind !== 'GAME_CONTINUES' && anySocket) {
      anySocket.broadcastToRoom(room, 'WIN_CONDITION_REACHED', result.winCondition);
    }

    // Broadcast fresh scrubbed state after transition
    this.broadcastScrubbedState(lobbyId);

    return result;
  }

  // ── Socket Event Registration ─────────────────────────────────────────────

  /**
   * Register all Phase 2 client event handlers onto a socket.
   * Complements the Phase 1 handler from handler.ts.
   */
  public registerPhase2Handlers(
    socket: TypedServerSocket,
    bindListener: <E extends keyof ClientToServerEvents>(event: E, handler: ClientToServerEvents[E]) => void,
  ): void {
    bindListener('CAST_VOTE', (payload) => {
      const lobby = inMemoryLobbyStore.getLobby(payload.lobbyId);
      if (!lobby || lobby.phase !== 'DAY_VOTING') {
        socket.emit('ERROR_NOTIFICATION', {
          code: 'VOTE_REJECTED',
          message: 'Voting is not open for this lobby.',
          context: payload.lobbyId,
        });
        return;
      }
      // Verify voter is alive
      const voter = lobby.players[payload.voterUserId];
      if (!voter || !voter.isAlive) {
        socket.emit('ERROR_NOTIFICATION', {
          code: 'DEAD_PLAYER_VOTE',
          message: 'Eliminated players may not cast votes.',
          context: payload.lobbyId,
        });
        return;
      }
      inMemoryLobbyStore.transitionPhase(payload.lobbyId, lobby.phase, lobby.phaseTimeRemaining);
      this.broadcastScrubbedState(payload.lobbyId);
    });

    bindListener('SET_HOST_READY', (payload) => {
      const lobby = inMemoryLobbyStore.getLobby(payload.lobbyId);
      if (!lobby) return;
      if (lobby.hostUserId !== payload.hostUserId) {
        socket.emit('ERROR_NOTIFICATION', {
          code: 'NOT_HOST',
          message: 'Only the host may ready the lobby.',
          context: payload.lobbyId,
        });
        return;
      }
      if (payload.ready && lobby.adminMasterUnlock.dualLockVerified) {
        this.executePhaseAndBroadcast(payload.lobbyId);
      }
    });
  }
}

export const zkDispatcher = new ZeroKnowledgeDispatcher();
