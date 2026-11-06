/**
 * Automated Unit & Integration Test Suite: Spectator Mode & Dead Chat (Milestone 7)
 *
 * Verifies:
 * - Suite 1: Spectator Session Management (joinSpectator, removeSpectator, state tracking)
 * - Suite 2: Zero-Knowledge Dead Chat Isolation (filtering DEAD chat from living players, allowing dead/spectators)
 * - Suite 3: API Route / Message Dispatch Restrictions (dead/spectators routed to DEAD, living blocked from DEAD, mid-game auto-join)
 * - Suite 4: Death Cause & Death Round Attribution across Night Actions and Courtroom Lynches
 * - Suite 5: Resurrect resets death metadata and restores alive status
 */

import assert from 'node:assert';
import { inMemoryLobbyStore } from '../src/server/state/memory';
import { resolveNightActions } from '../src/server/engine/night-action-resolver';
import { executePhaseTransition, nextPhaseAfter } from '../src/server/engine/phase-manager';
import {
  LobbyState,
  PlayerSession,
  SpectatorSession,
  ChatMessage,
  NightActionBufferItem,
} from '../src/types/game';
import { formatRoleDisplay } from '../src/types/roles';
import { POST, GET } from '../src/app/api/lobby/[lobbyId]/route';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function createTestPlayer(id: string, name: string, isAlive: boolean, faction: 'TOWN' | 'MAFIA' = 'TOWN'): PlayerSession {
  return {
    socketId: `sock-${id}`,
    userId: id,
    username: name,
    tier: 'TIER_1',
    adminRole: 'NONE',
    isHost: id === 'usr-host',
    isAlive,
    hasHostWaiver: true,
    hasAdminWaiver: false,
    displayRole: formatRoleDisplay(name, faction === 'MAFIA' ? 'Mafia' : 'Citizen', faction === 'MAFIA' ? 'Mafiya' : 'Vətəndaş'),
    allInIdentity: {
      layer1Faction: faction,
      layer2Office: 'MAYOR',
      layer3Trait: 'PHANTOM_STEP',
      district: 'COMMERCIAL',
    },
    disconnectedAt: null,
    isAiBotControlled: false,
  };
}

function createTestLobby(lobbyId: string): { store: typeof inMemoryLobbyStore; lobby: LobbyState } {
  const host = createTestPlayer('usr-host', 'HostUser', true, 'TOWN');
  const lobby = inMemoryLobbyStore.createLobby(lobbyId, host.userId, host, 'BLITZ');
  return { store: inMemoryLobbyStore, lobby };
}

// ─── SUITE RUNNER ─────────────────────────────────────────────────────────────

