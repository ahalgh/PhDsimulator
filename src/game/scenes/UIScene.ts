import { Scene, GameObjects } from 'phaser';
import { EventBus } from '../EventBus';
import { VillageProgress, Resources } from '../types/gameState';

export class UIScene extends Scene {
    private resourceTexts: Record<string, GameObjects.Text> = {};
    private titleText!: GameObjects.Text;
    private lastUpdatedText!: GameObjects.Text;
    private panelBg!: GameObjects.Rectangle;

    constructor() {
        super('UIScene');
    }

    create(data: { progress: VillageProgress }) {
        const progress = data.progress;

        // Semi-transparent top bar
        this.panelBg = this.add.rectangle(
            this.scale.width / 2, 20,
            this.scale.width, 40,
            0x000000, 0.6
        ).setScrollFactor(0);

        // Title
        this.titleText = this.add.text(10, 8, 'Atlantis', {
            fontFamily: 'Georgia, serif',
            fontSize: '18px',
            color: '#FFD700',
            fontStyle: 'bold',
        }).setScrollFactor(0).setDepth(100);

        // Resource display
        const resourceStartX = 180;
        const spacing = 160;

        // Research Points
        this.add.image(resourceStartX, 20, 'icon_research')
            .setScrollFactor(0).setDepth(100);
        this.resourceTexts.researchPoints = this.add.text(
            resourceStartX + 16, 12,
            `RP: ${progress.resources.researchPoints}`,
            { fontFamily: 'Arial', fontSize: '13px', color: '#42A5F5' }
        ).setScrollFactor(0).setDepth(100);

        // Knowledge
        this.add.image(resourceStartX + spacing, 20, 'icon_knowledge')
            .setScrollFactor(0).setDepth(100);
        this.resourceTexts.knowledge = this.add.text(
            resourceStartX + spacing + 16, 12,
            `KN: ${progress.resources.knowledge}`,
            { fontFamily: 'Arial', fontSize: '13px', color: '#AB47BC' }
        ).setScrollFactor(0).setDepth(100);

        // Reputation
        this.add.image(resourceStartX + spacing * 2, 20, 'icon_reputation')
            .setScrollFactor(0).setDepth(100);
        this.resourceTexts.reputation = this.add.text(
            resourceStartX + spacing * 2 + 16, 12,
            `REP: ${progress.resources.reputation}`,
            { fontFamily: 'Arial', fontSize: '13px', color: '#FFD700' }
        ).setScrollFactor(0).setDepth(100);

        // Last updated text (bottom right)
        const lastUpdated = progress.lastUpdated
            ? new Date(progress.lastUpdated).toLocaleDateString()
            : 'Never';
        this.lastUpdatedText = this.add.text(
            this.scale.width - 10, this.scale.height - 10,
            `Last synced: ${lastUpdated}`,
            { fontFamily: 'Arial', fontSize: '11px', color: '#888888' }
        ).setOrigin(1, 1).setScrollFactor(0).setDepth(100);

        // Controls hint (bottom left)
        this.add.text(10, this.scale.height - 10,
            'Arrow keys to move | Scroll to zoom | Click NPCs & buildings | Tab for progress | Ship to travel',
            { fontFamily: 'Arial', fontSize: '11px', color: '#666666' }
        ).setOrigin(0, 1).setScrollFactor(0).setDepth(100);

        // Dashboard toggle button (top right, before mute)
        const dashBtn = this.add.text(
            this.scale.width - 80, 8, '\u2261',
            {
                fontFamily: 'Arial',
                fontSize: '20px',
                color: '#FFD700',
                fontStyle: 'bold',
                backgroundColor: 'rgba(0,0,0,0.4)',
                padding: { x: 6, y: 2 },
            }
        ).setScrollFactor(0).setDepth(100).setInteractive({ useHandCursor: true });

        dashBtn.on('pointerdown', () => EventBus.emit('toggle-dashboard'));
        dashBtn.on('pointerover', () => dashBtn.setAlpha(0.7));
        dashBtn.on('pointerout', () => dashBtn.setAlpha(1));

        // Mute toggle button (top right)
        const isMuted = localStorage.getItem('phd-sim-muted') === 'true';
        const muteBtn = this.add.text(
            this.scale.width - 40, 8,
            isMuted ? 'M' : '\u266A',
            {
                fontFamily: 'Arial',
                fontSize: '20px',
                color: '#FFD700',
                fontStyle: 'bold',
                backgroundColor: 'rgba(0,0,0,0.4)',
                padding: { x: 6, y: 2 },
            }
        ).setScrollFactor(0).setDepth(100).setInteractive({ useHandCursor: true });

        muteBtn.on('pointerdown', () => {
            this.sound.mute = !this.sound.mute;
            muteBtn.setText(this.sound.mute ? 'M' : '\u266A');
            try {
                localStorage.setItem('phd-sim-muted', String(this.sound.mute));
            } catch { /* ignore */ }
        });

        muteBtn.on('pointerover', () => muteBtn.setAlpha(0.7));
        muteBtn.on('pointerout', () => muteBtn.setAlpha(1));

        // Listen for updates from VillageScene
        EventBus.on('village-updated', (updatedProgress: VillageProgress) => {
            this.updateResources(updatedProgress.resources);
        });
    }

    private updateResources(resources: Resources) {
        this.resourceTexts.researchPoints.setText(`RP: ${resources.researchPoints}`);
        this.resourceTexts.knowledge.setText(`KN: ${resources.knowledge}`);
        this.resourceTexts.reputation.setText(`REP: ${resources.reputation}`);
    }
}
