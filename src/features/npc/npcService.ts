import type { GameState, NpcAction } from '../battle/types';

export interface NpcService {
  decideAction(state: GameState): Promise<NpcAction>;
}
