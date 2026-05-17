import Phaser from 'phaser';
import type { Battler, GameState } from '../features/battle/types';

export type BattleBoardSnapshot = Pick<
  GameState,
  'matchId' | 'phase' | 'turn' | 'winner' | 'pendingNpc' | 'playerActive' | 'npcActive'
>;

type ZoneGroup = {
  plate: Phaser.GameObjects.Rectangle;
  glow: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  detail: Phaser.GameObjects.Text;
};

export class PhaserBattleScene extends Phaser.Scene {
  private snapshot: BattleBoardSnapshot | null = null;
  private npcZone?: ZoneGroup;
  private playerZone?: ZoneGroup;
  private boardMeta?: Phaser.GameObjects.Text;
  private boardResult?: Phaser.GameObjects.Text;
  private fxLayer?: Phaser.GameObjects.Graphics;
  private isReady = false;

  constructor() {
    super('battle-board');
  }

  create() {
    this.cameras.main.setBackgroundColor('#071326');

    this.add.rectangle(640, 380, 1220, 720, 0x071326, 0.96);
    this.add.circle(640, 160, 200, 0x2db8ff, 0.06);
    this.add.circle(640, 600, 240, 0x76eecf, 0.06);

    const arena = this.add.graphics();
    arena.lineStyle(2, 0x5dcaff, 0.14);
    arena.fillStyle(0x0c1c36, 0.74);
    arena.beginPath();
    arena.moveTo(160, 186);
    arena.lineTo(1120, 186);
    arena.lineTo(1040, 618);
    arena.lineTo(240, 618);
    arena.closePath();
    arena.fillPath();
    arena.strokePath();

    const grid = this.add.graphics();
    grid.lineStyle(1, 0x7ef0c3, 0.08);
    for (let x = 240; x <= 1040; x += 70) {
      grid.lineBetween(x, 220, x - 40, 590);
    }
    for (let y = 230; y <= 570; y += 46) {
      grid.lineBetween(220, y, 1060, y);
    }

    const lane = this.add.graphics();
    lane.lineStyle(2, 0x7ef0c3, 0.18);
    lane.strokeEllipse(640, 398, 280, 74);
    lane.strokeEllipse(640, 398, 420, 110);

    this.boardMeta = this.add.text(48, 36, 'Turno del jugador · Arena estable', {
      fontFamily: '"IBM Plex Sans", sans-serif',
      fontSize: '18px',
      color: '#9eb6cf',
    });

    this.boardResult = this.add.text(48, 66, '', {
      fontFamily: '"Chakra Petch", sans-serif',
      fontSize: '28px',
      color: '#7ef0c3',
    });

    this.npcZone = this.createZone(640, 220, 'RIVAL', 'Esperando respuesta');
    this.playerZone = this.createZone(640, 560, 'JUGADOR', 'Seleccioná tu activo');
    this.fxLayer = this.add.graphics();

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

  private createZone(x: number, y: number, label: string, detail: string): ZoneGroup {
    const glow = this.add.rectangle(x, y, 520, 120, 0x2db8ff, 0.03);
    glow.setStrokeStyle(2, 0x2db8ff, 0.14);

    const plate = this.add.rectangle(x, y, 460, 92, 0x10213b, 0.84);
    plate.setStrokeStyle(2, 0x83dbff, 0.2);

    const zoneLabel = this.add.text(x, y - 18, label, {
      fontFamily: '"Chakra Petch", sans-serif',
      fontSize: '28px',
      color: '#ebf7ff',
    });
    zoneLabel.setOrigin(0.5);

    const zoneDetail = this.add.text(x, y + 18, detail, {
      fontFamily: '"IBM Plex Sans", sans-serif',
      fontSize: '18px',
      color: '#9eb6cf',
    });
    zoneDetail.setOrigin(0.5);

    return { plate, glow, label: zoneLabel, detail: zoneDetail };
  }

  private renderSnapshot(snapshot: BattleBoardSnapshot, previous: BattleBoardSnapshot | null) {
    this.renderMeta(snapshot);
    this.renderZone(this.npcZone, snapshot.npcActive, snapshot.pendingNpc ? 'Cargando acción rival' : 'Carta rival en posición');
    this.renderZone(this.playerZone, snapshot.playerActive, snapshot.phase === 'selecting-active' ? 'Elegí tu carta activa' : 'Carta lista para jugar');
    this.renderTurnGlow(snapshot);
    this.renderAttackFeedback(previous, snapshot);
  }

  private renderMeta(snapshot: BattleBoardSnapshot) {
    const phaseMap: Record<BattleBoardSnapshot['phase'], string> = {
      loading: 'Carga',
      'selecting-active': 'Elegir carta',
      'player-turn': 'Turno del jugador',
      'npc-turn': 'Turno del rival',
      'game-over': 'Final',
    };

    this.boardMeta?.setText(`${snapshot.turn === 'player' ? 'Jugador' : 'NPC'} · ${phaseMap[snapshot.phase]}`);

    if (snapshot.winner === 'player') {
      this.boardResult?.setText('VICTORIA');
      this.boardResult?.setColor('#7ef0c3');
      return;
    }

    if (snapshot.winner === 'npc') {
      this.boardResult?.setText('DERROTA');
      this.boardResult?.setColor('#ff7b9f');
      return;
    }

    this.boardResult?.setText('');
  }

  private renderZone(zone: ZoneGroup | undefined, battler: Battler | null, fallback: string) {
    if (!zone) {
      return;
    }

    if (!battler) {
      zone.label.setText(zone === this.playerZone ? 'JUGADOR' : 'RIVAL');
      zone.detail.setText(fallback);
      return;
    }

    zone.label.setText(battler.name.toUpperCase());
    zone.detail.setText(`HP ${battler.currentHp}/${battler.hp} · ENERGÍA ${battler.energy}/${battler.attackCost}`);
  }

  private renderTurnGlow(snapshot: BattleBoardSnapshot) {
    if (!this.playerZone || !this.npcZone) {
      return;
    }

    const playerTurn = snapshot.turn === 'player' && !snapshot.winner;
    const npcTurn = snapshot.turn === 'npc' && !snapshot.winner;

    this.playerZone.glow.setFillStyle(0x7ef0c3, playerTurn ? 0.12 : 0.03);
    this.playerZone.glow.setStrokeStyle(2, playerTurn ? 0x7ef0c3 : 0x83dbff, playerTurn ? 0.44 : 0.12);
    this.npcZone.glow.setFillStyle(0x2db8ff, npcTurn ? 0.12 : 0.03);
    this.npcZone.glow.setStrokeStyle(2, npcTurn ? 0x2db8ff : 0x83dbff, npcTurn ? 0.44 : 0.12);
  }

  private renderAttackFeedback(previous: BattleBoardSnapshot | null, current: BattleBoardSnapshot) {
    if (!previous || !this.fxLayer) {
      return;
    }

    this.fxLayer.clear();

    const npcDamage =
      previous.npcActive && current.npcActive ? previous.npcActive.currentHp - current.npcActive.currentHp : 0;
    const playerDamage =
      previous.playerActive && current.playerActive ? previous.playerActive.currentHp - current.playerActive.currentHp : 0;

    if (npcDamage > 0 && this.playerZone && this.npcZone) {
      this.playAttackBurst(this.playerZone.plate, this.npcZone.plate, npcDamage, '#7ef0c3');
      this.pulseZone(this.npcZone, 0xff7b9f);
    }

    if (playerDamage > 0 && this.playerZone && this.npcZone) {
      this.playAttackBurst(this.npcZone.plate, this.playerZone.plate, playerDamage, '#2db8ff');
      this.pulseZone(this.playerZone, 0xff7b9f);
    }
  }

  private pulseZone(zone: ZoneGroup, color: number) {
    zone.plate.setStrokeStyle(3, color, 0.94);
    this.tweens.killTweensOf(zone.plate);
    this.tweens.add({
      targets: zone.plate,
      duration: 260,
      x: zone.plate.x + 8,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.InOut',
      onComplete: () => {
        zone.plate.setStrokeStyle(2, 0x83dbff, 0.2);
        zone.plate.x = zone.glow.x;
      },
    });
  }

  private playAttackBurst(from: Phaser.GameObjects.Rectangle, to: Phaser.GameObjects.Rectangle, damage: number, color: string) {
    if (!this.fxLayer) {
      return;
    }

    const start = new Phaser.Math.Vector2(from.x, from.y);
    const end = new Phaser.Math.Vector2(to.x, to.y);
    const pulse = this.add.circle(start.x, start.y, 14, Phaser.Display.Color.HexStringToColor(color).color, 0.7);
    const impact = this.add.circle(end.x, end.y, 18, 0xff7b9f, 0.22);
    const damageText = this.add.text(end.x, end.y - 44, `-${damage}`, {
      fontFamily: '"Chakra Petch", sans-serif',
      fontSize: '36px',
      color: '#ffb2c4',
      stroke: '#20040f',
      strokeThickness: 6,
    });
    damageText.setOrigin(0.5);

    this.fxLayer.lineStyle(6, Phaser.Display.Color.HexStringToColor(color).color, 0.65);
    this.fxLayer.beginPath();
    this.fxLayer.moveTo(start.x, start.y);
    this.fxLayer.lineTo(end.x, end.y);
    this.fxLayer.strokePath();

    this.tweens.add({
      targets: pulse,
      x: end.x,
      y: end.y,
      scale: 0.42,
      alpha: 0,
      duration: 260,
      ease: 'Cubic.Out',
      onComplete: () => pulse.destroy(),
    });

    this.tweens.add({
      targets: impact,
      scale: 2.8,
      alpha: 0,
      duration: 320,
      ease: 'Quad.Out',
      onComplete: () => impact.destroy(),
    });

    this.tweens.add({
      targets: damageText,
      y: damageText.y - 28,
      alpha: 0,
      duration: 620,
      ease: 'Sine.Out',
      onComplete: () => damageText.destroy(),
    });

    this.time.delayedCall(180, () => {
      this.fxLayer?.clear();
    });
  }
}
