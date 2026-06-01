import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { BattleSceneController, CardMesh, ActiveCard3D } from './types';
import type { Card } from '../features/cards/types';
import type { Battler } from '../features/battle/types';
import { makePlaceholderTexture, progressiveLoad } from './textureLoader';
import { buildHandMeshes, layoutHand, createActiveCard3D, updateActiveCardHP, updateActiveCardTexture } from './sceneCards';
import { PLAYER_ACTIVE_POS, NPC_ACTIVE_POS, DECK_POS_PLAYER, DECK_POS_NPC, DISCARD_POS_PLAYER, DISCARD_POS_NPC } from './sceneCardLayout';
import { animateSummonCard, animateAttackMove, animateDamageReceive } from './animations';

export function buildBattleScene(
  mount: HTMLDivElement,
  callbacks: {
    onCardHover: (id: string | null) => void;
    onCardClick: (id: string) => void;
  }
): BattleSceneController {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x040c18, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x04101f, 8, 22);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 80);
  camera.position.set(0, 3, 7);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 3;
  controls.maxDistance = 14;
  controls.minPolarAngle = Math.PI * 0.15;
  controls.maxPolarAngle = Math.PI * 0.55;
  controls.target.set(0, 0.4, 0);

  // Lights
  scene.add(new THREE.AmbientLight(0x90c8ff, 0.5));

  const playerLight = new THREE.PointLight(0x38bdf8, 8, 25, 1.8);
  playerLight.position.set(-6, 5, -4);
  scene.add(playerLight);

  const npcLight = new THREE.PointLight(0xa855f7, 6, 25, 1.8);
  npcLight.position.set(6, 4, -4);
  scene.add(npcLight);

  const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
  rimLight.position.set(0, 8, 8);
  scene.add(rimLight);

  // Grid & Halo
  const grid = new THREE.GridHelper(20, 20, 0x1e40af, 0x0f2d5a);
  grid.position.y = -0.45;
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.35;
  scene.add(grid);

  const halo = new THREE.Mesh(
    new THREE.RingGeometry(3.5, 5.5, 96),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.08, side: THREE.DoubleSide })
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = -0.42;
  scene.add(halo);

  // Particles
  const pCount = 200;
  const pPos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    pPos[i*3] = (Math.random() - 0.5) * 30;
    pPos[i*3+1] = Math.random() * 10;
    pPos[i*3+2] = (Math.random() - 0.5) * 30;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const particles = new THREE.Points(
    pGeo,
    new THREE.PointsMaterial({ color: 0x93c5fd, size: 0.04, transparent: true, opacity: 0.5 })
  );
  scene.add(particles);

  let raf = 0;
  let isDisposed = false;
  const clock = new THREE.Clock();

  // Internal state for meshes
  let handMeshes: CardMesh[] = [];
  let playerActive3D: ActiveCard3D | null = null;
  let npcActive3D: ActiveCard3D | null = null;
  const placeholder = makePlaceholderTexture();
  const loadAbortController = new AbortController();

  // Draw Deck/Discard boxes
  const boxGeo = new THREE.BoxGeometry(1.5, 0.4, 2.1);
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x0f2d5a, roughness: 0.8 });
  const playerDeck = new THREE.Mesh(boxGeo, deckMat);
  playerDeck.position.set(DECK_POS_PLAYER.x, DECK_POS_PLAYER.y, DECK_POS_PLAYER.z);
  scene.add(playerDeck);
  
  const npcDeck = new THREE.Mesh(boxGeo, deckMat);
  npcDeck.position.set(DECK_POS_NPC.x, DECK_POS_NPC.y, DECK_POS_NPC.z);
  scene.add(npcDeck);

  // Raycasting
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let isDragging = false;
  let dragStartPos = { x: 0, y: 0 };
  let hoveredMesh: THREE.Mesh | null = null;
  let clickedMeshId: string | null = null;

  function getAllClickableMeshes() {
    return [
      ...handMeshes.map(m => m.mesh),
      playerActive3D?.mesh,
      npcActive3D?.mesh
    ].filter(Boolean) as THREE.Mesh[];
  }

  function onPointerDown(e: PointerEvent) {
    isDragging = false;
    dragStartPos = { x: e.clientX, y: e.clientY };
  }

  function onPointerMove(e: PointerEvent) {
    const dx = e.clientX - dragStartPos.x;
    const dy = e.clientY - dragStartPos.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) isDragging = true;
    if (isDragging) {
      if (hoveredMesh) {
        callbacks.onCardHover(null);
        hoveredMesh = null;
        mount.style.cursor = 'grab';
      }
      return;
    }

    const rect = mount.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const hits = raycaster.intersectObjects(getAllClickableMeshes());
    if (hits.length) {
      const hitMesh = hits[0].object as THREE.Mesh;
      if (hoveredMesh !== hitMesh) {
        hoveredMesh = hitMesh;
        const id = hitMesh.userData.cardId;
        if (id) callbacks.onCardHover(id);
      }
      mount.style.cursor = 'pointer';
    } else {
      if (hoveredMesh) {
        hoveredMesh = null;
        callbacks.onCardHover(null);
      }
      mount.style.cursor = 'grab';
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (isDragging) return;
    const rect = mount.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const hits = raycaster.intersectObjects(getAllClickableMeshes());
    if (hits.length) {
      const hitMesh = hits[0].object as THREE.Mesh;
      const id = hitMesh.userData.cardId;
      if (id) callbacks.onCardClick(id);
    }
  }

  mount.addEventListener('pointerdown', onPointerDown);
  mount.addEventListener('pointermove', onPointerMove);
  mount.addEventListener('pointerup', onPointerUp);

  function resize() {
    const w = mount.clientWidth || 1;
    const h = mount.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  resize();

  function animate() {
    if (isDisposed) return;
    raf = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    controls.update();

    particles.rotation.y = t * 0.02;
    (halo.material as THREE.MeshBasicMaterial).opacity = 0.08 + Math.sin(t * 1.5) * 0.02;
    playerLight.position.x = Math.sin(t * 0.4) * 8;
    npcLight.position.x = Math.cos(t * 0.3) * 8;

    renderer.render(scene, camera);
  }
  animate();

  return {
    resize,
    dispose() {
      isDisposed = true;
      loadAbortController.abort();
      cancelAnimationFrame(raf);
      controls.dispose();
      mount.removeEventListener('pointerdown', onPointerDown);
      mount.removeEventListener('pointermove', onPointerMove);
      mount.removeEventListener('pointerup', onPointerUp);
      renderer.dispose();
      pGeo.dispose();
      placeholder.dispose();
      mount.querySelector('canvas')?.remove();
    },
    setPlayerHand(cards: Card[], focusedIndex: number) {
      if (handMeshes.length !== cards.length || !handMeshes.every((m, i) => m.card.id === cards[i].id)) {
        handMeshes.forEach(m => scene.remove(m.mesh));
        handMeshes = buildHandMeshes(cards, scene, placeholder);
        progressiveLoad(handMeshes, placeholder, loadAbortController.signal);
      }
      layoutHand(handMeshes, focusedIndex, true);
    },
    setActiveCards(player: Battler | null, npc: Battler | null) {
      if (player && !playerActive3D) {
        createActiveCard3D(player, scene, placeholder).then(c => {
          playerActive3D = c;
          c.mesh.position.set(PLAYER_ACTIVE_POS.x, PLAYER_ACTIVE_POS.y, PLAYER_ACTIVE_POS.z);
          c.mesh.rotation.x = -Math.PI / 8; // Tilt back
          updateActiveCardHP(c);
        });
      } else if (player && playerActive3D) {
        if (playerActive3D.cardData.id !== player.id) {
          playerActive3D.cardData = player;
          updateActiveCardTexture(playerActive3D, placeholder);
        } else {
          playerActive3D.cardData = player;
        }
        updateActiveCardHP(playerActive3D);
      } else if (!player && playerActive3D) {
        scene.remove(playerActive3D.mesh);
        playerActive3D = null;
      }

      if (npc && !npcActive3D) {
        createActiveCard3D(npc, scene, placeholder).then(c => {
          npcActive3D = c;
          c.mesh.position.set(NPC_ACTIVE_POS.x, NPC_ACTIVE_POS.y, NPC_ACTIVE_POS.z);
          c.mesh.rotation.x = Math.PI / 8; // Tilt forward to face player
          c.mesh.rotation.y = Math.PI; // Spin around to face player
          updateActiveCardHP(c);
        });
      } else if (npc && npcActive3D) {
        if (npcActive3D.cardData.id !== npc.id) {
          npcActive3D.cardData = npc;
          updateActiveCardTexture(npcActive3D, placeholder);
        } else {
          npcActive3D.cardData = npc;
        }
        updateActiveCardHP(npcActive3D);
      } else if (!npc && npcActive3D) {
        scene.remove(npcActive3D.mesh);
        npcActive3D = null;
      }
    },
    setActionFocus(index: number) {
      if (!playerActive3D) return;
      const glowMat = playerActive3D.glow.material as THREE.MeshBasicMaterial;
      if (index === 1) { // 1 is attack
        glowMat.color.setHex(0xff3333); // Red glow for attack intent
        glowMat.opacity = 0.8;
      } else {
        glowMat.opacity = 0; // Hide glow
      }
    },
    async animateSummon(cardId: string) {
      const meshData = handMeshes.find(m => m.card.id === cardId);
      if (!meshData) return;
      
      // Remove it from hand Meshes conceptually, we animate it to active pos
      // Since react will sync active card later, this is a visual transition.
      await animateSummonCard(meshData.mesh, PLAYER_ACTIVE_POS, -Math.PI / 8, 0);
    },
    async animateAttack(attacker: 'player' | 'npc', damage: number, lethal: boolean) {
      const attacker3D = attacker === 'player' ? playerActive3D : npcActive3D;
      const defender3D = attacker === 'player' ? npcActive3D : playerActive3D;
      
      if (!attacker3D || !defender3D) return;
      
      const p1 = animateAttackMove(attacker3D.mesh, defender3D.mesh);
      const p2 = animateDamageReceive(defender3D.mesh, lethal);
      
      await Promise.all([p1, p2]);
    },
    async animateDamage(target: 'player' | 'npc', lethal: boolean) {
      const target3D = target === 'player' ? playerActive3D : npcActive3D;
      if (target3D) {
        await animateDamageReceive(target3D.mesh, lethal);
      }
    }
  };
}
