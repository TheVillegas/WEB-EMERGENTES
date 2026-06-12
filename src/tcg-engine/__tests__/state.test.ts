import { describe, expect, it, vi } from 'vitest';
import { createInitialState, drawCards, shuffleArray } from '../state';
import type { EnergyType, PokemonCard, TcgCard } from '../types';

const testPokemon = (name: string, type: EnergyType, hp: number): PokemonCard => ({
  id: `${name.toLowerCase()}-0`,
  name,
  types: [type],
  hp,
  attacks: [
    { name: 'Tackle', damage: 10, cost: [type], effect: '' },
  ],
  weakness: null,
  retreatCost: 1,
  isEx: false,
  stage: 'basic',
  evolvesFrom: null,
  imageSmall: '',
  imageLarge: '',
});

const deck1: TcgCard[] = [
  testPokemon('Bulbasaur', 'grass', 40),
  testPokemon('Charmander', 'fire', 50),
  testPokemon('Squirtle', 'water', 40),
  testPokemon('Pikachu', 'lightning', 40),
  testPokemon('Eevee', 'colorless', 50),
];

const deck2: TcgCard[] = [
  testPokemon('Abra', 'psychic', 30),
  testPokemon('Machop', 'fighting', 60),
  testPokemon('Ghastly', 'darkness', 40),
  testPokemon('Onix', 'metal', 60),
  testPokemon('Dratini', 'dragon', 40),
];

describe('shuffleArray', () => {
  it('returns a new array with the same elements', () => {
    const original = [1, 2, 3, 4, 5];
    const shuffled = shuffleArray(original);

    expect(shuffled).not.toBe(original);
    expect(shuffled.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it('handles empty arrays', () => {
    expect(shuffleArray([])).toEqual([]);
  });
});

describe('drawCards', () => {
  it('draws the requested count from deck to hand', () => {
    const player = {
      hand: [],
      deck: [...deck1],
      discard: [],
      bench: [],
      energyZone: {} as Record<EnergyType, number>,
      points: 0,
      activeBattler: null,
      hasAttachedEnergy: false,
      hasUsedSupporter: false,
      hasEvolved: false,
      hasRetreated: false,
    };

    const result = drawCards(player, 3);

    expect(result.drawn).toHaveLength(3);
    expect(result.player.deck).toHaveLength(2);
    expect(result.player.hand).toHaveLength(3);
  });

  it('caps hand at 10 cards', () => {
    const player = {
      hand: Array(8).fill(testPokemon('Filler', 'grass', 10)),
      deck: [...deck1],
      discard: [],
      bench: [],
      energyZone: {} as Record<EnergyType, number>,
      points: 0,
      activeBattler: null,
      hasAttachedEnergy: false,
      hasUsedSupporter: false,
      hasEvolved: false,
      hasRetreated: false,
    };

    const result = drawCards(player, 5);

    expect(result.player.hand).toHaveLength(10);
    expect(result.drawn).toHaveLength(2);
  });

  it('stops when deck is empty', () => {
    const player = {
      hand: [],
      deck: [testPokemon('Only', 'grass', 10)],
      discard: [],
      bench: [],
      energyZone: {} as Record<EnergyType, number>,
      points: 0,
      activeBattler: null,
      hasAttachedEnergy: false,
      hasUsedSupporter: false,
      hasEvolved: false,
      hasRetreated: false,
    };

    const result = drawCards(player, 5);

    expect(result.drawn).toHaveLength(1);
    expect(result.player.deck).toHaveLength(0);
  });
});

describe('createInitialState', () => {
  it('shuffles both decks and draws 5 cards', () => {
    const state = createInitialState([...deck1], [...deck2], 'p1', 'p2');

    // 5 drawn, 1 active + up to 3 bench = remaining in hand
    expect(state.players.p1.hand.length + (state.players.p1.activeBattler ? 1 : 0) + state.players.p1.bench.length).toBe(5);
    expect(state.players.p1.deck).toHaveLength(0);
    expect(state.players.p2.hand.length + (state.players.p2.activeBattler ? 1 : 0) + state.players.p2.bench.length).toBe(5);
    expect(state.players.p2.deck).toHaveLength(0);
  });

  it('leaves activeBattler null and all drawn cards in hand', () => {
    const state = createInitialState([...deck1], [...deck2], 'p1', 'p2');

    expect(state.players.p1.activeBattler).toBeNull();
    expect(state.players.p1.bench).toHaveLength(0);
    expect(state.players.p1.hand).toHaveLength(5);
  });

  it('starts with empty energy zones and zero points', () => {
    const state = createInitialState([...deck1], [...deck2], 'p1', 'p2');

    expect(Object.values(state.players.p1.energyZone).every((v) => v === 0)).toBe(true);
    expect(state.players.p1.points).toBe(0);
    expect(Object.values(state.players.p2.energyZone).every((v) => v === 0)).toBe(true);
    expect(state.players.p2.points).toBe(0);
  });

  it('sets first turn based on dice roll (mocked to p1)', () => {
    vi.mock('../state', async (importOriginal) => {
      const mod = await importOriginal<typeof import('../state')>();
      return {
        ...mod,
        rollDice: vi.fn(() => 2), // Even = p1
      };
    });

    const state = createInitialState([...deck1], [...deck2], 'p1', 'p2');

    expect(['p1', 'p2']).toContain(state.currentTurn);
    expect(state.turnOrder).toEqual(['p1', 'p2']);
    expect(state.turnNumber).toBe(1);
    expect(state.winner).toBeNull();
    vi.unmock('../state');
  });

  it('initializes per-turn flags to false', () => {
    const state = createInitialState([...deck1], [...deck2], 'p1', 'p2');

    expect(state.players.p1.hasAttachedEnergy).toBe(false);
    expect(state.players.p1.hasUsedSupporter).toBe(false);
    expect(state.players.p2.hasAttachedEnergy).toBe(false);
    expect(state.players.p2.hasUsedSupporter).toBe(false);
  });

  it('handles decks with fewer than 5 cards', () => {
    const smallDeck = [testPokemon('Solo', 'grass', 10)];
    const state = createInitialState(smallDeck, [...deck2], 'p1', 'p2');

    // 1 card drawn, remains in hand
    expect(state.players.p1.hand).toHaveLength(1);
    expect(state.players.p1.activeBattler).toBeNull();
    expect(state.players.p1.bench).toHaveLength(0);
  });
});
