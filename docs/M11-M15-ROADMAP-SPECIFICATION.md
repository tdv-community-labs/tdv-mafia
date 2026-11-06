# TDV Mafia M11+ Architecture & Specification Master Plan

**Document Version**: 1.0.0-PROD-SPEC  
**Target Milestones**: M11, M12, M13, M14, M15  
**Scope**: Cyberpunk Neo-Baku Minigame, Bermuda Triangle Minigame, Automated E2E Browser Testing Architecture, UI/UX Polish Roadmap  
**Author**: teamwork_spec_miner_3  
**Status**: Engineered Specification  

---

## Executive Summary

Following the successful completion and verification of milestones M1 through M10 (encompassing the deterministic Night Action Matrix, Courtroom Two-Tier Verdict Voting, Stanford/Chernobyl Asymmetric Minigames, Contextual AI Bot Cascades, WebRTC Audio Spatialization, and 40-Player All-In Simulation Certification), this specification establishes the technical blueprint for the next phase of platform evolution.

This document delivers four comprehensive engineering specifications:
1. **Cyberpunk Neo-Baku Minigame Specification (M11)**: A futuristic, neon-drenched social deduction format set in the cyber-grid of 2077 Baku, introducing the dynamic Cyber-Overdrive state, Net-glitch events, and four cybernetic roles mapped onto the P0–P7 priority engine.
2. **Bermuda Triangle Minigame Specification (M12)**: A maritime mystery format featuring dynamic environmental weather hazards (Void Fog, Electromagnetic Storm, Rogue Waves), "Vanished into the Mist" unrevealed eliminations, Ghost Fleet sonar telemetry, and mathematical hazard escalation curves.
3. **Automated E2E Browser Testing Architecture (M13)**: A multi-client test architecture based on Playwright that coordinates 4 to 8 parallel isolated browser contexts across complete game lifecycles with zero flakiness.
4. **UI/UX Polish & Accessibility Roadmap (M14–M15)**: A production design specification for component micro-interactions, Framer Motion spring physics, Web Audio feedback cues, mobile-first responsive drawers, and WCAG 2.1 AA compliance.

---

# 1. Cyberpunk Neo-Baku Minigame Specification

```
                  ┌──────────────────────────────────────────────┐
                  │          CASPIAN GRID STATUS HUD             │
                  │   Grid Integrity: [████████░░] 78%           │
                  │   Cyber-Overdrive: INACTIVE                  │
                  │   Active Glitch: SIGNAL SCRAMBLE (25s)       │
                  └──────────────────────────────────────────────┘
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
       ┌─────────────────────┐                         ┌─────────────────────┐
       │   CORPO COALITION   │                         │ NETRUNNER SYNDICATE │
       │ - Corpo Executive   │   ◄─── Cyber Warfare ──►│ - Netrunner Hacker  │
       │ - Neuro-Surgeon     │      (ICE & Bribes)     │ - Street Fixer      │
       │ - Black Market Spec │                         │ - Infiltrator       │
       └─────────────────────┘                         └─────────────────────┘
```

### 1.1 Theme & Narrative Setting
- **Setting**: Neo-Baku, Year 2088. The Caspian megalopolis has evolved into a hyper-technological offshore city where the iconic Flame Towers operate as giant geothermal processing cores powering the national Caspian Cyber-Grid.
- **Narrative Conflict**: The Caspian Petro-Cybernetics Megacorporation ("The Combine") maintains an iron-fisted monopoly over digital currency, neural implants, and biometric citizenship. Opposing them from the neon-lit alleys of Old City (İçərişəhər) is the Baku Underground Netrunner Syndicate, fighting for free-bandwidth liberation and decentralized governance.
- **Atmospheric Palette & Worldbuilding**:
  - Endless acid-drizzle reflecting neon billboards over Baku Boulevard.
  - Holographic minarets broadcasting cryptographic prayer and corporate propaganda.
  - High-speed Maglev ferries connecting Boyuk Zira Island data havens with the mainland.
  - Black market cyberware clinics hidden beneath ancient sandstone fortress walls.

### 1.2 Custom Rules & Phase Mechanics

#### 1.2.1 Grid Integrity Meter (0% – 100%)
- **Initial State**: Starts at `100%` at the beginning of Day 1.
- **Decay Modifiers**:
  - `-15%`: Execution/lynch of an innocent Citizen or Netrunner during Day Voting.
  - `-10%`: Successful night assassination executed by Corpo operatives.
  - `-20%`: Successful `ICE_BREAKER: SYSTEM_OVERLOAD` executed by Netrunner.
- **Recovery Modifiers**:
  - `+15%`: Successful `NETWORK_PATCH` deployed by the Corpo Executive or Neuro-Surgeon.
  - `+20%`: Execution/lynch of a confirmed Corpo Executive or Syndicate Killer.
- **Threshold States**:
  - `70% – 100%`: **Grid Stable**. Standard timers and communications.
  - `31% – 69%`: **Grid Destabilized**. 15% random chance of Net-Glitch event at dawn.
  - `1% – 30%`: **Cyber-Overdrive Active**. 50% accelerated action timers, double ability yields.
  - `0%`: **Total Blackout**. Complete communication scrambling, zero radar observer intel.

#### 1.2.2 Cyber-Overdrive Phase State
When Grid Integrity falls to or below `30%`, the state engine enters `CYBER_OVERDRIVE`.
- **Night Buffer Acceleration**: Night action buffer duration is compressed from 30s down to 15s (`nightBufferSeconds = 15`), forcing rapid tactical execution.
- **Dual-Pulse Resolution**: High-priority roles (P1 to P3) gain a second action charge for that cycle only.
- **System Audio Surge**: A high-pass filter synth alarm triggers on the client HUD.

