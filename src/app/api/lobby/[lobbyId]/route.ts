import { NextResponse } from 'next/server';
import { inMemoryLobbyStore } from '../../../../server/state/memory';
import { buildScrubbedLobbyView } from '../../../../server/socket/dispatcher';
import { formatRoleDisplay } from '../../../../types/roles';
import { GamePhase, LobbyState, NightActionPriority, NightActionType, PlayerSession, SpectatorSession } from '../../../../types/game';
import { GameMode } from '../../../../types/packs';
import { PACKS_CONFIG, deriveModeFromLobbyId } from '../../../../config/packs.config';
import {
  createInitialDantesInfernoState,
  createInitialEarthStoodStillState,
  createInitialValkyrieState,
  createInitialStanfordPrisonState,
  createInitialCatenaccioState,
  createInitialChernobylState,
} from '../../../../config/minigames.config';
import { MinigameSubStates } from '../../../../types/minigames';
import { PlayerTier } from '../../../../types/access';
import { CoreFaction } from '../../../../types/roles';
import { resolveNightActions } from '../../../../server/engine/night-action-resolver';
import { runVotingEngine, determineVerdictOutcome, executeMayorReveal, castVerdictVote, isMayor } from '../../../../server/engine/voting-engine';
import { evaluateWinCondition } from '../../../../server/engine/phase-manager';
import { botTakeoverController } from '../../../../server/ai/bot-takeover';
import { InvestigationResult } from '../../../../types/engine';
import { generateMorningNewspaperStory } from '../../../../server/ai/ai-narrator';
import { dispatchMinigamePhaseEvent, executePrisonSanction, executePrisonSolitary } from '../../../../server/engine/minigames-engine';


interface RouteContext {
  readonly params: {
    readonly lobbyId: string;
  };
}

const BOT_NAME_POOL = [
  'Bot_Aysel',
  'Bot_Rauf',
  'Bot_Leyla',
  'Bot_Elmir',
  'Bot_Kamran',
  'Bot_Nigar',
  'Bot_Murad',
  'Bot_Sevda',
  'Bot_Togrul',
  'Bot_Ayan',
  'Bot_Cavid',
  'Bot_Gunel',
  'Bot_Rashad',
  'Bot_Rena',
  'Bot_Farid',
  'Bot_Zahra',
  'Bot_Fuad',
  'Bot_Lala',
  'Bot_Eldar',
  'Bot_Sabina',
  'Bot_Samir',
  'Bot_Konul',
  'Bot_Anar',
  'Bot_Amina',
  'Bot_Tural',
  'Bot_Fatima',
  'Bot_Ilkin',
  'Bot_Aida',
  'Bot_Vusal',
  'Bot_Narmin',
  'Bot_Emil',
  'Bot_Gulnar',
  'Bot_Orkhan',
  'Bot_Nargiz',
  'Bot_Emin',
  'Bot_Fidan',
  'Bot_Ramil',
  'Bot_Zeynab',
  'Bot_Kenan',
  'Bot_Shabnam',
  'Bot_Hasan',
  'Bot_Maryam',
  'Bot_Ali',
  'Bot_Mehriban',
  'Bot_Polad',
  'Bot_Sona',
  'Bot_Nijat',
  'Bot_Perver',
  'Bot_Ruslan',
  'Bot_Leman',
];

function initializeMinigameSubStates(lobby: LobbyState): MinigameSubStates {
  const pList = Object.values(lobby.players);
  const pIds = pList.map(p => p.userId);

  if (lobby.mode === 'DANTES_INFERNO') {
    return { dantesInferno: createInitialDantesInfernoState() };
  }
  if (lobby.mode === 'THE_DAY_THE_EARTH_STOOD_STILL') {
    const klaatu = pList.find(p => p.displayRole?.originalRoleName === 'Investigator' || p.displayRole?.localizedRoleName?.includes('Şərif'))?.userId || pIds[0] || null;
    return { earthStoodStill: createInitialEarthStoodStillState(klaatu) };
  }
  if (lobby.mode === 'OPERATION_VALKYRIE') {
    const dictator = pList.find(p => p.allInIdentity?.layer1Faction === 'MAFIA')?.userId || pIds[0] || 'usr-host';
    const conspirators = pList.filter(p => p.userId !== dictator).slice(0, 3).map(p => p.userId);
    const initialHolder = conspirators[0] || pIds[1] || pIds[0] || 'usr-holder';
    return { valkyrie: createInitialValkyrieState(dictator, conspirators, initialHolder) };
  }
  if (lobby.mode === 'STANFORD_PRISON') {
    const warden = pIds[0] || 'usr-warden';
    const guards = pIds.slice(1, Math.max(2, Math.floor(pIds.length / 3)));
    const inmates = pIds.slice(guards.length + 1);
    const secretAssassin = inmates[0] || null;
    return { stanfordPrison: createInitialStanfordPrisonState(warden, guards, inmates, secretAssassin) };
  }
  if (lobby.mode === 'CATENACCIO') {
    const defenders = pList.filter(p => p.allInIdentity?.layer1Faction === 'TOWN').slice(0, 3).map(p => p.userId);
    const sniper = pList.find(p => p.allInIdentity?.layer1Faction === 'NEUTRAL_KILLER' || p.allInIdentity?.layer1Faction === 'MAFIA')?.userId || pIds[0] || null;
    return { catenaccio: createInitialCatenaccioState(defenders.length > 0 ? defenders : pIds.slice(0, 2), sniper, 2) };
  }
  if (lobby.mode === 'CHERNOBYL_EXCLUSION_ZONE') {
    const liquidator = pList.find(
      p => p.allInIdentity?.layer1Faction === 'TOWN' &&
      (p.displayRole?.originalRoleName === 'Doctor' || p.displayRole?.localizedRoleName?.includes('Həkim') || p.displayRole?.localizedRoleName?.toLowerCase().includes('likvidator') || p.displayRole?.localizedRoleName?.toLowerCase().includes('dozimetrist'))
    )?.userId || pIds[0] || null;
    const capacity = Math.max(2, Math.floor(pIds.length / 4));
    return { chernobyl: createInitialChernobylState(pIds, capacity, 15, 100, liquidator) };
  }

  return {};
}

/**
 * Distribute secret roles ONLY WHEN GAME STARTS.
 * In LOBBY phase, every player is purely in waiting status without any role assigned.
 */
