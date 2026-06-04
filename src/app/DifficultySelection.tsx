import React, { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useBattleStore } from '../features/battle/store';
import type { Difficulty } from '../features/battle/types';

type DifficultySelectionProps = {
  onSelect: () => void;
  onBack: () => void;
};

export function DifficultySelection({ onSelect, onBack }: DifficultySelectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { setDifficulty } = useBattleStore();

  useGSAP(
    () => {
      gsap.from('.diff-card', {
        opacity: 0,
        x: -40,
        duration: 0.5,
        stagger: 0.15,
        ease: 'power3.out',
      });
      gsap.from('.menu-header', { opacity: 0, y: -20, duration: 0.5, ease: 'power2.out' });
    },
    { scope: containerRef }
  );

  const handleSelectDifficulty = (diff: Difficulty) => {
    setDifficulty(diff);
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
        <h2>Modo de Juego</h2>
        <p className="eyebrow">Selecciona a qué te enfrentarás</p>
      </div>

      <div className="diff-list">
        <article className="diff-card diff-card--pvp" onClick={() => handleSelectDifficulty('1vs1')}>
          <div className="diff-card__content">
            <h3>1 vs 1</h3>
            <p>Juega contra otro jugador en la misma red. ¡Demuestra quién es el mejor entrenador!</p>
          </div>
          <div className="diff-card__indicator">⚔️</div>
        </article>

        <article className="diff-card diff-card--easy" onClick={() => handleSelectDifficulty('Fácil')}>
          <div className="diff-card__content">
            <h3>Fácil</h3>
            <p>El rival usará Pokémon más débiles. Ideal para aprender a jugar.</p>
          </div>
          <div className="diff-card__indicator">⭐</div>
        </article>

        <article className="diff-card diff-card--normal" onClick={() => handleSelectDifficulty('Normal')}>
          <div className="diff-card__content">
            <h3>Normal</h3>
            <p>El desafío estándar. Pokémon variados y un combate equilibrado.</p>
          </div>
          <div className="diff-card__indicator">⭐⭐</div>
        </article>

        <article className="diff-card diff-card--hard" onClick={() => handleSelectDifficulty('Difícil')}>
          <div className="diff-card__content">
            <h3>Difícil</h3>
            <p>El rival enviará a sus mejores Pokémon desde el principio.</p>
          </div>
          <div className="diff-card__indicator">⭐⭐⭐</div>
        </article>
      </div>
    </div>
  );
}
