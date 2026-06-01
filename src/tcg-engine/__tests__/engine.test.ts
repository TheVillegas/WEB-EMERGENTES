import { describe, expect, it } from 'vitest';
import {
  applyWeakness,
  attack,
  checkVictory,
  countEnergies,
  discardEnergiesForRetreat,
  drawCard,
  endTurn,
  generateEnergy,
  attachEnergy,
  getAvailableEnergyTypes,
  getRandomEnergyType,
  isPokemonCard,
  isTrainerCard,
  switchActive,
  useTrainer,
  validateAttackCost,
} from '../engine';
import { createInitialState } from '../state';
import type { Battler, GameState, PokemonCard, TcgCard } from '../types';
import { ALL_ENERGY_TYPES } from '../types';

const testPokemon = (
  name: string,
  type: 'grass' | 'fire' | 'water' | 'lightning' | 'psychic' | 'fighting' | 'darkness' | 'metal' | 'dragon' | 'colorless',
  hp: number,
  attacks?: { name: string; damage: number; cost: string[]; effect?: string }[],
  options?: { weakness?: string; retreatCost?: number; isEx?: boolean },
): PokemonCard => {
  const mapType = (t: string) => t.toLowerCase() as PokemonCard['types'][number];
  return {
    id: `${name.toLowerCase().replace(/\s+/g, '-')}-0`,
    name,
    types: [mapType(type)],
    hp,
    attacks:
      attacks?.map((a) => ({
        name: a.name,
        damage: a.damage,
        cost: a.cost.map(mapType),
        effect: a.effect || '',
      })) || [],
    weakness: options?.weakness ? (mapType(options.weakness) as PokemonCard['weakness']) : null,
    retreatCost: options?.retreatCost ?? 1,
    isEx: options?.isEx ?? false,
  };
};

const testTrainer = (name: string): TcgCard => ({
  id: `${name.toLowerCase().replace(/\s+/g, '-')}-0`,
  name,
  type: 'item',
  effect: 'Draw 2 cards',
});

const emptyZone = () => {
  const z = {} as Record<string, number>;
  for (const t of ALL_ENERGY_TYPES) z[t] = 0;
  return z;
};

function createTestState(p1Overrides?: Partial<GameState['players']['p1']>, p2Overrides?: Partial<GameState['players']['p2']>): GameState {
  const deck1: TcgCard[] = [
    testPokemon('Bulbasaur', 'grass', 40, [{ name: 'Tackle', damage: 10, cost: ['grass'] }]),
    testPokemon('Charmander', 'fire', 50, [{ name: 'Scratch', damage: 10, cost: ['fire'] }]),
    testPokemon('Squirtle', 'water', 40, [{ name: 'Bubble', damage: 10, cost: ['water'] }]),
    testPokemon('Pikachu', 'lightning', 40, [{ name: 'Gnaw', damage: 10, cost: ['lightning'] }]),
    testPokemon('Eevee', 'colorless', 50, [{ name: 'Tail Wag', damage: 0, cost: ['colorless'] }]),
  ];

  const deck2: TcgCard[] = [
    testPokemon('Abra', 'psychic', 30, [{ name: 'Psyshock', damage: 10, cost: ['psychic'] }]),
    testPokemon('Machop', 'fighting', 60, [{ name: 'Punch', damage: 10, cost: ['fighting'] }]),
    testPokemon('Ghastly', 'darkness', 40, [{ name: 'Lick', damage: 10, cost: ['darkness'] }]),
    testPokemon('Onix', 'metal', 60, [{ name: 'Rock Throw', damage: 10, cost: ['metal'] }]),
    testPokemon('Dratini', 'dragon', 40, [{ name: 'Wrap', damage: 10, cost: ['dragon'] }]),
  ];

  const state = createInitialState([...deck1], [...deck2], 'p1', 'p2');

  if (p1Overrides) {
    state.players.p1 = { ...state.players.p1, ...p1Overrides };
  }
  if (p2Overrides) {
    state.players.p2 = { ...state.players.p2, ...p2Overrides };
  }

  return state;
}

