export type CsvCardRow = {
  nombre?: string;
  categoria?: string;
  tipo?: string;
  hp?: string;
  debilidad?: string;
  resistencia?: string;
  ataque_1_nombre?: string;
  ataque_1_dano?: string;
  ataque_1_costo?: string;
  ataque_1_efecto?: string;
  ataque_2_nombre?: string;
  ataque_2_dano?: string;
  ataque_2_costo?: string;
  ataque_2_efecto?: string;
  imagen_small?: string;
  imagen_large?: string;
};

export type Card = {
  id: string;
  name: string;
  category: 'Pokémon';
  type: string;
  hp: number;
  attackName: string;
  attackDamage: number;
  attackCost: number;
  imageSmall: string;
  imageLarge: string;
};

export type { TcgCard } from '../tcg-engine/types';

export const DEFAULT_CARD_IMAGE =
  'https://images.pokemontcg.io/base1/1.png';

export function isPokemonCategory(value?: string): boolean {
  return value?.trim().toLowerCase() === 'pokémon';
}

export function normalizeDamage(value?: string): number {
  const match = value?.match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : 0;
}

export function normalizeEnergyCost(value?: string): number {
  if (!value?.trim()) {
    return 0;
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean).length;
}

export function normalizeHp(value?: string): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function toCardId(name: string, index: number): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index}`;
}

export function normalizeCardRow(row: CsvCardRow, index: number): Card | null {
  if (!isPokemonCategory(row.categoria)) {
    return null;
  }

  const name = row.nombre?.trim() || `Pokémon ${index + 1}`;
  const fallbackImage = row.imagen_large?.trim() || row.imagen_small?.trim() || DEFAULT_CARD_IMAGE;

  return {
    id: toCardId(name, index),
    name,
    category: 'Pokémon',
    type: row.tipo?.trim() || 'Neutral',
    hp: normalizeHp(row.hp),
    attackName: row.ataque_1_nombre?.trim() || 'Golpe básico',
    attackDamage: normalizeDamage(row.ataque_1_dano),
    attackCost: normalizeEnergyCost(row.ataque_1_costo),
    imageSmall: row.imagen_small?.trim() || fallbackImage,
    imageLarge: row.imagen_large?.trim() || fallbackImage,
  };
}
