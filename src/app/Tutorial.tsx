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
          <h3>🏆 Objetivo del Juego</h3>
          <p style={{ color: 'var(--muted)', lineHeight: 1.6, marginTop: '8px' }}>
            El Pokémon TCG es un juego de batallas por turnos. 
            El objetivo es derrotar a los Pokémon del oponente usando los ataques de tus propios Pokémon. 
            Ganas la partida si logras vencer al <strong>Pokémon Activo</strong> de tu rival y este no tiene ningún otro Pokémon en su <strong>Banca</strong> para reemplazarlo.
          </p>
        </section>

        <section className="tutorial-section">
          <h3>🃏 Tipos de Cartas</h3>
          <ul className="tutorial-rules">
            <li><strong>Pokémon Básicos:</strong> Son los que pelean. Puedes jugarlos directamente al campo (al puesto Activo o a la Banca). Tienen Puntos de Salud (HP) y Ataques.</li>
            <li><strong>Pokémon Evolución (Fase 1 y Fase 2):</strong> Se juegan encima de un Pokémon de fase previa compatible que ya esté en el campo para hacerlo más poderoso.</li>
            <li><strong>Cartas de Energía:</strong> Son el "combustible". Debes asignarlas a tus Pokémon para que puedan pagar el costo de sus ataques o el costo de su retirada.</li>
            <li><strong>Cartas de Entrenador:</strong> Son objetos, personajes o lugares que usas desde tu mano para ganar una ventaja táctica (por ejemplo: curar a un Pokémon o robar cartas de tu mazo).</li>
          </ul>
        </section>

        <section className="tutorial-section">
          <h3>🎮 Cómo Interactuar</h3>
          <p style={{ color: 'var(--muted)', lineHeight: 1.6, margin: '8px 0 16px' }}>
            El juego usa un sistema de selección visual para que puedas jugar cómodamente:
          </p>
          <div className="tutorial-grid">
            <div className="tutorial-item">
              <span className="key-badge">←</span>
              <span className="key-badge">→</span>
              <p>Moverte de izquierda a derecha entre las cartas de tu mano o las opciones.</p>
            </div>
            <div className="tutorial-item">
              <span className="key-badge">↑</span>
              <span className="key-badge">↓</span>
              <p>Moverte de arriba hacia abajo (ej. pasar de tu mano a la barra superior de acciones).</p>
            </div>
            <div className="tutorial-item">
              <span className="key-badge">Enter</span>
              <p>Activar la carta o acción resaltada. Si la carta requiere un objetivo (ej: a quién darle energía o sobre quién evolucionar), la interfaz te pedirá seleccionarlo y confirmar.</p>
            </div>
          </div>
        </section>

        <section className="tutorial-section">
          <h3>⚔️ El Turno y la Batalla</h3>
          <ul className="tutorial-rules">
            <li><strong>Zonas:</strong> Tienes un <strong>Pokémon Activo</strong> (el que ataca y recibe daño) y hasta 3 Pokémon en tu <strong>Banca</strong> (esperando en la retaguardia).</li>
            <li><strong>Acciones de Turno:</strong> Durante tu turno, puedes jugar Cartas de Entrenador, evolucionar Pokémon, jugar Pokémon básicos a la banca, y <strong>asignar exactamente 1 carta de Energía</strong> a cualquiera de tus Pokémon.</li>
            <li><strong>Retirada:</strong> Si tu Pokémon Activo está en peligro, puedes usar la acción de Retirada. Deberás descartar la cantidad de energía que pide su costo para cambiarlo por uno de la banca.</li>
            <li><strong>Atacar:</strong> Si tu Pokémon Activo tiene la energía suficiente, selecciona la acción de Atacar para hacerle daño al rival. ¡Ten en cuenta que <strong>atacar termina tu turno automáticamente</strong>!</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
