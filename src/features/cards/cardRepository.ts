import Papa from 'papaparse';
import type { Card, CsvCardRow } from './types';
import { normalizeCardRow } from './types';

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

export async function loadCards(
  fetcher: typeof fetch = fetch,
  source: string = CATALOG_URL,
): Promise<Card[]> {
  const response = await fetcher(source);

  if (!response.ok) {
    throw new Error(`No se pudo abrir ${source} (${response.status}).`);
  }

  const csvText = await response.text();
  const cards = normalizeCatalog(parseCatalogCsv(csvText));

  if (cards.length === 0) {
    throw new Error('El catálogo local no devolvió cartas Pokémon.');
  }

  return cards;
}

export function selectStarterCards(cards: Card[], count: number = STARTER_CARD_COUNT): Card[] {
  return cards.slice(0, count);
}