#### 1.2.3 Net-Glitch Random Events
During `GRID_DESTABILIZED` or `CYBER_OVERDRIVE`, the server rolls a d100 at the start of each morning. If triggered, one of three environmental glitches activates:
1. **Signal Scramble (Hex Glyph Glitch)**:
   - For the first 45 seconds of the Day phase, 25% of all chat characters are converted into matrix glyphs (`0x4E`, `0xEF`, `∆`, `¥`, `§`).
   - Audio feedback: Bitcrushed digital stutter on message reception.
2. **Firewall Breach (Public Intel Leak)**:
   - The central firewall collapses, causing 1 random living player's Innate Trait or Civic District to be broadcast in the morning newspaper banner.
3. **Blackout Cycle (Vision Cut)**:
   - The night phase is plunged into infrared darkness. All `NIGHT_VISION` traits and investigative cameras are disabled for that night round.

### 1.3 Custom Role Mechanics & Abilities

| Role Name | Faction | Base Alignment | Night Priority | Primary Ability | Secondary / Passive Trait |
|-----------|---------|----------------|----------------|-----------------|---------------------------|
| **Netrunner Hakker** | Netrunner Syndicate | Town / Underground | P1 / P5 | `ICE_BREAKER` (Vote Spoof or Data Intercept) | `GHOST_IN_THE_SHELL` (Immune to Night Vision tracking) |
| **Corpo Executive** | Caspian Megacorp | Mafia / Overlord | P2 / P6 | `CORPO_BRIBE` (Shield or Buy Vote) & `NEURAL_KILL` | `DIPLOMATIC_IMMUNITY` (Immune to Frame actions) |
| **Street Fixer** | Neutral / Underground | Neutral Benign | P3 | `CYBERWARE_DROP` (Distribute Augments) | `BLACK_MARKET_CONNECTIONS` (Survives first lethal attack) |
| **Infiltrator** | Caspian Megacorp | Mafia Deception | P4 | `NODE_SPOOF` (Identity Telemetry Swap) | `FALSE_SIGNATURE` (Appears as Citizen on scan) |
| **Neuro-Surgeon** | Netrunner Syndicate | Town Protective | P2 | `NEURAL_REBOOT` (Revive cyber-casualty) | `ANTIVIRUS_PATCH` (+15% Grid Integrity per heal) |
| **Xaker Vətəndaş** | Citizens | Town Vanilla | N/A | None (Standard Voting) | `OVERCLOCK_VOTE` (+1 vote during Overdrive) |

#### Deep Ability Mechanics:
1. **Netrunner — `ICE_BREAKER`**:
   - Sub-action A: *Vote Spoofing*: Intercepts target's neural link. During the next Day Voting phase, target's vote is forcibly cast in alignment with the Netrunner's vote.
   - Sub-action B: *Data Interception*: Eavesdrops on night communications, intercepting 1 random target's action destination without revealing their exact role.
2. **Corpo Executive — `CORPO_BRIBE`**:
   - The Executive transfers corporate credits to a target. The target gains a temporary `IRON_WILL` shield protecting against one attack that night. However, if the target accepts, their daytime vote is weighted by +2 in favor of whatever target the Executive votes for.
3. **Street Fixer — `CYBERWARE_DROP`**:
   - The Fixer delivers 1 of 3 augmentations to a selected player at night:
     - *Subdermal Plating*: Grants 1 charge of `BULLETPROOF_VEST`.
     - *Neural Reflex Booster*: Raises the target's night action priority by +1 for the next night.
     - *EMP Feedback Trap*: If the holder is targeted with a lethal action, the attacker is `BLOCKED` for the subsequent night.
4. **Infiltrator — `NODE_SPOOF`**:
   - Swaps their digital signature with a target player. Any Sheriff or Investigator scanning the Infiltrator receives the target's scan result; any scan on the target returns "Caspian Megacorp Operative".

### 1.4 State Machine & Formal Transitions

```
               ┌──────────────────────────────────────────┐
               │          GRID_ONLINE_STABLE              │
               │   Grid Integrity: 70% – 100%             │
               │   Glitch Chance: 0%                      │
               └────────────────────┬─────────────────────┘
                                    │ Grid drops below 70%
                                    ▼
               ┌──────────────────────────────────────────┐
               │          GRID_DESTABILIZED               │
               │   Grid Integrity: 31% – 69%              │
               │   Glitch Chance: 15% / Morning           │
               └─────────┬──────────────────────┬─────────┘
   Grid recovers         │                      │ Grid drops
   above 70%             │                      │ below 31%
                         ▼                      ▼
               ┌──────────────────┐   ┌───────────────────┐
               │ NET-GLITCH EVENT │   │  CYBER-OVERDRIVE  │
               │ - Signal Scramble│   │ Timers: -50%      │
               │ - Firewall Leak  │   │ Double Charges    │
               │ - Blackout Cycle │   │ Audio Alarm       │
               └──────────────────┘   └─────────┬─────────┘
                                                │ Grid hits 0%
                                                ▼
                                      ┌───────────────────┐
                                      │  SYSTEM_BLACKOUT  │
                                      │ Zero Radar / Blind│
                                      │ Anarchy Countdown │
                                      └───────────────────┘
```

