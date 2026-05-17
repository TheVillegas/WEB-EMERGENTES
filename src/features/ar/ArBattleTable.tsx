import type { GameState } from '../battle/types';
import { ArCardMesh } from './ArCardMesh';
import { mapMatchToArScene } from './mapMatchToArScene';

type ArBattleTableProps = {
  match: GameState;
};

export function ArBattleTable({ match }: ArBattleTableProps) {
  const scene = mapMatchToArScene(match);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
        <planeGeometry args={[0.42, 0.5]} />
        <meshStandardMaterial color="#10213b" transparent opacity={0.35} />
      </mesh>

      {scene.slots.map((slot) => (
        <ArCardMesh key={slot.slotId} slot={slot} />
      ))}
    </group>
  );
}
