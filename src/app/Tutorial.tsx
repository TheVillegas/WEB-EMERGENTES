import React, { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

type TutorialProps = {
  onBack: () => void;
};

export function Tutorial({ onBack }: TutorialProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.from('.menu-header', { opacity: 0, y: -20, duration: 0.5, ease: 'power2.out' });
      gsap.from('.tutorial-section', {
        opacity: 0,
        y: 30,
        duration: 0.6,
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

      <div className="menu-header">
        <button type="button" className="secondary-action compact-action" onClick={onBack}>
          ← Volver
        </button>
        <h2>Controles e Instrucciones</h2>
        <p className="eyebrow">Aprende a jugar en la Arena</p>
      </div>

      <div className="tutorial-container">
        <section className="tutorial-section">
          <h3>🎮 Navegación y Controles</h3>
          <div className="tutorial-grid">
            <div className="tutorial-item">
              <span className="key-badge">←</span>
              <span className="key-badge">→</span>
              <p>Moverse entre las cartas de tu mano o las acciones de la barra inferior.</p>
            </div>
            <div className="tutorial-item">
              <span className="key-badge">↑</span>
              <span className="key-badge">↓</span>
              <p>Alternar el foco entre tu Mano (abajo) y la Barra de Acciones (arriba).</p>
            </div>
            <div className="tutorial-item">
              <span className="key-badge">Enter</span>
              <p>Seleccionar o activar la carta/acción que tiene el foco actual.</p>
            </div>
          </div>
        </section>

        <section className="tutorial-section">
          <h3>⚔️ Dinámica del Juego</h3>
          <ul className="tutorial-rules">
            <li><strong>Activar Pokémon:</strong> Al inicio o si tu Pokémon activo es derrotado, selecciona una carta de tu mano con las flechas y presiona <code>Enter</code> para ponerlo en el campo.</li>
            <li><strong>Asignar Energía:</strong> Puedes asignar 1 punto de energía por turno a tu Pokémon activo desde la barra de acciones.</li>
            <li><strong>Atacar:</strong> Una vez que tu Pokémon activo tenga cargada la energía requerida (costo), puedes realizar un ataque para infligir daño al Pokémon rival.</li>
            <li><strong>Pasar Turno:</strong> Finaliza tu turno para ceder la acción al NPC enemigo.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
