/**
 * Automated Unit Test Suite: Advanced Night Action Matrix & Innate Trait Dynamics
 *
 * Verifies:
 * - Group 1: Bodyguard Intercept & Counter-Kill (Sacrifice, Counter, Blocked BG, Attacker Iron Will)
 * - Group 2: IRON_WILL Trait Dynamics (Single hit absorb, double hit death, multi-night persistence, piercing bypass)
 * - Group 3: PHANTOM_STEP Trait Dynamics (BLOCK bypass for kills & protections)
 * - Group 4: NIGHT_VISION Observer Intel (Full visitor revelation, quiet target, blocked observer)
 * - Group 5: Compound Matrix Collisions (Bodyguard + Iron Will target, Double Bodyguard vs Double Killer)
 */

import assert from 'node:assert';
import { resolveNightActions } from '../src/server/engine/night-action-resolver';
import {
  LobbyState,
  NightActionBufferItem,
  NightActionPriority,
  NightActionType,
  PlayerSession,
} from '../src/types/game';
import {
  CoreFaction,
  CivicOfficeType,
  InnateTraitType,
  formatRoleDisplay,
} from '../src/types/roles';
import { DeathCause } from '../src/types/engine';

interface MockPlayerOpts {
  readonly id: string;
  readonly username: string;
  readonly roleName: string;
  readonly localizedRoleName?: string;
  readonly faction: CoreFaction;
  readonly trait?: InnateTraitType;
  readonly office?: CivicOfficeType;
  readonly isAlive?: boolean;
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
    hasHostWaiver: false,
    hasAdminWaiver: false,
    displayRole: formatRoleDisplay(
      opts.username,
      opts.roleName,
      opts.localizedRoleName ?? opts.roleName
    ),
    allInIdentity: {
      layer1Faction: opts.faction,
      layer2Office: opts.office ?? 'CITY_INVESTIGATOR',
      layer3Trait: opts.trait ?? 'CONTRABAND_POCKET',
      district: 'COMMERCIAL',
    },
    currentDistrict: 'COMMERCIAL',
    disconnectedAt: null,
    isAiBotControlled: false,
  };
}

export function createAction(
  actorPlayerId: string,
  targetPlayerId: string,
  actionType: NightActionType,
  priority: NightActionPriority,
  signature?: string
): NightActionBufferItem {
  return {
    actorPlayerId,
    targetPlayerId,
    actionType,
    priority,
    timestamp: Date.now(),
    signature,
  };
}

export function createMockLobby(
  players: Record<string, PlayerSession>,
  actions: NightActionBufferItem[],
  globalNightKillCap = 5,
  roundNumber = 1
): LobbyState {
  const hostId = Object.keys(players)[0] ?? 'p1';
  return {
    lobbyId: 'test-night-matrix-lobby',
    hostUserId: hostId,
    mode: 'ALL_IN',
    phase: 'NIGHT_BUFFER',
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
    speakerQueue: [],
    bufferedNightActions: actions,
    minigameSubStates: {},
    roundNumber,
    lastLynchedUserId: null,
    globalNightKillCap,
    chatMessages: [],
  };
}

// ============================================================================
// GROUP 1: BODYGUARD INTERCEPT & COUNTER-KILL
// ============================================================================