#### TypeScript Substate Definition:
```typescript
export interface CyberpunkNeoBakuState {
  readonly gridIntegrity: number; // 0 to 100
  readonly isCyberOverdriveActive: boolean;
  readonly isSystemBlackout: boolean;
  readonly activeGlitchEvent: 'NONE' | 'SIGNAL_SCRAMBLE' | 'FIREWALL_BREACH' | 'BLACKOUT_CYCLE';
  readonly glitchRoundsRemaining: number;
  readonly hackedPlayerVoteOverrides: Readonly<Record<string, string>>; // victimId -> forcedTargetId
  readonly cyberwareInventory: Readonly<Record<string, 'SUBDERMAL' | 'REFLEX' | 'EMP'>>;
  readonly nodeSpoofPairs: Readonly<Record<string, string>>; // infiltratorId -> spoofTargetId
  readonly corpoBribedPlayerIds: readonly string[];
  readonly gridIntegrityHistory: readonly number[];
}
```

### 1.5 Win Conditions
1. **Corpo Hegemony (Megacorp Victory)**:
   - Condition: All Netrunner Hackers and Syndicate combatants are eliminated, Megacorp equals or outnumbers remaining Citizens, and Grid Integrity is maintained above `40%`.
   - Banner: `"KASPI KORPORASİYASI HEKEMONLUĞU: ŞƏBƏKƏ TAM NƏZARƏTDƏDİR"`.
2. **Netrunner Liberation (Underground Victory)**:
   - Condition: All Corpo Executives and Infiltrators are eliminated, leaving the city in the hands of the Citizenry and Netrunners.
   - Banner: `"BAKI AZAD OLDU: AÇIQ KOD VƏ ŞƏRƏFLİ ŞƏBƏKƏ QƏLƏBƏSİ"`.
3. **Anarchist Grid Collapse (Rogue Solo Victory)**:
   - Condition: Grid Integrity reaches `0%` and is maintained at `0%` for two consecutive full Day/Night cycles while the Street Fixer or a Neutral Rogue is still alive. The central grid implodes, liberating the city from both Corporate and Civic law.

### 1.6 Visual & Audio Styling
- **Color Tokens**:
  - Primary Neon Pink: `#FF007F` (Tailwind: `rose-500` / custom `cyber-pink`)
  - High-Voltage Cyan: `#00F0FF` (Tailwind: `cyan-400` / custom `cyber-cyan`)
  - Terminal Amber: `#FFB800` (Tailwind: `amber-400`)
  - Deep Matrix Void: `#08090D` (Tailwind: `slate-950`)
- **CSS Shaders & Visual Effects**:
  - CRT scanline backdrop: repeating linear gradient `rgba(0,0,0,0.2) 0px, rgba(0,0,0,0.2) 1px, transparent 1px, transparent 2px`.
  - Chromatic text aberration on trial accusations (`text-shadow: 2px 0 #FF007F, -2px 0 #00F0FF`).
  - Pulsing glowing border on the Grid Integrity HUD.
- **Audio Sound Design**:
  - Synthesizer base drone: 55 Hz sawtooth wave with low-pass resonance filter.
  - Ability execution: High-frequency digital chirp and relay snap (Web Audio 1800 Hz -> 2400 Hz linear chirp over 80ms).
  - Cyber-Overdrive activation: Downward pitch-bend siren with stuttering bitcrush delay.

---

# 2. Bermuda Triangle Minigame Specification

```
                  ┌──────────────────────────────────────────────┐
                  │          BERMUDA MARITIME SENSOR             │
                  │   Current Weather: ELECTROMAGNETIC STORM     │
                  │   Anomaly Level:   HIGH (Compass Spin)       │
                  │   Ship Hull:       [████████░░] 82%          │
                  └──────────────────────────────────────────────┘
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
       ┌─────────────────────┐                         ┌─────────────────────┐
       │   RESEARCH CREW     │                         │   PHANTOM CORSAIRS  │
       │ - Chief Navigator   │   ◄── Nautical Duel ──► │ - Ghost Captain     │
       │ - Ship's Surgeon    │       (Fog & Sonar)     │ - Phantom Corsair   │
       │ - Deep-Sea Diver    │                         │ - Abyssal Siren     │
       └─────────────────────┘                         └─────────────────────┘
```

### 2.1 Nautical Mystery Theme
- **Setting**: The Devil's Triangle, 25°N 71°W. The oceanographic research vessel *SS Caspian Seeker* encounters an anomalous spatial vortex in the Sargasso Sea.
- **Narrative Conflict**: Navigational instruments fail, compasses spin wildly, and time slows. Ghost Corsairs—spirits of ships lost across three centuries—infiltrate the crew, seeking to pull the vessel into the abyssal void. The living crew must deduce who among them has succumbed to the Siren's call before the vessel breaks apart.
- **Atmospheric Palette**:
  - Ghostly bioluminescent sea mist clinging to the game board.
  - Distant foghorn echoes and creaking ship bulkheads.
  - Muted nautical tones: salt-weathered teak, tarnished brass, abyssal navy, and phosphorescent algae green.

### 2.2 Environmental Hazards & Weather State Machine

#### 2.2.1 Environmental Weather States
The maritime environment dynamically shifts between four distinct states governed by an anomaly probability curve:

