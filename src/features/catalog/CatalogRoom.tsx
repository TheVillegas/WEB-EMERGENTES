import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useBattleStore } from '../battle/store';
import { wrapAsCardCatalog } from './catalogUtils';
import type { CatalogCard } from './types';

// ─── Layout constants ──────────────────────────────────────────────────────
const CARD_W = 1.4;
const CARD_H = 2.0;
const GAP_X = 0.22;
const GAP_Y = 0.30;
const COLS = 8;
const ROWS = 6;
const PER_PANEL = COLS * ROWS;          // 48 cards per panel

// Type colour palette keyed on card type
const TYPE_COLORS: Record<string, string> = {
  Fire: '#ff6b35', Water: '#4fc3f7', Grass: '#66bb6a',
  Lightning: '#ffe082', Psychic: '#ce93d8', Fighting: '#ff8a65',
  Colorless: '#b0bec5', Darkness: '#546e7a', Metal: '#90a4ae',
  Dragon: '#7e57c2', Fairy: '#f48fb1',
  Entrenador: '#5c6bc0', Energía: '#ffd54f',
};

const TYPE_ORDER = [
  'Grass', 'Fire', 'Water', 'Lightning', 'Psychic',
  'Fighting', 'Dark', 'Metal', 'Colorless', 'Dragon',
] as const;

function typeColor(type: string): THREE.Color {
  const hex = TYPE_COLORS[type] ?? TYPE_COLORS['Colorless'];
  return new THREE.Color(hex);
}

function groupByType(cards: CatalogCard[]): Array<{ type: string; cards: CatalogCard[] }> {
  const buckets = new Map<string, CatalogCard[]>();
  for (const t of TYPE_ORDER) buckets.set(t, []);
  for (const card of cards) {
    let t = card.type;
    if (t === 'Darkness') t = 'Dark';
    if (!buckets.has(t)) t = 'Colorless';
    buckets.get(t)!.push(card);
  }
  return TYPE_ORDER.map(type => ({ type, cards: buckets.get(type)! }));
}

// ─── Textures ─────────────────────────────────────────────────────────────
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

function makeBackTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 280; c.height = 400;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(140, 200, 20, 140, 200, 220);
  g.addColorStop(0, '#1a0533');
  g.addColorStop(1, '#080112');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 280, 400);
  ctx.strokeStyle = '#7c3aed88'; ctx.lineWidth = 5;
  ctx.strokeRect(8, 8, 264, 384);
  ctx.strokeStyle = '#a855f744'; ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, 248, 368);
  ctx.font = 'bold 64px sans-serif'; ctx.fillStyle = '#7c3aed99';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('✦', 140, 180);
  ctx.font = 'bold 18px sans-serif'; ctx.fillStyle = '#a855f766';
  ctx.fillText('POKÉMON TCG', 140, 250);
  return new THREE.CanvasTexture(c);
}

// Cache real textures to avoid re-fetching
const textureCache = new Map<string, THREE.Texture>();
const loader = new THREE.TextureLoader();
function loadTexture(url: string, cb: (t: any) => void) {
  if (textureCache.has(url)) { cb(textureCache.get(url)!); return; }
  loader.load(url, (t) => { textureCache.set(url, t); cb(t); });
}

type CardEntry = {
  group: THREE.Group;
  frontMesh: THREE.Mesh;
  card: CatalogCard;
  baseAngle: number;
  basePosition: THREE.Vector3;
  flipping: boolean;
  flipProgress: number;
};

