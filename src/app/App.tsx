import { useEffect, useRef, useState } from 'react';
import { ArExperience } from '../features/ar/ArExperience';
import { canAttack } from '../features/battle/gameEngine';
import { useBattleStore } from '../features/battle/store';
import type { GameState } from '../features/battle/types';
import { loadCards } from '../features/cards/cardRepository';
import { createPhaserBattleBridge, type PhaserBattleBridge } from '../game/phaserBridge';

type ViewMode = 'classic' | 'ar';

function PhaserBoard({ match }: { match: GameState }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const bridgeRef = useRef<PhaserBattleBridge | null>(null);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (!hostRef.current) {
        return;
      }

      const bridge = await createPhaserBattleBridge(hostRef.current);

      if (cancelled) {
        bridge.destroy();
        return;
      }

      bridgeRef.current = bridge;
      bridge.sync(match);
    };

    void bootstrap();

    return () => {
      cancelled = true;
      bridgeRef.current?.destroy();
      bridgeRef.current = null;
    };
  }, []);

  useEffect(() => {
    bridgeRef.current?.sync(match);
  }, [match]);

  return <div ref={hostRef} className="phaser-stage" aria-label="Tablero Phaser en modo solo lectura" />;
}

function BattleCard({
  title,
  hp,
  maxHp,
  energy,
  attackName,
  attackDamage,
  attackCost,
  status,
}: {
  title: string;
  hp: number;
  maxHp: number;
  energy: number;
  attackName: string;
  attackDamage: number;
  attackCost: number;
  status: string;
}) {
  const hpRatio = maxHp > 0 ? Math.max(0, Math.round((hp / maxHp) * 100)) : 0;

  return (
    <article className="battle-card" aria-label={`${title} en juego`}>
      <div className="battle-card-topline">
        <div>
          <p className="eyebrow">{status}</p>
          <h3>{title}</h3>
        </div>
        <span className="counter-pill">{hp}/{maxHp} HP</span>
      </div>

      <div className="meter-block" aria-label={`Vida restante de ${title}`}>
        <div className="meter-track">
          <div className="meter-fill" style={{ width: `${hpRatio}%` }} />
        </div>
      </div>

      <dl className="battle-card-stats">
        <div>
          <dt>Energía</dt>
          <dd>{energy}</dd>
        </div>
        <div>
          <dt>Ataque</dt>
          <dd>{attackName}</dd>
        </div>
        <div>
          <dt>Daño</dt>
          <dd>{attackDamage}</dd>
        </div>
        <div>
          <dt>Costo</dt>
          <dd>{attackCost}</dd>
        </div>
      </dl>
    </article>
  );
}

