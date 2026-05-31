# Proposal: Battle Turn Actions (Pokemon TCG Pocket)

## Intent

Build a **new standalone game logic module** that implements Pokemon TCG Pocket turn mechanics: typed energy from Energy Zone, multiple attacks per Pokemon, bench with retreat, points-based victory, Item and Supporter trainer cards, and weakness as +20.

This module is **pure logic only** — no UI, no framework, no store. Other team members will consume this module to build a VR desktop web experience. The existing `src/features/battle/` engine remains untouched.

## Scope

### In Scope
- `EnergyType` union (Grass, Fire, Water, Lightning, Psychic, Fighting, Darkness, Metal, Dragon, Colorless)
- `EnergyZone` that generates 1 random basic energy per turn
- Typed energy attachment to active OR bench Pokemon (once per turn)
- Multiple attacks per Pokemon with typed cost validation
- Weakness: +20 damage (not x2), no resistances
- Bench (3 max), active Pokemon, switching with retreat cost
- Points system: 1 per KO, 2 for EX; first to 3 wins
- Trainer cards: Item (play from hand) and Supporter (1 per turn)
- Deck (20 cards), hand (max 10, start with 5), draw 1 per turn
- First-turn restriction: going-first player cannot attach energy or attack

### Out of Scope
- Ability (Poke-Power / Poke-Body) resolution engine
- Status conditions (Paralyzed, Poisoned, etc.)
- Retreat cost payment from attached energy
- Deck building UI or validation
- Card effect parsing engine (effects remain as descriptive text only)
- Special energy cards
- Evolution mechanic
- AI/NPC strategy for new actions (NPC still uses simple heuristic)

## Capabilities

### New Capabilities
- `energy-zone`: Random basic energy generation per turn, typed energy attachment rules, once-per-turn constraint
- `bench-mechanics`: Active/bench Pokemon layout, retreat with cost, bench size limits, switching on KO
- `points-victory`: Points-based win condition (3 points, EX = 2), KO triggers point award and forced switch
- `multi-attack`: Multiple attacks per Pokemon with typed energy cost validation and weakness calculation
- `turn-phases`: Structured turn flow with draw phase, main phase (attach/attack/item/supporter/switch), end phase
- `trainer-cards`: Item and Supporter card types, hand limit, supporter-per-turn limit, deck draw

### Unchanged
- `battle-engine` (existing `src/features/battle/`): Remains untouched. New module is independent.

## Approach

**New separate module at `src/tcg-engine/` — pure TypeScript, zero dependencies. Build bottom-up: types first, then engine, then card data bridge.**

1. **Module structure** (`src/tcg-engine/`):
   - `types.ts` — All game types (GameState, Battler, EnergyType, Attack, EnergyZone, TrainerCard, etc.)
   - `engine.ts` — Pure functions for all game actions, no side effects
   - `state.ts` — State factory and helpers (createInitialState, createDeck, etc.)
   - `__tests__/` — Unit tests with vitest
   
2. **Types** (`types.ts`): Define `EnergyType` union, `Attack` (name, damage, cost as `EnergyType[]`, effects text), `Battler` (active or bench, with `attachedEnergies: Record<EnergyType, number>`), `EnergyZone` (pool of available typed energy), `GameState` (active, bench, hand, deck, discard, energyZone, points, turnPhase), `TrainerCard` (Item vs Supporter), `TurnPhase`.

3. **Engine** (`engine.ts`): Pure functions:
   - `generateEnergy(state)` — adds 1 random basic energy to EnergyZone
   - `attachEnergy(state, toActive: boolean, benchIndex?: number)` — moves energy from zone to Pokemon
   - `attack(state, attackIndex: number)` — validates energy cost, applies damage + weakness, awards points, checks KO/forced switch
   - `switchActive(state, benchIndex: number)` — swaps active with bench, pays retreat cost
   - `endTurn(state)` — advances turn, resets per-turn flags
   - `drawCard(state)` — draws from deck to hand (max 10)
   - `useItem(state, cardIndex: number)` — applies item effect (effect text only, consumer handles interpretation)
   - `useSupporter(state, cardIndex: number)` — applies supporter, enforces 1-per-turn limit
   - `checkVictory(state)` — checks if either player reached 3 points

4. **State factory** (`state.ts`): `createInitialState(deck: Card[], playerId: string)` — builds a fresh GameState from a deck of cards, sets opening hand of 5, places no energy.

5. **Card data bridge** (in `src/features/cards/`): Add `toTcgCard(csvCard)` converter that maps CSV card data to the new `TcgCard` type. No modification to existing battle types. Existing `normalizeCardRow` extended to parse `ataque_2_*`, typed costs, weakness, and trainer subcategories.

6. **No NPC logic in this module** — NPC decision making remains separate. The engine provides legal-action queries for any consumer to build AI on top.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/tcg-engine/types.ts` | New | All game types (GameState, Battler, EnergyType, Attack, etc.) |
| `src/tcg-engine/engine.ts` | New | Pure functions for all turn actions |
| `src/tcg-engine/state.ts` | New | State factory and helpers |
| `src/tcg-engine/__tests__/engine.test.ts` | New | Unit tests for all engine functions |
| `src/features/cards/types.ts` | Extended | Add `TcgCard` type and converter; existing types untouched |
| `src/features/cards/cardRepository.ts` | Extended | Add `toTcgCard()` converter; existing parsing unchanged |
| `src/features/cards/cardRepository.test.ts` | Extended | Add tests for new converter |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Breaking existing UI that reads `energy: number` and `attackName` | High | Phase migration: add new fields alongside old, deprecate old in separate commit |
| CSV cost parsing complexity (mixed types like "Fire, Fire, Colorless") | Med | Use comma-split parsing already in `normalizeEnergyCost`; extend to preserve types |
| NPC mock becomes too simplistic for new actions | Low | Start with greedy heuristic; mark NPC strategy as out-of-scope for this change |
| State explosion from bench + deck + hand + energy zone | Med | Use strict immutable updates; define GameState in one place; co-locate all state transitions in gameEngine |
| Regression in existing battle flow | Med | Keep existing tests passing until new types are fully wired; then swap |

## Rollback Plan

All changes are contained in `src/tcg-engine/` (new) and additive extensions in `src/features/cards/`. Revert by deleting `src/tcg-engine/` and reverting card repository changes. No existing UI or battle system is affected — rollback is zero-risk.

## Dependencies

- CSV data must already include `ataque_2_*` columns (verified: present in `pokemon_cards_gen1_img.csv`)
- No new npm packages required
- Phaser integration (`src/game/`) is read-only observer — changes are additive

## Success Criteria

- [ ] Energy Zone generates 1 random typed energy per turn; cannot attach twice
- [ ] Energy attaches to active OR bench Pokemon with correct type tracking
- [ ] Pokemon with multiple attacks can choose which to use based on available typed energy
- [ ] Weakness applies +20 damage; resistances ignored
- [ ] Bench holds up to 3 Pokemon; switching pays retreat cost
- [ ] Points: 1 per KO, 2 for EX, first to 3 wins
- [ ] Trainer cards (Item/Supporter) playable from hand; 1 Supporter per turn
- [ ] Opening hand: 5 cards from 20-card deck; draw 1 per turn
- [ ] All engine functions remain pure and immutable; no side effects, no state mutation
- [ ] Module has zero framework dependencies (no React, no Zustand, no Phaser)
- [ ] Existing `src/features/battle/` test suite remains untouched and passing
- [ ] New `src/tcg-engine/` test suite covers all actions, edge cases, and state transitions