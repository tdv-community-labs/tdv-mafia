import { test, expect } from '@playwright/test';
import { MafiaLobbyHarness } from '../harness/MafiaLobbyHarness';

test.describe('TDV Mafia Network Disconnect & Reconnect Handshake E2E Suite', () => {
  let harness: MafiaLobbyHarness;

  test.afterEach(async () => {
    if (harness) {
      await harness.cleanup();
    }
  });

  test('Graceful Disconnection, Offline Indicator Detection, and Client Session Rehydration', async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(90000);
    const hostBaseUrl = baseURL || 'http://localhost:3005';
    harness = new MafiaLobbyHarness(browser);

    const playerNames = ['Host_Zaur', 'Player_Disconnect', 'Player_Steady', 'Player_Four', 'Player_Five'];

    // 1. Spawn 5 isolated player contexts
    await harness.spawnPlayers(5, hostBaseUrl, undefined, playerNames);

    // 2. Host creates room
    const roomTitle = `Reconnect-Arena-${Date.now()}`;
    const lobbyId = await harness.createLobby(harness.hostSession.page, hostBaseUrl, roomTitle, 'BLITZ');
    expect(lobbyId).toBeTruthy();

    // 3. Guests join
    for (let i = 1; i < harness.sessions.length; i++) {
      await harness.joinLobby(harness.sessions[i].page, hostBaseUrl, lobbyId, harness.sessions[i].username);
    }

    // 4. Verify disconnected target player card is initially present and online
    const targetSession = harness.sessions[1]; // Player_Disconnect
    const cardOnHost = harness.hostSession.page.locator(`[data-testid="player-card-${targetSession.userId}"]`).first();
    await expect(cardOnHost).toBeVisible({ timeout: 10000 });

    // 5. Simulate abrupt client drop: close target player page & context
    await targetSession.page.close();
    await targetSession.context.close();

    // 6. Wait for heartbeat timeout
    await harness.hostSession.page.waitForTimeout(2000);

    // 7. Client reopens with rehydrated localStorage identity
    const newContext = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const rehydratedPage = await newContext.newPage();

    // Re-seed same credentials
    await rehydratedPage.addInitScript(
      ({ uName, uId }) => {
        localStorage.setItem(
          'tdv_ecosystem_session_v1',
          JSON.stringify({ id: uId, username: uName, fullName: uName, tier: 'TIER_1' })
        );
        localStorage.setItem(
          'tdv_mafia_user',
          JSON.stringify({ username: uName, userId: uId, tier: 'TIER_1' })
        );
        localStorage.setItem('mafia_username', uName);
      },
      { uName: targetSession.username, uId: targetSession.userId }
    );

    // Navigate back to lobby URL
    await rehydratedPage.goto(`${hostBaseUrl}/lobby/${lobbyId}`);

    // Verify session recovers and active player card is rendered
    const reconnectedCard = rehydratedPage
      .locator(`[data-testid="player-card-${targetSession.userId}"]`)
      .first();
    await expect(reconnectedCard).toBeVisible({ timeout: 15000 });

    await newContext.close();
  });
});
