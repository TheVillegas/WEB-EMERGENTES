import { useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
//import { loadCards, parseCatalogCsv } from '../features/cards/cardRepository';
import { useBattleStore } from '../features/battle/store';
//import type { Battler } from '../features/battle/types';
import type { GameState, TurnPhase } from '../features/battle/types';
import type { PvpMatchInfo } from '../features/multiplayer/multiplayerService';
import type { PokemonCard, TrainerCard } from '../tcg-engine/types';
import { isPokemonCard, isTrainerCard, validateAttackCost } from '../tcg-engine/engine';
import { isBasicPokemon } from '../tcg-engine/state';
import { ThreeArena } from '../game/ThreeArena';
import { CatalogPage } from '../features/catalog/CatalogPage';
import { MainMenu } from './MainMenu';
import { DeckSelection } from '../DeckSeleccion/DeckSelection';
import { DifficultySelection } from './DifficultySelection';
import { NameEntry } from './NameEntry';
import { Tutorial } from './Tutorial';

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

function getPhaseLabel(phase: TurnPhase, match: GameState, isPvp: boolean): string {
  if (phase === 'waiting-for-opponent') return 'Esperando rival';
  if (phase === 'opponent-selecting-active') return 'Rival eligiendo';
  if (phase === 'selecting-active') return 'Elegir carta';
  if (phase === 'npc-turn') return isPvp ? 'Turno Rival' : 'Turno NPC';
  if (phase === 'game-over') return 'Final';
  if (match.turn === 'player') return match.energyAssignedThisTurn ? 'Ataque o pase' : 'Asignar energía';
  return 'Resolución';
}



function ZonePile({ label, count }: { label: string; count?: number }) {
  return (
    <div className="zone-pile">
      <div className="zone-pile__stack" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <small>{label}{count !== undefined ? ` (${count})` : ''}</small>
    </div>
  );
}

function BenchSlot({
  battler,
  onClick,
  selectable,
  label,
  retreatCost,
}: {
  battler: { card: PokemonCard; currentHp: number } | null;
  onClick?: () => void;
  selectable?: boolean;
  label: string;
  retreatCost?: number;
}) {
  if (!battler) {
    return (
      <div className="bench-slot bench-slot--empty">
        <span>{label}</span>
      </div>
    );
  }

  const hpRatio = battler.card.hp > 0 ? Math.round((battler.currentHp / battler.card.hp) * 100) : 0;
  const hpTone = hpRatio <= 25 ? 'danger' : hpRatio <= 55 ? 'warning' : 'safe';

  return (
    <div
      className={`bench-slot bench-slot--occupied ${selectable ? 'bench-slot--selectable' : ''}`}
      onClick={selectable ? onClick : undefined}
      role={selectable ? 'button' : undefined}
      tabIndex={selectable ? 0 : undefined}
    >
      <img
        src={battler.card.imageSmall || battler.card.imageLarge}
        alt={battler.card.name}
        className="bench-slot__img"
        loading="lazy"
      />
      <div className="bench-slot__info">
        <span className="bench-slot__name">{battler.card.name}</span>
        <div className={`bench-slot__hp hp-pill--${hpTone}`}>
          {battler.currentHp}/{battler.card.hp}
        </div>
        {retreatCost !== undefined && (
          <div className="bench-slot__retreat-badge" title={`Costo de retirada: ${retreatCost} energía`}>
            {retreatCost === 0 ? 'Retirada Libre' : `Retirada: ${retreatCost}`}
          </div>
        )}
      </div>
    </div>
  );
}



type BenchSelectionOverlayProps = {
  hand: PokemonCard[];
  maxSelectable: number;
  onConfirm: (selectedIds: string[]) => void;
};

function BenchSelectionOverlay({ hand, maxSelectable, onConfirm }: BenchSelectionOverlayProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const basics = hand.filter(c => isBasicPokemon(c));

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= maxSelectable) return prev;
      return [...prev, id];
    });
  };

  return (
    <section className="confirm-overlay bench-selection-overlay">
      <div className="confirm-overlay__backdrop" />
      <div className="confirm-panel bench-selection-panel">
        <h2>Selecciona tu Banca</h2>
        <p className="eyebrow">Puedes elegir hasta 3 Pokémon básicos ({selected.length}/3)</p>
        <div className="bench-selection-grid">
          {basics.map((card) => (
            <div
              key={card.id}
              className={`bench-select-card ${selected.includes(card.id) ? 'bench-select-card--selected' : ''}`}
              onClick={() => toggleSelect(card.id)}
            >
              <img src={card.imageSmall} alt={card.name} loading="lazy" />
              {selected.includes(card.id) && <div className="bench-select-card__check">✓</div>}
            </div>
          ))}
        </div>
        <div className="confirm-actions">
          <button className="primary-action" onClick={() => onConfirm(selected)}>
            {selected.length > 0 ? 'Confirmar Banca' : 'Saltar sin Banca'}
          </button>
        </div>
      </div>
    </section>
  );
}

