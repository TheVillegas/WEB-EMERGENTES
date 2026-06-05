import { create } from 'zustand';
import { assignEnergy, canAttack, createMatch, passTurn, playCard, resetMatch, resolveAttack } from './gameEngine';
import type { DeckType, Difficulty, GameState } from './types';
import type { Card } from '../cards/types';
import { createNpcService, getNpcRuntimeConfig, type NpcService } from '../npc/npcService';
import { multiplayerService, type PvpMatchInfo } from '../multiplayer/multiplayerService';
import { createPvpMatch } from './pvpEngine';

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
  match: GameState | null;
  selectedDeck: DeckType | null;
  selectedDifficulty: Difficulty | null;
  isPvp: boolean;
  pvpMatchInfo: PvpMatchInfo | null;
  pvpStatus: 'idle' | 'searching' | 'matched' | 'disconnected';
  setCatalogLoading: () => void;
  setCatalogError: (message: string) => void;
  initializeCatalog: (cards: Card[]) => void;
  setDeck: (deck: DeckType) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  startMatch: () => void;
  selectPlayerActive: (cardId: string) => void;
  assignPlayerEnergy: () => void;
  playerAttack: () => Promise<void>;
  passPlayerTurn: () => Promise<void>;
  resetCurrentMatch: () => void;
  // PvP-specific actions
  startPvpSearch: () => void;
  cancelPvpSearch: () => void;
  disconnectPvp: () => void;
};

const aesthetic = {
  name: 'Portable console',
  why: 'combina HUD legible, contraste alto y una mesa sobria para que el loop offline se entienda en mobile y en grabación.',
};

