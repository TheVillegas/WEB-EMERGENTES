import { useEffect, useMemo, useState } from 'react';
import { loadCards, selectStarterCards } from '../features/cards/cardRepository';
import type { Card } from '../features/cards/types';

type ViewState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; catalog: Card[] };

const aesthetic = {
  name: 'Portable console',
  why: 'prioriza legibilidad grabable, contraste alto y una base sobria para sumar Phaser y Zustand sin rehacer la UI.',
};

export function App() {
  const [viewState, setViewState] = useState<ViewState>({ status: 'loading' });

  const fetchCatalog = async () => {
    setViewState({ status: 'loading' });

    try {
      const catalog = await loadCards();
      setViewState({ status: 'ready', catalog });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cargar el catálogo.';
      setViewState({ status: 'error', message });
    }
  };

  useEffect(() => {
    void fetchCatalog();
  }, []);

  const starterCards = useMemo(
    () => (viewState.status === 'ready' ? selectStarterCards(viewState.catalog) : []),
    [viewState],
  );

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">Slice 1 listo</p>
        <h1>Pokémon Web Demo</h1>
        <p className="hero-copy">
          Shell visible, catálogo local y mano inicial real cargada desde CSV. Nada de humo: esto ya
          deja la base concreta para el loop de batalla.
        </p>

        <dl className="hero-meta" aria-label="decisiones del slice">
          <div>
            <dt>Filosofía</dt>
            <dd>{aesthetic.name}</dd>
          </div>
          <div>
            <dt>Por qué</dt>
            <dd>{aesthetic.why}</dd>
          </div>
        </dl>
      </section>

      {viewState.status === 'loading' ? (
        <section className="state-panel" aria-live="polite">
          <p className="state-kicker">Cargando catálogo local</p>
          <h2>Preparando la mano base</h2>
          <p>Parseando `/public/data/pokemon_cards_gen1.csv` y filtrando sólo cartas Pokémon.</p>
        </section>
      ) : null}

      {viewState.status === 'error' ? (
        <section className="state-panel error-panel" aria-live="assertive">
          <p className="state-kicker">Error de bootstrap</p>
          <h2>La demo no pudo abrir el catálogo</h2>
          <p>{viewState.message}</p>
          <button type="button" className="primary-action" onClick={() => void fetchCatalog()}>
            Reintentar carga
          </button>
        </section>
      ) : null}

      {viewState.status === 'ready' ? (
        <>
          <section className="summary-strip" aria-label="resumen del catálogo">
            <article>
              <span>Total Pokémon</span>
              <strong>{viewState.catalog.length}</strong>
            </article>
            <article>
              <span>Mano inicial</span>
              <strong>{starterCards.length} cartas</strong>
            </article>
            <article>
              <span>Siguiente slice</span>
              <strong>Store + loop local</strong>
            </article>
          </section>

          <section className="hand-section" aria-labelledby="starter-hand-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Starter cards</p>
                <h2 id="starter-hand-title">Mano base visible</h2>
              </div>
              <p>Selección determinística para validar carga, filtro y render real antes del loop.</p>
            </div>

            <div className="card-grid">
              {starterCards.map((card) => (
                <article key={card.id} className="pokemon-card">
                  <img src={card.imageSmall} alt={`Carta de ${card.name}`} loading="lazy" />
                  <div className="card-body">
                    <div className="card-topline">
                      <h3>{card.name}</h3>
                      <span>{card.hp} HP</span>
                    </div>
                    <p className="type-pill">{card.type}</p>
                    <dl className="card-stats">
                      <div>
                        <dt>Ataque</dt>
                        <dd>{card.attackName}</dd>
                      </div>
                      <div>
                        <dt>Daño</dt>
                        <dd>{card.attackDamage}</dd>
                      </div>
                      <div>
                        <dt>Costo</dt>
                        <dd>{card.attackCost}</dd>
                      </div>
                    </dl>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="catalog-section" aria-labelledby="catalog-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Catalog preview</p>
                <h2 id="catalog-title">Pool listo para slices siguientes</h2>
              </div>
              <p>La UI ya expone datos normalizados que después pueden entrar al store sin reparsear.</p>
            </div>

            <ul className="catalog-list">
              {viewState.catalog.slice(0, 8).map((card) => (
                <li key={`${card.id}-row`}>
                  <span>{card.name}</span>
                  <small>
                    {card.type} · {card.attackName} · {card.attackDamage} DMG
                  </small>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </main>
  );
}
