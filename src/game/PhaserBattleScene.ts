import Phaser from 'phaser';
import type { Battler, GameState } from '../features/battle/types';

export type BattleBoardSnapshot = Pick<
  GameState,
  'matchId' | 'phase' | 'turn' | 'winner' | 'pendingNpc' | 'playerActive' | 'npcActive'
>;

type CardVisualGroup = {
  panel: Phaser.GameObjects.Rectangle;
  glow: Phaser.GameObjects.Rectangle;
  status: Phaser.GameObjects.Text;
  title: Phaser.GameObjects.Text;
  hp: Phaser.GameObjects.Text;
  energy: Phaser.GameObjects.Text;
  attack: Phaser.GameObjects.Text;
};

export class PhaserBattleScene extends Phaser.Scene {
  private snapshot: BattleBoardSnapshot | null = null;
  private playerCard?: CardVisualGroup;
  private npcCard?: CardVisualGroup;
  private boardTitle?: Phaser.GameObjects.Text;
  private boardMeta?: Phaser.GameObjects.Text;
  private boardResult?: Phaser.GameObjects.Text;
  private isReady = false;

  constructor() {
    super('battle-board');
  }

  create() {
    this.cameras.main.setBackgroundColor('#08111f');

    const frame = this.add.rectangle(360, 230, 696, 420, 0x10213b, 0.94);
    frame.setStrokeStyle(2, 0x91deff, 0.16);

    this.add.rectangle(360, 120, 640, 2, 0x91deff, 0.18);

    this.boardTitle = this.add.text(40, 30, 'Mesa Phaser · solo lectura', {
      fontFamily: '"Chakra Petch", sans-serif',
      fontSize: '26px',
      color: '#e8f2ff',
    });
    this.boardMeta = this.add.text(40, 64, 'Esperando snapshot...', {
      fontFamily: '"IBM Plex Sans", sans-serif',
      fontSize: '14px',
      color: '#9fb4d1',
    });
    this.boardResult = this.add.text(40, 92, '', {
      fontFamily: '"IBM Plex Sans", sans-serif',
      fontSize: '15px',
      color: '#89f0b5',
    });

    this.npcCard = this.createCardGroup(360, 158, 'Activo NPC');
    this.playerCard = this.createCardGroup(360, 284, 'Activo jugador');

    this.isReady = true;

    if (this.snapshot) {
      this.renderSnapshot(this.snapshot, null);
    }
  }

  sync(snapshot: BattleBoardSnapshot) {
    const previous = this.snapshot;
    this.snapshot = snapshot;

    if (!this.isReady) {
      return;
    }

    this.renderSnapshot(snapshot, previous);
  }

  private createCardGroup(x: number, y: number, fallbackStatus: string): CardVisualGroup {
    const glow = this.add.rectangle(x, y, 600, 96, 0x89f0b5, 0.08);
    glow.setStrokeStyle(2, 0x89f0b5, 0.18);

    const panel = this.add.rectangle(x, y, 588, 84, 0x132541, 0.95);
    panel.setStrokeStyle(2, 0x91deff, 0.14);

    const status = this.add.text(88, y - 28, fallbackStatus, {
      fontFamily: '"IBM Plex Sans", sans-serif',
      fontSize: '13px',
      color: '#9fb4d1',
    });
    const title = this.add.text(88, y - 4, 'Sin Pokémon activo', {
      fontFamily: '"Chakra Petch", sans-serif',
      fontSize: '24px',
      color: '#e8f2ff',
    });
    const hp = this.add.text(88, y + 24, 'HP —', {
      fontFamily: '"IBM Plex Sans", sans-serif',
      fontSize: '16px',
      color: '#e8f2ff',
    });
    const energy = this.add.text(288, y + 24, 'Energía —', {
      fontFamily: '"IBM Plex Sans", sans-serif',
      fontSize: '16px',
      color: '#89f0b5',
    });
    const attack = this.add.text(448, y + 24, 'Ataque —', {
      fontFamily: '"IBM Plex Sans", sans-serif',
      fontSize: '16px',
      color: '#7dd3fc',
    });

    return { panel, glow, status, title, hp, energy, attack };
  }

