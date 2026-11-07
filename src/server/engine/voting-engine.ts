/**
 * Multi-Layer Ballot Accumulator & Voting Engine
 *
 * Handles:
 *   • Standard majority Lynch with tie-break
 *   • Dante CIRCLE_9_TREACHERY: blind ballot (votes hidden until phase lock)
 *   • All-In District Plebiscite: per-district finalist selection + Central Assembly
 *
 * Enterprise Mafia / Social Deduction Platform - Phase 2
 */

import { LobbyState, PlayerSession } from '../../types/game';
import { AllInDistrict } from '../../types/roles';
import { CivicOfficeType } from '../../types/roles';
import {
  DistrictVoteResult,
  LynchOutcome,
  VoteTally,
  VotingEngineOutput,
  VerdictVote,
  VerdictOutcome,
  MayorRevealResult,
} from '../../types/engine';

// ─── Civic office voting weight bonuses ──────────────────────────────────────

const OFFICE_WEIGHT_BONUS: Readonly<Record<CivicOfficeType, number>> = {
  MAYOR:                   2,  // Mayoral base extra weight (multiplied by 3 on reveal)
  CHIEF_PROSECUTOR:        1,
  CHIEF_JUSTICE:           1,
  CENTRAL_BANKER:          0,
  MEDIA_MOGUL:             0,
  PRISON_WARDEN:           0,
  POLICE_COMMISSIONER:     1,
  CITY_SURGEON:            0,
  LABOR_UNION_BOSS:        1,
  DISTRICT_ARCHITECT:      0,
  CHIEF_FIRE_MARSHAL:      0,
  BLACK_MARKET_BROKER:     0,
  PORT_AUTHORITY_DIRECTOR: 0,
  PUBLIC_DEFENDER:         0,
  CITY_INVESTIGATOR:       1,
  CORONER:                 0,
  CHRONOS_DIRECTOR:        0,
  NECRO_BIOLOGIST:         0,
};

export function isMayor(player: PlayerSession): boolean {
  if (player.allInIdentity?.layer2Office === 'MAYOR') {
    return true;
  }
  const roleId = (player as any).roleId?.toUpperCase?.() ?? (player.displayRole as any)?.roleId?.toUpperCase?.() ?? '';
  if (roleId === 'MAYOR') {
    return true;
  }
  if (!player.displayRole) return false;
  const original = player.displayRole.originalRoleName?.toLowerCase() ?? '';
  const localized = player.displayRole.localizedRoleName?.toLowerCase() ?? '';
  return (
    original === 'mayor' ||
    original.includes('mayor') ||
    localized.includes('mayor') ||
    localized.includes('bələdiyyə')
  );
}

export function getVoterWeight(
  voter: PlayerSession,
  isAllIn: boolean,
  mayorRevealedUserIds?: readonly string[]
): number {
  if (!voter || !voter.isAlive) return 0;

  const isRevealed =
    Boolean(mayorRevealedUserIds?.includes(voter.userId)) && isMayor(voter);

  if (!isAllIn) {
    return isRevealed ? 3 : 1;
  }

  const office = voter.allInIdentity?.layer2Office;
  const bonus = office ? (OFFICE_WEIGHT_BONUS[office] ?? 0) : 0;
  const baseWeight = 1 + bonus;

  return isRevealed ? baseWeight * 3 : baseWeight;
}

// ─── Tally builder ───────────────────────────────────────────────────────────

function buildTallies(
  liveVotes: Readonly<Record<string, string>>,
  players: Readonly<Record<string, PlayerSession>>,
  isAllIn: boolean,
  eligibleVoterIds: readonly string[],
  eligibleCandidateIds: readonly string[],
  mayorRevealedUserIds?: readonly string[]
): VoteTally[] {
  const candidateMap: Record<string, { count: number; weight: number; voters: string[] }> = {};

  for (const candidateId of eligibleCandidateIds) {
    candidateMap[candidateId] = { count: 0, weight: 0, voters: [] };
  }

  for (const voterId of eligibleVoterIds) {
    const voter = players[voterId];
    if (!voter || !voter.isAlive) continue;
    const candidateId = liveVotes[voterId];
    if (!candidateId) continue;
    if (!candidateMap[candidateId]) continue;

    const weight = getVoterWeight(voter, isAllIn, mayorRevealedUserIds);
    candidateMap[candidateId]!.count  += 1;
    candidateMap[candidateId]!.weight += weight;
    candidateMap[candidateId]!.voters.push(voterId);
  }

  return Object.entries(candidateMap).map(([id, data]) => ({
    candidateId: id,
    voteCount:   data.count,
    voteWeight:  data.weight,
    voterIds:    data.voters,
  }));
}

