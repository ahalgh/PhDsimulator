import { Scene } from 'phaser';
import { BuildingType } from '../types/gameState';

export class Preloader extends Scene {
    constructor() {
        super('Preloader');
    }

    init() {
        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2;

        this.cameras.main.setBackgroundColor(0x1a3d0a);

        this.add.text(cx, cy - 60, 'PhD Simulator', {
            fontFamily: 'Georgia, serif',
            fontSize: '32px',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 4,
        }).setOrigin(0.5);

        this.add.text(cx, cy - 25, 'Loading your village...', {
            fontFamily: 'Arial',
            fontSize: '14px',
            color: '#aaaaaa',
        }).setOrigin(0.5);

        this.add.rectangle(cx, cy + 20, 300, 20).setStrokeStyle(2, 0xffd700);
        const bar = this.add.rectangle(cx - 148, cy + 20, 4, 16, 0xffd700);

        this.load.on('progress', (progress: number) => {
            bar.width = 4 + (292 * progress);
        });
    }

    preload() {
        this.load.setPath('assets');

        // Terrain tiles (expanded set)
        const tileTypes = [
            'grass', 'grass_dark', 'grass_light', 'water', 'water_deep',
            'path', 'path_cross', 'sand', 'stone', 'stone_moss', 'dirt', 'bridge'
        ];
        for (const tile of tileTypes) {
            this.load.svg(`tile_${tile}`, `tiles/${tile}.svg`, { width: 64, height: 32 });
        }

        // Building sprites (all levels for each type) — now 96px tall
        const buildingTypes = Object.values(BuildingType);
        for (const type of buildingTypes) {
            for (let lv = 1; lv <= 5; lv++) {
                this.load.svg(`${type}_lv${lv}`, `buildings/${type}/lv${lv}.svg`, { width: 64, height: 96 });
            }
        }

        // Decorations (expanded)
        this.load.svg('deco_tree', 'decorations/tree_oak.svg', { width: 40, height: 56 });
        this.load.svg('deco_tree_oak', 'decorations/tree_oak.svg', { width: 40, height: 56 });
        this.load.svg('deco_tree_pine', 'decorations/tree_pine.svg', { width: 40, height: 56 });
        this.load.svg('deco_tree_willow', 'decorations/tree_willow.svg', { width: 40, height: 56 });
        this.load.svg('deco_tree_cherry', 'decorations/tree_cherry.svg', { width: 40, height: 56 });
        this.load.svg('deco_rock_sm', 'decorations/rock_sm.svg', { width: 30, height: 24 });
        this.load.svg('deco_rock_lg', 'decorations/rock_lg.svg', { width: 30, height: 24 });
        this.load.svg('deco_flowers', 'decorations/flowers.svg', { width: 32, height: 20 });
        this.load.svg('deco_torch', 'decorations/torch.svg', { width: 16, height: 36 });
        this.load.svg('deco_mushroom', 'decorations/mushroom.svg', { width: 20, height: 18 });
        this.load.svg('deco_fence', 'decorations/fence.svg', { width: 64, height: 20 });
        this.load.svg('deco_cloud', 'decorations/cloud.svg', { width: 80, height: 30 });
        this.load.svg('deco_banner', 'decorations/banner_01.svg', { width: 40, height: 50 });
        this.load.svg('deco_fountain', 'decorations/fountain_01.svg', { width: 50, height: 50 });

        // Dock and ship
        this.load.svg('tile_dock', 'tiles/dock.svg', { width: 64, height: 32 });
        this.load.svg('deco_ship', 'decorations/ship.svg', { width: 64, height: 96 });

        // Characters
        this.load.svg('scholar', 'characters/scholar.svg', { width: 32, height: 48 });
        this.load.svg('villager_farmer', 'characters/villager_farmer.svg', { width: 24, height: 36 });
        this.load.svg('villager_guard', 'characters/villager_guard.svg', { width: 24, height: 36 });
        this.load.svg('villager_merchant', 'characters/villager_merchant.svg', { width: 24, height: 36 });

        // UI icons
        this.load.svg('icon_research', 'ui/icon_research.svg', { width: 24, height: 24 });
        this.load.svg('icon_knowledge', 'ui/icon_knowledge.svg', { width: 24, height: 24 });
        this.load.svg('icon_reputation', 'ui/icon_reputation.svg', { width: 24, height: 24 });

        // Background music
        this.load.audio('bgm_lofi', 'audio/bgm_lofi.wav');
    }

    create() {
        // Generate particle dot texture (no external file needed)
        const gfx = this.make.graphics({ x: 0, y: 0 });
        gfx.fillStyle(0xffffff, 1);
        gfx.fillCircle(4, 4, 4);
        gfx.generateTexture('particle_dot', 8, 8);
        gfx.destroy();

        this.scene.start('VillageScene');
    }
}
