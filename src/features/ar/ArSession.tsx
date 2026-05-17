import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import { XR } from '@react-three/xr';
import type { GameState } from '../battle/types';
import { ArBattleTable } from './ArBattleTable';
import { ArPlacement } from './ArPlacement';
import { battleXrStore } from './xrStore';

type ArSessionProps = {
  match: GameState;
  previewMode: boolean;
  placementArmed: boolean;
  onTablePlaced: () => void;
};

function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight position={[1.2, 2.4, 1.5]} intensity={1.1} />
    </>
  );
}

function PreviewTable({ match }: { match: GameState }) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0.55, 0.72]} fov={48} />
      <OrbitControls enablePan={false} maxPolarAngle={Math.PI * 0.48} minDistance={0.35} maxDistance={1.2} />
      <group position={[0, -0.18, -0.42]} rotation={[-0.35, 0, 0]}>
        <ArBattleTable match={match} />
      </group>
    </>
  );
}

export function ArSession({ match, previewMode, placementArmed, onTablePlaced }: ArSessionProps) {
  return (
    <Canvas className="ar-canvas" gl={{ alpha: true }} camera={{ position: [0, 0, 0], fov: 70 }}>
      <SceneLights />
      <Suspense fallback={null}>
        {previewMode ? (
          <PreviewTable match={match} />
        ) : (
          <XR store={battleXrStore}>
            <ArPlacement
              key={match.matchId}
              armed={placementArmed}
              onPlacedChange={(placed) => placed && onTablePlaced()}
            >
              <ArBattleTable match={match} />
            </ArPlacement>
          </XR>
        )}
      </Suspense>
    </Canvas>
  );
}