async function resolveNpcTurn(
  match: GameState,
  npcService: NpcService,
  setState: (recipe: (state: BattleStoreState) => BattleStoreState | Partial<BattleStoreState>) => void,
  getState: () => BattleStoreState,
): Promise<void> {
  const action = await npcService.decideAction(match);
  const latest = getState().match;

  if (!latest || latest.matchId !== match.matchId || latest.phase !== 'npc-turn') {
    return;
  }

  let next = latest;

  if (action.notice) {
    next = {
      ...next,
      log: [...next.log, action.notice],
    };
  }

  if (action.type === 'attach-energy') {
    next = assignEnergy(next, 'npc');

    if (canAttack(next.npcActive)) {
      next = resolveAttack(next, 'npc');
    } else {
      next = passTurn(next, 'npc', action.reason);
    }
  } else if (action.type === 'attack') {
    next = resolveAttack(next, 'npc');
  } else {
    next = passTurn(next, 'npc', action.reason);
  }

  setState(() => ({ match: next }));
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
    match: null,
    selectedDeck: null,
    selectedDifficulty: null,
    isPvp: false,
    pvpMatchInfo: null,
    pvpStatus: 'idle',
    setCatalogLoading: () => set(() => ({ catalogStatus: 'loading', errorMessage: null })),
    setCatalogError: (message) => set(() => ({ catalogStatus: 'error', errorMessage: message })),
    initializeCatalog: (cards) =>
      set(() => {
        return {
          catalogStatus: 'ready',
          errorMessage: null,
          catalog: cards,
        };
      }),
    setDeck: (deck) => set(() => ({ selectedDeck: deck })),
    setDifficulty: (difficulty) => set(() => ({ selectedDifficulty: difficulty })),
    startMatch: () =>
      set((state) => {
        if (state.selectedDifficulty === '1vs1') {
          // PvP match — will be initialized after opponent connects
          return { isPvp: true };
        }
        return {
          isPvp: false,
          match: createMatch(state.catalog, (state.match?.matchId ?? 0) + 1, state.selectedDeck || 'Fuego', state.selectedDifficulty || 'Normal'),
        };
      }),
    selectPlayerActive: (cardId) =>
      set((state) => {
        if (!state.match) return {};
        const selected = state.match.playerHand.find((c) => c.id === cardId);
        let next = playCard(state.match, cardId);

        // If PvP, tell opponent which card we selected
        if (state.isPvp && selected) {
          multiplayerService.emitSelectActive(cardId, selected);

          // In PvP: after selecting our card, check if opponent has selected theirs
          if (!next.npcActive) {
            // Opponent hasn't selected yet — wait for them
            next = {
              ...next,
              phase: 'opponent-selecting-active',
            };
          } else {
            // Both have selected — Player 1 goes first
            const isPlayer1 = state.pvpMatchInfo?.role === 'player1';
            next = {
              ...next,
              phase: isPlayer1 ? 'player-turn' : 'npc-turn',
              turn: isPlayer1 ? 'player' : 'npc',
              pendingNpc: !isPlayer1,
              energyAssignedThisTurn: false,
            };
          }
        }

        return { match: next };
      }),
    assignPlayerEnergy: () =>
      set((state) => {
        if (!state.match) return {};
        const next = assignEnergy(state.match, 'player');

        // If PvP, tell opponent
        if (state.isPvp) {
          multiplayerService.emitAssignEnergy();
        }

        return { match: next };
      }),
    playerAttack: async () => {
      const state = get();
      const current = state.match;

      if (!current) {
        return;
      }

      const updated = resolveAttack(current, 'player');
      set(() => ({ match: updated }));

      if (state.isPvp) {
        // In PvP, tell the opponent we attacked (they apply the damage locally)
        multiplayerService.emitAttack();
      } else if (updated.phase === 'npc-turn') {
        await resolveNpcTurn(updated, npcService, set, get);
      }
    },
    passPlayerTurn: async () => {
      const state = get();
      const current = state.match;

      if (!current) {
        return;
      }

      const updated = passTurn(current, 'player');
      set(() => ({ match: updated }));

      if (state.isPvp) {
        multiplayerService.emitPassTurn();
      } else if (updated.phase === 'npc-turn') {
        await resolveNpcTurn(updated, npcService, set, get);
      }
    },
    resetCurrentMatch: () =>
      set((state) => {
        if (state.isPvp) {
          multiplayerService.disconnect();
          return {
            match: null,
            isPvp: false,
            pvpMatchInfo: null,
            pvpStatus: 'idle',
          };
        }
        return {
          match: createMatch(state.catalog, (state.match?.matchId ?? 0) + 1, state.selectedDeck || 'Fuego', state.selectedDifficulty || 'Normal'),
        };
      }),

    // --- PvP-specific actions ---
    startPvpSearch: () => {
      // Guard: prevent double-call from React StrictMode.
      // Zustand's set() is synchronous, so the second call sees 'searching' and bails.
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
          const state = get();
          const pvpMatch = createPvpMatch(
            state.catalog,
            (state.match?.matchId ?? 0) + 1,
            state.selectedDeck || 'Fuego',
            info.role,
          );

          set(() => ({
            pvpStatus: 'matched',
            pvpMatchInfo: info,
            match: pvpMatch,
          }));
        },
        onOpponentSelectActive: (data) => {
          // The opponent selected their active card — update NPC slot with their card
          const state = get();
          if (!state.match) return;

          const opponentCard = data.card;
          const battler = {
            ...opponentCard,
            currentHp: opponentCard.hp,
            energy: 0,
          };

          const hasOurCard = Boolean(state.match.playerActive);
          const isPlayer1 = state.pvpMatchInfo?.role === 'player1';

          let updatedMatch = {
            ...state.match,
            npcActive: battler,
            log: [...state.match.log, `${state.pvpMatchInfo?.opponentName || 'Rival'} activó a ${opponentCard.name}.`],
          };

          // If we already selected our card, transition to the battle phase
          if (hasOurCard) {
            updatedMatch = {
              ...updatedMatch,
              phase: isPlayer1 ? 'player-turn' : 'npc-turn',
              turn: isPlayer1 ? 'player' : 'npc',
              pendingNpc: !isPlayer1,
              energyAssignedThisTurn: false,
            };
          }

          set(() => ({ match: updatedMatch }));
        },
        onOpponentAssignEnergy: () => {
          const state = get();
          if (!state.match) return;

          const next = assignEnergy(state.match, 'npc');
          set(() => ({ match: next }));
        },
        onOpponentAttack: () => {
          const state = get();
          if (!state.match) return;

          let next = resolveAttack(state.match, 'npc');

          // After opponent attacks, if we're not dead, it's our turn
          if (next.phase === 'npc-turn') {
            next = {
              ...next,
              phase: 'player-turn',
              turn: 'player',
              pendingNpc: false,
              energyAssignedThisTurn: false,
            };
          }

          set(() => ({ match: next }));
        },
        onOpponentPassTurn: () => {
          const state = get();
          if (!state.match) return;

          let next = passTurn(state.match, 'npc');

          // After opponent passes, it's our turn
          if (next.phase === 'npc-turn') {
            next = {
              ...next,
              phase: 'player-turn',
              turn: 'player',
              pendingNpc: false,
              energyAssignedThisTurn: false,
            };
          }

          set(() => ({ match: next }));
        },
        onOpponentDisconnected: () => {
          const state = get();
          if (!state.match) return;

          set(() => ({
            pvpStatus: 'disconnected',
            match: {
              ...state.match!,
              log: [...state.match!.log, 'El oponente se ha desconectado.'],
              phase: 'game-over',
              winner: 'player',
            },
          }));
        },
      });

      multiplayerService.joinQueue('Jugador');
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
      }));
    },
  }));
}

export const useBattleStore = createBattleStore();
