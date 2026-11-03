/**
 * TDV Mafia - Empirical Stress Test Suite: Mafia Night Anti-Friendly Fire Invariant
 * Target: tests/stress-bot-anti-friendly-fire.ts
 *
 * Requirements:
 * - Generate randomized lobby setups (varying Mafia sizes 1-4, varied living teammate permutations, poisoned AI suggestion inputs).
 * - Assert that 0 friendly fire selections occur (teammate target count === 0).
 * - Run 1,000+ simulated night selections.
 * - Test cross-faction parity (Yakuza, Void Cult).
 * - Adversarial buffer poisoning resilience.
 */

import assert from 'node:assert';
import {
  selectStrategicTarget,
  decideBotNightAction,
  getPlayerFaction,
  isTeammate,
  BotSession,
} from '../src/server/ai/bot-takeover';
import {
  PlayerSession,
  LobbyState,
  GamePhase,
  NightActionBufferItem,
  NightActionPriority,
  NightActionType,
} from '../src/types/game';
import {
  CoreFaction,
  CivicOfficeType,
  InnateTraitType,
  AllInDistrict,
  formatRoleDisplay,
} from '../src/types/roles';

// ============================================================================
// FIXTURE FACTORIES
// ============================================================================

interface MockPlayerOpts {
  readonly id: string;
  readonly username: string;
  readonly roleName: string;
  readonly localizedRoleName?: string;
  readonly faction?: CoreFaction;
  readonly office?: CivicOfficeType;
  readonly trait?: InnateTraitType;
  readonly district?: AllInDistrict;
  readonly isAlive?: boolean;
  readonly isAiBotControlled?: boolean;
}

export function createMockPlayer(opts: MockPlayerOpts): PlayerSession {
  return {
    socketId: `sock-${opts.id}`,
    userId: opts.id,
    username: opts.username,
    tier: 'TIER_1',
    adminRole: 'NONE',
    isHost: false,
    isAlive: opts.isAlive ?? true,
    hasHostWaiver: true,
    hasAdminWaiver: false,
    displayRole: formatRoleDisplay(
      opts.username,
      opts.roleName,
      opts.localizedRoleName ?? opts.roleName
    ),
    allInIdentity: {
      layer1Faction: opts.faction ?? 'TOWN',
      layer2Office: opts.office ?? 'PUBLIC_DEFENDER',
      layer3Trait: opts.trait ?? 'CONTRABAND_POCKET',
      district: opts.district ?? 'COMMERCIAL',
    },
    currentDistrict: opts.district ?? 'COMMERCIAL',
    disconnectedAt: null,
    isAiBotControlled: opts.isAiBotControlled ?? true,
  };
}

interface MockLobbyOpts {
  readonly lobbyId?: string;
  readonly phase?: GamePhase;
  readonly roundNumber?: number;
  readonly bufferedNightActions?: NightActionBufferItem[];
}