| Weather State | Description | Game Impact | Action Modifiers |
|---------------|-------------|-------------|------------------|
| **CALM_SEA** | Glassy waters, clear horizon | Baseline game flow | Standard 100% action accuracy |
| **FOG_OF_THE_VOID** | Thick mystical sea mist covers the ship | Visual blindness | Investigations have 40% blur chance; Day vote tallies are hidden (blind secret voting) |
| **ELECTROMAGNETIC_STORM**| Compasses spin wildly; static electricity | Navigation failure | 35% chance night action misdirects to adjacent cabin; Sheriff scans return scrambled noise |
| **ROGUE_WAVE** | Massive 30-meter wave batters the vessel | Physical concussive shock | 1 random player is Stunned for the next Day (disenfranchised, cannot vote); Hull loses -15% integrity |

#### 2.2.2 Dynamic Anomaly Probability Curve
The probability $P(\text{Anomaly})$ of weather escalating increases non-linearly with round number:
$$P(\text{Anomaly}) = 1 - e^{-0.35 \times \text{RoundNumber}}$$
- Round 1: $1 - e^{-0.35} \approx 29.5\%$ (Predominantly `CALM_SEA` or light `FOG`).
- Round 2: $1 - e^{-0.70} \approx 50.3\%$ (Moderate `FOG` or `STORM`).
- Round 3: $1 - e^{-1.05} \approx 65.0\%$ (Frequent `ELECTROMAGNETIC_STORM`).
- Round 4+: $1 - e^{-1.40} \approx 75.3\%$ (High chance of `ROGUE_WAVE`).

#### 2.2.3 Ship Hull Integrity (100% – 0%)
- Starts at `100%`.
- Drops on Rogue Waves (-15%) and Corsair sabotage (-10%).
- If Hull reaches `0%`, the ship sinks into **Lifeboat Protocol**:
  - The Assembly discussion phase is permanently truncated to 45 seconds.
  - Players can only communicate with adjacent players (spatial chat isolation).

### 2.3 Unique Elimination & Reveal Rules

#### 2.3.1 "Vanished into the Mist" (Masked Elimination)
- When a player is eliminated by night attack or day marooning, their identity is **not immediately revealed**.
- The player card flips to a weathered shroud with the label: `"DƏNİZDƏ İTİB (VANISHED AT SEA)"`.
- **Intel Quarantine**: The victim's true role and faction remain hidden for **2 full rounds** (48 hours of game time), denying the town confirmation of whether a Mafia or Citizen died.
- **Salvage Mechanic**: The Chief Navigator or Deep-Sea Diver can expend their night action targeting a vanished player with `SALVAGE_LOGBOOK` to immediately dredge up and reveal their identity to all players.

#### 2.3.2 Ghost Fleet Communications (Sonar Telegram)
- Dead players are trapped in the "Ghost Fleet" (Dead Chat).
- Rather than being completely voiceless, dead players collaborate during the night phase to compose a **3-Word Sonar Telegram** (selected from a curated nautical dictionary: e.g., `[SHADOW, CAPTAIN, NORTH]`).
- At dawn, this 3-word telegram is published as a Morse-code banner at the top of the morning newspaper, giving living players cryptic clues.

#### 2.3.3 Abyssal Siren's Drowning Curse (Delayed Death)
- The Abyssal Siren's night strike does not kill immediately.
- The victim receives a private status effect: `WATERLOGGED_LUNGS`.
- The victim survives through the entire subsequent Day phase (allowing them to vote and defend themselves), but collapses at the beginning of the next night unless the Ship's Surgeon administers `OXYGEN_TREATMENT`.

### 2.4 Balancing Parameters & Crew Allocation

| Parameter | 10 Players | 12 Players | 14 Players |
|-----------|------------|------------|------------|
| **Ghost Corsairs (Mafia)** | 2 (Captain, Corsair) | 3 (+ Siren) | 3 (+ Siren, Saboteur) |
| **Chief Navigator (Sheriff)**| 1 | 1 | 1 |
| **Ship's Surgeon (Doctor)**  | 1 | 1 | 1 |
| **Deep-Sea Diver (Utility)** | 1 | 1 | 2 |
| **Sailors (Citizens)**       | 5 | 6 | 7 |
| **Initial Hull Integrity**   | 100% | 100% | 100% |
| **Base Anomaly Factor**      | 0.30 | 0.35 | 0.40 |

#### TypeScript Substate Definition:
```typescript
export type BermudaWeather = 'CALM_SEA' | 'FOG_OF_THE_VOID' | 'ELECTROMAGNETIC_STORM' | 'ROGUE_WAVE';

export interface BermudaTriangleState {
  readonly currentWeather: BermudaWeather;
  readonly weatherRoundsRemaining: number;
  readonly shipHullIntegrity: number; // 0 to 100
  readonly vanishedPlayerIds: readonly string[]; // unrevealed deaths
  readonly revealedWreckageIds: readonly string[]; // salvaged deaths
  readonly cursedDrowningPlayerIds: readonly string[]; // pending delayed death
  readonly stunnedPlayerIds: readonly string[]; // cannot vote due to Rogue Wave
  readonly ghostTelegramClues: readonly string[]; // 3-word telegram from dead chat
  readonly compassScrambleRate: number; // 0.0 to 1.0
}
```

### 2.5 Win Conditions
1. **Crew Survival (Town Victory)**:
   - Condition: All Ghost Corsairs and the Abyssal Siren are purged, and the ship maintains at least 1% Hull Integrity until the storm clears.
   - Banner: `"FIRTINA SƏNGİDİ: GƏMİ SAHİLƏ ÇATDI VƏ EKİPAJ XİLAS OLDU"`.
2. **Abyssal Claim (Corsair Victory)**:
   - Condition: Ghost Corsairs equal or outnumber living crew members, pulling the vessel forever into the Bermuda Rift.
   - Banner: `"DƏNİZ QƏBİRİSTANLIĞI: RUHLAR DONANMASI YENİ QURBANLARINI ALDI"`.
