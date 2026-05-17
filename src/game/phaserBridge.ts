import type { Game } from 'phaser';
import type { GameState } from '../features/battle/types';
import { PhaserBattleScene, type BattleBoardSnapshot } from './PhaserBattleScene';

export type PhaserBattleBridge = {
  sync: (state: GameState) => void;
  destroy: () => void;
};

function toSnapshot(state: GameState): BattleBoardSnapshot {
  return {
    matchId: state.matchId,
    phase: state.phase,
    turn: state.turn,
    winner: state.winner,
    pendingNpc: state.pendingNpc,
    playerActive: state.playerActive,
    npcActive: state.npcActive,
  };
}

export async function createPhaserBattleBridge(container: HTMLElement): Promise<PhaserBattleBridge> {
  const Phaser = await import('phaser');
  const scene = new PhaserBattleScene();

  const game: Game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    width: 720,
    height: 460,
    backgroundColor: '#08111f',
    transparent: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene,
  });

  return {
    sync: (state) => {
      scene.sync(toSnapshot(state));
    },
    destroy: () => {
      game.destroy(true);
    },
  };
}
