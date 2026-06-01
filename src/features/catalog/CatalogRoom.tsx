import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
// @ts-ignore – WebGPURenderer no tiene tipos en @types/three
import { WebGPURenderer } from 'three/webgpu';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useBattleStore } from '../battle/store';
import { wrapAsCardCatalog } from './catalogUtils';
import type { CatalogCard } from './types';

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTES DE LAYOUT
   ═══════════════════════════════════════════════════════════════════════════ */

// Dimensiones de cada carta
const CARD_W = 0.9;
const CARD_H = 1.25;

// Espaciado entre cartas
const GAP_X = 0.18;
const GAP_Y = 0.18;

// Grilla de cartas por panel: 6 col × 5 filas
const COLS = 6;
const ROWS = 5;
const PER_PANEL = COLS * ROWS; // 30

// Radio de la circunferencia donde se ubican los paneles
const ARC_RADIUS = 12;

// Posición Y del plano del suelo
const FLOOR_Y = 0;

// Distancia mínima entre el suelo y la parte inferior de la carta más baja
const FLOOR_CLEARANCE = 0.4;

// Altura Y de la cámara y del target de OrbitControls
const CAM_Y = 3.5;

// Color de fondo
const BG_COLOR = 0x040c18;

/* ═══════════════════════════════════════════════════════════════════════════
   TIPOS Y COLORES
   ═══════════════════════════════════════════════════════════════════════════ */

const TYPE_ORDER = [
  'Grass', 'Fire', 'Water', 'Lightning', 'Psychic',
  'Fighting', 'Dark', 'Metal', 'Colorless', 'Dragon',
] as const;

/** Mapeo de tipo → color hexadecimal para bordes, etiquetas y panel backing */
const TYPE_COLORS: Record<string, string> = {
  Grass: '#66bb6a',
  Fire: '#ff6b35',
  Water: '#4fc3f7',
  Lightning: '#ffe082',
  Psychic: '#ce93d8',
  Fighting: '#ff8a65',
  Dark: '#546e7a',
  Darkness: '#546e7a',
  Metal: '#90a4ae',
  Colorless: '#b0bec5',
  Dragon: '#7e57c2',
  Fairy: '#f48fb1',
};

function getTypeHex(type: string): string {
  return TYPE_COLORS[type] ?? TYPE_COLORS.Colorless;
}

/* ═══════════════════════════════════════════════════════════════════════════
   TEXTURAS
   ═══════════════════════════════════════════════════════════════════════════ */

/** Textura placeholder frontal (carta boca abajo antes de cargar imagen real) */
function makePlaceholderTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 180;
  c.height = 250;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 250);
  g.addColorStop(0, '#0d1b2e');
  g.addColorStop(1, '#0a2540');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 180, 250);
  ctx.strokeStyle = '#1e90ff44';
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, 168, 238);
  ctx.font = 'bold 40px sans-serif';
  ctx.fillStyle = '#1e90ff55';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✦', 90, 125);
  return new THREE.CanvasTexture(c);
}

/** Textura del reverso de la carta */
function makeBackTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 280;
  c.height = 400;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(140, 200, 20, 140, 200, 220);
  g.addColorStop(0, '#1a0533');
  g.addColorStop(1, '#080112');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 280, 400);
  ctx.strokeStyle = '#7c3aed88';
  ctx.lineWidth = 5;
  ctx.strokeRect(8, 8, 264, 384);
  ctx.strokeStyle = '#a855f744';
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, 248, 368);
  ctx.font = 'bold 64px sans-serif';
  ctx.fillStyle = '#7c3aed99';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✦', 140, 180);
  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = '#a855f766';
  ctx.fillText('POKÉMON TCG', 140, 250);
  return new THREE.CanvasTexture(c);
}

/** Cache global de texturas de imágenes para evitar re-fetch */
const texCache = new Map<string, THREE.Texture>();
const texLoader = new THREE.TextureLoader();
function loadTex(url: string, cb: (t: THREE.Texture) => void) {
  const cached = texCache.get(url);
  if (cached) { cb(cached); return; }
  texLoader.load(url, (t) => { texCache.set(url, t); cb(t); });
}