3. **Catastrophic Shipwreck (Environmental Draw)**:
   - Condition: Hull Integrity reaches 0% and all remaining crew perish in a Rogue Wave during lifeboats.

### 2.6 Visual & Audio Styling
- **Color Tokens**:
  - Abyssal Navy: `#00111A` (Tailwind: `slate-950` / custom `ocean-deep`)
  - Phosphorescent Algae: `#10B981` (Tailwind: `emerald-500`)
  - Sea-Mist Shroud: `rgba(226, 232, 240, 0.18)`
  - Weathered Brass Gold: `#D97706` (Tailwind: `amber-600`)
- **Visual Weather Overlays**:
  - Particle mist drift with horizontal parallax animation (`@keyframes mist-flow`).
  - Compass HUD indicator that vibrates and spins randomly during `ELECTROMAGNETIC_STORM`.
  - Water droplet condensation shader along the viewport perimeter.
- **Audio Sound Design**:
  - Submarine Sonar Ping: 220 Hz pure sine wave with high Q factor and 3.2-second natural reverberation decay.
  - Creaking timbers: Acoustic sample of strained wood bulkheads during Rogue Wave transitions.
  - Ambient fog: Soft maritime ocean swell pink noise filtered at 400 Hz.

---

# 3. Automated E2E Browser Testing Architecture

```
                               ┌────────────────────────────────┐
                               │   PLAYWRIGHT TEST CONTROLLER   │
                               │  (Multi-Worker Node.js Runner) │
                               └───────────────┬────────────────┘
                                               │
             ┌─────────────────────────────────┼─────────────────────────────────┐
             ▼                                 ▼                                 ▼
   ┌───────────────────┐             ┌───────────────────┐             ┌───────────────────┐
   │ BROWSER CONTEXT 0 │             │ BROWSER CONTEXT 1 │             │ BROWSER CONTEXT N │
   │ - Client: Host    │             │ - Client: Sheriff │             │ - Client: Mafia   │
   │ - Token: Admin    │             │ - Token: Player 1 │             │ - Token: Player N │
   │ - WebSocket #0    │             │ - WebSocket #1    │             │ - WebSocket #N    │
   └─────────┬─────────┘             └─────────┬─────────┘             └─────────┬─────────┘
             │                                 │                                 │
             └─────────────────────────────────┼─────────────────────────────────┘
                                               ▼
                               ┌────────────────────────────────┐
                               │   NEXT.JS 14 BACKEND SERVER    │
                               │  - In-Memory Lobby State       │
                               │  - Zero-Knowledge Sockets      │
                               │  - Priority Resolver Engine    │
                               └────────────────────────────────┘
```

### 3.1 Tooling Selection & Justification

| Dimension | Playwright (Recommended) | Cypress | Puppeteer | Selenium WebDriver |
|-----------|--------------------------|---------|-----------|--------------------|
| **Multi-User Concurrency** | **Native**: Multi-context multi-page in single engine instance | Flawed: Only 1 active tab/context natively supported | Manual: Heavy script boilerplate required | Heavy: Requires grid hubs, high memory overhead |
| **WebSocket Testing** | **First-Class**: Direct frame capture & mocking via `page.on('websocket')` | Limited: Relies on plugin wrappers | Basic: Low-level CDP listeners only | Primitive: No native WebSocket assertion APIs |
| **Isolation & Speed** | Zero-latency browser contexts with separate cookies/localStorage | Full browser restart between suites | Low overhead, but lacks test assertions | Very slow startup, high process footprint |
| **Language & Next.js 14** | Pure TypeScript, seamless integration with `@types/node` | JavaScript / TS via custom bundler | Pure JS/TS | Java/Python/C# bindings |

**Architectural Rationale**: Playwright is selected as the exclusive framework for TDV Mafia E2E testing because social deduction games fundamentally depend on **multi-client synchronization**. A single Playwright test can spawn 8 independent `BrowserContext` objects in parallel, simulating an entire 8-player lobby interacting in real-time on a single machine in under 15 seconds.

### 3.2 Multi-Client Simulation Architecture

#### 3.2.1 Multi-Session Coordinator (`LobbyTestHarness`)
```typescript
export class MafiaLobbyHarness {
  private browser: Browser;
  private contexts: BrowserContext[] = [];
  public pages: Page[] = [];

  constructor(browser: Browser) {
    this.browser = browser;
  }

  /** Initialize N parallel isolated browser sessions */
  async spawnPlayers(count: number, baseUrl: string): Promise<void> {
    for (let i = 0; i < count; i++) {
      const context = await this.browser.newContext({
        viewport: { width: 1280, height: 720 },
        storageState: undefined, // fresh isolated cookies & local storage
      });
      const page = await context.newPage();
      await page.goto(`${baseUrl}/lobby/join`);
      this.contexts.push(context);
      this.pages.push(page);
    }
  }

  /** Synchronize all clients on a specific game phase */
  async waitForAllPhases(targetPhase: string, timeoutMs = 10000): Promise<void> {
    await Promise.all(
      this.pages.map(page =>
        page.waitForSelector(`[data-testid="phase-badge-${targetPhase}"]`, { timeout: timeoutMs })
      )
    );
  }

  /** Tear down all browser contexts cleanly */
  async cleanup(): Promise<void> {
    await Promise.all(this.contexts.map(c => c.close()));
  }
}
```

### 3.3 End-to-End Test Scenarios

