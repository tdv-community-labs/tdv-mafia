# Project: TDV Mafia Gameplay Mechanics Master Plan

## Architecture
- **Server Engines**:
  - `src/server/engine/night-action-resolver.ts`: Deterministic night action priority resolution (P0-P7), protections, intercepts, blocks, kills, investigations.
  - `src/server/engine/voting-engine.ts`: Weighted civic voting, two-tier courtroom indictment, verdict tallying, Mayor 3x reveal.
  - `src/server/engine/phase-manager.ts`: State machine orchestrating game phases, including the `TRIAL_DEFENSE` phase (30s).
  - `src/server/engine/minigames-engine.ts`: Asymmetric minigame rules (Dante's Inferno, Earth Stood Still, Valkyrie, Stanford Prison, Catenaccio, Chernobyl Exclusion Zone).
  - `src/server/ai/bot-takeover.ts`: AI bot takeover, personality profiles, Gemini cascade dialogue generation, night targeting and voting heuristics.
- **Client & Battleground UI**:
  - `src/components/game/GameBoard.tsx`: Primary battleground layout, phase HUD, minigame indicators, speaker queue, player grid, action bar.
  - `src/components/game/PlayerCard.tsx`: Player card representation, role action targeting reticles, status indicators.
  - `src/utils/sfx.ts`: Web Audio API sound synthesis and playback engine.
- **Simulation & Testing**:
  - `tests/`: Automated unit and integration test suites (`test-night-action-matrix.ts`, `test-courtroom-voting.ts`, etc.).
  - `simulate-allin.js`: Standalone 40-player macro simulation harness.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | `FEAT-R1-01` Bodyguard Intercept & Counter-Kill | Intercepts lethal strike on protect target, kills attacker, sacrifices bodyguard | M1 | Survey R1 |
| 2 | `FEAT-R1-02` `IRON_WILL` Trait Dynamics | Survives first lethal attack with armor shatter alert, charge depletes | M1 | Survey R1 |
| 3 | `FEAT-R1-03` `PHANTOM_STEP` Trait Bypass | Bypasses all `BLOCK` actions and traps, actions execute unimpeded | M1 | Survey R1 |
| 4 | `FEAT-R1-04` `NIGHT_VISION` Observer Intel | Holder observes all visitors who target their visit destination | M1 | Survey R1 |
| 5 | `FEAT-R2-01` `TRIAL_DEFENSE` Phase State | 30s podium defense phase between accusation majority and final verdict | M2 | Survey R2 |
| 6 | `FEAT-R2-02` Two-Tier Verdict Voting | Players vote GUILTY or INNOCENT on accused, lynched only if GUILTY > INNOCENT | M2 | Survey R2 |
| 7 | `FEAT-R2-03` Mayor Reveal & 3x Multiplier | Mayor reveals identity publicly, granting permanent 3x voting weight | M2 | Survey R2 |
| 8 | `FEAT-R3-01` Stanford `PRISON_SANCTION` | Guards apply sanctions on inmates, increasing revolt meter (+15) | M3 | Survey R3 |
| 9 | `FEAT-R3-02` Stanford `PRISON_SOLITARY` | Guards place inmates in solitary, reducing meter (-5) and disenfranchising vote | M3 | Survey R3 |
| 10 | `FEAT-R3-03` Chernobyl Radiation Engine | Contamination accrual, bunker shelter protection, lethal threshold (100 mSv) | M3 | Survey R3 |
| 11 | `FEAT-R4-01` Contextual Bot Dialogue Generator | Personality-driven Azerbaijani chat generation via Gemini 3.8 Flash cascade & fallback | M4 | Survey R4 |
| 12 | `FEAT-R4-02` Mafia Anti-Friendly Fire | Mafia bots never target living teammates at night, coordinate day voting | M4 | Survey R4 |
| 13 | `FEAT-R4-03` Sheriff Non-Repeat Investigation | Sheriff bots track investigated players and prioritize uninvestigated suspects | M4 | Survey R4 |
| 14 | `FEAT-R5-01` Accused Podium Spotlight & Timer | Golden spotlight overlay on accused player and 30s defense countdown timer | M5 | Survey R5 |
| 15 | `FEAT-R5-02` Dynamic Role Action Reticles | Animated reticles on cards for KILL, PROTECT, INVESTIGATE, and BLOCK | M5 | Survey R5 |
| 16 | `FEAT-R5-03` Minigame Status Compact HUD | Top header indicator bar for active minigame gauges (Doomsday, Fuse, Revolt, Radiation) | M5 | Survey R5 |
| 17 | `FEAT-R5-04` Audio Cue Synchronization | Synchronized sound triggers for gavel, briefcase explosion, and countdown ticks | M5 | Survey R5 |
| 18 | `FEAT-TEST-01` E2E Test Suite Creation | Unit tests for R1-R4 covering matrix collisions, courtroom voting, minigames, bots | E2E | Quality Gate |
| 19 | `FEAT-SIM-01` Simulation Harness Harmonization | Fix vest depletion in `simulate-allin.js` so 40-player games resolve cleanly | M6 | Quality Gate |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Night Action Matrix & Innate Traits (R1) | Bodyguard intercept/counter-kill, `IRON_WILL`, `PHANTOM_STEP`, `NIGHT_VISION` | none | DONE |
| M2 | Courtroom Podium Defense & Voting Engine (R2) | `TRIAL_DEFENSE` phase (30s), GUILTY/INNOCENT verdict, Mayor 3x reveal | M1 (types) | DONE |
| M3 | Asymmetric Minigames Interactivity & Chernobyl (R3) | Stanford sanctions/solitary disenfranchisement, Chernobyl radiation engine | M1, M2 | DONE |
| M4 | Contextual AI Bot Dialogue & Heuristics (R4) | Personality chat cascade, Mafia anti-friendly fire, Sheriff non-repeat | M1, M2 | DONE |
| M5 | Immersive Battleground HUD, Spotlight & Audio (R5) | Podium spotlight, defense timer, reticles, compact minigame HUD, SFX | M2, M3 | DONE |
| E2E | E2E Testing Suite Track | Comprehensive unit tests for R1-R4, test runner configuration | M1, M2, M3, M4 | DONE |
| M6 | Final Verification Gates & Simulation (All) | `simulate-allin.js` bug fix, typecheck, tests, simulation, build | M1, M2, M3, M4, M5, E2E | DONE |
| M7 | Spectator Mode & Dead Chat (R1) | SpectatorSession, zero-knowledge DEAD chat isolation, graveyard UI, tombstone modal | M1-M6 | DONE |
| M8 | WebRTC Audio Spatialization (R2) | StereoPannerNode, circular player audio graph, dynamic speaking sonar badges | M7 | DONE |
| M9 | Role Loadout Balancing & Achievements (R3) | Standard/Asymmetric/Chaos/All-In 40p presets, trackable achievement engine | M7 | DONE |
| M10 | Simulation Harmonization & Production Certification | Macro 40-player simulation updates, regression sweeps, production bundle | M7-M9 | DONE |
| M11 | Cyberpunk Neo-Baku Minigame Engine | Grid Integrity, Cyber-Overdrive state, Netrunner ICE_BREAKER, Corpo roles | M1-M10 | DONE |
| M12 | Bermuda Triangle Maritime Engine | Weather hazards state machine, Vanished at Sea masked deaths, Ghost Fleet telegram | M1-M10 | DONE |
| M13 | Automated E2E Browser Testing Suite | Playwright multi-client test harness (4–8 concurrent browser sessions) | M1-M10 | DONE |
| M14 | UI/UX Component Polish & Audio Synthesis | 3D card tilt, circular SVG timers, Web Audio micro-interactions, mobile swipe drawer | M1-M10 | DONE |
| M15 | Accessibility Compliance & Final Release | WCAG 2.1 AA screen reader live regions, prefers-reduced-motion, multi-suite sweep | M11-M14 | DONE |

## Interface Contracts
### `night-action-resolver.ts` ↔ `engine.ts`
- `InnateTraitType`: includes `'IRON_WILL'`, `'NIGHT_VISION'`, `'PHANTOM_STEP'` [DONE]
- `DeathCause`: includes `'BODYGUARD_SACRIFICE'`, `'BODYGUARD_COUNTER'`, `'RADIATION_SICKNESS'` [DONE]
- `NightResolutionFlags`: includes `ironWillChargesRemaining`, `hasPhantomStep`, `isNightVision` [DONE]

### `phase-manager.ts` ↔ `voting-engine.ts` ↔ `GameBoard.tsx`
- `GamePhase`: includes `'TRIAL_DEFENSE'` [DONE]
- `LobbyState`: includes `accusedPlayerId?: string | null`, `trialVerdictVotes?: Record<string, 'GUILTY' | 'INNOCENT'>`, `mayorRevealedUserIds?: readonly string[]` [DONE]
- `getVoterWeight`: applies `3` (Standard) or `9` (All-In) when player is Mayor and revealed [DONE]

### `minigames-engine.ts` ↔ `route.ts`
- `ChernobylState`: defined with `radiationDosage`, `shelteredPlayerIds`, `zoneContaminationLevel`, `lethalThreshold`
- `processChernobylRound`: processes contamination, bunker shelter, decontamination, lethal elimination
- Actions `PRISON_SANCTION`, `PRISON_SOLITARY`, `MAYOR_REVEAL` handled in `/api/lobby/[lobbyId]`

### `bot-takeover.ts` ↔ `newspaper.ts`
- `generateBotDayDiscussionMessage`: accepts personality, publicDeaths, liveVotes, returns Azerbaijani message
- `selectStrategicTarget`: respects Mafia/Yakuza teammates and Sheriff investigation history

## Code Layout
- `src/types/`: Type definitions (`roles.ts`, `game.ts`, `engine.ts`, `minigames.ts`)
- `src/server/engine/`: Core logic (`night-action-resolver.ts`, `voting-engine.ts`, `phase-manager.ts`, `minigames-engine.ts`)
- `src/server/ai/`: Bot AI (`bot-takeover.ts`, `ai-narrator.ts`)
- `src/app/api/lobby/[lobbyId]/`: API endpoint routes (`route.ts`)
- `src/components/game/`: Battleground UI (`GameBoard.tsx`, `PlayerCard.tsx`, `VotingCourtPanel.tsx`)
- `src/utils/`: Audio and utilities (`sfx.ts`)
- `tests/`: Automated test suites
- Root: `simulate-allin.js`, `package.json`
