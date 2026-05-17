import { create } from 'zustand';
import { assignEnergy, canAttack, createMatch, passTurn, playCard, resetMatch, resolveAttack } from './gameEngine';
import type { GameState } from './types';
import type { Card } from '../cards/types';
import { createNpcService, getNpcRuntimeConfig, type NpcService } from '../npc/npcService';

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
  setCatalogLoading: () => void;
  setCatalogError: (message: string) => void;
  initializeCatalog: (cards: Card[]) => void;
  startMatch: () => void;
  selectPlayerActive: (cardId: string) => void;
  assignPlayerEnergy: () => void;
  playerAttack: () => Promise<void>;
  passPlayerTurn: () => Promise<void>;
  resetCurrentMatch: () => void;
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
    setCatalogLoading: () => set(() => ({ catalogStatus: 'loading', errorMessage: null })),
    setCatalogError: (message) => set(() => ({ catalogStatus: 'error', errorMessage: message })),
    initializeCatalog: (cards) =>
      set(() => {
        const match = createMatch(cards, 1);

        return {
          catalogStatus: 'ready',
          errorMessage: null,
          catalog: cards,
          match,
        };
      }),
    startMatch: () =>
      set((state) => ({
        match: createMatch(state.catalog, (state.match?.matchId ?? 0) + 1),
      })),
    selectPlayerActive: (cardId) =>
      set((state) => ({
        match: state.match ? playCard(state.match, cardId) : null,
      })),
    assignPlayerEnergy: () =>
      set((state) => ({
        match: state.match ? assignEnergy(state.match, 'player') : null,
      })),
    playerAttack: async () => {
      const current = get().match;

      if (!current) {
        return;
      }

      const updated = resolveAttack(current, 'player');
      set(() => ({ match: updated }));

      if (updated.phase === 'npc-turn') {
        await resolveNpcTurn(updated, npcService, set, get);
      }
    },
    passPlayerTurn: async () => {
      const current = get().match;

      if (!current) {
        return;
      }

      const updated = passTurn(current, 'player');
      set(() => ({ match: updated }));

      if (updated.phase === 'npc-turn') {
        await resolveNpcTurn(updated, npcService, set, get);
      }
    },
    resetCurrentMatch: () =>
      set((state) => ({
        match: state.match ? resetMatch(state.match) : createMatch(state.catalog, 1),
      })),
  }));
}

export const useBattleStore = createBattleStore();
