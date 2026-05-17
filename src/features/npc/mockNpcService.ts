import { canAttack } from '../battle/gameEngine';
import type { GameState, NpcAction } from '../battle/types';
import type { NpcService } from './npcService';

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, delayMs);
  });
}

export class MockNpcService implements NpcService {
  constructor(private readonly delayMs: number = 650) {}

  async decideAction(state: GameState): Promise<NpcAction> {
    await wait(this.delayMs);

    if (canAttack(state.npcActive)) {
      return { type: 'attack', reason: 'tiene energía suficiente' };
    }

    if (!state.energyAssignedThisTurn && state.npcActive) {
      return { type: 'attach-energy', reason: 'prepara el próximo ataque' };
    }

    return { type: 'pass', reason: 'todavía no llega al costo del ataque' };
  }
}
