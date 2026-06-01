import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../features/battle/types';
import { buildBattleScene } from './battleSceneBuilder';
import type { BattleSceneController } from './types';

interface ThreeArenaProps {
  match: GameState | null;
  focusedHandIndex: number;
  focusedArea: 'hand' | 'actions';
  focusedActionIndex: number;
  onSelectPlayerActive: (cardId: string) => void;
}

export function ThreeArena({ match, focusedHandIndex, focusedArea, focusedActionIndex, onSelectPlayerActive }: ThreeArenaProps) {
  const controllerRef = useRef<BattleSceneController | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);

  // We will handle keyboard state in App.tsx later, but for now we just render the scene
  // and pass it the state. The controller needs to be built only once.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const ctrl = buildBattleScene(host, {
      onCardHover: (id) => {
        // Handled internally by scene builder or can be exposed
      },
      onCardClick: (id) => {
        onSelectPlayerActive(id);
      }
    });
    controllerRef.current = ctrl;

    const handleResize = () => ctrl.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      ctrl.dispose();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!match || !controllerRef.current) return;
    
    controllerRef.current.setPlayerHand(match.playerHand, focusedArea === 'hand' ? focusedHandIndex : -1);
    controllerRef.current.setActiveCards(match.playerActive, match.npcActive);
    controllerRef.current.setActionFocus(focusedArea === 'actions' ? focusedActionIndex : -1);
  }, [match, focusedHandIndex, focusedArea, focusedActionIndex]);

  // Coordinate Animations based on state changes
  const previousMatchRef = useRef<GameState | null>(null);
  useEffect(() => {
    if (!match || !controllerRef.current) return;
    const prev = previousMatchRef.current;
    if (!prev) { previousMatchRef.current = match; return; }

    const npcDmg = prev.npcActive && match.npcActive ? prev.npcActive.currentHp - match.npcActive.currentHp : 0;
    const playerDmg = prev.playerActive && match.playerActive ? prev.playerActive.currentHp - match.playerActive.currentHp : 0;

    if (npcDmg > 0) {
      controllerRef.current.animateAttack('player', npcDmg, match.npcActive?.currentHp === 0);
    } else if (playerDmg > 0) {
      controllerRef.current.animateAttack('npc', playerDmg, match.playerActive?.currentHp === 0);
    }

    if (!prev.playerActive && match.playerActive) {
      controllerRef.current.animateSummon(match.playerActive.id);
    }

    previousMatchRef.current = match;
  }, [match]);

  return <div ref={hostRef} className="three-arena" aria-hidden="true" />;
}
