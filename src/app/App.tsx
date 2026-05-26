import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { loadCards } from '../features/cards/cardRepository';
import { canAttack } from '../features/battle/gameEngine';
import { useBattleStore } from '../features/battle/store';
import type { Battler, GameState, TurnPhase } from '../features/battle/types';
import { ThreeArena } from '../game/ThreeArena';
import { CatalogPage } from '../features/catalog/CatalogPage';

gsap.registerPlugin(useGSAP);

type AttackFx = {
  key: number;
  attacker: 'player' | 'npc';
  damage: number;
  lethal?: boolean;
};

const preloadedUrls = new Set<string>();
function preloadImage(url: string) {
  if (!url || preloadedUrls.has(url)) return;
  preloadedUrls.add(url);
  const img = new Image();
  img.src = url;
}

function getPhaseLabel(phase: TurnPhase, match: GameState): string {
  if (phase === 'selecting-active') return 'Elegir carta';
  if (phase === 'npc-turn') return 'Turno NPC';
  if (phase === 'game-over') return 'Final';
  if (match.turn === 'player') return match.energyAssignedThisTurn ? 'Ataque o pase' : 'Asignar energía';
  return 'Resolución';
}

function formatLogEntry(entry: string): string {
  let match = entry.match(/^NPC activa a (.+)\.$/);
  if (match) return `${match[1]} entra al campo rival.`;
  match = entry.match(/^Elegiste a (.+) como Pokémon activo\.$/);
  if (match) return `${match[1]} entra a tu zona activa.`;
  match = entry.match(/^Jugador asignó 1 energía a (.+) \((\d+)\/(\d+)\)\.$/);
  if (match) return `Energía asignada a ${match[1]} · ${match[2]}/${match[3]}.`;
  match = entry.match(/^NPC asignó 1 energía a (.+) \((\d+)\/(\d+)\)\.$/);
  if (match) return `El NPC cargó energía en ${match[1]} · ${match[2]}/${match[3]}.`;
  match = entry.match(/^Jugador usó (.+) con (.+) e hizo (\d+) de daño a (.+)\.$/);
  if (match) return `${match[2]} usó ${match[1]} y causó ${match[3]} de daño.`;
  match = entry.match(/^NPC usó (.+) con (.+) e hizo (\d+) de daño a (.+)\.$/);
  if (match) return `El NPC usó ${match[1]} con ${match[2]} y causó ${match[3]} de daño.`;
  if (entry === 'Nueva partida iniciada.') return 'La arena digital está lista.';
  if (entry === 'Victoria del jugador.') return 'Victoria.';
  if (entry === 'Derrota del jugador.') return 'Derrota.';
  if (entry.startsWith('Jugador pasó el turno')) return 'Fin de tu turno.';
  if (entry.startsWith('NPC pasó el turno')) return 'El NPC pasa el turno.';
  return entry;
}

function getMatchSummary(match: GameState) {
  let damageDealt = 0;
  let damageTaken = 0;
  let passCount = 0;
  const cardsUsed = new Set<string>();

  for (const entry of match.log) {
    let damageMatch = entry.match(/^Jugador usó .+ con (.+) e hizo (\d+) de daño a .+\.$/);
    if (damageMatch) {
      cardsUsed.add(damageMatch[1]);
      damageDealt += Number.parseInt(damageMatch[2], 10);
      continue;
    }

    damageMatch = entry.match(/^NPC usó .+ con (.+) e hizo (\d+) de daño a .+\.$/);
    if (damageMatch) {
      cardsUsed.add(damageMatch[1]);
      damageTaken += Number.parseInt(damageMatch[2], 10);
      continue;
    }

    const activeMatch = entry.match(/^(?:Elegiste a|NPC activa a) (.+?)(?: como Pokémon activo)?\.$/);
    if (activeMatch) cardsUsed.add(activeMatch[1]);

    if (entry.startsWith('Jugador pasó el turno') || entry.startsWith('NPC pasó el turno')) {
      passCount += 1;
    }
  }

  return {
    damageDealt,
    damageTaken,
    turnsPlayed: Math.max(1, Math.ceil(passCount / 2) + (match.winner ? 1 : 0)),
    cardsUsed: cardsUsed.size,
  };
}

function ZonePile({ label }: { label: string }) {
  return (
    <div className="zone-pile">
      <div className="zone-pile__stack" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <small>{label}</small>
    </div>
  );
}