export function createMockLobby(
  players: Record<string, PlayerSession>,
  opts?: MockLobbyOpts
): LobbyState {
  const hostId = Object.keys(players)[0] ?? 'p-host';
  const lobbyId = opts?.lobbyId ?? `stress-lobby-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    lobbyId,
    hostUserId: hostId,
    mode: 'BLITZ',
    phase: opts?.phase ?? 'NIGHT_BUFFER',
    players,
    hostReady: true,
    adminMasterUnlock: {
      architectUnlocked: false,
      bailiffUnlocked: false,
      dualLockVerified: false,
      unlockedAt: null,
    },
    assignedArchitectId: null,
    assignedBailiffId: null,
    phaseDurationSeconds: 45,
    phaseTimeRemaining: 45,
    nightJitterDelaySeconds: 4,
    liveVotes: {},
    trialVerdictVotes: {},
    accusedPlayerId: null,
    mayorRevealedUserIds: [],
    speakerQueue: [],
    bufferedNightActions: opts?.bufferedNightActions ?? [],
    minigameSubStates: {},
    roundNumber: opts?.roundNumber ?? 1,
    lastLynchedUserId: null,
    globalNightKillCap: 5,
    latestNewspaper: null,
    pastNewspapers: [],
    privateInvestigations: {},
    chatMessages: [],
  };
}

// ============================================================================
// RANDOMIZED GENERATOR & POISON VECTORS
// ============================================================================

const MAFIA_ROLES = ['Godfather', 'Mafioso', 'Consigliere', 'Blackmailer'] as const;
const YAKUZA_ROLES = ['Oyabun', 'Wakagashira', 'Shingiin', 'Yakuza_Enforcer'] as const;
const CULT_ROLES = ['Cult_Leader', 'Acolyte', 'Harbinger', 'Zealot'] as const;
const TOWN_ROLES = ['Citizen', 'Doctor', 'Sheriff', 'Escort', 'Vigilante', 'Mayor', 'Investigator', 'Bodyguard'] as const;
const NEUTRAL_ROLES = ['Jester', 'Executioner', 'Serial Killer', 'Arsonist', 'Survivor'] as const;

const OFFICES: CivicOfficeType[] = [
  'MAYOR', 'CHIEF_PROSECUTOR', 'CENTRAL_BANKER', 'PRISON_WARDEN',
  'POLICE_COMMISSIONER', 'CITY_SURGEON', 'PUBLIC_DEFENDER', 'CITY_INVESTIGATOR',
];

const TRAITS: InnateTraitType[] = [
  'BULLETPROOF_VEST', 'IRON_WILL', 'PHANTOM_STEP', 'NIGHT_VISION',
  'CONTRABAND_POCKET', 'SHADOW_COMMUNICATION', 'COLD_BLOODED',
];

export type PoisonVectorType =
  | 'LIVING_TEAMMATE'
  | 'DEAD_TEAMMATE'
  | 'SELF'
  | 'HALLUCINATED_ID'
  | 'DEAD_ENEMY'
  | 'EMPTY_STRING'
  | 'NULL_SUGGESTION'
  | 'VALID_LIVING_ENEMY';

interface GeneratedLobbyConfig {
  faction: CoreFaction;
  syndicateSize: number; // 1 to 4
  townCount: number;     // 0 to 10
  neutralCount: number;  // 0 to 3
  syndicateAlivePattern: 'ALL_ALIVE' | 'SOME_DEAD' | 'ONE_ALIVE' | 'RANDOM';
  enemyAlivePattern: 'ALL_ALIVE' | 'SOME_DEAD' | 'ALL_DEAD' | 'RANDOM';
  bufferedActionType?: 'NONE' | 'COORDINATED_VALID' | 'CORRUPTED_TEAMMATE_TARGET';
}

function generateLobbyWithFaction(config: GeneratedLobbyConfig) {
  const players: Record<string, PlayerSession> = {};
  const syndicatePlayers: PlayerSession[] = [];
  const enemyPlayers: PlayerSession[] = [];

  const rolesList =
    config.faction === 'MAFIA'
      ? MAFIA_ROLES
      : config.faction === 'YAKUZA'
      ? YAKUZA_ROLES
      : CULT_ROLES;

  // 1. Generate Syndicate Members
  for (let i = 0; i < config.syndicateSize; i++) {
    const id = `${config.faction.toLowerCase()}-${i + 1}`;
    const roleName = rolesList[i % rolesList.length]!;
    let isAlive = true;

    if (config.syndicateAlivePattern === 'ONE_ALIVE') {
      isAlive = (i === 0);
    } else if (config.syndicateAlivePattern === 'SOME_DEAD') {
      isAlive = (i % 2 === 0);
    } else if (config.syndicateAlivePattern === 'RANDOM') {
      isAlive = i === 0 ? true : Math.random() > 0.4; // Actor (i=0) always alive
    }

    const p = createMockPlayer({
      id,
      username: `${roleName}_${i + 1}`,
      roleName,
      faction: config.faction,
      office: OFFICES[i % OFFICES.length],
      trait: TRAITS[i % TRAITS.length],
      isAlive,
    });
    players[id] = p;
    syndicatePlayers.push(p);
  }

  // 2. Generate Town Players
  for (let i = 0; i < config.townCount; i++) {
    const id = `town-${i + 1}`;
    const roleName = TOWN_ROLES[i % TOWN_ROLES.length]!;
    let isAlive = true;

    if (config.enemyAlivePattern === 'ALL_DEAD') {
      isAlive = false;
    } else if (config.enemyAlivePattern === 'SOME_DEAD') {
      isAlive = (i % 2 === 0);
    } else if (config.enemyAlivePattern === 'RANDOM') {
      isAlive = Math.random() > 0.3;
    }

    const p = createMockPlayer({
      id,
      username: `${roleName}_${i + 1}`,
      roleName,
      faction: 'TOWN',
      office: OFFICES[(i + 2) % OFFICES.length],
      isAlive,
    });
    players[id] = p;
    enemyPlayers.push(p);
  }

  // 3. Generate Neutral Players
  for (let i = 0; i < config.neutralCount; i++) {
    const id = `neutral-${i + 1}`;
    const roleName = NEUTRAL_ROLES[i % NEUTRAL_ROLES.length]!;
    let isAlive = true;

    if (config.enemyAlivePattern === 'ALL_DEAD') {
      isAlive = false;
    } else if (config.enemyAlivePattern === 'SOME_DEAD') {
      isAlive = (i % 2 !== 0);
    } else if (config.enemyAlivePattern === 'RANDOM') {
      isAlive = Math.random() > 0.4;
    }

    const p = createMockPlayer({
      id,
      username: `${roleName}_${i + 1}`,
      roleName,
      faction: 'NEUTRAL_EVIL',
      office: 'PUBLIC_DEFENDER',
      isAlive,
    });
    players[id] = p;
    enemyPlayers.push(p);
  }

  // 4. Handle Buffered Actions (Coordinated vs Adversarial Injection)
  const bufferedNightActions: NightActionBufferItem[] = [];
  const actor = syndicatePlayers.find(p => p.isAlive)!;

  if (config.bufferedActionType === 'COORDINATED_VALID') {
    const otherSyndicate = syndicatePlayers.find(p => p.isAlive && p.userId !== actor.userId);
    const livingEnemy = enemyPlayers.find(p => p.isAlive);
    if (otherSyndicate && livingEnemy) {
      bufferedNightActions.push({
        actorPlayerId: otherSyndicate.userId,
        targetPlayerId: livingEnemy.userId,
        actionType: 'KILL',
        priority: 4,
        timestamp: Date.now() - 500,
      });
    }
  } else if (config.bufferedActionType === 'CORRUPTED_TEAMMATE_TARGET') {
    // Malicious or corrupted action in buffer targeting a teammate!
    const otherSyndicate = syndicatePlayers.find(p => p.isAlive && p.userId !== actor.userId);
    if (otherSyndicate) {
      bufferedNightActions.push({
        actorPlayerId: otherSyndicate.userId,
        targetPlayerId: actor.userId, // Corrupted buffer targeting teammate!
        actionType: 'KILL',
        priority: 4,
        timestamp: Date.now() - 500,
      });
    }
  }

  const lobby = createMockLobby(players, { bufferedNightActions });

  return {
    lobby,
    actor,
    syndicatePlayers,
    enemyPlayers,
  };
}

function resolvePoisonSuggestion(
  vector: PoisonVectorType,
  actor: PlayerSession,
  syndicatePlayers: PlayerSession[],
  enemyPlayers: PlayerSession[]
): string | null {
  switch (vector) {
    case 'LIVING_TEAMMATE': {
      const livingTeammates = syndicatePlayers.filter(p => p.isAlive && p.userId !== actor.userId);
      if (livingTeammates.length > 0) {
        return livingTeammates[Math.floor(Math.random() * livingTeammates.length)]!.userId;
      }
      return actor.userId; // fallback if no other living teammates
    }
    case 'DEAD_TEAMMATE': {
      const deadTeammates = syndicatePlayers.filter(p => !p.isAlive);
      if (deadTeammates.length > 0) {
        return deadTeammates[Math.floor(Math.random() * deadTeammates.length)]!.userId;
      }
      return `${actor.userId}_deceased_fake`;
    }
    case 'SELF': {
      return actor.userId;
    }
    case 'HALLUCINATED_ID': {
      return `hallucinated_player_${Math.random().toString(36).substring(2, 8)}`;
    }
    case 'DEAD_ENEMY': {
      const deadEnemies = enemyPlayers.filter(p => !p.isAlive);
      if (deadEnemies.length > 0) {
        return deadEnemies[Math.floor(Math.random() * deadEnemies.length)]!.userId;
      }
      return 'dead_town_nonexistent';
    }
    case 'EMPTY_STRING': {
      return '';
    }
    case 'NULL_SUGGESTION': {
      return null;
    }
    case 'VALID_LIVING_ENEMY': {
      const livingEnemies = enemyPlayers.filter(p => p.isAlive);
      if (livingEnemies.length > 0) {
        return livingEnemies[Math.floor(Math.random() * livingEnemies.length)]!.userId;
      }
      return null;
    }
  }
}

// ============================================================================
// STRESS TEST ASSERTION ORACLE
// ============================================================================

interface InvariantCheckMetrics {
  totalSelections: number;
  friendlyFireCount: number;
  selfTargetCount: number;
  deadTargetCount: number;
  hallucinatedCount: number;
  validEnemyCount: number;
  nullExhaustionCount: number;
  poisonSuggestionsRepelled: number;
}

const GLOBAL_METRICS: InvariantCheckMetrics = {
  totalSelections: 0,
  friendlyFireCount: 0,
  selfTargetCount: 0,
  deadTargetCount: 0,
  hallucinatedCount: 0,
  validEnemyCount: 0,
  nullExhaustionCount: 0,
  poisonSuggestionsRepelled: 0,
};

function verifySelectionInvariants(
  actor: PlayerSession,
  lobby: LobbyState,
  aiSuggestion: string | null,
  contextLabel: string
): void {
  GLOBAL_METRICS.totalSelections++;

  const actorFaction = getPlayerFaction(actor);
  const livingTeammates = Object.values(lobby.players).filter(
    p => p.isAlive && isTeammate(p, actorFaction)
  );
  const livingTeammateIds = new Set(livingTeammates.map(p => p.userId));
  const livingEnemies = Object.values(lobby.players).filter(
    p => p.isAlive && p.userId !== actor.userId && !isTeammate(p, actorFaction)
  );

  // 1. Evaluate selectStrategicTarget
  const target = selectStrategicTarget(actor, lobby, 'KILL', aiSuggestion);

  // 2. Evaluate decideBotNightAction
  const decision = decideBotNightAction(actor, lobby, null, aiSuggestion);

  // Assert Anti-Friendly Fire Invariant on selectStrategicTarget
  if (target !== null) {
    if (livingTeammateIds.has(target)) {
      GLOBAL_METRICS.friendlyFireCount++;
      assert.fail(`[CRITICAL FAILURE] ${contextLabel}: Friendly fire! Actor ${actor.userId} targeted teammate ${target}`);
    }
    if (target === actor.userId) {
      GLOBAL_METRICS.selfTargetCount++;
      assert.fail(`[CRITICAL FAILURE] ${contextLabel}: Self target! Actor ${actor.userId} targeted self`);
    }
    const targetPlayer = lobby.players[target];
    if (!targetPlayer) {
      GLOBAL_METRICS.hallucinatedCount++;
      assert.fail(`[CRITICAL FAILURE] ${contextLabel}: Hallucinated target! Actor targeted non-existent ID ${target}`);
    }
    if (!targetPlayer.isAlive) {
      GLOBAL_METRICS.deadTargetCount++;
      assert.fail(`[CRITICAL FAILURE] ${contextLabel}: Dead target! Actor targeted deceased player ${target}`);
    }
    GLOBAL_METRICS.validEnemyCount++;
  } else {
    GLOBAL_METRICS.nullExhaustionCount++;
  }

  // Assert Anti-Friendly Fire Invariant on decideBotNightAction
  if (decision !== null) {
    assert.strictEqual(decision.actionType, 'KILL', `${contextLabel}: Decision actionType must be KILL`);
    assert.strictEqual(decision.priority, 4, `${contextLabel}: Decision priority must be 4`);
    assert.strictEqual(
      livingTeammateIds.has(decision.targetPlayerId),
      false,
      `[CRITICAL FAILURE] ${contextLabel}: decideBotNightAction selected fellow teammate ${decision.targetPlayerId}`
    );
    assert.notStrictEqual(
      decision.targetPlayerId,
      actor.userId,
      `[CRITICAL FAILURE] ${contextLabel}: decideBotNightAction selected self`
    );
    const decisionTarget = lobby.players[decision.targetPlayerId];
    assert.ok(decisionTarget, `${contextLabel}: Decision target must exist in lobby`);
    assert.ok(decisionTarget.isAlive, `${contextLabel}: Decision target must be living`);
    assert.strictEqual(isTeammate(decisionTarget, actorFaction), false, `${contextLabel}: Decision target must not be a teammate`);
  } else {
    assert.strictEqual(target, null, `${contextLabel}: When decideBotNightAction is null, target must be null`);
  }

  // Assert Exhaustion Boundary: If living enemies exist, target CANNOT be null
  if (livingEnemies.length > 0) {
    assert.ok(target !== null, `${contextLabel}: Must select an enemy when living enemies exist (${livingEnemies.length} enemies alive)`);
    assert.ok(decision !== null, `${contextLabel}: decideBotNightAction must not be null when enemies exist`);
  } else {
    // If NO living enemies exist, target MUST strictly be null (never fall back to teammate!)
    assert.strictEqual(
      target,
      null,
      `${contextLabel}: Must return null when no enemies remain alive (Strict Zero Friendly Fire Exhaustion)`
    );
    assert.strictEqual(
      decision,
      null,
      `${contextLabel}: decideBotNightAction must return null when no enemies remain alive`
    );
  }

  // Assert Poison Suggestion Rejection Tracking
  if (
    aiSuggestion &&
    (livingTeammateIds.has(aiSuggestion) ||
      aiSuggestion === actor.userId ||
      !lobby.players[aiSuggestion]?.isAlive)
  ) {
    GLOBAL_METRICS.poisonSuggestionsRepelled++;
    assert.notStrictEqual(
      target,
      aiSuggestion,
      `${contextLabel}: Poisoned AI suggestion "${aiSuggestion}" must have been REJECTED!`
    );
  }
}

// ============================================================================
// SUITE 1: 1,000+ RANDOMIZED MONTE CARLO FUZZING TRIALS
// ============================================================================

export function runMonteCarloFuzzingHarness(trialCount: number = 1000): void {
  console.log(`\n================================================================`);
  console.log(`[Suite 1] Empirical Fuzzing Harness: ${trialCount} Randomized Night Selections`);
  console.log(`================================================================`);

  const POISON_VECTORS: PoisonVectorType[] = [
    'LIVING_TEAMMATE',
    'DEAD_TEAMMATE',
    'SELF',
    'HALLUCINATED_ID',
    'DEAD_ENEMY',
    'EMPTY_STRING',
    'NULL_SUGGESTION',
    'VALID_LIVING_ENEMY',
  ];

  for (let i = 0; i < trialCount; i++) {
    // Randomize Mafia Syndicate size: 1 to 4
    const mafiaSize = (Math.floor(Math.random() * 4) + 1); // 1, 2, 3, or 4
    const townCount = Math.floor(Math.random() * 8) + 1;   // 1 to 8
    const neutralCount = Math.floor(Math.random() * 3);    // 0 to 2

    const syndicateAlivePatterns: ('ALL_ALIVE' | 'SOME_DEAD' | 'ONE_ALIVE' | 'RANDOM')[] = [
      'ALL_ALIVE', 'SOME_DEAD', 'ONE_ALIVE', 'RANDOM',
    ];
    const enemyAlivePatterns: ('ALL_ALIVE' | 'SOME_DEAD' | 'ALL_DEAD' | 'RANDOM')[] = [
      'ALL_ALIVE', 'SOME_DEAD', 'ALL_DEAD', 'RANDOM',
    ];

    const syndicateAlivePattern = syndicateAlivePatterns[i % syndicateAlivePatterns.length]!;
    const enemyAlivePattern = enemyAlivePatterns[Math.floor(Math.random() * enemyAlivePatterns.length)]!;
    const poisonVector = POISON_VECTORS[i % POISON_VECTORS.length]!;

    const bufferedStrategy =
      i % 5 === 0 ? 'CORRUPTED_TEAMMATE_TARGET' : i % 3 === 0 ? 'COORDINATED_VALID' : 'NONE';

    const { lobby, actor, syndicatePlayers, enemyPlayers } = generateLobbyWithFaction({
      faction: 'MAFIA',
      syndicateSize: mafiaSize,
      townCount,
      neutralCount,
      syndicateAlivePattern,
      enemyAlivePattern,
      bufferedActionType: bufferedStrategy,
    });

    const aiSuggestion = resolvePoisonSuggestion(
      poisonVector,
      actor,
      syndicatePlayers,
      enemyPlayers
    );

    verifySelectionInvariants(
      actor,
      lobby,
      aiSuggestion,
      `Suite 1 Trial #${i + 1} (MafiaSize=${mafiaSize}, Poison=${poisonVector})`
    );

    if ((i + 1) % 250 === 0) {
      console.log(`  ▶ Progress: ${i + 1}/${trialCount} simulated selections verified (0 friendly-fire incidents)`);
    }
  }

  console.log(`✔ Suite 1 Passed: Completed ${trialCount} Monte Carlo selections with 0 friendly-fire incidents.`);
}

