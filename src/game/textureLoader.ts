import * as THREE from 'three';
import type { CardMesh } from './types';

const TEXTURE_CHUNK_SIZE = 4;
const BATCH_DELAY_MS = 10;
const INITIAL_DELAY_MS = 10;

export const textureCache = new Map<string, THREE.Texture>();
const loader = new THREE.TextureLoader();

export function makePlaceholderTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 140; 
  canvas.height = 200;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 200);
  grad.addColorStop(0, '#0d1b2e'); 
  grad.addColorStop(1, '#0a2540');
  ctx.fillStyle = grad; 
  ctx.fillRect(0, 0, 140, 200);
  ctx.strokeStyle = '#1e90ff44'; 
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, 128, 188);
  ctx.font = 'bold 36px sans-serif';
  ctx.fillStyle = '#1e90ff66';
  ctx.textAlign = 'center'; 
  ctx.textBaseline = 'middle';
  ctx.fillText('✦', 70, 100);
  return new THREE.CanvasTexture(canvas);
}

export function loadTextureAsync(url: string): Promise<THREE.Texture | null> {
  return new Promise((resolve) => {
    if (textureCache.has(url)) {
      resolve(textureCache.get(url)!);
    } else {
      loader.load(
        url,
        (t) => {
          t.colorSpace = THREE.SRGBColorSpace;
          textureCache.set(url, t); 
          resolve(t); 
        },
        undefined,
        () => resolve(null)
      );
    }
  });
}

export async function progressiveLoad(meshes: CardMesh[], placeholder: THREE.Texture, signal: AbortSignal) {
  await new Promise(r => setTimeout(r, INITIAL_DELAY_MS));
  
  for (let i = 0; i < meshes.length; i += TEXTURE_CHUNK_SIZE) {
    if (signal.aborted) break;
    const chunk = meshes.slice(i, i + TEXTURE_CHUNK_SIZE);
    
    await Promise.all(chunk.map(async (entry) => {
      const url = entry.card.imageSmall || entry.card.imageLarge;
      if (!url) return;
      
      const mat = entry.mesh.material as THREE.MeshStandardMaterial;
      if (mat.map !== placeholder) return; // already loaded via hover
      
      const tex = await loadTextureAsync(url);
      if (tex && !signal.aborted && mat.map === placeholder) {
        mat.map = tex;
        mat.needsUpdate = true;
      }
    }));
    
    await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
  }
}