function BenchSlots({ owner }: { owner: 'player' | 'npc' }) {
  return (
    <div className={`bench-row bench-row--${owner}`}>
      {[1, 2, 3].map((slot) => (
        <div key={`${owner}-bench-${slot}`} className="bench-slot">
          <span>Banca {slot}</span>
        </div>
      ))}
    </div>
  );
}

function ActiveCard({ battler, owner, status }: { battler: Battler; owner: 'player' | 'npc'; status: string }) {
  const hpRatio = battler.hp > 0 ? Math.max(0, Math.round((battler.currentHp / battler.hp) * 100)) : 0;
  const energySlots = Math.max(1, Math.max(battler.attackCost, battler.energy));
  const hpTone = hpRatio <= 25 ? 'danger' : hpRatio <= 55 ? 'warning' : 'safe';

  return (
    <article className={`active-card active-card--${owner}`}>
      <div className="active-card__image">
        <img src={battler.imageLarge || battler.imageSmall} alt={`Carta activa de ${battler.name}`} loading="lazy" />
      </div>

      <div className="active-card__content">
        <div className="active-card__header">
          <div>
            <p className="eyebrow">{status}</p>
            <h3>{battler.name}</h3>
          </div>
          <span className={`hp-pill hp-pill--${hpTone}`}>{battler.currentHp}/{battler.hp} HP</span>
        </div>

        <div className="hp-meter">
          <div className="hp-meter__topline">
            <span>HP</span>
            <span>{hpRatio}%</span>
          </div>
          <div className="hp-meter__track">
            <div className={`hp-meter__fill hp-meter__fill--${hpTone}`} style={{ width: `${hpRatio}%` }} />
          </div>
        </div>

        <div className="chip-row">
          <span className="chip chip--accent">{battler.type}</span>
          <span className="chip">{battler.attackName}</span>
          <span className="chip">Daño {battler.attackDamage}</span>
          <span className={`chip ${battler.energy >= battler.attackCost ? 'chip--ready' : ''}`}>Costo {battler.attackCost}</span>
        </div>

        <div className="energy-row">
          <span className="eyebrow">Energía</span>
          <div className="energy-pips">
            {Array.from({ length: energySlots }).map((_, index) => (
              <span
                key={`${battler.id}-energy-${index}`}
                className={`energy-pip ${index < battler.energy ? 'is-filled' : ''} ${index < battler.attackCost && battler.energy >= battler.attackCost ? 'is-ready' : ''}`}
              />
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

type AppView = 'battle' | 'catalog';

export function App() {
  const [view, setView] = useState<AppView>('battle');
  const [showResult, setShowResult] = useState(false);
  const {
    catalogStatus,
    errorMessage,
    match,
    setCatalogLoading,
    setCatalogError,
    initializeCatalog,
    startMatch,
    selectPlayerActive,
    assignPlayerEnergy,
    playerAttack,
    passPlayerTurn,
    resetCurrentMatch,
  } = useBattleStore();

  const [attackFx, setAttackFx] = useState<AttackFx | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  const handRefs = useRef<Array<HTMLElement | null>>([]);
  const handCardMapRef = useRef<Record<string, HTMLElement | null>>({});
  const logRefs = useRef<Array<HTMLElement | null>>([]);
  const beamRef = useRef<HTMLDivElement | null>(null);
  const damageRef = useRef<HTMLDivElement | null>(null);
  const resultPanelRef = useRef<HTMLDivElement | null>(null);
  const playerSlotRef = useRef<HTMLDivElement | null>(null);
  const playerActiveRef = useRef<HTMLDivElement | null>(null);
  const npcActiveRef = useRef<HTMLDivElement | null>(null);
  const previousMatchRef = useRef<GameState | null>(null);
  const resultAudioRef = useRef<HTMLAudioElement | null>(null);
  const battleAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      setCatalogLoading();

      try {
        const catalog = await loadCards();
        if (active) initializeCatalog(catalog);
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : 'No se pudo cargar el catálogo.';
        setCatalogError(message);
      }
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, [initializeCatalog, setCatalogError, setCatalogLoading]);

  const playerCanAssignEnergy =
    match?.phase === 'player-turn' &&
    match.turn === 'player' &&
    Boolean(match.playerActive) &&
    !match.energyAssignedThisTurn &&
    !match.pendingNpc;

  const playerCanAttack =
    match?.phase === 'player-turn' &&
    match.turn === 'player' &&
    canAttack(match.playerActive) &&
    !match.pendingNpc;

  const playerCanPass =
    match?.phase === 'player-turn' && match.turn === 'player' && !match.pendingNpc && !match.winner;

  const logEntries = useMemo(() => (match ? match.log.map(formatLogEntry).slice(-6).reverse() : []), [match]);
  const summary = useMemo(() => (match ? getMatchSummary(match) : null), [match]);
  const cardOfTheGame = match?.winner === 'player' ? match.playerActive : match?.npcActive;

  useEffect(() => {
    if (!match) return;

    if (match.playerActive) {
      if (match.playerActive.imageSmall) preloadImage(match.playerActive.imageSmall);
      if (match.playerActive.imageLarge) preloadImage(match.playerActive.imageLarge);
    }
    if (match.npcActive) {
      if (match.npcActive.imageSmall) preloadImage(match.npcActive.imageSmall);
      if (match.npcActive.imageLarge) preloadImage(match.npcActive.imageLarge);
    }
    for (const card of match.playerHand) {
      if (card.imageSmall) preloadImage(card.imageSmall);
      if (card.imageLarge) preloadImage(card.imageLarge);
    }
  }, [match?.playerHand, match?.playerActive, match?.npcActive]);

  useEffect(() => {
    if (!match) return;

    const previous = previousMatchRef.current;
    if (previous) {
      const npcDamage = previous.npcActive && match.npcActive ? previous.npcActive.currentHp - match.npcActive.currentHp : 0;
      const playerDamage = previous.playerActive && match.playerActive ? previous.playerActive.currentHp - match.playerActive.currentHp : 0;

      if (npcDamage > 0) setAttackFx({ key: Date.now(), attacker: 'player', damage: npcDamage, lethal: match.npcActive?.currentHp === 0 });
      else if (playerDamage > 0) setAttackFx({ key: Date.now(), attacker: 'npc', damage: playerDamage, lethal: match.playerActive?.currentHp === 0 });
    }

    previousMatchRef.current = match;
  }, [match]);

  useEffect(() => {
    if (match?.winner) {
      const timer = setTimeout(() => setShowResult(true), 2500);
      return () => clearTimeout(timer);
    } else {
      setShowResult(false);
    }
  }, [match?.winner]);

  useEffect(() => {
    if (match?.matchId) {
      gsap.set([playerActiveRef.current, npcActiveRef.current], { clearProps: 'all' });
    }
  }, [match?.matchId]);

  useEffect(() => {
    if (showResult && match?.winner) {
      const audioUrl = match.winner === 'player' 
        ? '/audio/music/Results-Victory.mp3' 
        : '/audio/music/Results-Defeat.mp3';
      const audio = new Audio(audioUrl);
      audio.volume = 0.5;
      audio.loop = true;
      audio.play().catch(() => {});
      resultAudioRef.current = audio;
    } else if (!showResult) {
      if (resultAudioRef.current) {
        resultAudioRef.current.pause();
        resultAudioRef.current.currentTime = 0;
        resultAudioRef.current = null;
      }
    }
  }, [showResult, match?.winner]);

  useEffect(() => {
    const hasMatch = Boolean(match);
    const shouldPlayBattleMusic = view === 'battle' && hasMatch && !showResult;

    if (shouldPlayBattleMusic) {
      if (!battleAudioRef.current) {
        const audio = new Audio('/audio/music/Battle-Music.mp3');
        audio.volume = 0.35;
        audio.loop = true;
        audio.play().catch(() => {});
        battleAudioRef.current = audio;
      }
    } else {
      if (battleAudioRef.current) {
        battleAudioRef.current.pause();
        battleAudioRef.current.currentTime = 0;
        battleAudioRef.current = null;
      }
    }
  }, [view, Boolean(match), showResult]);

  useGSAP(
    () => {
      gsap.from('.hud-floating, .board-overlay, .battle-log-anchor', {
        opacity: 0,
        y: 18,
        duration: 0.6,
        ease: 'power2.out',
        stagger: 0.06,
      });
    },
    { scope: rootRef, dependencies: [catalogStatus] },
  );

  useGSAP(
    () => {
      const items = handRefs.current.filter(Boolean);
      if (!items.length) return;

      gsap.fromTo(items, { opacity: 0, y: 55, rotate: 4, scale: 0.96 }, { opacity: 1, y: 0, rotate: 0, scale: 1, duration: 0.5, ease: 'power3.out', stagger: 0.07 });
    },
    { dependencies: [match?.matchId, match?.playerHand.length] },
  );

  useGSAP(
    () => {
      const items = logRefs.current.filter(Boolean);
      if (!items.length) return;
      gsap.fromTo(items, { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: 0.3, stagger: 0.05, ease: 'power2.out' });
    },
    { dependencies: [logEntries.join('|')] },
  );

  useGSAP(
    () => {
      if (!attackFx || !beamRef.current || !damageRef.current) return;

      const fromPlayer = attackFx.attacker === 'player';
      const attackerCard = fromPlayer ? playerActiveRef.current : npcActiveRef.current;
      const defenderCard = fromPlayer ? npcActiveRef.current : playerActiveRef.current;
      const tl = gsap.timeline();

      gsap.set(beamRef.current, { opacity: 0, scaleX: 0.15, rotate: 0, transformOrigin: fromPlayer ? 'right center' : 'left center' });
      gsap.set(damageRef.current, { opacity: 0, x: fromPlayer ? -14 : 14, scale: 0.8 });

      if (attackerCard) {
        tl.fromTo(attackerCard, { x: 0, scale: 1 }, { x: fromPlayer ? -20 : 20, scale: 1.04, duration: 0.16, ease: 'power2.out', yoyo: true, repeat: 1 }, 0);
      }

      if (defenderCard) {
        tl.call(() => {
          const sfx = new Audio('/audio/sfx/damaged.wav');
          sfx.volume = 0.5;
          sfx.play().catch(() => {});
        }, undefined, 0.14);

        tl.fromTo(defenderCard, { filter: 'brightness(1)', x: 0 }, { filter: 'brightness(1.45)', x: 8, duration: 0.08, ease: 'power1.inOut', yoyo: true, repeat: 3 }, 0.14);
        
        if (attackFx.lethal) {
          tl.to(defenderCard, { filter: 'sepia(1) hue-rotate(-50deg) saturate(5) brightness(0.4)', duration: 0.6, ease: 'power2.out' }, '+=0.1');
        } else {
          tl.set(defenderCard, { clearProps: 'filter,x' });
        }
      }

      tl.to(beamRef.current, { opacity: 1, scaleX: 1, duration: 0.16, ease: 'power2.out' })
        .to(beamRef.current, { opacity: 0, duration: 0.18, ease: 'power1.in' })
        .to(damageRef.current, { opacity: 1, x: 0, scale: 1, duration: 0.18, ease: 'back.out(1.8)' }, '-=0.14')
        .to(damageRef.current, { opacity: 0, x: fromPlayer ? -30 : 30, duration: 0.45, ease: 'power2.out' }, '+=0.12')
        .call(() => setAttackFx(null));
    },
    { dependencies: [attackFx?.key] },
  );

  useGSAP(
    () => {
      if (!showResult || !resultPanelRef.current) return;
      gsap.fromTo(resultPanelRef.current, { opacity: 0, scale: 0.94, y: 24 }, { opacity: 1, scale: 1, y: 0, duration: 0.45, ease: 'power3.out' });
    },
    { dependencies: [showResult] },
  );

  const handleSelectPlayerActive = (cardId: string) => {
    const source = handCardMapRef.current[cardId];
    const target = playerSlotRef.current;

    if (source && target) {
      const sourceRect = source.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const clone = source.cloneNode(true) as HTMLElement;

      clone.style.position = 'fixed';
      clone.style.left = `${sourceRect.left}px`;
      clone.style.top = `${sourceRect.top}px`;
      clone.style.width = `${sourceRect.width}px`;
      clone.style.height = `${sourceRect.height}px`;
      clone.style.margin = '0';
      clone.style.zIndex = '120';
      clone.style.pointerEvents = 'none';
      clone.style.transform = 'none';
      document.body.appendChild(clone);

      gsap.to(clone, {
        left: targetRect.left + (targetRect.width - sourceRect.width) / 2,
        top: targetRect.top + (targetRect.height - sourceRect.height) / 2,
        scale: 0.76,
        rotate: 0,
        duration: 0.42,
        ease: 'power3.inOut',
        onComplete: () => clone.remove(),
      });
    }

    selectPlayerActive(cardId);
  };

  return (
    <main className="game-root" ref={rootRef}>
      {/* Catalog overlay — rendered on top, outside the battle scene */}
      {view === 'catalog' ? (
        <div className="catalog-view-root">
          <div className="catalog-back-bar">
            <button
              type="button"
              id="catalog-back-btn"
              className="secondary-action catalog-nav-btn"
              onClick={() => setView('battle')}
              aria-label="Volver a la batalla"
            >
              ← Volver a la batalla
            </button>
          </div>
          <CatalogPage />
        </div>
      ) : null}

      {/* Battle arena — mounted only when view is battle to save GPU */}
      <div style={{ display: view === 'battle' ? 'contents' : 'none' }}>
        {view === 'battle' && <ThreeArena />}

        {catalogStatus === 'loading' ? <section className="system-overlay"><h2>Preparando la arena...</h2></section> : null}
        {catalogStatus === 'error' ? <section className="system-overlay"><h2>No se pudo levantar la demo</h2><p>{errorMessage}</p></section> : null}

        {catalogStatus === 'ready' && match ? (
          <>
            <div className="board-overlay">
              <section className="hud-floating">
                <div className="brand-chip">
                  <p className="eyebrow">Card Battle Prototype</p>
                  <h1>TCG Battle Arena</h1>
                </div>

                <div className="hud-stats">
                  <article><span>Turno</span><strong>{match.turn === 'player' ? 'Jugador' : 'NPC'}</strong></article>
                  <article><span>Fase</span><strong>{getPhaseLabel(match.phase, match)}</strong></article>
                  <article><span>Ritmo</span><strong>{match.pendingNpc ? 'Resolviendo NPC' : 'Tu decisión'}</strong></article>
                </div>

                <div className="hud-actions">
                  <button type="button" className="secondary-action compact-action" onClick={startMatch} disabled={catalogStatus !== 'ready'}>
                    Nueva partida
                  </button>
                  <button
                    type="button"
                    id="open-catalog-btn"
                    className="secondary-action compact-action catalog-nav-btn"
                    onClick={() => setView('catalog')}
                    aria-label="Abrir catálogo de cartas"
                  >
                    📖 Catálogo
                  </button>
                </div>
              </section>

              <div className="board-plane">
                <div className="field-tag field-tag--top">NPC / Rival</div>
                <div className="field-tag field-tag--bottom">Jugador</div>

                <div className="opponent-deck-slot"><ZonePile label="Deck" /></div>
                <div className="opponent-discard-slot"><ZonePile label="Discard" /></div>
                <div className="opponent-bench-row"><BenchSlots owner="npc" /></div>
                <div className="opponent-active-slot" ref={npcActiveRef}>
                  {match.npcActive ? <ActiveCard battler={match.npcActive} owner="npc" status={match.pendingNpc ? 'NPC preparando respuesta' : 'Carta activa rival'} /> : <div className="empty-slot">Esperando rival</div>}
                </div>

                <div className="combat-lane">
                  <span className="combat-lane__label">Attack Lane</span>
                  <div className={`attack-beam attack-beam--${attackFx?.attacker ?? 'player'} ${attackFx ? 'is-active' : ''}`} ref={beamRef} />
                  <div className={`damage-badge damage-badge--${attackFx?.attacker === 'player' ? 'top' : 'bottom'} ${attackFx ? 'is-active' : ''}`} ref={damageRef}>-{attackFx?.damage ?? 0}</div>
                </div>

                <div className={`player-deck-slot ${match.phase !== 'selecting-active' ? 'is-hidden' : ''}`}><ZonePile label="Deck" /></div>
                <div className={`player-discard-slot ${match.phase !== 'selecting-active' ? 'is-hidden' : ''}`}><ZonePile label="Discard" /></div>
                <div className="player-bench-row"><BenchSlots owner="player" /></div>
                <div className="player-active-slot" ref={playerSlotRef}>
                  <div className="active-wrapper" ref={playerActiveRef}>
                    {match.playerActive ? <ActiveCard battler={match.playerActive} owner="player" status={match.phase === 'selecting-active' ? 'Seleccioná tu activo' : 'Tu carta activa'} /> : <div className="empty-slot empty-slot--player">Sin Pokémon activo</div>}
                  </div>
                </div>

                <div className="action-bar">
                  <button type="button" className="primary-action" onClick={() => assignPlayerEnergy()} disabled={!playerCanAssignEnergy}>Asignar energía</button>
                  <button type="button" className="primary-action accent-action" onClick={() => void playerAttack()} disabled={!playerCanAttack}>Atacar</button>
                  <button type="button" className="secondary-action" onClick={() => void passPlayerTurn()} disabled={!playerCanPass}>Pasar turno</button>
                </div>

                {match.playerActive ? <div className="energy-sidecar"><span className="eyebrow">Energía</span><strong>{match.playerActive.energy}/{match.playerActive.attackCost}</strong></div> : null}
              </div>

              <div className={`player-hand-zone ${match.phase !== 'selecting-active' ? 'is-hidden' : ''}`}>
                <div className="player-hand-zone__header">
                  <p className="eyebrow">Mano del jugador</p>
                  <span className="chip">{match.playerHand.length} cartas</span>
                </div>

                <div className="hand-fan">
                  {match.playerHand.map((card, index) => {
                    return (
                      <article
                        key={card.id}
                        className={`hand-card ${match.phase === 'selecting-active' ? 'is-selectable' : 'is-locked'}`}
                        ref={(node) => {
                          handRefs.current[index] = node;
                          handCardMapRef.current[card.id] = node;
                        }}
                      >
                        <div className="hand-card__image">
                          <img src={card.imageLarge || card.imageSmall} alt={`Carta de ${card.name}`} loading="lazy" />
                        </div>

                        <div className="hand-card__body">
                          <div className="hand-card__topline">
                            <h3>{card.name}</h3>
                            <span>{card.hp} HP</span>
                          </div>

                          <div className="chip-row">
                            <span className="chip chip--accent">{card.type}</span>
                            <span className="chip">Daño {card.attackDamage}</span>
                            <span className="chip">Costo {card.attackCost}</span>
                          </div>

                          <p className="hand-card__attack">{card.attackName}</p>

                          <button type="button" className="secondary-action full-width" onClick={() => handleSelectPlayerActive(card.id)} disabled={match.phase !== 'selecting-active'}>
                            {match.phase === 'selecting-active' ? 'Poner como activo' : 'Reservada en mano'}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>

              <section className="battle-log-anchor info-panel">
                <details className="battle-log-drawer">
                  <summary>Battle Log · últimos eventos</summary>
                  <ol className="battle-log battle-log--drawer">
                    {logEntries.map((entry, index) => (
                      <li key={`${match.matchId}-${index}`} ref={(node) => { logRefs.current[index] = node; }}>{entry}</li>
                    ))}
                  </ol>
                </details>
              </section>
            </div>

            {showResult ? (
              <section className="result-overlay">
                <div className="result-overlay__backdrop" />
                <div className="result-panel" ref={resultPanelRef}>
                  <p className="eyebrow">Partida terminada</p>
                  <h2>{match.winner === 'player' ? 'Victoria' : 'Derrota'}</h2>
                  <p>La demo mantuvo el loop completo y cerró la batalla correctamente.</p>

                  <div className="result-grid">
                    <div className="result-card">
                      <p className="eyebrow">Carta de la partida</p>
                      {cardOfTheGame ? (
                        <article className="result-card__feature">
                          <img src={cardOfTheGame.imageLarge || cardOfTheGame.imageSmall} alt={`Carta destacada de ${cardOfTheGame.name}`} />
                          <div>
                            <h3>{cardOfTheGame.name}</h3>
                            <p>{cardOfTheGame.attackName}</p>
                          </div>
                        </article>
                      ) : <p>Sin carta destacada.</p>}
                    </div>

                    {summary ? (
                      <div className="result-stats">
                        <article><span>Turnos jugados</span><strong>{summary.turnsPlayed}</strong></article>
                        <article><span>Daño realizado</span><strong>{summary.damageDealt}</strong></article>
                        <article><span>Daño recibido</span><strong>{summary.damageTaken}</strong></article>
                        <article><span>Cartas usadas</span><strong>{summary.cardsUsed}</strong></article>
                      </div>
                    ) : null}
                  </div>

                  <button type="button" className="primary-action" onClick={resetCurrentMatch}>Nueva partida</button>
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>{/* end battle display wrapper */}
    </main>
  );
}