// ─── Lynch outcome calculator ─────────────────────────────────────────────────

function determineLynchOutcome(
  tallies: readonly VoteTally[],
  totalEligibleVoters: number,
  wrathMandatoryLynch: boolean
): LynchOutcome {
  if (tallies.length === 0) {
    return { kind: 'NO_LYNCH', reason: 'QUORUM_NOT_MET' };
  }

  // Sort descending by weighted votes, then by count as tie-break, then alphabetic for determinism
  const sorted = [...tallies].sort((a, b) => {
    if (b.voteWeight !== a.voteWeight) return b.voteWeight - a.voteWeight;
    if (b.voteCount !== a.voteCount)   return b.voteCount  - a.voteCount;
    return a.candidateId.localeCompare(b.candidateId);
  });

  const top = sorted[0]!;
  const second = sorted[1];

  // If nobody received votes
  if (top.voteWeight === 0) {
    if (wrathMandatoryLynch) {
      // WRATH: pick first candidate alphabetically if no votes (force random)
      const firstCandidate = tallies
        .map(t => t.candidateId)
        .sort((a, b) => a.localeCompare(b))[0];
      if (firstCandidate) return { kind: 'LYNCHED', victimId: firstCandidate, isCleaned: false };
    }
    return { kind: 'NO_LYNCH', reason: 'ABSTAIN' };
  }

  // Tie detection
  if (second && second.voteWeight === top.voteWeight && second.voteCount === top.voteCount) {
    const tied = sorted.filter(t => t.voteWeight === top.voteWeight && t.voteCount === top.voteCount).map(t => t.candidateId);
    if (wrathMandatoryLynch) {
      // WRATH: resolve tie by picking first alphabetically (no skips allowed)
      return { kind: 'LYNCHED', victimId: tied.sort((a, b) => a.localeCompare(b))[0]!, isCleaned: false };
    }
    return { kind: 'TIE', tiedCandidateIds: tied };
  }

  // Majority check: must exceed 50% of eligible voters (raw count or civic weighted bonus)
  const quorum = totalEligibleVoters === 0 ? 0 : Math.floor(totalEligibleVoters / 2) + 1;
  const effectiveVotes = Math.max(top.voteCount, top.voteWeight);
  if (effectiveVotes < quorum && !wrathMandatoryLynch) {
    return { kind: 'NO_LYNCH', reason: 'QUORUM_NOT_MET' };
  }

  return { kind: 'LYNCHED', victimId: top.candidateId, isCleaned: false };
}

/// ─── District Plebiscite (All-In) ─────────────────────────────────────────────

function runDistrictVotes(
  liveVotes: Readonly<Record<string, string>>,
  players: Readonly<Record<string, PlayerSession>>,
  wrathMandatoryLynch: boolean,
  mayorRevealedUserIds?: readonly string[]
): { districtResults: DistrictVoteResult[]; finalists: string[] } {
  const districts: AllInDistrict[] = ['ELITE', 'COMMERCIAL', 'INDUSTRIAL'];
  const districtResults: DistrictVoteResult[] = [];
  const finalists: string[] = [];

  for (const district of districts) {
    const districtPlayerIds = Object.values(players)
      .filter(p => p.isAlive && p.currentDistrict === district)
      .map(p => p.userId);

    const tallies = buildTallies(liveVotes, players, true, districtPlayerIds, districtPlayerIds, mayorRevealedUserIds);
    const outcome = determineLynchOutcome(tallies, districtPlayerIds.length, wrathMandatoryLynch);

    const finalist = outcome.kind === 'LYNCHED' ? outcome.victimId : null;
    if (finalist) finalists.push(finalist);

    districtResults.push({ district, tallies, districtFinalist: finalist });
  }

  return { districtResults, finalists };
}

