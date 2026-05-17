import { canAttack } from '../battle/gameEngine';
import { useBattleStore } from '../battle/store';
import type { GameState } from '../battle/types';

type ArHudProps = {
  match: GameState;
  webXrSupported: boolean;
  previewMode: boolean;
  tablePlaced: boolean;
  placementArmed: boolean;
  onEnterAr: () => void;
  onArmPlacement: () => void;
  onTogglePreview: () => void;
  onExitAr: () => void;
};

export function ArHud({
  match,
  webXrSupported,
  previewMode,
  tablePlaced,
  placementArmed,
  onEnterAr,
  onArmPlacement,
  onTogglePreview,
  onExitAr,
}: ArHudProps) {
  const {
    startMatch,
    selectPlayerActive,
    assignPlayerEnergy,
    playerAttack,
    passPlayerTurn,
    resetCurrentMatch,
  } = useBattleStore();

  const playerCanAssignEnergy =
    match.phase === 'player-turn' &&
    match.turn === 'player' &&
    Boolean(match.playerActive) &&
    !match.energyAssignedThisTurn &&
    !match.pendingNpc;

  const playerCanAttack =
    match.phase === 'player-turn' && match.turn === 'player' && canAttack(match.playerActive) && !match.pendingNpc;

  const playerCanPass =
    match.phase === 'player-turn' && match.turn === 'player' && !match.pendingNpc && !match.winner;

  const recentLog = match.log.slice(-5);

  return (
    <div className="ar-hud" aria-label="Controles de modo AR">
      <header className="ar-hud-top">
        <div>
          <p className="eyebrow">Modo AR</p>
          <h1>Mesa WebXR</h1>
        </div>
        <button type="button" className="secondary-action" onClick={onExitAr}>
          Salir de AR
        </button>
      </header>

      <section className="ar-hud-status" aria-live="polite">
        <p>
          {previewMode
            ? 'Vista previa 3D (sin cámara). Activá AR en un dispositivo compatible.'
            : tablePlaced
              ? 'Mesa colocada. Jugá con los controles.'
              : placementArmed
                ? 'Buscando superficie… mantené el teléfono apuntando a la mesa.'
                : 'Entrá a AR y tocá “Colocar mesa” sobre una superficie plana.'}
        </p>
        <p className="ar-hud-meta">
          Fase: {match.phase} · Turno: {match.turn === 'player' ? 'Jugador' : 'NPC'}
          {match.winner ? ` · ${match.winner === 'player' ? 'Victoria' : 'Derrota'}` : ''}
        </p>
      </section>

      <section className="ar-hud-actions">
        {!previewMode && webXrSupported ? (
          <button type="button" className="primary-action" onClick={onEnterAr}>
            Iniciar AR
          </button>
        ) : null}

        {!previewMode && webXrSupported ? (
          <button
            type="button"
            className="secondary-action"
            onClick={onArmPlacement}
            disabled={tablePlaced || placementArmed}
          >
            Colocar mesa
          </button>
        ) : null}

        <button type="button" className="secondary-action" onClick={onTogglePreview}>
          {previewMode ? 'Intentar AR' : 'Vista previa 3D'}
        </button>

        <button type="button" className="secondary-action" onClick={startMatch}>
          Nueva partida
        </button>

        {match.phase === 'selecting-active' ? (
          <div className="ar-hand-picker">
            <p className="eyebrow">Elegí tu activo</p>
            <ul>
              {match.playerHand.map((card) => (
                <li key={card.id}>
                  <button type="button" className="secondary-action full-width" onClick={() => selectPlayerActive(card.id)}>
                    {card.name} · {card.hp} HP
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <button type="button" className="primary-action" onClick={() => assignPlayerEnergy()} disabled={!playerCanAssignEnergy}>
              Asignar energía
            </button>
            <button type="button" className="primary-action accent-action" onClick={() => void playerAttack()} disabled={!playerCanAttack}>
              Atacar
            </button>
            <button type="button" className="secondary-action full-width" onClick={() => void passPlayerTurn()} disabled={!playerCanPass}>
              Pasar turno
            </button>
          </>
        )}

        {match.winner ? (
          <button type="button" className="primary-action" onClick={resetCurrentMatch}>
            Volver a jugar
          </button>
        ) : null}
      </section>

      {!webXrSupported ? (
        <p className="ar-hud-warning">
          WebAR requiere HTTPS y un navegador compatible (por ejemplo Chrome en Android). Usá la vista previa 3D en
          desktop.
        </p>
      ) : null}

      <section className="ar-hud-log" aria-label="Bitácora reciente">
        <h2>Bitácora</h2>
        <ol>
          {recentLog.map((entry, index) => (
            <li key={`${match.matchId}-log-${index}`}>{entry}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
