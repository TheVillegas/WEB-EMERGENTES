export const CARD_W = 1.4;
export const CARD_H = 2.0;

export const HAND_ARC_ANGLE = Math.PI / 3; // 60 degrees total
export const HAND_RADIUS = 6.0;
export const HAND_Y = -0.2;
export const HAND_CENTER_Z = 3.5;

export const PLAYER_ACTIVE_POS = { x: 0, y: 0.2, z: 1.5 };
export const NPC_ACTIVE_POS = { x: 0, y: 0.2, z: -1.5 };

export const DECK_POS_NPC = { x: -3.5, y: 0.2, z: -2.5 };
export const DISCARD_POS_NPC = { x: 3.5, y: 0.2, z: -2.5 };
export const DECK_POS_PLAYER = { x: 3.5, y: 0.2, z: 2.5 };
export const DISCARD_POS_PLAYER = { x: -3.5, y: 0.2, z: 2.5 };

export const TYPE_COLORS: Record<string, string> = {
  Fire: '#ff6b35', Water: '#4fc3f7', Grass: '#66bb6a',
  Lightning: '#ffe082', Psychic: '#ce93d8', Fighting: '#ff8a65',
  Colorless: '#b0bec5', Darkness: '#546e7a', Metal: '#90a4ae',
  Dragon: '#7e57c2', Fairy: '#f48fb1',
  Entrenador: '#5c6bc0', Energía: '#ffd54f',
};
