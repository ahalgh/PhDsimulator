import { Scene, GameObjects } from 'phaser';

/**
 * Particle effect utilities for visual feedback.
 * Requires 'particle_dot' texture (generated in Preloader).
 */
export class ParticleEffects {
    private scene: Scene;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    /**
     * One-shot radial burst of sparkle particles at a world position.
     * Used for building upgrade celebrations.
     */
    burstAt(x: number, y: number, color: number, count: number): void {
        const emitter = this.scene.add.particles(x, y, 'particle_dot', {
            speed: { min: 60, max: 160 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.8, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 800,
            tint: color,
            emitting: false,
        });
        emitter.setDepth(1500);
        emitter.explode(count);
        this.scene.time.delayedCall(1000, () => emitter.destroy());
    }

    /**
     * Colorful confetti burst for achievement toast notifications.
     * Positioned in camera/screen space (scrollFactor 0).
     */
    confettiBurst(x: number, y: number, colors: number[]): void {
        const emitter = this.scene.add.particles(x, y, 'particle_dot', {
            speed: { min: 40, max: 120 },
            angle: { min: 220, max: 320 },
            scale: { start: 0.6, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 600,
            tint: colors,
            emitting: false,
        });
        emitter.setScrollFactor(0);
        emitter.setDepth(4002);
        emitter.explode(15);
        this.scene.time.delayedCall(800, () => emitter.destroy());
    }

    /**
     * Persistent ambient glow emitter for max-level buildings.
     * Slow gold particles drifting upward. Returns the emitter for cleanup tracking.
     */
    createAmbientGlow(x: number, y: number, depth: number): GameObjects.Particles.ParticleEmitter {
        const emitter = this.scene.add.particles(x, y, 'particle_dot', {
            speed: { min: 5, max: 15 },
            angle: { min: 260, max: 280 },
            scale: { start: 0.4, end: 0 },
            alpha: { start: 0.5, end: 0 },
            lifespan: 2000,
            frequency: 600,
            tint: 0xFFD700,
            quantity: 1,
        });
        emitter.setDepth(depth);
        return emitter;
    }
}
