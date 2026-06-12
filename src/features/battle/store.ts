import { create } from 'zustand';
import type { DeckType, Difficulty } from './types';
import type { GameState as LegacyGameState } from './types';
import type { Card } from '../cards/types';
import type { GameState as TcgGameState, TcgCard, PokemonCard } from '../../tcg-engine/types';
import {
  drawCard,
  attachEnergy,
  attack,
  switchActive,
  endTurn,
  useTrainer,
  checkVictory,
  evolvePokemon,
  forceSwitchOnKO,
  isPokemonCard,
  isTrainerCard,
  generateEnergy,
  validateAttackCost,
  countEnergies,
} from '../../tcg-engine/engine';
import { createInitialState } from '../../tcg-engine/state';
import { isBasicPokemon, createBattler } from '../../tcg-engine/state';
import { tcgStateToLegacy } from './stateAdapter';
import { getDeckByType } from '../../data/defaultDecks';
import { toTcgCard } from '../cards/cardRepository';
import { parseCatalogCsv } from '../cards/cardRepository';
import { createNpcService, getNpcRuntimeConfig, type NpcService } from '../npc/npcService';
import { multiplayerService, type PvpMatchInfo } from '../multiplayer/multiplayerService';
import { getRequiredTargets } from '../../tcg-engine/trainerEffects';

type CatalogStatus = 'idle' | 'loading' | 'ready' | 'error';

export type BattleStoreState = {
  aesthetic: {
    name: string;
    why: string;
  };
  npcRuntime: {
    mode: 'mock' | 'http';
    endpoint: string;
  };
  catalogStatus: CatalogStatus;
  errorMessage: string | null;
  catalog: Card[];
  tcgCatalog: TcgCard[];
  // New TCG state
  tcgState: TcgGameState | null;
  playerId: string;
  opponentId: string;
  matchCounter: number;
  // Legacy state for ThreeArena compatibility
  match: LegacyGameState | null;
  selectedDeck: DeckType | null;
  selectedDifficulty: Difficulty | null;
  isPvp: boolean;
  pvpMatchInfo: PvpMatchInfo | null;
  pvpStatus: 'idle' | 'searching' | 'matched' | 'disconnected';
  playerName: string;
  isNpcThinking: boolean;
  // UI interaction state
  pendingAction: 'none' | 'select-attack' | 'select-trainer-target' | 'select-bench-replacement' | 'select-energy-target' | 'select-bench';
  pendingTrainerIndex: number | null;
  // Actions
  setCatalogLoading: () => void;
  setCatalogError: (message: string) => void;
  initializeCatalog: (cards: Card[], csvRows?: any[]) => void;
  setDeck: (deck: DeckType) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  startMatch: () => void;
  selectPlayerActive: (cardId: string) => void;
  selectBenchPokemon: (selectedCardIds: string[]) => void;
  drawPhase: () => void;
  assignPlayerEnergy: (target?: 'active' | 'bench', benchIndex?: number) => void;
  playerAttack: (attackIndex?: number) => Promise<void>;
  playTrainer: (cardIndex: number, targetInfo?: { target: 'active' | 'bench' | 'opponent-active' | 'opponent-bench'; benchIndex?: number }) => void;
  evolve: (handIndex: number, target: 'active' | 'bench', benchIndex?: number) => void;
  switchActivePokemon: (benchIndex: number) => void;
  forceSwitchAfterKO: (benchIndex: number) => void;
  passPlayerTurn: () => Promise<void>;
  resetCurrentMatch: () => void;
  setPendingAction: (action: BattleStoreState['pendingAction'], trainerIndex?: number) => void;
  setPlayerName: (name: string) => void;
  appendBattleLog: (entry: string) => void;
  triggerNpcTurnIfNeeded: () => Promise<void>;
  // PvP-specific actions
  startPvpMatch: () => void;
  startPvpSearch: () => void;
  cancelPvpSearch: () => void;
  disconnectPvp: () => void;
};

const aesthetic = {
  name: 'Portable console',
  why: 'combina HUD legible, contraste alto y una mesa sobria para que el loop offline se entienda en mobile y en grabación.',
};

function syncLegacyState(
  tcgState: TcgGameState | null,
  playerId: string,
  opponentId: string,
  catalog: Card[],
  matchCounter: number,
): LegacyGameState | null {
  if (!tcgState) return null;
  return tcgStateToLegacy(tcgState, playerId, opponentId, catalog, matchCounter);
}

/**
 * Simple NPC AI that uses the new tcg-engine.
 */
