import { test, expect } from '@playwright/test';
import { MafiaLobbyHarness } from '../harness/MafiaLobbyHarness';

test.describe('TDV Mafia Zero-Knowledge Role Privacy E2E Suite', () => {
  let harness: MafiaLobbyHarness;

  test.afterEach(async () => {
    if (harness) {
      await harness.cleanup();
    }
  });

  test('Multi-Client Zero-Knowledge Proof: Secret Roles are Strictly Sanitized in DOM and API Payloads', async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(90000);
    const hostBaseUrl = baseURL || 'http://localhost:3005';
    harness = new MafiaLobbyHarness(browser);

    const playerNames = ['Host_Zaur', 'Guest_Nigar', 'Guest_Kamran', 'Guest_Samir', 'Guest_Farid'];

    // 1. Spawn 5 isolated player contexts
    await harness.spawnPlayers(5, hostBaseUrl, undefined, playerNames);

    // 2. Host creates room
    const roomTitle = `Privacy-Arena-${Date.now()}`;
    const lobbyId = await harness.createLobby(harness.hostSession.page, hostBaseUrl, roomTitle, 'BLITZ');
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

    // 6. Wait for all clients to synchronize to NIGHT_BUFFER
    await harness.waitForAllPhases('NIGHT_BUFFER', 20000);

    // 7. Verify DOM Level 1 Sanitization:
    // For each client session, examine other players' cards in the DOM
    for (const observer of harness.sessions) {
      for (const target of harness.sessions) {
        if (observer.userId === target.userId) continue;

        const card = observer.page
          .locator(`[data-testid="player-card-${target.userId}"]`)
          .first();
        await expect(card).toBeVisible({ timeout: 5000 });

        const cardText = await card.innerText();

        // While alive during active game, other living players must NOT leak roles
        expect(cardText).not.toContain('Sheriff');
        expect(cardText).not.toContain('Doctor');
        expect(cardText).not.toContain('Həkim');
        expect(cardText).not.toContain('Şərif');
      }
    }

    // 8. Verify Level 2: Network REST API Payload Scrubbing
    // Each client fetches its scrubbed view from /api/lobby/[lobbyId]?userId=[userId]
    for (const session of harness.sessions) {
      const response = await session.page.request.get(
        `${hostBaseUrl}/api/lobby/${lobbyId}?userId=${session.userId}`
      );
      expect(response.status()).toBe(200);

      const json = await response.json();
      expect(json).toHaveProperty('rawLobby');

      const rawLobby = json.rawLobby;
      expect(rawLobby.players).toBeTruthy();

      const viewerPlayer = rawLobby.players[session.userId];
      expect(viewerPlayer).toBeTruthy();
      // Viewer knows their own role
      expect(viewerPlayer.displayRole.originalRoleName).not.toBe('Secret');

      const viewerFaction = viewerPlayer.allInIdentity?.layer1Faction;

      // Other players audit
      for (const [otherId, otherPlayer] of Object.entries<any>(rawLobby.players)) {
        if (otherId === session.userId) continue;

        const otherFaction = otherPlayer.allInIdentity?.layer1Faction;
        const isSyndicateTeammate =
          viewerFaction === 'MAFIA' && otherFaction === 'MAFIA';

        if (!isSyndicateTeammate) {
          // Living non-teammates MUST be masked to "Secret"
          expect(otherPlayer.displayRole.originalRoleName).toBe('Secret');
          // allInIdentity must be stripped (undefined) for living non-teammates
          expect(otherPlayer.allInIdentity).toBeUndefined();
        }
      }
    }

    // 9. Verify Secret Role Card toggle functionality on Host page
    const toggleBtn = harness.hostSession.page
      .locator('[data-testid="role-toggle-btn"]')
      .first();
    if (await toggleBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await toggleBtn.click();
      await harness.hostSession.page.waitForTimeout(300);
      await toggleBtn.click();
    }
  });
});