function distributeSecretRoles(lobby: LobbyState): LobbyState {
  const playerList = Object.values(lobby.players);
  const count = playerList.length;
  if (count === 0) return lobby;

  // Shuffle player list
  const shuffled = [...playerList].sort(() => Math.random() - 0.5);

  // Deck generation based on player count and mode
  const isInferno = lobby.mode === 'DANTES_INFERNO';
  const roleDeck: Array<{ nickname: string; base: string; az: string; faction: CoreFaction; office: any }> = [];

  const addM1 = () => roleDeck.push({ nickname: isInferno ? 'Malebranche' : 'Qatil (Don)', base: 'Killer', az: 'Mafiya (Qatil)', faction: 'MAFIA', office: 'PUBLIC_DEFENDER' });
  const addM2 = () => roleDeck.push({ nickname: isInferno ? 'Yalançı Ruh' : 'Şərr Atan (Framer)', base: 'Framer', az: 'Şərr Atan', faction: 'MAFIA', office: 'MEDIA_MOGUL' });
  const addM3 = () => roleDeck.push({ nickname: isInferno ? 'Zülmət Elçisi' : 'Mafiya Üzvü', base: 'Killer', az: 'Mafiya Üzvü', faction: 'MAFIA', office: 'PUBLIC_DEFENDER' });

  const addT1 = () => roleDeck.push({ nickname: isInferno ? 'Mərhəmət Mələyi' : 'Həkim', base: 'Doctor', az: 'Həkim', faction: 'TOWN', office: 'CITY_SURGEON' });
  const addT2 = () => roleDeck.push({ nickname: isInferno ? 'Vergili' : 'Şərif', base: 'Investigator', az: 'Şərif', faction: 'TOWN', office: 'CITY_INVESTIGATOR' });
  const addT3 = () => roleDeck.push({ nickname: isInferno ? 'Sirena' : 'Gözbağlayıcı', base: 'Blocker', az: 'Gözbağlayıcı', faction: 'TOWN', office: 'CHIEF_FIRE_MARSHAL' });

  const addN1 = () => roleDeck.push({ nickname: isInferno ? 'Kafirlərin Lideri' : 'Dəli (Jester)', base: 'Jester', az: 'Dəli', faction: 'NEUTRAL_EVIL', office: 'PUBLIC_DEFENDER' });
  const addNK1 = () => roleDeck.push({ nickname: isInferno ? 'İblisin Kölgəsi' : 'Manyak (Serial Killer)', base: 'SerialKiller', az: 'Manyak', faction: 'NEUTRAL_KILLER', office: 'PUBLIC_DEFENDER' });

  if (count <= 4) {
    addM1();
    if (count >= 4) addT1();
  } else if (count === 5) {
    addM1(); addT1(); addT2();
  } else if (count === 6) {
    addM1(); addN1(); addT1(); addT2();
  } else if (count === 7) {
    addM1(); addM2(); addT1(); addT2(); addNK1();
  } else if (count === 8) {
    addM1(); addM2(); addT1(); addT2(); addT3(); addNK1();
  } else if (count === 9) {
    addM1(); addM2(); addN1(); addNK1(); addT1(); addT2(); addT3();
  } else if (count >= 10) {
    addM1(); addM2(); addM3(); addT1(); addT2(); addT3();
    if (count >= 11) addN1();
  }

  while (roleDeck.length < count) {
    roleDeck.push({
      nickname: isInferno ? 'Günahkar Ruh' : 'Vətəndaş',
      base: 'Citizen',
      az: 'Məsum Vətəndaş',
      faction: 'TOWN',
      office: 'PUBLIC_DEFENDER',
    });
  }

  // Shuffle deck
  roleDeck.sort(() => Math.random() - 0.5);

  const updatedPlayers: Record<string, PlayerSession> = {};
  for (let i = 0; i < count; i++) {
    const p = shuffled[i];
    const assigned = roleDeck[i];
    updatedPlayers[p.userId] = {
      ...p,
      displayRole: formatRoleDisplay(p.username, assigned.base, assigned.az),
      allInIdentity: {
        layer1Faction: assigned.faction,
        layer2Office: assigned.office,
        layer3Trait: 'PHANTOM_STEP',
        district: (['ELITE', 'COMMERCIAL', 'INDUSTRIAL'] as const)[i % 3],
      },
    };
  }

  return {
    ...lobby,
    players: updatedPlayers,
  };
}

/**
 * Strips secret roles and identities of OTHER alive players from the payload.
 *  • Player's own secret role is ALWAYS preserved.
 *  • Fellow Mafia teammates see each other (standard Mafia mechanic).
 *  • Eliminated/Dead players have their true identity revealed.
 *  • When game is ENDED, all roles are revealed.
 *  • Alive non-teammates are safely masked as "Gizli Rol" with undefined offices.
 */
function sanitizeLobbyForViewer(lobby: LobbyState, viewerUserId: string): LobbyState {
  const viewerSession = lobby.players[viewerUserId];
  const isViewerAlive = viewerSession ? viewerSession.isAlive : false;
  const isViewerSpectator = !viewerSession || Boolean(lobby.spectators?.[viewerUserId]);
  const isViewerMafia =
    viewerSession?.allInIdentity?.layer1Faction === 'MAFIA' ||
    viewerSession?.displayRole?.originalRoleName?.toLowerCase().includes('mafia') ||
    viewerSession?.displayRole?.localizedRoleName?.toLowerCase().includes('mafiya') ||
    viewerSession?.displayRole?.originalRoleName === 'Mafioso' ||
    viewerSession?.displayRole?.originalRoleName === 'Don';
  const isLobbyPhase = lobby.phase === 'LOBBY';
  const isEnded = lobby.phase === 'ENDED';

  const safeChatMessages = (lobby.chatMessages || []).filter(msg => {
    if (isEnded) return true;
    if (msg.channel === 'LOBBY') return true;
    if (msg.channel === 'DEAD') {
      return !isViewerAlive || isViewerSpectator;
    }
    if (msg.channel === 'MAFIA') {
      return isViewerMafia;
    }
    return false;
  });

  const sanitizedPlayers: Record<string, PlayerSession> = {};
  for (const [id, p] of Object.entries(lobby.players)) {
    const isSelf = id === viewerUserId;
    const isTeammateMafia = isViewerMafia && p.allInIdentity?.layer1Faction === 'MAFIA';
    const isRevealedDead = !p.isAlive;

    if (isLobbyPhase) {
      sanitizedPlayers[id] = {
        ...p,
        displayRole: formatRoleDisplay(p.username, 'Pending', 'Gözləmədə'),
        allInIdentity: undefined,
      };
    } else if (isEnded || isSelf) {
      sanitizedPlayers[id] = p;
    } else if (isRevealedDead) {
      sanitizedPlayers[id] = {
        ...p,
        displayRole: p.displayRole,
        allInIdentity: p.allInIdentity,
      };
    } else if (isTeammateMafia) {
      sanitizedPlayers[id] = {
        ...p,
        displayRole: p.displayRole,
        allInIdentity: p.allInIdentity,
      };
    } else {
      sanitizedPlayers[id] = {
        ...p,
        displayRole: formatRoleDisplay(p.username, 'Secret', 'Gizli Rol'),
        allInIdentity: undefined, // civic office and faction hidden!
      };
    }
  }

  // Only expose private investigation results belonging to this requesting user
  const viewerInvestigations = lobby.privateInvestigations?.[viewerUserId] ?? [];

  // Scrub buffered night actions: players only see their own, and Mafia sees other Mafia actions
  let safeNightActions = lobby.bufferedNightActions;
  if (!isEnded) {
    safeNightActions = lobby.bufferedNightActions.filter(a => {
      if (a.actorPlayerId === viewerUserId) return true;
      if (isViewerMafia) {
        const actor = lobby.players[a.actorPlayerId];
        if (actor?.allInIdentity?.layer1Faction === 'MAFIA') return true;
      }
      return false;
    });
  }

  return {
    ...lobby,
    players: sanitizedPlayers,
    chatMessages: safeChatMessages,
    bufferedNightActions: safeNightActions,
    privateInvestigations: {
      [viewerUserId]: viewerInvestigations,
    },
  };
}

