import Papa from 'papaparse';
import type { Card, CsvCardRow } from './types';
import { normalizeCardRow } from './types';
import type { Attack, EnergyType, PokemonCard, TcgCard, TrainerCard } from '../../tcg-engine/types';
import { getEvolutionStage, getEvolvesFrom } from '../../tcg-engine/evolution';
import { getTrainerEffectText, getTrainerSubtype } from '../../tcg-engine/trainerEffects';

const CATALOG_URL = '/data/pokemon_cards_gen1_img.csv';
const STARTER_CARD_COUNT = 5;

export function parseCatalogCsv(csvText: string): CsvCardRow[] {
  const result = Papa.parse<CsvCardRow>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (result.errors.length > 0) {
    throw new Error(`CSV inválido: ${result.errors[0]?.message ?? 'error desconocido'}`);
  }

  return result.data;
}

export function normalizeCatalog(rows: CsvCardRow[]): Card[] {
  return rows
    .map((row, index) => normalizeCardRow(row, index))
    .filter((card): card is Card => card !== null);
}

let cachedCards: Card[] | null = null;

export async function loadCards(
  fetcher: typeof fetch = fetch,
  source: string = CATALOG_URL,
): Promise<Card[]> {
  if (cachedCards && source === CATALOG_URL) {
    return cachedCards;
  }

  const response = await fetcher(source);

  if (!response.ok) {
    throw new Error(`No se pudo abrir ${source} (${response.status}).`);
  }

  const csvText = await response.text();
  const cards = normalizeCatalog(parseCatalogCsv(csvText));

  if (cards.length === 0) {
    throw new Error('El catálogo local no devolvió cartas Pokémon.');
  }

  if (source === CATALOG_URL) {
    cachedCards = cards;
  }

  return cards;
}

export function selectStarterCards(cards: Card[], count: number = STARTER_CARD_COUNT): Card[] {
  return cards.slice(0, count);
}

function normalizeEnergyType(value: string): EnergyType | null {
  const map: Record<string, EnergyType> = {
    grass: 'grass',
    fire: 'fire',
    water: 'water',
    lightning: 'lightning',
    psychic: 'psychic',
    fighting: 'fighting',
    darkness: 'darkness',
    metal: 'metal',
    dragon: 'dragon',
    colorless: 'colorless',
  };
  const key = value.trim().toLowerCase();
  return map[key] ?? null;
}

function parseEnergyCost(cost?: string): EnergyType[] {
  if (!cost?.trim()) return [];
  return cost
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => normalizeEnergyType(s))
    .filter((t): t is EnergyType => t !== null);
}

function parseWeakness(value?: string): EnergyType | null {
  if (!value?.trim()) return null;
  const match = value.match(/(\w+)\s*×/);
  if (match) {
    return normalizeEnergyType(match[1]);
  }
  return normalizeEnergyType(value);
}

function parseAttack(
  name?: string,
  damage?: string,
  cost?: string,
  effect?: string,
): Attack | null {
  if (!name?.trim()) return null;
  const damageMatch = damage?.match(/\d+/);
  return {
    name: name.trim(),
    damage: damageMatch ? Number.parseInt(damageMatch[0], 10) : 0,
    cost: parseEnergyCost(cost),
    effect: effect?.trim() || '',
  };
}

export function toTcgCard(rows: CsvCardRow[], startIndex?: number): TcgCard[] {
  const indexOffset = startIndex ?? 0;
  const cards: TcgCard[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const idx = indexOffset + i;
    const name = row.nombre?.trim() || `Card ${idx + 1}`;
    const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${idx}`;

    const isTrainer =
      row.categoria?.trim().toLowerCase() === 'entrenador';

    if (isTrainer) {
      const trainer: TrainerCard = {
        id,
        name,
        type: getTrainerSubtype(name),
        effect: getTrainerEffectText(name),
        imageSmall: row.imagen_small?.trim() || '',
        imageLarge: row.imagen_large?.trim() || '',
      };
      cards.push(trainer);
      continue;
    }

    const attacks: Attack[] = [];
    const atk1 = parseAttack(
      row.ataque_1_nombre,
      row.ataque_1_dano,
      row.ataque_1_costo,
      row.ataque_1_efecto,
    );
    if (atk1) attacks.push(atk1);

    const atk2 = parseAttack(
      row.ataque_2_nombre,
      row.ataque_2_dano,
      row.ataque_2_costo,
      row.ataque_2_efecto,
    );
    if (atk2) attacks.push(atk2);

    const type = normalizeEnergyType(row.tipo ?? '') || 'colorless';
    const hp = Number.parseInt(row.hp ?? '', 10);

    const pokemon: PokemonCard = {
      id,
      name,
      types: [type],
      hp: Number.isNaN(hp) ? 0 : hp,
      attacks,
      weakness: parseWeakness(row.debilidad),
      retreatCost: 1,
      isEx: false,
      stage: getEvolutionStage(name),
      evolvesFrom: getEvolvesFrom(name),
      imageSmall: row.imagen_small?.trim() || '',
      imageLarge: row.imagen_large?.trim() || '',
    };

    cards.push(pokemon);
  }

  return cards;
}
