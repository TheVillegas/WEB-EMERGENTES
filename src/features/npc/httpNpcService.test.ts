import { describe, expect, it, vi } from 'vitest';
import type { Card } from '../cards/types';
import { HttpNpcService } from './httpNpcService';
import type { NpcService } from './npcService';
import { createMatch, playCard } from '../battle/gameEngine';

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

function createPlayableState() {
  return playCard(createMatch(catalog, 7), 'bulbasaur-0');
}

describe('HttpNpcService', () => {
  it('normaliza el contrato simple y marca la fuente http', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ action: 'attack', reason: 'backend listo' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const fallbackService: NpcService = { decideAction: vi.fn() };
    const service = new HttpNpcService({
      endpoint: '/decide-action',
      timeoutMs: 1500,
      contract: 'simple',
      fallbackService,
      fetchImpl: fetchMock,
    });

    const action = await service.decideAction(createPlayableState());

    expect(action).toEqual({ type: 'attack', reason: 'backend listo', source: 'http' });
    expect(fallbackService.decideAction).not.toHaveBeenCalled();
  });

  it('hace fallback al mock si fetch falla y agrega notice no bloqueante', async () => {
    const fallbackService: NpcService = {
      decideAction: vi.fn(async () => ({ type: 'attach-energy' as const, reason: 'mock seguro', source: 'mock' as const })),
    };
    const service = new HttpNpcService({
      endpoint: 'http://127.0.0.1:8000/decide-action',
      timeoutMs: 25,
      contract: 'simple',
      fallbackService,
      fetchImpl: vi.fn(async () => {
        throw new Error('connect ECONNREFUSED');
      }),
    });

    const action = await service.decideAction(createPlayableState());

    expect(action.type).toBe('attach-energy');
    expect(action.source).toBe('mock');
    expect(action.notice).toContain('Backend NPC no disponible');
    expect(fallbackService.decideAction).toHaveBeenCalledOnce();
  });

  it('encapsula el contrato legacy de /batalla/accion dentro del adapter', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        estado_partida: { turno: string; pokemon_npc: { nombre: string } };
      };

      expect(body.estado_partida.turno).toBe('jugador');
      expect(body.estado_partida.pokemon_npc.nombre).toBe('Pikachu');

      return new Response(JSON.stringify({ accion: 'asignar_energia', razon: 'legacy ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const service = new HttpNpcService({
      endpoint: 'http://127.0.0.1:8000/batalla/accion',
      timeoutMs: 1500,
      contract: 'legacy-batalla-accion',
      fallbackService: { decideAction: vi.fn() },
      fetchImpl: fetchMock,
    });

    const action = await service.decideAction(createPlayableState());

    expect(action).toEqual({ type: 'attach-energy', reason: 'legacy ok', source: 'http' });
  });
});
