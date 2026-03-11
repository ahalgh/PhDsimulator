import { Scene } from 'phaser';

/**
 * Procedural sound effects via Web Audio API.
 * No external audio files needed — all sounds are synthesized.
 * Respects Phaser's global mute state automatically.
 */
export class SoundEffects {
    private scene: Scene;
    private ctx: AudioContext | null = null;

    constructor(scene: Scene) {
        this.scene = scene;
        // Phaser's WebAudioSoundManager exposes .context
        const soundManager = scene.sound as any;
        if (soundManager.context) {
            this.ctx = soundManager.context as AudioContext;
        }
    }

    private get muted(): boolean {
        return this.scene.sound.mute;
    }

    /** Short click/pop for buttons and interactive elements. ~80ms */
    playClick(): void {
        if (this.muted || !this.ctx) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.08);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
    }

    /** Ascending two-tone chime for building upgrades. ~400ms */
    playUpgrade(): void {
        if (this.muted || !this.ctx) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // First tone: C5 (523Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(523, now);
        gain1.gain.setValueAtTime(0.12, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc1.connect(gain1).connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.15);

        // Second tone: G5 (784Hz)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(784, now + 0.15);
        gain2.gain.setValueAtTime(0.001, now);
        gain2.gain.setValueAtTime(0.12, now + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc2.connect(gain2).connect(ctx.destination);
        osc2.start(now + 0.15);
        osc2.stop(now + 0.4);
    }

    /** Triumphant three-tone arpeggio for achievement unlocks. ~500ms */
    playAchievement(): void {
        if (this.muted || !this.ctx) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const notes = [523, 659, 784]; // C5, E5, G5
        const starts = [0, 0.13, 0.26];
        const durations = [0.15, 0.15, 0.24];

        for (let i = 0; i < notes.length; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(notes[i], now + starts[i]);
            gain.gain.setValueAtTime(0.001, now);
            gain.gain.setValueAtTime(0.12, now + starts[i]);
            gain.gain.exponentialRampToValueAtTime(0.001, now + starts[i] + durations[i]);
            osc.connect(gain).connect(ctx.destination);
            osc.start(now + starts[i]);
            osc.stop(now + starts[i] + durations[i]);
        }
    }

    /** Upward sweep whoosh for opening overlays. ~150ms */
    playOpen(): void {
        if (this.muted || !this.ctx) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
    }

    /** Downward sweep whoosh for closing overlays. ~150ms */
    playClose(): void {
        if (this.muted || !this.ctx) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
    }

    /** Gentle chime for NPC dialogue opening. ~200ms */
    playDialogue(): void {
        if (this.muted || !this.ctx) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // Primary tone: A5 (880Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(880, now);
        gain1.gain.setValueAtTime(0.08, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc1.connect(gain1).connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.2);

        // Shimmer overtone: E6 (1320Hz)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1320, now);
        gain2.gain.setValueAtTime(0.03, now);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc2.connect(gain2).connect(ctx.destination);
        osc2.start(now);
        osc2.stop(now + 0.2);
    }
}