export function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('classic');
  const {
    aesthetic,
    npcRuntime,
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

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      setCatalogLoading();

      try {
        const catalog = await loadCards();

        if (active) {
          initializeCatalog(catalog);
        }
      } catch (error) {
        if (!active) {
          return;
        }

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

  if (viewMode === 'ar' && catalogStatus === 'ready') {
    return <ArExperience onExit={() => setViewMode('classic')} />;
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-actions">
          <div>
            <p className="eyebrow">Work Unit 3</p>
            <h1>Mesa Phaser + NPC HTTP opcional</h1>
          </div>
          <div className="hero-action-group">
            <button type="button" className="secondary-action" onClick={startMatch} disabled={catalogStatus !== 'ready'}>
              Nueva partida
            </button>
            <button
              type="button"
              className="primary-action"
              onClick={() => setViewMode('ar')}
              disabled={catalogStatus !== 'ready'}
            >
              Modo AR
            </button>
          </div>
        </div>

        <p className="hero-copy">
          React sigue gobernando el flujo. Phaser observa el store para pintar la mesa y el NPC puede
          consultar backend sólo si vos lo habilitás; si falla, la demo vuelve al mock local.
        </p>

        <dl className="hero-meta" aria-label="decisiones del slice">
          <div>
            <dt>Filosofía</dt>
            <dd>{aesthetic.name}</dd>
          </div>
          <div>
            <dt>Por qué</dt>
            <dd>{aesthetic.why}</dd>
          </div>
          <div>
            <dt>NPC mode</dt>
            <dd>{npcRuntime.mode === 'http' ? `HTTP opcional · ${npcRuntime.endpoint}` : 'Mock local seguro por defecto'}</dd>
          </div>
        </dl>
      </section>

      {catalogStatus === 'loading' ? (
        <section className="state-panel" aria-live="polite">
          <p className="state-kicker">Cargando catálogo local</p>
          <h2>Armando la partida offline</h2>
          <p>Parseando el CSV y preparando un match determinístico para empezar a jugar.</p>
        </section>
      ) : null}

      {catalogStatus === 'error' ? (
        <section className="state-panel error-panel" aria-live="assertive">
          <p className="state-kicker">Error de bootstrap</p>
          <h2>No se pudo iniciar la demo</h2>
          <p>{errorMessage}</p>
          <button type="button" className="primary-action" onClick={() => void loadCards().then(initializeCatalog).catch((error) => setCatalogError(error instanceof Error ? error.message : 'No se pudo cargar el catálogo.'))}>
            Reintentar carga
          </button>
        </section>
      ) : null}

      {catalogStatus === 'ready' && match ? (
        <>
          <section className="summary-strip" aria-label="estado de la partida">
            <article>
              <span>Fase</span>
              <strong>{match.phase}</strong>
            </article>
            <article>
              <span>Turno</span>
              <strong>{match.turn === 'player' ? 'Jugador' : 'NPC'}</strong>
            </article>
            <article>
              <span>Resultado</span>
              <strong>{match.winner ? (match.winner === 'player' ? 'Victoria' : 'Derrota') : 'En curso'}</strong>
            </article>
          </section>

          <section className="battle-layout">
            <section className="battle-board" aria-labelledby="battle-board-title">
              <div className="section-heading compact-heading">
                <div>
                  <p className="eyebrow">Mesa activa</p>
                  <h2 id="battle-board-title">Frente de combate</h2>
                </div>
                <p>HP y energía visibles siempre. Nada escondido, nada mágico.</p>
              </div>

              <div className="battle-board-stack">
                <PhaserBoard match={match} />

                <p className="board-caption">
                  Phaser refleja turno, HP, energía y feedback simple de daño. El estado REAL sigue en Zustand.
                </p>

                <div className="arena-grid">
                {match.npcActive ? (
                  <BattleCard
                    title={match.npcActive.name}
                    hp={match.npcActive.currentHp}
                    maxHp={match.npcActive.hp}
                    energy={match.npcActive.energy}
                    attackName={match.npcActive.attackName}
                    attackDamage={match.npcActive.attackDamage}
                    attackCost={match.npcActive.attackCost}
                    status={match.pendingNpc ? 'NPC pensando…' : 'Activo NPC'}
                  />
                ) : null}

                {match.playerActive ? (
                  <BattleCard
                    title={match.playerActive.name}
                    hp={match.playerActive.currentHp}
                    maxHp={match.playerActive.hp}
                    energy={match.playerActive.energy}
                    attackName={match.playerActive.attackName}
                    attackDamage={match.playerActive.attackDamage}
                    attackCost={match.playerActive.attackCost}
                    status={match.phase === 'selecting-active' ? 'Esperando selección' : 'Activo jugador'}
                  />
                ) : (
                  <article className="battle-card placeholder-card">
                    <p className="eyebrow">Paso obligatorio</p>
                    <h3>Elegí tu carta activa</h3>
                    <p>Hasta que no la bajes al frente, no hay energía ni ataque habilitado.</p>
                  </article>
                )}
                </div>
              </div>
            </section>

            <aside className="control-column">
              <section className="control-panel" aria-labelledby="actions-title">
                <div className="section-heading compact-heading">
                  <div>
                    <p className="eyebrow">Acciones</p>
                    <h2 id="actions-title">Turno del jugador</h2>
                  </div>
                  <p>
                    {match.phase === 'selecting-active'
                      ? 'Primero elegí tu Pokémon activo.'
                      : match.pendingNpc
                        ? 'Esperá la respuesta offline del NPC.'
                        : 'Una energía por turno. Luego atacá o pasá.'}
                  </p>
                </div>

                <div className="action-stack">
                  <button type="button" className="primary-action" onClick={() => assignPlayerEnergy()} disabled={!playerCanAssignEnergy}>
                    Asignar energía
                  </button>
                  <button type="button" className="primary-action accent-action" onClick={() => void playerAttack()} disabled={!playerCanAttack}>
                    Atacar
                  </button>
                  <button type="button" className="secondary-action full-width" onClick={() => void passPlayerTurn()} disabled={!playerCanPass}>
                    Pasar turno
                  </button>
                </div>
              </section>

              <section className="control-panel" aria-labelledby="log-title">
                <div className="section-heading compact-heading">
                  <div>
                    <p className="eyebrow">Battle log</p>
                    <h2 id="log-title">Bitácora</h2>
                  </div>
                </div>

                <ol className="battle-log">
                  {match.log.map((entry, index) => (
                    <li key={`${match.matchId}-${index}`}>{entry}</li>
                  ))}
                </ol>
              </section>
            </aside>
          </section>

          <section className="hand-section" aria-labelledby="starter-hand-title">
            <div className="section-heading compact-heading">
              <div>
                <p className="eyebrow">Mano</p>
                <h2 id="starter-hand-title">Elegí o revisá tus cartas</h2>
              </div>
              <p>La selección activa sale de la mano. El resto queda visible como contexto del turno.</p>
            </div>

            <div className="card-grid">
              {match.playerHand.map((card) => (
                <article key={card.id} className="pokemon-card selectable-card">
                  <img src={card.imageSmall} alt={`Carta de ${card.name}`} loading="lazy" />
                  <div className="card-body">
                    <div className="card-topline">
                      <h3>{card.name}</h3>
                      <span>{card.hp} HP</span>
                    </div>
                    <p className="type-pill">{card.type}</p>
                    <dl className="card-stats">
                      <div>
                        <dt>Ataque</dt>
                        <dd>{card.attackName}</dd>
                      </div>
                      <div>
                        <dt>Daño</dt>
                        <dd>{card.attackDamage}</dd>
                      </div>
                      <div>
                        <dt>Costo</dt>
                        <dd>{card.attackCost}</dd>
                      </div>
                    </dl>
                    <button
                      type="button"
                      className="secondary-action full-width"
                      onClick={() => selectPlayerActive(card.id)}
                      disabled={match.phase !== 'selecting-active'}
                    >
                      {match.phase === 'selecting-active' ? 'Poner como activo' : 'En mano'}
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {match.playerActive ? (
              <p className="active-caption">Activo actual: {match.playerActive.name}. Energía: {match.playerActive.energy}.</p>
            ) : null}
          </section>

          {match.winner ? (
            <section className="state-panel result-panel" aria-live="polite">
              <p className="state-kicker">Partida resuelta</p>
              <h2>{match.winner === 'player' ? 'Ganaste la demo local' : 'El NPC ganó esta vuelta'}</h2>
              <p>El estado se puede reiniciar completo sin arrastrar HP, energía ni log.</p>
              <button type="button" className="primary-action" onClick={resetCurrentMatch}>
                Volver a jugar
              </button>
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