function tryAttachEnergy(state: TcgGameState, playerId: string): TcgGameState {
  const player = state.players[playerId];
  if (!player.hasAttachedEnergy && player.activeBattler) {
    const result = attachEnergy(state, playerId, 'active');
    if (result.success && result.state) return result.state;
  }
  return state;
}

function tryEvolveActive(state: TcgGameState, playerId: string): TcgGameState {
  const player = state.players[playerId];
  if (!player.hasEvolved && player.activeBattler) {
    for (let i = 0; i < player.hand.length; i++) {
      const card = player.hand[i];
      if (isPokemonCard(card) && (card as PokemonCard).stage !== 'basic') {
        const result = evolvePokemon(state, playerId, i, 'active');
        if (result.success && result.state) return result.state;
      }
    }
  }
  return state;
}

function tryPlayTrainer(state: TcgGameState, playerId: string): TcgGameState {
  const player = state.players[playerId];
  for (let i = 0; i < player.hand.length; i++) {
    const card = player.hand[i];
    if (isTrainerCard(card)) {
      const result = useTrainer(state, playerId, i);
      if (result.success && result.state) return result.state;
    }
  }
  return state;
}

function tryPutBasicsOnBench(state: TcgGameState, playerId: string): TcgGameState {
  const player = state.players[playerId];
  if (player.bench.length >= 3) return state;

  const basicsInHand = player.hand.filter(
    (c) => isPokemonCard(c) && (c as PokemonCard).stage === 'basic'
  ) as PokemonCard[];
  if (basicsInHand.length === 0) return state;

  const spaceAvailable = 3 - player.bench.length;
  const toBench = basicsInHand.slice(0, spaceAvailable);
  const benchCards = toBench.map((c) => createBattler(c, 'bench'));
  const finalHand = player.hand.filter(
    (c) => !toBench.some((bc) => bc.id === c.id)
  );

  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: { ...player, hand: finalHand, bench: [...player.bench, ...benchCards] },
    },
    log: [...state.log, `Rival puso ${toBench.map(c => c.name).join(', ')} en la banca.`],
  };
}

function tryAttack(state: TcgGameState, attackerId: string, strategy: 'first' | 'best'): TcgGameState {
  const player = state.players[attackerId];
  if (!player.activeBattler || state.turnNumber <= 1) return state;

  let bestAttackIndex = -1;
  let maxDamage = -1;

  for (let i = 0; i < player.activeBattler.card.attacks.length; i++) {
    const atkCost = player.activeBattler.card.attacks[i].cost;
    const costCheck = validateAttackCost(player.activeBattler, atkCost);
    if (costCheck.valid) {
      if (strategy === 'first') {
        const result = attack(state, attackerId, i);
        return (result.success && result.state) ? result.state : state;
      } else {
        const dmg = player.activeBattler.card.attacks[i].damage;
        if (dmg > maxDamage) {
          maxDamage = dmg;
          bestAttackIndex = i;
        }
      }
    }
  }

  if (strategy === 'best' && bestAttackIndex >= 0) {
    const result = attack(state, attackerId, bestAttackIndex);
    return (result.success && result.state) ? result.state : state;
  }

  return state;
}

function trySwitchActiveOnKO(state: TcgGameState, opponentId: string): TcgGameState {
  const opponent = state.players[opponentId];
  if (!opponent.activeBattler && opponent.bench.length > 0) {
    const result = forceSwitchOnKO(state, opponentId, 0);
    if (result.success && result.state) return result.state;
  }
  return state;
}

async function resolveNpcTurn(
  tcgState: TcgGameState,
  opponentId: string,
  playerId: string,
  setState: (recipe: (state: BattleStoreState) => BattleStoreState | Partial<BattleStoreState>) => void,
  getState: () => BattleStoreState,
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 800));
  setState(() => ({ isNpcThinking: true }));

  let state = tcgState;
  try {
    const npc = state.players[opponentId];
    if (!npc || state.currentTurn !== opponentId) throw new Error('Invalid turn state');

    if (state.turnNumber > 1) {
      state = drawCard(state, opponentId);
    }
    state = { ...state, turnPhase: 'main' };

    const difficulty = getState().selectedDifficulty || 'Normal';

    if (difficulty === 'Fácil') {
      state = tryAttachEnergy(state, opponentId);
      state = tryAttack(state, opponentId, 'first');
    } else if (difficulty === 'Normal') {
      state = tryAttachEnergy(state, opponentId);
      state = tryEvolveActive(state, opponentId);
      state = tryPlayTrainer(state, opponentId);
      state = tryPutBasicsOnBench(state, opponentId);
      state = tryAttack(state, opponentId, 'first');
    } else {
      state = tryAttachEnergy(state, opponentId);
      state = tryPutBasicsOnBench(state, opponentId);
      state = tryEvolveActive(state, opponentId);
      state = tryPlayTrainer(state, opponentId);
      state = tryAttack(state, opponentId, 'best');
    }

    state = trySwitchActiveOnKO(state, opponentId);

    const winner = checkVictory(state);
    if (winner) {
      state = { ...state, winner, gamePhase: 'ended' };
      const { catalog, matchCounter } = getState();
      setState(() => ({
        tcgState: state,
        match: syncLegacyState(state, playerId, opponentId, catalog, matchCounter),
        isNpcThinking: false,
      }));
      return;
    }

    state = endTurn(state);

  } catch (error) {
    console.error('[NPC] Error in resolveNpcTurn:', error);
    state = endTurn(tcgState);
  }

  const { catalog, matchCounter } = getState();
  setState(() => ({
    tcgState: state,
    match: syncLegacyState(state, playerId, opponentId, catalog, matchCounter),
    isNpcThinking: false,
  }));
}

