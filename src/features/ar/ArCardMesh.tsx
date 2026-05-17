import { useTexture } from '@react-three/drei';
import { useMemo } from 'react';
import { DoubleSide } from 'three';
import { CARD_HEIGHT_M, CARD_WIDTH_M } from './constants';
import type { ArCardSlot } from './types';

type ArCardMeshProps = {
  slot: ArCardSlot;
};

export function ArCardMesh({ slot }: ArCardMeshProps) {
  const texture = useTexture(slot.textureUrl, (loader) => {
    loader.setCrossOrigin('anonymous');
  });

  const geometryArgs = useMemo(() => [CARD_WIDTH_M, CARD_HEIGHT_M] as [number, number], []);

  return (
    <group position={slot.position} rotation={slot.rotation}>
      <mesh>
        <planeGeometry args={geometryArgs} />
        <meshStandardMaterial map={texture} side={DoubleSide} transparent toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, -0.001]}>
        <planeGeometry args={[CARD_WIDTH_M + 0.004, CARD_HEIGHT_M + 0.004]} />
        <meshBasicMaterial color="#91deff" transparent opacity={0.22} side={DoubleSide} />
      </mesh>
    </group>
  );
}