export function runBodyguardTests(): void {
  console.log('--- [Suite 1] Bodyguard Intercept & Counter-Kill ---');

  // TEST 1.1: Happy Path — Bodyguard intercepts single killer
  {
    console.log('▶ Test 1.1: Bodyguard intercepts single killer (counter-kill & sacrifice)');
    const target = createMockPlayer({ id: 'target-1', username: 'Citizen Alice', roleName: 'Vanilla Town', faction: 'TOWN' });
    const bodyguard = createMockPlayer({ id: 'bg-1', username: 'Bodyguard Bob', roleName: 'Bodyguard', localizedRoleName: 'Cangüdən', faction: 'TOWN' });
    const killer = createMockPlayer({ id: 'killer-1', username: 'Killer Charlie', roleName: 'Serial Killer', faction: 'NEUTRAL_KILLER' });

    const players = { 'target-1': target, 'bg-1': bodyguard, 'killer-1': killer };
    const actions: NightActionBufferItem[] = [
      createAction('bg-1', 'target-1', 'PROTECT', 3),
      createAction('killer-1', 'target-1', 'KILL', 4),
    ];

    const lobby = createMockLobby(players, actions);
    const output = resolveNightActions({ lobby });

    // Assertions
    assert.strictEqual(output.updatedPlayers['target-1'].isAlive, true, 'Protected target MUST survive');
    assert.strictEqual(output.updatedPlayers['bg-1'].isAlive, false, 'Bodyguard MUST be eliminated (sacrifice)');
    assert.strictEqual(output.updatedPlayers['killer-1'].isAlive, false, 'Attacker MUST be eliminated (counter-kill)');

    // Verify death records
    const bgDeath = output.newspaper.publicDeaths.find(d => d.victimPlayerId === 'bg-1');
    assert.ok(bgDeath, 'Bodyguard death record MUST exist');
    assert.strictEqual(bgDeath.cause, 'BODYGUARD_SACRIFICE' as DeathCause);

    const killerDeath = output.newspaper.publicDeaths.find(d => d.victimPlayerId === 'killer-1');
    assert.ok(killerDeath, 'Killer death record MUST exist');
    assert.strictEqual(killerDeath.cause, 'BODYGUARD_COUNTER' as DeathCause);

    // Verify target recorded in protectedIds
    assert.ok(output.newspaper.protectedIds?.includes('target-1'), 'Target MUST be in protectedIds');

    // Verify achievement awarded
    assert.ok(
      output.achievementsJustUnlocked?.['bg-1']?.includes('town_bodyguard_noble_sacrifice'),
      'Bodyguard MUST be awarded noble sacrifice achievement'
    );
    console.log('  ✔ Test 1.1 Passed');
  }

  // TEST 1.2: Double Attacker — Bodyguard intercepts first, second kills target
  {
    console.log('▶ Test 1.2: Bodyguard vs Double Attacker (intercepts first, second kills target)');
    const target = createMockPlayer({ id: 'target-1', username: 'Citizen Alice', roleName: 'Vanilla Town', faction: 'TOWN' });
    const bodyguard = createMockPlayer({ id: 'bg-1', username: 'Bodyguard Bob', roleName: 'Bodyguard', faction: 'TOWN' });
    const killer1 = createMockPlayer({ id: 'killer-1', username: 'Killer 1', roleName: 'Serial Killer', faction: 'NEUTRAL_KILLER' });
    const killer2 = createMockPlayer({ id: 'killer-2', username: 'Killer 2', roleName: 'Void Cultist', faction: 'VOID_CULT' });

    const players = { 'target-1': target, 'bg-1': bodyguard, 'killer-1': killer1, 'killer-2': killer2 };
    const actions: NightActionBufferItem[] = [
      createAction('bg-1', 'target-1', 'PROTECT', 3),
      createAction('killer-1', 'target-1', 'KILL', 4),
      createAction('killer-2', 'target-1', 'KILL', 4),
    ];

    const lobby = createMockLobby(players, actions);
    const output = resolveNightActions({ lobby });

    // Assertions
    assert.strictEqual(output.updatedPlayers['bg-1'].isAlive, false, 'Bodyguard dies intercepting Killer 1');
    assert.strictEqual(output.updatedPlayers['killer-1'].isAlive, false, 'Killer 1 counter-killed by Bodyguard');
    assert.strictEqual(output.updatedPlayers['target-1'].isAlive, false, 'Target dies from unblocked second attacker');
    assert.strictEqual(output.updatedPlayers['killer-2'].isAlive, true, 'Killer 2 survives');

    assert.ok(output.newspaper.publicDeaths.some(d => d.victimPlayerId === 'target-1' && d.cause === 'VOID_CULT_SACRIFICE'));
    assert.ok(output.newspaper.publicDeaths.some(d => d.victimPlayerId === 'bg-1' && d.cause === 'BODYGUARD_SACRIFICE'));
    assert.ok(output.newspaper.publicDeaths.some(d => d.victimPlayerId === 'killer-1' && d.cause === 'BODYGUARD_COUNTER'));
    console.log('  ✔ Test 1.2 Passed');
  }

  // TEST 1.3: Roleblocked Bodyguard — Intercept fails, target dies, bodyguard lives
  {
    console.log('▶ Test 1.3: Roleblocked Bodyguard (fails to protect, no counter-kill, target dies)');
    const target = createMockPlayer({ id: 'target-1', username: 'Citizen Alice', roleName: 'Vanilla Town', faction: 'TOWN' });
    const bodyguard = createMockPlayer({ id: 'bg-1', username: 'Bodyguard Bob', roleName: 'Bodyguard', faction: 'TOWN' });
    const blocker = createMockPlayer({ id: 'blocker-1', username: 'Disrupter Dan', roleName: 'Roleblocker', faction: 'MAFIA' });
    const killer = createMockPlayer({ id: 'killer-1', username: 'Killer Charlie', roleName: 'Serial Killer', faction: 'NEUTRAL_KILLER' });

    const players = { 'target-1': target, 'bg-1': bodyguard, 'blocker-1': blocker, 'killer-1': killer };
    const actions: NightActionBufferItem[] = [
      createAction('blocker-1', 'bg-1', 'BLOCK', 1),
      createAction('bg-1', 'target-1', 'PROTECT', 3),
      createAction('killer-1', 'target-1', 'KILL', 4),
    ];

    const lobby = createMockLobby(players, actions);
    const output = resolveNightActions({ lobby });

    // Assertions
    assert.strictEqual(output.updatedPlayers['bg-1'].isAlive, true, 'Blocked Bodyguard MUST NOT die');
    assert.strictEqual(output.updatedPlayers['killer-1'].isAlive, true, 'Killer MUST NOT be counter-killed');
    assert.strictEqual(output.updatedPlayers['target-1'].isAlive, false, 'Unprotected Target MUST be eliminated');

    assert.strictEqual(output.newspaper.publicDeaths.length, 1, 'Only target dies');
    assert.strictEqual(output.newspaper.publicDeaths[0].victimPlayerId, 'target-1');
    console.log('  ✔ Test 1.3 Passed');
  }

  // TEST 1.4: Bodyguard vs Iron-Will Attacker — Counter-kill absorbed, bodyguard still sacrifices
  {
    console.log('▶ Test 1.4: Bodyguard vs Iron-Will Attacker (attacker absorbs counter-strike)');
    const target = createMockPlayer({ id: 'target-1', username: 'Citizen Alice', roleName: 'Vanilla Town', faction: 'TOWN' });
    const bodyguard = createMockPlayer({ id: 'bg-1', username: 'Bodyguard Bob', roleName: 'Bodyguard', faction: 'TOWN' });
    const killer = createMockPlayer({
      id: 'killer-iron',
      username: 'Iron Killer',
      roleName: 'Serial Killer',
      faction: 'NEUTRAL_KILLER',
      trait: 'IRON_WILL' as InnateTraitType,
    });

    const players = { 'target-1': target, 'bg-1': bodyguard, 'killer-iron': killer };
    const actions: NightActionBufferItem[] = [
      createAction('bg-1', 'target-1', 'PROTECT', 3),
      createAction('killer-iron', 'target-1', 'KILL', 4),
    ];

    const lobby = createMockLobby(players, actions);
    const output = resolveNightActions({ lobby });

    // Assertions
    assert.strictEqual(output.updatedPlayers['target-1'].isAlive, true, 'Target survives');
    assert.strictEqual(output.updatedPlayers['bg-1'].isAlive, false, 'Bodyguard sacrifices self');
    assert.strictEqual(output.updatedPlayers['killer-iron'].isAlive, true, 'Iron-Will killer survives counter-strike');

    // Killer's trait depleted and armor-broken recorded
    assert.strictEqual(
      output.updatedPlayers['killer-iron'].allInIdentity?.layer3Trait,
      'CONTRABAND_POCKET',
      'Killer trait MUST be swapped to CONTRABAND_POCKET upon depletion'
    );
    assert.ok(
      output.newspaper.armorBrokenPlayerIds?.includes('killer-iron'),
      'Killer MUST be logged in armorBrokenPlayerIds'
    );
    assert.ok(
      output.vestSpentPlayerIds.includes('killer-iron'),
      'Killer MUST be logged in vestSpentPlayerIds'
    );
    console.log('  ✔ Test 1.4 Passed');
  }
}