describe('getRandomEnergyType', () => {
  it('returns a valid energy type', () => {
    const type = getRandomEnergyType();
    expect(ALL_ENERGY_TYPES).toContain(type);
  });
});

describe('isPokemonCard / isTrainerCard', () => {
  const pokemon = testPokemon('Bulbasaur', 'grass', 40);
  const trainer = testTrainer('Potion');

  it('identifies Pokemon cards', () => {
    expect(isPokemonCard(pokemon)).toBe(true);
    expect(isPokemonCard(trainer)).toBe(false);
  });

  it('identifies Trainer cards', () => {
    expect(isTrainerCard(trainer)).toBe(true);
    expect(isTrainerCard(pokemon)).toBe(false);
  });
});

describe('generateEnergy', () => {
  it('adds one energy to the energy zone', () => {
    let state = createTestState();
    state.turnNumber = 2;
    state = generateEnergy(state, 'p1');
    const total = Object.values(state.players.p1.energyZone).reduce((a, b) => a + b, 0);
    expect(total).toBe(1);
  });

  it('does not generate on first turn', () => {
    let state = createTestState();
    state.turnNumber = 1;
    state = generateEnergy(state, 'p1');
    const total = Object.values(state.players.p1.energyZone).reduce((a, b) => a + b, 0);
    expect(total).toBe(0);
  });
});

describe('getAvailableEnergyTypes', () => {
  it('returns types with at least one energy', () => {
    const zone = emptyZone();
    zone.grass = 2;
    zone.fire = 0;
    zone.water = 1;
    expect(getAvailableEnergyTypes(zone)).toEqual(['grass', 'water']);
  });
});

describe('attachEnergy', () => {
  it('moves energy from zone to active Pokemon', () => {
    let state = createTestState();
    state.turnNumber = 2;
    state.players.p1.energyZone.grass = 1;
    const result = attachEnergy(state, 'p1', 'active');

    expect(result.success).toBe(true);
    expect(result.state!.players.p1.activeBattler!.attachedEnergies.grass).toBe(1);
    expect(result.state!.players.p1.energyZone.grass).toBe(0);
    expect(result.state!.players.p1.hasAttachedEnergy).toBe(true);
  });

  it('moves energy from zone to bench Pokemon', () => {
    let state = createTestState();
    state.turnNumber = 2;
    state.players.p1.energyZone.fire = 1;
    const result = attachEnergy(state, 'p1', 'bench', 0);

    expect(result.success).toBe(true);
    expect(result.state!.players.p1.bench[0].attachedEnergies.fire).toBe(1);
    expect(result.state!.players.p1.energyZone.fire).toBe(0);
  });

  it('rejects attaching twice per turn', () => {
    let state = createTestState();
    state.turnNumber = 2;
    state.players.p1.energyZone.grass = 2;
    state.players.p1.hasAttachedEnergy = true;
    const result = attachEnergy(state, 'p1', 'active');

    expect(result.success).toBe(false);
    expect(result.error).toContain('already');
  });

  it('rejects when no energy in zone', () => {
    let state = createTestState();
    state.turnNumber = 2;
    const result = attachEnergy(state, 'p1', 'active');

    expect(result.success).toBe(false);
    expect(result.error).toContain('energy');
  });

  it('rejects invalid bench index', () => {
    let state = createTestState();
    state.turnNumber = 2;
    state.players.p1.energyZone.grass = 1;
    const result = attachEnergy(state, 'p1', 'bench', 99);

    expect(result.success).toBe(false);
  });
});

