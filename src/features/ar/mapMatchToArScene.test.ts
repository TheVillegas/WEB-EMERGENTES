import { describe, expect, it } from 'vitest';
import { createMatch } from '../battle/gameEngine';
import type { Card } from '../cards/types';
import { CARD_BACK_URL } from './constants';
import { mapMatchToArScene } from './mapMatchToArScene';

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
    imageSmall: 'bulbasaur-small.png',
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
    imageSmall: 'charmander-small.png',
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
    imageSmall: 'squirtle-small.png',
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
    imageSmall: 'pikachu-small.png',
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
    imageSmall: 'eevee-small.png',
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
    imageSmall: 'abra-small.png',
    imageLarge: 'abra-large.png',
  },
];

describe('mapMatchToArScene', () => {
  it('maps player cards to front textures and npc hand to the shared back texture', () => {
    const match = createMatch(catalog, 1);
    const scene = mapMatchToArScene(match);

    const npcHandSlots = scene.slots.filter((slot) => slot.zone === 'npcHand');
    const playerHandSlots = scene.slots.filter((slot) => slot.zone === 'playerHand');
    const npcActiveSlot = scene.slots.find((slot) => slot.zone === 'npcActive');

    expect(npcHandSlots.length).toBe(match.npcHand.length);
    expect(npcHandSlots.every((slot) => slot.face === 'back' && slot.textureUrl === CARD_BACK_URL)).toBe(true);

    expect(playerHandSlots.length).toBe(match.playerHand.length);
    expect(playerHandSlots.every((slot) => slot.face === 'front' && slot.textureUrl.endsWith('-large.png'))).toBe(
      true,
    );

    expect(npcActiveSlot?.face).toBe('front');
    expect(npcActiveSlot?.textureUrl).toBe('pikachu-large.png');
  });
});