// ============================================================================
// GROUP 2: IRON_WILL TRAIT DYNAMICS
// ============================================================================

export function runIronWillTests(): void {
  console.log('--- [Suite 2] IRON_WILL Trait Dynamics ---');

  // TEST 2.1: Absorbs Single Lethal Strike
  {
    console.log('▶ Test 2.1: IRON_WILL absorbs single lethal attack with armor broken alert');
    const victim = createMockPlayer({
      id: 'victim-iw',
      username: 'Resilient Rex',
      roleName: 'Vanilla Town',
      faction: 'TOWN',
      trait: 'IRON_WILL' as InnateTraitType,
    });
    const killer = createMockPlayer({ id: 'killer-1', username: 'Killer Charlie', roleName: 'Serial Killer', faction: 'NEUTRAL_KILLER' });

    const players = { 'victim-iw': victim, 'killer-1': killer };
    const actions: NightActionBufferItem[] = [
      createAction('killer-1', 'victim-iw', 'KILL', 4),
    ];

    const lobby = createMockLobby(players, actions);
    const output = resolveNightActions({ lobby });

    // Assertions
    assert.strictEqual(output.updatedPlayers['victim-iw'].isAlive, true, 'Player with IRON_WILL survives first attack');
    assert.strictEqual(output.newspaper.publicDeaths.length, 0, 'No deaths should occur');
    assert.ok(output.newspaper.protectedIds?.includes('victim-iw'), 'Victim MUST be in protectedIds');
    assert.ok(output.newspaper.armorBrokenPlayerIds?.includes('victim-iw'), 'Victim MUST be in armorBrokenPlayerIds');

    // Trait persistence
    assert.strictEqual(
      output.updatedPlayers['victim-iw'].allInIdentity?.layer3Trait,
      'CONTRABAND_POCKET',
      'IRON_WILL must be depleted to CONTRABAND_POCKET'
    );
    assert.ok(output.vestSpentPlayerIds.includes('victim-iw'), 'Victim must be in vestSpentPlayerIds');
    console.log('  ✔ Test 2.1 Passed');
  }

  // TEST 2.2: Second Hit in Same Night Kills
  {
    console.log('▶ Test 2.2: Second hit in same night penetrates broken armor and eliminates player');
    const victim = createMockPlayer({
      id: 'victim-iw',
      username: 'Resilient Rex',
      roleName: 'Vanilla Town',
      faction: 'TOWN',
      trait: 'IRON_WILL' as InnateTraitType,
    });
    const killer1 = createMockPlayer({ id: 'killer-1', username: 'Killer 1', roleName: 'Serial Killer', faction: 'NEUTRAL_KILLER' });
    const killer2 = createMockPlayer({ id: 'killer-2', username: 'Killer 2', roleName: 'Void Cultist', faction: 'VOID_CULT' });

    const players = { 'victim-iw': victim, 'killer-1': killer1, 'killer-2': killer2 };
    const actions: NightActionBufferItem[] = [
      createAction('killer-1', 'victim-iw', 'KILL', 4),
      createAction('killer-2', 'victim-iw', 'KILL', 4),
    ];

    const lobby = createMockLobby(players, actions);
    const output = resolveNightActions({ lobby });

    // Assertions
    assert.strictEqual(output.updatedPlayers['victim-iw'].isAlive, false, 'Player dies from 2nd lethal attack');
    assert.strictEqual(output.newspaper.publicDeaths.length, 1, 'Victim recorded in deaths');
    assert.strictEqual(output.newspaper.publicDeaths[0].victimPlayerId, 'victim-iw');
    console.log('  ✔ Test 2.2 Passed');
  }

  // TEST 2.3: Multi-Night Persistence — Depleted Trait Does Not Protect Night 2
  {
    console.log('▶ Test 2.3: Trait remains depleted across consecutive nights');
    const victim = createMockPlayer({
      id: 'victim-iw',
      username: 'Resilient Rex',
      roleName: 'Vanilla Town',
      faction: 'TOWN',
      trait: 'IRON_WILL' as InnateTraitType,
    });
    const killer = createMockPlayer({ id: 'killer-1', username: 'Killer Charlie', roleName: 'Serial Killer', faction: 'NEUTRAL_KILLER' });

    // Night 1: Attack absorbed
    let players = { 'victim-iw': victim, 'killer-1': killer };
    let lobby = createMockLobby(players, [createAction('killer-1', 'victim-iw', 'KILL', 4)], 5, 1);
    let output = resolveNightActions({ lobby });
    assert.strictEqual(output.updatedPlayers['victim-iw'].isAlive, true);
    assert.strictEqual(output.updatedPlayers['victim-iw'].allInIdentity?.layer3Trait, 'CONTRABAND_POCKET');

    // Night 2: Attack again with updated players
    players = { ...output.updatedPlayers };
    lobby = createMockLobby(players, [createAction('killer-1', 'victim-iw', 'KILL', 4)], 5, 2);
    output = resolveNightActions({ lobby });

    assert.strictEqual(output.updatedPlayers['victim-iw'].isAlive, false, 'Player MUST die on Night 2 attack');
    console.log('  ✔ Test 2.3 Passed');
  }

  // TEST 2.4: Silencer Attachment (Piercing) Pierces IRON_WILL
  {
    console.log('▶ Test 2.4: Piercing attack (SILENCER_ATTACHMENT) bypasses IRON_WILL armor');
    const victim = createMockPlayer({
      id: 'victim-iw',
      username: 'Resilient Rex',
      roleName: 'Vanilla Town',
      faction: 'TOWN',
      trait: 'IRON_WILL' as InnateTraitType,
    });
    const killer = createMockPlayer({
      id: 'killer-pierce',
      username: 'Silent Assassin',
      roleName: 'Serial Killer',
      faction: 'NEUTRAL_KILLER',
      trait: 'SILENCER_ATTACHMENT',
    });

    const players = { 'victim-iw': victim, 'killer-pierce': killer };
    const lobby = createMockLobby(players, [createAction('killer-pierce', 'victim-iw', 'KILL', 4)]);
    const output = resolveNightActions({ lobby });

    assert.strictEqual(output.updatedPlayers['victim-iw'].isAlive, false, 'Piercing strike eliminates IRON_WILL holder immediately');
    console.log('  ✔ Test 2.4 Passed');
  }
}