  private renderSnapshot(snapshot: BattleBoardSnapshot, previous: BattleBoardSnapshot | null) {
    this.renderMeta(snapshot);
    this.renderBattler(this.npcCard, snapshot.npcActive, snapshot.pendingNpc ? 'NPC pensando…' : 'Activo NPC');
    this.renderBattler(
      this.playerCard,
      snapshot.playerActive,
      snapshot.phase === 'selecting-active' ? 'Esperando selección' : 'Activo jugador',
    );
    this.renderTurnGlow(snapshot);
    this.renderAttackFeedback(previous, snapshot);
  }

  private renderMeta(snapshot: BattleBoardSnapshot) {
    this.boardMeta?.setText(
      `Turno: ${snapshot.turn === 'player' ? 'Jugador' : 'NPC'} · Fase: ${snapshot.phase}`,
    );

    if (snapshot.winner === 'player') {
      this.boardResult?.setText('Victoria del jugador.');
      this.boardResult?.setColor('#89f0b5');
      return;
    }

    if (snapshot.winner === 'npc') {
      this.boardResult?.setText('El NPC cerró la partida.');
      this.boardResult?.setColor('#ff8d8d');
      return;
    }

    this.boardResult?.setText('');
  }

  private renderBattler(card: CardVisualGroup | undefined, battler: Battler | null, status: string) {
    if (!card) {
      return;
    }

    if (!battler) {
      card.status.setText(status);
      card.title.setText('Sin Pokémon activo');
      card.hp.setText('HP —');
      card.energy.setText('Energía —');
      card.attack.setText('Ataque —');
      return;
    }

    card.status.setText(status);
    card.title.setText(battler.name);
    card.hp.setText(`HP ${battler.currentHp}/${battler.hp}`);
    card.energy.setText(`Energía ${battler.energy}/${battler.attackCost}`);
    card.attack.setText(`${battler.attackName} · ${battler.attackDamage}`);
  }

  private renderTurnGlow(snapshot: BattleBoardSnapshot) {
    if (!this.playerCard || !this.npcCard) {
      return;
    }

    const playerTurn = snapshot.turn === 'player' && !snapshot.winner;
    const npcTurn = snapshot.turn === 'npc' && !snapshot.winner;

    this.playerCard.glow.setFillStyle(playerTurn ? 0x89f0b5 : 0x91deff, playerTurn ? 0.12 : 0.03);
    this.playerCard.glow.setStrokeStyle(2, playerTurn ? 0x89f0b5 : 0x91deff, playerTurn ? 0.38 : 0.12);
    this.npcCard.glow.setFillStyle(npcTurn ? 0x7dd3fc : 0x91deff, npcTurn ? 0.12 : 0.03);
    this.npcCard.glow.setStrokeStyle(2, npcTurn ? 0x7dd3fc : 0x91deff, npcTurn ? 0.38 : 0.12);
  }

  private renderAttackFeedback(previous: BattleBoardSnapshot | null, current: BattleBoardSnapshot) {
    if (!previous) {
      return;
    }

    const npcDamaged =
      previous.npcActive && current.npcActive && current.npcActive.currentHp < previous.npcActive.currentHp;
    const playerDamaged =
      previous.playerActive && current.playerActive && current.playerActive.currentHp < previous.playerActive.currentHp;

    if (npcDamaged && this.npcCard) {
      this.pulsePanel(this.npcCard.panel, 0xff8d8d);
    }

    if (playerDamaged && this.playerCard) {
      this.pulsePanel(this.playerCard.panel, 0xff8d8d);
    }
  }

  private pulsePanel(panel: Phaser.GameObjects.Rectangle, color: number) {
    panel.setStrokeStyle(3, color, 0.92);
    this.tweens.killTweensOf(panel);
    this.tweens.add({
      targets: panel,
      duration: 260,
      yoyo: true,
      repeat: 0,
      ease: 'Sine.Out',
      alpha: { from: 0.82, to: 1 },
      onComplete: () => {
        panel.setStrokeStyle(2, 0x91deff, 0.14);
        panel.setAlpha(1);
      },
    });
  }
}