describe('validateAttackCost', () => {
  const battler: Battler = {
    card: testPokemon('Charmander', 'fire', 50, [
      { name: 'Ember', damage: 20, cost: ['fire', 'colorless'] },
    ]),
    currentHp: 50,
    attachedEnergies: emptyZone(),
    status: 'active',
  };

  it('passes when exact typed energy is available', () => {
    battler.attachedEnergies.fire = 2;
    const result = validateAttackCost(battler, ['fire', 'colorless']);
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual({});
  });

  it('passes when enough total energy for colorless', () => {
    battler.attachedEnergies = emptyZone();
    battler.attachedEnergies.water = 3;
    const result = validateAttackCost(battler, ['fire', 'colorless']);
    expect(result.valid).toBe(true);
  });

  it('fails when missing specific typed energy', () => {
    battler.attachedEnergies = emptyZone();
    battler.attachedEnergies.water = 1;
    const result = validateAttackCost(battler, ['fire', 'colorless']);
    expect(result.valid).toBe(false);
    expect(Object.keys(result.missing).length).toBeGreaterThan(0);
  });
});

describe('applyWeakness', () => {
  it('adds 20 when attacker type matches defender weakness', () => {
    expect(applyWeakness(30, 'water', 'water')).toBe(50);
    expect(applyWeakness(30, 'fire', 'fire')).toBe(50);
    expect(applyWeakness(50, 'fire', 'water')).toBe(50);
  });

  it('returns base damage when no weakness', () => {
    expect(applyWeakness(30, 'fire', null)).toBe(30);
  });
});

describe('countEnergies', () => {
  it('sums all attached energies', () => {
    const battler: Battler = {
      card: testPokemon('Eevee', 'colorless', 50),
      currentHp: 50,
      attachedEnergies: emptyZone(),
      status: 'active',
    };
    battler.attachedEnergies.grass = 2;
    battler.attachedEnergies.fire = 1;
    expect(countEnergies(battler)).toBe(3);
  });
});

describe('discardEnergiesForRetreat', () => {
  it('removes N energies of any type', () => {
    const battler: Battler = {
      card: testPokemon('Eevee', 'colorless', 50),
      currentHp: 50,
      attachedEnergies: emptyZone(),
      status: 'active',
    };
    battler.attachedEnergies.grass = 2;
    battler.attachedEnergies.fire = 1;

    const result = discardEnergiesForRetreat(battler, 2);
    expect(countEnergies(result.battler)).toBe(1);
    expect(result.discarded).toHaveLength(2);
  });

  it('removes all if count exceeds attached', () => {
    const battler: Battler = {
      card: testPokemon('Eevee', 'colorless', 50),
      currentHp: 50,
      attachedEnergies: emptyZone(),
      status: 'active',
    };
    battler.attachedEnergies.grass = 1;
    const result = discardEnergiesForRetreat(battler, 5);
    expect(countEnergies(result.battler)).toBe(0);
  });
});