const npcRuntime = getNpcRuntimeConfig();

export function createBattleStore(npcService: NpcService = createNpcService()) {
  return create<BattleStoreState>((set, get) => ({
    aesthetic,
    npcRuntime: {
      mode: npcRuntime.mode,
      endpoint: npcRuntime.endpoint,
    },
    catalogStatus: 'idle',
    errorMessage: null,
    catalog: [],
    tcgCatalog: [],
    tcgState: null,
    playerId: 'player',
    opponentId: 'npc',
    matchCounter: 0,
    match: null,
    selectedDeck: null,
    selectedDifficulty: null,
    isPvp: false,
    pvpMatchInfo: null,
    pvpStatus: 'idle',
    playerName: 'Jugador',
    isNpcThinking: false,
    pendingAction: 'none',
    pendingTrainerIndex: null,

    setCatalogLoading: () => set(() => ({ catalogStatus: 'loading', errorMessage: null })),
    setCatalogError: (message) => set(() => ({ catalogStatus: 'error', errorMessage: message })),
    initializeCatalog: (cards, csvRows) =>
      set(() => {
        // Also convert to TcgCard[] if csvRows provided
        const tcgCards = csvRows ? toTcgCard(csvRows) : [];
        return {
          catalogStatus: 'ready',
          errorMessage: null,
          catalog: cards,
          tcgCatalog: tcgCards,
        };
      }),
    setDeck: (deck) => set(() => ({ selectedDeck: deck })),
    setDifficulty: (difficulty) => set(() => ({ selectedDifficulty: difficulty })),

    startMatch: () =>
      set((state) => {
        const deckType = state.selectedDeck || 'Fuego';
        const playerDeck = getDeckByType(deckType, state.tcgCatalog);
        // NPC gets a random different deck type
        const allTypes: DeckType[] = ['Fuego', 'Agua', 'Planta', 'Lucha', 'Psíquico', 'Incoloro', 'Rayo'];
        const npcTypes = allTypes.filter((t) => t !== deckType);
        const npcDeckType = npcTypes[Math.floor(Math.random() * npcTypes.length)];
        const npcDeck = getDeckByType(npcDeckType, state.tcgCatalog);

        const playerId = 'player';
        const opponentId = 'npc';
        const newMatchCounter = state.matchCounter + 1;

        const tcgState = createInitialState(playerDeck, npcDeck, playerId, opponentId);

        // NPC auto-selects active Pokemon
        const npcPlayer = tcgState.players[opponentId];
        const npcBasics = npcPlayer.hand.filter(
          (c) => isPokemonCard(c) && isBasicPokemon(c),
        );

        let updatedTcgState = tcgState;

        if (npcBasics.length > 0) {
          const npcActiveCard = npcBasics[0] as PokemonCard;
          const npcBattler = createBattler(npcActiveCard, 'active');
          const remainingHand = npcPlayer.hand.filter((c) => c.id !== npcActiveCard.id);

          // Put remaining basics on bench (max 3)
          const npcBenchCards = remainingHand
            .filter((c) => isPokemonCard(c) && isBasicPokemon(c))
            .slice(0, 3) as PokemonCard[];
          const npcBench = npcBenchCards.map((c) => createBattler(c, 'bench'));
          const npcFinalHand = remainingHand.filter(
            (c) => !npcBenchCards.some((bc) => bc.id === c.id),
          );

          updatedTcgState = {
            ...tcgState,
            players: {
              ...tcgState.players,
              [opponentId]: {
                ...npcPlayer,
                hand: npcFinalHand,
                activeBattler: npcBattler,
                bench: npcBench,
              },
            },
            log: [
              ...tcgState.log,
              `Rival activó a ${npcActiveCard.name}.`,
              ...(npcBenchCards.length > 0
                ? [`Rival puso ${npcBenchCards.map((c) => c.name).join(', ')} en la banca.`]
                : []),
            ],
          };
        }

        return {
          isPvp: false,
          tcgState: updatedTcgState,
          playerId,
          opponentId,
          matchCounter: newMatchCounter,
          match: syncLegacyState(updatedTcgState, playerId, opponentId, state.catalog, newMatchCounter),
          pendingAction: 'none',
        };
      }),

    selectPlayerActive: (cardId) =>
      set((state) => {
        if (!state.tcgState || state.isNpcThinking) return {};
        if (state.tcgState.gamePhase !== 'setup') return {}; // Bug #12: guard phase
        const player = state.tcgState.players[state.playerId];
        const card = player.hand.find((c) => c.id === cardId);
        if (!card || !isPokemonCard(card)) return {};

        const pokemonCard = card as PokemonCard;
        if (pokemonCard.stage !== 'basic') return {};

        const battler = createBattler(pokemonCard, 'active');
        const remainingHand = player.hand.filter((c) => c.id !== cardId);

        // BUG #3: Removed auto-benching here.
        // Instead, prompt user to select bench if they have basics in hand.
        const remainingBasics = remainingHand.filter((c) => isPokemonCard(c) && isBasicPokemon(c));

        // In PvP: we don't transition to battle until bench is selected.
        // If there are no basics to put on bench, we can transition if opponent has active.
        let nextGamePhase = state.tcgState.gamePhase;
        let nextPendingAction: BattleStoreState['pendingAction'] = 'none';

        if (remainingBasics.length > 0) {
          nextPendingAction = 'select-bench';
        } else {
          // No basics, transition to battle if not PvP or if opponent is ready
          const opponentHasActive = Boolean(state.tcgState.players[state.opponentId]?.activeBattler);
          // Wait for opponent's bench selection in PvP before going to battle
          nextGamePhase = 'setup';
          if (!state.isPvp) {
            nextGamePhase = 'battle';
          }
        }

        const updatedTcgState: TcgGameState = {
          ...state.tcgState,
          players: {
            ...state.tcgState.players,
            [state.playerId]: {
              ...player,
              hand: remainingHand,
              activeBattler: battler,
            },
          },
          gamePhase: nextGamePhase,
          log: [
            ...state.tcgState.log,
            `Elegiste a ${pokemonCard.name} como Pokémon activo.`,
          ],
        };

        // Emit to opponent in PvP
        if (state.isPvp) {
          multiplayerService.emitSelectActive(cardId, pokemonCard);
          if (remainingBasics.length === 0) {
            setTimeout(() => multiplayerService.emitSelectBench([], []), 0);
          }
        }

        return {
          tcgState: updatedTcgState,
          match: syncLegacyState(updatedTcgState, state.playerId, state.opponentId, state.catalog, state.matchCounter),
          pendingAction: nextPendingAction,
        };
      }),

    selectBenchPokemon: (selectedCardIds) =>
      set((state) => {
        if (!state.tcgState || state.isNpcThinking) return {};
        if (state.pendingAction !== 'select-bench') return {};
        
        const player = state.tcgState.players[state.playerId];
        const spaceAvailable = Math.max(0, 3 - player.bench.length);
        if (spaceAvailable === 0) {
          const updatedTcgState = {
            ...state.tcgState,
            log: [...state.tcgState.log, 'No hay espacio disponible en la banca.'],
          };

          return {
            tcgState: updatedTcgState,
            match: syncLegacyState(updatedTcgState, state.playerId, state.opponentId, state.catalog, state.matchCounter),
            pendingAction: 'none',
          };
        }

        const selectedCards = player.hand.filter((c) => selectedCardIds.includes(c.id)) as PokemonCard[];
        const selectedForBench = selectedCards.slice(0, spaceAvailable);
        const selectedForBenchIds = selectedForBench.map((c) => c.id);
        
        const bench = selectedForBench.map((c) => createBattler(c, 'bench'));
        const finalHand = player.hand.filter((c) => !selectedForBenchIds.includes(c.id));

        const opponentHasActive = Boolean(state.tcgState.players[state.opponentId]?.activeBattler);
        const nextGamePhase = state.isPvp
          ? (opponentHasActive ? 'battle' : 'setup')
          : 'battle';

        const updatedTcgState: TcgGameState = {
          ...state.tcgState,
          players: {
            ...state.tcgState.players,
            [state.playerId]: {
              ...player,
              hand: finalHand,
              bench: [...player.bench, ...bench],
            },
          },
          gamePhase: nextGamePhase,
          log: [
            ...state.tcgState.log,
            ...(bench.length > 0
              ? [`${bench.map((c) => c.name).join(', ')} fueron a la banca.`]
              : ['Elegiste no poner cartas en la banca.']),
          ],
        };

        if (state.isPvp) {
          multiplayerService.emitSelectBench(selectedForBenchIds, selectedForBench);
        }

        return {
          tcgState: updatedTcgState,
          match: syncLegacyState(updatedTcgState, state.playerId, state.opponentId, state.catalog, state.matchCounter),
          pendingAction: 'none',
        };
      }),

    drawPhase: () =>
      set((state) => {
        if (!state.tcgState || state.isNpcThinking) return {};
        let tcgState = drawCard(state.tcgState, state.playerId);
        tcgState = { ...tcgState, turnPhase: 'main' };

        if (state.isPvp) {
          multiplayerService.emitDrawPhase();
        }

        return {
          tcgState,
          match: syncLegacyState(tcgState, state.playerId, state.opponentId, state.catalog, state.matchCounter),
        };
      }),

    assignPlayerEnergy: (target = 'active', benchIndex) =>
      set((state) => {
        if (!state.tcgState || state.isNpcThinking) return {};
        const result = attachEnergy(state.tcgState, state.playerId, target, benchIndex);
        if (!result.success || !result.state) return {};

        // Emit to opponent in PvP
        if (state.isPvp) {
          multiplayerService.emitAssignEnergy(target, benchIndex);
        }

        return {
          tcgState: result.state,
          match: syncLegacyState(result.state, state.playerId, state.opponentId, state.catalog, state.matchCounter),
        };
      }),

    playerAttack: async (attackIndex = 0) => {
      const state = get();
      if (!state.tcgState || state.isNpcThinking) return;

      const result = attack(state.tcgState, state.playerId, attackIndex);
      if (!result.success || !result.state) return;

      let tcgState = result.state;

      // Emit to opponent in PvP
      if (state.isPvp) {
        multiplayerService.emitAttack(attackIndex);
      }

      // Check if opponent needs to force switch after KO (NPC only)
      if (!state.isPvp) {
        const opponent = tcgState.players[state.opponentId];
        if (!opponent.activeBattler && opponent.bench.length > 0) {
          // NPC auto-selects first bench Pokemon
          const switchResult = forceSwitchOnKO(tcgState, state.opponentId, 0);
          if (switchResult.success && switchResult.state) {
            tcgState = switchResult.state;
          }
        }
      }

      // Check victory
      const winner = checkVictory(tcgState);
      if (winner) {
        tcgState = {
          ...tcgState,
          winner,
          gamePhase: 'ended',
        };
      }

      // Check if opponent needs to force switch after KO
      const opponent = tcgState.players[state.opponentId];
      const needsForceSwitch = !opponent.activeBattler && opponent.bench.length > 0;

      // End turn
      if (!tcgState.winner && !needsForceSwitch) {
        tcgState = endTurn(tcgState);
      }

      set(() => ({
        tcgState,
        match: syncLegacyState(tcgState, state.playerId, state.opponentId, state.catalog, state.matchCounter),
        pendingAction: 'none',
      }));

      // NPC turn (skip in PvP — opponent plays on their own client)
      if (!state.isPvp && !tcgState.winner && tcgState.currentTurn === state.opponentId) {
        await resolveNpcTurn(tcgState, state.opponentId, state.playerId, set, get);
      }
    },

    playTrainer: (cardIndex, targetInfo) =>
      set((state) => {
        if (!state.tcgState || state.isNpcThinking) return {};

        // Check if this trainer needs targets and none provided
        const player = state.tcgState.players[state.playerId];
        const card = player.hand[cardIndex];
        if (!card || !isTrainerCard(card)) return {};

        const targets = getRequiredTargets(card.name);
        if (targets && !targetInfo) {
          // Need to show target selection UI
          return {
            pendingAction: 'select-trainer-target',
            pendingTrainerIndex: cardIndex,
          };
        }

        const result = useTrainer(state.tcgState, state.playerId, cardIndex, targetInfo);
        if (!result.success || !result.state) return {};

        // Emit to opponent in PvP
        if (state.isPvp) {
          multiplayerService.emitPlayTrainer(cardIndex, targetInfo);
        }

        return {
          tcgState: result.state,
          match: syncLegacyState(result.state, state.playerId, state.opponentId, state.catalog, state.matchCounter),
          pendingAction: 'none',
          pendingTrainerIndex: null,
        };
      }),

    evolve: (handIndex, target, benchIndex) =>
      set((state) => {
        if (!state.tcgState || state.isNpcThinking) return {};
        const result = evolvePokemon(state.tcgState, state.playerId, handIndex, target, benchIndex);
        if (!result.success || !result.state) return {};

        // Emit to opponent in PvP
        if (state.isPvp) {
          multiplayerService.emitEvolve(handIndex, target, benchIndex);
        }

        return {
          tcgState: result.state,
          match: syncLegacyState(result.state, state.playerId, state.opponentId, state.catalog, state.matchCounter),
        };
      }),

    switchActivePokemon: (benchIndex) =>
      set((state) => {
        if (!state.tcgState || state.isNpcThinking) return {};
        const result = switchActive(state.tcgState, state.playerId, benchIndex);
        if (!result.success || !result.state) {
          const message = `No se pudo cambiar el PokÃ©mon activo: ${result.error || 'accÃ³n invÃ¡lida'}.`;
          const updatedTcgState = {
            ...state.tcgState,
            log: [...state.tcgState.log, message],
          };

          return {
            tcgState: updatedTcgState,
            match: syncLegacyState(updatedTcgState, state.playerId, state.opponentId, state.catalog, state.matchCounter),
          };
        }

        // Emit to opponent in PvP
        if (state.isPvp) {
          multiplayerService.emitSwitchActive(benchIndex);
        }

        const switchedName = result.state.players[state.playerId].activeBattler?.card.name || 'Pokemon';
        const updatedTcgState = {
          ...result.state,
          log: [...result.state.log, `Cambiaste a ${switchedName} como Pokemon activo.`],
        };

        return {
          tcgState: updatedTcgState,
          match: syncLegacyState(updatedTcgState, state.playerId, state.opponentId, state.catalog, state.matchCounter),
        };
      }),

    forceSwitchAfterKO: (benchIndex) =>
      set((state) => {
        if (!state.tcgState || state.isNpcThinking) return {};
        const result = forceSwitchOnKO(state.tcgState, state.playerId, benchIndex);
        if (!result.success || !result.state) return {};

        let tcgState = result.state;

        // Emit to opponent in PvP
        if (state.isPvp) {
          multiplayerService.emitForceSwitch(benchIndex);
        }

        if (tcgState.turnPhase === 'end') {
          tcgState = endTurn(tcgState);
        }

        return {
          tcgState,
          match: syncLegacyState(tcgState, state.playerId, state.opponentId, state.catalog, state.matchCounter),
          pendingAction: 'none',
        };
      }),

    passPlayerTurn: async () => {
      const state = get();
      if (!state.tcgState || state.isNpcThinking) return;

      // Emit to opponent in PvP
      if (state.isPvp) {
        multiplayerService.emitPassTurn();
      }

      let tcgState = endTurn(state.tcgState);

      set(() => ({
        tcgState,
        match: syncLegacyState(tcgState, state.playerId, state.opponentId, state.catalog, state.matchCounter),
      }));

      // NPC turn (skip in PvP — opponent plays on their own client)
      if (!state.isPvp && tcgState.currentTurn === state.opponentId) {
        await resolveNpcTurn(tcgState, state.opponentId, state.playerId, set, get);
      }
    },

    resetCurrentMatch: () =>
      set((state) => ({
        tcgState: null,
        match: null,
        matchCounter: state.matchCounter + 1,
        pendingAction: 'none',
        pendingTrainerIndex: null,
      })),

    setPendingAction: (action, trainerIndex) =>
      set(() => ({
        pendingAction: action,
        pendingTrainerIndex: trainerIndex ?? null,
      })),

    setPlayerName: (name) => set(() => ({ playerName: name })),

    appendBattleLog: (entry) =>
      set((state) => {
        if (!state.tcgState) return {};

        const updatedTcgState = {
          ...state.tcgState,
          log: [...state.tcgState.log, entry],
        };

        return {
          tcgState: updatedTcgState,
          match: syncLegacyState(updatedTcgState, state.playerId, state.opponentId, state.catalog, state.matchCounter),
        };
      }),

    // Bug #1: Trigger NPC turn when it has the initial turn
    triggerNpcTurnIfNeeded: async () => {
      const state = get();
      if (!state.tcgState) return;
      if (state.isPvp) return;
      if (state.tcgState.gamePhase !== 'battle') return;
      if (state.tcgState.currentTurn !== state.opponentId) return;
      if (state.isNpcThinking) return;

      await resolveNpcTurn(
        state.tcgState,
        state.opponentId,
        state.playerId,
        set,
        get,
      );
    },

    // --- PvP-specific actions ---

    startPvpMatch: () =>
      set((state) => {
        const deckType = state.selectedDeck || 'Fuego';
        const playerDeck = getDeckByType(deckType, state.tcgCatalog);
        // In PvP both players build their own decks locally
        // The opponent's deck is also generated locally (same catalog, random different type)
        const allTypes: DeckType[] = ['Fuego', 'Agua', 'Planta', 'Lucha', 'Psíquico', 'Incoloro', 'Rayo'];
        const opponentTypes = allTypes.filter((t) => t !== deckType);
        const opponentDeckType = opponentTypes[Math.floor(Math.random() * opponentTypes.length)];
        const opponentDeck = getDeckByType(opponentDeckType, state.tcgCatalog);

        const pvpPlayerId = 'player';
        const pvpOpponentId = 'opponent';
        const newMatchCounter = state.matchCounter + 1;
        
        const serverDice = state.pvpMatchInfo?.diceRoll;
        const pvpRole = state.pvpMatchInfo?.role;

        const tcgState = createInitialState(playerDeck, opponentDeck, pvpPlayerId, pvpOpponentId, serverDice, pvpRole);

        // In PvP: do NOT auto-select active for opponent (they select on their client)
        return {
          isPvp: true,
          tcgState,
          playerId: pvpPlayerId,
          opponentId: pvpOpponentId,
          matchCounter: newMatchCounter,
          match: syncLegacyState(tcgState, pvpPlayerId, pvpOpponentId, state.catalog, newMatchCounter),
          pendingAction: 'none',
        };
      }),

    startPvpSearch: () => {
      const currentStatus = get().pvpStatus;
      if (currentStatus === 'searching' || currentStatus === 'matched') {
        return;
      }

      set(() => ({ pvpStatus: 'searching' }));

      multiplayerService.connect({
        onWaiting: () => {
          set(() => ({ pvpStatus: 'searching' }));
        },
        onMatched: (info: PvpMatchInfo) => {
          set(() => ({
            pvpStatus: 'matched',
            pvpMatchInfo: info,
          }));
        },
        onOpponentSelectActive: (data) => {
          // The opponent selected their active card — update opponent slot
          const state = get();
          if (!state.tcgState) return;

          const opponentCard = data.card as PokemonCard;
          const opponentBattler = createBattler(opponentCard, 'active');
          const opponentPlayer = state.tcgState.players[state.opponentId];

          const remainingHand = opponentPlayer.hand.filter((c) => c.id !== opponentCard.id);

          const updatedTcgState: TcgGameState = {
            ...state.tcgState,
            players: {
              ...state.tcgState.players,
              [state.opponentId]: {
                ...opponentPlayer,
                hand: remainingHand,
                activeBattler: opponentBattler,
              },
            },
            log: [
              ...state.tcgState.log,
              `${state.pvpMatchInfo?.opponentName || 'Rival'} activó a ${opponentCard.name}.`,
            ],
          };

          set(() => ({
            tcgState: updatedTcgState,
            match: syncLegacyState(updatedTcgState, state.playerId, state.opponentId, state.catalog, state.matchCounter),
          }));
        },
        onOpponentSelectBench: (data) => {
          const state = get();
          if (!state.tcgState) return;

          const opponentCards = data.cards as PokemonCard[];
          const opponentPlayer = state.tcgState.players[state.opponentId];

          const bench = opponentCards.map((c) => createBattler(c, 'bench'));
          const finalHand = opponentPlayer.hand.filter((c) => !data.cardIds.includes(c.id));

          // Both players have selected their bench, transition to battle
          const ourActive = Boolean(state.tcgState.players[state.playerId]?.activeBattler);
          const nextGamePhase = ourActive && state.pendingAction !== 'select-bench' ? 'battle' : 'setup';

          const updatedTcgState: TcgGameState = {
            ...state.tcgState,
            players: {
              ...state.tcgState.players,
              [state.opponentId]: {
                ...opponentPlayer,
                hand: finalHand,
                bench,
              },
            },
            gamePhase: nextGamePhase,
            log: [
              ...state.tcgState.log,
              ...(bench.length > 0
                ? [`Rival puso ${bench.map((c) => c.name).join(', ')} en la banca.`]
                : []),
            ],
          };

          set(() => ({
            tcgState: updatedTcgState,
            match: syncLegacyState(updatedTcgState, state.playerId, state.opponentId, state.catalog, state.matchCounter),
          }));
        },
        onOpponentAssignEnergy: (data) => {
          const state = get();
          if (!state.tcgState) return;

          const result = attachEnergy(state.tcgState, state.opponentId, data.target || 'active', data.benchIndex);
          if (!result.success || !result.state) return;

          set(() => ({
            tcgState: result.state!,
            match: syncLegacyState(result.state!, state.playerId, state.opponentId, state.catalog, state.matchCounter),
          }));
        },
        onOpponentAttack: (data) => {
          const state = get();
          if (!state.tcgState) return;

          const result = attack(state.tcgState, state.opponentId, data.attackIndex ?? 0);
          if (!result.success || !result.state) return;

          let tcgState = result.state;

          // Check victory
          const winner = checkVictory(tcgState);
          if (winner) {
            tcgState = {
              ...tcgState,
              winner,
              gamePhase: 'ended',
            };
          }

          // End turn if no KO that requires our force-switch
          const myPlayer = tcgState.players[state.playerId];
          const needsForceSwitch = !myPlayer.activeBattler && myPlayer.bench.length > 0;

          if (!tcgState.winner && !needsForceSwitch) {
            tcgState = endTurn(tcgState);
          }

          set(() => ({
            tcgState,
            match: syncLegacyState(tcgState, state.playerId, state.opponentId, state.catalog, state.matchCounter),
            pendingAction: needsForceSwitch ? 'select-bench-replacement' : 'none',
          }));
        },
        onOpponentPassTurn: () => {
          const state = get();
          if (!state.tcgState) return;

          let tcgState = endTurn(state.tcgState);

          set(() => ({
            tcgState,
            match: syncLegacyState(tcgState, state.playerId, state.opponentId, state.catalog, state.matchCounter),
          }));
        },
        onOpponentDrawPhase: () => {
          const state = get();
          if (!state.tcgState) return;

          let tcgState = drawCard(state.tcgState, state.opponentId);
          tcgState = { ...tcgState, turnPhase: 'main' };

          set(() => ({
            tcgState,
            match: syncLegacyState(tcgState, state.playerId, state.opponentId, state.catalog, state.matchCounter),
          }));
        },
        onOpponentPlayTrainer: (data) => {
          const state = get();
          if (!state.tcgState) return;

          const result = useTrainer(state.tcgState, state.opponentId, data.cardIndex, data.targetInfo);
          if (!result.success || !result.state) return;

          set(() => ({
            tcgState: result.state!,
            match: syncLegacyState(result.state!, state.playerId, state.opponentId, state.catalog, state.matchCounter),
          }));
        },
        onOpponentEvolve: (data) => {
          const state = get();
          if (!state.tcgState) return;

          const result = evolvePokemon(state.tcgState, state.opponentId, data.handIndex, data.target, data.benchIndex);
          if (!result.success || !result.state) return;

          set(() => ({
            tcgState: result.state!,
            match: syncLegacyState(result.state!, state.playerId, state.opponentId, state.catalog, state.matchCounter),
          }));
        },
        onOpponentSwitchActive: (data) => {
          const state = get();
          if (!state.tcgState) return;

          const result = switchActive(state.tcgState, state.opponentId, data.benchIndex);
          if (!result.success || !result.state) return;

          set(() => ({
            tcgState: result.state!,
            match: syncLegacyState(result.state!, state.playerId, state.opponentId, state.catalog, state.matchCounter),
          }));
        },
        onOpponentForceSwitch: (data) => {
          const state = get();
          if (!state.tcgState) return;

          const result = forceSwitchOnKO(state.tcgState, state.opponentId, data.benchIndex);
          if (!result.success || !result.state) return;

          let tcgState = result.state;

          if (tcgState.turnPhase === 'end') {
            tcgState = endTurn(tcgState);
          }

          set(() => ({
            tcgState,
            match: syncLegacyState(tcgState, state.playerId, state.opponentId, state.catalog, state.matchCounter),
          }));
        },
        onOpponentDisconnected: () => {
          const state = get();
          if (!state.tcgState) return;

          const updatedTcgState: TcgGameState = {
            ...state.tcgState,
            winner: state.playerId,
            gamePhase: 'ended',
            log: [...state.tcgState.log, 'El oponente se ha desconectado. ¡Victoria!'],
          };

          set(() => ({
            pvpStatus: 'disconnected',
            tcgState: updatedTcgState,
            match: syncLegacyState(updatedTcgState, state.playerId, state.opponentId, state.catalog, state.matchCounter),
          }));
        },
      });

      multiplayerService.joinQueue(get().playerName);
    },

    cancelPvpSearch: () => {
      multiplayerService.cancelQueue();
      multiplayerService.disconnect();
      set(() => ({
        pvpStatus: 'idle',
        pvpMatchInfo: null,
        isPvp: false,
      }));
    },

    disconnectPvp: () => {
      multiplayerService.disconnect();
      set(() => ({
        pvpStatus: 'idle',
        pvpMatchInfo: null,
        isPvp: false,
        match: null,
        tcgState: null,
      }));
    },
  }));
}

export const useBattleStore = createBattleStore();
