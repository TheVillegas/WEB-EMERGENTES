/**
 * CatalogRoom – immersive 3D card gallery.
 * Cards are laid out on curved panels arranged in a 270° arc (like a rotunda).
 * The user orbits with drag / scroll, hovers cards to highlight them, and
 * clicks to open a details panel.  All Three.js; no React Three Fiber.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useBattleStore } from '../battle/store';
import { wrapAsCardCatalog } from './catalogUtils';
import type { CatalogCard } from './types';

// ─── Layout constants ──────────────────────────────────────────────────────
const CARD_W = 1.4;
const CARD_H = 2.0;
const GAP_X  = 0.22;
const GAP_Y  = 0.30;
const COLS   = 8;
const ROWS   = 6;
const PER_PANEL  = COLS * ROWS;          // 48 cards per panel
const ARC_RADIUS = 15;                   // panels sit at this radius
const ARC_SPAN   = (Math.PI * 3) / 2;   // 270 °

// Type colour palette keyed on card type
const TYPE_COLORS: Record<string, string> = {
  Fire: '#ff6b35', Water: '#4fc3f7', Grass: '#66bb6a',
  Lightning: '#ffe082', Psychic: '#ce93d8', Fighting: '#ff8a65',
  Colorless: '#b0bec5', Darkness: '#546e7a', Metal: '#90a4ae',
  Dragon: '#7e57c2', Fairy: '#f48fb1',
  Entrenador: '#5c6bc0', Energía: '#ffd54f',
};

function typeColor(card: CatalogCard): THREE.Color {
  const hex = TYPE_COLORS[card.type] ?? TYPE_COLORS['Colorless'];
  return new THREE.Color(hex);
}

// ─── Placeholder texture (card back) ──────────────────────────────────────
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

// Cache real textures to avoid re-fetching
const textureCache = new Map<string, THREE.Texture>();
const loader = new THREE.TextureLoader();
function loadTexture(url: string, cb: (t: any) => void) {
  if (textureCache.has(url)) { cb(textureCache.get(url)!); return; }
  loader.load(url, (t) => { textureCache.set(url, t); cb(t); });
}

// ─── Component ─────────────────────────────────────────────────────────────
export function CatalogRoom() {
  const mountRef  = useRef<HTMLDivElement>(null);
  const sceneRef  = useRef<ReturnType<typeof buildScene> | null>(null);
  const catalog   = useBattleStore((s) => s.catalog);

  const [searchQuery,  setSearchQuery]  = useState('');
  const [selectedCard, setSelectedCard] = useState<CatalogCard | null>(null);
  const [hoverCard,    setHoverCard]    = useState<string | null>(null);
  const [currentPanel, setCurrentPanel] = useState(0);

  const cards = useMemo(() => catalog.map(wrapAsCardCatalog), [catalog]);

  const numPanels = Math.ceil(cards.length / PER_PANEL);

  const panelLabels = useMemo(() => {
    const labels: string[] = [];
    for (let i = 0; i < cards.length; i += PER_PANEL) {
      const card = cards[i];
      const pIdx = Math.floor(i / PER_PANEL);
      labels.push(card.type === 'Pokémon' ? `Pokémon (P. ${pIdx + 1})` : card.type);
    }
    return labels;
  }, [cards]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return q ? cards.filter(c => c.name.toLowerCase().includes(q)) : cards;
  }, [cards, searchQuery]);

  // Build scene exactly ONCE for all cards
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || cards.length === 0) return;

    const ctx = buildScene(mount, cards,
      (card) => setSelectedCard(card),
      (id)   => setHoverCard(id),
      (idx)  => setCurrentPanel(idx)
    );
    sceneRef.current = ctx;
    return () => ctx.dispose();
  }, [cards]);

  // Filter cards instantly when search query changes
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.filterCards(searchQuery);
    }
  }, [searchQuery]);

  // Sync window resize
  useEffect(() => {
    const onResize = () => sceneRef.current?.resize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleGoToPanel = (idx: number) => {
    sceneRef.current?.goToPanel(idx);
    setCurrentPanel(idx);
  };

  const rootClass = `cr-root ${selectedCard ? 'cr-root--has-details' : ''} ${numPanels > 1 ? 'cr-root--has-pagination' : ''}`;

  return (
    <div className={rootClass}>
      {/* 3D canvas host */}
      <div ref={mountRef} className="cr-canvas" />

      {/* Left/Right Navigation Arrows */}
      {numPanels > 1 && (
        <>
          <button 
            className="cr-nav-arrow cr-nav-arrow--left"
            onClick={() => handleGoToPanel(currentPanel - 1)}
            disabled={currentPanel === 0}
            aria-label="Página anterior"
          >
            &#10094;
          </button>
          <button 
            className="cr-nav-arrow cr-nav-arrow--right"
            onClick={() => handleGoToPanel(currentPanel + 1)}
            disabled={currentPanel === numPanels - 1}
            aria-label="Página siguiente"
          >
            &#10095;
          </button>
        </>
      )}

      {/* Search overlay */}
      <div className="cr-search-bar">
        <span className="cr-search-bar__icon">🔍</span>
        <input
          id="cr-search"
          type="search"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Buscar carta…"
          autoComplete="off"
          aria-label="Buscar carta"
        />
        {searchQuery && (
          <button className="cr-search-bar__clear"
            onClick={() => setSearchQuery('')} aria-label="Limpiar">✕</button>
        )}
      </div>

      {/* Card count badge */}
      <div className="cr-badge">
        {filtered.length} carta{filtered.length !== 1 ? 's' : ''}
      </div>

      {/* Pagination Bottom Bar */}
      {numPanels > 1 && (
        <div className="cr-pagination">
          {panelLabels.map((label, idx) => (
            <button
              key={idx}
              className={`cr-pagination-pill ${currentPanel === idx ? 'cr-pagination-pill--active' : ''}`}
              onClick={() => handleGoToPanel(idx)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Navigation hint */}
      <div className="cr-hint">Arrastra para girar · Scroll para acercar · Click para detalles</div>

      {/* Details panel */}
      {selectedCard && (
        <aside className="cr-details" role="complementary" aria-label="Detalles de la carta">
          <button className="cr-details__close"
            onClick={() => setSelectedCard(null)}
            aria-label="Cerrar detalles">✕</button>

          <div className="cr-details__img-wrap">
            <img
              src={selectedCard.imageLarge || selectedCard.imageSmall}
              alt={selectedCard.name}
              className="cr-details__img"
            />
          </div>

          <div className="cr-details__body">
            <p className="cr-details__category">{selectedCard.type}</p>
            <h2 className="cr-details__name">{selectedCard.name}</h2>
            {selectedCard.hp ? (
              <p className="cr-details__hp">{selectedCard.hp} HP</p>
            ) : null}

            {selectedCard.attackName && (
              <div className="cr-details__attack">
                <span className="cr-details__attack-name">{selectedCard.attackName}</span>
                <span className="cr-details__attack-dmg">
                  {selectedCard.attackDamage ? `${selectedCard.attackDamage} dmg` : ''}
                </span>
                {selectedCard.attackCost ? (
                  <span className="cr-details__attack-cost">Costo {selectedCard.attackCost}</span>
                ) : null}
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Hover tooltip */}
      {hoverCard && !selectedCard && (
        <div className="cr-tooltip">{hoverCard}</div>
      )}
    </div>
  );
}

// ─── Three.js scene builder ────────────────────────────────────────────────
function buildScene(
  mount: HTMLDivElement,
  cards: CatalogCard[],
  onSelect: (c: CatalogCard) => void,
  onHover:  (name: string | null) => void,
  onPanelChange: (idx: number) => void,
) {
  const placeholder = makePlaceholderTexture();

  // --- Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x040c18, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  mount.appendChild(renderer.domElement);

  // --- Scene
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x040c18, 18, 40);

  // --- Camera
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 80);
  camera.position.set(0, 2, 0);

  // --- Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 2;
  controls.maxDistance = 18;
  controls.minPolarAngle = Math.PI * 0.28;
  controls.maxPolarAngle = Math.PI * 0.72;
  controls.target.set(0, 1.5, 0);

  // --- Lighting
  scene.add(new THREE.AmbientLight(0x90c8ff, 0.6));

  const blueKey = new THREE.PointLight(0x38bdf8, 8, 25, 1.8);
  blueKey.position.set(-6, 5, -4); scene.add(blueKey);
  const purpleKey = new THREE.PointLight(0xa855f7, 6, 25, 1.8);
  purpleKey.position.set(6, 4, -4); scene.add(purpleKey);
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
  rimLight.position.set(0, 8, 8); scene.add(rimLight);

  // --- Floor grid
  const grid = new THREE.GridHelper(50, 50, 0x1e40af, 0x0f2d5a);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.35;
  grid.position.y = -1.5;
  scene.add(grid);

  const floorGeo  = new THREE.CircleGeometry(24, 64);
  const floorMat  = new THREE.MeshStandardMaterial({
    color: 0x030810, roughness: 0.9, metalness: 0.2,
    transparent: true, opacity: 0.85,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.51;
  scene.add(floor);

  // Ambient halo ring on floor
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(5, 7, 96),
    new THREE.MeshBasicMaterial({ color: 0x1e40af, transparent: true, opacity: 0.12, side: THREE.DoubleSide }),
  );
  halo.rotation.x = -Math.PI / 2; halo.position.y = -1.49;
  scene.add(halo);

  // Particles
  const pCount = 300;
  const pPos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    pPos[i*3]   = (Math.random() - 0.5) * 40;
    pPos[i*3+1] = Math.random() * 14;
    pPos[i*3+2] = (Math.random() - 0.5) * 40;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const particles = new THREE.Points(pGeo,
    new THREE.PointsMaterial({ color: 0x93c5fd, size: 0.045, transparent: true, opacity: 0.6 }));
  scene.add(particles);

  // --- Card meshes
  const cardGeo = new THREE.PlaneGeometry(CARD_W, CARD_H);
  const cardMeshes: Array<{ mesh: THREE.Mesh; card: CatalogCard; baseColor: THREE.Color }> = [];
  const numPanels = Math.ceil(cards.length / PER_PANEL);

  cards.forEach((card, i) => {
    const panelIdx = Math.floor(i / PER_PANEL);
    const slotIdx  = i % PER_PANEL;
    const col      = slotIdx % COLS;
    const row      = Math.floor(slotIdx / COLS);

    // Angle of this panel in the arc
    const t     = numPanels === 1 ? 0.5 : panelIdx / (numPanels - 1);
    const angle = -ARC_SPAN / 2 + t * ARC_SPAN;  // centered at 0 (facing user)

    // Panel centre on the arc
    const px = Math.sin(angle) * ARC_RADIUS;
    const pz = -Math.cos(angle) * ARC_RADIUS;

    // Slot offset within the panel
    const localX = (col - (COLS - 1) / 2) * (CARD_W + GAP_X);
    const localY = (row - (ROWS - 1) / 2) * (CARD_H + GAP_Y) + 2.0;

    // Rotate slot into panel orientation (tangent to arc)
    const cos = Math.cos(angle); const sin = Math.sin(angle);
    const wx  = px + localX * cos;
    const wz  = pz - localX * sin;

    const mat = new THREE.MeshStandardMaterial({
      map: placeholder,
      roughness: 0.25, metalness: 0.1,
      transparent: true, opacity: 1,
    });

    const mesh = new THREE.Mesh(cardGeo, mat);
    mesh.position.set(wx, localY, wz);
    mesh.rotation.y = angle; // face inward (toward origin)
    mesh.userData = { cardId: card.id };
    scene.add(mesh);

    const base = typeColor(card);
    cardMeshes.push({ mesh, card, baseColor: base.clone() });

    // Glow border
    const borderGeo = new THREE.PlaneGeometry(CARD_W + 0.07, CARD_H + 0.07);
    const borderMat = new THREE.MeshBasicMaterial({
      color: base, transparent: true, opacity: 0.0, side: THREE.DoubleSide,
    });
    const border = new THREE.Mesh(borderGeo, borderMat);
    border.position.set(wx, localY, wz);
    border.rotation.y = angle;
    border.position.x += Math.sin(angle) * -0.01;
    border.position.z += -Math.cos(angle) * -0.01;
    border.userData = { isBorder: true };
    scene.add(border);
    mesh.userData.border = border;

    // Load real texture lazily on hover
    mesh.userData.loadTexture = () => {
      const url = card.imageSmall;
      if (!url) return;
      loadTexture(url, (t) => { mat.map = t; mat.needsUpdate = true; });
    };

    // Category label above first card of each panel
    if (slotIdx === 0) {
      const panelW  = COLS * (CARD_W + GAP_X);
      const labelGeo   = new THREE.PlaneGeometry(panelW * 0.6, 0.55);
      const labelCanvas = document.createElement('canvas');
      labelCanvas.width  = 256; labelCanvas.height = 64;
      const lctx = labelCanvas.getContext('2d')!;
      lctx.fillStyle = '#00000088';
      lctx.roundRect(4, 4, 248, 56, 10);
      lctx.fill();
      lctx.font = 'bold 28px sans-serif';
      lctx.fillStyle = '#7dd3fc';
      lctx.textAlign = 'center'; lctx.textBaseline = 'middle';
      const label = card.type === 'Pokémon' ? `Pokémon · Parte ${panelIdx + 1}` : card.type;
      lctx.fillText(label, 128, 32);
      const labelTex = new THREE.CanvasTexture(labelCanvas);
      const labelMat = new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, side: THREE.DoubleSide });
      const labelMesh = new THREE.Mesh(labelGeo, labelMat);
      const topY = localY + (ROWS / 2) * (CARD_H + GAP_Y) + 0.5;
      labelMesh.position.set(px, topY, pz);
      labelMesh.rotation.y = angle;
      scene.add(labelMesh);
    }
  });

  // --- Raycasting
  const raycaster = new THREE.Raycaster();
  const mouse     = new THREE.Vector2();
  let   hoveredMesh: THREE.Mesh | null = null;
  let   selectedMesh: THREE.Mesh | null = null;

  function getCardMeshes() { return cardMeshes.map(c => c.mesh); }

  function setBorderOpacity(mesh: THREE.Mesh, opacity: number) {
    const border = mesh.userData.border as THREE.Mesh | undefined;
    if (border) {
      (border.material as THREE.MeshBasicMaterial).opacity = opacity;
    }
  }

  function setHoverState(mesh: THREE.Mesh | null) {
    if (mesh === hoveredMesh) return;

    if (hoveredMesh) {
      const entry = cardMeshes.find(c => c.mesh === hoveredMesh);
      if (entry && hoveredMesh !== selectedMesh) {
        hoveredMesh.scale.set(1, 1, 1);
        setBorderOpacity(hoveredMesh, 0);
      }
      onHover(null);
    }

    hoveredMesh = mesh;
    if (mesh) {
      mesh.scale.set(1.06, 1.06, 1.06);
      setBorderOpacity(mesh, 0.7);
      const entry = cardMeshes.find(c => c.mesh === mesh);
      if (entry) { onHover(entry.card.name); mesh.userData.loadTexture?.(); }
    }
  }

  function onMouseMove(e: MouseEvent) {
    const rect = mount.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(getCardMeshes());
    setHoverState(hits.length ? (hits[0].object as THREE.Mesh) : null);
    mount.style.cursor = hits.length ? 'pointer' : 'grab';
  }

  function onMouseClick(e: MouseEvent) {
    if (e.button !== 0) return;
    const rect = mount.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(getCardMeshes());
    if (hits.length) {
      const mesh  = hits[0].object as THREE.Mesh;
      const entry = cardMeshes.find(c => c.mesh === mesh);
      if (entry) {
        // Deselect old
        if (selectedMesh && selectedMesh !== mesh) {
          selectedMesh.scale.set(1, 1, 1);
          setBorderOpacity(selectedMesh, 0);
        }
        selectedMesh = mesh;
        mesh.scale.set(1.12, 1.12, 1.12);
        // Load hi-res texture
        const url = entry.card.imageLarge || entry.card.imageSmall;
        if (url) loadTexture(url, (t) => {
          (mesh.material as THREE.MeshStandardMaterial).map = t;
          (mesh.material as THREE.MeshStandardMaterial).needsUpdate = true;
        });
        onSelect(entry.card);
      }
    } else {
      if (selectedMesh) {
        selectedMesh.scale.set(1, 1, 1);
        setBorderOpacity(selectedMesh, 0);
        selectedMesh = null;
      }
      onSelect(null as unknown as CatalogCard);
    }
  }

  mount.addEventListener('mousemove', onMouseMove);
  mount.addEventListener('click',     onMouseClick);

  // --- Auto Navigation Animation
  let isAnimating = false;
  let animTargetTheta = 0;
  let animTargetPhi = 0;
  let animTargetRadius = 0;
  let lastReportedPanelIdx = -1;

  controls.addEventListener('start', () => {
    isAnimating = false;
  });

  // --- Resize
  let raf = 0;
  function resize() {
    const w = mount.clientWidth || 1;
    const h = mount.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  resize();

  // --- Animate
  const clock = new THREE.Clock();
  function animate() {
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const t = clock.getElapsedTime();

      // Handle camera auto-navigation interpolation
      if (isAnimating) {
        const offset = new THREE.Vector3().copy(camera.position).sub(controls.target);
        const spherical = new THREE.Spherical().setFromVector3(offset);

        let thetaDiff = animTargetTheta - spherical.theta;
        thetaDiff = Math.atan2(Math.sin(thetaDiff), Math.cos(thetaDiff)); // normalize to [-PI, PI]
        
        spherical.theta += thetaDiff * 0.08;
        spherical.phi += (animTargetPhi - spherical.phi) * 0.08;
        spherical.radius += (animTargetRadius - spherical.radius) * 0.08;
        
        offset.setFromSpherical(spherical);
        camera.position.copy(controls.target).add(offset);
        camera.lookAt(controls.target);

        if (Math.abs(thetaDiff) < 0.001 &&
            Math.abs(animTargetPhi - spherical.phi) < 0.001 &&
            Math.abs(animTargetRadius - spherical.radius) < 0.001) {
          isAnimating = false;
        }
      }

      controls.update();

      // Detect closest panel for pagination feedback
      const currentSpherical = new THREE.Spherical().setFromVector3(
        new THREE.Vector3().copy(camera.position).sub(controls.target)
      );
      let closestIdx = 0;
      let minDiff = Infinity;
      for (let idx = 0; idx < numPanels; idx++) {
        const pt = numPanels === 1 ? 0.5 : idx / (numPanels - 1);
        const angle = -ARC_SPAN / 2 + pt * ARC_SPAN;
        let diff = Math.abs(Math.atan2(Math.sin(angle - (-currentSpherical.theta)), Math.cos(angle - (-currentSpherical.theta))));
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = idx;
        }
      }
      if (closestIdx !== lastReportedPanelIdx) {
        lastReportedPanelIdx = closestIdx;
        onPanelChange(closestIdx);
      }

      particles.rotation.y = t * 0.018;
      (halo.material as THREE.MeshBasicMaterial).opacity = 0.10 + Math.sin(t * 1.1) * 0.03;
      blueKey.position.x   = Math.sin(t * 0.4) * 8;
      purpleKey.position.x = Math.cos(t * 0.3) * 8;
      renderer.render(scene, camera);
    };
    loop();
  }
  animate();

  // --- Progressive Texture Loader
  let isDisposed = false;
  
  const loadTextureAsync = (url: string) => new Promise<THREE.Texture | null>((resolve) => {
    if (textureCache.has(url)) {
      resolve(textureCache.get(url)!);
    } else {
      loader.load(
        url,
        (t) => { textureCache.set(url, t); resolve(t); },
        undefined,
        () => resolve(null)
      );
    }
  });

  const progressiveLoad = async () => {
    // Wait a brief moment to prioritize initial scene render and user interaction
    await new Promise(r => setTimeout(r, 1000));
    
    const toLoad = [...cardMeshes];
    const chunkSize = 4;
    
    for (let i = 0; i < toLoad.length; i += chunkSize) {
      if (isDisposed) break;
      const chunk = toLoad.slice(i, i + chunkSize);
      
      await Promise.all(chunk.map(async (entry) => {
        const url = entry.card.imageSmall;
        if (!url) return;
        
        const mat = entry.mesh.material as THREE.MeshStandardMaterial;
        // If already loaded by hover (not using placeholder anymore), skip
        if (mat.map !== placeholder) return;
        
        const tex = await loadTextureAsync(url);
        if (tex && !isDisposed && mat.map === placeholder) {
          mat.map = tex;
          mat.needsUpdate = true;
        }
      }));
      
      // Yield to main thread / network
      await new Promise(r => setTimeout(r, 100));
    }
  };

  progressiveLoad();

  return {
    resize,
    goToPanel: (panelIdx: number) => {
      const pt = numPanels === 1 ? 0.5 : panelIdx / (numPanels - 1);
      const panelAngle = -ARC_SPAN / 2 + pt * ARC_SPAN;
      animTargetTheta = -panelAngle;
      animTargetPhi = Math.PI * 0.46;
      animTargetRadius = 11;
      isAnimating = true;
    },
    filterCards: (query: string) => {
      const q = query.trim().toLowerCase();
      cardMeshes.forEach(({ mesh, card }) => {
        const matches = !q || card.name.toLowerCase().includes(q);
        mesh.visible = matches;
        const border = mesh.userData.border as THREE.Mesh | undefined;
        if (border) {
          border.visible = matches;
        }
      });
    },
    dispose() {
      isDisposed = true;
      cancelAnimationFrame(raf);
      mount.removeEventListener('mousemove', onMouseMove);
      mount.removeEventListener('click',     onMouseClick);
      controls.dispose();
      pGeo.dispose();
      cardGeo.dispose();
      placeholder.dispose();
      renderer.dispose();
      mount.querySelector('canvas')?.remove();
    },
  };
}