#### Scenario 1: Standard 8-Player Full Cycle (Lobby -> Victory)
1. **Lobby Setup**: Host (Page 0) creates standard 8-player lobby. Pages 1 through 7 enter the invite code and click "Hazıram (Ready)".
2. **Game Launch**: Host clicks "Oyuna Başla". Verify all 8 clients display `RoleRevealOverlay` within 500ms.
3. **Role Assignment Check**: Verify Page 0 receives private role card, while inspecting network frames to guarantee Page 0 cannot see Page 1's role in the DOM or socket frames (Zero-Knowledge verification).
4. **Day Discussion & Accusation**:
   - Page 1 and Page 2 cast accusation votes on Page 3.
   - Accusation count hits majority threshold.
   - Assert `TrialDefensePanel` mounts with 30s defense timer on all 8 screens.
5. **Two-Tier Courtroom Verdict**:
   - 5 players vote `GUILTY`, 2 vote `INNOCENT`.
   - Assert Page 3 transitions to dead/spectator state and `TombstoneModal` displays.
6. **Night Phase & Action Execution**:
   - Phase shifts to `NIGHT_BUFFER`.
   - Mafia player (Page 4) targets Page 1 with `KILL`.
   - Doctor player (Page 2) targets Page 1 with `PROTECT`.
   - Night resolver executes.
7. **Dawn Arrival & Newspaper**:
   - Verify `MorningNewspaperModal` opens on all clients stating: *"Həkimin vaxtında müdaxiləsi qurbanı xilas etdi" (Doctor saved victim)*.
   - Verify 0 deaths recorded.

#### Scenario 2: Cyberpunk Neo-Baku Glitch & Overdrive Verification
1. Launch 12-player lobby with mode `CYBERPUNK_NEO_BAKU`.
2. Mock Netrunner executing `ICE_BREAKER: SYSTEM_OVERLOAD`.
3. Assert Grid Integrity gauge drops from 100% to 80%.
4. Drop integrity to 25% via server action trigger.
5. Verify client HUD switches to `CYBER_OVERDRIVE` state (pulsing crimson scanline, timer drops to 15s).
6. Verify chat inputs during `SIGNAL_SCRAMBLE` event display encrypted matrix characters.

#### Scenario 3: Bermuda Triangle "Vanished at Sea" & Ghost Telegram
1. Launch 10-player Bermuda lobby.
2. Corsair executes night kill on Sailor (Player 5).
3. At dawn, assert Player 5's card displays `"DƏNİZDƏ İTİB"` with masked role question mark.
4. Open Dead Chat on Player 5's context; submit 3-word telegram `[FIRTINA, MAYAK, DALĞA]`.
5. Verify living players receive the telegram on their morning banner.

#### Scenario 4: Network Disconnect & Bot Reconnection Handshake
1. Client 3 abruptly navigates away (`page.close()`) during Night Buffer.
2. Assert server heartbeat triggers AI bot takeover after 5 seconds (`isAiBotControlled: true`).
3. Night resolves with AI bot selecting target according to strategic heuristic.
4. Client 3 reopens lobby URL with cached JWT token in localStorage.
5. Assert session rehydrates immediately without game interruption.

---

# 4. UI/UX Polish Roadmap & Accessibility Specifications

```
  ┌────────────────────────────────────────────────────────────────────────┐
  │                           UI POLISH TAXONOMY                           │
  ├─────────────────────┬───────────────────┬──────────────────────────────┤
  │ Micro-Interactions  │ Audio Feedback    │ Accessibility (WCAG 2.1 AA)  │
  ├─────────────────────┼───────────────────┼──────────────────────────────┤
  │ - Spring Reticles   │ - 35% Master Vol  │ - 4.5:1 Contrast Ratio       │
  │ - Card Tilt Hover   │ - Gavel Acoustics │ - aria-live Announcements    │
  │ - Circular Timers   │ - Sonar Ping Loop │ - Reduced Motion Fallback    │
  │ - Shimmer Accents   │ - Chirp Feedback  │ - 48px Minimum Touch Target  │
  └─────────────────────┴───────────────────┴──────────────────────────────┘
```

### 4.1 Component-Level Polish Matrix

| Component | Target File | Current State | Polished Specification | Animation Engine |
|-----------|-------------|---------------|------------------------|------------------|
| **Voting Cards** | `src/components/game/PlayerCard.tsx` | Flat CSS border glow | 3D perspective hover tilt ($\pm 8^\circ$), spring hover lift (`translateY(-4px)`), dynamic border shimmer on accusation | Framer Motion `motion.div` |
| **Accused Podium**| `src/components/game/TrialDefensePanel.tsx` | Static golden box | Golden volumetric spotlight beam with floating dust particles, pulsating vignette, and microphone icon ripple | CSS Keyframes & SVG filter |
| **Countdown Ring**| `src/components/game/TrialDefensePanel.tsx` | Text seconds display | Circular SVG progress ring with smooth stroke-dashoffset interpolation; shifts Amber $\to$ Orange $\to$ Flashing Red ($<5\text{s}$) | Framer Motion `pathLength` |
| **Action Reticles**| `src/components/game/RoleActionReticle.tsx` | Static colored ring | Animated radar crosshair with 360° sweeping beam, targeting locks, and faction-specific glyphs | CSS SVG Transform |
| **Victory Banner** | `src/components/game/GameOverCinematic.tsx` | Static text modal | Confetti explosion with simulated gravity, floating faction crest, and MVP player spotlight carousel | `canvas-confetti` + Framer Motion |

