import type { Card } from '../cards/types';

/**
 * Extended card for the catalog view.
 * Inherits all fields from the base Card and adds optional fields
 * parsed from the extra CSV columns not used by the battle engine.
 */
export type CatalogCard = Card & {
  attack1Effect?: string;
  attack2Name?: string;
  attack2Damage?: number;
  attack2Cost?: number;
  attack2Effect?: string;
  weakness?: string;
  resistance?: string;
  /** National Pokédex number inferred from the card image URL, used for sprite lookup. */
  spriteId?: number;
};

export type CatalogViewState = {
  searchQuery: string;
  selectedCard: CatalogCard | null;
};