// ─── Central Assembly Final Vote ──────────────────────────────────────────────

function runCentralAssemblyVote(
  liveVotes: Readonly<Record<string, string>>,
  players: Readonly<Record<string, PlayerSession>>,
  finalists: readonly string[],
  wrathMandatoryLynch: boolean,
  mayorRevealedUserIds?: readonly string[]
): { tallies: VoteTally[]; outcome: LynchOutcome } {
  const allAlivePlayers = Object.values(players).filter(p => p.isAlive).map(p => p.userId);
  const tallies = buildTallies(liveVotes, players, true, allAlivePlayers, finalists, mayorRevealedUserIds);
  const outcome = determineLynchOutcome(tallies, allAlivePlayers.length, wrathMandatoryLynch);
  return { tallies, outcome };
}

// ─── Main Voting Engine ───────────────────────────────────────────────────────

export interface VotingEngineInput {
  readonly lobby: LobbyState;
  /** True when called from the Central Assembly phase of All-In with pre-selected finalists */
  readonly centralAssemblyFinalists?: readonly string[];
}

export function runVotingEngine(input: VotingEngineInput): VotingEngineOutput {
  const { lobby, centralAssemblyFinalists } = input;
  const { liveVotes, players, mode, minigameSubStates, mayorRevealedUserIds } = lobby;

  const danteState = minigameSubStates?.dantesInferno;
  const isTreacheryBlind = danteState?.treacherySecretVotingActive === true;
  const wrathMandatoryLynch = danteState?.wrathNoAbstainEnforced === true;
  const isAllIn = mode === 'ALL_IN';

  const alivePlayers = Object.values(players).filter(p => p.isAlive);
  const aliveIds = alivePlayers.map(p => p.userId);

  // ── Dante CIRCLE_9_TREACHERY: blind ballot ─────────────────────────────
  // Votes are sealed; reveal map is returned but not emitted to clients until phase lock.
  const blindBallotReveal: Readonly<Record<string, string>> | null = isTreacheryBlind
    ? { ...liveVotes }
    : null;

  // ── Dante CIRCLE_4_GREED & Stanford Solitary Confinement ───────────────────
  // Exclude voters who owe their vote due to Greed night abilities or are held in solitary confinement
  const greedDebts = danteState?.greedVoteCostDebts ?? {};
  const solitaryInmates = new Set(minigameSubStates?.stanfordPrison?.solitaryConfinementPlayerIds ?? []);

  const effectiveLiveVotes: Record<string, string> = {};
  for (const [voterId, candidateId] of Object.entries(liveVotes)) {
    if (!greedDebts[voterId] && !solitaryInmates.has(voterId)) {
      effectiveLiveVotes[voterId] = candidateId;
    }
  }

  // ── All-In District Plebiscite ────────────────────────────────────────────
  if (isAllIn && !centralAssemblyFinalists) {
    // Phase 1: District plebiscite — run per-district votes
    const { districtResults, finalists } = runDistrictVotes(effectiveLiveVotes, players, wrathMandatoryLynch, mayorRevealedUserIds);

    // No outcome from district phase — finalists advance to Central Assembly
    return {
      tallies: districtResults.flatMap(dr => dr.tallies),
      outcome: finalists.length > 0
        ? { kind: 'TIE', tiedCandidateIds: finalists } // Advance state, not a real tie
        : { kind: 'NO_LYNCH', reason: 'QUORUM_NOT_MET' },
      districtResults,
      blindBallotReveal,
    };
  }

  if (isAllIn && centralAssemblyFinalists && centralAssemblyFinalists.length > 0) {
    // Phase 2: Central Assembly final vote between district finalists
    const { tallies, outcome } = runCentralAssemblyVote(effectiveLiveVotes, players, centralAssemblyFinalists, wrathMandatoryLynch, mayorRevealedUserIds);
    return {
      tallies,
      outcome,
      districtResults: [],
      blindBallotReveal,
      accusedCandidateId: outcome.kind === 'LYNCHED' ? outcome.victimId : null,
    };
  }

  // ── Standard majority Lynch ───────────────────────────────────────────────
  const tallies = buildTallies(effectiveLiveVotes, players, false, aliveIds, aliveIds, mayorRevealedUserIds);
  const outcome = determineLynchOutcome(tallies, aliveIds.length, wrathMandatoryLynch);
  const accusedCandidateId = outcome.kind === 'LYNCHED' ? outcome.victimId : null;

  return {
    tallies,
    outcome,
    districtResults: [],
    blindBallotReveal,
    accusedCandidateId,
  };
}

