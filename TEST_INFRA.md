# E2E Test Infra: TDV Mafia Gameplay Mechanics

## Test Philosophy
- Requirement-driven, opaque-box and component-isolated verification.
- Validates the complete 5 workstreams: Night Action Matrix & Traits, Courtroom Voting & Defense, Minigames Interactivity, Bot Social Deduction, and UI/SFX integration.

## Feature Inventory
| # | Feature | Target Suite | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---------|--------------|:------:|:------:|:------:|:------:|
| 1 | Bodyguard Intercept & Counter-Kill | `tests/test-night-action-matrix.ts` | ✓ | ✓ | ✓ | ✓ |
| 2 | `IRON_WILL` Armor Shatter & Survival | `tests/test-night-action-matrix.ts` | ✓ | ✓ | ✓ | ✓ |
| 3 | `PHANTOM_STEP` Block Bypass | `tests/test-night-action-matrix.ts` | ✓ | ✓ | ✓ | ✓ |
| 4 | `NIGHT_VISION` Visitor Discovery | `tests/test-night-action-matrix.ts` | ✓ | ✓ | ✓ | ✓ |
| 5 | Courtroom `TRIAL_DEFENSE` Transition | `tests/test-courtroom-voting.ts` | ✓ | ✓ | ✓ | ✓ |
| 6 | Two-Tier Verdict Voting (Guilty/Innocent) | `tests/test-courtroom-voting.ts` | ✓ | ✓ | ✓ | ✓ |
| 7 | Mayor Reveal 3x Voting Multiplier | `tests/test-courtroom-voting.ts` | ✓ | ✓ | ✓ | ✓ |
| 8 | Stanford Prison Sanction & Revolt Meter | `tests/test-minigames-engine.ts` | ✓ | ✓ | ✓ | ✓ |
| 9 | Stanford Solitary Disenfranchisement | `tests/test-minigames-engine.ts` | ✓ | ✓ | ✓ | ✓ |
| 10 | Chernobyl Radiation & Shelter Engine | `tests/test-minigames-engine.ts` | ✓ | ✓ | ✓ | ✓ |
| 11 | AI Bot Contextual Dialogue Generator | `tests/test-bot-social-deduction.ts` | ✓ | ✓ | ✓ | ✓ |
| 12 | Mafia Night Anti-Friendly Fire | `tests/test-bot-social-deduction.ts` | ✓ | ✓ | ✓ | ✓ |
| 13 | Sheriff Non-Redundant Investigations | `tests/test-bot-social-deduction.ts` | ✓ | ✓ | ✓ | ✓ |
| 14 | 40-Player Macro Balance & Survival | `simulate-allin.js` | ✓ | ✓ | ✓ | ✓ |

## Test Architecture
- Test Runner: `tsx` executing TypeScript suites in `tests/`.
- Test Suites:
  - `tests/test-night-action-matrix.ts`: Tests R1 mechanics and edge collisions.
  - `tests/test-courtroom-voting.ts`: Tests R2 courtroom indictment, defense, verdict, and Mayor reveal.
  - `tests/test-minigames-engine.ts`: Tests R3 Stanford sanctions, solitary disenfranchisement, Chernobyl radiation cycles.
  - `tests/test-bot-social-deduction.ts`: Tests R4 dialogue generation, Mafia targeting, Sheriff investigations.
  - `simulate-allin.js`: Validates 40-player All-In game loop over 3 consecutive games.
- Full verification command:
  - `npm run typecheck && npm test && node simulate-allin.js && npm run build`