/* Tipo del contexto de escena expuesto por buildScene */
type SceneContext = {
  resize: () => void;
  changePanel: (group: { type: string; cards: CatalogCard[] }, dir: 'left' | 'right') => void;
  dispose: () => void;
};

export function CatalogRoom({ onGoToDeck }: { onGoToDeck?: () => void }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneContext | null>(null);
  const catalog = useBattleStore((s) => s.catalog);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCard, setSelectedCard] = useState<CatalogCard | null>(null);
  const [hoverCard, setHoverCard] = useState<string | null>(null);

  // Para navegación prev/next dentro del panel del tipo activo
  const [panelCards, setPanelCards] = useState<CatalogCard[]>([]);
  const [panelCardIdx, setPanelCardIdx] = useState(0);

  // Feedback visual al agregar al mazo
  const [addedFeedback, setAddedFeedback] = useState(false);

  // Índice del panel de tipo activo (solo para el indicador UI)
  const [activePanelIdx, setActivePanelIdx] = useState(0);

  const cards = useMemo(() => catalog.map(wrapAsCardCatalog), [catalog]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return q ? cards.filter(c => c.name.toLowerCase().includes(q)) : cards;
  }, [cards, searchQuery]);

  // Paneles con al menos una carta (depende de filtered)
  const panelGroups = useMemo(
    () => groupByType(filtered).filter(g => g.cards.length > 0),
    [filtered],
  );
  const totalPanels = panelGroups.length;

  // La escena se construye UNA SOLA VEZ por cambio de filtered.
  // El cambio de panel activo se maneja con changePanel() sin reconstruir.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || filtered.length === 0) return;

    const ctx = buildScene(
      mount,
      filtered,
      activePanelIdx,
      (card, list, idx) => {
        setSelectedCard(card);
        setPanelCards(list);
        setPanelCardIdx(idx);
      },
      (name) => setHoverCard(name),
    );
    sceneRef.current = ctx;
    return () => ctx.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]); // activePanelIdx: manejado imperativamente con changePanel()

  // Manejar resize de ventana
  useEffect(() => {
    const fn = () => sceneRef.current?.resize();
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  /** Navegar a carta anterior del mismo panel */
  function handlePrev() {
    if (!panelCards.length) return;
    const idx = (panelCardIdx - 1 + panelCards.length) % panelCards.length;
    setPanelCardIdx(idx);
    setSelectedCard(panelCards[idx]);
  }

  /** Navegar a carta siguiente del mismo panel */
  function handleNext() {
    if (!panelCards.length) return;
    const idx = (panelCardIdx + 1) % panelCards.length;
    setPanelCardIdx(idx);
    setSelectedCard(panelCards[idx]);
  }

  /** Navegar al panel de tipo anterior — carousel: el viejo sale por la derecha, el nuevo entra por la izquierda */
  function handlePrevPanel() {
    const newIdx = (activePanelIdx - 1 + totalPanels) % totalPanels;
    setActivePanelIdx(newIdx);
    setSelectedCard(null);
    sceneRef.current?.changePanel(panelGroups[newIdx], 'left');
  }

  /** Navegar al panel de tipo siguiente — carousel: el viejo sale por la izquierda, el nuevo entra por la derecha */
  function handleNextPanel() {
    const newIdx = (activePanelIdx + 1) % totalPanels;
    setActivePanelIdx(newIdx);
    setSelectedCard(null);
    sceneRef.current?.changePanel(panelGroups[newIdx], 'right');
  }

  /** Botón "Agregar al Mazo" */
  function handleAddToDeck() {
    if (!selectedCard) return;
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1800);
  }

  return (
    <div className="cr-root">
      {/* Canvas 3D */}
      <div ref={mountRef} className="cr-canvas" />

      {/* Barra de búsqueda */}
      <div className="cr-search-bar">
        <span className="cr-search-bar__icon">🔍</span>
        <input
          id="cr-search"
          type="search"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Buscar carta…"
          autoComplete="on"
          aria-label="Buscar carta en el catálogo"
        />
        {searchQuery && (
          <button
            className="cr-search-bar__clear"
            onClick={() => setSearchQuery('')}
            aria-label="Limpiar búsqueda"
          >✕</button>
        )}
      </div>

      {/* Contador de cartas */}
      <div className="cr-badge">
        {filtered.length} carta{filtered.length !== 1 ? 's' : ''}
      </div>

      {/* Instrucciones de navegación */}
      <div className="cr-hint">
        Scroll / Pinch para zoom · Click para detalles
      </div>

      {/* Flecha izquierda */}
      {totalPanels > 1 && (
        <button
          className="cr-nav-arrow cr-nav-arrow--left"
          onClick={handlePrevPanel}
          aria-label="Panel anterior"
        >
          ◀
        </button>
      )}

      {/* Flecha derecha */}
      {totalPanels > 1 && (
        <button
          className="cr-nav-arrow cr-nav-arrow--right"
          onClick={handleNextPanel}
          aria-label="Panel siguiente"
        >
          ▶
        </button>
      )}

      {/* Indicador de tipo activo */}
      {totalPanels > 0 && (
        <div className="cr-panel-indicator">
          {panelGroups[activePanelIdx]?.type} · {activePanelIdx + 1} / {totalPanels}
        </div>
      )}

      {/* ── Panel lateral de detalles ───────────────────────────── */}
      {selectedCard && (
        <aside
          className="cr-details"
          role="complementary"
          aria-label={`Detalles de ${selectedCard.name}`}
        >
          <button
            className="cr-details__close"
            onClick={() => setSelectedCard(null)}
            aria-label="Cerrar panel de detalles"
          >✕</button>

          {/* Imagen de la carta */}
          <div className="cr-details__img-wrap">
            <img
              src={selectedCard.imageLarge || selectedCard.imageSmall}
              alt={`Carta ${selectedCard.name}`}
              className="cr-details__img"
            />
          </div>

          {/* Información de la carta */}
          <div className="cr-details__body">
            <p className="cr-details__category">{selectedCard.type}</p>
            <h2 className="cr-details__name">{selectedCard.name}</h2>

            {selectedCard.hp > 0 && (
              <p className="cr-details__hp">{selectedCard.hp} HP</p>
            )}

            {/* Ataque principal */}
            {selectedCard.attackName && (
              <div className="cr-details__attack">
                <span className="cr-details__attack-name">{selectedCard.attackName}</span>
                {selectedCard.attackDamage > 0 && (
                  <span className="cr-details__attack-dmg">{selectedCard.attackDamage} dmg</span>
                )}
                {selectedCard.attackCost > 0 && (
                  <span className="cr-details__attack-cost">Costo: {selectedCard.attackCost}</span>
                )}
              </div>
            )}

            {/* Descripción en español (del CSV: attack1Effect) */}
            {(selectedCard as CatalogCard & { attack1Effect?: string }).attack1Effect && (
              <p className="cr-details__description">
                {(selectedCard as CatalogCard & { attack1Effect?: string }).attack1Effect}
              </p>
            )}
          </div>

          {/* Navegación prev / next entre cartas del mismo panel */}
          {panelCards.length > 1 && (
            <div className="cr-details__nav" aria-label="Navegar entre cartas">
              <button className="cr-details__nav-btn" onClick={handlePrev} aria-label="Carta anterior">◀</button>
              <span className="cr-details__nav-counter">{panelCardIdx + 1} / {panelCards.length}</span>
              <button className="cr-details__nav-btn" onClick={handleNext} aria-label="Carta siguiente">▶</button>
            </div>
          )}

          {/* Botones de acción */}
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
        </aside>
      )}

      {/* Tooltip de hover */}
      {hoverCard && !selectedCard && (
        <div className="cr-tooltip">{hoverCard}</div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   AGRUPACIÓN DE CARTAS POR TIPO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Agrupa cartas en paneles correspondientes a TYPE_ORDER.
 * - "Darkness" se mapea a "Dark"
 * - Tipos no reconocidos van a "Colorless"
 */
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

/* ═══════════════════════════════════════════════════════════════════════════
   THREE.JS SCENE BUILDER
   ═══════════════════════════════════════════════════════════════════════════ */

function buildScene(
  mount: HTMLDivElement,
  cards: CatalogCard[],
  initialPanelIdx: number,
  onSelect: (c: CatalogCard, panelList: CatalogCard[], idx: number) => void,
  onHover: (name: string | null) => void,
) {
  const placeholderTex = makePlaceholderTexture();
  const backTex = makeBackTexture();

  /* ── Renderer ── */
  const renderer = new WebGPURenderer({ antialias: true, alpha: true }) as any;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(BG_COLOR, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  mount.appendChild(renderer.domElement);

  /* ── Escena ── */
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(BG_COLOR, 30, 55);

  /* ── Cámara — más cerca del panel para mejor visibilidad ── */
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, CAM_Y, 3.5);

  /* ── Controles — zoom, sin rotación libre ── */
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.enableRotate = true;
  controls.minDistance = 2;
  controls.maxDistance = 10;
  controls.minPolarAngle = Math.PI / 2 - 0.05;
  controls.maxPolarAngle = Math.PI / 2 + 0.05;
  controls.target.set(0, CAM_Y, 0);

  (controls as any).touches = {
    ONE: THREE.TOUCH.DOLLY_PAN,
    TWO: THREE.TOUCH.DOLLY_PAN,
  };

  /* ── Iluminación ── */
  scene.add(new THREE.AmbientLight(0x90c8ff, 0.7));
  const blueKey = new THREE.PointLight(0x38bdf8, 8, 40, 1.6);
  blueKey.position.set(-6, 6, -4);
  scene.add(blueKey);
  const purpleKey = new THREE.PointLight(0xa855f7, 6, 40, 1.6);
  purpleKey.position.set(6, 5, -4);
  scene.add(purpleKey);
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
  rimLight.position.set(0, 10, 10);
  scene.add(rimLight);

  /* ── Suelo ── */
  const grid = new THREE.GridHelper(40, 40, 0x1e40af, 0x0f2d5a);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.3;
  grid.position.y = FLOOR_Y;
  scene.add(grid);

  const floorGeo = new THREE.CircleGeometry(20, 64);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x030810, roughness: 0.85, metalness: 0.2, transparent: true, opacity: 0.85,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = FLOOR_Y - 0.01;
  scene.add(floorMesh);

  const haloMat = new THREE.MeshBasicMaterial({
    color: 0x1e40af, transparent: true, opacity: 0.10, side: THREE.DoubleSide,
  });
  const halo = new THREE.Mesh(new THREE.RingGeometry(4, 6, 64), haloMat);
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = FLOOR_Y + 0.01;
  scene.add(halo);

  /* ── Partículas ambientales ── */
  const pCount = 250;
  const pPos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    pPos[i * 3]     = (Math.random() - 0.5) * 40;
    pPos[i * 3 + 1] = Math.random() * 12 + 0.5;
    pPos[i * 3 + 2] = (Math.random() - 0.5) * 40;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const particles = new THREE.Points(
    pGeo,
    new THREE.PointsMaterial({ color: 0x93c5fd, size: 0.04, transparent: true, opacity: 0.5 }),
  );
  scene.add(particles);

  /* ═════════════════════════════════════════════════════════════
     PANELES — SISTEMA DE PIVOT CON TRANSICIÓN CAROUSEL
     ═════════════════════════════════════════════════════════════
     Cada panel es un THREE.Group (pivot) centrado en el origen.
     Los meshes del panel (backing, cartas) se colocan en el
     espacio local del pivot a Z = -ARC_RADIUS.
     Al rotar pivot.rotation.y, el panel se mueve por la
     circunferencia alrededor del jugador (cámara).
     ═════════════════════════════════════════════════════════════ */

  const groups = groupByType(cards);

  // Geometrías compartidas por todas las cartas (misma geo para todos los paneles)
  const cardFrontGeo = new THREE.PlaneGeometry(CARD_W, CARD_H);
  const cardBackGeo  = new THREE.PlaneGeometry(CARD_W, CARD_H);

  // Dimensiones del panel
  const panelWidth   = COLS * (CARD_W + GAP_X) - GAP_X;
  const panelHeight  = ROWS * (CARD_H + GAP_Y) - GAP_Y;
  const panelBottomY = FLOOR_Y + FLOOR_CLEARANCE + CARD_H / 2;
  const panelTopY    = panelBottomY + (ROWS - 1) * (CARD_H + GAP_Y);
  const panelCenterY = (panelBottomY + panelTopY) / 2;

  // El panel vive en Z = -ARC_RADIUS en el espacio local del pivot
  const PANEL_Z_LOCAL = -ARC_RADIUS;
  const ZOOM_OFFSET_Z = 2.5; // la carta seleccionada avanza hacia la cámara

  // Tipo para cada entrada de carta
  type CardEntry = {
    group: THREE.Group;
    frontMesh: THREE.Mesh;
    card: CatalogCard;
    baseAngle: number;           // siempre 0 (el pivot maneja la rotación del panel)
    basePosition: THREE.Vector3; // posición local dentro del pivot
    flipping: boolean;
    flipProgress: number;
  };

  // Estado de interacción — persiste entre cambios de panel
  let selectedEntry: CardEntry | null = null;
  let hoveredEntry:  CardEntry | null = null;
  let activeEntries: CardEntry[] = [];
  let cardPanelMap = new Map<string, { list: CatalogCard[]; idx: number }>();

  // Estado de transición carousel entre paneles
  type PanelTransition = {
    oldPivot:       THREE.Group;
    newPivot:       THREE.Group;
    progress:       number;      // 0 → 1
    dir:            'left' | 'right';
    targetOldAngle: number;      // ±π/2
    newStartAngle:  number;      // ±π/2
  };
  let panelTransition: PanelTransition | null = null;

  /**
   * Construye todos los meshes de un panel en un Group (pivot).
   * Las cartas se ubican con Z = PANEL_Z_LOCAL en espacio local del pivot.
   * Rotar pivot.rotation.y mueve el panel por la circunferencia.
   */
  function buildPanelPivot(panelGroup: { type: string; cards: CatalogCard[] }) {
    const pivot   = new THREE.Group();
    const typeHex = getTypeHex(panelGroup.type);

    /* ── Backing (fondo semitransparente) ── */
    const backingGeo = new THREE.PlaneGeometry(panelWidth + 0.6, panelHeight + 0.8);
    const backingMat = new THREE.MeshBasicMaterial({
      color: 0x0a1628, transparent: true, opacity: 0.6, side: THREE.FrontSide,
    });
    const backing = new THREE.Mesh(backingGeo, backingMat);
    backing.position.set(0, panelCenterY, PANEL_Z_LOCAL - 0.03);
    pivot.add(backing);

    /* ── Borde de color del tipo ── */
    const borderGeo = new THREE.PlaneGeometry(panelWidth + 0.7, panelHeight + 0.9);
    const borderMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(typeHex), transparent: true, opacity: 0.12, side: THREE.BackSide,
    });
    const borderMesh = new THREE.Mesh(borderGeo, borderMat);
    borderMesh.position.set(0, panelCenterY, PANEL_Z_LOCAL - 0.04);
    pivot.add(borderMesh);

    /* ── Etiqueta del tipo ── */
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width  = 256;
    labelCanvas.height = 64;
    const lctx = labelCanvas.getContext('2d')!;
    lctx.fillStyle = '#000000aa';
    lctx.roundRect(4, 4, 248, 56, 12);
    lctx.fill();
    lctx.font         = 'bold 26px sans-serif';
    lctx.fillStyle    = typeHex;
    lctx.textAlign    = 'center';
    lctx.textBaseline = 'middle';
    lctx.fillText(panelGroup.type, 128, 32);
    const labelTex  = new THREE.CanvasTexture(labelCanvas);
    const labelMat  = new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, side: THREE.FrontSide });
    const labelGeo  = new THREE.PlaneGeometry(panelWidth * 0.5, 0.5);
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    labelMesh.position.set(0, panelTopY + CARD_H / 2 + 0.35, PANEL_Z_LOCAL);
    pivot.add(labelMesh);

    /* ── Cartas del panel ── */
    const entries: CardEntry[] = [];
    const newMap = new Map<string, { list: CatalogCard[]; idx: number }>();
    const panelCardList = panelGroup.cards.slice(0, PER_PANEL);

    panelCardList.forEach((card, slotIdx) => {
      const col        = slotIdx % COLS;
      const row        = Math.floor(slotIdx / COLS);
      // Fila 0 = parte superior; el hueco vacío queda siempre abajo
      const rowFromTop = (ROWS - 1) - row;
      const localX     = (col - (COLS - 1) / 2) * (CARD_W + GAP_X);
      const cardY      = FLOOR_Y + FLOOR_CLEARANCE + CARD_H / 2 + rowFromTop * (CARD_H + GAP_Y);

      const cardGroup = new THREE.Group();
      cardGroup.position.set(localX, cardY, PANEL_Z_LOCAL);
      pivot.add(cardGroup);

      const frontMat = new THREE.MeshStandardMaterial({
        map: placeholderTex, roughness: 0.25, metalness: 0.1, side: THREE.FrontSide,
      });
      const frontMesh = new THREE.Mesh(cardFrontGeo, frontMat);
      cardGroup.add(frontMesh);

      const backMat = new THREE.MeshStandardMaterial({
        map: backTex, roughness: 0.3, metalness: 0.15, side: THREE.FrontSide,
      });
      const backMesh = new THREE.Mesh(cardBackGeo, backMat);
      backMesh.rotation.y = Math.PI;
      cardGroup.add(backMesh);

      frontMesh.userData = {
        cardId: card.id,
        loadTexture: () => {
          const url = card.imageSmall;
          if (!url) return;
          loadTex(url, (t) => { frontMat.map = t; frontMat.needsUpdate = true; });
        },
      };

      newMap.set(card.id, { list: panelCardList, idx: slotIdx });
      const basePos = new THREE.Vector3(localX, cardY, PANEL_Z_LOCAL);
      entries.push({
        group: cardGroup, frontMesh, card,
        baseAngle: 0, basePosition: basePos.clone(),
        flipping: false, flipProgress: 0,
      });
    });

    return { pivot, entries, cardPanelMap: newMap };
  }

  /** Libera los recursos GPU de un pivot que ya no se usará */
  function disposePivot(pivotGroup: THREE.Group) {
    pivotGroup.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      // No disponer geometrías compartidas entre paneles
      if (obj.geometry !== cardFrontGeo && obj.geometry !== cardBackGeo) {
        obj.geometry.dispose();
      }
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of mats as (THREE.MeshBasicMaterial | THREE.MeshStandardMaterial)[]) {
        // No disponer texturas compartidas del scope externo
        if (mat.map && mat.map !== placeholderTex && mat.map !== backTex) {
          mat.map.dispose();
        }
        mat.dispose();
      }
    });
  }

  // ── Construir panel inicial ─────────────────────────────────────────────
  let currentPivot: THREE.Group;
  const activeGroupsList = groups.filter(g => g.cards.length > 0);
  const clampedInitIdx   = Math.min(initialPanelIdx, activeGroupsList.length - 1);
  if (clampedInitIdx >= 0) {
    const result = buildPanelPivot(activeGroupsList[clampedInitIdx]);
    currentPivot  = result.pivot;
    scene.add(currentPivot);
    activeEntries = result.entries;
    cardPanelMap  = result.cardPanelMap;
  } else {
    currentPivot = new THREE.Group(); // sin cartas disponibles
  }

  /* ═════════════════════════════════════════════════════════════
     RAYCASTING E INTERACCIÓN
     ═════════════════════════════════════════════════════════════ */

  const raycaster = new THREE.Raycaster();
  const pointer   = new THREE.Vector2();

  /** Meshes frontales del panel activo (targets del raycaster) */
  function frontMeshes() {
    return activeEntries.map(e => e.frontMesh);
  }

  function clearHover() {
    if (hoveredEntry && hoveredEntry !== selectedEntry) {
      hoveredEntry.group.scale.set(1, 1, 1);
    }
    hoveredEntry = null;
    onHover(null);
  }

  function setHover(entry: CardEntry) {
    if (entry === hoveredEntry) return;
    clearHover();
    hoveredEntry = entry;
    entry.group.scale.set(1.06, 1.06, 1.06);
    onHover(entry.card.name);
    entry.frontMesh.userData.loadTexture?.();
  }

  /** Revertir flip y restaurar posición local de una entrada */
  function resetFlip(entry: CardEntry) {
    entry.flipping     = false;
    entry.flipProgress = 0;
    entry.group.rotation.y = entry.baseAngle;
    entry.group.scale.set(1, 1, 1);
    entry.group.position.copy(entry.basePosition);
  }

  /** Iniciar animación de flip 360° */
  function startFlip(entry: CardEntry) {
    if (entry.flipping) return;
    entry.flipping     = true;
    entry.flipProgress = 0;
    // Precargar textura hi-res
    const url = entry.card.imageLarge || entry.card.imageSmall;
    if (url) {
      loadTex(url, (t) => {
        (entry.frontMesh.material as THREE.MeshStandardMaterial).map = t;
        (entry.frontMesh.material as THREE.MeshStandardMaterial).needsUpdate = true;
      });
    }
  }

  function onPointerMove(e: PointerEvent) {
    const rect = mount.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(frontMeshes());
    if (hits.length) {
      const hit   = hits[0].object as THREE.Mesh;
      const entry = activeEntries.find(e => e.frontMesh === hit);
      if (entry) setHover(entry);
      mount.style.cursor = 'pointer';
    } else {
      clearHover();
      mount.style.cursor = 'grab';
    }
  }

  function onClick(e: MouseEvent) {
    if (e.button !== 0) return;
    const rect = mount.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(frontMeshes());

    if (hits.length) {
      const hit   = hits[0].object as THREE.Mesh;
      const entry = activeEntries.find(e => e.frontMesh === hit);
      if (!entry) return;

      // Deseleccionar la carta previa
      if (selectedEntry && selectedEntry !== entry) {
        resetFlip(selectedEntry);
      }
      selectedEntry = entry;
      entry.group.scale.set(1.12, 1.12, 1.12);
      startFlip(entry);

      const panelInfo = cardPanelMap.get(entry.card.id);
      onSelect(entry.card, panelInfo?.list ?? [entry.card], panelInfo?.idx ?? 0);
    } else {
      // Click en vacío → deseleccionar
      if (selectedEntry) {
        resetFlip(selectedEntry);
        selectedEntry = null;
      }
      onSelect(null as unknown as CatalogCard, [], 0);
    }
  }

  mount.addEventListener('pointermove', onPointerMove);
  mount.addEventListener('click', onClick);

  /* ── Resize ── */
  let raf = 0;
  function resize() {
    const w = mount.clientWidth || 1;
    const h = mount.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  resize();

  /* ═════════════════════════════════════════════════════════════
     CAMBIO DE PANEL — rotación carousel alrededor del jugador
     ═════════════════════════════════════════════════════════════
     ▶ presionado → el panel viejo sale por la izquierda (-π/2),
                    el nuevo entra desde la derecha (+π/2).
     ◀ presionado → el panel viejo sale por la derecha (+π/2),
                    el nuevo entra desde la izquierda (-π/2).
     ═════════════════════════════════════════════════════════════ */

  function changePanel(
    newPanelGroup: { type: string; cards: CatalogCard[] },
    dir: 'left' | 'right',
  ) {
    // Si hay una transición en curso, completarla instantáneamente
    if (panelTransition) {
      scene.remove(panelTransition.oldPivot);
      disposePivot(panelTransition.oldPivot);
      currentPivot = panelTransition.newPivot;
      currentPivot.rotation.y = 0;
      panelTransition = null;
    }

    // Limpiar estado de interacción
    if (selectedEntry) { resetFlip(selectedEntry); selectedEntry = null; }
    hoveredEntry = null;
    onHover(null);

    // Construir el nuevo pivot fuera del campo visual (90° lateral)
    const result     = buildPanelPivot(newPanelGroup);
    const startAngle = dir === 'right' ? Math.PI / 2 : -Math.PI / 2;
    result.pivot.rotation.y = startAngle;
    scene.add(result.pivot);

    panelTransition = {
      oldPivot:       currentPivot,
      newPivot:       result.pivot,
      progress:       0,
      dir,
      // El viejo sale por el lado opuesto al que entra el nuevo
      targetOldAngle: dir === 'right' ? -Math.PI / 2 : Math.PI / 2,
      newStartAngle:  startAngle,
    };

    // Actualizar estado activo para raycasting (nuevo panel inmediatamente interactuable)
    activeEntries = result.entries;
    cardPanelMap  = result.cardPanelMap;
  }

  /* ═════════════════════════════════════════════════════════════
     LOOP DE ANIMACIÓN
     ═════════════════════════════════════════════════════════════ */

  const clock = new THREE.Clock();
  let elapsed = 0;
  const FLIP_SPEED       = 2.5;  // flip completo en ~0.4 s
  const TRANSITION_SPEED = 2.2;  // carousel completo en ~0.45 s

  async function animate() {
    await renderer.init();

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const dt = clock.getDelta();
      elapsed += dt;

      controls.update();

      // Efectos ambientales
      particles.rotation.y = elapsed * 0.015;
      haloMat.opacity      = 0.08 + Math.sin(elapsed * 1.1) * 0.03;
      blueKey.position.x   = Math.sin(elapsed * 0.4) * 7;
      purpleKey.position.x = Math.cos(elapsed * 0.3) * 7;

      // ── Transición carousel de panel ───────────────────────────
      if (panelTransition) {
        panelTransition.progress = Math.min(1, panelTransition.progress + TRANSITION_SPEED * dt);
        const p     = panelTransition.progress;
        const eased = p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;

        // Panel viejo rota hacia su ángulo de salida
        panelTransition.oldPivot.rotation.y = THREE.MathUtils.lerp(
          0, panelTransition.targetOldAngle, eased,
        );
        // Panel nuevo rota desde su ángulo de entrada hasta el frente (0)
        panelTransition.newPivot.rotation.y = THREE.MathUtils.lerp(
          panelTransition.newStartAngle, 0, eased,
        );

        if (panelTransition.progress >= 1) {
          scene.remove(panelTransition.oldPivot);
          disposePivot(panelTransition.oldPivot);
          currentPivot    = panelTransition.newPivot;
          panelTransition = null;
        }
      }

      // ── Zoom y flip de cartas activas ─────────────────────────
      for (const entry of activeEntries) {
        // Zoom hacia la cámara (local al pivot, en Z)
        const isSelected = entry === selectedEntry;
        const targetZ    = isSelected ? entry.basePosition.z + ZOOM_OFFSET_Z : entry.basePosition.z;
        entry.group.position.z = THREE.MathUtils.lerp(entry.group.position.z, targetZ, 0.12);

        if (!entry.flipping) continue;

        entry.flipProgress = Math.min(1, entry.flipProgress + FLIP_SPEED * dt);
        const p     = entry.flipProgress;
        const eased = p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;

        // Flip 360°: vuelta completa
        entry.group.rotation.y = entry.baseAngle + eased * Math.PI * 2;

        if (entry.flipProgress >= 1) {
          entry.flipping         = false;
          entry.group.rotation.y = entry.baseAngle; // snap exacto al finalizar
        }
      }

      renderer.render(scene, camera);
    };

    loop();
  }

  void animate();

  /* ── Cleanup ── */
  return {
    resize,
    changePanel,
    dispose() {
      cancelAnimationFrame(raf);
      mount.removeEventListener('pointermove', onPointerMove);
      mount.removeEventListener('click', onClick);
      controls.dispose();
      pGeo.dispose();
      cardFrontGeo.dispose();
      cardBackGeo.dispose();
      placeholderTex.dispose();
      backTex.dispose();
      renderer.dispose();
      mount.querySelector('canvas')?.remove();
    },
  };
}