type PvpLobbyProps = {
  pvpStatus: 'idle' | 'searching' | 'matched' | 'disconnected';
  pvpMatchInfo: PvpMatchInfo | null;
  onSearch: () => void;
  onCancel: () => void;
  onStartBattle: () => void;
};

function PvpLobby({ pvpStatus, pvpMatchInfo, onSearch, onCancel, onStartBattle }: PvpLobbyProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pvpStatus === 'idle') {
      onSearch();
    }
  }, []);

  useEffect(() => {
    if (pvpStatus === 'matched') {
      const timer = setTimeout(() => onStartBattle(), 1500);
      return () => clearTimeout(timer);
    }
  }, [pvpStatus, onStartBattle]);

  useGSAP(
    () => {
      gsap.from('.pvp-lobby__content', {
        opacity: 0,
        y: 30,
        duration: 0.6,
        ease: 'power3.out',
      });
    },
    { scope: containerRef },
  );

  return (
    <div className="menu-screen" ref={containerRef}>
      <div className="menu-backdrop">
        <div className="menu-backdrop-glow" />
      </div>

      <div className="pvp-lobby__content">
        {pvpStatus === 'searching' && (
          <>
            <div className="pvp-lobby__icon">⚔️</div>
            <h2>Buscando oponente…</h2>
            <p className="eyebrow">Esperando a que otro jugador se conecte en la misma red</p>
            <div className="pvp-lobby__spinner">
              <span /><span /><span />
            </div>
            <button type="button" className="secondary-action" onClick={onCancel}>
              Cancelar búsqueda
            </button>
          </>
        )}

        {pvpStatus === 'matched' && pvpMatchInfo && (
          <>
            <div className="pvp-lobby__icon">🎮</div>
            <h2>¡Oponente encontrado!</h2>
            <p className="eyebrow">Vs. {pvpMatchInfo.opponentName}</p>
            <p>Eres el <strong>{pvpMatchInfo.role === 'player1' ? 'Jugador 1' : 'Jugador 2'}</strong></p>
            <p className="pvp-lobby__starting">Preparando la arena…</p>
          </>
        )}
      </div>
    </div>
  );
}

type AppView = 'name-entry' | 'menu' | 'deck-selection' | 'difficulty-selection' | 'pvp-lobby' | 'battle' | 'catalog' | 'tutorial';