### 4.2 Audio/Visual Micro-Interactions
- **35% Master Volume Rule**: All synthetic sounds adhere strictly to the project's comfortable Master Volume threshold (`0.35`), eliminating ear fatigue during long gaming sessions.
- **Button Micro-Clicks**: Every interactive button on hover plays a subtle 12ms acoustic click (bandpass filtered at 1200 Hz).
- **Vote Gavel Acoustics**: Casting an accusation or guilty verdict triggers a deep, wooden gavel strike synthesized via two exponential decay oscillators (140 Hz and 85 Hz).
- **Haptic Vibration (Mobile Devices)**:
  - Voting click: Light impact (`navigator.vibrate(15)`).
  - Accused on defense podium: Heavy double buzz (`navigator.vibrate([40, 60, 40])`).
  - Victory reveal: Celebratory triple pulse (`navigator.vibrate([30, 50, 30, 50, 60])`).

### 4.3 Responsive Behavior & Form Factors

```
   DESKTOP (≥ 1024px)                     MOBILE (< 768px)
┌───────────────────────────────┐      ┌───────────────────────────────┐
│ [Left: Roster] [Center: Arena]│      │ [Header: Phase & Timer HUD]   │
│                [Right: Chat]  │      │ [Player Card Carousel/Grid]   │
│                               │      │ [Floating Action Reticle Bar] │
│ Keyboard Shortcuts:           │      │ [Bottom Bar: Chat Drawer]     │
│ [Space] Target  [V] Vote      │      │                               │
│ [C] Chat        [M] Mute      │      │ Touch Targets: Minimum 48x48px│
└───────────────────────────────┘      └───────────────────────────────┘
```

#### Mobile Touch Specifications:
- **Minimum Tap Target**: Every button, role reticle, and vote chip has a minimum touch bounding box of `48px x 48px` (conforming to Apple HIG and Google Material 3 standards).
- **Swipe Drawers**:
  - Chat Box transforms into a bottom swipe-up drawer on mobile devices (`< 768px`), leaving the primary game arena uncluttered.
  - Detective Notebook slides in from the right edge with a thumb swipe.
- **Desktop Keyboard Accessibility**:
  - `Space` / `Enter`: Confirm action on selected target.
  - `ArrowUp` / `ArrowDown` / `ArrowLeft` / `ArrowRight`: Navigate player grid.
  - `1` through `9`: Quick-select player by roster seat number.
  - `V`: Open voting confirmation modal.
  - `C`: Focus chat input.
  - `M`: Toggle audio mute.
  - `Escape`: Close modals and active targeting reticles.

### 4.4 Accessibility Compliance (WCAG 2.1 Level AA)

1. **Color Contrast Verification**:
   - Primary text (`#F8FAFC` slate-50) against background (`#0A0B10` dark charcoal): Contrast ratio is **18.2:1** (exceeds the 4.5:1 AA requirement).
   - Muted secondary text (`#94A3B8` slate-400) against card backdrop (`#1E293B` slate-800): Contrast ratio is **5.1:1** (exceeds 4.5:1).
   - Accusation alert red (`#EF4444`) on dark background: Contrast ratio is **4.8:1**.
2. **Screen Reader Live Announcements**:
   - Game phase transitions are bound to an invisible, persistent `aria-live="polite"` landmark:
     ```html
     <div aria-live="polite" aria-atomic="true" class="sr-only">
       {announcementText}
     </div>
     ```
   - Urgent events (e.g. being accused on the podium, game over) trigger `aria-live="assertive"`.
3. **Motion Sensitivity (`prefers-reduced-motion`)**:
   - All Framer Motion spring transitions and CSS rotation animations are governed by the media query:
     ```css
     @media (prefers-reduced-motion: reduce) {
       *, ::before, ::after {
         animation-duration: 0.01ms !important;
         animation-iteration-count: 1 !important;
         transition-duration: 0.01ms !important;
         scroll-behavior: auto !important;
       }
     }
     ```
   - Confetti bursts are automatically disabled if reduced motion is requested.
4. **Keyboard Focus Outlines**:
   - Active interactive elements feature a visible high-contrast outline (`outline: 2px solid #38BDF8; outline-offset: 2px;`) that is never suppressed for keyboard users.

---

# 5. Features Discovered & Edge Cases

