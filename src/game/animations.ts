import * as THREE from 'three';
import gsap from 'gsap';

export function animateSummonCard(mesh: THREE.Mesh, targetPos: { x: number, y: number, z: number }, targetRotX: number, targetRotY: number): Promise<void> {
  return new Promise(resolve => {
    const tl = gsap.timeline({ onComplete: resolve });
    tl.to(mesh.position, { y: mesh.position.y + 1.0, duration: 0.2, ease: 'power2.out' })
      .to(mesh.position, { x: targetPos.x, z: targetPos.z, duration: 0.35, ease: 'power3.inOut' }, '+=0.05')
      .to(mesh.rotation, { x: targetRotX, y: targetRotY, duration: 0.35, ease: 'power3.inOut' }, '<')
      .to(mesh.scale, { x: 1.1, y: 1.1, z: 1.1, duration: 0.15, ease: 'power2.out' })
      .to(mesh.scale, { x: 1.0, y: 1.0, z: 1.0, duration: 0.25, ease: 'back.out(1.7)' });
  });
}

export function animateAttackMove(attacker: THREE.Mesh, target: THREE.Mesh): Promise<void> {
  return new Promise(resolve => {
    const originalPos = attacker.position.clone();
    const originalRotX = attacker.rotation.x;
    const tl = gsap.timeline({ onComplete: resolve });
    
    // Tilt back
    tl.to(attacker.rotation, { x: originalRotX - 0.1, duration: 0.1, ease: 'power1.inOut' })
      // Dash to target
      .to(attacker.position, { 
        x: target.position.x, 
        y: target.position.y + 0.1, 
        z: target.position.z > attacker.position.z ? target.position.z - 0.5 : target.position.z + 0.5, 
        duration: 0.15, 
        ease: 'power2.in' 
      })
      // Impact flash/scale
      .to(attacker.scale, { x: 1.2, y: 1.2, z: 1.2, duration: 0.05 })
      .to(attacker.scale, { x: 1.0, y: 1.0, z: 1.0, duration: 0.05 })
      // Return
      .to(attacker.position, { x: originalPos.x, y: originalPos.y, z: originalPos.z, duration: 0.2, ease: 'power2.out' })
      .to(attacker.rotation, { x: originalRotX, duration: 0.2, ease: 'power2.out' }, '<');
  });
}

export function animateDamageReceive(target: THREE.Mesh, lethal: boolean): Promise<void> {
  return new Promise(resolve => {
    const tl = gsap.timeline({ onComplete: resolve });
    
    // Vibrate
    const originalX = target.position.x;
    tl.to(target.position, { x: originalX + 0.05, duration: 0.03, yoyo: true, repeat: 5 })
      .set(target.position, { x: originalX });

    if (lethal) {
      // Fade out
      tl.to(target.scale, { x: 0, y: 0, z: 0, duration: 0.6, ease: 'back.in(1.5)' });
    }
  });
}
