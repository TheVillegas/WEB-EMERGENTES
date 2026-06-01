import React, { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useBattleStore } from '../features/battle/store';
import type { DeckType } from '../features/battle/types';

type DeckSelectionProps = {
  onSelect: () => void;
  onBack: () => void;
};

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
        stagger: 0.1,
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
        <p className="eyebrow">Elige tu estilo de combate</p>
      </div>

      <div className="deck-grid">
        <article className="deck-card deck-card--fuego" onClick={() => handleSelectDeck('Fuego')}>
          <div className="deck-card__icon">🔥</div>
          <h3>Mazo Fuego</h3>
          <p>Potencia ofensiva y daño directo. Quema a tus enemigos rápidamente.</p>
        </article>

        <article className="deck-card deck-card--agua" onClick={() => handleSelectDeck('Agua')}>
          <div className="deck-card__icon">💧</div>
          <h3>Mazo Agua</h3>
          <p>Control y resistencia. Desgasta a tus oponentes con paciencia.</p>
        </article>

        <article className="deck-card deck-card--planta" onClick={() => handleSelectDeck('Planta')}>
          <div className="deck-card__icon">🍃</div>
          <h3>Mazo Planta</h3>
          <p>Sinergia y curación. Mantén a tus Pokémon saludables en combate.</p>
        </article>
      </div>
    </div>
  );
}