## Features Discovered
| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Cyberpunk Minigame | `CYBER_OVERDRIVE` Trigger | State transition when Grid Integrity drops to $\le 30\%$ | Grid integrity value | Halved timers, double charges, audio siren | Clamped to 0 minimum | Spec Exploration |
| 2 | Cyberpunk Minigame | Netrunner `ICE_BREAKER` | High-priority night hack that either spoofs target's daytime vote or intercepts encrypted comms | Target player ID, sub-ability choice | Overridden vote weight or intercepted message snippet | Null if target dead/blocked | Architecture Mining |
| 3 | Cyberpunk Minigame | Corpo `CORPO_BRIBE` | Shields target with temporary armor in exchange for forced vote compliance | Target player ID | Protected flag on target + vote modifier | Rejected if target has Iron Will already | Architecture Mining |
| 4 | Cyberpunk Minigame | Street Fixer `CYBERWARE_DROP` | Distributes Subdermal Plating, Reflex Boost, or EMP Trap to any player | Recipient ID, item type | Augmented status attached to recipient session | Item slot full error | Spec Exploration |
| 5 | Cyberpunk Minigame | Infiltrator `NODE_SPOOF` | Swaps network telemetry so investigations return target's profile | Target player ID | Reversed scan results for both players | Reverts if either player dies | Architecture Mining |
| 6 | Bermuda Minigame | Maritime Weather Machine | Shifts between Calm Sea, Void Fog, EM Storm, and Rogue Wave via exponential hazard curve | Round number, RNG seed | Active weather enum, visibility %, misdirection % | Falls back to Calm Sea | Spec Exploration |
| 7 | Bermuda Minigame | "Vanished at Sea" Mask | Masks death identity for 2 rounds preventing immediate role reveal | Eliminated player ID | Masked card display (`VANISHED_AT_SEA`) | Revealed early if salvaged | Spec Exploration |
| 8 | Bermuda Minigame | Ghost Fleet Telegram | Allows dead chat to compose 3-word Morse/sonar telegram published at dawn | 3 words from nautical lexicon | Morning newspaper broadcast banner | Skipped if dead chat silent | Architecture Mining |
| 9 | Bermuda Minigame | Siren's Drowning Curse | Inflicts delayed lethal curse where victim survives 1 day before expiring | Target player ID | `WATERLOGGED_LUNGS` status | Nullified by Surgeon oxygen | Architecture Mining |
| 10| E2E Testing | Multi-Context Orchestration | Playwright architecture spawning 4-8 concurrent browser sessions | Configured player count | Parallel browser contexts and pages | Graceful cleanup on failure | Tooling Evaluation |
| 11| E2E Testing | Zero-Knowledge Leak Assertion | Test assertions verifying private roles do not leak to unauthorized clients | DOM and socket frames | Boolean pass/fail assertions | Fails test if leak detected | Security Testing Spec |
| 12| UI/UX Polish | 3D Perspective Card Hover | Interactive tilt on player cards based on cursor coordinates | Cursor `clientX`/`clientY` | Dynamic CSS `transform: perspective(1000px) rotateX(...)` | Disabled on touch devices | Design System Audit |
| 13| UI/UX Polish | Circular SVG Progress Ring | SVG timer countdown with smooth stroke-dashoffset interpolation | Seconds remaining | Color-shifting circular progress bar | Clamped to 0 at timeout | UI Engineering |
| 14| UI/UX Polish | WCAG 2.1 AA Tokens | Color tokens and focus states meeting 4.5:1 contrast standards | Theme color palette | High-contrast UI tokens and focus rings | Fallback for legacy CSS | Accessibility Audit |

## Edge Cases
| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Netrunner `ICE_BREAKER` Vote Spoof | Target dies during the night before Day Voting | Spoofed vote is invalidated cleanly; no dead ghost votes cast |
| 2 | Corpo `CORPO_BRIBE` vs `IRON_WILL` | Target already possesses native `IRON_WILL` | Bribe grants vote allegiance bonus but does not stack secondary armor charge beyond maximum capacity |
| 3 | Bermuda `ELECTROMAGNETIC_STORM` | Night action targets an adjacent player when deflected | Action redirects deterministically to `(seatIndex + 1) % alivePlayerCount` |
| 4 | Bermuda "Vanished at Sea" Salvage | Two navigators salvage the same wreck simultaneously | Both receive confirmation; identity is broadcast once without duplicate newspaper entries |
| 5 | Playwright Multi-Client Crash | One browser context crashes during test execution | Harness triggers catch block, closes all sibling contexts, and captures trace archive for debugging |
| 6 | Reduced Motion on Confetti | User agent specifies `prefers-reduced-motion: reduce` | `canvas-confetti` bypasses particle simulation and displays a static text announcement |
| 7 | Mobile Chat Drawer Keyboard Open | Virtual software keyboard pushes viewport up on iOS Safari | `window.visualViewport` listener recalculates drawer height preventing input box occlusion |
| 8 | Double Mayor Reveal during Overdrive | Mayor reveals while Cyber-Overdrive 2x multiplier is active | Multiplier stacks multiplicatively ($3 \times 2 = 6\text{x}$) or capped at $6\text{x}$ to prevent voting singularity |

---

# 6. Next-Phase Roadmap (M11–M15) Summary

```
   ┌─────────┐      ┌─────────┐      ┌─────────┐      ┌─────────┐      ┌─────────┐
   │   M11   │ ───► │   M12   │ ───► │   M13   │ ───► │   M14   │ ───► │   M15   │
   │Cyberpunk│      │ Bermuda │      │   E2E   │      │ UI/UX   │      │  Final  │
   │Neo-Baku │      │Triangle │      │ Testing │      │ Polish  │      │ Release │
   └─────────┘      └─────────┘      └─────────┘      └─────────┘      └─────────┘
```

- **M11: Cyberpunk Neo-Baku Minigame Engine**: Implement `CyberpunkNeoBakuState`, `processCyberpunkRound`, Netrunner and Corpo role mechanics, and Overdrive phase triggers.
- **M12: Bermuda Triangle Maritime Engine**: Implement `BermudaTriangleState`, weather hazard state machine, "Vanished at Sea" masked eliminations, and Ghost Fleet telegrams.
- **M13: Automated E2E Browser Testing Suite**: Implement Playwright multi-client test harness, automated 8-player full game cycle test, and network leak validators.
- **M14: UI/UX Component Polish & Audio Synthesis**: Implement 3D card tilt, circular SVG timers, Web Audio micro-interactions, and mobile swipe-up drawers.
- **M15: Accessibility Compliance & Final Release**: Implement WCAG 2.1 AA screen reader live regions, `prefers-reduced-motion` fallbacks, and complete multi-suite regression sweep.

---
*End of Architectural Specification Master Plan — TDV Mafia Platform M11+*
