# Tasks: Battle Turn Actions (Pokemon TCG Pocket)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~350-450 (4 new files + 2 extended + tests) |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR (greenfield module, additive extensions) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Full tcg-engine module + card bridge | PR 1 | All new files + 2 additive extensions; self-contained |

## Phase 1: Foundation — Types & State Factory

- [x] 1.1 Create `src/tcg-engine/types.ts` — Define `EnergyType` union (10 types), `Attack`, `TcgCard`, `Battler`, `EnergyZone`, `PlayerState`, `GameState`, `TurnPhase`, `ActionResult`, `EngineError`. No dependencies. Effort: M.
- [x] 1.2 Create `src/tcg-engine/state.ts` — Implement `shuffleArray<T>()` (Fisher-Yates copy), `drawCards(player, count)` (cap at 10), `createInitialState(deck1, deck2, id1, id2)`. Depends on 1.1. Effort: M.
- [x] 1.3 Write `src/tcg-engine/__tests__/state.test.ts` — Test shuffle determinism, draw caps, initial state shape (5 hand, active = first card, empty bench/energy). Depends on 1.1, 1.2. Effort: S.

## Phase 2: Engine Core — Pure Functions

- [x] 2.1 Create `src/tcg-engine/engine.ts` — Implement `generateEnergy(state, playerId)`: +1 random basic energy to zone, skip on first turn. Depends on 1.1. Effort: S.
- [x] 2.2 Implement `attachEnergy(state, playerId, target, benchIndex?)`: moves energy from zone to battler, fails on wrong phase/already attached/no zone energy. Depends on 1.1, 2.1. Effort: M.
- [x] 2.3 Implement utility functions: `validateAttackCost(battler, cost)` (Colorless matches any), `applyWeakness(base, attackerType, defenderWeakness)` (+20), `countEnergies(battler)`, `discardRandomEnergy(battler)`. Depends on 1.1. Effort: S.
- [x] 2.4 Implement `attack(state, playerId, attackIndex)`: validate cost, apply damage+weakness, KO logic (points: 1 basic/2 EX, forced switch, empty bench = loss), advance to End phase. Depends on 1.1, 2.3. Effort: L. ⚠️ High complexity — KO + points + forced switch.
- [x] 2.5 Implement `switchActive(state, playerId, benchIndex)`: swap active/bench, pay retreatCost (default 1) by discarding any energies. Depends on 1.1, 2.3. Effort: M.
- [x] 2.6 Implement `useItem(state, playerId, cardIndex)` and `useSupporter(state, playerId, cardIndex)`: move card hand→discard, enforce 1-supporter-per-turn. Depends on 1.1. Effort: S.
- [x] 2.7 Implement `endTurn(state)`: switch currentTurn, reset per-turn flags, increment turnNumber, clear isFirstTurn. Depends on 1.1. Effort: S.
- [x] 2.8 Implement `drawCard(state, playerId)`: deck→hand (max 10), skip on first turn, empty deck = no-op. Depends on 1.1. Effort: S.
- [x] 2.9 Implement `checkVictory(state)`: return playerId if 3+ points. Depends on 1.1. Effort: S.

## Phase 3: Card Bridge — CSV → TcgCard

- [x] 3.1 Extend `src/features/cards/types.ts` — Add `TcgCard` type, `EnergyCostEntry`, extend `CsvCardRow` with missing CSV columns (`debilidad`, `resistencia`, `ataque_1_efecto`, `ataque_2_*`). Existing `Card`/`normalizeCardRow` untouched. Depends on 1.1 (for EnergyType). Effort: S. ⚠️ Breaking risk: low (additive only).
- [x] 3.2 Add `toTcgCard(row, index)` to `src/features/cards/cardRepository.ts` — Map CSV to TcgCard: parse weakness type (regex `/(


w+)

*×/`, discard multiplier), parse typed energy costs (comma-split → EnergyType[]), default retreatCost=1, handle trainers (Item/Supporter) with hp=0/attacks=[]. Depends on 3.1, 1.1. Effort: M.
- [x] 3.3 Extend `src/features/cards/cardRepository.test.ts` — Test `toTcgCard()` for Pokemon (multi-attack, weakness parse), trainers (Item/Supporter), edge cases (missing attacks, empty weakness). Depends on 3.2. Effort: S.

## Phase 4: Tests — Engine Functions

- [x] 4.1 Create `src/tcg-engine/__tests__/engine.test.ts` — Test all engine functions: energy gen/attach, attack validation, weakness calc, switch/retreat, item/supporter limits, endTurn, drawCard, checkVictory. Use deterministic test decks (same pattern as `gameEngine.test.ts`). Depends on 2.1-2.9, 1.1. Effort: L.
- [x] 4.2 Test error paths: NotYourTurn, WrongPhase, NotEnoughEnergy, NoBenchPokemon, CantRetreat, SupporterAlreadyPlayed, EnergyAlreadyAttached, HandFull, HandEmpty. Depends: 2.1-2.9. Effort: M.
- [x] 4.3 Test first-turn restrictions: no draw, no energy gen/attach. Depends: 2.1, 2.7, 2.8. Effort: S.
- [x] 4.4 Test KO scenarios: points award (1/2), forced switch, loss on empty bench. Depends: 2.4. Effort: M.