// ─── Mayor Reveal Executor ───────────────────────────────────────────────────

export function executeMayorReveal(
  lobby: LobbyState,
  userId: string
): MayorRevealResult {
  const player = lobby.players[userId];
  if (!player || !player.isAlive) {
    return {
      success: false,
      error: 'PLAYER_NOT_ALIVE',
      updatedLobby: lobby,
    };
  }

  if (!isMayor(player)) {
    return {
      success: false,
      error: 'NOT_A_MAYOR',
      updatedLobby: lobby,
    };
  }

  const existingRevealed = lobby.mayorRevealedUserIds ?? [];
  if (existingRevealed.includes(userId)) {
    return {
      success: false,
      error: 'ALREADY_REVEALED',
      updatedLobby: lobby,
    };
  }

  const updatedRevealed = [...existingRevealed, userId];
  const achievementIds = ['town_mayor_absolute_power', 'town_mayor_triple_hammer'];
  const userUnlocked = [
    ...(lobby.achievementsJustUnlocked?.[userId] ?? []),
    ...achievementIds.filter(id => !lobby.achievementsJustUnlocked?.[userId]?.includes(id)),
  ];

  const updatedLobby: LobbyState = {
    ...lobby,
    mayorRevealedUserIds: updatedRevealed,
    achievementsJustUnlocked: {
      ...(lobby.achievementsJustUnlocked ?? {}),
      [userId]: userUnlocked,
    },
  };

  return {
    success: true,
    updatedLobby,
    achievementsJustUnlocked: {
      [userId]: achievementIds,
    },
  };
}

// ─── Two-Tier Trial Verdict Engine ───────────────────────────────────────────

export function castVerdictVote(
  lobby: LobbyState,
  voterId: string,
  verdict: VerdictVote
): { success: boolean; error?: string; updatedLobby: LobbyState } {
  if (lobby.phase !== 'TRIAL_DEFENSE') {
    return { success: false, error: 'INVALID_PHASE', updatedLobby: lobby };
  }
  if (!lobby.accusedPlayerId) {
    return { success: false, error: 'NO_ACCUSED_PLAYER', updatedLobby: lobby };
  }
  if (voterId === lobby.accusedPlayerId) {
    return { success: false, error: 'ACCUSED_CANNOT_VOTE', updatedLobby: lobby };
  }
  const voter = lobby.players[voterId];
  if (!voter || !voter.isAlive) {
    return { success: false, error: 'VOTER_NOT_ALIVE', updatedLobby: lobby };
  }

  const updatedVotes = {
    ...(lobby.trialVerdictVotes ?? {}),
    [voterId]: verdict,
  };

  const updatedLobby: LobbyState = {
    ...lobby,
    trialVerdictVotes: updatedVotes,
  };

  return { success: true, updatedLobby };
}

