import { Browser, BrowserContext, Page, expect, Locator } from '@playwright/test';

export interface PlayerClientSession {
  readonly playerIndex: number;
  readonly userId: string;
  readonly username: string;
  readonly context: BrowserContext;
  readonly page: Page;
}

export class MafiaLobbyHarness {
  public browser: Browser;
  public sessions: PlayerClientSession[] = [];
  public hostSession!: PlayerClientSession;
  public lobbyId: string = '';

  constructor(browser: Browser) {
    this.browser = browser;
  }

  /**
   * Spawns N parallel isolated browser contexts with pre-seeded deterministic identity.
   */
  async spawnPlayers(
    count: number,
    baseUrl: string,
    lobbyId?: string,
    customNames?: string[]
  ): Promise<void> {
    if (lobbyId) {
      this.lobbyId = lobbyId;
    }

    for (let i = 0; i < count; i++) {
      const username = customNames?.[i] ?? (i === 0 ? 'Player_Host' : `Player_${i}`);
      const userId = `usr-${username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

      const context = await this.browser.newContext({
        viewport: { width: 1280, height: 720 },
        storageState: undefined,
      });

      const page = await context.newPage();

      // Pre-seed deterministic identity in localStorage before navigation
      await page.addInitScript(
        ({ uName, uId }) => {
          const sessionPayload = {
            id: uId,
            username: uName,
            fullName: uName,
            tier: 'TIER_1',
          };
          localStorage.setItem('tdv_ecosystem_session_v1', JSON.stringify(sessionPayload));
          localStorage.setItem(
            'tdv_mafia_user',
            JSON.stringify({
              username: uName,
              userId: uId,
              tier: 'TIER_1',
            })
          );
          localStorage.setItem('mafia_username', uName);
        },
        { uName: username, uId: userId }
      );

      const session: PlayerClientSession = {
        playerIndex: i,
        userId,
        username,
        context,
        page,
      };

      this.sessions.push(session);
      if (i === 0) {
        this.hostSession = session;
      }
    }
  }

  /**
   * Host creates a room through the UI modal from homepage.
   */
  async createLobby(
    hostPage: Page,
    baseUrl: string,
    roomName: string = 'E2E-Arena',
    mode: string = 'BLITZ'
  ): Promise<string> {
    await hostPage.goto(`${baseUrl}/`);

    // Click "Masa Yarat" button
    const createBtn = hostPage
      .locator('[data-testid="home-create-room-btn"]')
      .or(hostPage.getByRole('button', { name: /Masa Yarat/i }))
      .first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click();

    // Fill room name in CreateRoomModal
    const modal = hostPage
      .locator('[data-testid="create-room-modal"]')
      .or(hostPage.locator('div:has-text("Yeni Mafiya Masası Yarat")'))
      .first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    const nameInput = hostPage
      .locator('[data-testid="room-name-input"]')
      .or(hostPage.locator('input[placeholder*="Bakı Gecələri"]'))
      .first();
    await nameInput.fill(roomName);

    // Select mode
    const modeSelect = hostPage
      .locator('[data-testid="game-mode-select"]')
      .or(hostPage.locator('select'))
      .first();
    await modeSelect.selectOption(mode);

    // Launch room
    const launchBtn = hostPage
      .locator('[data-testid="room-launch-btn"]')
      .or(hostPage.getByRole('button', { name: /Masaya Daxil Ol/i }))
      .first();
    await launchBtn.click();

    // Wait for URL redirect to /lobby/[lobbyId]
    await hostPage.waitForURL(/\/lobby\/.+/, { timeout: 15000 });
    const url = hostPage.url();
    const extractedLobbyId = url.split('/lobby/')[1]?.split('?')[0] || '';
    this.lobbyId = decodeURIComponent(extractedLobbyId);

    // Verify LOBBY phase badge
    const phaseBadge = hostPage
      .locator('[data-testid="phase-badge-LOBBY"]')
      .or(hostPage.locator('h1:has-text("Gözləmə Otağı (Lobby)")'))
      .first();
    await expect(phaseBadge).toBeVisible({ timeout: 10000 });

    return this.lobbyId;
  }

  /**
   * Joins a specific player page to the active lobby URL.
   */
  async joinLobby(page: Page, baseUrl: string, lobbyId: string, playerName: string): Promise<void> {
    await page.goto(`${baseUrl}/lobby/${lobbyId}`);

    // Wait until this player's name appears in the lobby
    const playerIndicator = page
      .locator(`[data-testid="player-card-usr-${playerName.toLowerCase().replace(/[^a-z0-9]/g, '')}"]`)
      .or(page.locator(`text=${playerName}`))
      .first();
    await expect(playerIndicator).toBeVisible({ timeout: 15000 });
  }

  /**
   * Toggles ready status for a player session.
   */
  async toggleReady(session: PlayerClientSession): Promise<void> {
    const readyBtn = session.page
      .locator('[data-testid="ready-toggle-btn"]')
      .or(session.page.getByRole('button', { name: /Hazır Ol|Mən Hazıram/i }))
      .first();
    await expect(readyBtn).toBeVisible({ timeout: 10000 });
    await readyBtn.click();
  }

  /**
   * Host starts the game from waiting room.
   */
  async startGame(hostSession?: PlayerClientSession): Promise<void> {
    const host = hostSession || this.hostSession;
    const startBtn = host.page
      .locator('[data-testid="start-game-btn"]')
      .or(host.page.getByRole('button', { name: /Oyunu Başlat|Oyunu İndi Başlat/i }))
      .first();
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await startBtn.click();
  }

  /**
   * Synchronizes all active player sessions on reaching a specific game phase.
   */
  async waitForAllPhases(targetPhase: string, timeoutMs: number = 25000): Promise<void> {
    await Promise.all(
      this.sessions.map(async (s) => {
        const badge = s.page
          .locator(`[data-testid="phase-badge-${targetPhase}"]`)
          .first();
        await expect(badge).toBeVisible({ timeout: timeoutMs });
      })
    );
  }

  /**
   * Dismisses any active intro/role reveal overlay across all sessions if present.
   */
  async dismissIntroOverlays(): Promise<void> {
    await Promise.all(
      this.sessions.map(async (s) => {
        try {
          // If 3D GameIntroOverlay is visible, click to flip and dismiss
          const introCard = s.page
            .locator('[data-testid="game-intro-overlay"]')
            .or(s.page.locator('.cursor-pointer.fixed.inset-0'))
            .first();
          if (await introCard.isVisible({ timeout: 1500 }).catch(() => false)) {
            await introCard.click({ force: true }).catch(() => {});
            await s.page.waitForTimeout(300);
            await introCard.click({ force: true }).catch(() => {});
          }
        } catch {
          // Overlay may auto-dismiss
        }
      })
    );
  }

  /**
   * Cast an accusation vote against a target user.
   */
  async castAccusationVote(voterSession: PlayerClientSession, targetUserId: string): Promise<void> {
    const targetCard = voterSession.page
      .locator(`[data-testid="player-card-${targetUserId}"]`)
      .first();
    await expect(targetCard).toBeVisible({ timeout: 10000 });
    await targetCard.click();

    // Click Vote in VotingCourtPanel or Sticky bar
    const voteBtn = voterSession.page
      .locator('[data-testid="court-vote-btn"]')
      .or(voterSession.page.locator('[data-testid="action-bar-vote-btn"]'))
      .or(voterSession.page.getByRole('button', { name: /^Səs Ver$/i }))
      .first();
    await expect(voteBtn).toBeVisible({ timeout: 5000 });
    await voteBtn.click();
  }

  /**
   * Cast a courtroom verdict vote (GUILTY or INNOCENT).
   */
  async castVerdict(
    jurorSession: PlayerClientSession,
    verdict: 'GUILTY' | 'INNOCENT'
  ): Promise<void> {
    const testId = verdict === 'GUILTY' ? 'verdict-guilty-btn' : 'verdict-innocent-btn';
    const textPattern = verdict === 'GUILTY' ? /GÜNAHKARDIR/i : /TƏQSİRSİZDİR/i;

    const btn = jurorSession.page
      .locator(`[data-testid="${testId}"]`)
      .or(jurorSession.page.getByRole('button', { name: textPattern }))
      .first();
    await expect(btn).toBeVisible({ timeout: 10000 });
    await btn.click();
  }

  /**
   * Perform night action (KILL, PROTECT, INVESTIGATE).
   */
  async performNightAction(
    actorSession: PlayerClientSession,
    targetUserId: string,
    actionType: 'KILL' | 'PROTECT' | 'INVESTIGATE'
  ): Promise<void> {
    const targetCard = actorSession.page
      .locator(`[data-testid="player-card-${targetUserId}"]`)
      .first();
    await expect(targetCard).toBeVisible({ timeout: 10000 });
    await targetCard.click();

    // Verify reticle appears
    const reticle = targetCard
      .locator(`[data-testid="action-reticle-${actionType}"]`)
      .first();
    await expect(reticle).toBeVisible({ timeout: 5000 });

    // Click submit button in sticky bar
    const submitBtn = actorSession.page
      .locator('[data-testid="night-action-submit-btn"]')
      .first();
    await expect(submitBtn).toBeVisible({ timeout: 5000 });
    await submitBtn.click();
  }

  /**
   * Dismiss the dawn newspaper modal across all sessions.
   */
  async dismissNewspaper(): Promise<void> {
    await Promise.all(
      this.sessions.map(async (s) => {
        const modal = s.page.locator('[data-testid="morning-newspaper-modal"]').first();
        if (await modal.isVisible({ timeout: 5000 }).catch(() => false)) {
          const dismissBtn = s.page
            .locator('[data-testid="newspaper-dismiss-btn"]')
            .or(s.page.getByRole('button', { name: /Oxundu & Məhkəməyə Qayıt/i }))
            .first();
          await dismissBtn.click({ force: true }).catch(() => {});
        }
      })
    );
  }

  /**
   * Fast-forward phase via Host override control if needed.
   */
  async hostProgressPhase(hostSession?: PlayerClientSession): Promise<void> {
    const host = hostSession || this.hostSession;
    const progressBtn = host.page
      .locator('[data-testid="host-progress-phase-btn"]')
      .or(host.page.locator('button:has-text("Gecəni Bitir"), button:has-text("Səsləri Hesabla")'))
      .first();
    await expect(progressBtn).toBeVisible({ timeout: 10000 });
    await progressBtn.click();
  }

  /**
   * Zero-Knowledge verification: assert that private roles do NOT leak into unauthorized DOMs.
   */
  async assertZeroKnowledgePrivacy(
    observerPage: Page,
    targetUserId: string,
    isTeammate: boolean = false
  ): Promise<void> {
    const targetCard = observerPage
      .locator(`[data-testid="player-card-${targetUserId}"]`)
      .first();
    await expect(targetCard).toBeVisible({ timeout: 10000 });

    const cardText = await targetCard.innerText();

    if (!isTeammate) {
      // Must not leak private roles like Mafioso, Sheriff, Doctor to non-teammates
      expect(cardText).not.toMatch(/Şərif|Sheriff|Həkim|Doctor/i);
      expect(cardText).not.toMatch(/Mafiya|Mafioso|Yakuza/i);
    }
  }

  /**
   * Clean teardown of all browser contexts.
   */
  async cleanup(): Promise<void> {
    await Promise.all(
      this.sessions.map((s) => s.context.close().catch(() => {}))
    );
    this.sessions = [];
  }
}
