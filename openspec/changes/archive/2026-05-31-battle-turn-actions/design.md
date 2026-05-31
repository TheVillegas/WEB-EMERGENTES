# Design: Battle Turn Actions (Pokemon TCG Pocket)

## Technical Approach

New pure-logic module at `src/tcg-engine/` — zero framework dependencies, zero side effects. Every function receives state and returns new state (immutable spread). Follows existing `gameEngine.ts` patterns: append-log helper, narrow validation guards, `vitest` co-located tests. Ingested via `toTcgCard()` bridge added to `src/features/cards/`. Existing `src/features/battle/` unchanged.

## Architecture Decisions

| Decision | Option A | Option B | Chosen | Rationale |
|----------|----------|----------|--------|-----------|
| Module location | Extend `src/features/battle/` | New `src/tcg-engine/` | **B** | Zero risk of breaking existing battle flow. Parallel module, clean migration later. |
| State immutability | Immer | Manual spreads | **Manual spreads** | Existing codebase pattern. Zero deps requirement. Small state shape makes spreads manageable. |
| Error model | Exceptions | Discriminated union return | **Discriminated union** | Existing codebase returns state-in-place on invalid (no throw). `ActionResult` union matches spec. |
| Energy tracking | `number` flat count | `Record<EnergyType, number>` | **Record** | Typed energy is THE core mechanic. Flat count can't validate attack costs. |
| Card data bridge | New loader in tcg-engine | Extend `cardRepository.ts` | **Extend repo** | Single CSV parse, single cache. `toTcgCard()` additive function. |
| CSV weakness parsing | Store raw string | Parse to `{ type: EnergyType, multiplier: number }` | **Parse** | Engine needs structured weakness for +20 calc. Normalizer strips "×2" text. |

## Data Flow

```
CSV (pokemon_cards_gen1_img.csv)
  │
  ▼
cardRepository.parseCatalogCsv()  →  CsvCardRow[]
  │
  ▼
toTcgCard(row)  →  TcgCard          ← NEW bridge (additive)
  │
  ▼
createInitialState(deck1, deck2)  →  GameState
  │
  ▼
engine.ts pure functions (generateEnergy → attachEnergy → attack → endTurn → …)
  │
  ▼
GameState (new immutable copy each call)
  │
  ▼
Consumer (Zustand store, UI, NPC — read-only observer)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/tcg-engine/types.ts` | Create | All game types, error types, discriminated unions |
| `src/tcg-engine/engine.ts` | Create | 9 pure functions implementing all turn actions |
| `src/tcg-engine/state.ts` | Create | State factory, Fisher-Yates shuffle, draw helper |
| `src/tcg-engine/__tests__/engine.test.ts` | Create | Vitest tests for all actions, edge cases, state transitions |
| `src/features/cards/types.ts` | Modify | Add `TcgCard`, `EnergyCostEntry`. Existing `Card`/`CsvCardRow` unchanged. |
| `src/features/cards/cardRepository.ts` | Modify | Add `toTcgCard()`. Existing `normalizeCardRow`/`normalizeCatalog` unchanged. |

## Key Type Definitions

```typescript
// types.ts
type EnergyType = 'Grass' | 'Fire' | 'Water' | 'Lightning' | 'Psychic' | 'Fighting' | 'Darkness' | 'Metal' | 'Dragon' | 'Colorless';

interface Attack {
  name: string;
  damage: number;
  cost: EnergyType[];
  effect: string;             // descriptive text only
}

type CardType = 'Pokemon' | 'Energy' | 'Item' | 'Supporter';

interface TcgCard {
  id: string;
  name: string;
  type: EnergyType;
  subtypes: CardType[];
  hp: number;
  attacks: Attack[];          // up to 2
  weakness: EnergyType | null;
  retreatCost: number;        // number of ANY energy to discard
  isEx: boolean;
  imageSmall: string;
  imageLarge: string;
}

interface Battler {
  cardId: string;
  attachedEnergies: Partial<Record<EnergyType, number>>;
  currentHp: number;
  status: string[];           // descriptive status effects
}

type EnergyZone = Partial<Record<EnergyType, number>>;

interface PlayerState {
  hand: TcgCard[];
  deck: TcgCard[];
  discard: TcgCard[];
  bench: Battler[];
  active: Battler | null;
  energyZone: EnergyZone;
  points: number;
  supporterPlayedThisTurn: boolean;
  energyAttachedThisTurn: boolean;
}

interface GameState {
  player1: PlayerState;
  player2: PlayerState;
  currentTurn: string;        // playerId
  turnPhase: TurnPhase;
  turnNumber: number;
  isFirstTurn: boolean;
  winner: string | null;
}

type TurnPhase = 'Draw' | 'Main' | 'Attack' | 'End';

type ActionResult =
  | { success: true; state: GameState }
  | { success: false; error: string };
```

## Engine Function Signatures

