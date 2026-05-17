import { useEffect, useState } from 'react';
import { useBattleStore } from '../battle/store';
import { ArHud } from './ArHud';
import { ArSession } from './ArSession';
import { checkWebXrSupport } from './checkWebXrSupport';
import { battleXrStore } from './xrStore';
import './ar.css';

type ArExperienceProps = {
  onExit: () => void;
};

export function ArExperience({ onExit }: ArExperienceProps) {
  const match = useBattleStore((state) => state.match);
  const [webXrSupported, setWebXrSupported] = useState(false);
  const [previewMode, setPreviewMode] = useState(true);
  const [placementArmed, setPlacementArmed] = useState(false);
  const [tablePlaced, setTablePlaced] = useState(false);

  useEffect(() => {
    let active = true;

    void checkWebXrSupport().then((supported) => {
      if (!active) {
        return;
      }

      setWebXrSupported(supported);
      setPreviewMode(!supported);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!match) {
      return;
    }

    setPlacementArmed(false);
    setTablePlaced(false);
  }, [match?.matchId]);

  if (!match) {
    return null;
  }

  const handleEnterAr = () => {
    setPreviewMode(false);
    void battleXrStore.enterAR();
  };

  const handleTogglePreview = () => {
    setPreviewMode((current) => !current);
    setPlacementArmed(false);
    setTablePlaced(false);
  };

  const handleArmPlacement = () => {
    setPlacementArmed(true);
  };

  const handleTablePlaced = () => {
    setTablePlaced(true);
    setPlacementArmed(false);
  };

  return (
    <div className="ar-shell">
      <ArSession
        match={match}
        previewMode={previewMode}
        placementArmed={placementArmed}
        onTablePlaced={handleTablePlaced}
      />
      <ArHud
        match={match}
        webXrSupported={webXrSupported}
        previewMode={previewMode}
        tablePlaced={tablePlaced}
        placementArmed={placementArmed}
        onEnterAr={handleEnterAr}
        onArmPlacement={handleArmPlacement}
        onTogglePreview={handleTogglePreview}
        onExitAr={onExit}
      />
    </div>
  );
}