// ============================================================================
// SUITE 2: SYSTEMATIC 4x8 MATRIX (MAFIA SIZES 1-4 x ALL 8 POISON VECTORS)
// ============================================================================

export function runSystematicPoisonMatrix(): void {
  console.log(`\n================================================================`);
  console.log(`[Suite 2] Systematic Poison Matrix (Mafia Sizes 1-4 x 8 Poison Vectors)`);
  console.log(`================================================================`);

  const POISON_VECTORS: PoisonVectorType[] = [
    'LIVING_TEAMMATE',
    'DEAD_TEAMMATE',
    'SELF',
    'HALLUCINATED_ID',
    'DEAD_ENEMY',
    'EMPTY_STRING',
    'NULL_SUGGESTION',
    'VALID_LIVING_ENEMY',
  ];

  let matrixTrials = 0;

  for (let mafiaSize = 1; mafiaSize <= 4; mafiaSize++) {
    for (const vector of POISON_VECTORS) {
      // 10 trials per cell in the matrix = 4 * 8 * 10 = 320 trials
      for (let trial = 0; trial < 10; trial++) {
        matrixTrials++;
        const { lobby, actor, syndicatePlayers, enemyPlayers } = generateLobbyWithFaction({
          faction: 'MAFIA',
          syndicateSize: mafiaSize,
          townCount: 4,
          neutralCount: 1,
          syndicateAlivePattern: 'RANDOM',
          enemyAlivePattern: 'RANDOM',
        });

        const aiSuggestion = resolvePoisonSuggestion(
          vector,
          actor,
          syndicatePlayers,
          enemyPlayers
        );

        verifySelectionInvariants(
          actor,
          lobby,
          aiSuggestion,
          `Suite 2 Cell [Size=${mafiaSize}, Vector=${vector}] Run #${trial + 1}`
        );
      }
    }
    console.log(`  ✔ Mafia Size ${mafiaSize} (8 poison vectors x 10 runs = 80 trials verified)`);
  }

  console.log(`✔ Suite 2 Passed: Completed ${matrixTrials} systematic matrix trials with 100% invariant adherence.`);
}

