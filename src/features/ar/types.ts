export type ArCardZone = 'playerHand' | 'playerActive' | 'npcHand' | 'npcActive';

export type ArCardFace = 'front' | 'back';

export type ArCardSlot = {
  slotId: string;
  cardId: string;
  zone: ArCardZone;
  face: ArCardFace;
  textureUrl: string;
  position: [number, number, number];
  rotation: [number, number, number];
  label: string;
};

export type ArSceneDescriptor = {
  slots: ArCardSlot[];
};
