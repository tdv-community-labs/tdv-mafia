# Project: TDV Mafia — English Localization, Visual Immersion & Progression Master Plan

## Architecture
- **Server Engines & Core Logic**:
  - `src/server/engine/night-action-resolver.ts`: Decoupled role identification (`roleId`, case-insensitive English names, backward-compatible Azerbaijani fallbacks), priority resolution (P0-P7), bodyguard counter-kill, iron will.
  - `src/server/engine/voting-engine.ts`: Decoupled mayor recognition, weighted civic voting, courtroom indictment, verdict tallying.
  - `src/server/engine/phase-manager.ts`: State machine orchestrating game phases (`TRIAL_DEFENSE`, `NIGHT_ACTION`, `DAY_VOTING`).
  - `src/server/engine/minigames-engine.ts`: Asymmetric minigame rules (Dante's Inferno, Earth Stood Still, Valkyrie, Stanford Prison, Catenaccio, Chernobyl).
  - `src/server/engine/mvp-calculator.ts`: 5-axis algorithmic MVP scoring, turning points timeline, 1-click viral social share formatting in English.
  - `src/server/ai/bot-takeover.ts`: AI bot takeover, personality profiles, English fallback dialogue, strategic targeting.
  - `src/server/ai/ai-narrator.ts`: Atmospheric English noir narrator, morning newspaper headline generator.
- **Client & Battleground UI**:
  - `src/config/i18n/`: Comprehensive English localization dictionary (`en.ts`) and unified locale definitions.
  - `src/components/game/GameBoard.tsx`: Primary battleground layout, phase HUD, speaker queue, player grid, action bar in idiomatic English.
  - `src/components/game/PlayerCard.tsx`: Player card representation, status badges, rank/prestige badges, targeting reticles.
  - `src/components/game/TrialDefensePanel.tsx`: Podium spotlight, 30s circular countdown timer HUD, Scales of Justice duel indicator, Mayor reveal.
  - `src/components/game/VotingCourtPanel.tsx`: Indictment scale, suspect leaderboard, vote buttons.
  - `src/components/game/ExecutionOverlay.tsx`: Moral execution guillotine drop, branching narrative lore, fanfare/bell cues.
  - `src/components/game/GameOverCinematic.tsx`: Victory/defeat banners, fanfare audio triggers, winner roster, match recap trigger.
  - `src/components/game/RoleRevealOverlay.tsx`: Synchronized role reveal with English keyword detection and audio trigger.
  - `src/components/game/GhostRealmPanel.tsx`: Spectator & dead prediction betting, Spirit Essence, Spectral Suspicion Barometer.
  - `src/utils/sfx.ts`: 22 procedural Web Audio synthesis cues + victory/defeat fanfares, 35% master volume ceiling, mute management.
- **Progression & Retention**:
  - `src/types/progression.ts`: Clean English rank tier enum names ("Novice Sleuth", "Syndicate Enforcer", "Syndicate Don", "The Godfather").
  - `src/utils/progression.ts`: 1-100+ XP curve, 7-tier ranked ladder, demotion shield, cosmetics registry (borders, auras, titles).
  - `src/config/achievements.config.ts`: 72 achievements translated into polished, idiomatic English.
- **Verification & Testing**:
  - `tests/`: 15+ automated unit and integration test suites.
  - `simulate-allin.js`: Macro 40-player simulation harness.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | `FEAT-ENG-01` | Engine Logic Decoupling | Decouple Bodyguard, Mayor, Sheriff, Doctor, and Faction checks from localized strings in resolver, voting engine, bot takeover, and route | M20 | Survey R1 |
| 2 | `FEAT-ENG-02` | English Localization Dictionary | Comprehensive English localization (`i18n/en.ts`) for phases, factions, districts, offices, traits, Dante circles, death causes, standard roles | M20 | Survey R1 |
| 3 | `FEAT-ENG-03` | Prohibited Loanwords Elimination | Replace "acemi" and "sindikat" across progression types, utils, stats, and leaderboard with Novice Sleuth, Syndicate Enforcer, etc. | M20 | Survey R1 |
| 4 | `FEAT-ENG-04` | 72 Achievements English Overhaul | Localize all 72 achievements in `achievements.config.ts` into evocative, atmospheric English | M20 | Survey R1 |
| 5 | `FEAT-ENG-05` | AI Narrator & Bot English Personas | Overhaul system instructions in `ai-narrator.ts`, `bot-takeover.ts`, and `ai-detective` into English noir style | M20 | Survey R1 |
| 6 | `FEAT-VFX-01` | Victory & Defeat Web Audio Fanfare | Add victory/defeat fanfare synthesis cues in `sfx.ts` and wire into `GameOverCinematic.tsx` | M21 | Survey R2 |
| 7 | `FEAT-VFX-02` | Role Reveal Audio & English Detection | Add role reveal card audio cue and English role keyword matching in `RoleRevealOverlay.tsx` | M21 | Survey R2 |
| 8 | `FEAT-VFX-03` | Unified SFX Engine Mute Governance | Clean up `SoundEffectsObserver.tsx` to reference `sfx.ts` instead of redundant unmuted `audioEngine.ts` | M21 | Survey R2 |
| 9 | `FEAT-VFX-04` | Dual-Mount Overlay Resolution | Resolve concurrent dual-mount overlay conflict between `RoleRevealOverlay` and `GameIntroOverlay` in `page.tsx` | M21 | Survey R2 |
| 10 | `FEAT-VFX-05` | Courtroom & Visual Immersion Polish | Polish visual feedback in `TrialDefensePanel.tsx`, `VotingCourtPanel.tsx`, `RoleActionReticle.tsx`, `ExecutionOverlay.tsx` | M21 | Survey R2 |
| 11 | `FEAT-PROG-01` | PlayerCard Visual Badges & Copy | Overhaul PlayerCard badges ('ON PODIUM', '3X MAYOR', 'SHIELDED', 'CLASH', 'ARMOR SHATTERED', 'ELIMINATED', 'YOU') | M22 | Survey R3 |
| 12 | `FEAT-PROG-02` | Global UI Copy Localization | Overhaul Navbar, Landing page, and GameBoard UI text into natural English | M22 | Survey R3 |
| 13 | `FEAT-PROG-03` | Modals English Copy Overhaul | Overhaul RulesModal, CreateRoomModal, LeaderboardModal, AchievementsModal, LastWillModal, MorningNewspaperModal, TombstoneModal | M22 | Survey R3 |
| 14 | `FEAT-PROG-04` | Progression Data Flow Integration | Forward clutch XP from match recap in GameBoard and align `AchievementShowcaseModal.tsx` storage key | M22 | Survey R3 |
| 15 | `FEAT-SOC-01` | Post-Match MVP Calculator English Overhaul | Localize highlights, turning points, and shareable summary in `mvp-calculator.ts` with test compatibility | M23 | Survey R4 |
| 16 | `FEAT-SOC-02` | 1-Click Viral Social Share Cards | Polish pre-encoded share links (Telegram, WhatsApp, X) and clipboard copy feedback in English | M23 | Survey R4 |
| 17 | `FEAT-SOC-03` | Spectator Ghost Realm & Debate Console | Polish Ghost Realm prediction betting, Spirit Essence, and Bailiff speaker queue console in English | M23 | Survey R4 |
| 18 | `FEAT-DELIV-01` | Test Suite Synchronization & Assertion Alignment | Synchronize `test-viral-recap-spectator.ts` and `test-progression-retention.ts` to validate English contracts | M24 | Survey R5 |
| 19 | `FEAT-DELIV-02` | TypeScript Typecheck Zero-Error Gate | Pass `npm run typecheck` with 0 errors | M24 | Survey R5 |
| 20 | `FEAT-DELIV-03` | Macro 40-Player Simulation Gate | Execute `node simulate-allin.js` across at least 3 games with 0 bugs | M24 | Survey R5 |
| 21 | `FEAT-DELIV-04` | Production Bundle Build Gate | Compile Next.js 14 production bundle cleanly via `npm run build` | M24 | Survey R5 |
| 22 | `FEAT-DELIV-05` | Git Remote Delivery Gate | Cleanly commit all changes and push directly to `origin/main` | M24 | Survey R5 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M20 | Engine Decoupling, Core i18n & Vocabulary Overhaul (R1) | Engine role logic decoupling, `i18n/en.ts`, loanwords elimination ("acemi", "sindikat"), 72 achievements, AI prompts | none | DONE |
| M21 | Visual Immersion, Audio Design & Sensory Polish (R2) | Victory fanfare, role reveal audio/keywords, `sfx.ts` unification, dual-overlay resolution, courtroom visual polish | M20 | DONE |
| M22 | Progression, Retention & UI Overhaul (R3, R1 UI) | PlayerCard badges, global UI copy, all modals, clutch XP data flow, AchievementShowcaseModal | M20 | DONE |
| M23 | Social Engagement, Viral Match Recaps & Spectator (R4) | MVP calculator English strings, 1-click share cards, Ghost Realm prediction betting, Bailiff console | M20, M22 | DONE |
| M24 | Final Verification, Simulation & Remote Delivery (R5) | Test suite synchronization, typecheck, tests, simulate-allin (3 games), build, commit and push to origin/main | M20-M23 | DONE |

## Interface Contracts
### `night-action-resolver.ts` & `voting-engine.ts` ↔ Display Roles
- Role identity checks MUST evaluate canonical `role.roleId` (e.g. `'BODYGUARD'`, `'MAYOR'`, `'DOCTOR'`, `'SHERIFF'`) or case-insensitive English name (`'bodyguard'`, `'mayor'`), retaining legacy Azerbaijani strings (`'mühafizəçi'`, `'bələdiyyə'`) as backward-compatible fallbacks.
- `src/app/api/lobby/[lobbyId]/route.ts`: API checks MUST accept both English (`'sheriff'`, `'doctor'`) and Azerbaijani (`'şərif'`, `'həkim'`).

### `progression.ts` ↔ `achievements.config.ts` ↔ `PlayerCard.tsx`
- `RankTierDefinition`: provides `name: string` (and retains `nameAz: string` for type compatibility).
- `RankTierEnum`: `NOVICE_DETECTIVE` displays "Novice Sleuth", `SYNDICATE_ENFORCER` displays "Syndicate Enforcer", `SYNDICATE_DON` displays "Syndicate Don".
- `AchievementDefinition`: provides English title and description.

### `mvp-calculator.ts` ↔ `tests/test-viral-recap-spectator.ts`
- `MatchTurningPoint`: provides `title` and `description` in English; retains or aliases `titleAz` with English value or bilingual support to satisfy test contract.
- `shareableSummaryText`: provides polished English text (`🎭 TDV BTL MAFIA — MATCH RECAP`).

## Code Layout
- `src/config/i18n/`: `en.ts`, `az.ts`
- `src/server/engine/`: `night-action-resolver.ts`, `voting-engine.ts`, `phase-manager.ts`, `minigames-engine.ts`, `mvp-calculator.ts`
- `src/server/ai/`: `ai-narrator.ts`, `bot-takeover.ts`
- `src/app/api/`: `lobby/[lobbyId]/route.ts`, `leaderboard/route.ts`, `ai-detective/route.ts`
- `src/components/game/`: `GameBoard.tsx`, `PlayerCard.tsx`, `TrialDefensePanel.tsx`, `VotingCourtPanel.tsx`, `ExecutionOverlay.tsx`, `GameOverCinematic.tsx`, `RoleRevealOverlay.tsx`, `RoleActionReticle.tsx`, `GhostRealmPanel.tsx`
- `src/components/modals/`: `RulesModal.tsx`, `CreateRoomModal.tsx`, `LeaderboardModal.tsx`, `AchievementsModal.tsx`, `LastWillModal.tsx`, `MorningNewspaperModal.tsx`, `TombstoneModal.tsx`, `GraveyardModal.tsx`, `AchievementShowcaseModal.tsx`, `MatchRecapModal.tsx`
- `src/utils/`: `sfx.ts`, `progression.ts`, `stats.ts`
- `tests/`: Automated test suites (`test-viral-recap-spectator.ts`, `test-progression-retention.ts`, etc.)
- Root: `simulate-allin.js`, `package.json`