// ============================================================================
// SUITE 3: BOUNDARY & EXHAUSTION STRESS TESTS
// ============================================================================

export function runBoundaryAndExhaustionTests(): void {
  console.log(`\n================================================================`);
  console.log(`[Suite 3] Boundary & Exhaustion Permutations (All Town Dead & Corrupted Buffers)`);
  console.log(`================================================================`);

  let boundaryTrials = 0;

  // 1. Team Exhaustion: All enemies dead, Mafia sizes 1-4
  for (let mafiaSize = 1; mafiaSize <= 4; mafiaSize++) {
    for (let t = 0; t < 15; t++) {
      boundaryTrials++;
      const { lobby, actor, syndicatePlayers, enemyPlayers } = generateLobbyWithFaction({
        faction: 'MAFIA',
        syndicateSize: mafiaSize,
        townCount: 3,
        neutralCount: 1,
        syndicateAlivePattern: 'ALL_ALIVE',
        enemyAlivePattern: 'ALL_DEAD', // Exhaustion: 0 enemies alive!
      });

      // Adversarially suggest a fellow teammate
      const aiSuggestion = resolvePoisonSuggestion(
        'LIVING_TEAMMATE',
        actor,
        syndicatePlayers,
        enemyPlayers
      );

      verifySelectionInvariants(
        actor,
        lobby,
        aiSuggestion,
        `Suite 3 Exhaustion [Size=${mafiaSize}] Run #${t + 1}`
      );
    }
  }
  console.log(`  ✔ Team Exhaustion: 60 trials across sizes 1-4 strictly returned null (0 friendly fire)`);

  // 2. Adversarial Buffer Inversion: Teammate buffered kill action on fellow teammate!
  for (let mafiaSize = 2; mafiaSize <= 4; mafiaSize++) {
    for (let t = 0; t < 15; t++) {
      boundaryTrials++;
      const { lobby, actor, syndicatePlayers, enemyPlayers } = generateLobbyWithFaction({
        faction: 'MAFIA',
        syndicateSize: mafiaSize,
        townCount: 3,
        neutralCount: 0,
        syndicateAlivePattern: 'ALL_ALIVE',
        enemyAlivePattern: 'ALL_ALIVE',
        bufferedActionType: 'CORRUPTED_TEAMMATE_TARGET', // Adversarial buffer poisoning
      });

      const aiSuggestion = resolvePoisonSuggestion(
        'HALLUCINATED_ID',
        actor,
        syndicatePlayers,
        enemyPlayers
      );

      verifySelectionInvariants(
        actor,
        lobby,
        aiSuggestion,
        `Suite 3 Corrupted Buffer [Size=${mafiaSize}] Run #${t + 1}`
      );
    }
  }
  console.log(`  ✔ Corrupted Buffer Resistance: 45 trials rejected poisoned teammate buffer actions`);

  console.log(`✔ Suite 3 Passed: Completed ${boundaryTrials} boundary and exhaustion trials.`);
}

