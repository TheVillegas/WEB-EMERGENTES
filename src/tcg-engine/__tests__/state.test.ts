import { describe, expect, it } from 'vitest';
import { createInitialState, drawCards, shuffleArray } from '../state';
import type { PokemonCard, TcgCard } from '../types';

const testPokemon = (name: string, type: 'grass' | 'fire' | 'water', hp: number): PokemonCard => ({
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
      energyZone: {} as Record<string, number>,
      points: 0,
      activeBattler: null,
      hasAttachedEnergy: false,
      hasUsedSupporter: false,
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
      energyZone: {} as Record<string, number>,
      points: 0,
      activeBattler: null,
      hasAttachedEnergy: false,
      hasUsedSupporter: false,
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
      energyZone: {} as Record<string, number>,
      points: 0,
      activeBattler: null,
      hasAttachedEnergy: false,
      hasUsedSupporter: false,
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

  it('sets first Pokemon as active and rest to bench (max 3)', () => {
    const state = createInitialState([...deck1], [...deck2], 'p1', 'p2');

    expect(state.players.p1.activeBattler).not.toBeNull();
    expect(state.players.p1.activeBattler?.status).toBe('active');
    expect(state.players.p1.bench.length).toBeLessThanOrEqual(3);
  });

  it('starts with empty energy zones and zero points', () => {
    const state = createInitialState([...deck1], [...deck2], 'p1', 'p2');

    expect(Object.values(state.players.p1.energyZone).every((v) => v === 0)).toBe(true);
    expect(state.players.p1.points).toBe(0);
    expect(Object.values(state.players.p2.energyZone).every((v) => v === 0)).toBe(true);
    expect(state.players.p2.points).toBe(0);
  });

  it('sets p1 as first turn', () => {
    const state = createInitialState([...deck1], [...deck2], 'p1', 'p2');

    expect(state.currentTurn).toBe('p1');
    expect(state.turnOrder).toEqual(['p1', 'p2']);
    expect(state.turnNumber).toBe(1);
    expect(state.winner).toBeNull();
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

    // 1 card drawn, becomes active, hand is empty
    expect(state.players.p1.hand).toHaveLength(0);
    expect(state.players.p1.activeBattler?.card.name).toBe('Solo');
    expect(state.players.p1.bench).toHaveLength(0);
  });
});
