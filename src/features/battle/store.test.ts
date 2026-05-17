import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NpcService } from '../npc/npcService';
import { createBattleStore } from './store';
import type { Card } from '../cards/types';

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
});

describe('battleStore', () => {
  it('bootstraps the match and applies player active selection through zustand', () => {
    const store = createBattleStore({ decideAction: vi.fn() } as unknown as NpcService);

    store.getState().initializeCatalog(catalog);
    store.getState().selectPlayerActive('bulbasaur-0');

    const match = store.getState().match;
    expect(store.getState().catalogStatus).toBe('ready');
    expect(match?.phase).toBe('player-turn');
    expect(match?.playerActive?.name).toBe('Bulbasaur');
  });

  it('runs the offline NPC turn after a player attack', async () => {
    vi.useFakeTimers();

    const npcService: NpcService = {
      decideAction: vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 25));
        return { type: 'attach-energy', reason: 'arma el turno offline' };
      }),
    };
    const store = createBattleStore(npcService);

    store.getState().initializeCatalog(catalog);
    store.getState().selectPlayerActive('charmander-1');
    store.getState().assignPlayerEnergy();

    const turnPromise = store.getState().playerAttack();
    await vi.advanceTimersByTimeAsync(25);
    await turnPromise;

    const match = store.getState().match;
    expect(npcService.decideAction).toHaveBeenCalledOnce();
    expect(match?.turn).toBe('player');
    expect(match?.phase).toBe('player-turn');
    expect(match?.npcActive?.energy).toBe(1);
    expect(match?.playerActive?.currentHp).toBe(40);
    expect(match?.log.at(-1)).toContain('NPC usó Gnaw');
  });

  it('anota un aviso no bloqueante cuando el adapter HTTP cae y usa fallback local', async () => {
    const npcService: NpcService = {
      decideAction: vi.fn(async () => ({
        type: 'pass',
        reason: 'mock de contingencia',
        source: 'mock',
        notice: 'Backend NPC no disponible. Se usa mock local en este turno.',
      })),
    };
    const store = createBattleStore(npcService);

    store.getState().initializeCatalog(catalog);
    store.getState().selectPlayerActive('charmander-1');

    await store.getState().passPlayerTurn();

    const match = store.getState().match;
    expect(match?.log).toContain('Backend NPC no disponible. Se usa mock local en este turno.');
    expect(match?.log.at(-1)).toContain('NPC pasó el turno');
  });
});
