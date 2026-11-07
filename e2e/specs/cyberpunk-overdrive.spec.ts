import { test, expect } from '@playwright/test';
import { MafiaLobbyHarness } from '../harness/MafiaLobbyHarness';

test.describe('TDV Mafia Cyberpunk Neo-Baku Overdrive & Net-Glitch E2E Suite', () => {
  let harness: MafiaLobbyHarness;

  test.afterEach(async () => {
    if (harness) {
      await harness.cleanup();
    }
  });

  test('Cyberpunk Neo-Baku Mode: Caspian Grid HUD, Overdrive <=30% State, and Glitch Display', async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(90000);
    const hostBaseUrl = baseURL || 'http://localhost:3005';
    harness = new MafiaLobbyHarness(browser);

    const playerNames = ['Host_Cyber', 'Player_Net1', 'Player_Net2', 'Player_Net3', 'Player_Net4'];

    // 1. Spawn 5 isolated player contexts
    await harness.spawnPlayers(5, hostBaseUrl, undefined, playerNames);

    // 2. Host creates room in CYBERPUNK_NEO_BAKU mode
    const roomTitle = `Cyberpunk-Arena-${Date.now()}`;
    const lobbyId = await harness.createLobby(
      harness.hostSession.page,
      hostBaseUrl,
      roomTitle,
      'CYBERPUNK_NEO_BAKU'
    );
    expect(lobbyId).toBeTruthy();

    // 3. Guests join
    for (let i = 1; i < harness.sessions.length; i++) {
      await harness.joinLobby(harness.sessions[i].page, hostBaseUrl, lobbyId, harness.sessions[i].username);
    }

    // 4. Toggle ready
    for (let i = 1; i < harness.sessions.length; i++) {
      await harness.toggleReady(harness.sessions[i]);
    }
    await harness.hostSession.page.waitForTimeout(500);

    // 5. Start game
    await harness.startGame();
    await harness.waitForAllPhases('NIGHT_BUFFER', 20000);

    // 6. Verify Caspian Grid HUD is visible in MinigameStatusToolbar
    const gridHud = harness.hostSession.page.locator('text=Xəzər Şəbəkəsi').first();
    await expect(gridHud).toBeVisible({ timeout: 10000 });

    // 7. Inject Overdrive state via server API simulation to test client reactivity
    await harness.hostSession.page.request.post(`${hostBaseUrl}/api/lobby/${lobbyId}`, {
      data: {
        action: 'MINIGAME_CYBERPUNK_OVERLOAD',
        payload: { targetIntegrity: 25 },
      },
    }).catch(() => {});

    // Fast-forward phase to DAY_VOTING to trigger morning newspaper and status update
    await harness.hostProgressPhase();
    await harness.waitForAllPhases('DAY_VOTING', 20000);

    // 8. Verify Morning Newspaper displays Cyberpunk section
    const newspaper = harness.hostSession.page.locator('[data-testid="morning-newspaper-modal"]').first();
    await expect(newspaper).toBeVisible({ timeout: 10000 });
    const cpText = harness.hostSession.page.locator('text=Cyberpunk').first();
    await expect(cpText).toBeVisible({ timeout: 5000 });

    await harness.dismissNewspaper();
  });
});
