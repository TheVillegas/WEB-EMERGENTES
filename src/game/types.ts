import * as THREE from 'three';
import type { Battler } from '../features/battle/types';
import type { Card } from '../features/cards/types';

export interface BattleSceneController {
  resize(): void;
  dispose(): void;
  
  setPlayerHand(cards: Card[], focusedIndex: number): void;
  setActiveCards(player: Battler | null, npc: Battler | null): void;
  setActionFocus(index: number): void;
  
  animateSummon(cardId: string): Promise<void>;
  animateAttack(attacker: 'player' | 'npc', damage: number, lethal: boolean): Promise<void>;
  animateDamage(target: 'player' | 'npc', lethal: boolean): Promise<void>;
}

export interface CardMesh {
  mesh: THREE.Mesh;
  card: Card;
  baseColor: THREE.Color;
}

export interface ActiveCard3D {
  mesh: THREE.Mesh;
  hpBar: THREE.Mesh;
  hpBarBg: THREE.Mesh;
  energyPips: THREE.Mesh[];
  glow: THREE.Mesh;
  cardData: Battler;
}
