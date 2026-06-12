import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NpcService } from '../npc/npcService';
import { createBattleStore } from './store';
import type { Card, CsvCardRow } from '../cards/types';

vi.mock('../../tcg-engine/state', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../tcg-engine/state')>();
  return {
    ...actual,
    rollDice: vi.fn(() => 2), // Even = Player starts
  };
});

const catalog: Card[] = [
  {
    id: 'bulbasaur-0',
    name: 'Bulbasaur',
    category: 'Pokémon',
    type: 'Grass',
    hp: 40,
    attackName: 'Leech Seed',
    attackDamage: 20,
    attackCost: 2,
    imageSmall: 'bulbasaur.png',
    imageLarge: 'bulbasaur-large.png',

  },
  {
    id: 'charmander-1',
    name: 'Charmander',
    category: 'Pokémon',
    type: 'Fire',
    hp: 50,
    attackName: 'Scratch',
    attackDamage: 10,
    attackCost: 1,
    imageSmall: 'charmander.png',
    imageLarge: 'charmander-large.png',

  },
  {
    id: 'squirtle-2',
    name: 'Squirtle',
    category: 'Pokémon',
    type: 'Water',
    hp: 40,
    attackName: 'Bubble',
    attackDamage: 10,
    attackCost: 1,
    imageSmall: 'squirtle.png',
    imageLarge: 'squirtle-large.png',

  },
  {
    id: 'pikachu-3',
    name: 'Pikachu',
    category: 'Pokémon',
    type: 'Lightning',
    hp: 40,
    attackName: 'Gnaw',
    attackDamage: 10,
    attackCost: 1,
    imageSmall: 'pikachu.png',
    imageLarge: 'pikachu-large.png',

  },
  {
    id: 'eevee-4',
    name: 'Eevee',
    category: 'Pokémon',
    type: 'Colorless',
    hp: 50,
    attackName: 'Tail Wag',
    attackDamage: 0,
    attackCost: 1,
    imageSmall: 'eevee.png',
    imageLarge: 'eevee-large.png',

  },
  {
    id: 'abra-5',
    name: 'Abra',
    category: 'Pokémon',
    type: 'Psychic',
    hp: 30,
    attackName: 'Psyshock',
    attackDamage: 10,
    attackCost: 1,
    imageSmall: 'abra.png',
    imageLarge: 'abra-large.png',

  },
];

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const mockCsvRows = catalog.map(c => ({
  nombre: c.name,
  categoria: c.category,
  tipo: c.type,
  hp: String(c.hp),
  ataque_1_nombre: c.attackName,
  ataque_1_dano: String(c.attackDamage),
  ataque_1_costo: Array(c.attackCost).fill(c.type).join(', '),
  imagen_small: c.imageSmall,
  imagen_large: c.imageLarge,
})) as unknown as CsvCardRow[];

describe('battleStore', () => {
  it('bootstraps the match and applies player active selection through zustand', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // diceRoll = 4 (player first)
    const store = createBattleStore({ decideAction: vi.fn() } as unknown as NpcService);

    store.getState().initializeCatalog(catalog, mockCsvRows);
    store.getState().startMatch();
    const hand = store.getState().tcgState!.players['player'].hand;
    const activeCardId = hand[0].id;
    const activeCardName = hand[0].name;
    store.getState().selectPlayerActive(activeCardId);
    if (store.getState().pendingAction === 'select-bench') {
      store.getState().selectBenchPokemon([]);
    }

    const match = store.getState().match;
    expect(store.getState().catalogStatus).toBe('ready');
    expect(match?.phase).toBe('player-turn');
    expect(match?.playerActive?.name).toBe(activeCardName);
  });

  it('runs the offline NPC turn after a player attack', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // diceRoll = 4 (player first)

    const store = createBattleStore();

    store.getState().initializeCatalog(catalog, mockCsvRows);
    store.getState().startMatch();
    const hand = store.getState().tcgState!.players['player'].hand;
    const activeCardId = hand[0].id;
    store.getState().selectPlayerActive(activeCardId);
    if (store.getState().pendingAction === 'select-bench') {
      store.getState().selectBenchPokemon([]);
    }
    store.getState().assignPlayerEnergy();

    const turnPromise = store.getState().playerAttack();
    await Promise.resolve(); // Allow microtasks to queue the setTimeout
    await vi.advanceTimersByTimeAsync(800);
    await turnPromise;

    const match = store.getState().match;
    expect(match?.turn).toBe('player');
    expect(match?.phase).toBe('player-turn');
  });
});