export function determineVerdictOutcome(
  lobby: LobbyState,
  accusedPlayerIdOverride?: string | null
): VerdictOutcome {
  const accusedId = accusedPlayerIdOverride !== undefined ? accusedPlayerIdOverride : (lobby.accusedPlayerId ?? null);
  const isAllIn = lobby.mode === 'ALL_IN';
  const wrathMandatoryLynch = lobby.minigameSubStates?.dantesInferno?.wrathNoAbstainEnforced === true;
  const mayorRevealedUserIds = lobby.mayorRevealedUserIds ?? [];
  const trialVerdictVotes = lobby.trialVerdictVotes ?? {};

  if (!accusedId) {
    return {
      verdict: 'INNOCENT',
      accusedPlayerId: null,
      convictedPlayerId: null,
      guiltyWeight: 0,
      innocentWeight: 0,
      guiltyCount: 0,
      innocentCount: 0,
      reason: 'NO_VOTES',
      outcome: { kind: 'NO_LYNCH', reason: 'ABSTAIN' },
    };
  }

  // Voters disqualified due to Dante greed debt or Stanford solitary confinement
  const greedDebts = lobby.minigameSubStates?.dantesInferno?.greedVoteCostDebts ?? {};
  const solitaryInmates = new Set(lobby.minigameSubStates?.stanfordPrison?.solitaryConfinementPlayerIds ?? []);

  let guiltyWeight = 0;
  let innocentWeight = 0;
  let guiltyCount = 0;
  let innocentCount = 0;
  const guiltyVoterIds: string[] = [];

  for (const [voterId, vote] of Object.entries(trialVerdictVotes)) {
    // Accused cannot vote on their own verdict
    if (voterId === accusedId) continue;

    const voter = lobby.players[voterId];
    if (!voter || !voter.isAlive) continue;
    if (greedDebts[voterId] || solitaryInmates.has(voterId)) continue;

    const weight = getVoterWeight(voter, isAllIn, mayorRevealedUserIds);

    if (vote === 'GUILTY') {
      guiltyWeight += weight;
      guiltyCount += 1;
      guiltyVoterIds.push(voterId);
    } else if (vote === 'INNOCENT') {
      innocentWeight += weight;
      innocentCount += 1;
    }
  }

  // Decision rule:
  // GUILTY > INNOCENT -> CONVICTED
  // GUILTY === INNOCENT -> ACQUITTED (tie resolution: in dubio pro reo / presumption of innocence),
  //                        EXCEPT in Dante Wrath circle where mandatory lynch forces conviction
  // GUILTY < INNOCENT -> ACQUITTED
  let isConvicted = false;
  let reason: 'MAJORITY_GUILTY' | 'MAJORITY_INNOCENT' | 'TIE' | 'NO_VOTES' = 'MAJORITY_INNOCENT';

  if (guiltyWeight > innocentWeight) {
    isConvicted = true;
    reason = 'MAJORITY_GUILTY';
  } else if (guiltyWeight === innocentWeight) {
    if (guiltyWeight === 0 && innocentWeight === 0) {
      if (wrathMandatoryLynch) {
        isConvicted = true;
        reason = 'MAJORITY_GUILTY';
      } else {
        isConvicted = false;
        reason = 'NO_VOTES';
      }
    } else {
      if (wrathMandatoryLynch) {
        isConvicted = true;
        reason = 'MAJORITY_GUILTY';
      } else {
        isConvicted = false;
        reason = 'TIE';
      }
    }
  } else {
    isConvicted = false;
    reason = 'MAJORITY_INNOCENT';
  }

  const achievementsJustUnlocked: Record<string, string[]> = {};

  if (isConvicted) {
    // Award achievement to revealed Mayors who voted GUILTY
    for (const mayorId of mayorRevealedUserIds) {
      if (guiltyVoterIds.includes(mayorId)) {
        achievementsJustUnlocked[mayorId] = [
          ...(achievementsJustUnlocked[mayorId] ?? []),
          'town_mayor_absolute_power',
          'town_mayor_triple_hammer',
        ];
      }
    }

    return {
      verdict: 'GUILTY',
      accusedPlayerId: accusedId,
      convictedPlayerId: accusedId,
      guiltyWeight,
      innocentWeight,
      guiltyCount,
      innocentCount,
      reason,
      outcome: {
        kind: 'LYNCHED',
        victimId: accusedId,
        isCleaned: false,
      },
      achievementsJustUnlocked,
    };
  }

  // ACQUITTED: Accused survived the defense podium!
  // Award mastery_flawless_defense_speech to accused player
  if (accusedId && lobby.players[accusedId]?.isAlive) {
    achievementsJustUnlocked[accusedId] = [
      ...(achievementsJustUnlocked[accusedId] ?? []),
      'mastery_flawless_defense_speech',
    ];
  }

  return {
    verdict: 'INNOCENT',
    accusedPlayerId: accusedId,
    convictedPlayerId: null,
    guiltyWeight,
    innocentWeight,
    guiltyCount,
    innocentCount,
    reason,
    outcome: {
      kind: 'NO_LYNCH',
      reason: reason === 'NO_VOTES' ? 'ABSTAIN' : 'QUORUM_NOT_MET',
    },
    achievementsJustUnlocked,
  };
}
