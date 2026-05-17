import type { CsvCardRow } from '../cards/types';
import { normalizeCardRow, normalizeDamage, normalizeEnergyCost } from '../cards/types';
import type { CatalogCard } from './types';

// ---------------------------------------------------------------------------
// Sprite URL helpers
// ---------------------------------------------------------------------------

/**
 * National Pokédex numbers keyed by Pokémon name (lowercase).
 * Covers all Pokémon present in the current CSV data.
 * Extend this map as new cards are added to the catalog.
 */
const POKEDEX_BY_NAME: Record<string, number> = {
  bulbasaur:  1,
  ivysaur:    2,
  venusaur:   3,
  charmander: 4,
  charmeleon: 5,
  charizard:  6,
  squirtle:   7,
  wartortle:  8,
  blastoise:  9,
  caterpie:   10,
  metapod:    11,
  butterfree: 12,
  weedle:     13,
  kakuna:     14,
  beedrill:   15,
  pidgey:     16,
  rattata:    19,
  spearow:    21,
  ekans:      23,
  pikachu:    25,
  raichu:     26,
  sandshrew:  27,
  nidoran:    29,
  nidorina:   30,
  nidoqueen:  31,
  clefairy:   35,
  clefable:   36,
  vulpix:     37,
  ninetales:  38,
  jigglypuff: 39,
  wigglytuff: 40,
  abra:       63,
  kadabra:    64,
  alakazam:   65,
  machop:     66,
  geodude:    74,
  ponyta:     77,
  slowpoke:   79,
  magnemite:  81,
  gastly:     92,
  haunter:    93,
  gengar:     94,
  drowzee:    96,
  voltorb:    100,
  electrode:  101,
  chansey:    113,
  tangela:    114,
  kangaskhan: 115,
  horsea:     116,
  goldeen:    118,
  staryu:     120,
  starmie:    121,
  scyther:    123,
  jynx:       124,
  electabuzz: 125,
  magmar:     126,
  pinsir:     127,
  tauros:     128,
  magikarp:   129,
  gyarados:   130,
  lapras:     131,
  ditto:      132,
  eevee:      133,
  vaporeon:   134,
  jolteon:    135,
  flareon:    136,
  porygon:    137,
  omanyte:    138,
  omastar:    139,
  kabuto:     140,
  kabutops:   141,
  aerodactyl: 142,
  snorlax:    143,
  articuno:   144,
  zapdos:     145,
  moltres:    146,
  dratini:    147,
  dragonair:  148,
  dragonite:  149,
  mewtwo:     150,
  mew:        151,
};

/**
 * Returns the national Pokédex number for a given Pokémon name.
 * Tries an exact lowercase match first, then a prefix match for compound names.
 */
export function getPokemonSpriteId(name: string): number | null {
  const lower = name.toLowerCase().trim();
  if (lower in POKEDEX_BY_NAME) return POKEDEX_BY_NAME[lower];
  // Try prefix match (e.g. "nidoran♀" → "nidoran")
  const prefix = Object.keys(POKEDEX_BY_NAME).find((k) => lower.startsWith(k));
  return prefix ? POKEDEX_BY_NAME[prefix] : null;
}

/**
 * Returns the PokeAPI animated GIF sprite URL for a given Pokédex number.
 * These are official showdown sprites (gen 5) available without an API key.
 */
export function getAnimatedSpriteUrl(spriteId: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${spriteId}.gif`;
}

/**
 * Returns the PokeAPI static PNG sprite URL as a fallback.
 */
export function getStaticSpriteUrl(spriteId: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${spriteId}.png`;
}

// ---------------------------------------------------------------------------
// Extended card normalisation
// ---------------------------------------------------------------------------

/**
 * Extended CsvCardRow that includes the extra columns present in the CSV
 * but not used by the battle engine's cardRepository.
 */
type ExtendedCsvRow = CsvCardRow & {
  debilidad?: string;
  resistencia?: string;
  ataque_1_efecto?: string;
  ataque_2_nombre?: string;
  ataque_2_dano?: string;
  ataque_2_costo?: string;
  ataque_2_efecto?: string;
};

/**
 * Converts a raw CSV row into a CatalogCard.
 * Delegates base normalisation to the existing normalizeCardRow utility
 * and adds optional extra fields on top without modifying the battle engine.
 */
export function toCatalogCard(row: ExtendedCsvRow, index: number): CatalogCard | null {
  const base = normalizeCardRow(row, index);
  if (!base) return null;

  const spriteId = getPokemonSpriteId(base.name) ?? undefined;

  return {
    ...base,
    attack1Effect: row.ataque_1_efecto?.trim() || undefined,
    attack2Name: row.ataque_2_nombre?.trim() || undefined,
    attack2Damage: row.ataque_2_dano ? normalizeDamage(row.ataque_2_dano) : undefined,
    attack2Cost: row.ataque_2_costo ? normalizeEnergyCost(row.ataque_2_costo) : undefined,
    attack2Effect: row.ataque_2_efecto?.trim() || undefined,
    weakness: row.debilidad?.trim() || undefined,
    resistance: row.resistencia?.trim() || undefined,
    spriteId,
  };
}

/**
 * Builds a CatalogCard array from raw CSV rows, filtering non-Pokémon entries.
 */
export function buildCatalog(rows: ExtendedCsvRow[]): CatalogCard[] {
  return rows
    .map((row, index) => toCatalogCard(row, index))
    .filter((card): card is CatalogCard => card !== null);
}

/**
 * Wraps a base Card into a CatalogCard (used when we only have the base Card type,
 * e.g. cards coming from the battle store's playerHand).
 */
export function wrapAsCardCatalog(card: import('../cards/types').Card): CatalogCard {
  const spriteId = getPokemonSpriteId(card.name) ?? undefined;
  return { ...card, spriteId };
}
