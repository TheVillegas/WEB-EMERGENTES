import type { TcgCard } from '../tcg-engine/types';
import type { DeckType } from '../features/battle/types';
import { isPokemonCard } from '../tcg-engine/engine';

/**
 * Deck definitions: each deck has 30 card names.
 * Cards are matched against the loaded CSV catalog by name.
 * Format: { name, count }
 */
interface DeckEntry {
  name: string;
  count: number;
}

const FIRE_DECK: DeckEntry[] = [
  // Basic Pokemon (12)
  { name: 'Charmander', count: 3 },
  { name: 'Vulpix', count: 3 },
  { name: 'Growlithe', count: 3 },
  { name: 'Ponyta', count: 3 },
  // Stage 1 Evolution (8)
  { name: 'Charmeleon', count: 2 },
  { name: 'Ninetales', count: 2 },
  { name: 'Arcanine', count: 2 },
  { name: 'Rapidash', count: 2 },
  // Trainers (10)
  { name: 'Potion', count: 2 },
  { name: 'Bill', count: 2 },
  { name: 'Switch', count: 1 },
  { name: 'Professor Oak', count: 1 },
  { name: 'Super Potion', count: 1 },
  { name: 'Energy Removal', count: 1 },
  { name: 'Gust of Wind', count: 1 },
  { name: 'Revive', count: 1 },
];

const WATER_DECK: DeckEntry[] = [
  { name: 'Squirtle', count: 3 },
  { name: 'Seel', count: 3 },
  { name: 'Psyduck', count: 3 },
  { name: 'Staryu', count: 3 },
  { name: 'Wartortle', count: 2 },
  { name: 'Dewgong', count: 2 },
  { name: 'Golduck', count: 2 },
  { name: 'Starmie', count: 2 },
  { name: 'Potion', count: 2 },
  { name: 'Bill', count: 2 },
  { name: 'Switch', count: 1 },
  { name: 'Professor Oak', count: 1 },
  { name: 'Super Potion', count: 1 },
  { name: 'Energy Removal', count: 1 },
  { name: 'Revive', count: 1 },
  { name: 'Poké Ball', count: 1 },
];

const GRASS_DECK: DeckEntry[] = [
  { name: 'Bulbasaur', count: 3 },
  { name: 'Oddish', count: 3 },
  { name: 'Bellsprout', count: 3 },
  { name: 'Tangela', count: 3 },
  { name: 'Ivysaur', count: 2 },
  { name: 'Gloom', count: 2 },
  { name: 'Weepinbell', count: 2 },
  { name: 'Venusaur', count: 1 },
  { name: 'Vileplume', count: 1 },
  { name: 'Potion', count: 2 },
  { name: 'Bill', count: 2 },
  { name: 'Switch', count: 1 },
  { name: 'Professor Oak', count: 1 },
  { name: 'Revive', count: 1 },
  { name: 'Energy Retrieval', count: 1 },
  { name: 'Gust of Wind', count: 1 },
  { name: 'Full Heal', count: 1 },
];

const FIGHTING_DECK: DeckEntry[] = [
  { name: 'Machop', count: 3 },
  { name: 'Geodude', count: 3 },
  { name: 'Mankey', count: 3 },
  { name: 'Cubone', count: 3 },
  { name: 'Machoke', count: 2 },
  { name: 'Graveler', count: 2 },
  { name: 'Primeape', count: 2 },
  { name: 'Hitmonlee', count: 1 },
  { name: 'Hitmonchan', count: 1 },
  { name: 'Potion', count: 2 },
  { name: 'Bill', count: 2 },
  { name: 'Switch', count: 1 },
  { name: 'Professor Oak', count: 1 },
  { name: 'Super Potion', count: 1 },
  { name: 'Revive', count: 1 },
  { name: 'PlusPower', count: 1 },
  { name: 'Gust of Wind', count: 1 },
];

const PSYCHIC_DECK: DeckEntry[] = [
  { name: 'Abra', count: 3 },
  { name: 'Gastly', count: 3 },
  { name: 'Drowzee', count: 3 },
  { name: 'Slowpoke', count: 3 },
  { name: 'Kadabra', count: 2 },
  { name: 'Haunter', count: 2 },
  { name: 'Hypno', count: 2 },
  { name: 'Jynx', count: 1 },
  { name: 'Mr. Mime', count: 1 },
  { name: 'Potion', count: 2 },
  { name: 'Bill', count: 2 },
  { name: 'Switch', count: 1 },
  { name: 'Professor Oak', count: 1 },
  { name: 'Energy Removal', count: 1 },
  { name: 'Full Heal', count: 1 },
  { name: 'Revive', count: 1 },
  { name: 'Poké Ball', count: 1 },
];

const COLORLESS_DECK: DeckEntry[] = [
  { name: 'Eevee', count: 3 },
  { name: 'Jigglypuff', count: 3 },
  { name: 'Pidgey', count: 3 },
  { name: 'Rattata', count: 3 },
  { name: 'Meowth', count: 2 },
  { name: 'Wigglytuff', count: 2 },
  { name: 'Pidgeotto', count: 2 },
  { name: 'Raticate', count: 2 },
  { name: 'Chansey', count: 1 },
  { name: 'Potion', count: 2 },
  { name: 'Bill', count: 2 },
  { name: 'Switch', count: 1 },
  { name: 'Professor Oak', count: 1 },
  { name: 'Super Potion', count: 1 },
  { name: 'Revive', count: 1 },
  { name: 'Recycle', count: 1 },
];