// ─── Component ─────────────────────────────────────────────────────────────
export function CatalogRoom({ onGoToDeck }: { onGoToDeck?: () => void }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ReturnType<typeof buildScene> | null>(null);
  const catalog = useBattleStore((s) => s.catalog);

  // Uncomment the following when you implement real Add to Deck state management logic.
  // const addToDeck = useBattleStore((s) => s.addToDeck);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCard, setSelectedCard] = useState<CatalogCard | null>(null);
  const [hoverCard, setHoverCard] = useState<string | null>(null);
  const [currentPanel, setCurrentPanel] = useState(0);

  const [panelCards, setPanelCards] = useState<CatalogCard[]>([]);
  const [panelCardIdx, setPanelCardIdx] = useState(0);
  const [addedFeedback, setAddedFeedback] = useState(false);

  const cards = useMemo(() => catalog.map(wrapAsCardCatalog), [catalog]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return q ? cards.filter(c => c.name.toLowerCase().includes(q)) : cards;
  }, [cards, searchQuery]);

  const panelGroups = useMemo(() => {
    return groupByType(filtered).filter(g => g.cards.length > 0);
  }, [filtered]);

  const panelLabels = useMemo(() => panelGroups.map(g => g.type), [panelGroups]);

  // Construcción de la escena con todos los paneles
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || panelGroups.length === 0) return;

    const ctx = buildScene(mount, panelGroups,
      (card, list, idx) => {
        setSelectedCard(card);
        setPanelCards(list);
        setPanelCardIdx(idx);
      },
      (id) => setHoverCard(id),
      (idx) => setCurrentPanel(idx)
    );
    sceneRef.current = ctx;
    return () => ctx.dispose();
  }, [panelGroups]);

  // Filtro de cartas en la búsqueda
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

  function handlePrev() {
    if (!panelCards.length) return;
    const idx = (panelCardIdx - 1 + panelCards.length) % panelCards.length;
    setPanelCardIdx(idx);
    setSelectedCard(panelCards[idx]);
  }

  function handleNext() {
    if (!panelCards.length) return;
    const idx = (panelCardIdx + 1) % panelCards.length;
    setPanelCardIdx(idx);
    setSelectedCard(panelCards[idx]);
  }

  function handleAddToDeck() {
    if (!selectedCard) return;

    // Uncomment the following when you implement real Add to Deck state management logic.
    // addToDeck(selectedCard);

    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1800);
  }

  const rootClass = `cr-root ${selectedCard ? 'cr-root--has-details' : ''} ${panelGroups.length > 1 ? 'cr-root--has-pagination' : ''}`;

  return (
    <div className={rootClass}>
      {/* 3D canvas */}
      <div ref={mountRef} className="cr-canvas" />

      {/* Flechas de navegación izquierda/derecha */}
      {panelGroups.length > 1 && (
        <>
          <button
            className="cr-nav-arrow cr-nav-arrow--left"
            onClick={() => handleGoToPanel((currentPanel - 1 + panelGroups.length) % panelGroups.length)}
            aria-label="Panel anterior"
          >
            &#10094;
          </button>
          <button
            className="cr-nav-arrow cr-nav-arrow--right"
            onClick={() => handleGoToPanel((currentPanel + 1) % panelGroups.length)}
            aria-label="Panel siguiente"
          >
            &#10095;
          </button>
        </>
      )}

      {/* Barra de búsqueda */}
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

      {/* Contenedor de información de cartas */}
      <div className="cr-badge">
        {filtered.length} carta{filtered.length !== 1 ? 's' : ''}
      </div>

      {/* Barra de paginación inferior */}
      {panelGroups.length > 1 && (
        <div className="cr-pagination">
          {panelLabels.map((label, idx) => (
            <button
              key={idx}
              className={`cr-pagination-pill ${currentPanel === idx ? 'cr-pagination-pill--active' : ''}`}
              onClick={() => handleGoToPanel(idx)}
              style={{ borderLeftColor: TYPE_COLORS[label] || TYPE_COLORS['Colorless'], borderLeftWidth: currentPanel === idx ? 0 : 4, borderLeftStyle: currentPanel === idx ? 'none' : 'solid' }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Indicador de navegación */}
      <div className="cr-hint">Arrastra para girar · Scroll para acercar · Click para detalles</div>

      {/* Panel de detalles */}
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
                <div className="cr-details__attack-header">
                  <span className="cr-details__attack-name">{selectedCard.attackName}</span>
                  <span className="cr-details__attack-dmg">
                    {selectedCard.attackDamage ? `${selectedCard.attackDamage} dmg` : ''}
                  </span>
                </div>
                {selectedCard.attackCost ? (
                  <span className="cr-details__attack-cost">Costo {selectedCard.attackCost}</span>
                ) : null}
                {(selectedCard as any).attack1Effect && (
                  <p className="cr-details__description">
                    {(selectedCard as any).attack1Effect}
                  </p>
                )}
              </div>
            )}

            <div className="cr-details__actions-container">
              {panelCards.length > 1 && (
                <div className="cr-details__nav" aria-label="Navegar entre cartas">
                  <button className="cr-details__nav-btn" onClick={handlePrev} aria-label="Carta anterior">◀</button>
                  <span className="cr-details__nav-counter">{panelCardIdx + 1} / {panelCards.length}</span>
                  <button className="cr-details__nav-btn" onClick={handleNext} aria-label="Carta siguiente">▶</button>
                </div>
              )}

              <div className="cr-details__actions">
                <button
                  className={`cr-details__add${addedFeedback ? ' cr-details__add--done' : ''}`}
                  onClick={handleAddToDeck}
                  aria-label="Agregar carta al mazo"
                >
                  {addedFeedback ? '✓ Agregada' : '+ Agregar al Mazo'}
                </button>
                <button
                  className="cr-details__goTo"
                  onClick={() => onGoToDeck?.()}
                  aria-label="Ir al Mazo"
                >
                  🗂 Ir al Mazo
                </button>
              </div>
            </div>
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
  panelGroups: Array<{ type: string; cards: CatalogCard[] }>,
  onSelect: (c: CatalogCard, list: CatalogCard[], idx: number) => void,
  onHover: (name: string | null) => void,
  onPanelChange: (idx: number) => void,
) {
  const placeholderTex = makePlaceholderTexture();
  const backTex = makeBackTexture();
  const cardFrontGeo = new THREE.PlaneGeometry(CARD_W, CARD_H);
  const cardBackGeo = new THREE.PlaneGeometry(CARD_W, CARD_H);

  const NUM_PANELS = panelGroups.length;
  // Calculo dinámico del radio en base al número de paneles
  const ARC_RADIUS = Math.max(15, (NUM_PANELS * 14) / (2 * Math.PI));

  // --- Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x040c18, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  mount.appendChild(renderer.domElement);

  // --- Scene
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x040c18, ARC_RADIUS * 0.8, ARC_RADIUS * 2.5);

  // --- Camera
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, ARC_RADIUS * 3);
  camera.position.set(0, 2, 0);

  // --- Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 2;
  controls.maxDistance = ARC_RADIUS - 1; // Previene no atravesar los paneles
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
  const grid = new THREE.GridHelper(ARC_RADIUS * 3, Math.floor(ARC_RADIUS * 3), 0x1e40af, 0x0f2d5a);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.35;
  grid.position.y = -1.5;
  scene.add(grid);

  const floorGeo = new THREE.CircleGeometry(ARC_RADIUS * 1.5, 64);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x030810, roughness: 0.9, metalness: 0.2,
    transparent: true, opacity: 0.85,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.51;
  scene.add(floor);

  // Ambient halo ring on floor
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(ARC_RADIUS * 0.3, ARC_RADIUS * 0.5, 96),
    new THREE.MeshBasicMaterial({ color: 0x1e40af, transparent: true, opacity: 0.12, side: THREE.DoubleSide }),
  );
  halo.rotation.x = -Math.PI / 2; halo.position.y = -1.49;
  scene.add(halo);

  // Particles
  const pCount = 300;
  const pPos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    pPos[i * 3] = (Math.random() - 0.5) * (ARC_RADIUS * 2.5);
    pPos[i * 3 + 1] = Math.random() * 14;
    pPos[i * 3 + 2] = (Math.random() - 0.5) * (ARC_RADIUS * 2.5);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const particles = new THREE.Points(pGeo,
    new THREE.PointsMaterial({ color: 0x93c5fd, size: 0.045, transparent: true, opacity: 0.6 }));
  scene.add(particles);

  // --- Construcción de paneles
  const allEntries: CardEntry[] = [];
  const panelPivots: THREE.Group[] = [];
  const cardPanelMap = new Map<string, { list: CatalogCard[]; idx: number }>();

  function disposePivot(pivotGroup: THREE.Group) {
    pivotGroup.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (obj.geometry !== cardFrontGeo && obj.geometry !== cardBackGeo) {
        obj.geometry.dispose();
      }
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of mats as THREE.Material[]) {
        if ((mat as any).map && (mat as any).map !== placeholderTex && (mat as any).map !== backTex) {
          (mat as any).map.dispose();
        }
        mat.dispose();
      }
    });
  }

  // Flip de cartas en 360° al seleccionar la carta en el panel
  function startFlip(entry: CardEntry) {
    if (entry.flipping) return;
    entry.flipping = true;
    entry.flipProgress = 0;
    const url = entry.card.imageLarge || entry.card.imageSmall;
    if (url) {
      loadTexture(url, (t) => {
        (entry.frontMesh.material as THREE.MeshStandardMaterial).map = t;
        (entry.frontMesh.material as THREE.MeshStandardMaterial).needsUpdate = true;
      });
    }
  }

  function resetFlip(entry: CardEntry) {
    entry.flipping = false;
    entry.flipProgress = 0;
    entry.group.rotation.y = entry.baseAngle;
    entry.group.scale.set(1, 1, 1);
    entry.group.position.copy(entry.basePosition);
  }

  panelGroups.forEach((panelGroup, i) => {
    const angle = (i / NUM_PANELS) * Math.PI * 2;
    const pivot = new THREE.Group();
    pivot.rotation.y = angle;

    const panelWidth = COLS * (CARD_W + GAP_X) - GAP_X;
    const panelHeight = ROWS * (CARD_H + GAP_Y) - GAP_Y;

    // Ajustar la altura del panel para evitar que colisione con el suelo
    const FLOOR_Y = -1.5;
    const FLOOR_CLEARANCE = 1.0; // Distancia desde el suelo
    const panelCenterY = FLOOR_Y + FLOOR_CLEARANCE + panelHeight / 2;

    // Backing
    const backingGeo = new THREE.PlaneGeometry(panelWidth + 0.6, panelHeight + 0.8);
    const backingMat = new THREE.MeshBasicMaterial({
      color: 0x0a1628, transparent: true, opacity: 0.6, side: THREE.FrontSide,
    });
    const backing = new THREE.Mesh(backingGeo, backingMat);
    backing.position.set(0, panelCenterY, -ARC_RADIUS - 0.03);
    pivot.add(backing);

    // Border
    const typeHex = TYPE_COLORS[panelGroup.type] ?? TYPE_COLORS['Colorless'];
    const borderGeo = new THREE.PlaneGeometry(panelWidth + 0.7, panelHeight + 0.9);
    const borderMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(typeHex), transparent: true, opacity: 0.12, side: THREE.BackSide,
    });
    const borderMesh = new THREE.Mesh(borderGeo, borderMat);
    borderMesh.position.set(0, panelCenterY, -ARC_RADIUS - 0.04);
    pivot.add(borderMesh);

    // Label
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 256; labelCanvas.height = 64;
    const lctx = labelCanvas.getContext('2d')!;
    lctx.fillStyle = '#000000aa';
    lctx.roundRect(4, 4, 248, 56, 12);
    lctx.fill();
    lctx.font = 'bold 26px sans-serif';
    lctx.fillStyle = typeHex;
    lctx.textAlign = 'center'; lctx.textBaseline = 'middle';
    lctx.fillText(panelGroup.type, 128, 32);
    const labelTex = new THREE.CanvasTexture(labelCanvas);
    const labelMat = new THREE.MeshBasicMaterial({ map: labelTex, transparent: true });
    const labelGeo = new THREE.PlaneGeometry(panelWidth * 0.5, 0.5);
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    const panelTopY = panelCenterY + panelHeight / 2;
    labelMesh.position.set(0, panelTopY + CARD_H / 2 + 0.35, -ARC_RADIUS);
    pivot.add(labelMesh);

    const panelCardList = panelGroup.cards.slice(0, PER_PANEL);

    panelCardList.forEach((card, slotIdx) => {
      cardPanelMap.set(card.id, { list: panelCardList, idx: slotIdx });

      const col = slotIdx % COLS;
      const row = Math.floor(slotIdx / COLS);

      // Invertir el orden de las filas para que row=0 empiece arriba
      const rowFromTop = (ROWS - 1) - row;

      const localX = (col - (COLS - 1) / 2) * (CARD_W + GAP_X);
      const localY = FLOOR_Y + FLOOR_CLEARANCE + CARD_H / 2 + rowFromTop * (CARD_H + GAP_Y);

      const cardGroup = new THREE.Group();
      cardGroup.position.set(localX, localY, -ARC_RADIUS);

      const frontMat = new THREE.MeshStandardMaterial({
        map: placeholderTex, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 1
      });
      const frontMesh = new THREE.Mesh(cardFrontGeo, frontMat);
      frontMesh.userData = { isCard: true, cardId: card.id };
      cardGroup.add(frontMesh);

      const backMat = new THREE.MeshStandardMaterial({
        map: backTex, roughness: 0.4, metalness: 0.1
      });
      const backMesh = new THREE.Mesh(cardBackGeo, backMat);
      backMesh.rotation.y = Math.PI;
      cardGroup.add(backMesh);

      pivot.add(cardGroup);

      const basePos = cardGroup.position.clone();
      const entry: CardEntry = {
        group: cardGroup, frontMesh, card,
        baseAngle: 0, basePosition: basePos,
        flipping: false, flipProgress: 0
      };
      allEntries.push(entry);

      frontMesh.userData.entry = entry;

      // Glow border for hover
      const hoverBorderGeo = new THREE.PlaneGeometry(CARD_W + 0.07, CARD_H + 0.07);
      const hoverBorderMat = new THREE.MeshBasicMaterial({
        color: typeColor(card.type), transparent: true, opacity: 0.0, side: THREE.DoubleSide,
      });
      const hoverBorder = new THREE.Mesh(hoverBorderGeo, hoverBorderMat);
      hoverBorder.position.z = -0.01;
      hoverBorder.userData = { isBorder: true };
      cardGroup.add(hoverBorder);
      frontMesh.userData.border = hoverBorder;

      frontMesh.userData.loadTexture = () => {
        const url = card.imageSmall;
        if (!url) return;
        loadTexture(url, (t) => { frontMat.map = t; frontMat.needsUpdate = true; });
      };
    });

    scene.add(pivot);
    panelPivots.push(pivot);
  });

  // --- Raycasting
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hoveredEntry: CardEntry | null = null;
  let selectedEntry: CardEntry | null = null;

  function getRaycastTargets() { return allEntries.map(e => e.frontMesh); }

  function setBorderOpacity(entry: CardEntry, opacity: number) {
    const border = entry.frontMesh.userData.border as THREE.Mesh | undefined;
    if (border) {
      (border.material as THREE.MeshBasicMaterial).opacity = opacity;
    }
  }

  function setHoverState(entry: CardEntry | null) {
    if (entry === hoveredEntry) return;

    if (hoveredEntry) {
      if (hoveredEntry !== selectedEntry && !hoveredEntry.flipping) {
        hoveredEntry.group.scale.set(1, 1, 1);
        setBorderOpacity(hoveredEntry, 0);
      }
      onHover(null);
    }

    hoveredEntry = entry;
    if (entry && !entry.flipping) {
      entry.group.scale.set(1.06, 1.06, 1.06);
      setBorderOpacity(entry, 0.7);
      onHover(entry.card.name);
      entry.frontMesh.userData.loadTexture?.();
    }
  }

  function onMouseMove(e: MouseEvent) {
    const rect = mount.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(getRaycastTargets());
    if (hits.length) {
      const mesh = hits[0].object as THREE.Mesh;
      setHoverState(mesh.userData.entry);
      mount.style.cursor = 'pointer';
    } else {
      setHoverState(null);
      mount.style.cursor = 'grab';
    }
  }

  function onMouseClick(e: MouseEvent) {
    if (e.button !== 0) return;
    const rect = mount.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(getRaycastTargets());
    if (hits.length) {
      const mesh = hits[0].object as THREE.Mesh;
      const entry = mesh.userData.entry as CardEntry;

      if (selectedEntry && selectedEntry !== entry) {
        resetFlip(selectedEntry);
        setBorderOpacity(selectedEntry, 0);
      }
      selectedEntry = entry;
      entry.group.scale.set(1.12, 1.12, 1.12);
      startFlip(entry);

      const panelInfo = cardPanelMap.get(entry.card.id);
      onSelect(entry.card, panelInfo?.list ?? [entry.card], panelInfo?.idx ?? 0);
    } else {
      if (selectedEntry) {
        resetFlip(selectedEntry);
        setBorderOpacity(selectedEntry, 0);
        selectedEntry = null;
      }
      onSelect(null as unknown as CatalogCard, [], 0);
    }
  }

  mount.addEventListener('mousemove', onMouseMove);
  mount.addEventListener('click', onMouseClick);

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
  const FLIP_SPEED = 2.5;

  function animate() {
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const dt = clock.getDelta();
      const t = clock.getElapsedTime();

      // Flips
      for (const entry of allEntries) {
        if (!entry.flipping) continue;
        entry.flipProgress = Math.min(1, entry.flipProgress + FLIP_SPEED * dt);
        const p = entry.flipProgress;
        const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        entry.group.rotation.y = entry.baseAngle + eased * Math.PI * 2;
        if (entry.flipProgress >= 1) {
          entry.flipping = false;
          entry.group.rotation.y = entry.baseAngle;
        }
      }

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

      for (let idx = 0; idx < NUM_PANELS; idx++) {
        const panelAngle = (idx / NUM_PANELS) * Math.PI * 2;
        const camAngle = -currentSpherical.theta;
        const diff = Math.abs(
          Math.atan2(Math.sin(camAngle - panelAngle), Math.cos(camAngle - panelAngle))
        );
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
      blueKey.position.x = Math.sin(t * 0.4) * (ARC_RADIUS * 0.5);
      purpleKey.position.x = Math.cos(t * 0.3) * (ARC_RADIUS * 0.5);
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
    await new Promise(r => setTimeout(r, 1000));

    const toLoad = [...allEntries];
    const chunkSize = 4;

    for (let i = 0; i < toLoad.length; i += chunkSize) {
      if (isDisposed) break;
      const chunk = toLoad.slice(i, i + chunkSize);

      await Promise.all(chunk.map(async (entry) => {
        const url = entry.card.imageSmall;
        if (!url) return;

        const mat = entry.frontMesh.material as THREE.MeshStandardMaterial;
        if (mat.map !== placeholderTex) return;

        const tex = await loadTextureAsync(url);
        if (tex && !isDisposed && mat.map === placeholderTex) {
          mat.map = tex;
          mat.needsUpdate = true;
        }
      }));

      await new Promise(r => setTimeout(r, 100));
    }
  };

  progressiveLoad();

  return {
    resize,
    goToPanel: (panelIdx: number) => {
      const angle = (panelIdx / NUM_PANELS) * Math.PI * 2;
      animTargetTheta = -angle;
      animTargetPhi = Math.PI * 0.46;
      animTargetRadius = ARC_RADIUS - 3;
      isAnimating = true;
    },
    filterCards: (query: string) => {
      const q = query.trim().toLowerCase();
      allEntries.forEach((entry) => {
        const matches = !q || entry.card.name.toLowerCase().includes(q);
        entry.group.visible = matches;
      });
    },
    dispose() {
      isDisposed = true;
      cancelAnimationFrame(raf);
      mount.removeEventListener('mousemove', onMouseMove);
      mount.removeEventListener('click', onMouseClick);
      controls.dispose();
      pGeo.dispose();
      cardFrontGeo.dispose();
      cardBackGeo.dispose();
      placeholderTex.dispose();
      backTex.dispose();

      panelPivots.forEach(disposePivot);

      renderer.dispose();
      mount.querySelector('canvas')?.remove();
    },
  };
}
