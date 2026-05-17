import type { CatalogCard } from '../types';

interface DeckPanelProps {
  cards: CatalogCard[];
  selectedCardId: string | null;
  onSelect: (card: CatalogCard) => void;
}

export function DeckPanel({ cards, selectedCardId, onSelect }: DeckPanelProps) {
  return (
    <aside className="catalog-deck-panel" aria-label="Mi mazo">
      <header className="catalog-panel-header">
        <p className="eyebrow">Mi mazo</p>
        <h2 className="catalog-panel-title">Deck</h2>
        <span className="chip">{cards.length} carta{cards.length !== 1 ? 's' : ''}</span>
      </header>

      {cards.length === 0 ? (
        <div className="catalog-empty-state catalog-empty-state--compact" role="status">
          <span className="catalog-empty-state__icon" aria-hidden="true">🃏</span>
          <p className="catalog-empty-state__title">Sin cartas</p>
          <p className="catalog-empty-state__sub">Aún no tienes cartas en tu mazo.</p>
        </div>
      ) : (
        <ol className="catalog-deck-list" aria-label="Cartas en el mazo">
          {cards.map((card) => (
            <li key={card.id}>
              <button
                type="button"
                id={`deck-card-${card.id}`}
                className={`catalog-deck-card ${card.id === selectedCardId ? 'catalog-deck-card--selected' : ''}`}
                onClick={() => onSelect(card)}
                aria-pressed={card.id === selectedCardId}
                aria-label={`${card.name} — ${card.type}, ${card.hp} HP`}
              >
                <img
                  src={card.imageSmall}
                  alt=""
                  aria-hidden="true"
                  className="catalog-deck-card__thumb"
                  loading="lazy"
                />
                <div className="catalog-deck-card__info">
                  <span className="catalog-deck-card__name">{card.name}</span>
                  <span className="catalog-deck-card__meta">{card.type} · {card.hp} HP</span>
                </div>
                {card.id === selectedCardId && (
                  <span className="catalog-deck-card__indicator" aria-hidden="true" />
                )}
              </button>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
