import type { CatalogCard } from '../types';
import { CardItem } from './CardItem';

interface CardGridProps {
  cards: CatalogCard[];
  selectedCardId: string | null;
  onSelect: (card: CatalogCard) => void;
  searchQuery: string;
}

export function CardGrid({ cards, selectedCardId, onSelect, searchQuery }: CardGridProps) {
  if (cards.length === 0) {
    return (
      <div className="catalog-empty-state" role="status" aria-live="polite">
        <span className="catalog-empty-state__icon" aria-hidden="true">🔍</span>
        {searchQuery ? (
          <>
            <p className="catalog-empty-state__title">Sin resultados</p>
            <p className="catalog-empty-state__sub">
              No se encontraron cartas para <strong>"{searchQuery}"</strong>
            </p>
          </>
        ) : (
          <>
            <p className="catalog-empty-state__title">Catálogo vacío</p>
            <p className="catalog-empty-state__sub">No hay cartas disponibles.</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      className="catalog-grid"
      role="list"
      aria-label={`${cards.length} carta${cards.length !== 1 ? 's' : ''} en el catálogo`}
    >
      {cards.map((card) => (
        <div key={card.id} role="listitem">
          <CardItem
            card={card}
            isSelected={card.id === selectedCardId}
            onSelect={onSelect}
          />
        </div>
      ))}
    </div>
  );
}
