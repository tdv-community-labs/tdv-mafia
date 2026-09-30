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
} from '../../types/engine';

// ─── Civic office voting weight bonuses ──────────────────────────────────────

const OFFICE_WEIGHT_BONUS: Readonly<Record<CivicOfficeType, number>> = {
  MAYOR:                   2,  // Mayoral extra weight
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

function getVoterWeight(voter: PlayerSession, isAllIn: boolean): number {
  if (!isAllIn) return 1;
  const office = voter.allInIdentity?.layer2Office;
  const bonus = office ? (OFFICE_WEIGHT_BONUS[office] ?? 0) : 0;
  return 1 + bonus;
}

// ─── Tally builder ───────────────────────────────────────────────────────────

function buildTallies(
  liveVotes: Readonly<Record<string, string>>,
  players: Readonly<Record<string, PlayerSession>>,
  isAllIn: boolean,
  eligibleVoterIds: readonly string[],
  eligibleCandidateIds: readonly string[]
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

    const weight = getVoterWeight(voter, isAllIn);
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

  // Majority check: must exceed 50% of weighted eligible votes
  const totalWeight = tallies.reduce((sum, t) => sum + t.voteWeight, 0);
  const quorum = totalEligibleVoters === 0 ? 0 : Math.floor(totalEligibleVoters / 2) + 1;
  if (top.voteCount < quorum && !wrathMandatoryLynch) {
    return { kind: 'NO_LYNCH', reason: 'QUORUM_NOT_MET' };
  }

  return { kind: 'LYNCHED', victimId: top.candidateId, isCleaned: false };
}

// ─── District Plebiscite (All-In) ─────────────────────────────────────────────

function runDistrictVotes(
  liveVotes: Readonly<Record<string, string>>,
  players: Readonly<Record<string, PlayerSession>>,
  wrathMandatoryLynch: boolean
): { districtResults: DistrictVoteResult[]; finalists: string[] } {
  const districts: AllInDistrict[] = ['ELITE', 'COMMERCIAL', 'INDUSTRIAL'];
  const districtResults: DistrictVoteResult[] = [];
  const finalists: string[] = [];

  for (const district of districts) {
    const districtPlayerIds = Object.values(players)
      .filter(p => p.isAlive && p.currentDistrict === district)
      .map(p => p.userId);

    const tallies = buildTallies(liveVotes, players, true, districtPlayerIds, districtPlayerIds);
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
  wrathMandatoryLynch: boolean
): { tallies: VoteTally[]; outcome: LynchOutcome } {
  const allAlivePlayers = Object.values(players).filter(p => p.isAlive).map(p => p.userId);
  const tallies = buildTallies(liveVotes, players, true, allAlivePlayers, finalists);
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
  const { liveVotes, players, mode, minigameSubStates } = lobby;

  const danteState = minigameSubStates.dantesInferno;
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

  // Voting map used for counting: in blind mode, same data (sealed from clients via ZK emitter)
  const effectiveLiveVotes: Readonly<Record<string, string>> = liveVotes;

  // ── All-In District Plebiscite ────────────────────────────────────────────
  if (isAllIn && !centralAssemblyFinalists) {
    // Phase 1: District plebiscite — run per-district votes
    const { districtResults, finalists } = runDistrictVotes(effectiveLiveVotes, players, wrathMandatoryLynch);

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
    const { tallies, outcome } = runCentralAssemblyVote(effectiveLiveVotes, players, centralAssemblyFinalists, wrathMandatoryLynch);
    return {
      tallies,
      outcome,
      districtResults: [],
      blindBallotReveal,
    };
  }

  // ── Standard majority Lynch ───────────────────────────────────────────────
  const tallies = buildTallies(effectiveLiveVotes, players, false, aliveIds, aliveIds);
  const outcome = determineLynchOutcome(tallies, aliveIds.length, wrathMandatoryLynch);

  return {
    tallies,
    outcome,
    districtResults: [],
    blindBallotReveal,
  };
}
