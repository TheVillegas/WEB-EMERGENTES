import { useXRRequestHitTest } from '@react-three/xr';
import { useEffect, useRef, useState } from 'react';
import type { Group } from 'three';
import { Matrix4, Quaternion, Vector3 } from 'three';

const matrixHelper = new Matrix4();
const positionHelper = new Vector3();
const rotationHelper = new Quaternion();
const scaleHelper = new Vector3();

type ArPlacementProps = {
  armed: boolean;
  children: React.ReactNode;
  onPlacedChange?: (placed: boolean) => void;
};

export function ArPlacement({ armed, children, onPlacedChange }: ArPlacementProps) {
  const [placed, setPlaced] = useState(false);
  const anchorRef = useRef<Group>(null);
  const requestHitTest = useXRRequestHitTest();

  useEffect(() => {
    if (!armed || placed) {
      return;
    }

    let cancelled = false;

    const runPlacement = async () => {
      try {
        const { results, getWorldMatrix } = await requestHitTest('viewer', ['plane']);

        if (cancelled || placed || results.length === 0 || !anchorRef.current) {
          return;
        }

        const hit = results[0];

        if (hit && getWorldMatrix(matrixHelper, hit)) {
          matrixHelper.decompose(positionHelper, rotationHelper, scaleHelper);
          anchorRef.current.position.copy(positionHelper);
          anchorRef.current.quaternion.copy(rotationHelper);
          setPlaced(true);
          onPlacedChange?.(true);
        }
      } catch {
        // Hit-test can fail while the session is still stabilizing.
      }
    };

    void runPlacement();

    return () => {
      cancelled = true;
    };
  }, [armed, onPlacedChange, placed, requestHitTest]);

  return <group ref={anchorRef}>{placed ? children : null}</group>;
}