// ============================================================================
// GROUP 3: PHANTOM_STEP TRAIT DYNAMICS
// ============================================================================

export function runPhantomStepTests(): void {
  console.log('--- [Suite 3] PHANTOM_STEP Trait Dynamics ---');

  // TEST 3.1: Phantom Step Actor Executes Kill Despite Being Roleblocked
  {
    console.log('▶ Test 3.1: Killer with PHANTOM_STEP ignores BLOCK and executes kill');
    const blocker = createMockPlayer({ id: 'blocker-1', username: 'Disrupter Dan', roleName: 'Roleblocker', faction: 'TOWN' });
    const killer = createMockPlayer({
      id: 'killer-ps',
      username: 'Ghost Killer',
      roleName: 'Serial Killer',
      faction: 'NEUTRAL_KILLER',
      trait: 'PHANTOM_STEP',
    });
    const victim = createMockPlayer({ id: 'victim-1', username: 'Target Tom', roleName: 'Vanilla Town', faction: 'TOWN' });

    const players = { 'blocker-1': blocker, 'killer-ps': killer, 'victim-1': victim };
    const actions: NightActionBufferItem[] = [
      createAction('blocker-1', 'killer-ps', 'BLOCK', 1),
      createAction('killer-ps', 'victim-1', 'KILL', 4),
    ];

    const lobby = createMockLobby(players, actions);
    const output = resolveNightActions({ lobby });

    // Assertions
    assert.strictEqual(output.updatedPlayers['victim-1'].isAlive, false, 'Victim MUST be killed despite killer being blocked');
    assert.strictEqual(output.newspaper.publicDeaths.length, 1);
    assert.strictEqual(output.newspaper.publicDeaths[0].victimPlayerId, 'victim-1');
    console.log('  ✔ Test 3.1 Passed');
  }

  // TEST 3.2: Control Test — Non-Phantom Step Actor IS Blocked
  {
    console.log('▶ Test 3.2: Killer without PHANTOM_STEP is blocked and action is cancelled');
    const blocker = createMockPlayer({ id: 'blocker-1', username: 'Disrupter Dan', roleName: 'Roleblocker', faction: 'TOWN' });
    const killer = createMockPlayer({
      id: 'killer-normal',
      username: 'Regular Killer',
      roleName: 'Serial Killer',
      faction: 'NEUTRAL_KILLER',
      trait: 'CONTRABAND_POCKET',
    });
    const victim = createMockPlayer({ id: 'victim-1', username: 'Target Tom', roleName: 'Vanilla Town', faction: 'TOWN' });

    const players = { 'blocker-1': blocker, 'killer-normal': killer, 'victim-1': victim };
    const actions: NightActionBufferItem[] = [
      createAction('blocker-1', 'killer-normal', 'BLOCK', 1),
      createAction('killer-normal', 'victim-1', 'KILL', 4),
    ];

    const lobby = createMockLobby(players, actions);
    const output = resolveNightActions({ lobby });

    // Assertions
    assert.strictEqual(output.updatedPlayers['victim-1'].isAlive, true, 'Victim MUST survive because killer was blocked');
    assert.strictEqual(output.newspaper.publicDeaths.length, 0, 'No deaths occur');
    console.log('  ✔ Test 3.2 Passed');
  }

  // TEST 3.3: Phantom Step on Protective Action (Doctor Protects Through Block)
  {
    console.log('▶ Test 3.3: Doctor with PHANTOM_STEP heals target through BLOCK');
    const blocker = createMockPlayer({ id: 'blocker-1', username: 'Disrupter Dan', roleName: 'Roleblocker', faction: 'MAFIA' });
    const doctor = createMockPlayer({
      id: 'doc-ps',
      username: 'Ghost Doctor',
      roleName: 'Doctor',
      faction: 'TOWN',
      trait: 'PHANTOM_STEP',
    });
    const victim = createMockPlayer({ id: 'victim-1', username: 'Target Tom', roleName: 'Vanilla Town', faction: 'TOWN' });
    const killer = createMockPlayer({ id: 'killer-1', username: 'Killer Charlie', roleName: 'Serial Killer', faction: 'NEUTRAL_KILLER' });

    const players = { 'blocker-1': blocker, 'doc-ps': doctor, 'victim-1': victim, 'killer-1': killer };
    const actions: NightActionBufferItem[] = [
      createAction('blocker-1', 'doc-ps', 'BLOCK', 1),
      createAction('doc-ps', 'victim-1', 'PROTECT', 3),
      createAction('killer-1', 'victim-1', 'KILL', 4),
    ];

    const lobby = createMockLobby(players, actions);
    const output = resolveNightActions({ lobby });

    // Assertions
    assert.strictEqual(output.updatedPlayers['victim-1'].isAlive, true, 'Victim survived because Doctor bypassed block');
    assert.ok(output.newspaper.protectedIds?.includes('victim-1'));
    console.log('  ✔ Test 3.3 Passed');
  }
}

