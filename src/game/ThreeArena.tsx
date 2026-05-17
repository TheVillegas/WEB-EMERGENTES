import { useEffect, useRef } from 'react';
import * as THREE from 'three/webgpu';

export function ThreeArena() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    let renderer: THREE.WebGPURenderer | null = null;
    let frame = 0;

    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x04101f, 10, 26);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 5.4, 9.8);
    camera.lookAt(0, 0.3, 0);

    scene.add(new THREE.AmbientLight(0x90d7ff, 0.9));

    const cyanLight = new THREE.PointLight(0x37d7ff, 7, 30, 2);
    cyanLight.position.set(-4, 4, 2);
    scene.add(cyanLight);

    const greenLight = new THREE.PointLight(0x72ffc8, 7, 30, 2);
    greenLight.position.set(4, 3, 2);
    scene.add(greenLight);

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(10.8, 0.42, 14.4),
      new THREE.MeshPhysicalMaterial({
        color: 0x0a1730,
        metalness: 0.68,
        roughness: 0.34,
        transmission: 0.03,
        clearcoat: 1,
        clearcoatRoughness: 0.18,
        emissive: 0x0b2140,
        emissiveIntensity: 0.66,
      }),
    );
    board.position.y = -0.62;
    board.rotation.x = -0.05;
    scene.add(board);

    const boardPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(10.2, 13.8),
      new THREE.MeshBasicMaterial({ color: 0x10284d, transparent: true, opacity: 0.14, side: THREE.DoubleSide }),
    );
    boardPlane.position.set(0, -0.37, 0);
    boardPlane.rotation.x = -Math.PI / 2;
    scene.add(boardPlane);

    const laneRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.4, 0.05, 20, 120),
      new THREE.MeshBasicMaterial({ color: 0x6decc9, transparent: true, opacity: 0.18 }),
    );
    laneRing.rotation.x = Math.PI / 2;
    laneRing.position.y = -0.36;
    scene.add(laneRing);

    const outerRing = new THREE.Mesh(
      new THREE.TorusGeometry(4.1, 0.04, 16, 120),
      new THREE.MeshBasicMaterial({ color: 0x35d5ff, transparent: true, opacity: 0.14 }),
    );
    outerRing.rotation.x = Math.PI / 2;
    outerRing.position.y = -0.34;
    scene.add(outerRing);

    const centerLine = new THREE.Mesh(
      new THREE.PlaneGeometry(8.8, 0.18),
      new THREE.MeshBasicMaterial({ color: 0x89f7ff, transparent: true, opacity: 0.24, side: THREE.DoubleSide }),
    );
    centerLine.position.set(0, -0.33, 0);
    centerLine.rotation.x = -Math.PI / 2;
    scene.add(centerLine);

    const laneGrid = new THREE.GridHelper(9.8, 22, 0x38bdf8, 0x1d4ed8);
    laneGrid.position.y = -0.39;
    laneGrid.material.transparent = true;
    laneGrid.material.opacity = 0.08;
    scene.add(laneGrid);

    const ambientHalo = new THREE.Mesh(
      new THREE.RingGeometry(4.8, 6.8, 96),
      new THREE.MeshBasicMaterial({ color: 0x35d5ff, transparent: true, opacity: 0.08, side: THREE.DoubleSide }),
    );
    ambientHalo.rotation.x = -Math.PI / 2;
    ambientHalo.position.y = -0.41;
    scene.add(ambientHalo);

    const particleCount = 220;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 18;
      positions[i * 3 + 1] = Math.random() * 4 + 0.3;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }

    const particlesGeometry = new THREE.BufferGeometry();
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(
      particlesGeometry,
      new THREE.PointsMaterial({ color: 0x89f7ff, size: 0.055, transparent: true, opacity: 0.55 }),
    );
    scene.add(particles);

    const resize = () => {
      if (!renderer || !host) return;
      const width = host.clientWidth || 1;
      const height = host.clientHeight || 1;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    const init = async () => {
      renderer = new THREE.WebGPURenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
      renderer.setClearAlpha(0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      await renderer.init();

      if (!mounted) return;
      host.appendChild(renderer.domElement);
      resize();

      const clock = new THREE.Clock();
      const animate = () => {
        if (!renderer) return;
        const elapsed = clock.getElapsedTime();

        laneRing.rotation.z = elapsed * 0.22;
        outerRing.rotation.z = -elapsed * 0.14;
        ambientHalo.rotation.z = elapsed * 0.05;
        particles.rotation.y = elapsed * 0.03;
        centerLine.material.opacity = 0.18 + Math.sin(elapsed * 2.2) * 0.05;
        ambientHalo.material.opacity = 0.06 + Math.cos(elapsed * 1.3) * 0.02;
        camera.position.x = Math.sin(elapsed * 0.32) * 0.22;
        camera.position.y = 5.4 + Math.cos(elapsed * 0.4) * 0.08;
        camera.lookAt(0, 0.2, 0);

        renderer.render(scene, camera);
        frame = requestAnimationFrame(animate);
      };

      animate();
    };

    void init();
    window.addEventListener('resize', resize);

    return () => {
      mounted = false;
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frame);
      particlesGeometry.dispose();
      if (renderer) {
        renderer.dispose();
        host.querySelector('canvas')?.remove();
      }
    };
  }, []);

  return <div ref={hostRef} className="three-arena" aria-hidden="true" />;
}
