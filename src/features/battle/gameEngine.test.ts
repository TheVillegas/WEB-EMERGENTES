import { describe, expect, it } from 'vitest';
import { assignEnergy, canAttack, createMatch, playCard, resetMatch, resolveAttack } from './gameEngine';
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

describe('gameEngine', () => {
  it('creates a deterministic match and lets the player choose an active card', () => {
    const match = createMatch(catalog, 1);
    const selected = playCard(match, 'charmander-1');

    expect(match.phase).toBe('selecting-active');
    expect(match.npcActive?.name).toBe('Pikachu');
    expect(selected.phase).toBe('player-turn');
    expect(selected.playerActive?.name).toBe('Charmander');
    expect(selected.playerHand.map((card) => card.name)).toEqual(['Bulbasaur', 'Squirtle']);
  });

  it('assigns energy, unlocks attacks and resolves knockouts', () => {
    const selected = playCard(createMatch(catalog, 1), 'charmander-1');
    const energized = assignEnergy(selected, 'player');
    const attacked = resolveAttack(energized, 'player');

    expect(canAttack(energized.playerActive)).toBe(true);
    expect(attacked.npcActive?.currentHp).toBe(30);
    expect(attacked.phase).toBe('npc-turn');
    expect(attacked.turn).toBe('npc');
  });

  it('declares victory and resets cleanly after a knockout', () => {
    const selected = playCard(createMatch(catalog, 2), 'bulbasaur-0');
    const once = assignEnergy(selected, 'player');
    const ready = {
      ...once,
      playerActive: once.playerActive ? { ...once.playerActive, energy: 2 } : null,
      npcActive: once.npcActive ? { ...once.npcActive, currentHp: 20 } : null,
      energyAssignedThisTurn: true,
    };
    const finished = resolveAttack(ready, 'player');
    const restarted = resetMatch(finished);

    expect(finished.winner).toBe('player');
    expect(finished.phase).toBe('game-over');
    expect(restarted.phase).toBe('selecting-active');
    expect(restarted.log).toEqual(['Nueva partida iniciada.', 'NPC activa a Pikachu.']);
    expect(restarted.matchId).toBe(3);
  });
});