// ============================================================================
// SUITE 4: CROSS-FACTION PARITY (YAKUZA & VOID CULT STRESS)
// ============================================================================

export function runCrossFactionParityTests(): void {
  console.log(`\n================================================================`);
  console.log(`[Suite 4] Cross-Faction Parity Stress (Yakuza & Void Cult Syndicates)`);
  console.log(`================================================================`);

  let factionTrials = 0;

  // 1. Yakuza Syndicate (100 trials)
  for (let i = 0; i < 100; i++) {
    factionTrials++;
    const yakuzaSize = (i % 4) + 1; // 1 to 4
    const { lobby, actor, syndicatePlayers, enemyPlayers } = generateLobbyWithFaction({
      faction: 'YAKUZA',
      syndicateSize: yakuzaSize,
      townCount: 4,
      neutralCount: 1,
      syndicateAlivePattern: 'RANDOM',
      enemyAlivePattern: 'RANDOM',
    });

    const aiSuggestion = resolvePoisonSuggestion(
      i % 2 === 0 ? 'LIVING_TEAMMATE' : 'SELF',
      actor,
      syndicatePlayers,
      enemyPlayers
    );

    verifySelectionInvariants(
      actor,
      lobby,
      aiSuggestion,
      `Suite 4 Yakuza Run #${i + 1} (Size=${yakuzaSize})`
    );
  }
  console.log(`  ✔ Yakuza Syndicate: 100 selections verified (0 friendly-fire incidents)`);

  // 2. Void Cult Collective (100 trials)
  for (let i = 0; i < 100; i++) {
    factionTrials++;
    const cultSize = (i % 4) + 1; // 1 to 4
    const { lobby, actor, syndicatePlayers, enemyPlayers } = generateLobbyWithFaction({
      faction: 'VOID_CULT',
      syndicateSize: cultSize,
      townCount: 4,
      neutralCount: 1,
      syndicateAlivePattern: 'RANDOM',
      enemyAlivePattern: 'RANDOM',
    });

    const aiSuggestion = resolvePoisonSuggestion(
      i % 2 === 0 ? 'LIVING_TEAMMATE' : 'SELF',
      actor,
      syndicatePlayers,
      enemyPlayers
    );

    verifySelectionInvariants(
      actor,
      lobby,
      aiSuggestion,
      `Suite 4 Void Cult Run #${i + 1} (Size=${cultSize})`
    );
  }
  console.log(`  ✔ Void Cult Collective: 100 selections verified (0 friendly-fire incidents)`);

  console.log(`✔ Suite 4 Passed: Completed ${factionTrials} cross-faction parity trials.`);
}

