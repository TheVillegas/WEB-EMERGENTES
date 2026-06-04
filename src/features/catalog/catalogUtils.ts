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
  bulbasaur: 1,
  ivysaur: 2,
  venusaur: 3,
  charmander: 4,
  charmeleon: 5,
  charizard: 6,
  squirtle: 7,
  wartortle: 8,
  blastoise: 9,
  caterpie: 10,
  metapod: 11,
  butterfree: 12,
  weedle: 13,
  kakuna: 14,
  beedrill: 15,
  pidgey: 16,
  rattata: 19,
  spearow: 21,
  ekans: 23,
  pikachu: 25,
  raichu: 26,
  sandshrew: 27,
  nidoran: 29,
  nidorina: 30,
  nidoqueen: 31,
  clefairy: 35,
  clefable: 36,
  vulpix: 37,
  ninetales: 38,
  jigglypuff: 39,
  wigglytuff: 40,
  abra: 63,
  kadabra: 64,
  alakazam: 65,
  machop: 66,
  geodude: 74,
  ponyta: 77,
  slowpoke: 79,
  magnemite: 81,
  gastly: 92,
  haunter: 93,
  gengar: 94,
  drowzee: 96,
  voltorb: 100,
  electrode: 101,
  chansey: 113,
  tangela: 114,
  kangaskhan: 115,
  horsea: 116,
  goldeen: 118,
  staryu: 120,
  starmie: 121,
  scyther: 123,
  jynx: 124,
  electabuzz: 125,
  magmar: 126,
  pinsir: 127,
  tauros: 128,
  magikarp: 129,
  gyarados: 130,
  lapras: 131,
  ditto: 132,
  eevee: 133,
  vaporeon: 134,
  jolteon: 135,
  flareon: 136,
  porygon: 137,
  omanyte: 138,
  omastar: 139,
  kabuto: 140,
  kabutops: 141,
  aerodactyl: 142,
  snorlax: 143,
  articuno: 144,
  zapdos: 145,
  moltres: 146,
  dratini: 147,
  dragonair: 148,
  dragonite: 149,
  mewtwo: 150,
  mew: 151,
};

/**
 * Retorna el número de pokédex nacional para un Pokémon.
 * Intenta una coincidencia exacta en minúsculas primero, 
 * luego una coincidencia de prefijo para nombres compuestos.
 */
export function getPokemonSpriteId(name: string): number | null {
  const lower = name.toLowerCase().trim();
  if (lower in POKEDEX_BY_NAME) return POKEDEX_BY_NAME[lower];
  const prefix = Object.keys(POKEDEX_BY_NAME).find((k) => lower.startsWith(k));
  return prefix ? POKEDEX_BY_NAME[prefix] : null;
}

/**
 * Retorna la URL del sprite animado de PokeAPI para un número de Pokédex dado..
 */
export function getAnimatedSpriteUrl(spriteId: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${spriteId}.gif`;
}

/**
 * Retorna la URL del sprite estático de PokeAPI para un número de Pokédex dado.
 */
export function getStaticSpriteUrl(spriteId: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${spriteId}.png`;
}

// ---------------------------------------------------------------------------
// Extended card normalisation
// ---------------------------------------------------------------------------

/**
 * Extended CsvCardRow que incluye las columnas extra presentes en el CSV
 * pero no utilizadas por el cardRepository del motor de batalla.
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

/*Convierte un CSV en un Catalogo de cartas.*/
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
 * Convierte un array de CSV en un Catalogo de cartas.
 */
export function buildCatalog(rows: ExtendedCsvRow[]): CatalogCard[] {
  return rows
    .map((row, index) => toCatalogCard(row, index))
    .filter((card): card is CatalogCard => card !== null);
}

/**
 * Convierte una carta base en una CatalogCard (usada cuando solo tenemos el tipo
 * Card base, por ejemplo, cartas que vienen de la mano del jugador del motor de batalla).
 */
export function wrapAsCardCatalog(card: import('../cards/types').Card): CatalogCard {
  const spriteId = getPokemonSpriteId(card.name) ?? undefined;
  return { ...card, spriteId };
}
