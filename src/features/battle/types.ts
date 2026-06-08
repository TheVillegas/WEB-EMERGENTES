import type { Card } from '../cards/types';

export type DeckType = 'Fuego' | 'Agua' | 'Planta' | 'Lucha' | 'Psíquico' | 'Incoloro' | 'Rayo';
export type Difficulty = 'Fácil' | 'Normal' | 'Difícil' | '1vs1';

export type TurnOwner = 'player' | 'npc';

export type TurnPhase = 'loading' | 'selecting-active' | 'player-turn' | 'npc-turn' | 'waiting-for-opponent' | 'opponent-selecting-active' | 'game-over';

export type Winner = TurnOwner | null;

export type Battler = Card & {
  currentHp: number;
  energy: number;
};

export type GameState = {
  phase: TurnPhase;
  turn: TurnOwner;
  winner: Winner;
  catalog: Card[];
  playerHand: Card[];
  npcHand: Card[];
  playerActive: Battler | null;
  npcActive: Battler | null;
  log: string[];
  pendingNpc: boolean;
  matchId: number;
  energyAssignedThisTurn: boolean;
};

export type NpcActionType = 'attach-energy' | 'attack' | 'pass';

export type NpcAction = {
  type: NpcActionType;
  reason?: string;
  source?: 'mock' | 'http';
  notice?: string;
};