/**
 * Progresses the lobby phase to the next logical step with full resolution:
 *  • NIGHT_BUFFER → resolves kills/protections/intel, updates newspaper, transitions to DAY_VOTING.
 *  • DAY_VOTING → resolves court votes, lynch victim, checks win, transitions to NIGHT_BUFFER (or ENDED).
 */
async function progressLobbyPhase(lobbyId: string): Promise<LobbyState> {
  let lobby = inMemoryLobbyStore.getLobby(lobbyId);
  if (!lobby) throw new Error('Lobby not found');

  if (lobby.phase === 'NIGHT_BUFFER') {
    // 1. Ensure all bots acted
    await botTakeoverController.executeAllBotActions(lobbyId);
    lobby = inMemoryLobbyStore.getLobby(lobbyId) || lobby;

    // 2. Resolve night actions
    const resolution = resolveNightActions({ lobby });

    // 3. Group private investigations by investigator
    const groupedInvestigations: Record<string, InvestigationResult[]> = {};
    for (const inv of resolution.newspaper.privateInvestigationResults) {
      if (!groupedInvestigations[inv.investigatorPlayerId]) {
        groupedInvestigations[inv.investigatorPlayerId] = [];
      }
      groupedInvestigations[inv.investigatorPlayerId].push(inv);
    }

    // 4. Enrich story via AI if available, falling back to procedural narrative
    let finalHeadline = resolution.newspaper.headline ?? (resolution.newspaper.publicDeaths.length > 0 ? 'Qanlı Gecə!' : 'Sükut');
    let finalStory = resolution.newspaper.story;

    try {
      const aiStory = await generateMorningNewspaperStory(
        lobby.roundNumber,
        [...resolution.newspaper.publicDeaths],
        lobby.players,
        resolution.newspaper.protectedIds,
        lobby.minigameSubStates,
        resolution.newspaper.armorBrokenPlayerIds
      );
      if (aiStory?.headline) finalHeadline = aiStory.headline;
      if (aiStory?.story) finalStory = aiStory.story;
    } catch {
      // Kept procedural default
    }

    // 5. Update lobby state and increment round
    inMemoryLobbyStore.updateLobby(lobbyId, (l) => ({
      ...l,
      players: resolution.updatedPlayers,
      lastLynchedUserId: null,
      bufferedNightActions: [],
      mafiaMutinyActive: resolution.mutinyActive,
      mutineerIds: resolution.mutineerIds,
      latestNewspaper: {
        ...resolution.newspaper,
        roundNumber: l.roundNumber,
        headline: finalHeadline,
        story: finalStory,
      },
      pastNewspapers: [...(l.pastNewspapers || []), {
        ...resolution.newspaper,
        roundNumber: l.roundNumber,
        headline: finalHeadline,
        story: finalStory,
      }],
      roundNumber: l.roundNumber + 1,
      privateInvestigations: {
        ...(l.privateInvestigations || {}),
        ...groupedInvestigations,
      },
    }));

    // 6. Advance minigames on morning arrival
    if (lobby.minigameSubStates && Object.keys(lobby.minigameSubStates).length > 0) {
      const minigameOutput = dispatchMinigamePhaseEvent({
        lobbyId,
        isMorningArrival: true,
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
      if (minigameOutput.chernobylResult?.newCasualtyPlayerIds && minigameOutput.chernobylResult.newCasualtyPlayerIds.length > 0) {
        inMemoryLobbyStore.updateLobby(lobbyId, (l) => {
          const updatedP = { ...l.players };
          for (const deadId of minigameOutput.chernobylResult!.newCasualtyPlayerIds) {
            if (updatedP[deadId]) {
              updatedP[deadId] = { ...updatedP[deadId], isAlive: false };
            }
          }
          return {
            ...l,
            players: updatedP,
            minigameSubStates: minigameOutput.updatedSubStates,
          };
        });
      } else {
        inMemoryLobbyStore.updateLobby(lobbyId, (l) => ({
          ...l,
          minigameSubStates: minigameOutput.updatedSubStates,
        }));
      }
    }

    lobby = inMemoryLobbyStore.getLobby(lobbyId) || lobby;
    const win = evaluateWinCondition(lobby);
    if (win.kind !== 'GAME_CONTINUES') {
      inMemoryLobbyStore.updateLobby(lobbyId, (l) => ({ ...l, winnerResult: win }));
      inMemoryLobbyStore.transitionPhase(lobbyId, 'ENDED', 0);
    } else {
      inMemoryLobbyStore.transitionPhase(lobbyId, 'DAY_VOTING', lobby.phaseDurationSeconds > 0 ? lobby.phaseDurationSeconds : 60);
      await botTakeoverController.executeAllBotActions(lobbyId);
    }
    return inMemoryLobbyStore.getLobby(lobbyId) || lobby;

  } else if (lobby.phase === 'DAY_VOTING') {
    // 1. Ensure bots voted
    await botTakeoverController.executeAllBotActions(lobbyId);
    lobby = inMemoryLobbyStore.getLobby(lobbyId) || lobby;

    // 2. Run voting court engine
    const voteOutput = runVotingEngine({ lobby });
    if (voteOutput.outcome.kind === 'LYNCHED') {
      const accusedId = voteOutput.outcome.victimId;
      inMemoryLobbyStore.updateLobby(lobbyId, (l) => ({
        ...l,
        accusedPlayerId: accusedId,
        trialVerdictVotes: {},
        liveVotes: {},
      }));
      inMemoryLobbyStore.transitionPhase(lobbyId, 'TRIAL_DEFENSE', 30);
      return inMemoryLobbyStore.getLobby(lobbyId) || lobby;
    } else {
      inMemoryLobbyStore.updateLobby(lobbyId, (l) => ({
        ...l,
        accusedPlayerId: null,
        trialVerdictVotes: {},
        liveVotes: {},
        lastLynchedUserId: null,
      }));
      lobby = inMemoryLobbyStore.getLobby(lobbyId) || lobby;
      const win = evaluateWinCondition(lobby);
      if (win.kind !== 'GAME_CONTINUES') {
        inMemoryLobbyStore.updateLobby(lobbyId, (l) => ({ ...l, winnerResult: win }));
        inMemoryLobbyStore.transitionPhase(lobbyId, 'ENDED', 0);
      } else {
        inMemoryLobbyStore.transitionPhase(lobbyId, 'NIGHT_BUFFER', lobby.phaseDurationSeconds > 0 ? lobby.phaseDurationSeconds : 45);
        await botTakeoverController.executeAllBotActions(lobbyId);
      }
      return inMemoryLobbyStore.getLobby(lobbyId) || lobby;
    }

  } else if (lobby.phase === 'TRIAL_DEFENSE') {
    lobby = inMemoryLobbyStore.getLobby(lobbyId) || lobby;

    // Evaluate final verdict outcome
    const verdictResult = determineVerdictOutcome(lobby);
    const updatedPlayers = { ...lobby.players };
    let lynchedId: string | null = null;
    let isTownLynched = false;

    if (verdictResult.verdict === 'GUILTY' && verdictResult.convictedPlayerId) {
      lynchedId = verdictResult.convictedPlayerId;
      if (updatedPlayers[lynchedId]) {
        isTownLynched = updatedPlayers[lynchedId].allInIdentity?.layer1Faction === 'TOWN';
        updatedPlayers[lynchedId] = {
          ...updatedPlayers[lynchedId],
          isAlive: false,
          deathCause: 'LYNCH',
          deathRound: lobby.roundNumber,
        };
      }
    }

    inMemoryLobbyStore.updateLobby(lobbyId, (l) => ({
      ...l,
      players: updatedPlayers,
      lastLynchedUserId: lynchedId,
      accusedPlayerId: null,
      trialVerdictVotes: {},
    }));

    // Advance minigames on lynch / night transition
    if (lobby.minigameSubStates && Object.keys(lobby.minigameSubStates).length > 0) {
      const minigameOutput = dispatchMinigamePhaseEvent({
        lobbyId,
        isMorningArrival: false,
        danteGreedAbilityUsers: [],
        danteLynchedPlayerId: lynchedId,
        earthInnocentsLynched: isTownLynched && lynchedId ? [lynchedId] : [],
        earthKlaatuFreezeActivated: false,
        earthGortTarget: null,
        valkyrieBriefcasePassTarget: null,
        prisonGuardSanctions: [],
        prisonWardenAppeased: [],
        prisonInmatesLynched: isTownLynched && lynchedId ? [lynchedId] : [],
        prisonSolitary: [],
        prisonAssassinStrike: false,
        prisonAssassinTarget: null,
        catenaccioSniperTarget: null,
        catenaccioWallAttackers: [],
        publicDeaths: [],
      });
      if (minigameOutput.chernobylResult?.newCasualtyPlayerIds && minigameOutput.chernobylResult.newCasualtyPlayerIds.length > 0) {
        inMemoryLobbyStore.updateLobby(lobbyId, (l) => {
          const updatedP = { ...l.players };
          for (const deadId of minigameOutput.chernobylResult!.newCasualtyPlayerIds) {
            if (updatedP[deadId]) {
              updatedP[deadId] = {
                ...updatedP[deadId],
                isAlive: false,
                deathCause: 'RADIATION_SICKNESS',
                deathRound: l.roundNumber,
              };
            }
          }
          return {
            ...l,
            players: updatedP,
            minigameSubStates: minigameOutput.updatedSubStates,
          };
        });
      } else {
        inMemoryLobbyStore.updateLobby(lobbyId, (l) => ({
          ...l,
          minigameSubStates: minigameOutput.updatedSubStates,
        }));
      }
    }

    lobby = inMemoryLobbyStore.getLobby(lobbyId) || lobby;
    const win = evaluateWinCondition(lobby);
    if (win.kind !== 'GAME_CONTINUES') {
      inMemoryLobbyStore.updateLobby(lobbyId, (l) => ({ ...l, winnerResult: win }));
      inMemoryLobbyStore.transitionPhase(lobbyId, 'ENDED', 0);
    } else {
      inMemoryLobbyStore.transitionPhase(lobbyId, 'NIGHT_BUFFER', lobby.phaseDurationSeconds > 0 ? lobby.phaseDurationSeconds : 45);
      await botTakeoverController.executeAllBotActions(lobbyId);
    }
    return inMemoryLobbyStore.getLobby(lobbyId) || lobby;

  } else if (lobby.phase === 'DAY_REGIONAL_CAUCUS' || lobby.phase === 'DAY_CENTRAL_ASSEMBLY') {
    inMemoryLobbyStore.transitionPhase(lobbyId, 'DAY_VOTING', lobby.phaseDurationSeconds > 0 ? lobby.phaseDurationSeconds : 60);
    await botTakeoverController.executeAllBotActions(lobbyId);
    return inMemoryLobbyStore.getLobby(lobbyId) || lobby;
  }

  return lobby;
}

function getOrCreateLobby(lobbyId: string, initialHostUser?: { userId: string; username: string; tier: PlayerTier }): LobbyState {
  let lobby = inMemoryLobbyStore.getLobby(lobbyId);
  if (!lobby) {
    const mode = deriveModeFromLobbyId(lobbyId);
    const hostId = initialHostUser?.userId || '';
    const hostName = initialHostUser?.username || '';
    const hostTier = initialHostUser?.tier || 'TIER_1';

    if (hostId) {
      const hostSession: PlayerSession = {
        socketId: `sock-${hostId}`,
        userId: hostId,
        username: hostName,
        tier: hostTier,
        adminRole: mode === 'ALL_IN' ? 'THE_ARCHITECT' : 'NONE',
        isHost: true,
        isAlive: true,
        hasHostWaiver: true,
        hasAdminWaiver: true,
        displayRole: formatRoleDisplay(hostName, 'Pending', 'Gözləmədə'),
        currentDistrict: 'ELITE',
        disconnectedAt: null,
        isAiBotControlled: false,
      };
      lobby = inMemoryLobbyStore.createLobby(lobbyId, hostId, hostSession, mode);
    } else {
      // Empty lobby waiting for first player to join
      const dummyHost: PlayerSession = {
        socketId: 'sock-empty',
        userId: 'temp-init',
        username: 'Init',
        tier: 'TIER_1',
        adminRole: 'NONE',
        isHost: false,
        isAlive: true,
        hasHostWaiver: true,
        hasAdminWaiver: false,
        displayRole: formatRoleDisplay('Init', 'Pending', 'Gözləmədə'),
        currentDistrict: 'COMMERCIAL',
        disconnectedAt: null,
        isAiBotControlled: false,
      };
      lobby = inMemoryLobbyStore.createLobby(lobbyId, '', dummyHost, mode);
      inMemoryLobbyStore.updateLobby(lobbyId, (l) => ({ ...l, players: {} }));
      lobby = inMemoryLobbyStore.getLobby(lobbyId)!;
    }
  }
  return lobby;
}

export async function GET(request: Request, context: RouteContext) {
  const { lobbyId } = context.params;

  // Validate lobbyId format — must be alphanumeric + hyphens, 4-80 chars
  if (!/^[a-zA-Z0-9_-]{4,80}$/.test(lobbyId)) {
    return NextResponse.json({ error: 'INVALID_LOBBY_ID' }, { status: 400 });
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId') || 'anon';

    let lobby = inMemoryLobbyStore.getLobby(lobbyId);
    if (lobby && lobby.players[userId]) {
       // Update lastSeenAt for the requesting user
       inMemoryLobbyStore.updateLobby(lobbyId, (l) => {
         if (!l.players[userId]) return l;
         return {
           ...l,
           players: {
             ...l.players,
             [userId]: { ...l.players[userId], lastSeenAt: Date.now() }
           }
         };
       });
       lobby = inMemoryLobbyStore.getLobby(lobbyId) || lobby;
    } else if (lobby && lobby.spectators?.[userId]) {
       // Update lastSeenAt for the requesting spectator
       inMemoryLobbyStore.updateLobby(lobbyId, (l) => {
         if (!l.spectators?.[userId]) return l;
         return {
           ...l,
           spectators: {
             ...l.spectators,
             [userId]: { ...l.spectators[userId], lastSeenAt: Date.now() }
           }
         };
       });
       lobby = inMemoryLobbyStore.getLobby(lobbyId) || lobby;
    }
    if (!lobby) {
      lobby = getOrCreateLobby(lobbyId, userId && userId !== 'anon' ? { userId, username: 'Oyunçu', tier: 'TIER_1' } : undefined);
    }

    // Sync remaining countdown seconds based on authoritative phaseEndsAt
    lobby = inMemoryLobbyStore.syncCountdown(lobbyId) || lobby;

    // Auto-advance phase when authoritative timer runs out
    if (
      lobby.phase !== 'LOBBY' &&
      lobby.phase !== 'ENDED' &&
      lobby.phaseEndsAt &&
      Date.now() >= lobby.phaseEndsAt
    ) {
      lobby = await progressLobbyPhase(lobbyId);
    } else if (lobby.phase !== 'LOBBY' && lobby.phase !== 'ENDED') {
      await botTakeoverController.executeAllBotActions(lobbyId);
      lobby = inMemoryLobbyStore.getLobby(lobbyId) || lobby;
    }
    
    if (lobby.phase === 'NIGHT_BUFFER') {
      // Check if all living active night actors have submitted actions: auto-advance early!
      const alivePlayers = Object.values(lobby.players).filter(p => p.isAlive);
      const activeNightActors = alivePlayers.filter(p => {
        const f = p.allInIdentity?.layer1Faction;
        const off = p.allInIdentity?.layer2Office;
        return (
          f === 'MAFIA' ||
          f === 'YAKUZA' ||
          f === 'VOID_CULT' ||
          f === 'NEUTRAL_KILLER' ||
          off === 'CITY_SURGEON' ||
          off === 'CITY_INVESTIGATOR' ||
          off === 'POLICE_COMMISSIONER' ||
          off === 'CHIEF_FIRE_MARSHAL' ||
          off === 'PRISON_WARDEN' ||
          off === 'BLACK_MARKET_BROKER'
        );
      });

      const actedSet = new Set(lobby.bufferedNightActions.map(a => a.actorPlayerId));
      const allActed = activeNightActors.length > 0 && activeNightActors.every(a => actedSet.has(a.userId));

      if (allActed) {
        lobby = await progressLobbyPhase(lobbyId);
      }
    } else if (lobby.phase === 'DAY_VOTING') {
      lobby = inMemoryLobbyStore.getLobby(lobbyId) || lobby;
    }

    const scrubbed = buildScrubbedLobbyView(lobby, userId);
    const safeLobby = sanitizeLobbyForViewer(lobby, userId);

    return NextResponse.json(
      {
        success: true,
        lobby: scrubbed,
        rawLobby: safeLobby,
        timestamp: Date.now(),
      },
      { headers: corsHeaders }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[lobby/GET] lobbyId=${lobbyId} error:`, msg);
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', detail: msg },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { lobbyId } = context.params;

  // Validate lobbyId format — must be alphanumeric + hyphens, 4-80 chars
  if (!/^[a-zA-Z0-9_-]{4,80}$/.test(lobbyId)) {
    return NextResponse.json({ error: 'INVALID_LOBBY_ID' }, { status: 400 });
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const body = await request.json();
    const action = String(body.action || 'SYNC');
    const userId = String(body.userId || 'usr-' + Math.random().toString(36).substring(2, 8));
    const username = String(body.username || 'Oyunçu');
    const tier = (body.tier as PlayerTier) || 'TIER_1';

    let lobby = inMemoryLobbyStore.getLobby(lobbyId);
    if (!lobby) {
      lobby = getOrCreateLobby(lobbyId, { userId, username, tier });
    }

    if (action === 'JOIN') {
      if (lobby.phase !== 'LOBBY') {
        // Auto-join mid-game joins as spectator
        const spectator: SpectatorSession = {
          userId,
          username,
          joinedAt: Date.now(),
          lastSeenAt: Date.now(),
        };
        const updated = inMemoryLobbyStore.joinSpectator(lobbyId, spectator);
        if (updated) lobby = updated;
      } else {
        const realPlayers = Object.values(lobby.players).filter(p => !p.userId.startsWith('temp-') && !p.userId.startsWith('usr-host-initial'));
        const isFirstRealPlayer = realPlayers.length === 0 || lobby.hostUserId === '' || lobby.hostUserId === 'usr-host-initial' || lobby.hostUserId === userId;

        if (isFirstRealPlayer && lobby.hostUserId !== userId) {
          inMemoryLobbyStore.removePlayer(lobbyId, 'usr-host-initial');
          inMemoryLobbyStore.removePlayer(lobbyId, 'temp-init');
          inMemoryLobbyStore.updateLobby(lobbyId, (l) => ({ ...l, hostUserId: userId }));
          lobby = inMemoryLobbyStore.getLobby(lobbyId) || lobby;
        }

        if (!lobby.players[userId]) {
          const isHost = isFirstRealPlayer || lobby.hostUserId === userId;
          const newPlayer: PlayerSession = {
            socketId: `sock-${userId}`,
            userId,
            username,
            tier,
            adminRole: 'NONE',
            isHost,
            isAlive: true,
            hasHostWaiver: true,
            hasAdminWaiver: false,
            displayRole: formatRoleDisplay(username, 'Pending', 'Gözləmədə'),
            currentDistrict: 'COMMERCIAL',
            disconnectedAt: null,
            isAiBotControlled: false,
          };
          const joinRes = inMemoryLobbyStore.joinPlayer(lobbyId, newPlayer);
          if (joinRes.success && joinRes.lobby) {
            lobby = joinRes.lobby;
          }
        }
      }
    } else if (action === 'JOIN_SPECTATOR') {
      const spectator: SpectatorSession = {
        userId,
        username,
        joinedAt: Date.now(),
        lastSeenAt: Date.now(),
      };
      const updated = inMemoryLobbyStore.joinSpectator(lobbyId, spectator);
      if (updated) lobby = updated;

    } else if (action === 'LEAVE_SPECTATOR') {
      const updated = inMemoryLobbyStore.removeSpectator(lobbyId, userId);
      if (updated) lobby = updated;
    } else if (action === 'ADD_BOT') {
      const existingNames = new Set(Object.values(lobby.players).map(p => p.username));
      const chosenName = BOT_NAME_POOL.find(n => !existingNames.has(n)) || `Bot_${Math.floor(100 + Math.random() * 900)}`;
      const botId = `bot-${chosenName.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
      const botSession: PlayerSession = {
        socketId: `sock-${botId}`,
        userId: botId,
        username: chosenName,
        tier: 'TIER_1',
        adminRole: 'NONE',
        isHost: false,
        isAlive: true,
        hasHostWaiver: true,
        hasAdminWaiver: false,
        displayRole: formatRoleDisplay(chosenName, 'Pending', 'Gözləmədə'),
        currentDistrict: 'COMMERCIAL',
        disconnectedAt: null,
        isAiBotControlled: true,
      };
      inMemoryLobbyStore.joinPlayer(lobbyId, botSession);
      botTakeoverController.registerBot(botId, lobbyId);
      lobby = inMemoryLobbyStore.getLobby(lobbyId) || lobby;

    } else if (action === 'FILL_BOTS') {
      const targetCount = Math.max(4, Math.min(45, Number(body.targetCount) || 5));
      let currentCount = Object.keys(lobby.players).length;
      const existingNames = new Set(Object.values(lobby.players).map(p => p.username));
      for (const name of BOT_NAME_POOL) {
        if (currentCount >= targetCount) break;
        if (!existingNames.has(name)) {
          const botId = `bot-${name.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
          const botSession: PlayerSession = {
            socketId: `sock-${botId}`,
            userId: botId,
            username: name,
            tier: 'TIER_1',
            adminRole: 'NONE',
            isHost: false,
            isAlive: true,
            hasHostWaiver: true,
            hasAdminWaiver: false,
            displayRole: formatRoleDisplay(name, 'Pending', 'Gözləmədə'),
            currentDistrict: 'COMMERCIAL',
            disconnectedAt: null,
            isAiBotControlled: true,
          };
          inMemoryLobbyStore.joinPlayer(lobbyId, botSession);
          botTakeoverController.registerBot(botId, lobbyId);
          existingNames.add(name);
          currentCount++;
        }
      }
      lobby = inMemoryLobbyStore.getLobby(lobbyId) || lobby;

    } else if (action === 'UPDATE_NAME') {
      const newName = String(body.newName || '').trim().substring(0, 24);
      if (newName && lobby && lobby.players[userId]) {
        inMemoryLobbyStore.updateLobby(lobbyId, (l) => {
          if (!l.players[userId]) return l;
          const currentPlayer = l.players[userId];
          const updatedPlayer = {
            ...currentPlayer,
            username: newName,
            displayRole: formatRoleDisplay(
              newName,
              currentPlayer.displayRole?.originalRoleName || 'Citizen',
              currentPlayer.displayRole?.localizedRoleName || 'Vətəndaş'
            ),
          };
          return {
            ...l,
            players: {
              ...l.players,
              [userId]: updatedPlayer,
            },
          };
        });
        lobby = inMemoryLobbyStore.getLobby(lobbyId) || lobby;
      }
    } else if (action === 'KICK_PLAYER') {
      const targetUserId = String(body.targetUserId);
      if (lobby && lobby.hostUserId === userId) {
         inMemoryLobbyStore.removePlayer(lobbyId, targetUserId);
         lobby = inMemoryLobbyStore.getLobby(lobbyId) || lobby;
      }
    } else if (action === 'REMOVE_BOT') {
      const botUserId = String(body.botUserId);
      if (lobby && lobby.players[botUserId]?.isAiBotControlled) {
        inMemoryLobbyStore.removePlayer(lobbyId, botUserId);
        lobby = inMemoryLobbyStore.getLobby(lobbyId) || lobby;
      }

    } else if (action === 'START_GAME' || (action === 'OVERRIDE_PHASE' && lobby?.phase === 'LOBBY')) {
      if (!lobby) lobby = getOrCreateLobby(lobbyId);
      lobby = distributeSecretRoles(lobby);
      const currentPlayers = lobby.players;
      inMemoryLobbyStore.updateLobby(lobbyId, (l) => ({
        ...l,
        players: currentPlayers,
        winnerResult: null,
        latestNewspaper: null,
        privateInvestigations: {},
      }));

      const nextPhase = (body.nextPhase as any) || (lobby.mode === 'ALL_IN' ? 'DAY_REGIONAL_CAUCUS' : 'NIGHT_BUFFER');
      const duration = Number(body.durationSeconds) || 60;
      inMemoryLobbyStore.transitionPhase(lobbyId, nextPhase, duration);

      if (nextPhase === 'NIGHT_BUFFER') {
        await botTakeoverController.executeAllBotActions(lobbyId);
      }
      lobby = inMemoryLobbyStore.getLobby(lobbyId) || lobby;

    } else if (action === 'RESTART_GAME') {
      // Re-initialize all players to alive and return room to LOBBY
      const revivedPlayers: Record<string, PlayerSession> = {};
      for (const [id, p] of Object.entries(lobby.players)) {
        revivedPlayers[id] = {
          ...p,
          isAlive: true,
          displayRole: formatRoleDisplay(p.username, 'Pending', 'Gözləmədə'),
          allInIdentity: undefined,
        };
      }
      inMemoryLobbyStore.updateLobby(lobbyId, (l) => ({
        ...l,
        phase: 'LOBBY',
        players: revivedPlayers,
        roundNumber: 0,
        lastLynchedUserId: null,
        bufferedNightActions: [],
        liveVotes: {},
        latestNewspaper: null,
        privateInvestigations: {},
        winnerResult: null,
        phaseEndsAt: null,
        phaseTimeRemaining: 300,
        hostReady: false,
      }));
      lobby = inMemoryLobbyStore.getLobby(lobbyId) || lobby;

    } else if (action === 'READY') {
      const readyVal = Boolean(body.ready);
      inMemoryLobbyStore.updateLobby(lobbyId, (l) => ({
        ...l,
        hostReady: readyVal,
      }));
      lobby = inMemoryLobbyStore.getLobby(lobbyId) || lobby;

    } else if (action === 'VOTE') {
      const solitaryInmates = new Set(lobby.minigameSubStates?.stanfordPrison?.solitaryConfinementPlayerIds ?? []);
      if (solitaryInmates.has(userId)) {
        return NextResponse.json(
          { success: false, error: 'IN_SOLITARY_CONFINEMENT' },
          { status: 403, headers: corsHeaders }
        );
      }
      const candidateId = String(body.candidateId);
      inMemoryLobbyStore.castVote(lobbyId, userId, candidateId);
      await botTakeoverController.executeAllBotActions(lobbyId);
      lobby = inMemoryLobbyStore.getLobby(lobbyId) || lobby;

      const alivePlayers = Object.values(lobby.players).filter(p => p.isAlive && !solitaryInmates.has(p.userId));
      const votedCount = Object.keys(lobby.liveVotes).length;
      if (votedCount >= alivePlayers.length && alivePlayers.length > 0) {
        lobby = await progressLobbyPhase(lobbyId);
      }

    } else if (action === 'EMOTE') {
      const emote = String(body.emote || '👍').substring(0, 10);
      inMemoryLobbyStore.addEmote(lobbyId, userId, emote);
      lobby = inMemoryLobbyStore.getLobby(lobbyId) || lobby;

    } else if (action === 'RETRACT_VOTE') {
      inMemoryLobbyStore.retractVote(lobbyId, userId);
      lobby = inMemoryLobbyStore.getLobby(lobbyId) || lobby;

    } else if (action === 'NIGHT_ACTION') {
      const targetPlayerId = String(body.targetPlayerId);
      const actionType = body.actionType as NightActionType;

      const priorityMap: Record<NightActionType, NightActionPriority> = {
        TIME_WARP: 0,
        BLOCK: 1,
        MISDIRECT: 2,
        PROTECT: 3,
        KILL: 4,
        FRAME: 5,
        INVESTIGATE: 6,
        RESURRECT: 7,
      };
      const priority = priorityMap[actionType] || 4;

      inMemoryLobbyStore.bufferNightAction(lobbyId, {
        actorPlayerId: userId,
        targetPlayerId,
        actionType,
        priority,
        timestamp: Date.now(),
      });

      // Ensure all living bots also submit night actions
      await botTakeoverController.executeAllBotActions(lobbyId);
      lobby = inMemoryLobbyStore.getLobby(lobbyId) || lobby;

      // Check if all living night actors have submitted actions: auto-advance early if so!
      const alivePlayers = Object.values(lobby.players).filter(p => p.isAlive);
      const activeNightActors = alivePlayers.filter(p => {
        const f = p.allInIdentity?.layer1Faction;
        const off = p.allInIdentity?.layer2Office;
        return (
          f === 'MAFIA' ||
          f === 'YAKUZA' ||
          f === 'VOID_CULT' ||
          f === 'NEUTRAL_KILLER' ||
          off === 'CITY_SURGEON' ||
          off === 'CITY_INVESTIGATOR' ||
          off === 'POLICE_COMMISSIONER' ||
          off === 'CHIEF_FIRE_MARSHAL' ||
          off === 'PRISON_WARDEN' ||
          off === 'BLACK_MARKET_BROKER'
        );
      });
      const actedSet = new Set(lobby.bufferedNightActions.map(a => a.actorPlayerId));
      const allActed = activeNightActors.length > 0 && activeNightActors.every(a => actedSet.has(a.userId));

      if (allActed && lobby.phase === 'NIGHT_BUFFER') {
        lobby = await progressLobbyPhase(lobbyId);
      }

    } else if (action === 'PROGRESS_PHASE' || action === 'OVERRIDE_PHASE') {
      lobby = await progressLobbyPhase(lobbyId);

    } else if (action === 'SEND_MESSAGE') {
      const content = String(body.content || '').trim().slice(0, 300);
      let channel = String(body.channel || 'LOBBY') as any;
      
      const p = lobby?.players[userId];
      const isSpectator = Boolean(lobby?.spectators?.[userId]) || (!p && userId !== lobby?.hostUserId);

      if (isSpectator) {
        // Spectators can only talk in DEAD channel
        channel = 'DEAD';
      } else if (p && !p.isAlive) {
        // Dead players can only talk in DEAD channel
        channel = 'DEAD';
      } else if (p && p.isAlive && channel === 'DEAD') {
        // Living players cannot send to DEAD channel
        return NextResponse.json(
          { success: false, error: 'LIVING_PLAYERS_CANNOT_TALK_IN_DEAD_CHAT' },
          { status: 403, headers: corsHeaders }
        );
      }

      if (content) {
        const senderName = String(
          body.username ||
          (isSpectator
            ? lobby?.spectators?.[userId]?.username || 'Müşahidəçi'
            : p?.username || 'Anon')
        );

        inMemoryLobbyStore.addChatMessage(lobbyId, {
          id: Math.random().toString(36).substring(2, 9),
          senderId: userId,
          senderName,
          content,
          channel,
          timestamp: Date.now(),
          isSpectator: isSpectator || undefined,
        });
      }
      lobby = inMemoryLobbyStore.getLobby(lobbyId) || lobby;

    } else if (action === 'SUBMIT_LAST_WILL') {
      const text = String(body.text || '');
      inMemoryLobbyStore.updateLobby(lobbyId, (l) => {
        if (!l.players[userId]) return l;
        return {
          ...l,
          players: {
            ...l.players,
            [userId]: {
              ...l.players[userId],
              lastWill: text,
            },
          },
        };
      });
    } else if (action === 'DUAL_UNLOCK') {
      const role = body.role === 'THE_ARCHITECT' ? 'THE_ARCHITECT' : 'THE_BAILIFF';
      const unlockRes = inMemoryLobbyStore.submitAdminUnlock(lobbyId, userId, role);
      if (unlockRes.lobby) lobby = unlockRes.lobby;
    } else if (action === 'KLAATU_FREEZE') {
      if (lobby && lobby.minigameSubStates?.earthStoodStill && !lobby.minigameSubStates.earthStoodStill.worldFrozenUsed) {
        inMemoryLobbyStore.updateLobby(lobbyId, (l) => ({
          ...l,
          minigameSubStates: {
            ...l.minigameSubStates,
            earthStoodStill: {
              ...l.minigameSubStates.earthStoodStill!,
              worldFrozenActive: true,
              worldFrozenUsed: true,
            },
          },
        }));
        lobby = inMemoryLobbyStore.getLobby(lobbyId) || lobby;
      }
    } else if (action === 'PASS_BRIEFCASE') {
      const targetUserId = String(body.targetUserId || '');
      if (lobby && lobby.minigameSubStates?.valkyrie && targetUserId) {
        inMemoryLobbyStore.updateLobby(lobbyId, (l) => ({
          ...l,
          minigameSubStates: {
            ...l.minigameSubStates,
            valkyrie: {
              ...l.minigameSubStates.valkyrie!,
              briefcaseLocationPlayerId: targetUserId,
            },
          },
        }));
        lobby = inMemoryLobbyStore.getLobby(lobbyId) || lobby;
      }
    } else if (action === 'MAYOR_REVEAL') {
      const player = lobby.players[userId];
      if (!player || !player.isAlive) {
        return NextResponse.json(
          { success: false, error: 'PLAYER_NOT_ALIVE_OR_FOUND' },
          { status: 400, headers: corsHeaders }
        );
      }
      if (!isMayor(player)) {
        return NextResponse.json(
          { success: false, error: 'NOT_A_MAYOR' },
          { status: 403, headers: corsHeaders }
        );
      }
      const revealRes = executeMayorReveal(lobby, userId);
      if (revealRes.success) {
        inMemoryLobbyStore.updateLobby(lobbyId, () => revealRes.updatedLobby);
        lobby = inMemoryLobbyStore.getLobby(lobbyId) || revealRes.updatedLobby;
      } else {
        return NextResponse.json(
          { success: false, error: revealRes.error },
          { status: 400, headers: corsHeaders }
        );
      }
    } else if (action === 'CAST_VERDICT_VOTE' || (action === 'VOTE' && lobby?.phase === 'TRIAL_DEFENSE')) {
      const solitaryInmates = new Set(lobby.minigameSubStates?.stanfordPrison?.solitaryConfinementPlayerIds ?? []);
      if (solitaryInmates.has(userId)) {
        return NextResponse.json(
          { success: false, error: 'IN_SOLITARY_CONFINEMENT' },
          { status: 403, headers: corsHeaders }
        );
      }
      if (lobby.phase !== 'TRIAL_DEFENSE') {
        return NextResponse.json(
          { success: false, error: 'INVALID_PHASE' },
          { status: 400, headers: corsHeaders }
        );
      }
      const rawVote = String(body.verdict || body.vote || body.candidateId || '').toUpperCase();
      if (rawVote !== 'GUILTY' && rawVote !== 'INNOCENT') {
        return NextResponse.json(
          { success: false, error: 'INVALID_VERDICT_VALUE' },
          { status: 400, headers: corsHeaders }
        );
      }
      const verdictRes = castVerdictVote(lobby, userId, rawVote as 'GUILTY' | 'INNOCENT');
      if (!verdictRes.success) {
        return NextResponse.json(
          { success: false, error: verdictRes.error },
          { status: 400, headers: corsHeaders }
        );
      }
      inMemoryLobbyStore.updateLobby(lobbyId, () => verdictRes.updatedLobby);
      lobby = inMemoryLobbyStore.getLobby(lobbyId) || verdictRes.updatedLobby;

      if (lobby) {
        const accusedId = lobby.accusedPlayerId;
        const livingEligibleVoters = Object.values(lobby.players).filter(
          p => p.isAlive && p.userId !== accusedId && !solitaryInmates.has(p.userId)
        );
        const voteCount = Object.keys(lobby.trialVerdictVotes || {}).length;
        if (voteCount >= livingEligibleVoters.length && livingEligibleVoters.length > 0) {
          lobby = await progressLobbyPhase(lobbyId);
        }
      }
    } else if (action === 'PRISON_SANCTION') {
      const targetPlayerId = String(body.targetPlayerId || body.targetUserId || '');
      const sanctionRes = executePrisonSanction(lobby, userId, targetPlayerId);
      if (!sanctionRes.success) {
        return NextResponse.json(
          { success: false, error: sanctionRes.error },
          { status: sanctionRes.error === 'NOT_A_GUARD' || sanctionRes.error === 'GUARD_ONLY_ACTION' ? 403 : 400, headers: corsHeaders }
        );
      }
      inMemoryLobbyStore.updateLobby(lobbyId, () => sanctionRes.updatedLobby);
      lobby = inMemoryLobbyStore.getLobby(lobbyId) || sanctionRes.updatedLobby;

      if (sanctionRes.riotTriggered) {
        const win = evaluateWinCondition(lobby);
        if (win.kind !== 'GAME_CONTINUES') {
          inMemoryLobbyStore.updateLobby(lobbyId, (l) => ({ ...l, winnerResult: win }));
          inMemoryLobbyStore.transitionPhase(lobbyId, 'ENDED', 0);
          lobby = inMemoryLobbyStore.getLobby(lobbyId) || lobby;
        }
      }
    } else if (action === 'PRISON_SOLITARY') {
      const targetPlayerId = String(body.targetPlayerId || body.targetUserId || '');
      const solitaryRes = executePrisonSolitary(lobby, userId, targetPlayerId);
      if (!solitaryRes.success) {
        return NextResponse.json(
          { success: false, error: solitaryRes.error },
          { status: solitaryRes.error === 'NOT_A_GUARD_OR_WARDEN' ? 403 : 400, headers: corsHeaders }
        );
      }
      inMemoryLobbyStore.updateLobby(lobbyId, () => solitaryRes.updatedLobby);
      lobby = inMemoryLobbyStore.getLobby(lobbyId) || solitaryRes.updatedLobby;
    } else if (action === 'CHERNOBYL_SHELTER') {
      if (!lobby.minigameSubStates?.chernobyl) {
        return NextResponse.json(
          { success: false, error: 'CHERNOBYL_NOT_ACTIVE' },
          { status: 400, headers: corsHeaders }
        );
      }
      const player = lobby.players[userId];
      if (!player || !player.isAlive) {
        return NextResponse.json(
          { success: false, error: 'PLAYER_NOT_ALIVE_OR_FOUND' },
          { status: 400, headers: corsHeaders }
        );
      }

      const chernobyl = lobby.minigameSubStates.chernobyl;
      const currentSheltered = chernobyl.shelteredPlayerIds || [];
      const isLeaving = Boolean(body.leave);

      if (isLeaving) {
        const updatedSheltered = currentSheltered.filter(id => id !== userId);
        inMemoryLobbyStore.updateLobby(lobbyId, (l) => ({
          ...l,
          minigameSubStates: {
            ...l.minigameSubStates,
            chernobyl: {
              ...l.minigameSubStates.chernobyl!,
              shelteredPlayerIds: updatedSheltered,
            },
          },
        }));
        lobby = inMemoryLobbyStore.getLobby(lobbyId) || lobby;
      } else {
        if (currentSheltered.includes(userId)) {
          // Idempotent
        } else if (currentSheltered.length >= chernobyl.bunkerCapacity) {
          return NextResponse.json(
            { success: false, error: 'BUNKER_CAPACITY_FULL', capacity: chernobyl.bunkerCapacity },
            { status: 400, headers: corsHeaders }
          );
        } else {
          const updatedSheltered = [...currentSheltered, userId];
          inMemoryLobbyStore.updateLobby(lobbyId, (l) => ({
            ...l,
            minigameSubStates: {
              ...l.minigameSubStates,
              chernobyl: {
                ...l.minigameSubStates.chernobyl!,
                shelteredPlayerIds: updatedSheltered,
              },
            },
          }));
          lobby = inMemoryLobbyStore.getLobby(lobbyId) || lobby;
        }
      }
    } else if (action === 'CHERNOBYL_DECONTAMINATE') {
      if (!lobby.minigameSubStates?.chernobyl) {
        return NextResponse.json(
          { success: false, error: 'CHERNOBYL_NOT_ACTIVE' },
          { status: 400, headers: corsHeaders }
        );
      }
      const actor = lobby.players[userId];
      if (!actor || !actor.isAlive) {
        return NextResponse.json(
          { success: false, error: 'PLAYER_NOT_ALIVE_OR_FOUND' },
          { status: 400, headers: corsHeaders }
        );
      }

      const chernobyl = lobby.minigameSubStates.chernobyl;
      const isLiquidator =
        chernobyl.liquidatorPlayerId === userId ||
        actor.displayRole?.originalRoleName === 'Doctor' ||
        actor.displayRole?.localizedRoleName?.toLowerCase().includes('likvidator') ||
        actor.displayRole?.localizedRoleName?.toLowerCase().includes('həkim') ||
        actor.displayRole?.localizedRoleName?.toLowerCase().includes('dozimetrist');

      if (!isLiquidator) {
        return NextResponse.json(
          { success: false, error: 'NOT_AUTHORIZED_AS_LIQUIDATOR' },
          { status: 403, headers: corsHeaders }
        );
      }

      const targetPlayerId = String(body.targetPlayerId || body.targetUserId || '');
      const targetPlayer = lobby.players[targetPlayerId];
      if (!targetPlayer || !targetPlayer.isAlive) {
        return NextResponse.json(
          { success: false, error: 'TARGET_NOT_ALIVE_OR_FOUND' },
          { status: 400, headers: corsHeaders }
        );
      }

      const currentDecon = chernobyl.decontaminatedPlayerIds || [];
      const updatedDecon = currentDecon.includes(targetPlayerId)
        ? currentDecon
        : [...currentDecon, targetPlayerId];

      inMemoryLobbyStore.updateLobby(lobbyId, (l) => {
        const cur = l.minigameSubStates.chernobyl!;
        return {
          ...l,
          minigameSubStates: {
            ...l.minigameSubStates,
            chernobyl: {
              ...cur,
              decontaminatedPlayerIds: updatedDecon,
            },
          },
        };
      });
      lobby = inMemoryLobbyStore.getLobby(lobbyId) || lobby;
    }

    const scrubbed = buildScrubbedLobbyView(lobby, userId);
    const safeLobby = sanitizeLobbyForViewer(lobby, userId);

    return NextResponse.json(
      { success: true, lobby: scrubbed, rawLobby: safeLobby },
      { headers: corsHeaders }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[lobby/POST] lobbyId=${lobbyId} error:`, msg);
    return NextResponse.json(
      { success: false, error: 'ACTION_FAILED', detail: msg },
      { status: 500, headers: corsHeaders }
    );
  }
}
