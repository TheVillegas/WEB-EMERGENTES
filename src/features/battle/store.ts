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
  // UI interaction state
  pendingAction: 'none' | 'select-attack' | 'select-trainer-target' | 'select-bench-replacement' | 'select-energy-target';
  pendingTrainerIndex: number | null;
  // Actions
  setCatalogLoading: () => void;
  setCatalogError: (message: string) => void;
  initializeCatalog: (cards: Card[], csvRows?: any[]) => void;
  setDeck: (deck: DeckType) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  startMatch: () => void;
  selectPlayerActive: (cardId: string) => void;
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
  // PvP-specific actions
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
async function resolveNpcTurn(
  tcgState: TcgGameState,
  opponentId: string,
  playerId: string,
  setState: (recipe: (state: BattleStoreState) => BattleStoreState | Partial<BattleStoreState>) => void,
  getState: () => BattleStoreState,
): Promise<void> {
  // Small delay for UX
  await new Promise((resolve) => setTimeout(resolve, 800));

  let state = tcgState;
  const npc = state.players[opponentId];

  if (!npc || state.currentTurn !== opponentId) return;

  // 1. Draw phase
  if (state.turnNumber > 1) {
    state = drawCard(state, opponentId);
    state = { ...state, turnPhase: 'main' };
  } else {
    state = { ...state, turnPhase: 'main' };
  }

  // 2. Try to attach energy to active
  if (!npc.hasAttachedEnergy && npc.activeBattler) {
    const result = attachEnergy(state, opponentId, 'active');
    if (result.success && result.state) {
      state = result.state;
    }
  }

  // 3. Try to evolve if possible
  const npcPlayer = state.players[opponentId];
  if (!npcPlayer.hasEvolved && npcPlayer.activeBattler) {
    for (let i = 0; i < npcPlayer.hand.length; i++) {
      const card = npcPlayer.hand[i];
      if (isPokemonCard(card) && (card as PokemonCard).stage !== 'basic') {
        const result = evolvePokemon(state, opponentId, i, 'active');
        if (result.success && result.state) {
          state = result.state;
          break;
        }
      }
    }
  }

  // 4. Try to play a trainer
  const npcAfterEvolve = state.players[opponentId];
  for (let i = 0; i < npcAfterEvolve.hand.length; i++) {
    const card = npcAfterEvolve.hand[i];
    if (isTrainerCard(card)) {
      const result = useTrainer(state, opponentId, i);
      if (result.success && result.state) {
        state = result.state;
        break;
      }
    }
  }

  // 5. Try to attack
  const npcFinal = state.players[opponentId];
  if (npcFinal.activeBattler && state.turnNumber > 1) {
    // Try each attack
    for (let i = 0; i < npcFinal.activeBattler.card.attacks.length; i++) {
      const atkCost = npcFinal.activeBattler.card.attacks[i].cost;
      const costCheck = validateAttackCost(npcFinal.activeBattler, atkCost);
      if (costCheck.valid) {
        const result = attack(state, opponentId, i);
        if (result.success && result.state) {
          state = result.state;

          // Check if player's active was KO'd — auto-switch to first bench
          const playerAfterAttack = state.players[playerId];
          if (!playerAfterAttack.activeBattler && playerAfterAttack.bench.length > 0) {
            // Auto-select first bench for NPC opponent (player would choose via UI)
            // But since this is NPC flow, we leave it for the UI to handle
          }

          break;
        }
      }
    }
  }

  // 6. End turn
  state = endTurn(state);

  // Generate energy for next player
  const { catalog, matchCounter } = getState();
  setState(() => ({
    tcgState: state,
    match: syncLegacyState(state, playerId, opponentId, catalog, matchCounter),
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
        if (!state.tcgState) return {};
        const player = state.tcgState.players[state.playerId];
        const card = player.hand.find((c) => c.id === cardId);
        if (!card || !isPokemonCard(card)) return {};

        const pokemonCard = card as PokemonCard;
        if (pokemonCard.stage !== 'basic') return {};

        const battler = createBattler(pokemonCard, 'active');
        const remainingHand = player.hand.filter((c) => c.id !== cardId);

        // Put remaining basics on bench (max 3)
        const benchCards = remainingHand
          .filter((c) => isPokemonCard(c) && isBasicPokemon(c))
          .slice(0, 3) as PokemonCard[];
        const bench = benchCards.map((c) => createBattler(c, 'bench'));
        const finalHand = remainingHand.filter(
          (c) => !benchCards.some((bc) => bc.id === c.id),
        );

        const updatedTcgState: TcgGameState = {
          ...state.tcgState,
          players: {
            ...state.tcgState.players,
            [state.playerId]: {
              ...player,
              hand: finalHand,
              activeBattler: battler,
              bench,
            },
          },
          gamePhase: 'battle',
          log: [
            ...state.tcgState.log,
            `Elegiste a ${pokemonCard.name} como Pokémon activo.`,
            ...(benchCards.length > 0
              ? [`${benchCards.map((c) => c.name).join(', ')} fueron a la banca.`]
              : []),
          ],
        };

        return {
          tcgState: updatedTcgState,
          match: syncLegacyState(updatedTcgState, state.playerId, state.opponentId, state.catalog, state.matchCounter),
        };
      }),

    drawPhase: () =>
      set((state) => {
        if (!state.tcgState) return {};
        let tcgState = drawCard(state.tcgState, state.playerId);
        tcgState = { ...tcgState, turnPhase: 'main' };

        return {
          tcgState,
          match: syncLegacyState(tcgState, state.playerId, state.opponentId, state.catalog, state.matchCounter),
        };
      }),

    assignPlayerEnergy: (target = 'active', benchIndex) =>
      set((state) => {
        if (!state.tcgState) return {};
        const result = attachEnergy(state.tcgState, state.playerId, target, benchIndex);
        if (!result.success || !result.state) return {};

        return {
          tcgState: result.state,
          match: syncLegacyState(result.state, state.playerId, state.opponentId, state.catalog, state.matchCounter),
        };
      }),

    playerAttack: async (attackIndex = 0) => {
      const state = get();
      if (!state.tcgState) return;

      const result = attack(state.tcgState, state.playerId, attackIndex);
      if (!result.success || !result.state) return;

      let tcgState = result.state;

      // Check if opponent needs to force switch after KO
      const opponent = tcgState.players[state.opponentId];
      if (!opponent.activeBattler && opponent.bench.length > 0) {
        // NPC auto-selects first bench Pokemon
        const switchResult = forceSwitchOnKO(tcgState, state.opponentId, 0);
        if (switchResult.success && switchResult.state) {
          tcgState = switchResult.state;
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

      // End turn
      if (!tcgState.winner) {
        tcgState = endTurn(tcgState);
      }

      set(() => ({
        tcgState,
        match: syncLegacyState(tcgState, state.playerId, state.opponentId, state.catalog, state.matchCounter),
        pendingAction: 'none',
      }));

      // NPC turn
      if (!tcgState.winner && tcgState.currentTurn === state.opponentId) {
        await resolveNpcTurn(tcgState, state.opponentId, state.playerId, set, get);
      }
    },

    playTrainer: (cardIndex, targetInfo) =>
      set((state) => {
        if (!state.tcgState) return {};

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

        return {
          tcgState: result.state,
          match: syncLegacyState(result.state, state.playerId, state.opponentId, state.catalog, state.matchCounter),
          pendingAction: 'none',
          pendingTrainerIndex: null,
        };
      }),

    evolve: (handIndex, target, benchIndex) =>
      set((state) => {
        if (!state.tcgState) return {};
        const result = evolvePokemon(state.tcgState, state.playerId, handIndex, target, benchIndex);
        if (!result.success || !result.state) return {};

        return {
          tcgState: result.state,
          match: syncLegacyState(result.state, state.playerId, state.opponentId, state.catalog, state.matchCounter),
        };
      }),

    switchActivePokemon: (benchIndex) =>
      set((state) => {
        if (!state.tcgState) return {};
        const result = switchActive(state.tcgState, state.playerId, benchIndex);
        if (!result.success || !result.state) return {};

        return {
          tcgState: result.state,
          match: syncLegacyState(result.state, state.playerId, state.opponentId, state.catalog, state.matchCounter),
        };
      }),

    forceSwitchAfterKO: (benchIndex) =>
      set((state) => {
        if (!state.tcgState) return {};
        const result = forceSwitchOnKO(state.tcgState, state.playerId, benchIndex);
        if (!result.success || !result.state) return {};

        return {
          tcgState: result.state,
          match: syncLegacyState(result.state, state.playerId, state.opponentId, state.catalog, state.matchCounter),
          pendingAction: 'none',
        };
      }),

    passPlayerTurn: async () => {
      const state = get();
      if (!state.tcgState) return;

      let tcgState = endTurn(state.tcgState);

      set(() => ({
        tcgState,
        match: syncLegacyState(tcgState, state.playerId, state.opponentId, state.catalog, state.matchCounter),
      }));

      // NPC turn
      if (tcgState.currentTurn === state.opponentId) {
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

    // --- PvP-specific actions (simplified — keeping structure, will need tcg-engine migration later) ---
    startPvpSearch: () => {
      const currentStatus = get().pvpStatus;
      if (currentStatus === 'searching' || currentStatus === 'matched') {
        return;
      }
      set(() => ({ pvpStatus: 'searching' }));
      // PvP search logic would go here — temporarily disabled during migration
    },

    cancelPvpSearch: () => {
      set(() => ({
        pvpStatus: 'idle',
        pvpMatchInfo: null,
        isPvp: false,
      }));
    },

    disconnectPvp: () => {
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