const LIGHTNING_DECK: DeckEntry[] = [
  { name: 'Pikachu', count: 3 },
  { name: 'Voltorb', count: 3 },
  { name: 'Magnemite', count: 3 },
  { name: 'Electabuzz', count: 3 },
  { name: 'Raichu', count: 2 },
  { name: 'Electrode', count: 2 },
  { name: 'Magneton', count: 2 },
  { name: 'Zapdos', count: 1 },
  { name: 'Jolteon', count: 1 },
  { name: 'Potion', count: 2 },
  { name: 'Bill', count: 2 },
  { name: 'Switch', count: 1 },
  { name: 'Professor Oak', count: 1 },
  { name: 'Energy Removal', count: 1 },
  { name: 'PlusPower', count: 1 },
  { name: 'Revive', count: 1 },
  { name: 'Gust of Wind', count: 1 },
];

const DECK_MAP: Record<DeckType, DeckEntry[]> = {
  'Fuego': FIRE_DECK,
  'Agua': WATER_DECK,
  'Planta': GRASS_DECK,
  'Lucha': FIGHTING_DECK,
  'Psíquico': PSYCHIC_DECK,
  'Incoloro': COLORLESS_DECK,
  'Rayo': LIGHTNING_DECK,
};

/**
 * Find a card in the catalog by name (case-insensitive, first match).
 */
function findCardByName(allCards: TcgCard[], name: string): TcgCard | null {
  const lowerName = name.toLowerCase();
  return allCards.find((c) => {
    const cardName = isPokemonCard(c) ? c.name : (c as any).name;
    return cardName?.toLowerCase() === lowerName;
  }) ?? null;
}

/**
 * Build a deck of 30 TcgCards for a given DeckType from the catalog.
 * If a named card isn't found in the catalog, tries to find a fallback of the same type.
 */
export function getDeckByType(type: DeckType, allCards: TcgCard[]): TcgCard[] {
  const entries = DECK_MAP[type];
  if (!entries) return allCards.slice(0, 30);

  const deck: TcgCard[] = [];

  for (const entry of entries) {
    const card = findCardByName(allCards, entry.name);
    if (card) {
      // Add card N times (each needs a unique ID for game tracking)
      for (let i = 0; i < entry.count; i++) {
        deck.push({
          ...card,
          id: `${card.id}-copy-${i}`,
        } as TcgCard);
      }
    }
  }

  // If we didn't reach 30, pad with type-matching Pokemon from catalog
  if (deck.length < 30) {
    const typeMap: Record<DeckType, string> = {
      'Fuego': 'fire',
      'Agua': 'water',
      'Planta': 'grass',
      'Lucha': 'fighting',
      'Psíquico': 'psychic',
      'Incoloro': 'colorless',
      'Rayo': 'lightning',
    };
    const energyType = typeMap[type];
    const usedIds = new Set(deck.map((c) => c.id));

    const fillers = allCards.filter((c) => {
      if (usedIds.has(c.id)) return false;
      if (!isPokemonCard(c)) return false;
      return (c as any).types?.includes(energyType);
    });

    let fillerIdx = 0;
    while (deck.length < 30 && fillerIdx < fillers.length) {
      deck.push({ ...fillers[fillerIdx], id: `${fillers[fillerIdx].id}-filler-${fillerIdx}` } as TcgCard);
      fillerIdx++;
    }
  }

  return deck.slice(0, 30);
}

/**
 * Get the deck type info for UI display.
 */
export const DECK_INFO: Record<DeckType, { emoji: string; label: string; description: string; cssClass: string }> = {
  'Fuego': {
    emoji: '🔥',
    label: 'Mazo Fuego',
    description: 'Potencia ofensiva y daño directo. Quema a tus enemigos rápidamente.',
    cssClass: 'deck-card--fuego',
  },
  'Agua': {
    emoji: '💧',
    label: 'Mazo Agua',
    description: 'Control y resistencia. Desgasta a tus oponentes con paciencia.',
    cssClass: 'deck-card--agua',
  },
  'Planta': {
    emoji: '🍃',
    label: 'Mazo Planta',
    description: 'Sinergia y curación. Mantén a tus Pokémon saludables en combate.',
    cssClass: 'deck-card--planta',
  },
  'Lucha': {
    emoji: '🥊',
    label: 'Mazo Lucha',
    description: 'Fuerza bruta y resistencia. Golpes poderosos que destrozan la defensa.',
    cssClass: 'deck-card--lucha',
  },
  'Psíquico': {
    emoji: '🔮',
    label: 'Mazo Psíquico',
    description: 'Poderes mentales y control. Manipula el campo a tu favor.',
    cssClass: 'deck-card--psiquico',
  },
  'Incoloro': {
    emoji: '⭐',
    label: 'Mazo Incoloro',
    description: 'Versatilidad total. Adaptable a cualquier estrategia.',
    cssClass: 'deck-card--incoloro',
  },
  'Rayo': {
    emoji: '⚡',
    label: 'Mazo Rayo',
    description: 'Velocidad y precisión eléctrica. Ataques rápidos y devastadores.',
    cssClass: 'deck-card--rayo',
  },
};