describe('attack', () => {
  it('deals damage when enough energy', () => {
    let state = createTestState();
    state.turnNumber = 2;
    state.turnPhase = 'main';
    state.players.p1.activeBattler!.attachedEnergies.grass = 2;
    state.players.p1.activeBattler!.card.attacks[0] = {
      name: 'Tackle',
      damage: 20,
      cost: ['grass'],
      effect: '',
    };

    const result = attack(state, 'p1', 0);
    expect(result.success).toBe(true);
    expect(result.state!.players.p2.activeBattler!.currentHp).toBe(
      state.players.p2.activeBattler!.card.hp - 20,
    );
    expect(result.state!.turnPhase).toBe('end');
  });

  it('applies weakness bonus', () => {
    let state = createTestState();
    state.turnNumber = 2;
    state.turnPhase = 'main';
    state.players.p2.activeBattler!.currentHp = 100; // ensure survives
    state.players.p1.activeBattler!.card.types = ['water'];
    state.players.p1.activeBattler!.card.attacks[0] = {
      name: 'Splash',
      damage: 20,
      cost: ['water'],
      effect: '',
    };
    state.players.p1.activeBattler!.attachedEnergies.water = 2;
    state.players.p2.activeBattler!.card.weakness = 'water';

    const result = attack(state, 'p1', 0);
    expect(result.success).toBe(true);
    // base 20 + 20 weakness = 40 damage
    expect(result.state!.players.p2.activeBattler!.currentHp).toBe(60);
  });

  it('fails without enough energy', () => {
    let state = createTestState();
    state.turnNumber = 2;
    state.turnPhase = 'main';
    state.players.p1.activeBattler!.attachedEnergies = emptyZone();
    state.players.p1.activeBattler!.card.attacks[0] = {
      name: 'Tackle',
      damage: 20,
      cost: ['grass', 'grass'],
      effect: '',
    };

    const result = attack(state, 'p1', 0);
    expect(result.success).toBe(false);
    expect(result.error).toContain('energy');
  });

  it('awards points on KO and forces switch', () => {
    let state = createTestState();
    state.turnNumber = 2;
    state.turnPhase = 'main';
    state.players.p2.activeBattler!.currentHp = 10;
    state.players.p1.activeBattler!.attachedEnergies.grass = 2;
    state.players.p1.activeBattler!.card.attacks[0] = {
      name: 'Tackle',
      damage: 20,
      cost: ['grass'],
      effect: '',
    };
    state.players.p2.bench = [
      {
        card: testPokemon('Machop', 'fighting', 60),
        currentHp: 60,
        attachedEnergies: emptyZone(),
        status: 'bench',
      },
    ];

    const result = attack(state, 'p1', 0);
    expect(result.success).toBe(true);
    expect(result.state!.players.p1.points).toBe(1);
    expect(result.state!.players.p2.activeBattler!.card.name).toBe('Machop');
    expect(result.state!.players.p2.bench).toHaveLength(0);
  });

  it('awards 2 points for EX KO', () => {
    let state = createTestState();
    state.turnNumber = 2;
    state.turnPhase = 'main';
    state.players.p2.activeBattler!.card.isEx = true;
    state.players.p2.activeBattler!.currentHp = 10;
    state.players.p1.activeBattler!.attachedEnergies.grass = 2;
    state.players.p1.activeBattler!.card.attacks[0] = {
      name: 'Tackle',
      damage: 20,
      cost: ['grass'],
      effect: '',
    };
    state.players.p2.bench = [
      {
        card: testPokemon('Machop', 'fighting', 60),
        currentHp: 60,
        attachedEnergies: emptyZone(),
        status: 'bench',
      },
    ];

    const result = attack(state, 'p1', 0);
    expect(result.success).toBe(true);
    expect(result.state!.players.p1.points).toBe(2);
  });

  it('declares loss if no bench on KO', () => {
    let state = createTestState();
    state.turnNumber = 2;
    state.turnPhase = 'main';
    state.players.p2.activeBattler!.currentHp = 10;
    state.players.p2.bench = [];
    state.players.p1.activeBattler!.attachedEnergies.grass = 2;
    state.players.p1.activeBattler!.card.attacks[0] = {
      name: 'Tackle',
      damage: 20,
      cost: ['grass'],
      effect: '',
    };

    const result = attack(state, 'p1', 0);
    expect(result.success).toBe(true);
    expect(result.state!.winner).toBe('p1');
  });
});

describe('switchActive', () => {
  it('swaps active with bench and discards retreat cost', () => {
    let state = createTestState();
    state.turnPhase = 'main';
    state.players.p1.activeBattler!.attachedEnergies.grass = 2;
    const oldActiveName = state.players.p1.activeBattler!.card.name;
    const benchName = state.players.p1.bench[0].card.name;

    const result = switchActive(state, 'p1', 0);
    expect(result.success).toBe(true);
    expect(result.state!.players.p1.activeBattler!.card.name).toBe(benchName);
    expect(result.state!.players.p1.bench.some((b) => b.card.name === oldActiveName)).toBe(true);
    expect(countEnergies(result.state!.players.p1.activeBattler!)).toBeLessThanOrEqual(
      countEnergies(state.players.p1.bench[0]),
    );
  });

  it('fails without bench Pokemon', () => {
    let state = createTestState();
    state.turnPhase = 'main';
    state.players.p1.bench = [];

    const result = switchActive(state, 'p1', 0);
    expect(result.success).toBe(false);
    expect(result.error).toContain('bench');
  });

  it('fails when active has no energy for retreat', () => {
    let state = createTestState();
    state.turnPhase = 'main';
    state.players.p1.activeBattler!.attachedEnergies = emptyZone();

    const result = switchActive(state, 'p1', 0);
    expect(result.success).toBe(false);
    expect(result.error).toContain('energy');
  });
});