// ============================================================================
// MAIN EXECUTION ENTRYPOINT
// ============================================================================

export function runAllAntiFriendlyFireStressTests(): void {
  const startTime = Date.now();
  console.log(`\n================================================================`);
  console.log(`STARTING EMPIRICAL STRESS TEST HARNESS: ANTI-FRIENDLY FIRE (1,500+ SELECTIONS)`);
  console.log(`================================================================`);

  // Suite 1: 1,000 Monte Carlo Fuzzing Trials
  runMonteCarloFuzzingHarness(1000);

  // Suite 2: Systematic 4x8 Matrix (320 Trials)
  runSystematicPoisonMatrix();

  // Suite 3: Boundary & Exhaustion Permutations (105 Trials)
  runBoundaryAndExhaustionTests();

  // Suite 4: Cross-Faction Syndicate Parity (200 Trials)
  runCrossFactionParityTests();

  const durationMs = Date.now() - startTime;

  console.log(`\n================================================================`);
  console.log(`EMPIRICAL STRESS TEST HARNESS SUMMARY METRICS:`);
  console.log(`================================================================`);
  console.log(`- Total Simulated Night Selections: ${GLOBAL_METRICS.totalSelections}`);
  console.log(`- Friendly Fire Target Count:        ${GLOBAL_METRICS.friendlyFireCount} (Strict invariant: must be 0)`);
  console.log(`- Self Target Count:                 ${GLOBAL_METRICS.selfTargetCount} (Strict invariant: must be 0)`);
  console.log(`- Dead Target Count:                 ${GLOBAL_METRICS.deadTargetCount} (Strict invariant: must be 0)`);
  console.log(`- Hallucinated Target Count:         ${GLOBAL_METRICS.hallucinatedCount} (Strict invariant: must be 0)`);
  console.log(`- Valid Enemy Selections:            ${GLOBAL_METRICS.validEnemyCount}`);
  console.log(`- Team Exhaustion (Null) Selections: ${GLOBAL_METRICS.nullExhaustionCount}`);
  console.log(`- Poison Suggestions Repelled:       ${GLOBAL_METRICS.poisonSuggestionsRepelled}`);
  console.log(`- Execution Wall Duration:           ${durationMs} ms`);
  console.log(`================================================================`);

  // Assert Top-Level Empirical Guarantees
  assert.ok(
    GLOBAL_METRICS.totalSelections >= 1000,
    `Must execute at least 1,000 simulated selections (executed ${GLOBAL_METRICS.totalSelections})`
  );
  assert.strictEqual(
    GLOBAL_METRICS.friendlyFireCount,
    0,
    `FATAL: Teammate friendly fire count must be exactly 0!`
  );
  assert.strictEqual(
    GLOBAL_METRICS.selfTargetCount,
    0,
    `FATAL: Self-targeting count must be exactly 0!`
  );
  assert.strictEqual(
    GLOBAL_METRICS.deadTargetCount,
    0,
    `FATAL: Dead target count must be exactly 0!`
  );
  assert.strictEqual(
    GLOBAL_METRICS.hallucinatedCount,
    0,
    `FATAL: Hallucinated target count must be exactly 0!`
  );

  console.log(`\n🏆 VERDICT: EMPIRICAL STRESS TEST PASSED WITH 100% SUCCESS — 0 FRIENDLY FIRE INCIDENTS`);
}

// Auto-run if executed directly
runAllAntiFriendlyFireStressTests();