```typescript
// engine.ts — all functions pure: (state, ...args) → GameState | ActionResult

generateEnergy(state: GameState, playerId: string): GameState
  // +1 random basic energy to player's EnergyZone. Skip on first turn or already generated.
  // Random selection uses Math.random from the 10 energy types.

attachEnergy(state: GameState, playerId: string, target: 'active' | 'bench', benchIndex?: number): ActionResult
  // Moves 1 energy from zone to Battler. Fails if: not player's turn, wrong phase, already attached,
  // no energy in zone, or battler doesn't exist.

attack(state: GameState, playerId: string, attackIndex: number): ActionResult
  // Validates typed cost with countEnergies + validateAttackCost. Applies +20 weakness.
  // On KO: awards points (1 basic, 2 EX), forces switch. Empty bench + KO = loss.
  // Advances to End phase on success.

switchActive(state: GameState, playerId: string, benchIndex: number): ActionResult
  // Swaps active with bench[bIndex]. Pays retreatCost by discarding any energies from active.
  // Capped at available energy (discardRandomEnergy N times).

endTurn(state: GameState): GameState
  // Switches currentTurn, resets supporterPlayed + energyAttached flags.
  // Increments turnNumber, clears isFirstTurn after turn 1.

drawCard(state: GameState, playerId: string): GameState
  // Deck→hand (max 10). Empty deck = no-op, no penalty. Skip on first turn.

useItem(state: GameState, playerId: string, cardIndex: number): ActionResult
  // Moves item from hand[index] to discard. Effect text is descriptive — consumer resolves.

useSupporter(state: GameState, playerId: string, cardIndex: number): ActionResult
  // Same as useItem but rejects if supporterPlayedThisTurn. Sets flag on success.

checkVictory(state: GameState): string | null
  // Returns playerId if 3+ points. Also checks loss-by-empty-bench condition (handled inside attack).
```

## Error Types

```typescript
// All errors are returned as ActionResult with success:false + error string.
// Error IDs for consumer matching:
type EngineError =
  | 'NotEnoughEnergy'
  | 'NoBenchPokemon'
  | 'CantRetreat'
  | 'SupporterAlreadyPlayed'
  | 'EnergyAlreadyAttached'
  | 'HandFull'
  | 'HandEmpty'
  | 'NotYourTurn'
  | 'WrongPhase';
```

## Utility Functions (internal to engine.ts)

- `validateAttackCost(battler, cost)` → `{ valid: boolean; missing: Partial<Record<EnergyType, number>> }` — Colorless in cost matches any type.
- `applyWeakness(baseDamage, attackerType, defenderWeakness)` → `number` — `+20` if `attackerType === defenderWeakness`.
- `countEnergies(battler)` → sum of all values in `attachedEnergies` record.
- `discardRandomEnergy(battler)` → removes 1 random attached energy, returns updated battler.

## State Factory (state.ts)

- `createInitialState(deck1, deck2, id1, id2)` → shuffles both decks, draws 5 to hand, sets first Pokemon from hand as active, empties bench/energy/discard.
- `shuffleArray<T>(array)` → Fisher-Yates in-place copy.
- `drawCards(player, count)` → draws from deck to hand capping at 10.

## Card Bridge (cardRepository.ts)

```typescript
function toTcgCard(row: CsvCardRow, index: number): TcgCard | null
```

Maps CSV columns:
- `categoria` → `CardType[]` (`'Pokémon'`→`['Pokemon']`, `'Entrenador'`→`['Item']` or `['Supporter']` based on name, `'Energía'`→`['Energy']`)
- `ataque_1_*` → `attacks[0]`; `ataque_2_*` → `attacks[1]` if name present
- `ataque_1_costo` (`"Fire, Fire, Colorless"`) → parsed via comma-split + trim + map to `EnergyType[]`
- `debilidad` (`"Water ×2"`) → extracted type via regex `/(\w+)\s*×/`, discarded multiplier
- `retreatCost` → parsed from separate CSV column if present, else default 1
- Non-Pokemon cards: returns `TcgCard` with `hp:0`, `attacks:[]`, `weakness:null`, `retreatCost:0`

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Every engine function + all error paths | Vitest with deterministic test decks. Same catalog pattern as `gameEngine.test.ts`. |
| Unit | State factory: initial state shape, shuffle determinism, draw caps | `createInitialState` with known 20-card deck. |
| Unit | `toTcgCard`: all card types, multi-attack, weakness parse, edge cases | Vitest with sample CSV rows. |
| Unit | Weakness calc, cost validation, energy discard utils | Pure function specs with table tests. |

## Migration / Rollout

No migration required. Module is greenfield. Existing `src/features/battle/` untouched. Rollback: delete `src/tcg-engine/`, revert 2 additive functions in `cardRepository.ts` and `types.ts`.

## Open Questions

- [ ] CSV column for `retreatCost` — verify if column exists or use default/attack cost heuristic. The proposal says "parse from CSV if present, else default 1."
- [ ] Trainer subcategory detection: `Entrenador` vs `Carta de Entrenador` — confirm CSV values to map Item vs Supporter correctly.
