import React, { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

type MainMenuProps = {
  onStart: () => void;
  onCatalog: () => void;
  onTutorial: () => void;
};

export function MainMenu({ onStart, onCatalog, onTutorial }: MainMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.from('.menu-content > *', {
        opacity: 0,
        y: 30,
        duration: 0.8,
        stagger: 0.15,
        ease: 'power3.out',
      });
    },
    { scope: containerRef }
  );

  return (
    <div className="menu-screen" ref={containerRef}>
      <div className="menu-backdrop">
        <div className="menu-backdrop-glow" />
      </div>

      <div className="menu-content">
        <div className="brand-chip">
          <p className="eyebrow">Card Battle Prototype</p>
          <h1 className="menu-title">TCG Battle Arena</h1>
        </div>

        <p className="menu-subtitle">Adéntrate en la arena. Construye tu estrategia. Domina a tu rival.</p>

        <div className="menu-actions">
          <button type="button" className="primary-action menu-btn-large" onClick={onStart}>
            Iniciar Partida
          </button>

          <button type="button" className="secondary-action menu-btn-large" onClick={onCatalog}>
            📖 Ver Catálogo
          </button>

          <button type="button" className="secondary-action menu-btn-large" onClick={onTutorial}>
            ℹ️ Tutorial de Controles
          </button>
        </div>
      </div>
    </div>
  );
}
