import type { CatalogCard } from '../types';

interface CardItemProps {
  card: CatalogCard;
  isSelected: boolean;
  onSelect: (card: CatalogCard) => void;
}

/** Type-to-accent color mapping that matches the app's design tokens */
const TYPE_COLORS: Record<string, string> = {
  Fire:       '#ff7258',
  Water:      '#4cd7ff',
  Grass:      '#7cf0c8',
  Lightning:  '#ffd66c',
  Psychic:    '#c678f5',
  Fighting:   '#e08060',
  Colorless:  '#99adc5',
  Darkness:   '#8890b0',
  Metal:      '#a0b8d0',
  Dragon:     '#7b8cef',
};

function getTypeColor(type: string): string {
  return TYPE_COLORS[type] ?? '#99adc5';
}

export function CardItem({ card, isSelected, onSelect }: CardItemProps) {
  return (
    <article
      id={`catalog-card-${card.id}`}
      className={`catalog-card-item ${isSelected ? 'catalog-card-item--selected' : ''}`}
      onClick={() => onSelect(card)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(card); }}
      aria-pressed={isSelected}
      aria-label={`${card.name}, ${card.type}, ${card.hp} HP`}
    >
      <div className="catalog-card-item__image-wrap">
        <img
          src={card.imageSmall}
          alt={`Carta de ${card.name}`}
          loading="lazy"
          className="catalog-card-item__image"
        />
        {isSelected && (
          <span className="catalog-card-item__selected-badge" aria-hidden="true">✓</span>
        )}
      </div>
      <div className="catalog-card-item__info">
        <span className="catalog-card-item__name">{card.name}</span>
        <span
          className="catalog-card-item__type chip"
          style={{ color: getTypeColor(card.type), borderColor: `${getTypeColor(card.type)}44` }}
        >
          {card.type}
        </span>
        <span className="catalog-card-item__hp">{card.hp} HP</span>
      </div>
    </article>
  );
}
