import { useState } from 'react';
import type { CatalogCard } from '../types';
import { getAnimatedSpriteUrl, getStaticSpriteUrl } from '../catalogUtils';

interface CardDetailsPanelProps {
  card: CatalogCard | null;
}

const TYPE_COLORS: Record<string, string> = {
  Fire:      '#ff7258',
  Water:     '#4cd7ff',
  Grass:     '#7cf0c8',
  Lightning: '#ffd66c',
  Psychic:   '#c678f5',
  Fighting:  '#e08060',
  Colorless: '#99adc5',
  Darkness:  '#8890b0',
  Metal:     '#a0b8d0',
  Dragon:    '#7b8cef',
};

function getTypeColor(type: string): string {
  return TYPE_COLORS[type] ?? '#99adc5';
}

function PokemonSprite({ spriteId, name }: { spriteId?: number; name: string }) {
  const [useFallback, setUseFallback] = useState(false);
  const [hasError, setHasError] = useState(false);

  if (!spriteId) {
    return (
      <div className="catalog-sprite-placeholder" aria-label="Sin sprite disponible">
        <span>?</span>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="catalog-sprite-placeholder" aria-label="Sprite no disponible">
        <span>✦</span>
      </div>
    );
  }

  const src = useFallback ? getStaticSpriteUrl(spriteId) : getAnimatedSpriteUrl(spriteId);

  return (
    <img
      key={src}
      src={src}
      alt={`Sprite animado de ${name}`}
      className="catalog-sprite"
      onError={() => {
        if (!useFallback) {
          setUseFallback(true);
        } else {
          setHasError(true);
        }
      }}
    />
  );
}

function EnergyPips({ count }: { count: number }) {
  if (count === 0) return <span className="catalog-detail-value">—</span>;
  return (
    <span className="catalog-energy-pips">
      {Array.from({ length: count }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static index is fine here
        <span key={i} className="energy-pip is-filled" />
      ))}
    </span>
  );
}

export function CardDetailsPanel({ card }: CardDetailsPanelProps) {
  if (!card) {
    return (
      <aside className="catalog-details-panel catalog-details-panel--empty" aria-label="Detalles de carta">
        <header className="catalog-panel-header">
          <p className="eyebrow">Detalles</p>
          <h2 className="catalog-panel-title">Carta seleccionada</h2>
        </header>
        <div className="catalog-empty-state" role="status">
          <span className="catalog-empty-state__icon" aria-hidden="true">👆</span>
          <p className="catalog-empty-state__title">Nada seleccionado</p>
          <p className="catalog-empty-state__sub">Selecciona una carta para ver sus detalles.</p>
        </div>
      </aside>
    );
  }

  const accentColor = getTypeColor(card.type);

  return (
    <aside
      className="catalog-details-panel"
      aria-label={`Detalles de ${card.name}`}
      style={{ '--card-accent': accentColor } as React.CSSProperties}
    >
      <header className="catalog-panel-header">
        <p className="eyebrow">Detalles</p>
        <h2 className="catalog-panel-title">Carta seleccionada</h2>
      </header>

      {/* Card image */}
      <div className="catalog-detail-card-image">
        <img
          src={card.imageLarge}
          alt={`Carta de ${card.name}`}
          className="catalog-detail-card-img"
        />
      </div>

      {/* Pokémon sprite / animation */}
      <div className="catalog-sprite-wrap">
        <PokemonSprite spriteId={card.spriteId} name={card.name} />
        {card.spriteId && (
          <p className="catalog-sprite-label eyebrow">Sprite animado</p>
        )}
      </div>

      {/* Name + type headline */}
      <div className="catalog-detail-headline">
        <h3 className="catalog-detail-name">{card.name}</h3>
        <span
          className="chip chip--accent catalog-detail-type-chip"
          style={{ color: accentColor, borderColor: `${accentColor}44` }}
        >
          {card.type}
        </span>
      </div>

      {/* Stats grid */}
      <dl className="catalog-detail-grid">
        <div className="catalog-detail-row">
          <dt className="catalog-detail-label">HP</dt>
          <dd className="catalog-detail-value">
            <strong>{card.hp}</strong>
          </dd>
        </div>

        {card.weakness && (
          <div className="catalog-detail-row">
            <dt className="catalog-detail-label">Debilidad</dt>
            <dd className="catalog-detail-value catalog-detail-value--danger">{card.weakness}</dd>
          </div>
        )}

        {card.resistance && (
          <div className="catalog-detail-row">
            <dt className="catalog-detail-label">Resistencia</dt>
            <dd className="catalog-detail-value catalog-detail-value--mint">{card.resistance}</dd>
          </div>
        )}

        {card.attackCost > 0 && (
          <div className="catalog-detail-row">
            <dt className="catalog-detail-label">Coste de retirada</dt>
            <dd className="catalog-detail-value"><EnergyPips count={card.attackCost} /></dd>
          </div>
        )}
      </dl>

      {/* Attacks */}
      <section className="catalog-detail-section" aria-label="Ataques">
        <h4 className="catalog-detail-section-title">Ataques</h4>

        <div className="catalog-attack-card">
          <div className="catalog-attack-header">
            <span className="catalog-attack-name">{card.attackName}</span>
            <div className="catalog-attack-meta">
              <EnergyPips count={card.attackCost} />
              {card.attackDamage > 0 && (
                <span className="catalog-attack-damage">{card.attackDamage}</span>
              )}
            </div>
          </div>
          {card.attack1Effect && (
            <p className="catalog-attack-effect">{card.attack1Effect}</p>
          )}
        </div>

        {card.attack2Name && (
          <div className="catalog-attack-card">
            <div className="catalog-attack-header">
              <span className="catalog-attack-name">{card.attack2Name}</span>
              <div className="catalog-attack-meta">
                {card.attack2Cost !== undefined && <EnergyPips count={card.attack2Cost} />}
                {card.attack2Damage !== undefined && card.attack2Damage > 0 && (
                  <span className="catalog-attack-damage">{card.attack2Damage}</span>
                )}
              </div>
            </div>
            {card.attack2Effect && (
              <p className="catalog-attack-effect">{card.attack2Effect}</p>
            )}
          </div>
        )}
      </section>
    </aside>
  );
}
