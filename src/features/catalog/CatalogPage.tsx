import { useMemo, useState } from 'react';
import { useBattleStore } from '../battle/store';
import { wrapAsCardCatalog } from './catalogUtils';
import { CatalogSearchBar } from './components/CatalogSearchBar';
import { CardGrid } from './components/CardGrid';
import { DeckPanel } from './components/DeckPanel';
import { CardDetailsPanel } from './components/CardDetailsPanel';
import type { CatalogCard } from './types';
import './catalog.css';

// ---------------------------------------------------------------------------
// Helper: load catalog from CSV rows stored in the battle store
// The battle store already has Card[], but we need CatalogCard[] with the
// extended fields. We re-derive them from Papa-parsed rows that include the
// extra columns. Since we can't access raw rows again without a new fetch,
// we wrap the existing Cards into CatalogCards (adds spriteId from the URL)
// and use those as the catalog source.
// ---------------------------------------------------------------------------

export function CatalogPage() {
  const { catalog, match, catalogStatus } = useBattleStore();

  // Convert base Cards → CatalogCards (adds spriteId, wraps type)
  const catalogCards: CatalogCard[] = useMemo(
    () => catalog.map(wrapAsCardCatalog),
    [catalog],
  );

  // Deck = player's current hand in the active match
  const deckCards: CatalogCard[] = useMemo(
    () => (match?.playerHand ?? []).map(wrapAsCardCatalog),
    [match?.playerHand],
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCard, setSelectedCard] = useState<CatalogCard | null>(null);

  const filteredCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return catalogCards;
    return catalogCards.filter((c) => c.name.toLowerCase().includes(q));
  }, [catalogCards, searchQuery]);

  function handleSelectCard(card: CatalogCard) {
    setSelectedCard(card);
  }

  if (catalogStatus === 'loading') {
    return (
      <div className="catalog-page catalog-page--loading" role="status" aria-live="polite">
        <div className="catalog-loader">
          <span className="catalog-loader__ring" aria-hidden="true" />
          <p>Cargando catálogo…</p>
        </div>
      </div>
    );
  }

  if (catalogStatus === 'error') {
    return (
      <div className="catalog-page catalog-page--error" role="alert">
        <p className="catalog-error-icon" aria-hidden="true">⚠️</p>
        <p className="catalog-error-title">No se pudo cargar el catálogo.</p>
        <p className="catalog-error-sub">Revisa tu conexión e intenta de nuevo.</p>
      </div>
    );
  }

  return (
    <div className="catalog-page">
      {/* Page header */}
      <header className="catalog-header">
        <div className="catalog-header__brand">
          <p className="eyebrow">TCG Battle Arena</p>
          <h1 className="catalog-header__title">Catálogo de cartas</h1>
        </div>
        <p className="catalog-header__sub">
          {catalogCards.length} carta{catalogCards.length !== 1 ? 's' : ''} disponibles
        </p>
      </header>

      {/* Three-column layout */}
      <div className="catalog-layout">
        {/* Left: Deck */}
        <DeckPanel
          cards={deckCards}
          selectedCardId={selectedCard?.id ?? null}
          onSelect={handleSelectCard}
        />

        {/* Center: Grid + search */}
        <section className="catalog-center-panel" aria-label="Catálogo completo">
          <div className="catalog-center-panel__search">
            <CatalogSearchBar value={searchQuery} onChange={setSearchQuery} />
          </div>
          <div className="catalog-center-panel__grid">
            <CardGrid
              cards={filteredCards}
              selectedCardId={selectedCard?.id ?? null}
              onSelect={handleSelectCard}
              searchQuery={searchQuery}
            />
          </div>
        </section>

        {/* Right: Details */}
        <CardDetailsPanel card={selectedCard} />
      </div>
    </div>
  );
}