// ============================================================================
// GROUP 4: NIGHT_VISION OBSERVER INTEL
// ============================================================================

export function runNightVisionTests(): void {
  console.log('--- [Suite 4] NIGHT_VISION Observer Intel ---');

  // TEST 4.1: Reveals All Visitors Across Priorities
  {
    console.log('▶ Test 4.1: NIGHT_VISION reveals all visitors to the destination');
    const destination = createMockPlayer({ id: 'dest-1', username: 'Target Dave', roleName: 'Vanilla Town', faction: 'TOWN' });
    const observer = createMockPlayer({
      id: 'obs-nv',
      username: 'Watcher Wendy',
      roleName: 'Investigator',
      faction: 'TOWN',
      trait: 'NIGHT_VISION' as InnateTraitType,
    });
    const visitorBlock = createMockPlayer({ id: 'vis-block', username: 'Blocker Ben', roleName: 'Roleblocker', faction: 'MAFIA' });
    const visitorHeal = createMockPlayer({ id: 'vis-heal', username: 'Doctor Doc', roleName: 'Doctor', faction: 'TOWN' });
    const visitorKill = createMockPlayer({ id: 'vis-kill', username: 'Killer Karl', roleName: 'Serial Killer', faction: 'NEUTRAL_KILLER' });

    const players = {
      'dest-1': destination,
      'obs-nv': observer,
      'vis-block': visitorBlock,
      'vis-heal': visitorHeal,
      'vis-kill': visitorKill,
    };

    const actions: NightActionBufferItem[] = [
      createAction('vis-block', 'dest-1', 'BLOCK', 1),
      createAction('vis-heal', 'dest-1', 'PROTECT', 3),
      createAction('vis-kill', 'dest-1', 'KILL', 4),
      createAction('obs-nv', 'dest-1', 'INVESTIGATE', 6),
    ];

    const lobby = createMockLobby(players, actions);
    const output = resolveNightActions({ lobby });

    // Find observer's report
    const observerIntel = output.newspaper.privateInvestigationResults.find(
      r => r.investigatorPlayerId === 'obs-nv'
    );
    assert.ok(observerIntel, 'Investigation result for observer MUST exist');

    const visitors = observerIntel.visitors ?? (observerIntel as Record<string, unknown>).observedVisitors as string[] | undefined;
    assert.ok(Array.isArray(visitors), 'visitors MUST be an array');
    assert.strictEqual(visitors.length, 3, 'Must detect exactly 3 visitors');
    assert.ok(visitors.includes('vis-block'), 'Must include P1 blocker');
    assert.ok(visitors.includes('vis-heal'), 'Must include P3 protector');
    assert.ok(visitors.includes('vis-kill'), 'Must include P4 killer');
    assert.ok(!visitors.includes('obs-nv'), 'Observer must not list self as visitor');
    console.log('  ✔ Test 4.1 Passed');
  }

  // TEST 4.2: Target with Zero Visitors
  {
    console.log('▶ Test 4.2: NIGHT_VISION on quiet target returns empty visitor array');
    const destination = createMockPlayer({ id: 'dest-quiet', username: 'Quiet Quinn', roleName: 'Vanilla Town', faction: 'TOWN' });
    const observer = createMockPlayer({
      id: 'obs-nv',
      username: 'Watcher Wendy',
      roleName: 'Investigator',
      faction: 'TOWN',
      trait: 'NIGHT_VISION' as InnateTraitType,
    });
    const otherTarget = createMockPlayer({ id: 'dest-other', username: 'Other Oliver', roleName: 'Vanilla Town', faction: 'TOWN' });
    const otherActor = createMockPlayer({ id: 'actor-other', username: 'Actor Andy', roleName: 'Doctor', faction: 'TOWN' });

    const players = {
      'dest-quiet': destination,
      'obs-nv': observer,
      'dest-other': otherTarget,
      'actor-other': otherActor,
    };

    const actions: NightActionBufferItem[] = [
      createAction('actor-other', 'dest-other', 'PROTECT', 3),
      createAction('obs-nv', 'dest-quiet', 'INVESTIGATE', 6),
    ];

    const lobby = createMockLobby(players, actions);
    const output = resolveNightActions({ lobby });

    const observerIntel = output.newspaper.privateInvestigationResults.find(
      r => r.investigatorPlayerId === 'obs-nv'
    );
    assert.ok(observerIntel);
    const visitors = observerIntel.visitors ?? (observerIntel as Record<string, unknown>).observedVisitors as string[];
    assert.ok(Array.isArray(visitors), 'Must return an array');
    assert.strictEqual(visitors.length, 0, 'Must have zero visitors');
    console.log('  ✔ Test 4.2 Passed');
  }

  // TEST 4.3: NIGHT_VISION Observer Roleblocked (Without Phantom Step)
  {
    console.log('▶ Test 4.3: NIGHT_VISION observer is roleblocked (observation nullified)');
    const destination = createMockPlayer({ id: 'dest-1', username: 'Target Dave', roleName: 'Vanilla Town', faction: 'TOWN' });
    const observer = createMockPlayer({
      id: 'obs-nv',
      username: 'Watcher Wendy',
      roleName: 'Investigator',
      faction: 'TOWN',
      trait: 'NIGHT_VISION' as InnateTraitType,
    });
    const blocker = createMockPlayer({ id: 'blocker-1', username: 'Disrupter Dan', roleName: 'Roleblocker', faction: 'MAFIA' });
    const visitor = createMockPlayer({ id: 'vis-1', username: 'Visitor Victor', roleName: 'Doctor', faction: 'TOWN' });

    const players = {
      'dest-1': destination,
      'obs-nv': observer,
      'blocker-1': blocker,
      'vis-1': visitor,
    };

    const actions: NightActionBufferItem[] = [
      createAction('blocker-1', 'obs-nv', 'BLOCK', 1),
      createAction('vis-1', 'dest-1', 'PROTECT', 3),
      createAction('obs-nv', 'dest-1', 'INVESTIGATE', 6),
    ];

    const lobby = createMockLobby(players, actions);
    const output = resolveNightActions({ lobby });

    // Blocked observer should yield no investigation record
    const observerIntel = output.newspaper.privateInvestigationResults.find(
      r => r.investigatorPlayerId === 'obs-nv'
    );
    assert.strictEqual(observerIntel, undefined, 'Blocked investigator produces no intelligence record');
    console.log('  ✔ Test 4.3 Passed');
  }
}

