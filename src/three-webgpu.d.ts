declare module 'three/webgpu' {
  export * from 'three';
  
  // Minimal types for WebGPURenderer to satisfy the compiler
  export class WebGPURenderer {
    constructor(parameters?: any);
    domElement: HTMLCanvasElement;
    toneMapping: any;
    toneMappingExposure: number;
    setPixelRatio(value: number): void;
    setClearColor(color: any, alpha?: number): void;
    setSize(width: number, height: number): void;
    render(scene: any, camera: any): void;
    init(): Promise<void>;
    dispose(): void;
  }
}
