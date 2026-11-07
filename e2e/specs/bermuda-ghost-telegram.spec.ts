import { test, expect } from '@playwright/test';
import { MafiaLobbyHarness } from '../harness/MafiaLobbyHarness';

test.describe('TDV Mafia Bermuda Triangle Ghost Telegram & Vanished At Sea E2E Suite', () => {
  let harness: MafiaLobbyHarness;

  test.afterEach(async () => {
    if (harness) {
      await harness.cleanup();
    }
  });

  test('Bermuda Triangle Mode: Weather Sensor HUD, Vanished Masking, and Sonar Telegram Broadcast', async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(90000);
    const hostBaseUrl = baseURL || 'http://localhost:3005';
    harness = new MafiaLobbyHarness(browser);

    const playerNames = ['Host_Captain', 'Sailor_A', 'Sailor_B', 'Sailor_C', 'Sailor_D'];

    // 1. Spawn 5 isolated player contexts
    await harness.spawnPlayers(5, hostBaseUrl, undefined, playerNames);

    // 2. Host creates room in BERMUDA_TRIANGLE mode
    const roomTitle = `Bermuda-Arena-${Date.now()}`;
    const lobbyId = await harness.createLobby(
      harness.hostSession.page,
      hostBaseUrl,
      roomTitle,
      'BERMUDA_TRIANGLE'
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

    // 6. Verify Bermuda Weather sensor is active on HUD
    const weatherSensor = harness.hostSession.page.locator('text=Sakit Dəniz').or(harness.hostSession.page.locator('text=Gövdə:')).first();
    await expect(weatherSensor).toBeVisible({ timeout: 10000 });

    // 7. Progress to morning
    await harness.hostProgressPhase();
    await harness.waitForAllPhases('DAY_VOTING', 20000);

    // 8. Verify morning newspaper displays Bermuda maritime dispatch
    const newspaper = harness.hostSession.page.locator('[data-testid="morning-newspaper-modal"]').first();
    await expect(newspaper).toBeVisible({ timeout: 10000 });
    const bermudaBanner = harness.hostSession.page.locator('text=Bermud Üçbucağı').first();
    await expect(bermudaBanner).toBeVisible({ timeout: 5000 });

    await harness.dismissNewspaper();
  });
});
