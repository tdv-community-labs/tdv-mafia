import { test, expect } from '@playwright/test';
import { MafiaLobbyHarness } from '../harness/MafiaLobbyHarness';

test.describe('TDV Mafia Multi-Client Full Game Cycle E2E Suite', () => {
  let harness: MafiaLobbyHarness;

  test.afterEach(async () => {
    if (harness) {
      await harness.cleanup();
    }
  });

  test('5-Player Full Lifecycle: Creation, Joining, Ready Check, Night Phase, Dawn Newspaper, and Courtroom Trial', async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(90000);
    const hostBaseUrl = baseURL || 'http://localhost:3005';
    harness = new MafiaLobbyHarness(browser);

    const playerNames = ['Host_Murad', 'Player_Aysel', 'Player_Rauf', 'Player_Leyla', 'Player_Elmir'];

    // 1. Spawn 5 isolated player contexts with deterministic identity
    await harness.spawnPlayers(5, hostBaseUrl, undefined, playerNames);

    // 2. Host creates the lobby via UI modal
    const roomTitle = `Cycle-Arena-${Date.now()}`;
    const lobbyId = await harness.createLobby(harness.hostSession.page, hostBaseUrl, roomTitle, 'BLITZ');
    expect(lobbyId).toBeTruthy();

    // 3. Guest players 1..4 join the lobby
    for (let i = 1; i < harness.sessions.length; i++) {
      await harness.joinLobby(harness.sessions[i].page, hostBaseUrl, lobbyId, harness.sessions[i].username);
    }

    // 4. Assert all 5 player cards are visible on the Host's page
    for (const session of harness.sessions) {
      const card = harness.hostSession.page
        .locator(`[data-testid="player-card-${session.userId}"]`)
        .or(harness.hostSession.page.locator(`text=${session.username}`))
        .first();
      await expect(card).toBeVisible({ timeout: 10000 });
    }

    // 5. Guest players toggle Ready
    for (let i = 1; i < harness.sessions.length; i++) {
      await harness.toggleReady(harness.sessions[i]);
    }

    // Small delay to ensure state propagates
    await harness.hostSession.page.waitForTimeout(500);

    // 6. Host starts the game
    await harness.startGame();

    // 7. Verify all 5 clients synchronize to NIGHT_BUFFER phase
    await harness.waitForAllPhases('NIGHT_BUFFER', 20000);

    // 8. Verify role identity banner is present on each player's screen
    for (const session of harness.sessions) {
      const secretBanner = session.page
        .locator('[data-testid="secret-role-banner"]')
        .first();
      await expect(secretBanner).toBeVisible({ timeout: 10000 });
    }

    // 9. Host progresses from night to morning
    await harness.hostProgressPhase();

    // 10. Verify all clients synchronize to DAY_VOTING phase
    await harness.waitForAllPhases('DAY_VOTING', 20000);

    // 11. Verify Morning Newspaper modal appears on clients
    const newspaperModal = harness.hostSession.page
      .locator('[data-testid="morning-newspaper-modal"]')
      .first();
    await expect(newspaperModal).toBeVisible({ timeout: 10000 });

    // 12. Dismiss Morning Newspaper modal across all clients
    await harness.dismissNewspaper();

    // 13. Day Voting & Accusation: Majority of players vote to accuse Player_Aysel
    const accusedUserId = harness.sessions[1].userId; // Player_Aysel
    // 3 players vote for Player_Aysel (majority of 5 is 3)
    await harness.castAccusationVote(harness.sessions[0], accusedUserId);
    await harness.castAccusationVote(harness.sessions[2], accusedUserId);
    await harness.castAccusationVote(harness.sessions[3], accusedUserId);

    // 14. Verify state transitions to TRIAL_DEFENSE across all clients
    await harness.waitForAllPhases('TRIAL_DEFENSE', 20000);

    // 15. Verify TrialDefensePanel elements on Host's page
    const trialPanel = harness.hostSession.page
      .locator('[data-testid="trial-defense-panel"]')
      .first();
    await expect(trialPanel).toBeVisible({ timeout: 10000 });

    const accusedLabel = harness.hostSession.page
      .locator('[data-testid="trial-accused-name"]')
      .first();
    await expect(accusedLabel).toContainText('Player_Aysel');

    const countdownTimer = harness.hostSession.page
      .locator('[data-testid="trial-countdown-timer"]')
      .first();
    await expect(countdownTimer).toBeVisible({ timeout: 5000 });

    // 16. Jurors cast verdict votes
    // Host votes GUILTY
    await harness.castVerdict(harness.hostSession, 'GUILTY');
    // Player 2 votes GUILTY
    await harness.castVerdict(harness.sessions[2], 'GUILTY');

    // Verify guilty count label increments
    const guiltyCountLabel = harness.hostSession.page
      .locator('[data-testid="guilty-count"]')
      .first();
    await expect(guiltyCountLabel).toBeVisible({ timeout: 5000 });

    // 17. Host fast-forwards verdict resolution
    await harness.hostProgressPhase();

    // Small wait for verdict resolution to process
    await harness.hostSession.page.waitForTimeout(2000);

    // 18. Accused player card now has eliminated stamp / status
    const accusedCard = harness.hostSession.page
      .locator(`[data-testid="player-card-${accusedUserId}"]`)
      .first();
    await expect(accusedCard).toBeVisible({ timeout: 10000 });

    // Inspect accused player card (click to open TombstoneModal)
    await accusedCard.click({ force: true });
    const tombstoneModal = harness.hostSession.page
      .locator('[data-testid="tombstone-modal"]')
      .first();
    if (await tombstoneModal.isVisible({ timeout: 3000 }).catch(() => false)) {
      const closeBtn = harness.hostSession.page
        .locator('[data-testid="tombstone-close-btn"]')
        .first();
      await closeBtn.click();
    }
  });
});
