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
            <li><strong>Banca y Activo:</strong> Mantén 1 Pokémon activo y hasta 3 básicos en la banca. Si tu activo es derrotado, debes elegir un reemplazo.</li>
            <li><strong>Asignar Energía:</strong> Una vez por turno, asigna 1 energía a tu Pokémon activo o a uno de la banca.</li>
            <li><strong>Evolución:</strong> Juega cartas de evolución desde tu mano para evolucionar a tus Pokémon en juego.</li>
            <li><strong>Cartas de Entrenador:</strong> Usa cartas de entrenador desde tu mano para obtener efectos estratégicos (curar, robar, buscar cartas, etc).</li>
            <li><strong>Retirada:</strong> Descarta la energía de costo de retirada de tu activo para cambiarlo por un Pokémon de la banca.</li>
            <li><strong>Atacar o Pasar:</strong> Ataca al rival si tienes la energía requerida. Atacar o elegir la acción "Pasar Turno" terminará tu turno (contra NPC o Jugador real).</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
