import type { Card } from '../cards/types';
import type { Battler, GameState } from '../battle/types';
import { ACTIVE_OFFSET_Z, CARD_BACK_URL, HAND_SPACING_M } from './constants';
import type { ArCardFace, ArCardSlot, ArCardZone, ArSceneDescriptor } from './types';

function handPositions(count: number, z: number): [number, number, number][] {
  if (count === 0) {
    return [];
  }

  const startX = -((count - 1) * HAND_SPACING_M) / 2;

  return Array.from({ length: count }, (_, index) => [startX + index * HAND_SPACING_M, 0, z]);
}

function toFrontTexture(card: Card | Battler): string {
  return card.imageLarge || card.imageSmall;
}

function createSlot(
  zone: ArCardZone,
  card: Card | Battler,
  position: [number, number, number],
  face: ArCardFace,
  textureUrl: string,
): ArCardSlot {
  return {
    slotId: `${zone}-${card.id}`,
    cardId: card.id,
    zone,
    face,
    textureUrl,
    position,
    rotation: [-Math.PI / 2, 0, 0],
    label: card.name,
  };
}

export function mapMatchToArScene(match: GameState): ArSceneDescriptor {
  const slots: ArCardSlot[] = [];

  const npcHandPositions = handPositions(match.npcHand.length, -ACTIVE_OFFSET_Z * 2);
  match.npcHand.forEach((card, index) => {
    slots.push(
      createSlot('npcHand', card, npcHandPositions[index] ?? [0, 0, -ACTIVE_OFFSET_Z * 2], 'back', CARD_BACK_URL),
    );
  });

  if (match.npcActive) {
    slots.push(
      createSlot(
        'npcActive',
        match.npcActive,
        [0, 0, -ACTIVE_OFFSET_Z],
        'front',
        toFrontTexture(match.npcActive),
      ),
    );
  }

  if (match.playerActive) {
    slots.push(
      createSlot(
        'playerActive',
        match.playerActive,
        [0, 0, ACTIVE_OFFSET_Z],
        'front',
        toFrontTexture(match.playerActive),
      ),
    );
  }

  const playerHandPositions = handPositions(match.playerHand.length, ACTIVE_OFFSET_Z * 2);
  match.playerHand.forEach((card, index) => {
    slots.push(
      createSlot(
        'playerHand',
        card,
        playerHandPositions[index] ?? [0, 0, ACTIVE_OFFSET_Z * 2],
        'front',
        toFrontTexture(card),
      ),
    );
  });

  return { slots };
}
