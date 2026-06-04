import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useBattleStore } from '../battle/store';
import { wrapAsCardCatalog } from '../catalog/catalogUtils';
import type { CatalogCard } from '../catalog/types';
import './myDeck.css';

const CARD_W = 1.4;
const CARD_H = 2.0;

function makePlaceholderTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 140; canvas.height = 200;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 200);
  grad.addColorStop(0, '#0d1b2e'); grad.addColorStop(1, '#0a2540');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 140, 200);
  ctx.strokeStyle = '#1e90ff44'; ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, 128, 188);
  ctx.font = 'bold 36px sans-serif';
  ctx.fillStyle = '#1e90ff66';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('✦', 70, 100);
  return new THREE.CanvasTexture(canvas);
}

const textureCache = new Map<string, THREE.Texture>();
const loader = new THREE.TextureLoader();
function loadTexture(url: string, cb: (t: THREE.Texture) => void) {
  if (textureCache.has(url)) { cb(textureCache.get(url)!); return; }
  loader.load(url, (t) => { textureCache.set(url, t); cb(t); });
}

type CardEntry = {
  group: THREE.Group;
  frontMesh: THREE.Mesh;
  card: CatalogCard;
  index: number;
};

export function MyDeckRoom({ onBack, onNext, onEditCard }: { onBack: () => void; onNext: () => void; onEditCard: (index: number) => void }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const catalog = useBattleStore((s) => s.catalog);
  const selectedDeck = useBattleStore((s) => s.selectedDeck);
  const customDecks = useBattleStore((s) => s.customDecks);

  const deckCardIds = selectedDeck && customDecks[selectedDeck] ? customDecks[selectedDeck] : [];

  const cards = useMemo(() => {
    return deckCardIds.map(id => {
      const c = catalog.find(card => card.id === id);
      return c ? wrapAsCardCatalog(c) : null;
    }).filter(Boolean) as CatalogCard[];
  }, [deckCardIds, catalog]);

  const [hoverCard, setHoverCard] = useState<CatalogCard | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || cards.length === 0) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x040c18, 1);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x040c18, 5, 15);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 2, 8);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.minDistance = 3;
    controls.maxDistance = 12;
    controls.minPolarAngle = Math.PI * 0.2;
    controls.maxPolarAngle = Math.PI * 0.6;
    controls.target.set(0, 0, 0);

    scene.add(new THREE.AmbientLight(0x90c8ff, 0.6));
    const pointLight = new THREE.PointLight(0x38bdf8, 5, 20);
    pointLight.position.set(0, 5, 2);
    scene.add(pointLight);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({ color: 0x030810, roughness: 0.8 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2;
    scene.add(floor);

    const cardGeo = new THREE.PlaneGeometry(CARD_W, CARD_H);
    const placeholderTex = makePlaceholderTexture();
    const radius = 3.5;

    const allEntries: CardEntry[] = [];
    const carouselGroup = new THREE.Group();
    scene.add(carouselGroup);

    cards.forEach((card, i) => {
      const angle = (i / cards.length) * Math.PI * 2;
      const group = new THREE.Group();

      // Posicionar en círculo
      group.position.x = Math.sin(angle) * radius;
      group.position.z = Math.cos(angle) * radius;

      // Orientar hacia afuera
      group.rotation.y = angle;

      const mat = new THREE.MeshStandardMaterial({
        map: placeholderTex, roughness: 0.2, metalness: 0.1, transparent: true, side: THREE.DoubleSide
      });

      const mesh = new THREE.Mesh(cardGeo, mat);
      group.add(mesh);
      carouselGroup.add(group);

      const entry = { group, frontMesh: mesh, card, index: i };
      allEntries.push(entry);

      if (card.imageLarge || card.imageSmall) {
        loadTexture(card.imageLarge || card.imageSmall, (t) => {
          mat.map = t;
          mat.needsUpdate = true;
        });
      }
    });

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hoveredEntry: CardEntry | null = null;

    function onMouseMove(e: MouseEvent) {
      const rect = mount!.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(allEntries.map(e => e.frontMesh));

      if (hits.length > 0) {
        const mesh = hits[0].object as THREE.Mesh;
        const entry = allEntries.find(e => e.frontMesh === mesh);
        if (entry && hoveredEntry !== entry) {
          if (hoveredEntry) hoveredEntry.group.position.y = 0;
          hoveredEntry = entry;
          entry.group.position.y = 0.5;
          setHoverCard(entry.card);
          mount!.style.cursor = 'pointer';
        }
      } else {
        if (hoveredEntry) {
          hoveredEntry.group.position.y = 0;
          hoveredEntry = null;
          setHoverCard(null);
          mount!.style.cursor = 'grab';
        }
      }
    }

    function onMouseClick(e: MouseEvent) {
      if (e.button !== 0) return;
      if (hoveredEntry) {
        onEditCard(hoveredEntry.index);
      }
    }

    mount.addEventListener('mousemove', onMouseMove);
    mount.addEventListener('click', onMouseClick);

    function resize() {
      const w = mount!.clientWidth || 1;
      const h = mount!.clientHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    resize();
    window.addEventListener('resize', resize);

    let rafId = 0;
    const clock = new THREE.Clock();

    // Rotación
    function animate() {
      rafId = requestAnimationFrame(animate);
      const dt = clock.getDelta();

      // Girar las cartas de forma predeterminada
      carouselGroup.rotation.y += dt * 0.1;

      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      mount.removeEventListener('mousemove', onMouseMove);
      mount.removeEventListener('click', onMouseClick);
      cancelAnimationFrame(rafId);

      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }

      allEntries.forEach(e => {
        e.frontMesh.geometry.dispose();
        const mat = e.frontMesh.material as THREE.Material;
        mat.dispose();
      });
    };
  }, [cards, onEditCard]);

  return (
    <div className="mydeck-root">
      <div className="mydeck-canvas" ref={mountRef} />

      <div className="mydeck-hud">
        <div className="mydeck-header">
          <button type="button" className="secondary-action compact-action" onClick={onBack}>
            ← Volver
          </button>
          <div className="mydeck-title-group">
            <h2>Mazo {selectedDeck}</h2>
            <p className="eyebrow">Visualiza y edita tus cartas</p>
          </div>
          <button type="button" className="primary-action compact-action" onClick={onNext}>
            Siguiente →
          </button>
        </div>

        <div className="mydeck-hint">
          Arrastra para girar · Click en una carta para cambiarla
        </div>

        {hoverCard && (
          <div className="mydeck-tooltip">
            <h3>{hoverCard.name}</h3>
            <p className="eyebrow">{hoverCard.type} · {hoverCard.hp} HP</p>
            {hoverCard.attackName && (
              <p className="mydeck-tooltip-attack">⚔ {hoverCard.attackName} ({hoverCard.attackDamage})</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