describe('endTurn', () => {
  it('advances to next player and resets flags', () => {
    let state = createTestState();
    state.players.p1.hasAttachedEnergy = true;
    state.players.p1.hasUsedSupporter = true;
    state.turnNumber = 2;

    state = endTurn(state);
    expect(state.currentTurn).toBe('p2');
    expect(state.players.p1.hasAttachedEnergy).toBe(false);
    expect(state.players.p1.hasUsedSupporter).toBe(false);
    expect(state.turnNumber).toBe(3);
    expect(state.turnPhase).toBe('draw');
  });

  it('generates energy for next player', () => {
    let state = createTestState();
    state.turnNumber = 2;
    state = endTurn(state);
    const total = Object.values(state.players.p2.energyZone).reduce((a, b) => a + b, 0);
    expect(total).toBe(1);
  });
});

describe('drawCard', () => {
  it('draws one card from deck (after first turn)', () => {
    const bigDeck = Array(10).fill(null).map((_, i) =>
      testPokemon(`Pokemon ${i}`, 'grass', 40)
    );
    let state = createTestState({ deck: bigDeck });
    state.turnNumber = 2;
    const originalHandSize = state.players.p1.hand.length;
    const originalDeckSize = state.players.p1.deck.length;
    state = drawCard(state, 'p1');
    expect(state.players.p1.hand.length).toBe(originalHandSize + 1);
    expect(state.players.p1.deck.length).toBe(originalDeckSize - 1);
  });

  it('does not exceed hand limit', () => {
    let state = createTestState();
    state.players.p1.hand = Array(10).fill(testPokemon('Filler', 'grass', 10));
    const originalDeckSize = state.players.p1.deck.length;
    state = drawCard(state, 'p1');
    expect(state.players.p1.hand.length).toBe(10);
    expect(state.players.p1.deck.length).toBe(originalDeckSize);
  });

  it('does not draw on first turn', () => {
    let state = createTestState();
    state.turnNumber = 1;
    const originalHandSize = state.players.p1.hand.length;
    state = drawCard(state, 'p1');
    expect(state.players.p1.hand.length).toBe(originalHandSize);
  });
});

describe('useTrainer', () => {
  it('moves trainer from hand to discard', () => {
    let state = createTestState();
    state.turnPhase = 'main';
    state.players.p1.hand = [testTrainer('Potion')];

    const result = useTrainer(state, 'p1', 0);
    expect(result.success).toBe(true);
    expect(result.state!.players.p1.hand).toHaveLength(0);
    expect(result.state!.players.p1.discard).toHaveLength(1);
    expect(result.state!.players.p1.discard[0].name).toBe('Potion');
  });

  it('rejects non-trainer cards', () => {
    let state = createTestState();
    state.turnPhase = 'main';
    state.players.p1.hand = [testPokemon('Bulbasaur', 'grass', 40)];

    const result = useTrainer(state, 'p1', 0);
    expect(result.success).toBe(false);
    expect(result.error).toContain('trainer');
  });
});

describe('checkVictory', () => {
  it('returns playerId at 3 points', () => {
    let state = createTestState();
    state.players.p1.points = 3;
    expect(checkVictory(state)).toBe('p1');
  });

  it('returns null under 3 points', () => {
    let state = createTestState();
    state.players.p1.points = 2;
    expect(checkVictory(state)).toBeNull();
  });
});
