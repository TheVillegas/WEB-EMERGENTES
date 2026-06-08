import React, { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useBattleStore } from '../features/battle/store';
import type { DeckType } from '../features/battle/types';
import { DECK_INFO } from '../data/defaultDecks';

type DeckSelectionProps = {
  onSelect: () => void;
  onBack: () => void;
};

const ALL_DECK_TYPES: DeckType[] = ['Fuego', 'Agua', 'Planta', 'Lucha', 'Psíquico', 'Incoloro', 'Rayo'];

export function DeckSelection({ onSelect, onBack }: DeckSelectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { setDeck } = useBattleStore();

  useGSAP(
    () => {
      gsap.from('.deck-card', {
        opacity: 0,
        y: 40,
        scale: 0.9,
        duration: 0.6,
        stagger: 0.08,
        ease: 'back.out(1.4)',
      });
      gsap.from('.menu-header', { opacity: 0, y: -20, duration: 0.5, ease: 'power2.out' });
    },
    { scope: containerRef }
  );

  const handleSelectDeck = (deck: DeckType) => {
    setDeck(deck);
    onSelect();
  };

  return (
    <div className="menu-screen" ref={containerRef}>
      <div className="menu-backdrop">
        <div className="menu-backdrop-glow" />
      </div>

      <div className="menu-header">
        <button type="button" className="secondary-action compact-action" onClick={onBack}>
          ← Volver
        </button>
        <h2>Selecciona tu Mazo</h2>
        <p className="eyebrow">Elige tu estilo de combate — 7 tipos disponibles</p>
      </div>

      <div className="deck-grid deck-grid--expanded">
        {ALL_DECK_TYPES.map((deckType) => {
          const info = DECK_INFO[deckType];
          return (
            <article
              key={deckType}
              className={`deck-card ${info.cssClass}`}
              onClick={() => handleSelectDeck(deckType)}
            >
              <div className="deck-card__icon">{info.emoji}</div>
              <h3>{info.label}</h3>
              <p>{info.description}</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}