// ============================================================================
// GROUP 5: COMPOUND MATRIX COLLISIONS
// ============================================================================

export function runCompoundMatrixTests(): void {
  console.log('--- [Suite 5] Compound Matrix Collisions ---');

  // TEST 5.1: Bodyguard Protects Target with IRON_WILL
  {
    console.log('▶ Test 5.1: Bodyguard protects IRON_WILL target (Bodyguard intercepts, target IRON_WILL unspent)');
    const target = createMockPlayer({
      id: 'target-iw',
      username: 'Armored Alice',
      roleName: 'Vanilla Town',
      faction: 'TOWN',
      trait: 'IRON_WILL' as InnateTraitType,
    });
    const bodyguard = createMockPlayer({ id: 'bg-1', username: 'Bodyguard Bob', roleName: 'Bodyguard', faction: 'TOWN' });
    const killer = createMockPlayer({ id: 'killer-1', username: 'Killer Charlie', roleName: 'Serial Killer', faction: 'NEUTRAL_KILLER' });

    const players = { 'target-iw': target, 'bg-1': bodyguard, 'killer-1': killer };
    const actions: NightActionBufferItem[] = [
      createAction('bg-1', 'target-iw', 'PROTECT', 3),
      createAction('killer-1', 'target-iw', 'KILL', 4),
    ];

    const lobby = createMockLobby(players, actions);
    const output = resolveNightActions({ lobby });

    // Target survives via bodyguard intercept; target's IRON_WILL remains untouched
    assert.strictEqual(output.updatedPlayers['target-iw'].isAlive, true);
    assert.strictEqual(output.updatedPlayers['target-iw'].allInIdentity?.layer3Trait, 'IRON_WILL', 'IRON_WILL must remain unspent');
    assert.ok(!output.newspaper.armorBrokenPlayerIds?.includes('target-iw'), 'Target armor should NOT be broken');
    assert.strictEqual(output.updatedPlayers['bg-1'].isAlive, false, 'Bodyguard sacrificed');
    assert.strictEqual(output.updatedPlayers['killer-1'].isAlive, false, 'Killer counter-killed');
    console.log('  ✔ Test 5.1 Passed');
  }

  // TEST 5.2: Two Bodyguards Protecting Same Target Against Two Killers
  {
    console.log('▶ Test 5.2: Two Bodyguards protect target against two killers (both killers and bodyguards die, target safe)');
    const target = createMockPlayer({ id: 'target-safe', username: 'Target Tom', roleName: 'Vanilla Town', faction: 'TOWN' });
    const bg1 = createMockPlayer({ id: 'bg-1', username: 'Bodyguard 1', roleName: 'Bodyguard', faction: 'TOWN' });
    const bg2 = createMockPlayer({ id: 'bg-2', username: 'Bodyguard 2', roleName: 'Bodyguard', faction: 'TOWN' });
    const killer1 = createMockPlayer({ id: 'killer-1', username: 'Killer 1', roleName: 'Serial Killer', faction: 'NEUTRAL_KILLER' });
    const killer2 = createMockPlayer({ id: 'killer-2', username: 'Killer 2', roleName: 'Void Cultist', faction: 'VOID_CULT' });

    const players = {
      'target-safe': target,
      'bg-1': bg1,
      'bg-2': bg2,
      'killer-1': killer1,
      'killer-2': killer2,
    };
    const actions: NightActionBufferItem[] = [
      createAction('bg-1', 'target-safe', 'PROTECT', 3),
      createAction('bg-2', 'target-safe', 'PROTECT', 3),
      createAction('killer-1', 'target-safe', 'KILL', 4),
      createAction('killer-2', 'target-safe', 'KILL', 4),
    ];

    const lobby = createMockLobby(players, actions);
    const output = resolveNightActions({ lobby });

    assert.strictEqual(output.updatedPlayers['target-safe'].isAlive, true, 'Target MUST survive');
    assert.strictEqual(output.updatedPlayers['bg-1'].isAlive, false, 'BG 1 dies of sacrifice');
    assert.strictEqual(output.updatedPlayers['bg-2'].isAlive, false, 'BG 2 dies of sacrifice');
    assert.strictEqual(output.updatedPlayers['killer-1'].isAlive, false, 'Killer 1 counter-killed');
    assert.strictEqual(output.updatedPlayers['killer-2'].isAlive, false, 'Killer 2 counter-killed');
    console.log('  ✔ Test 5.2 Passed');
  }
}

// ============================================================================
// MAIN RUNNER
// ============================================================================

export function runAllNightMatrixTests(): void {
  console.log('================================================================');
  console.log('STARTING NIGHT ACTION MATRIX & INNATE TRAIT DYNAMICS TEST SUITE');
  console.log('================================================================');

  runBodyguardTests();
  runIronWillTests();
  runPhantomStepTests();
  runNightVisionTests();
  runCompoundMatrixTests();

  console.log('================================================================');
  console.log('✅ ALL NIGHT ACTION MATRIX TESTS PASSED WITH 100% SUCCESS');
  console.log('================================================================');
}

// Execute directly if run as main script
runAllNightMatrixTests();
