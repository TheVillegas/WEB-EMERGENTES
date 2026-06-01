import * as THREE from 'three';
import type { Card } from '../features/cards/types';
import type { Battler } from '../features/battle/types';
import type { CardMesh, ActiveCard3D } from './types';
import { loadTextureAsync } from './textureLoader';
import { CARD_W, CARD_H, HAND_ARC_ANGLE, HAND_RADIUS, HAND_Y, HAND_CENTER_Z, TYPE_COLORS } from './sceneCardLayout';

const cardGeo = new THREE.PlaneGeometry(CARD_W, CARD_H);

export function getTypeColor(type: string): THREE.Color {
  const hex = TYPE_COLORS[type] ?? TYPE_COLORS['Colorless'];
  return new THREE.Color(hex);
}

export function buildHandMeshes(
  cards: Card[],
  scene: THREE.Scene,
  placeholder: THREE.Texture
): CardMesh[] {
  return cards.map(card => {
    const mat = new THREE.MeshStandardMaterial({
      map: placeholder,
      roughness: 0.25,
      metalness: 0.1,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(cardGeo, mat);
    mesh.userData = { cardId: card.id, isHand: true };
    scene.add(mesh);

    const baseColor = getTypeColor(card.type);
    
    const borderGeo = new THREE.PlaneGeometry(CARD_W + 0.07, CARD_H + 0.07);
    const borderMat = new THREE.MeshBasicMaterial({
      color: baseColor,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
    });
    const border = new THREE.Mesh(borderGeo, borderMat);
    border.userData = { isBorder: true };
    border.position.z = -0.01;
    mesh.add(border);

    return { mesh, card, baseColor };
  });
}

export function layoutHand(meshes: CardMesh[], focusedIndex: number, animate: boolean = true) {
  const count = meshes.length;
  meshes.forEach((entry, i) => {
    const t = count <= 1 ? 0.5 : i / (count - 1);
    const angle = -HAND_ARC_ANGLE / 2 + t * HAND_ARC_ANGLE;
    
    const x = Math.sin(angle) * HAND_RADIUS;
    const z = HAND_CENTER_Z - Math.cos(angle) * HAND_RADIUS + HAND_RADIUS;
    const y = HAND_Y + (i === focusedIndex ? 0.6 : 0);
    const scale = i === focusedIndex ? 1.08 : 1.0;
    const rotY = angle;

    const mesh = entry.mesh;
    
    if (animate) {
      // Basic fallback here. The GSAP animation will be added via animations.ts later or we just set it direct
      // For now we set directly since GSAP is for explicit actions, or we can use a quick tween.
      // Wait, we need gsap for this. But since it's just layout, setting directly or using simple lerp works.
      // We will set directly for now, until we wire GSAP.
      mesh.position.set(x, y, z);
      mesh.rotation.y = rotY;
      mesh.scale.set(scale, scale, scale);
    } else {
      mesh.position.set(x, y, z);
      mesh.rotation.y = rotY;
      mesh.scale.set(scale, scale, scale);
    }

    const border = mesh.children.find(c => c.userData.isBorder) as THREE.Mesh;
    if (border) {
      const mat = border.material as THREE.MeshBasicMaterial;
      if (i === focusedIndex) {
        mat.color.setHex(0x7dd3fc); // Cyan glow for keyboard focus
        mat.opacity = 1.0;
      } else {
        mat.opacity = 0.0; // Restored by raycaster if hovered
      }
    }
  });
}

export async function createActiveCard3D(battler: Battler, scene: THREE.Scene, placeholder: THREE.Texture): Promise<ActiveCard3D> {
  const mat = new THREE.MeshStandardMaterial({
    map: placeholder,
    roughness: 0.2,
    metalness: 0.1,
    transparent: true,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.6), mat);
  mesh.userData = { isPlayerActive: true };
  scene.add(mesh);

  // Load real texture immediately
  const url = battler.imageLarge || battler.imageSmall;
  if (url) {
    loadTextureAsync(url).then(tex => {
      if (tex) {
        mat.map = tex;
        mat.needsUpdate = true;
      }
    });
  }

  // HP Bar background
  const hpBarBg = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 })
  );
  hpBarBg.position.set(0, -1.4, 0.05);
  mesh.add(hpBarBg);

  // HP Bar fill
  const hpBar = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x7cf0c8 })
  );
  hpBar.position.set(0, -1.4, 0.06);
  mesh.add(hpBar);

  // Glow
  const glowGeo = new THREE.PlaneGeometry(1.8 + 0.1, 2.6 + 0.1);
  const glowMat = new THREE.MeshBasicMaterial({ color: getTypeColor(battler.type), transparent: true, opacity: 0 });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.z = -0.01;
  mesh.add(glow);

  const energyPips: THREE.Mesh[] = [];
  // Build energy pips (simple spheres)
  for (let i = 0; i < Math.max(battler.attackCost, battler.energy, 1); i++) {
    const pip = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 16, 16),
      new THREE.MeshStandardMaterial({ color: i < battler.energy ? 0x7cf0c8 : 0x444444 })
    );
    pip.position.set(-0.9, -1.0 + i * 0.2, 0.1);
    mesh.add(pip);
    energyPips.push(pip);
  }

  return { mesh, hpBar, hpBarBg, energyPips, glow, cardData: battler };
}

export function updateActiveCardHP(active: ActiveCard3D) {
  const ratio = Math.max(0, active.cardData.currentHp / active.cardData.hp);
  active.hpBar.scale.x = ratio;
  active.hpBar.position.x = -1.4 / 2 + (1.4 * ratio) / 2;
  
  const mat = active.hpBar.material as THREE.MeshBasicMaterial;
  if (ratio <= 0.25) mat.color.setHex(0xff7895);
  else if (ratio <= 0.55) mat.color.setHex(0xffd66c);
  else mat.color.setHex(0x7cf0c8);
}