export function App() {
  const [view, setView] = useState<AppView>('name-entry');
  const [previousView, setPreviousView] = useState<AppView>('menu');
  const [playerName, setPlayerName] = useState('Jugador');
  const [showResult, setShowResult] = useState(false);
  const [showConfirmExit, setShowConfirmExit] = useState(false);
  const [navigationPath, setNavigationPath] = useState<Array<{ timestamp: string; username: string; view: string }>>([
    { timestamp: new Date().toLocaleString(), username: 'Jugador', view: 'name-entry' }
  ]);
  const [focusedArea] = useState<'hand' | 'actions'>('hand');
  const [focusedHandIndex] = useState(0);
  const [focusedActionIndex] = useState(0);
  const [showAttackSelector, setShowAttackSelector] = useState(false);
  const [showDiceAnimation, setShowDiceAnimation] = useState(false);

  const {
    catalogStatus,
    errorMessage,
    match,
    tcgState,
    playerId,
    opponentId,
    //selectedDifficulty,
    pendingAction,
    pendingTrainerIndex,
    setCatalogLoading,
    setCatalogError,
    initializeCatalog,
    startMatch,
    startPvpMatch,
    selectPlayerActive,
    drawPhase,
    assignPlayerEnergy,
    playerAttack,
    playTrainer,
    evolve,
    switchActivePokemon,
    forceSwitchAfterKO,
    passPlayerTurn,
    resetCurrentMatch,
    setPendingAction,
    setPlayerName: setStorePlayerName,
    appendBattleLog,
    startPvpSearch,
    cancelPvpSearch,
    disconnectPvp,
    triggerNpcTurnIfNeeded,
  } = useBattleStore();
  const { isPvp, pvpMatchInfo, pvpStatus } = useBattleStore();

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
  const npcTriggeredRef = useRef(false);
  const attackAvailabilityLogRef = useRef<string | null>(null);
  const resultAudioRef = useRef<HTMLAudioElement | null>(null);
  const battleAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);

  const unlockAudio = () => {
    if (audioUnlockedRef.current) return;
    audioUnlockedRef.current = true;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    ctx.resume().catch(() => { });
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  };

  const handleNavigate = (nextView: AppView, customName?: string) => {
    const activeName = customName !== undefined ? customName : playerName;
    const logTime = new Date().toLocaleString();
    setNavigationPath((prev) => [...prev, { timestamp: logTime, username: activeName, view: nextView }]);
    setView(nextView);
  };

  const handleDownloadLogsCSV = () => {
    const headers = ['Fecha y hora de inicio de prueba', 'Nombre de usuario', 'Ruta de las opciones que escoje'];
    const rows = navigationPath.map(item => [item.timestamp, item.username, item.view]);
    const csvContent = [
      headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','),
      ...rows.map(row => row.map(r => `"${r.replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `log_prueba_${playerName.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      setCatalogLoading();
      try {
        const response = await fetch('/data/pokemon_cards_gen1_img.csv');
        const csvText = await response.text();

        // Parse for legacy catalog
        const Papa = await import('papaparse');
        const parsed = Papa.default.parse(csvText, { header: true, skipEmptyLines: true });
        const csvRows = parsed.data as any[];

        // Load legacy cards
        const { normalizeCatalog } = await import('../features/cards/cardRepository');
        const legacyCards = normalizeCatalog(csvRows);

        if (active) {
          initializeCatalog(legacyCards, csvRows);
        }
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : 'No se pudo cargar el catálogo.';
        setCatalogError(message);
      }
    };
    void bootstrap();
    return () => { active = false; };
  }, [initializeCatalog, setCatalogError, setCatalogLoading]);

  // Derive new state info from tcgState
  const tcgPlayer = tcgState?.players[playerId];
  const tcgOpponent = tcgState?.players[opponentId];
  const isSetupPhase = tcgState?.gamePhase === 'setup';
  const playerNeedsToSelectActive = isSetupPhase && tcgPlayer && !tcgPlayer.activeBattler;
  const needsForceSwitch = tcgState?.gamePhase === 'battle' && tcgPlayer && !tcgPlayer.activeBattler && (tcgPlayer.bench.length ?? 0) > 0;
  const activeAttacks = tcgPlayer?.activeBattler?.card.attacks ?? [];
  const playerCanBenchBasic =
    tcgState?.gamePhase === 'battle' &&
    tcgState.currentTurn === playerId &&
    !match?.pendingNpc &&
    !match?.winner &&
    (tcgPlayer?.bench.length ?? 0) < 3 &&
    Boolean(tcgPlayer?.hand.some((card) => isPokemonCard(card) && isBasicPokemon(card)));
  const playerCanSwitchActive =
    match?.phase === 'player-turn' &&
    match.turn === 'player' &&
    !match?.pendingNpc &&
    !match?.winner &&
    tcgPlayer?.activeBattler != null &&
    (tcgPlayer.bench.length ?? 0) > 0;

  const canRetreat =
    match?.phase === 'player-turn' &&
    match.turn === 'player' &&
    !match.pendingNpc &&
    !needsForceSwitch &&
    !tcgPlayer?.hasRetreated &&
    tcgPlayer?.activeBattler != null &&
    (tcgPlayer.bench.length ?? 0) > 0 &&
    (tcgPlayer.activeBattler.card.retreatCost === 0 ||
      Object.values(tcgPlayer.activeBattler.attachedEnergies).reduce((a, b) => a + b, 0) >=
      tcgPlayer.activeBattler.card.retreatCost);

  const playerCanAssignEnergy =
    tcgState?.gamePhase === 'battle' &&
    tcgState.currentTurn === playerId &&
    (tcgState.turnPhase === 'draw' || tcgState.turnPhase === 'main') &&
    Boolean(tcgPlayer?.activeBattler) &&
    !match?.energyAssignedThisTurn &&
    !match?.pendingNpc &&
    !match?.winner;

  const playerCanPass =
    tcgState?.gamePhase === 'battle' &&
    tcgState.currentTurn === playerId &&
    !match?.pendingNpc &&
    !match?.winner &&
    !needsForceSwitch;

  useEffect(() => {
    if (!tcgState || isPvp || !match || tcgState.gamePhase !== 'battle' || tcgState.currentTurn !== playerId) {
      attackAvailabilityLogRef.current = null;
      return;
    }

    const activeBattler = tcgPlayer?.activeBattler;
    if (!activeBattler) {
      attackAvailabilityLogRef.current = null;
      return;
    }

    const legalAttacks = activeBattler.card.attacks.filter((attackCard) =>
      validateAttackCost(activeBattler, attackCard.cost).valid,
    );

    let message: string;
    if (tcgState.turnPhase !== 'main') {
      message = tcgState.turnNumber === 1
        ? 'Ataque no disponible: no puedes atacar en el primer turno.'
        : 'Ataque no disponible: espera a la fase principal.';
    } else if (legalAttacks.length > 0) {
      message = `Ataque disponible: ${legalAttacks.map((attackCard) => attackCard.name).join(', ')}.`;
    } else {
      message = 'Ataque no disponible: no tienes energía suficiente para atacar.';
    }

    if (attackAvailabilityLogRef.current !== message) {
      attackAvailabilityLogRef.current = message;
      appendBattleLog(message);
    }
  }, [
    appendBattleLog,
    isPvp,
    match,
    playerId,
    tcgPlayer?.activeBattler,
    tcgState?.currentTurn,
    tcgState?.gamePhase,
    tcgState?.turnNumber,
    tcgState?.turnPhase,
  ]);

  // Auto draw phase on player's turn
  useEffect(() => {
    if (!tcgState || !match) return;
    if (tcgState.gamePhase === 'battle' &&
      tcgState.currentTurn === playerId &&
      tcgState.turnPhase === 'draw' &&
      tcgState.turnNumber > 1 &&
      tcgPlayer?.activeBattler) {
      drawPhase();
    }
  }, [tcgState?.turnNumber, tcgState?.currentTurn]);

  // Dice animation on game start
  useEffect(() => {
    if (tcgState?.diceRoll && tcgState.gamePhase === 'setup') {
      setShowDiceAnimation(true);
      const timer = setTimeout(() => setShowDiceAnimation(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [tcgState?.diceRoll]);

  useEffect(() => {
    if (!tcgState || isPvp || !match) {
      return;
    }

    if (tcgState.gamePhase === 'setup') {
      npcTriggeredRef.current = false;
      return;
    }

    if (
      tcgState.gamePhase === 'battle' &&
      tcgState.currentTurn === opponentId &&
      !npcTriggeredRef.current
    ) {
      npcTriggeredRef.current = true;
      const timer = setTimeout(() => {
        void triggerNpcTurnIfNeeded();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [tcgState?.gamePhase, tcgState?.currentTurn, tcgState?.turnNumber, isPvp, match?.matchId, opponentId, triggerNpcTurnIfNeeded]);

  const logEntries = useMemo(() => (tcgState ? tcgState.log.slice(-6).reverse() : []), [tcgState?.log]);

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
  }, [match?.playerActive, match?.npcActive]);

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
    if (match?.phase === 'npc-turn' && !isPvp) {
      triggerNpcTurnIfNeeded();
    }
  }, [match?.phase, isPvp, triggerNpcTurnIfNeeded]);

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
      audio.play().catch(() => { });
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
        audio.play().catch(() => { });
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
          sfx.play().catch(() => { });
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

  const handleAttackSelect = (attackIndex: number) => {
    setShowAttackSelector(false);
    if (activeAttacks[attackIndex] && tcgPlayer?.activeBattler && validateAttackCost(tcgPlayer.activeBattler, activeAttacks[attackIndex].cost).valid) {
      void playerAttack(attackIndex);
    } else {
      appendBattleLog('Ataque no disponible: esa opción no se puede ejecutar ahora.');
    }
  };

  // Get available attacks for the selector
  return (
    <main className="game-root" ref={rootRef}>
      {/* Catalog overlay */}
      {view === 'catalog' ? (
        <div className="catalog-view-root">
          <div className="catalog-back-bar">
            <button
              type="button"
              id="catalog-back-btn"
              className="secondary-action catalog-nav-btn"
              onClick={() => handleNavigate(previousView)}
              aria-label={previousView === 'menu' ? "Volver al menú" : "Volver a la batalla"}
            >
              ← {previousView === 'menu' ? 'Volver al menú' : 'Volver a la batalla'}
            </button>
          </div>
          <CatalogPage />
        </div>
      ) : null}

      {view === 'name-entry' ? (
        <NameEntry
          onConfirm={(name) => {
            setPlayerName(name);
            setStorePlayerName(name);
            unlockAudio();
            handleNavigate('menu', name);
          }}
        />
      ) : null}

      {view === 'menu' ? (
        <MainMenu
          onStart={() => { unlockAudio(); handleNavigate('deck-selection'); }}
          onCatalog={() => { unlockAudio(); setPreviousView('menu'); handleNavigate('catalog'); }}
          onTutorial={() => { unlockAudio(); handleNavigate('tutorial'); }}
          onExitTest={() => { setShowConfirmExit(true); }}
        />
      ) : null}

      {view === 'tutorial' ? <Tutorial onBack={() => handleNavigate('menu')} /> : null}

      {view === 'deck-selection' ? <DeckSelection onSelect={() => handleNavigate('difficulty-selection')} onBack={() => handleNavigate('menu')} /> : null}

      {view === 'difficulty-selection' ? <DifficultySelection onSelect={() => {
        const state = useBattleStore.getState();
        if (state.selectedDifficulty === '1vs1') {
          // PvP: don't create match yet, go to lobby first
          handleNavigate('pvp-lobby');
        } else {
          startMatch();
          handleNavigate('battle');
        }
      }} onBack={() => setView('deck-selection')} /> : null}

      {view === 'pvp-lobby' ? <PvpLobby
        pvpStatus={pvpStatus}
        pvpMatchInfo={pvpMatchInfo}
        onSearch={startPvpSearch}
        onCancel={() => { cancelPvpSearch(); handleNavigate('difficulty-selection'); }}
        onStartBattle={() => { startPvpMatch(); handleNavigate('battle'); }}
      /> : null}

      {/* Battle arena */}
      <div style={{ display: view === 'battle' ? 'contents' : 'none' }}>
        {view === 'battle' && <ThreeArena match={match} focusedArea={focusedArea} focusedHandIndex={focusedHandIndex} focusedActionIndex={focusedActionIndex} onSelectPlayerActive={handleSelectPlayerActive} />}

        {catalogStatus === 'loading' ? <section className="system-overlay"><h2>Preparando la arena...</h2></section> : null}
        {catalogStatus === 'error' ? <section className="system-overlay"><h2>No se pudo levantar la demo</h2><p>{errorMessage}</p></section> : null}

        {catalogStatus === 'ready' && match ? (
          <>
            {/* Dice animation overlay */}
            {showDiceAnimation && tcgState?.diceRoll && (
              <div className="dice-overlay">
                <div className="dice-overlay__content">
                  <div className="dice-overlay__dice">🎲</div>
                  <h2 className="dice-overlay__result">{tcgState.diceRoll}</h2>
                  <p className="dice-overlay__label">
                    {tcgState.diceRoll % 2 === 0 ? '¡Par! Empiezas tú' : '¡Impar! Empieza el rival'}
                  </p>
                </div>
              </div>
            )}

            <div className="board-overlay">
              <section className="hud-floating">
                <div className="brand-chip">
                  <p className="eyebrow">Card Battle Prototype</p>
                  <h1>TCG Battle Arena</h1>
                </div>

                <div className="hud-stats">
                  <article><span>Turno</span><strong>{match.turn === 'player' ? 'Jugador' : (isPvp ? 'Rival' : 'NPC')}</strong></article>
                  <article><span>Fase</span><strong>{getPhaseLabel(match.phase, match, isPvp)}</strong></article>
                  <article>
                    <span>Puntos</span>
                    <strong>{tcgPlayer?.points ?? 0}/3 vs {tcgOpponent?.points ?? 0}/3</strong>
                  </article>
                </div>

                <div className="hud-actions">
                  <button type="button" className="secondary-action compact-action" onClick={() => handleNavigate('menu')}>
                    Menú Principal
                  </button>
                  <button type="button" className="secondary-action compact-action" onClick={startMatch} disabled={catalogStatus !== 'ready'}>
                    Nueva partida
                  </button>
                  <button
                    type="button"
                    id="open-catalog-btn"
                    className="secondary-action compact-action catalog-nav-btn"
                    onClick={() => { setPreviousView('battle'); handleNavigate('catalog'); }}
                    aria-label="Abrir catálogo de cartas"
                  >
                    📖 Catálogo
                  </button>
                </div>
              </section>

              <div className="board-plane">
                {(playerNeedsToSelectActive || match.phase === 'selecting-active') && match.turn === 'player' ? (
                  <div className="selection-instruction">
                    <h2>Selecciona un Pokémon básico para activar</h2>
                  </div>
                ) : null}

                <div className="field-tag field-tag--top">{isPvp ? (pvpMatchInfo?.opponentName || 'Rival') : 'NPC / Rival'}</div>
                <div className="field-tag field-tag--bottom">Jugador</div>

                <div className="opponent-deck-slot"><ZonePile label="Deck" count={tcgOpponent?.deck.length} /></div>
                <div className="opponent-discard-slot"><ZonePile label="Descarte" count={tcgOpponent?.discard.length} /></div>

                {/* NPC Bench — real Pokémon */}
                <div className="opponent-bench-row">
                  <div className={`bench-row bench-row--npc`}>
                    {[0, 1, 2].map((i) => (
                      <BenchSlot
                        key={`npc-bench-${i}`}
                        battler={tcgOpponent?.bench[i] ?? null}
                        label={`Banca ${i + 1}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="opponent-active-slot" ref={npcActiveRef}>
                  {/* NPC Active Card rendered in 3D */}
                </div>

                <div className="combat-lane">
                  <div className={`attack-beam attack-beam--${attackFx?.attacker ?? 'player'} ${attackFx ? 'is-active' : ''}`} ref={beamRef} />
                  <div className={`damage-badge damage-badge--${attackFx?.attacker === 'player' ? 'top' : 'bottom'} ${attackFx ? 'is-active' : ''}`} ref={damageRef}>-{attackFx?.damage ?? 0}</div>
                </div>

                <div className={`player-deck-slot ${match.phase !== 'selecting-active' ? 'is-hidden' : ''}`}><ZonePile label="Deck" count={tcgPlayer?.deck.length} /></div>
                <div className={`player-discard-slot ${match.phase !== 'selecting-active' ? 'is-hidden' : ''}`}><ZonePile label="Descarte" count={tcgPlayer?.discard.length} /></div>

                {/* Player Bench — real Pokémon with selection */}
                <div className="player-bench-row">
                  <div className={`bench-row bench-row--player`}>
                    {[0, 1, 2].map((i) => (
                      <BenchSlot
                        key={`player-bench-${i}`}
                        battler={tcgPlayer?.bench[i] ?? null}
                        label={`Banca ${i + 1}`}
                        selectable={needsForceSwitch || pendingAction === 'select-trainer-target' || canRetreat || playerCanSwitchActive}
                        retreatCost={canRetreat ? tcgPlayer?.activeBattler?.card.retreatCost : undefined}
                        onClick={() => {
                          if (needsForceSwitch) {
                            forceSwitchAfterKO(i);
                          } else if (pendingAction === 'select-trainer-target' && pendingTrainerIndex !== null) {
                            playTrainer(pendingTrainerIndex, { target: 'bench', benchIndex: i });
                          } else if (canRetreat) {
                            switchActivePokemon(i);
                          } else if (playerCanSwitchActive) {
                            switchActivePokemon(i);
                          }
                        }}
                      />
                    ))}
                  </div>
                  {canRetreat && (
                    <div className="retreat-hint">
                      <span className="retreat-hint__text">↑ Toca para retirar a tu activo</span>
                    </div>
                  )}
                </div>

                <div className="player-active-slot" ref={playerSlotRef}>
                  <div className="active-wrapper" ref={playerActiveRef}>
                    {/* Player Active Card rendered in 3D */}
                  </div>
                </div>

                {/* Force switch prompt */}
                {needsForceSwitch && (
                  <div className="force-switch-prompt">
                    <h3>¡Tu Pokémon fue derrotado!</h3>
                    <p>Selecciona un Pokémon de la banca para continuar.</p>
                  </div>
                )}

                {/* Action bar */}
                <div className="action-bar">
                  <button
                    type="button"
                    className={`primary-action ${focusedArea === 'actions' && focusedActionIndex === 0 ? 'is-keyboard-focused' : ''}`}
                    onClick={() => assignPlayerEnergy()}
                    disabled={!playerCanAssignEnergy}
                  >
                    Asignar energía
                  </button>

                  <button
                    type="button"
                    className={`primary-action accent-action ${focusedArea === 'actions' && focusedActionIndex === 1 ? 'is-keyboard-focused' : ''}`}
                    onClick={() => {
                      if (activeAttacks.length > 1) {
                        setShowAttackSelector(true);
                      } else {
                        void playerAttack(0);
                      }
                    }}
                    disabled={false}
                  >
                    Atacar{activeAttacks.length > 1 ? ' ▾' : ''}
                  </button>

                  <button
                    type="button"
                    className={`secondary-action ${focusedArea === 'actions' && focusedActionIndex === 3 ? 'is-keyboard-focused' : ''}`}
                    onClick={() => {
                      if (playerCanBenchBasic) {
                        setPendingAction('select-bench');
                      }
                    }}
                    disabled={!playerCanBenchBasic}
                  >
                    Banca
                  </button>

                  <button
                    type="button"
                    className={`secondary-action ${focusedArea === 'actions' && focusedActionIndex === 2 ? 'is-keyboard-focused' : ''}`}
                    onClick={() => void passPlayerTurn()}
                    disabled={!playerCanPass}
                  >
                    Pasar turno
                  </button>
                </div>

                {/* Attack selector dropdown */}
                {showAttackSelector && tcgPlayer?.activeBattler && (
                  <div className="attack-selector">
                    <h3>Selecciona un ataque</h3>
                    {activeAttacks.map((atk, idx) => {
                      const costCheck = validateAttackCost(tcgPlayer.activeBattler!, atk.cost);
                      return (
                        <button
                          key={atk.name}
                          type="button"
                          className={`attack-option ${costCheck.valid ? '' : 'attack-option--disabled'}`}
                          disabled={!costCheck.valid}
                          onClick={() => handleAttackSelect(idx)}
                        >
                          <span className="attack-option__name">{atk.name}</span>
                          <span className="attack-option__damage">{atk.damage} dmg</span>
                          <span className="attack-option__cost">Costo: {atk.cost.join(', ') || 'Gratis'}</span>
                          {atk.effect && <span className="attack-option__effect">{atk.effect}</span>}
                        </button>
                      );
                    })}
                    <button type="button" className="secondary-action" onClick={() => setShowAttackSelector(false)}>
                      Cancelar
                    </button>
                  </div>
                )}

                {match.playerActive ? <div className="energy-sidecar"><span className="eyebrow">Energía</span><strong>{match.playerActive.energy}/{match.playerActive.attackCost}</strong></div> : null}
              </div>

              {/* Player hand — with trainer/evolution actions */}
              <div className={`player-hand-zone ${!playerNeedsToSelectActive && match.phase !== 'selecting-active' ? 'is-compact' : ''}`}>
                <div className="player-hand-zone__header">
                  <p className="eyebrow">Mano del jugador</p>
                  <span className="chip">{tcgPlayer?.hand.length ?? 0} cartas</span>
                </div>

                {/* Show hand cards when in setup/selecting or when expanded */}
                {tcgPlayer && (playerNeedsToSelectActive || match.phase === 'selecting-active') && (
                  <div className="hand-card-row">
                    {tcgPlayer.hand.map((card) => {
                      const isBasic = isPokemonCard(card) && isBasicPokemon(card);
                      const isPkmn = isPokemonCard(card);
                      const isTrainer = isTrainerCard(card);
                      const pokemonCard = isPkmn ? (card as PokemonCard) : null;

                      return (
                        <div
                          key={card.id}
                          className={`hand-card ${isBasic ? 'hand-card--playable' : 'hand-card--inactive'}`}
                          onClick={() => {
                            if (isBasic && playerNeedsToSelectActive) {
                              handleSelectPlayerActive(card.id);
                            }
                          }}
                          ref={(node) => { handCardMapRef.current[card.id] = node; }}
                        >
                          <img
                            src={pokemonCard?.imageLarge || pokemonCard?.imageSmall || (card as any).imageLarge || (card as any).imageSmall || ''}
                            alt={card.name}
                            loading="lazy"
                          />
                          <div className="hand-card__label">
                            <span>{card.name}</span>
                            {isPkmn && <span className="hand-card__stage">{pokemonCard?.stage}</span>}
                            {isTrainer && <span className="hand-card__type">Trainer</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* During battle: show compact hand with play options */}
                {tcgPlayer && match.phase === 'player-turn' && (
                  <div className="hand-card-row hand-card-row--battle">
                    {tcgPlayer.hand.map((card, idx) => {
                      const isPkmn = isPokemonCard(card);
                      const isTrainer = isTrainerCard(card);
                      const pokemonCard = isPkmn ? (card as PokemonCard) : null;
                      const trainerCard = isTrainer ? (card as TrainerCard) : null;

                      let actionLabel = '';
                      let canPlay = false;

                      if (isTrainer) {
                        actionLabel = trainerCard?.type === 'supporter' ? 'Supporter' : 'Item';
                        canPlay = trainerCard?.type === 'supporter' ? !tcgPlayer.hasUsedSupporter : true;
                      } else if (isPkmn && pokemonCard?.stage === 'basic') {
                        actionLabel = 'Banca';
                        canPlay = playerCanBenchBasic;
                      } else if (isPkmn && pokemonCard?.stage !== 'basic') {
                        actionLabel = `Evolución`;
                        canPlay = !tcgPlayer.hasEvolved;
                      }

                      return (
                        <div
                          key={card.id}
                          className={`hand-card hand-card--compact ${canPlay ? 'hand-card--playable' : ''}`}
                          onClick={() => {
                            if (isTrainer && canPlay) {
                              playTrainer(idx);
                            } else if (isPkmn && pokemonCard?.stage === 'basic' && canPlay) {
                              setPendingAction('select-bench');
                            } else if (isPkmn && pokemonCard?.stage !== 'basic' && canPlay) {
                              // Try to evolve the active Pokemon
                              evolve(idx, 'active');
                            }
                          }}
                        >
                          <img
                            src={pokemonCard?.imageSmall || (card as any).imageSmall || ''}
                            alt={card.name}
                            loading="lazy"
                          />
                          <div className="hand-card__label">
                            <span>{card.name}</span>
                            {actionLabel && <span className="hand-card__action">{actionLabel}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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
                  <p>Puntos: {tcgPlayer?.points ?? 0}/3</p>

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
                  </div>

                  <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                    {!isPvp && <button type="button" className="primary-action" onClick={() => { resetCurrentMatch(); startMatch(); }}>Nueva partida</button>}
                    <button type="button" className="secondary-action" onClick={() => { if (isPvp) disconnectPvp(); else resetCurrentMatch(); setView('menu'); }}>Menú Principal</button>
                  </div>
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>

      {/* Bench Selection overlay */}
      {pendingAction === 'select-bench' && tcgPlayer && (
        <BenchSelectionOverlay
          hand={tcgPlayer.hand as PokemonCard[]}
          maxSelectable={Math.max(0, 3 - (tcgPlayer.bench.length ?? 0))}
          onConfirm={(ids) => useBattleStore.getState().selectBenchPokemon(ids)}
        />
      )}

      {/* Confirm exit modal */}
      {showConfirmExit ? (
        <section className="confirm-overlay">
          <div className="confirm-overlay__backdrop" onClick={() => setShowConfirmExit(false)} />
          <div className="confirm-panel">
            <h2>⚠️ Confirmación</h2>
            <p>¿Estás seguro de que deseas terminar la prueba? Al confirmar, se descargará un archivo CSV con el reporte del log de navegación de esta sesión.</p>
            <div className="confirm-actions">
              <button
                type="button"
                className="primary-action danger-action"
                onClick={() => {
                  setShowConfirmExit(false);
                  handleDownloadLogsCSV();
                }}
                style={{ padding: '12px 24px' }}
              >
                Confirmar y Terminar
              </button>
              <button
                type="button"
                className="secondary-action"
                onClick={() => setShowConfirmExit(false)}
                style={{ padding: '12px 24px' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
