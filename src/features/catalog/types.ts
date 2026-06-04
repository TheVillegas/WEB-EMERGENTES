import type { Card } from '../cards/types';

export type CatalogCard = Card & {
  attack1Effect?: string;
  attack2Name?: string;
  attack2Damage?: number;
  attack2Cost?: number;
  attack2Effect?: string;
  weakness?: string;
  resistance?: string;
  spriteId?: number;
};

export type CatalogViewState = {
  searchQuery: string;
  selectedCard: CatalogCard | null;
};
