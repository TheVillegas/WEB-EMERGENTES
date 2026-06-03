import React, { useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

type NameEntryProps = {
  onConfirm: (name: string) => void;
};

export function NameEntry({ onConfirm }: NameEntryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState('');

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onConfirm(name.trim());
    }
  };

  return (
    <div className="menu-screen" ref={containerRef}>
      <div className="menu-backdrop">
        <div className="menu-backdrop-glow" />
      </div>

      <div className="menu-content">
        <div className="brand-chip">
          <p className="eyebrow">Card Battle Prototype</p>
          <h1 className="menu-title">Ingresa tu Nombre</h1>
        </div>

        <p className="menu-subtitle">Prepara tu identidad antes de entrar a la arena digital.</p>

        <form onSubmit={handleSubmit} className="name-entry-form">
          <input
            type="text"
            placeholder="Escribe tu nombre aquí..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="name-input"
            maxLength={15}
            autoFocus
          />

          <button
            type="submit"
            className="primary-action menu-btn-large"
            disabled={!name.trim()}
          >
            Confirmar Nombre
          </button>
        </form>
      </div>
    </div>
  );
}