async function runSpectatorDeadChatTests() {
  console.log('================================================================');
  console.log('STARTING SPECTATOR MODE & DEAD CHAT TEST SUITE (MILESTONE M7)');
  console.log('================================================================\n');

  // ────────────────────────────────────────────────────────────────────────────
  // SUITE 1: Spectator Session Management
  // ────────────────────────────────────────────────────────────────────────────
  console.log('--- [Suite 1] Spectator Session Management (InMemoryLobbyStore) ---');

  const { store, lobby } = createTestLobby('test-spec-lobby-1');
  assert.ok(lobby.spectators, 'Lobby should have spectators dictionary initialized');
  assert.strictEqual(Object.keys(lobby.spectators).length, 0, 'Spectators should start empty');
  console.log('  ✔ Test 1.1: Lobby initialized with empty spectators record');

  // Join Spectator 1
  const spec1: SpectatorSession = {
    userId: 'spec-usr-1',
    username: 'Observer_1',
    joinedAt: Date.now(),
    lastSeenAt: Date.now(),
  };
  const lobbyAfterJoin1 = store.joinSpectator(lobby.lobbyId, spec1);
  assert.ok(lobbyAfterJoin1, 'Lobby should be returned after joinSpectator');
  assert.ok(lobbyAfterJoin1.spectators?.['spec-usr-1'], 'Spectator 1 should be stored');
  assert.strictEqual(lobbyAfterJoin1.spectators?.['spec-usr-1']?.username, 'Observer_1');
  console.log('  ✔ Test 1.2: Spectator 1 successfully joined and tracked');

  // Join Spectator 2
  const spec2: SpectatorSession = {
    userId: 'spec-usr-2',
    username: 'Observer_2',
    joinedAt: Date.now(),
    lastSeenAt: Date.now(),
  };
  const lobbyAfterJoin2 = store.joinSpectator(lobby.lobbyId, spec2);
  assert.strictEqual(Object.keys(lobbyAfterJoin2?.spectators || {}).length, 2, 'Should have 2 spectators');
  console.log('  ✔ Test 1.3: Multiple spectators concurrently stored');

  // Remove Spectator 1
  const lobbyAfterRemove = store.removeSpectator(lobby.lobbyId, 'spec-usr-1');
  assert.ok(lobbyAfterRemove, 'Lobby returned after removeSpectator');
  assert.strictEqual(lobbyAfterRemove.spectators?.['spec-usr-1'], undefined, 'Spectator 1 should be removed');
  assert.ok(lobbyAfterRemove.spectators?.['spec-usr-2'], 'Spectator 2 should still be present');
  console.log('  ✔ Test 1.4: Spectator removed cleanly without corrupting other spectators');

  // ────────────────────────────────────────────────────────────────────────────
  // SUITE 2: Zero-Knowledge Dead Chat Isolation
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- [Suite 2] Zero-Knowledge Dead Chat Isolation (route GET / sanitize) ---');

  const isoLobbyId = 'test-iso-lobby-2';
  const { store: isoStore } = createTestLobby(isoLobbyId);

  // Setup players: 1 alive Town, 1 dead Town, 1 alive Mafia
  const pAliveTown = createTestPlayer('usr-alive-town', 'Ali (Alive Town)', true, 'TOWN');
  const pDeadTown = createTestPlayer('usr-dead-town', 'Veli (Dead Town)', false, 'TOWN');
  const pAliveMafia = createTestPlayer('usr-alive-mafia', 'Samir (Alive Mafia)', true, 'MAFIA');

  isoStore.joinPlayer(isoLobbyId, pAliveTown);
  isoStore.joinPlayer(isoLobbyId, pDeadTown);
  isoStore.joinPlayer(isoLobbyId, pAliveMafia);

  // Transition to DAY_VOTING so phase is not LOBBY
  isoStore.transitionPhase(isoLobbyId, 'DAY_VOTING', 60);

  // Add a spectator
  isoStore.joinSpectator(isoLobbyId, {
    userId: 'spec-isolated',
    username: 'Müşahidəçi_X',
    joinedAt: Date.now(),
  });

  // Populate messages across channels
  isoStore.addChatMessage(isoLobbyId, {
    id: 'msg-1',
    senderId: 'usr-alive-town',
    senderName: 'Ali',
    content: 'Salam şəhər əhli!',
    channel: 'LOBBY',
    timestamp: Date.now(),
  });

  isoStore.addChatMessage(isoLobbyId, {
    id: 'msg-2',
    senderId: 'usr-alive-mafia',
    senderName: 'Samir',
    content: 'Gecə kimi vuraq?',
    channel: 'MAFIA',
    timestamp: Date.now(),
  });

  isoStore.addChatMessage(isoLobbyId, {
    id: 'msg-3',
    senderId: 'usr-dead-town',
    senderName: 'Veli',
    content: 'Ruhlar aləmindən salam, Samir mafiyadır!',
    channel: 'DEAD',
    timestamp: Date.now(),
  });

  isoStore.addChatMessage(isoLobbyId, {
    id: 'msg-4',
    senderId: 'spec-isolated',
    senderName: 'Müşahidəçi_X',
    content: 'Oyunu kənardan izləyirəm.',
    channel: 'DEAD',
    timestamp: Date.now(),
    isSpectator: true,
  });

  // 1. Alive Town Player requesting:
  const reqAliveTown = new Request(`http://localhost:3000/api/lobby/${isoLobbyId}?userId=usr-alive-town`);
  const resAliveTown = await GET(reqAliveTown, { params: { lobbyId: isoLobbyId } });
  const dataAliveTown = await resAliveTown.json();
  const messagesForAliveTown: ChatMessage[] = dataAliveTown.rawLobby.chatMessages;

  assert.strictEqual(
    messagesForAliveTown.some(m => m.channel === 'DEAD'),
    false,
    'SECURITY BREACH: Living Town player received DEAD chat messages!'
  );
  assert.strictEqual(
    messagesForAliveTown.some(m => m.channel === 'MAFIA'),
    false,
    'SECURITY BREACH: Living Town player received MAFIA chat messages!'
  );
  assert.strictEqual(
    messagesForAliveTown.some(m => m.channel === 'LOBBY'),
    true,
    'Living Town player should receive LOBBY chat messages'
  );
  console.log('  ✔ Test 2.1: Living Town player receives only LOBBY chat (DEAD and MAFIA strictly scrubbed)');

  // 2. Dead Town Player requesting:
  const reqDeadTown = new Request(`http://localhost:3000/api/lobby/${isoLobbyId}?userId=usr-dead-town`);
  const resDeadTown = await GET(reqDeadTown, { params: { lobbyId: isoLobbyId } });
  const dataDeadTown = await resDeadTown.json();
  const messagesForDeadTown: ChatMessage[] = dataDeadTown.rawLobby.chatMessages;

  assert.strictEqual(
    messagesForDeadTown.some(m => m.channel === 'DEAD'),
    true,
    'Dead player must be able to view DEAD chat channel'
  );
  assert.strictEqual(
    messagesForDeadTown.some(m => m.channel === 'LOBBY'),
    true,
    'Dead player must be able to view LOBBY chat channel'
  );
  assert.strictEqual(
    messagesForDeadTown.some(m => m.channel === 'MAFIA'),
    false,
    'SECURITY BREACH: Dead Town player received secret MAFIA channel!'
  );
  console.log('  ✔ Test 2.2: Dead player receives DEAD and LOBBY chat, but not secret MAFIA channel');

  // 3. Spectator requesting:
  const reqSpectator = new Request(`http://localhost:3000/api/lobby/${isoLobbyId}?userId=spec-isolated`);
  const resSpectator = await GET(reqSpectator, { params: { lobbyId: isoLobbyId } });
  const dataSpectator = await resSpectator.json();
  const messagesForSpectator: ChatMessage[] = dataSpectator.rawLobby.chatMessages;

  assert.strictEqual(
    messagesForSpectator.some(m => m.channel === 'DEAD'),
    true,
    'Spectator must be able to view DEAD chat channel'
  );
  assert.strictEqual(
    messagesForSpectator.some(m => m.channel === 'LOBBY'),
    true,
    'Spectator must be able to view LOBBY chat channel'
  );
  assert.strictEqual(
    messagesForSpectator.some(m => m.channel === 'MAFIA'),
    false,
    'SECURITY BREACH: Spectator received secret MAFIA channel mid-game!'
  );
  console.log('  ✔ Test 2.3: Spectator receives DEAD and LOBBY chat without leaking secret MAFIA channel');

  // 4. Alive Mafia requesting:
  const reqAliveMafia = new Request(`http://localhost:3000/api/lobby/${isoLobbyId}?userId=usr-alive-mafia`);
  const resAliveMafia = await GET(reqAliveMafia, { params: { lobbyId: isoLobbyId } });
  const dataAliveMafia = await resAliveMafia.json();
  const messagesForAliveMafia: ChatMessage[] = dataAliveMafia.rawLobby.chatMessages;

  assert.strictEqual(
    messagesForAliveMafia.some(m => m.channel === 'DEAD'),
    false,
    'SECURITY BREACH: Living Mafia received DEAD chat channel!'
  );
  assert.strictEqual(
    messagesForAliveMafia.some(m => m.channel === 'MAFIA'),
    true,
    'Living Mafia must receive MAFIA chat channel'
  );
  console.log('  ✔ Test 2.4: Living Mafia receives MAFIA and LOBBY, but not DEAD chat channel');

  // 5. Game ENDED:
  isoStore.transitionPhase(isoLobbyId, 'ENDED', 0);
  const reqEnded = new Request(`http://localhost:3000/api/lobby/${isoLobbyId}?userId=usr-alive-town`);
  const resEnded = await GET(reqEnded, { params: { lobbyId: isoLobbyId } });
  const dataEnded = await resEnded.json();
  const messagesEnded: ChatMessage[] = dataEnded.rawLobby.chatMessages;

  assert.strictEqual(messagesEnded.length, 4, 'When game has ENDED, all 4 messages across all channels are unmasked');
  console.log('  ✔ Test 2.5: Game ENDED reveals all archived channels post-match');

  // ────────────────────────────────────────────────────────────────────────────
  // SUITE 3: API Route / Message Dispatch Restrictions
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- [Suite 3] API Route POST Actions & Restrictions ---');

  const postLobbyId = 'test-post-lobby-3';
  const { store: postStore } = createTestLobby(postLobbyId);

  // Setup players
  const pAlive = createTestPlayer('p-alive', 'AlivePlayer', true, 'TOWN');
  const pDead = createTestPlayer('p-dead', 'DeadPlayer', false, 'TOWN');
  postStore.joinPlayer(postLobbyId, pAlive);
  postStore.joinPlayer(postLobbyId, pDead);
  postStore.transitionPhase(postLobbyId, 'DAY_VOTING', 60);

  // 1. Living player attempts to send to DEAD channel -> 403 Forbidden
  const postReqLivingToDead = new Request(`http://localhost:3000/api/lobby/${postLobbyId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'SEND_MESSAGE',
      userId: 'p-alive',
      username: 'AlivePlayer',
      channel: 'DEAD',
      content: 'Canlıyam amma ruhlara yazıram!',
    }),
  });
  const resLivingToDead = await POST(postReqLivingToDead, { params: { lobbyId: postLobbyId } });
  assert.strictEqual(resLivingToDead.status, 403, 'Living player sending to DEAD must be rejected with 403');
  const errLivingToDead = await resLivingToDead.json();
  assert.strictEqual(errLivingToDead.error, 'LIVING_PLAYERS_CANNOT_TALK_IN_DEAD_CHAT');
  console.log('  ✔ Test 3.1: Living player rejected with 403 when trying to send to DEAD chat');

  // 2. Dead player sending to LOBBY -> automatically forced to DEAD channel
  const postReqDeadToLobby = new Request(`http://localhost:3000/api/lobby/${postLobbyId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'SEND_MESSAGE',
      userId: 'p-dead',
      username: 'DeadPlayer',
      channel: 'LOBBY',
      content: 'Ölüyəm, şəhərə yazmaq istəyirəm',
    }),
  });
  await POST(postReqDeadToLobby, { params: { lobbyId: postLobbyId } });
  const lobbyAfterDeadPost = postStore.getLobby(postLobbyId)!;
  const lastMsgDead = lobbyAfterDeadPost.chatMessages[lobbyAfterDeadPost.chatMessages.length - 1];
  assert.strictEqual(lastMsgDead.channel, 'DEAD', 'Dead player message must be forced to DEAD channel');
  console.log('  ✔ Test 3.2: Dead player sending to LOBBY channel is forced to DEAD channel');

  // 3. JOIN_SPECTATOR action
  const postReqJoinSpectator = new Request(`http://localhost:3000/api/lobby/${postLobbyId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'JOIN_SPECTATOR',
      userId: 'p-spec',
      username: 'LiveSpectator',
    }),
  });
  await POST(postReqJoinSpectator, { params: { lobbyId: postLobbyId } });
  const lobbyWithSpec = postStore.getLobby(postLobbyId)!;
  assert.ok(lobbyWithSpec.spectators?.['p-spec'], 'Spectator should be added via JOIN_SPECTATOR');
  console.log('  ✔ Test 3.3: JOIN_SPECTATOR registers spectator session in store');

  // 4. Spectator sending a message -> forced to DEAD channel with isSpectator = true
  const postReqSpecMsg = new Request(`http://localhost:3000/api/lobby/${postLobbyId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'SEND_MESSAGE',
      userId: 'p-spec',
      username: 'LiveSpectator',
      channel: 'LOBBY',
      content: 'Mən müşahidəçiyəm',
    }),
  });
  await POST(postReqSpecMsg, { params: { lobbyId: postLobbyId } });
  const lobbyAfterSpecMsg = postStore.getLobby(postLobbyId)!;
  const lastMsgSpec = lobbyAfterSpecMsg.chatMessages[lobbyAfterSpecMsg.chatMessages.length - 1];
  assert.strictEqual(lastMsgSpec.channel, 'DEAD', 'Spectator message must be forced to DEAD channel');
  assert.strictEqual(lastMsgSpec.isSpectator, true, 'Spectator message must have isSpectator = true');
  console.log('  ✔ Test 3.4: Spectator message is forced to DEAD channel with isSpectator = true');

  // 5. Mid-game JOIN auto-joins as spectator
  const postReqMidGameJoin = new Request(`http://localhost:3000/api/lobby/${postLobbyId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'JOIN',
      userId: 'p-latecomer',
      username: 'GecikənOyunçu',
    }),
  });
  await POST(postReqMidGameJoin, { params: { lobbyId: postLobbyId } });
  const lobbyAfterLateJoin = postStore.getLobby(postLobbyId)!;
  assert.ok(
    lobbyAfterLateJoin.spectators?.['p-latecomer'],
    'Latecomer joining active game should be auto-joined as spectator'
  );
  assert.strictEqual(
    lobbyAfterLateJoin.players['p-latecomer'],
    undefined,
    'Latecomer should NOT be joined as active player mid-game'
  );
  console.log('  ✔ Test 3.5: Mid-game JOIN gracefully converts user into spectator');

  // ────────────────────────────────────────────────────────────────────────────
  // SUITE 4: Elimination Metadata (deathCause & deathRound Attribution)
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- [Suite 4] Death Cause & Death Round Attribution ---');

  // 1. Night kill deathCause and deathRound
  const { store: nightStore, lobby: nightLobby } = createTestLobby('test-night-lobby-4');
  const killer = createTestPlayer('usr-mafia-killer', 'Don', true, 'MAFIA');
  const victim = createTestPlayer('usr-victim', 'Qurban', true, 'TOWN');
  nightStore.joinPlayer(nightLobby.lobbyId, killer);
  nightStore.joinPlayer(nightLobby.lobbyId, victim);
  nightStore.transitionPhase(nightLobby.lobbyId, 'NIGHT_BUFFER', 20);

  const actions: NightActionBufferItem[] = [
    {
      actorPlayerId: killer.userId,
      targetPlayerId: victim.userId,
      actionType: 'KILL',
      priority: 4,
      timestamp: Date.now(),
    },
  ];

  const resolution = resolveNightActions({
    lobby: {
      ...nightStore.getLobby(nightLobby.lobbyId)!,
      roundNumber: 2,
      bufferedNightActions: actions,
    },
  });

  const killedVictim = resolution.updatedPlayers[victim.userId];
  assert.strictEqual(killedVictim.isAlive, false, 'Victim should be dead');
  assert.strictEqual(killedVictim.deathCause, 'MAFIA_KILL', 'Victim deathCause must be MAFIA_KILL');
  assert.strictEqual(killedVictim.deathRound, 2, 'Victim deathRound must be 2');
  console.log('  ✔ Test 4.1: Night action resolver attaches deathCause="MAFIA_KILL" and deathRound');

  // 2. Courtroom Lynch in phase-manager
  const { store: lynchStore, lobby: lynchLobby } = createTestLobby('test-lynch-lobby-4');
  const accused = createTestPlayer('usr-accused', 'Təqsirləndirilən', true, 'TOWN');
  const voter1 = createTestPlayer('usr-voter-1', 'Səsverən1', true, 'TOWN');
  const voter2 = createTestPlayer('usr-voter-2', 'Səsverən2', true, 'TOWN');

  lynchStore.joinPlayer(lynchLobby.lobbyId, accused);
  lynchStore.joinPlayer(lynchLobby.lobbyId, voter1);
  lynchStore.joinPlayer(lynchLobby.lobbyId, voter2);
  const mafiaMember = createTestPlayer('usr-mafia-member', 'Don', true, 'MAFIA');
  lynchStore.joinPlayer(lynchLobby.lobbyId, mafiaMember);
  lynchStore.transitionPhase(lynchLobby.lobbyId, 'TRIAL_DEFENSE', 30);

  // Set trial verdict votes to convict
  lynchStore.updateLobby(lynchLobby.lobbyId, (l) => ({
    ...l,
    roundNumber: 3,
    accusedPlayerId: accused.userId,
    trialVerdictVotes: {
      [voter1.userId]: 'GUILTY',
      [voter2.userId]: 'GUILTY',
    },
  }));

  const transitionRes = executePhaseTransition({ lobbyId: lynchLobby.lobbyId });
  assert.ok(transitionRes, 'Phase transition should succeed');

  const lynchUpdatedLobby = lynchStore.getLobby(lynchLobby.lobbyId)!;
  const convictedPlayer = lynchUpdatedLobby.players[accused.userId];
  assert.strictEqual(convictedPlayer.isAlive, false, 'Convicted player should be dead');
  assert.strictEqual(convictedPlayer.deathCause, 'LYNCH', 'Convicted player deathCause must be LYNCH');
  assert.strictEqual(convictedPlayer.deathRound, 3, 'Convicted player deathRound must be 3');
  console.log('  ✔ Test 4.2: Courtroom verdict attaches deathCause="LYNCH" and deathRound=3');

  // ────────────────────────────────────────────────────────────────────────────
  // SUITE 5: Resurrect Clears Death Metadata
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- [Suite 5] Resurrect Mechanics Reset Death Metadata ---');

  const { store: rezStore, lobby: rezLobby } = createTestLobby('test-rez-lobby-5');
  const deadTarget = createTestPlayer('usr-dead-rez', 'Qayıdan', false, 'TOWN');
  const resurrectDeadPlayer: PlayerSession = {
    ...deadTarget,
    deathCause: 'MAFIA_KILL',
    deathRound: 1,
  };
  const rezActor = createTestPlayer('usr-healer', 'Xilaskar', true, 'TOWN');

  rezStore.joinPlayer(rezLobby.lobbyId, resurrectDeadPlayer);
  rezStore.joinPlayer(rezLobby.lobbyId, rezActor);

  const rezActions: NightActionBufferItem[] = [
    {
      actorPlayerId: rezActor.userId,
      targetPlayerId: resurrectDeadPlayer.userId,
      actionType: 'RESURRECT',
      priority: 7,
      timestamp: Date.now(),
    },
  ];

  const rezResolution = resolveNightActions({
    lobby: {
      ...rezStore.getLobby(rezLobby.lobbyId)!,
      roundNumber: 2,
      bufferedNightActions: rezActions,
    },
  });

  const revivedPlayer = rezResolution.updatedPlayers[resurrectDeadPlayer.userId];
  assert.strictEqual(revivedPlayer.isAlive, true, 'Revived player must be alive');
  assert.strictEqual(revivedPlayer.deathCause, undefined, 'Revived player deathCause must be cleared');
  assert.strictEqual(revivedPlayer.deathRound, undefined, 'Revived player deathRound must be cleared');
  console.log('  ✔ Test 5.1: RESURRECT restores isAlive=true and clears deathCause/deathRound metadata');

  console.log('\n================================================================');
  console.log('✅ ALL SPECTATOR MODE & DEAD CHAT TESTS PASSED (100% SUCCESS)');
  console.log('================================================================');
}

runSpectatorDeadChatTests().catch((err) => {
  console.error('❌ Spectator Mode & Dead Chat Test Suite Failed:', err);
  process.exit(1);
});
