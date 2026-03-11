import { Scene, GameObjects } from 'phaser';
import { EventBus } from '../EventBus';
import { BuildingType, VillageProgress, TravelDestination, getDefaultVillageProgress } from '../types/gameState';
import { BUILDING_CONFIGS, BUILDING_ACADEMIC_CONTEXT, VILLAGE_LAYOUT, TRAVEL_DESTINATIONS, TravelDestinationConfig } from '../data/buildingConfig';
import { loadState, getStateDiff } from '../../lib/stateManager';
import { NpcId, NPC_CONFIGS } from '../data/dialogueConfig';
import { DialogueSystem } from '../systems/DialogueSystem';
import { AchievementSystem } from '../systems/AchievementSystem';
import { SoundEffects } from '../systems/SoundEffects';
import { ParticleEffects } from '../systems/ParticleEffects';
import { AchievementDefinition, ACHIEVEMENTS, CATEGORY_META, AchievementCategory, TIER_COLORS } from '../data/achievementConfig';

interface PlacedBuilding {
    type: BuildingType;
    level: number;
    sprite: GameObjects.Image;
    label: GameObjects.Text;
    tileX: number;
    tileY: number;
}

interface PlacedDecoration {
    type: string;
    sprite: GameObjects.Image;
    tileX: number;
    tileY: number;
}

// Seeded random for deterministic map features
function seededRandom(seed: number) {
    let s = seed;
    return () => {
        s = (s * 16807 + 0) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

export class VillageScene extends Scene {
    private buildings: PlacedBuilding[] = [];
    private decorations: PlacedDecoration[] = [];
    private scholar!: GameObjects.Image;
    private villageProgress: VillageProgress = getDefaultVillageProgress();
    private tooltip!: GameObjects.Container;
    private tooltipBg!: GameObjects.Rectangle;
    private tooltipTitle!: GameObjects.Text;
    private tooltipDesc!: GameObjects.Text;
    private wanderingNPCs: { npcId: NpcId; sprite: GameObjects.Image; homeTile: { x: number; y: number }; indicator: GameObjects.Text }[] = [];

    // NPC dialogue
    private dialogueSystem!: DialogueSystem;
    private dialogueOverlayItems: GameObjects.GameObject[] = [];
    private dialogueOverlayVisible = false;
    private typewriterEvent: Phaser.Time.TimerEvent | null = null;

    // Camera drag state
    private isDragging = false;
    private dragStartX = 0;
    private dragStartY = 0;
    private camStartX = 0;
    private camStartY = 0;

    // Scholar movement state
    private scholarTileX = 9;
    private scholarTileY = 8;
    private isMoving = false;
    private lastMoveTime = 0;
    private occupiedTiles!: Set<string>;
    private idleBobTween: Phaser.Tweens.Tween | null = null;

    // Ship & travel overlay
    private shipSprite!: GameObjects.Image;
    private travelOverlayItems: GameObjects.GameObject[] = [];
    private travelOverlayVisible = false;

    // Dashboard overlay
    private dashboardOverlayItems: GameObjects.GameObject[] = [];
    private dashboardOverlayVisible = false;

    // Achievement system
    private achievementSystem!: AchievementSystem;

    // Trophy case overlay
    private trophyCaseOverlayItems: GameObjects.GameObject[] = [];
    private trophyCaseOverlayVisible = false;
    private trophyCaseCategory: AchievementCategory | 'all' = 'all';

    // Achievement toast queue
    private achievementToastQueue: AchievementDefinition[] = [];
    private isShowingToast = false;

    // Building detail panel
    private buildingDetailItems: GameObjects.GameObject[] = [];
    private buildingDetailVisible = false;
    private buildingDetailType: BuildingType | null = null;

    // Audio & effects
    private bgm: Phaser.Sound.BaseSound | null = null;
    private musicStarted = false;
    private sfx!: SoundEffects;
    private particles!: ParticleEffects;
    private ambientGlowEmitters: GameObjects.Particles.ParticleEmitter[] = [];

    constructor() {
        super('VillageScene');
    }

    create() {
        this.cameras.main.setBackgroundColor(0x0d2b06);

        const state = loadState();
        this.villageProgress = state.village;
        this.dialogueSystem = new DialogueSystem();
        this.achievementSystem = new AchievementSystem();
        this.sfx = new SoundEffects(this);
        this.particles = new ParticleEffects(this);

        this.buildCollisionMap();
        this.renderGround();
        this.placeAmbientDecorations();
        this.placeBuildings();
        this.placeDataDecorations();
        this.placeScholar();
        this.placeDockAndShip();
        this.placeWanderingNPCs();
        this.spawnClouds();
        this.createTooltip();
        this.setupCamera();
        this.setupInput();
        this.setupAudio();

        const diff = getStateDiff(state.previousVillage, state.village);
        if (diff.buildingUpgrades.length > 0) {
            this.animateUpgrades(diff.buildingUpgrades);
        }

        this.scene.launch('UIScene', { progress: this.villageProgress });
        EventBus.on('toggle-dashboard', () => this.toggleDashboard());
        EventBus.on('toggle-trophy-case', () => this.toggleTrophyCase());
        EventBus.on('achievement-unlocked', (a: AchievementDefinition) => this.queueAchievementToast(a));
        EventBus.on('ui-click', () => this.sfx.playClick());

        // Check achievements on initial load
        this.achievementSystem.checkAchievements(state.village, state.config);

        EventBus.emit('current-scene-ready', this);
    }

    private tileToScreen(tileX: number, tileY: number): { x: number; y: number } {
        const { tileWidth, tileHeight, gridWidth, gridHeight } = VILLAGE_LAYOUT;
        // Center the isometric grid in a larger world space
        const offsetX = (gridWidth + gridHeight) * (tileWidth / 4) + 100;
        const offsetY = 80;

        const x = (tileX - tileY) * (tileWidth / 2) + offsetX;
        const y = (tileX + tileY) * (tileHeight / 2) + offsetY;
        return { x, y };
    }

    // ─── Collision map ───
    private buildCollisionMap() {
        const { gridWidth, gridHeight, plots, dock } = VILLAGE_LAYOUT;
        this.occupiedTiles = new Set<string>();

        // Mark ALL tiles as occupied first, then carve out walkable areas
        for (let ty = 0; ty < gridHeight; ty++) {
            for (let tx = 0; tx < gridWidth; tx++) {
                this.occupiedTiles.add(`${tx},${ty}`);
            }
        }

        // Carve out walkable village island (within radius ~7 of center 9,9)
        for (let ty = 0; ty < gridHeight; ty++) {
            for (let tx = 0; tx < gridWidth; tx++) {
                const villageDist = Math.sqrt((tx - 9) ** 2 + (ty - 9) ** 2);
                if (villageDist <= 7) {
                    this.occupiedTiles.delete(`${tx},${ty}`);
                }
            }
        }

        // Re-block building plots
        for (const pos of Object.values(plots)) {
            this.occupiedTiles.add(`${pos.tileX},${pos.tileY}`);
        }

        // Re-block house plots (occupied ones)
        const houseCount = Math.min(
            this.villageProgress.buildings.houses.count,
            VILLAGE_LAYOUT.housePlots.length
        );
        for (let i = 0; i < houseCount; i++) {
            const plot = VILLAGE_LAYOUT.housePlots[i];
            this.occupiedTiles.add(`${plot.tileX},${plot.tileY}`);
        }

        // Fountain and dock
        this.occupiedTiles.add('9,9');
        this.occupiedTiles.add(`${dock.tileX},${dock.tileY}`);
    }

    private isWalkable(tx: number, ty: number): boolean {
        const { gridWidth, gridHeight } = VILLAGE_LAYOUT;
        if (tx < 0 || ty < 0 || tx >= gridWidth || ty >= gridHeight) return false;
        return !this.occupiedTiles.has(`${tx},${ty}`);
    }

    // ─── Terrain generation with biomes ───
    private renderGround() {
        const { gridWidth, gridHeight } = VILLAGE_LAYOUT;
        const rng = seededRandom(42);

        for (let ty = 0; ty < gridHeight; ty++) {
            for (let tx = 0; tx < gridWidth; tx++) {
                const { x, y } = this.tileToScreen(tx, ty);
                const tileKey = this.getTileType(tx, ty, rng);
                this.add.image(x, y, tileKey).setDepth(ty);
            }
        }
    }

    private getTileType(tx: number, ty: number, rng: () => number): string {
        const { gridWidth, gridHeight, dock } = VILLAGE_LAYOUT;

        // Village island center
        const vcx = 9, vcy = 9;
        const villageDist = Math.sqrt((tx - vcx) ** 2 + (ty - vcy) ** 2);

        // Dock tile
        if (tx === dock.tileX && ty === dock.tileY) return 'tile_dock';

        // ─── Village island ───
        if (villageDist <= 8) {
            // Outer edge of village island → water/shore
            if (villageDist > 7.5) return 'tile_water';
            if (villageDist > 7) return rng() > 0.5 ? 'tile_sand' : 'tile_grass_light';

            // Main paths — cross shape through the village center
            const onVertPath = tx === 9 && ty >= 4 && ty <= 14;
            const onHorizPath = ty === 9 && tx >= 4 && tx <= 14;
            if (onVertPath || onHorizPath) {
                if (onVertPath && onHorizPath) return 'tile_path_cross';
                return 'tile_path';
            }

            // Secondary paths from buildings to main path
            const isSecondaryPath =
                (tx === 6 && ty >= 7 && ty <= 9) ||
                (tx === 12 && ty >= 7 && ty <= 9) ||
                (tx === 6 && ty >= 9 && ty <= 11) ||
                (tx === 12 && ty >= 9 && ty <= 11) ||
                (ty === 5 && tx >= 9 && tx <= 9);
            if (isSecondaryPath) return 'tile_path';

            // Stone plaza around fountain center
            if (villageDist <= 1.5) return 'tile_stone';

            // Village interior
            if (villageDist <= 5) {
                const r = rng();
                if (r < 0.1) return 'tile_grass_dark';
                if (r < 0.18) return 'tile_grass_light';
                return 'tile_grass';
            }

            // Outer forest floor
            const r = rng();
            if (r < 0.15) return 'tile_grass_dark';
            if (r < 0.25) return 'tile_dirt';
            if (r < 0.3) return 'tile_stone_moss';
            return 'tile_grass';
        }

        // ─── Global water border ───
        const edgeDist = Math.min(tx, ty, gridWidth - 1 - tx, gridHeight - 1 - ty);
        if (edgeDist === 0) return 'tile_water_deep';

        // Everything else is water
        return rng() > 0.7 ? 'tile_water_deep' : 'tile_water';
    }

    // ─── Ambient decorations (always present, not data-driven) ───
    private placeAmbientDecorations() {
        const { gridHeight, gridWidth } = VILLAGE_LAYOUT;
        const vcx = 9, vcy = 9;
        const rng = seededRandom(123);

        for (let ty = 2; ty < gridHeight - 2; ty++) {
            for (let tx = 2; tx < gridWidth - 2; tx++) {
                const villageDist = Math.sqrt((tx - vcx) ** 2 + (ty - vcy) ** 2);
                const r = rng();

                // Village island decorations
                if (villageDist < 7.5 && villageDist >= 4.5) {
                    if (villageDist >= 5 && villageDist <= 7) {
                        if (r < 0.35) {
                            this.placeTree(tx, ty, rng);
                        } else if (r < 0.4) {
                            this.placeSmallDeco(tx, ty, rng);
                        }
                    }
                }
            }
        }

        // Torches along main paths
        const torchPositions = [
            { tileX: 9, tileY: 4 }, { tileX: 9, tileY: 6 },
            { tileX: 9, tileY: 12 }, { tileX: 9, tileY: 14 },
            { tileX: 5, tileY: 9 }, { tileX: 7, tileY: 9 },
            { tileX: 11, tileY: 9 }, { tileX: 13, tileY: 9 },
        ];
        for (const pos of torchPositions) {
            const { x, y } = this.tileToScreen(pos.tileX, pos.tileY);
            const torch = this.add.image(x + 10, y - 14, 'deco_torch')
                .setDepth(pos.tileY * 10 + 4);

            // Torch flicker animation
            this.tweens.add({
                targets: torch,
                scaleX: { from: 0.95, to: 1.05 },
                scaleY: { from: 0.95, to: 1.05 },
                alpha: { from: 0.85, to: 1 },
                duration: 300 + Math.random() * 200,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1,
            });
        }

        // Flower patches near buildings
        const flowerPositions = [
            { tileX: 5, tileY: 7 }, { tileX: 7, tileY: 7 },
            { tileX: 5, tileY: 11 }, { tileX: 7, tileY: 11 },
            { tileX: 11, tileY: 7 }, { tileX: 13, tileY: 7 },
            { tileX: 11, tileY: 11 }, { tileX: 13, tileY: 11 },
        ];
        for (const pos of flowerPositions) {
            const { x, y } = this.tileToScreen(pos.tileX, pos.tileY);
            this.add.image(x, y, 'deco_flowers')
                .setDepth(pos.tileY * 10 + 2);
        }
    }

    private placeTree(tx: number, ty: number, rng: () => number) {
        const { x, y } = this.tileToScreen(tx, ty);
        const treeTypes = ['deco_tree_oak', 'deco_tree_pine', 'deco_tree_willow', 'deco_tree_pine'];
        const treeKey = treeTypes[Math.floor(rng() * treeTypes.length)];
        const offsetX = (rng() - 0.5) * 12;
        const offsetY = (rng() - 0.5) * 6;
        const scale = 0.8 + rng() * 0.4;

        const tree = this.add.image(x + offsetX, y - 20 + offsetY, treeKey)
            .setDepth(ty * 10 + 3)
            .setScale(scale);

        // Gentle sway animation
        this.tweens.add({
            targets: tree,
            angle: { from: -1.5, to: 1.5 },
            duration: 2000 + rng() * 2000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1,
            delay: rng() * 1000,
        });
    }

    private placeSmallDeco(tx: number, ty: number, rng: () => number) {
        const { x, y } = this.tileToScreen(tx, ty);
        const r = rng();
        if (r < 0.35) {
            const key = rng() > 0.5 ? 'deco_rock_sm' : 'deco_rock_lg';
            this.add.image(x, y - 4, key).setDepth(ty * 10 + 2);
        } else if (r < 0.6) {
            this.add.image(x, y - 2, 'deco_mushroom').setDepth(ty * 10 + 2);
        } else {
            this.add.image(x, y, 'deco_flowers').setDepth(ty * 10 + 2);
        }
    }

    // ─── Buildings ───
    private placeBuildings() {
        // Clean up old ambient glow emitters
        for (const emitter of this.ambientGlowEmitters) {
            emitter.destroy();
        }
        this.ambientGlowEmitters = [];

        const { plots } = VILLAGE_LAYOUT;
        const mainBuildingTypes = [
            BuildingType.CASTLE,
            BuildingType.LIBRARY,
            BuildingType.LABORATORY,
            BuildingType.TOWER,
            BuildingType.WORKSHOP,
        ] as const;

        for (const type of mainBuildingTypes) {
            const plot = plots[type];
            const buildingData = this.villageProgress.buildings[type];
            const level = buildingData.level;
            const config = BUILDING_CONFIGS[type];

            const { x, y } = this.tileToScreen(plot.tileX, plot.tileY);

            const spriteKey = `${type}_lv${level}`;
            const sprite = this.add.image(x, y - 32, spriteKey)
                .setDepth(plot.tileY * 10 + 5)
                .setInteractive({ useHandCursor: true });

            const label = this.add.text(x, y - 80, config.label, {
                fontFamily: 'Georgia, serif',
                fontSize: '11px',
                color: '#FFD700',
                stroke: '#000000',
                strokeThickness: 3,
            }).setOrigin(0.5).setDepth(plot.tileY * 10 + 6).setAlpha(0);

            sprite.on('pointerover', () => {
                sprite.setScale(1.08);
                label.setAlpha(1);
                this.showTooltip(x, y - 100, config.label, `${config.description}\nLevel ${level} (${buildingData.rawCount})`);
            });

            sprite.on('pointerout', () => {
                sprite.setScale(1.0);
                label.setAlpha(0);
                this.hideTooltip();
            });

            sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
                pointer.event.stopPropagation();
                this.hideTooltip();
                this.sfx.playClick();
                this.showBuildingDetail(type);
            });

            this.buildings.push({ type, level, sprite, label, tileX: plot.tileX, tileY: plot.tileY });

            // Max-level ambient glow
            if (level === 5) {
                const glowEmitter = this.particles.createAmbientGlow(x, y - 32, plot.tileY * 10 + 7);
                this.ambientGlowEmitters.push(glowEmitter);
            }
        }

        // Houses
        const houseCount = Math.min(
            this.villageProgress.buildings.houses.count,
            VILLAGE_LAYOUT.housePlots.length
        );
        for (let i = 0; i < houseCount; i++) {
            const plot = VILLAGE_LAYOUT.housePlots[i];
            const { x, y } = this.tileToScreen(plot.tileX, plot.tileY);
            const level = Math.min(
                Math.floor(this.villageProgress.buildings.houses.count / VILLAGE_LAYOUT.housePlots.length) + 1,
                5
            );
            const sprite = this.add.image(x, y - 32, `house_lv${level}`)
                .setDepth(plot.tileY * 10 + 5)
                .setScale(0.85)
                .setInteractive({ useHandCursor: true });

            sprite.on('pointerover', () => {
                sprite.setScale(0.92);
                this.showTooltip(x, y - 100, 'Village House', `${this.villageProgress.buildings.houses.count} houses built`);
            });
            sprite.on('pointerout', () => {
                sprite.setScale(0.85);
                this.hideTooltip();
            });
            sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
                pointer.event.stopPropagation();
                this.hideTooltip();
                this.sfx.playClick();
                this.showBuildingDetail(BuildingType.HOUSE);
            });

            this.buildings.push({
                type: BuildingType.HOUSE, level, sprite,
                label: this.add.text(0, 0, '').setAlpha(0),
                tileX: plot.tileX, tileY: plot.tileY,
            });
        }
    }

    // ─── Data-driven decorations (banners, fountains, etc.) ───
    private placeDataDecorations() {
        const { decorationZones } = VILLAGE_LAYOUT;

        // Progress-driven trees
        const treeCount = Math.min(this.villageProgress.decorations.trees, decorationZones.trees.length);
        for (let i = 0; i < treeCount; i++) {
            const pos = decorationZones.trees[i];
            const { x, y } = this.tileToScreen(pos.tileX, pos.tileY);
            const types = ['deco_tree_cherry', 'deco_tree_oak', 'deco_tree_willow'];
            const sprite = this.add.image(x, y - 20, types[i % types.length])
                .setDepth(pos.tileY * 10 + 3);

            this.tweens.add({
                targets: sprite,
                angle: { from: -1, to: 1 },
                duration: 2500,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1,
            });

            this.decorations.push({ type: 'tree', sprite, tileX: pos.tileX, tileY: pos.tileY });
        }

        // Banners
        const bannerCount = Math.min(this.villageProgress.decorations.banners, decorationZones.banners.length);
        for (let i = 0; i < bannerCount; i++) {
            const pos = decorationZones.banners[i];
            const { x, y } = this.tileToScreen(pos.tileX, pos.tileY);
            const sprite = this.add.image(x, y - 16, 'deco_banner')
                .setDepth(pos.tileY * 10 + 3);

            // Banner wave animation
            this.tweens.add({
                targets: sprite,
                scaleX: { from: 0.95, to: 1.05 },
                duration: 800,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1,
            });

            this.decorations.push({ type: 'banner', sprite, tileX: pos.tileX, tileY: pos.tileY });
        }

        // Fountain (always place one at center for visual anchor)
        const fountainPos = decorationZones.fountains[0];
        const { x: fx, y: fy } = this.tileToScreen(fountainPos.tileX, fountainPos.tileY);
        const fountain = this.add.image(fx, fy - 16, 'deco_fountain')
            .setDepth(fountainPos.tileY * 10 + 4);

        // Fountain shimmer
        this.tweens.add({
            targets: fountain,
            alpha: { from: 0.9, to: 1 },
            scaleY: { from: 0.98, to: 1.02 },
            duration: 1500,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1,
        });
    }

    // ─── Dock and Ship ───
    private placeDockAndShip() {
        const { dock } = VILLAGE_LAYOUT;

        // Place ship sprite in the water offshore
        const { x: sx, y: sy } = this.tileToScreen(dock.shipTileX, dock.shipTileY);
        this.shipSprite = this.add.image(sx, sy - 32, 'deco_ship')
            .setDepth(dock.shipTileY * 10 + 5)
            .setInteractive(
                new Phaser.Geom.Rectangle(-16, -16, 96, 128),
                Phaser.Geom.Rectangle.Contains
            );
        this.shipSprite.input!.cursor = 'pointer';

        // Gentle bobbing animation
        this.tweens.add({
            targets: this.shipSprite,
            y: this.shipSprite.y - 4,
            duration: 2000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1,
        });

        // Ship label
        const shipLabel = this.add.text(sx, sy - 80, 'The Voyager', {
            fontFamily: 'Georgia, serif',
            fontSize: '13px',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 3,
        }).setOrigin(0.5).setDepth(dock.shipTileY * 10 + 6).setAlpha(0);

        this.shipSprite.on('pointerover', () => {
            this.shipSprite.setScale(1.08);
            shipLabel.setAlpha(1);
            this.showTooltip(sx, sy - 100, 'The Voyager', 'Click to open the travel map');
        });

        this.shipSprite.on('pointerout', () => {
            this.shipSprite.setScale(1.0);
            shipLabel.setAlpha(0);
            this.hideTooltip();
        });

        this.shipSprite.on('pointerdown', () => {
            this.hideTooltip();
            this.sfx.playClick();
            this.toggleTravelOverlay();
        });

        // Torch at dock
        const { x: dx, y: dy } = this.tileToScreen(dock.tileX, dock.tileY);
        const dockTorch = this.add.image(dx + 10, dy - 14, 'deco_torch')
            .setDepth(dock.tileY * 10 + 4);
        this.tweens.add({
            targets: dockTorch,
            scaleX: { from: 0.95, to: 1.05 },
            scaleY: { from: 0.95, to: 1.05 },
            alpha: { from: 0.85, to: 1 },
            duration: 350,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1,
        });
    }

    // ─── Travel overlay ───
    private toggleTravelOverlay() {
        if (this.dialogueOverlayVisible) this.closeNpcDialogue();
        if (this.dashboardOverlayVisible) this.hideDashboard();
        if (this.buildingDetailVisible) this.hideBuildingDetail();
        if (this.travelOverlayVisible) {
            this.hideTravelOverlay();
        } else {
            this.showTravelOverlay();
        }
    }

    private showTravelOverlay() {
        this.travelOverlayVisible = true;
        this.sfx.playOpen();
        const cam = this.cameras.main;
        const w = cam.width;
        const h = cam.height;
        const items: GameObjects.GameObject[] = [];

        // Dark backdrop
        const backdrop = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.8)
            .setScrollFactor(0).setDepth(3000)
            .setInteractive();

        // Clicking backdrop closes overlay
        backdrop.on('pointerdown', () => this.hideTravelOverlay());
        items.push(backdrop);

        // Title (below HUD bar at ~30px)
        const title = this.add.text(w / 2, 60, 'Sea Chart of Atlantis', {
            fontFamily: 'Georgia, serif',
            fontSize: '22px',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 4,
            fontStyle: 'bold',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3001);
        items.push(title);

        // Home node (Atlantis)
        const centerX = w / 2;
        const centerY = h / 2 + 10;
        const homeDot = this.add.circle(centerX, centerY, 16, 0xFFD700)
            .setScrollFactor(0).setDepth(3002);
        const homeLabel = this.add.text(centerX, centerY + 24, 'Atlantis', {
            fontFamily: 'Georgia, serif', fontSize: '12px', color: '#FFD700',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);
        items.push(homeDot, homeLabel);

        // Destination nodes arranged in a circle
        const destinations = this.villageProgress.travelDestinations;
        const allDests = TRAVEL_DESTINATIONS;
        const nodeRadius = Math.min(w, h) * 0.32;

        allDests.forEach((destConfig, i) => {
            const angle = (i / allDests.length) * Math.PI * 2 - Math.PI / 2;
            const nx = centerX + Math.cos(angle) * nodeRadius;
            const ny = centerY + Math.sin(angle) * nodeRadius;
            const unlocked = destinations.find(d => d.id === destConfig.id);

            // Dashed line from center to node
            const line = this.add.graphics().setScrollFactor(0).setDepth(3001);
            line.lineStyle(1, unlocked ? 0xFFD700 : 0x333333, unlocked ? 0.5 : 0.2);
            const steps = 16;
            for (let s = 0; s < steps; s += 2) {
                const t1 = s / steps;
                const t2 = (s + 1) / steps;
                line.moveTo(
                    centerX + (nx - centerX) * t1,
                    centerY + (ny - centerY) * t1
                );
                line.lineTo(
                    centerX + (nx - centerX) * t2,
                    centerY + (ny - centerY) * t2
                );
            }
            line.strokePath();
            items.push(line);

            // Node circle
            const nodeColor = unlocked ? destConfig.themeColor : 0x333333;
            const node = this.add.circle(nx, ny, 12, nodeColor)
                .setScrollFactor(0).setDepth(3002);
            if (unlocked) {
                node.setInteractive({ useHandCursor: true });
                node.on('pointerover', () => node.setScale(1.25));
                node.on('pointerout', () => node.setScale(1.0));
                node.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
                    pointer.event.stopPropagation();
                    this.showDestinationPopup(unlocked, destConfig);
                });
            } else {
                node.setAlpha(0.4);
            }
            items.push(node);

            // Label
            const label = this.add.text(nx, ny + 18, destConfig.fantasyName, {
                fontFamily: 'Georgia, serif', fontSize: '9px',
                color: unlocked ? '#ffffff' : '#555555',
                stroke: '#000', strokeThickness: 2,
            }).setOrigin(0.5).setScrollFactor(0).setDepth(3002);
            items.push(label);

            // Lock icon or checkmark
            if (!unlocked) {
                const lockIcon = this.add.text(nx, ny - 1, '?', {
                    fontFamily: 'Arial', fontSize: '12px', color: '#555555',
                    fontStyle: 'bold',
                }).setOrigin(0.5).setScrollFactor(0).setDepth(3003);
                items.push(lockIcon);
            }
        });

        // Close hint
        const closeHint = this.add.text(w / 2, h - 30, 'Click anywhere to close', {
            fontFamily: 'Arial', fontSize: '11px', color: '#666666',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3001);
        items.push(closeHint);

        this.travelOverlayItems = items;
    }

    private showDestinationPopup(dest: TravelDestination, config: TravelDestinationConfig) {
        const cam = this.cameras.main;
        const popupItems: GameObjects.GameObject[] = [];

        const bg = this.add.rectangle(cam.width / 2, cam.height / 2, 280, 130, 0x1a1a2e, 0.95)
            .setStrokeStyle(2, config.themeColor)
            .setScrollFactor(0).setDepth(3100);
        popupItems.push(bg);

        const titleText = this.add.text(cam.width / 2, cam.height / 2 - 40, dest.fantasyName, {
            fontFamily: 'Georgia, serif', fontSize: '18px',
            color: '#FFD700', fontStyle: 'bold',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3101);
        popupItems.push(titleText);

        const confText = this.add.text(cam.width / 2, cam.height / 2 - 15, `Conference: ${dest.name}`, {
            fontFamily: 'Arial', fontSize: '12px', color: '#aaaaaa',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3101);
        popupItems.push(confText);

        const descText = this.add.text(cam.width / 2, cam.height / 2 + 5, config.description, {
            fontFamily: 'Arial', fontSize: '11px', color: '#cccccc',
            fontStyle: 'italic',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3101);
        popupItems.push(descText);

        const unlockText = this.add.text(cam.width / 2, cam.height / 2 + 30, 'Destination unlocked!', {
            fontFamily: 'Georgia, serif', fontSize: '13px', color: '#66BB6A',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3101);
        popupItems.push(unlockText);

        // Auto-dismiss after 3 seconds
        this.time.delayedCall(3000, () => {
            for (const item of popupItems) item.destroy();
        });
    }

    private hideTravelOverlay() {
        this.sfx.playClose();
        for (const item of this.travelOverlayItems) {
            item.destroy();
        }
        this.travelOverlayItems = [];
        this.travelOverlayVisible = false;
    }

    // ─── Scholar character ───
    private placeScholar() {
        const { x, y } = this.tileToScreen(this.scholarTileX, this.scholarTileY);
        this.scholar = this.add.image(x, y - 16, 'scholar')
            .setDepth(this.scholarTileY * 10 + 7);

        this.startIdleBob();
    }

    private startIdleBob() {
        if (this.idleBobTween) return;
        this.idleBobTween = this.tweens.add({
            targets: this.scholar,
            y: this.scholar.y - 3,
            duration: 1200,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1,
        });
    }

    private stopIdleBob() {
        if (this.idleBobTween) {
            this.idleBobTween.stop();
            this.idleBobTween = null;
        }
    }

    private moveScholar(dx: number, dy: number) {
        if (this.isMoving) return;

        const now = this.time.now;
        if (now - this.lastMoveTime < 200) return;

        const newTX = this.scholarTileX + dx;
        const newTY = this.scholarTileY + dy;

        if (!this.isWalkable(newTX, newTY)) return;

        this.isMoving = true;
        this.lastMoveTime = now;
        this.stopIdleBob();

        // Flip sprite based on horizontal screen direction
        const oldScreen = this.tileToScreen(this.scholarTileX, this.scholarTileY);
        const newScreen = this.tileToScreen(newTX, newTY);
        if (newScreen.x < oldScreen.x) {
            this.scholar.setFlipX(true);
        } else if (newScreen.x > oldScreen.x) {
            this.scholar.setFlipX(false);
        }

        this.scholarTileX = newTX;
        this.scholarTileY = newTY;

        this.tweens.add({
            targets: this.scholar,
            x: newScreen.x,
            y: newScreen.y - 16,
            duration: 180,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                this.scholar.setDepth(this.scholarTileY * 10 + 7);
                this.isMoving = false;
                this.startIdleBob();
            },
        });
    }

    // ─── Wandering NPCs ───
    private placeWanderingNPCs() {
        const npcIds: NpcId[] = ['farmer', 'guard', 'merchant'];

        for (const npcId of npcIds) {
            const config = NPC_CONFIGS[npcId];
            const { x, y } = this.tileToScreen(config.homeTile.x, config.homeTile.y);

            const sprite = this.add.image(x, y - 10, config.spriteKey)
                .setDepth(config.homeTile.y * 10 + 4)
                .setScale(0.9)
                .setInteractive(
                    new Phaser.Geom.Rectangle(-8, -12, 40, 52),
                    Phaser.Geom.Rectangle.Contains
                );

            // Exclamation indicator
            const indicator = this.add.text(x, y - 32, '!', {
                fontFamily: 'Georgia, serif',
                fontSize: '14px',
                color: '#FFD700',
                stroke: '#000000',
                strokeThickness: 3,
                fontStyle: 'bold',
            }).setOrigin(0.5).setDepth(config.homeTile.y * 10 + 5);

            // Hover effects
            sprite.on('pointerover', () => {
                sprite.setScale(1.0);
                this.showTooltip(sprite.x, sprite.y - 40, config.displayName, config.title);
            });
            sprite.on('pointerout', () => {
                sprite.setScale(0.9);
                this.hideTooltip();
            });
            sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
                pointer.event.stopPropagation();
                this.hideTooltip();
                this.sfx.playDialogue();
                this.openNpcDialogue(npcId);
            });

            const npcData = { npcId, sprite, homeTile: config.homeTile, indicator };
            this.wanderingNPCs.push(npcData);
            this.wanderNPCWithIndicator(npcData);
        }
    }

    private wanderNPCWithIndicator(npcData: { npcId: NpcId; sprite: GameObjects.Image; homeTile: { x: number; y: number }; indicator: GameObjects.Text }) {
        const wander = () => {
            const dx = Math.floor(Math.random() * 5) - 2;
            const dy = Math.floor(Math.random() * 5) - 2;
            const targetTX = Phaser.Math.Clamp(npcData.homeTile.x + dx, 5, 13);
            const targetTY = Phaser.Math.Clamp(npcData.homeTile.y + dy, 6, 13);
            const { x, y } = this.tileToScreen(targetTX, targetTY);

            npcData.sprite.setFlipX(x < npcData.sprite.x);

            this.tweens.add({
                targets: npcData.sprite,
                x: x,
                y: y - 10,
                duration: 2000 + Math.random() * 3000,
                ease: 'Sine.easeInOut',
                onUpdate: () => {
                    npcData.indicator.x = npcData.sprite.x;
                    const bobOffset = Math.sin(this.time.now * 0.005) * 3;
                    npcData.indicator.y = npcData.sprite.y - 22 + bobOffset;
                },
                onComplete: () => {
                    npcData.indicator.x = npcData.sprite.x;
                    npcData.indicator.y = npcData.sprite.y - 22;
                    this.time.delayedCall(1000 + Math.random() * 4000, wander);
                },
            });
        };

        this.time.delayedCall(Math.random() * 3000, wander);
    }

    // ─── NPC Dialogue Overlay ───
    private openNpcDialogue(npcId: NpcId) {
        if (this.travelOverlayVisible || this.dialogueOverlayVisible || this.dashboardOverlayVisible || this.trophyCaseOverlayVisible || this.buildingDetailVisible) return;

        const line = this.dialogueSystem.selectDialogue(npcId, this.villageProgress);
        if (!line) return;

        this.dialogueOverlayVisible = true;
        const config = NPC_CONFIGS[npcId];
        const cam = this.cameras.main;
        const items: GameObjects.GameObject[] = [];

        const panelW = 340;
        const panelH = 140;
        const panelX = cam.width / 2;
        const panelY = cam.height - 100;

        // Background panel
        const bg = this.add.rectangle(panelX, panelY, panelW, panelH, 0x1a1a2e, 0.95)
            .setStrokeStyle(2, config.themeColor)
            .setScrollFactor(0)
            .setDepth(2800)
            .setInteractive();
        items.push(bg);

        // NPC name
        const nameText = this.add.text(panelX - panelW / 2 + 16, panelY - panelH / 2 + 12, config.displayName, {
            fontFamily: 'Georgia, serif',
            fontSize: '15px',
            color: '#FFD700',
            fontStyle: 'bold',
        }).setScrollFactor(0).setDepth(2801);
        items.push(nameText);

        // NPC title
        const titleText = this.add.text(panelX - panelW / 2 + 16, panelY - panelH / 2 + 30, config.title, {
            fontFamily: 'Arial',
            fontSize: '10px',
            color: '#999999',
            fontStyle: 'italic',
        }).setScrollFactor(0).setDepth(2801);
        items.push(titleText);

        // Separator line
        const sep = this.add.rectangle(panelX, panelY - panelH / 2 + 46, panelW - 24, 1, config.themeColor, 0.3)
            .setScrollFactor(0).setDepth(2801);
        items.push(sep);

        // Dialogue text (typewriter)
        const dialogueText = this.add.text(panelX - panelW / 2 + 16, panelY - panelH / 2 + 54, '', {
            fontFamily: 'Georgia, serif',
            fontSize: '12px',
            color: '#e0e0e0',
            wordWrap: { width: panelW - 32 },
            lineSpacing: 4,
        }).setScrollFactor(0).setDepth(2801);
        items.push(dialogueText);

        // Typewriter effect
        const fullText = line.text;
        let charIndex = 0;
        this.typewriterEvent = this.time.addEvent({
            delay: 25,
            repeat: fullText.length - 1,
            callback: () => {
                charIndex++;
                dialogueText.setText(fullText.substring(0, charIndex));
            },
        });

        // Close hint
        const closeHint = this.add.text(panelX, panelY + panelH / 2 - 14, 'Click to close', {
            fontFamily: 'Arial',
            fontSize: '9px',
            color: '#555555',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2801);
        items.push(closeHint);

        // Click to skip typewriter or close
        bg.on('pointerdown', () => {
            if (charIndex < fullText.length) {
                if (this.typewriterEvent) this.typewriterEvent.destroy();
                this.typewriterEvent = null;
                dialogueText.setText(fullText);
                charIndex = fullText.length;
            } else {
                this.closeNpcDialogue();
            }
        });

        this.dialogueOverlayItems = items;
    }

    private closeNpcDialogue() {
        this.sfx.playClose();
        if (this.typewriterEvent) {
            this.typewriterEvent.destroy();
            this.typewriterEvent = null;
        }
        for (const item of this.dialogueOverlayItems) {
            item.destroy();
        }
        this.dialogueOverlayItems = [];
        this.dialogueOverlayVisible = false;
    }

    // ─── Progress Dashboard Overlay ───
    private toggleDashboard() {
        if (this.dialogueOverlayVisible) this.closeNpcDialogue();
        if (this.travelOverlayVisible) this.hideTravelOverlay();
        if (this.buildingDetailVisible) this.hideBuildingDetail();
        if (this.dashboardOverlayVisible) {
            this.hideDashboard();
        } else {
            this.showDashboard();
        }
    }

    private showDashboard() {
        this.dashboardOverlayVisible = true;
        this.sfx.playOpen();
        const cam = this.cameras.main;
        const w = cam.width;
        const h = cam.height;
        const items: GameObjects.GameObject[] = [];
        const state = loadState();
        const config = state.config;
        const vp = this.villageProgress;

        // Backdrop
        const backdrop = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.8)
            .setScrollFactor(0).setDepth(3000).setInteractive();
        backdrop.on('pointerdown', () => this.hideDashboard());
        items.push(backdrop);

        // Title
        const title = this.add.text(w / 2, 40, '═══  Village Progress  ═══', {
            fontFamily: 'Georgia, serif', fontSize: '20px', color: '#FFD700',
            fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3001);
        items.push(title);

        // ── Left column: Buildings ──
        const leftX = 80;
        const colW = 280;
        let yPos = 90;

        const sectionLabel = this.add.text(leftX, yPos, 'BUILDINGS', {
            fontFamily: 'Arial', fontSize: '11px', color: '#888888', fontStyle: 'bold',
        }).setScrollFactor(0).setDepth(3001);
        items.push(sectionLabel);
        yPos += 22;

        const buildingTypes: Array<{ type: string; color: number; unit: string }> = [
            { type: 'library', color: 0xFFD700, unit: 'publications' },
            { type: 'laboratory', color: 0x42A5F5, unit: 'commits' },
            { type: 'tower', color: 0xCE93D8, unit: 'courses' },
            { type: 'workshop', color: 0xFF9800, unit: 'skills' },
            { type: 'castle', color: 0x78909C, unit: 'milestones' },
        ];

        for (const bt of buildingTypes) {
            const bConfig = BUILDING_CONFIGS[bt.type as BuildingType];
            const bState = vp.buildings[bt.type as keyof typeof vp.buildings];
            if (!bConfig || !bState || !('level' in bState)) continue;

            const level = bState.level;
            const rawCount = bState.rawCount;
            const thresholds = bConfig.levelThresholds;
            const maxLevel = bConfig.maxLevel;

            // Label + level
            const labelText = this.add.text(leftX, yPos, bConfig.label, {
                fontFamily: 'Georgia, serif', fontSize: '13px', color: '#e0e0e0', fontStyle: 'bold',
            }).setScrollFactor(0).setDepth(3001);
            items.push(labelText);

            const lvText = this.add.text(leftX + colW, yPos, `Lv ${level}/${maxLevel}`, {
                fontFamily: 'Arial', fontSize: '12px', color: '#aaaaaa',
            }).setOrigin(1, 0).setScrollFactor(0).setDepth(3001);
            items.push(lvText);
            yPos += 20;

            // Progress bar
            const barW = 200;
            const barH = 8;
            let progress: number;
            if (level >= maxLevel) {
                progress = 1;
            } else {
                const prev = thresholds[level - 1] ?? 0;
                const next = thresholds[level] ?? prev;
                progress = next === prev ? 1 : Math.min(1, (rawCount - prev) / (next - prev));
            }

            const barBg = this.add.rectangle(leftX + barW / 2, yPos + barH / 2, barW, barH, 0x333333)
                .setScrollFactor(0).setDepth(3001);
            items.push(barBg);

            if (progress > 0) {
                const fillW = Math.max(2, barW * progress);
                const fillColor = level >= maxLevel ? 0xFFD700 : bt.color;
                const barFill = this.add.rectangle(leftX + fillW / 2, yPos + barH / 2, fillW, barH, fillColor)
                    .setScrollFactor(0).setDepth(3002);
                items.push(barFill);
            }

            // Count text
            const nextThreshold = level >= maxLevel ? rawCount : (thresholds[level] ?? rawCount);
            const countStr = level >= maxLevel
                ? `${rawCount} ${bt.unit} (MAX)`
                : `${rawCount}/${nextThreshold} ${bt.unit}`;
            const countText = this.add.text(leftX + barW + 10, yPos - 2, countStr, {
                fontFamily: 'Arial', fontSize: '10px', color: '#999999',
            }).setScrollFactor(0).setDepth(3001);
            items.push(countText);
            yPos += 28;
        }

        // ── Right column: Stats ──
        const rightX = 440;
        let rY = 90;

        // Resources section
        const resLabel = this.add.text(rightX, rY, 'RESOURCES', {
            fontFamily: 'Arial', fontSize: '11px', color: '#888888', fontStyle: 'bold',
        }).setScrollFactor(0).setDepth(3001);
        items.push(resLabel);
        rY += 22;

        const rpText = this.add.text(rightX, rY, `Research Points: ${vp.resources.researchPoints}`, {
            fontFamily: 'Arial', fontSize: '12px', color: '#42A5F5',
        }).setScrollFactor(0).setDepth(3001);
        items.push(rpText);
        rY += 18;

        const knText = this.add.text(rightX, rY, `Knowledge: ${vp.resources.knowledge}`, {
            fontFamily: 'Arial', fontSize: '12px', color: '#AB47BC',
        }).setScrollFactor(0).setDepth(3001);
        items.push(knText);
        rY += 18;

        const repText = this.add.text(rightX, rY, `Reputation: ${vp.resources.reputation}`, {
            fontFamily: 'Arial', fontSize: '12px', color: '#FFD700',
        }).setScrollFactor(0).setDepth(3001);
        items.push(repText);
        rY += 30;

        // Village section
        const vilLabel = this.add.text(rightX, rY, 'VILLAGE', {
            fontFamily: 'Arial', fontSize: '11px', color: '#888888', fontStyle: 'bold',
        }).setScrollFactor(0).setDepth(3001);
        items.push(vilLabel);
        rY += 22;

        const statsLines = [
            `Houses: ${vp.buildings.houses.count}`,
            `Trees: ${vp.decorations.trees}`,
            `Banners: ${vp.decorations.banners}`,
            `Fountains: ${vp.decorations.fountains}`,
        ];
        for (const line of statsLines) {
            const st = this.add.text(rightX, rY, line, {
                fontFamily: 'Arial', fontSize: '12px', color: '#cccccc',
            }).setScrollFactor(0).setDepth(3001);
            items.push(st);
            rY += 18;
        }
        rY += 12;

        // Voyages section
        const voyLabel = this.add.text(rightX, rY, 'VOYAGES', {
            fontFamily: 'Arial', fontSize: '11px', color: '#888888', fontStyle: 'bold',
        }).setScrollFactor(0).setDepth(3001);
        items.push(voyLabel);
        rY += 22;

        const unlocked = vp.travelDestinations.filter(d => d.unlocked).length;
        const voyText = this.add.text(rightX, rY, `${unlocked}/8 destinations discovered`, {
            fontFamily: 'Arial', fontSize: '12px', color: '#cccccc',
        }).setScrollFactor(0).setDepth(3001);
        items.push(voyText);
        rY += 30;

        // Data sources section
        const dsLabel = this.add.text(rightX, rY, 'DATA SOURCES', {
            fontFamily: 'Arial', fontSize: '11px', color: '#888888', fontStyle: 'bold',
        }).setScrollFactor(0).setDepth(3001);
        items.push(dsLabel);
        rY += 22;

        const sources = [
            { name: 'GitHub', connected: !!config.githubUsername },
            { name: 'ORCID', connected: !!config.orcidId },
            { name: 'Scholar', connected: !!config.googleScholarId },
            { name: 'Sheets', connected: !!config.sheetsSpreadsheetId },
        ];

        for (const src of sources) {
            const icon = src.connected ? '\u2713' : '\u2717';
            const color = src.connected ? '#66BB6A' : '#EF5350';
            const srcText = this.add.text(rightX, rY, `${icon} ${src.name}`, {
                fontFamily: 'Arial', fontSize: '12px', color: color,
            }).setScrollFactor(0).setDepth(3001);
            items.push(srcText);
            rY += 18;
        }
        rY += 12;

        // Sync Now button
        const syncBtn = this.add.text(rightX, rY, '\u21BB Sync Now', {
            fontFamily: 'Arial', fontSize: '13px', color: '#FFD700',
            backgroundColor: 'rgba(26,61,10,0.8)', padding: { x: 10, y: 6 },
        }).setScrollFactor(0).setDepth(3001).setInteractive({ useHandCursor: true });

        syncBtn.on('pointerdown', () => {
            EventBus.emit('ui-click');
            syncBtn.setText('\u21BB Syncing...');
            syncBtn.setColor('#888888');
            syncBtn.disableInteractive();
            EventBus.emit('refresh-data');
            this.time.delayedCall(3000, () => {
                syncBtn.setText('\u21BB Sync Now');
                syncBtn.setColor('#FFD700');
                syncBtn.setInteractive({ useHandCursor: true });
            });
        });
        syncBtn.on('pointerover', () => syncBtn.setAlpha(0.7));
        syncBtn.on('pointerout', () => syncBtn.setAlpha(1));
        items.push(syncBtn);

        rY += 30;

        // Settings link
        const settingsLink = this.add.text(rightX, rY, '\u2699 Open Settings', {
            fontFamily: 'Arial', fontSize: '12px', color: '#42A5F5',
        }).setScrollFactor(0).setDepth(3001).setInteractive({ useHandCursor: true });
        settingsLink.on('pointerdown', () => { window.location.href = '/admin'; });
        settingsLink.on('pointerover', () => settingsLink.setColor('#90CAF9'));
        settingsLink.on('pointerout', () => settingsLink.setColor('#42A5F5'));
        items.push(settingsLink);

        // Close hint
        const closeHint = this.add.text(w / 2, h - 30, 'Press Tab or click to close', {
            fontFamily: 'Arial', fontSize: '11px', color: '#555555',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3001);
        items.push(closeHint);

        this.dashboardOverlayItems = items;
    }

    private hideDashboard() {
        this.sfx.playClose();
        for (const item of this.dashboardOverlayItems) {
            item.destroy();
        }
        this.dashboardOverlayItems = [];
        this.dashboardOverlayVisible = false;
    }

    // ─── Building Detail Panel ───
    private showBuildingDetail(type: BuildingType) {
        // Toggle off if same building clicked again
        if (this.buildingDetailVisible && this.buildingDetailType === type) {
            this.hideBuildingDetail();
            return;
        }

        // Close any other overlays (mutual exclusion)
        if (this.buildingDetailVisible) this.hideBuildingDetail();
        if (this.dialogueOverlayVisible) this.closeNpcDialogue();
        if (this.travelOverlayVisible) this.hideTravelOverlay();
        if (this.dashboardOverlayVisible) this.hideDashboard();
        if (this.trophyCaseOverlayVisible) this.hideTrophyCase();

        this.buildingDetailVisible = true;
        this.buildingDetailType = type;
        this.sfx.playOpen();

        const cam = this.cameras.main;
        const w = cam.width;
        const h = cam.height;
        const items: GameObjects.GameObject[] = [];
        const state = loadState();
        const vp = this.villageProgress;
        const bConfig = BUILDING_CONFIGS[type];
        const context = BUILDING_ACADEMIC_CONTEXT[type];

        // Semi-transparent backdrop (lighter than full-screen overlays)
        const backdrop = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.5)
            .setScrollFactor(0).setDepth(2900).setInteractive();
        backdrop.on('pointerdown', () => this.hideBuildingDetail());
        items.push(backdrop);

        const panelW = 380;
        const panelH = type === BuildingType.HOUSE ? 260 : 340;
        const panelX = w / 2;
        const panelY = h / 2;

        // Panel background
        const bg = this.add.rectangle(panelX, panelY, panelW, panelH, 0x1a1a2e, 0.95)
            .setStrokeStyle(2, context.themeColor)
            .setScrollFactor(0).setDepth(2901).setInteractive();
        bg.on('pointerdown', (pointer: Phaser.Input.Pointer) => pointer.event.stopPropagation());
        items.push(bg);

        const leftEdge = panelX - panelW / 2 + 20;
        const rightEdge = panelX + panelW / 2 - 20;
        let yPos = panelY - panelH / 2 + 20;

        if (type === BuildingType.HOUSE) {
            this.renderHouseDetail(items, leftEdge, rightEdge, yPos, panelX, panelY, panelH, vp, state, context);
        } else {
            this.renderMainBuildingDetail(items, leftEdge, rightEdge, yPos, panelX, panelY, panelH, type, vp, state, bConfig, context);
        }

        // Close hint
        const closeHint = this.add.text(panelX, panelY + panelH / 2 - 16, 'Click building or press ESC to close', {
            fontFamily: 'Arial', fontSize: '9px', color: '#555555',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2902);
        items.push(closeHint);

        this.buildingDetailItems = items;
    }

    private renderMainBuildingDetail(
        items: GameObjects.GameObject[],
        leftEdge: number, rightEdge: number, yPos: number,
        panelX: number, panelY: number, panelH: number,
        type: BuildingType,
        vp: VillageProgress,
        state: ReturnType<typeof loadState>,
        bConfig: typeof BUILDING_CONFIGS[BuildingType],
        context: typeof BUILDING_ACADEMIC_CONTEXT[BuildingType],
    ) {
        const bState = vp.buildings[type as keyof typeof vp.buildings];
        if (!bState || !('level' in bState)) return;
        const level = bState.level;
        const rawCount = bState.rawCount;
        const thresholds = bConfig.levelThresholds;
        const maxLevel = bConfig.maxLevel;

        // Header: level label + building name + level badge
        const levelLabel = context.levelLabels[level - 1] || bConfig.label;
        const headerText = this.add.text(leftEdge, yPos, levelLabel, {
            fontFamily: 'Georgia, serif', fontSize: '16px', color: '#FFD700',
            fontStyle: 'bold',
        }).setScrollFactor(0).setDepth(2902);
        items.push(headerText);

        const lvBadge = this.add.text(rightEdge, yPos + 2, `Lv ${level}/${maxLevel}`, {
            fontFamily: 'Arial', fontSize: '13px', color: '#aaaaaa',
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(2902);
        items.push(lvBadge);
        yPos += 22;

        // Description
        const descText = this.add.text(leftEdge, yPos, bConfig.description, {
            fontFamily: 'Arial', fontSize: '11px', color: '#999999', fontStyle: 'italic',
        }).setScrollFactor(0).setDepth(2902);
        items.push(descText);
        yPos += 28;

        // ── PROGRESS section ──
        const progressLabel = this.add.text(leftEdge, yPos, 'PROGRESS', {
            fontFamily: 'Arial', fontSize: '10px', color: '#666666', fontStyle: 'bold',
        }).setScrollFactor(0).setDepth(2902);
        items.push(progressLabel);
        yPos += 18;

        // Progress bar
        const barW = 220;
        const barH = 8;
        let progress: number;
        if (level >= maxLevel) {
            progress = 1;
        } else {
            const prev = thresholds[level - 1] ?? 0;
            const next = thresholds[level] ?? prev;
            progress = next === prev ? 1 : Math.min(1, (rawCount - prev) / (next - prev));
        }

        const barBg = this.add.rectangle(leftEdge + barW / 2, yPos + barH / 2, barW, barH, 0x333333)
            .setScrollFactor(0).setDepth(2902);
        items.push(barBg);

        if (progress > 0) {
            const fillW = Math.max(2, barW * progress);
            const fillColor = level >= maxLevel ? 0xFFD700 : context.themeColor;
            const barFill = this.add.rectangle(leftEdge + fillW / 2, yPos + barH / 2, fillW, barH, fillColor)
                .setScrollFactor(0).setDepth(2903);
            items.push(barFill);
        }

        // Count text next to progress bar
        const nextThreshold = level >= maxLevel ? rawCount : (thresholds[level] ?? rawCount);
        const countStr = level >= maxLevel
            ? `${rawCount} ${context.metric} (MAX)`
            : `${rawCount}/${nextThreshold} ${context.metric}`;
        const countText = this.add.text(leftEdge + barW + 10, yPos - 2, countStr, {
            fontFamily: 'Arial', fontSize: '10px', color: '#aaaaaa',
        }).setScrollFactor(0).setDepth(2902);
        items.push(countText);
        yPos += 16;

        // Next level hint
        if (level < maxLevel) {
            const nextLabel = context.levelLabels[level] || `Level ${level + 1}`;
            const nextHint = this.add.text(leftEdge, yPos, `Next: ${nextLabel} at ${thresholds[level] ?? '?'} ${context.metric}`, {
                fontFamily: 'Arial', fontSize: '10px', color: '#777777',
            }).setScrollFactor(0).setDepth(2902);
            items.push(nextHint);
        }
        yPos += 24;

        // ── MILESTONES timeline ──
        const msLabel = this.add.text(leftEdge, yPos, 'MILESTONES', {
            fontFamily: 'Arial', fontSize: '10px', color: '#666666', fontStyle: 'bold',
        }).setScrollFactor(0).setDepth(2902);
        items.push(msLabel);
        yPos += 20;

        // Draw connected dots
        const dotSpacing = 60;
        const dotStartX = leftEdge + 20;
        const dotY = yPos + 6;

        for (let i = 0; i < maxLevel; i++) {
            const cx = dotStartX + i * dotSpacing;
            const reached = level > i;

            // Connecting line to next dot
            if (i < maxLevel - 1) {
                const lineColor = level > i + 1 ? context.themeColor : 0x444444;
                const line = this.add.rectangle(cx + dotSpacing / 2, dotY, dotSpacing - 12, 2, lineColor)
                    .setScrollFactor(0).setDepth(2902);
                items.push(line);
            }

            // Dot
            const dotColor = reached ? context.themeColor : 0x444444;
            const dot = this.add.circle(cx, dotY, 6, dotColor)
                .setScrollFactor(0).setDepth(2903);
            items.push(dot);

            // Current level indicator
            if (i === level - 1) {
                const ring = this.add.circle(cx, dotY, 9)
                    .setStrokeStyle(2, 0xFFFFFF)
                    .setFillStyle(0x000000, 0)
                    .setScrollFactor(0).setDepth(2903);
                items.push(ring);
            }

            // Threshold number below dot
            const threshText = this.add.text(cx, dotY + 14, `${thresholds[i]}`, {
                fontFamily: 'Arial', fontSize: '9px', color: reached ? '#cccccc' : '#555555',
            }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2902);
            items.push(threshText);

            // Level label below threshold
            const lvLabel = this.add.text(cx, dotY + 26, context.levelLabels[i], {
                fontFamily: 'Arial', fontSize: '8px', color: reached ? '#999999' : '#444444',
            }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2902);
            items.push(lvLabel);
        }
        yPos += 56;

        // ── DATA SOURCE section ──
        this.renderDataSourceStatus(items, leftEdge, yPos, type, state, context);
    }

    private renderHouseDetail(
        items: GameObjects.GameObject[],
        leftEdge: number, rightEdge: number, yPos: number,
        panelX: number, panelY: number, panelH: number,
        vp: VillageProgress,
        state: ReturnType<typeof loadState>,
        context: typeof BUILDING_ACADEMIC_CONTEXT[BuildingType],
    ) {
        const houseCount = vp.buildings.houses.count;

        // Header
        const headerText = this.add.text(leftEdge, yPos, 'Village Houses', {
            fontFamily: 'Georgia, serif', fontSize: '16px', color: '#FFD700',
            fontStyle: 'bold',
        }).setScrollFactor(0).setDepth(2902);
        items.push(headerText);

        const countBadge = this.add.text(rightEdge, yPos + 2, `${houseCount} built`, {
            fontFamily: 'Arial', fontSize: '13px', color: '#aaaaaa',
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(2902);
        items.push(countBadge);
        yPos += 22;

        // Description
        const descText = this.add.text(leftEdge, yPos, 'Short-term tasks completed by villagers', {
            fontFamily: 'Arial', fontSize: '11px', color: '#999999', fontStyle: 'italic',
        }).setScrollFactor(0).setDepth(2902);
        items.push(descText);
        yPos += 28;

        // House info
        const infoLabel = this.add.text(leftEdge, yPos, 'VILLAGE SIZE', {
            fontFamily: 'Arial', fontSize: '10px', color: '#666666', fontStyle: 'bold',
        }).setScrollFactor(0).setDepth(2902);
        items.push(infoLabel);
        yPos += 18;

        // Visual house count
        const maxHousePlots = VILLAGE_LAYOUT.housePlots.length;
        const houseLine = this.add.text(leftEdge, yPos,
            `${houseCount}/${maxHousePlots} house plots occupied`, {
            fontFamily: 'Arial', fontSize: '12px', color: '#cccccc',
        }).setScrollFactor(0).setDepth(2902);
        items.push(houseLine);
        yPos += 20;

        const rateLine = this.add.text(leftEdge, yPos, '1 house per 10 completed tasks', {
            fontFamily: 'Arial', fontSize: '10px', color: '#777777',
        }).setScrollFactor(0).setDepth(2902);
        items.push(rateLine);
        yPos += 28;

        // ── DATA SOURCE section ──
        this.renderDataSourceStatus(items, leftEdge, yPos, BuildingType.HOUSE, state, context);
    }

    private renderDataSourceStatus(
        items: GameObjects.GameObject[],
        leftEdge: number, yPos: number,
        type: BuildingType,
        state: ReturnType<typeof loadState>,
        context: typeof BUILDING_ACADEMIC_CONTEXT[BuildingType],
    ) {
        const dsLabel = this.add.text(leftEdge, yPos, 'DATA SOURCE', {
            fontFamily: 'Arial', fontSize: '10px', color: '#666666', fontStyle: 'bold',
        }).setScrollFactor(0).setDepth(2902);
        items.push(dsLabel);
        yPos += 18;

        let connected = false;
        if (type === BuildingType.CASTLE) {
            // Castle uses manual milestones — always "available"
            connected = true;
        } else if (context.configKey) {
            const configValue = state.config[context.configKey as keyof typeof state.config];
            connected = !!configValue;
        }

        if (connected) {
            const statusText = this.add.text(leftEdge, yPos, `\u2713 Connected via ${context.dataSource}`, {
                fontFamily: 'Arial', fontSize: '11px', color: '#66BB6A',
            }).setScrollFactor(0).setDepth(2902);
            items.push(statusText);
        } else {
            const statusText = this.add.text(leftEdge, yPos, `\u2717 Not connected`, {
                fontFamily: 'Arial', fontSize: '11px', color: '#EF5350',
            }).setScrollFactor(0).setDepth(2902);
            items.push(statusText);
            yPos += 18;

            const configLink = this.add.text(leftEdge + 10, yPos, `Configure ${context.dataSource} in Settings \u2192`, {
                fontFamily: 'Arial', fontSize: '11px', color: '#42A5F5',
            }).setScrollFactor(0).setDepth(2902).setInteractive({ useHandCursor: true });
            configLink.on('pointerdown', () => { window.location.href = '/admin'; });
            configLink.on('pointerover', () => configLink.setColor('#90CAF9'));
            configLink.on('pointerout', () => configLink.setColor('#42A5F5'));
            items.push(configLink);
        }
    }

    private hideBuildingDetail() {
        this.sfx.playClose();
        for (const item of this.buildingDetailItems) {
            item.destroy();
        }
        this.buildingDetailItems = [];
        this.buildingDetailVisible = false;
        this.buildingDetailType = null;
    }

    // ─── Clouds drifting across the sky ───
    private spawnClouds() {
        const spawnCloud = () => {
            const startX = -100;
            const y = 20 + Math.random() * 80;
            const cloud = this.add.image(startX, y, 'deco_cloud')
                .setDepth(2000)
                .setAlpha(0.3 + Math.random() * 0.3)
                .setScale(0.6 + Math.random() * 0.8)
                .setScrollFactor(0.3); // Parallax — clouds move slower than camera

            this.tweens.add({
                targets: cloud,
                x: this.scale.width + 200,
                duration: 20000 + Math.random() * 30000,
                ease: 'Linear',
                onComplete: () => cloud.destroy(),
            });
        };

        // Spawn a few immediately
        for (let i = 0; i < 3; i++) {
            this.time.delayedCall(i * 2000, spawnCloud);
        }
        // Then periodically
        this.time.addEvent({
            delay: 8000,
            callback: spawnCloud,
            loop: true,
        });
    }

    // ─── Tooltip ───
    private createTooltip() {
        this.tooltipBg = this.add.rectangle(0, 0, 200, 55, 0x000000, 0.85)
            .setStrokeStyle(1, 0xffd700);
        this.tooltipTitle = this.add.text(0, -14, '', {
            fontFamily: 'Georgia, serif',
            fontSize: '13px',
            color: '#FFD700',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        this.tooltipDesc = this.add.text(0, 6, '', {
            fontFamily: 'Arial',
            fontSize: '11px',
            color: '#ffffff',
            align: 'center',
        }).setOrigin(0.5);

        this.tooltip = this.add.container(0, 0, [this.tooltipBg, this.tooltipTitle, this.tooltipDesc]);
        this.tooltip.setDepth(1500);
        this.tooltip.setAlpha(0);
    }

    private showTooltip(x: number, y: number, title: string, desc: string) {
        this.tooltipTitle.setText(title);
        this.tooltipDesc.setText(desc);
        const maxWidth = Math.max(this.tooltipTitle.width, this.tooltipDesc.width);
        this.tooltipBg.setSize(maxWidth + 24, 55);

        // Clamp tooltip so it doesn't go above camera view or overlap HUD (top 50px)
        const cam = this.cameras.main;
        const minWorldY = cam.scrollY + 55 / cam.zoom;
        const clampedY = Math.max(y, minWorldY);
        this.tooltip.setPosition(x, clampedY);
        this.tooltip.setAlpha(1);
    }

    private hideTooltip() {
        this.tooltip.setAlpha(0);
    }

    // ─── Camera ───
    private setupCamera() {
        const cam = this.cameras.main;
        const { gridWidth, gridHeight, tileWidth, tileHeight } = VILLAGE_LAYOUT;

        // Calculate world bounds from grid
        const worldWidth = (gridWidth + gridHeight) * (tileWidth / 2) + 200;
        const worldHeight = (gridWidth + gridHeight) * (tileHeight / 2) + 200;
        cam.setBounds(-100, -50, worldWidth, worldHeight);

        // Follow the scholar with soft lerp
        cam.startFollow(this.scholar, true, 0.08, 0.08);

        // Zoom with mouse wheel
        this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _go: GameObjects.GameObject[], _dx: number, deltaY: number) => {
            const newZoom = Phaser.Math.Clamp(cam.zoom + (deltaY > 0 ? -0.08 : 0.08), 0.4, 2.5);
            cam.setZoom(newZoom);
        });
    }

    private setupInput() {
        const cam = this.cameras.main;

        // Mouse drag pans camera (temporarily stops follow)
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            this.isDragging = true;
            this.dragStartX = pointer.x;
            this.dragStartY = pointer.y;
            this.camStartX = cam.scrollX;
            this.camStartY = cam.scrollY;
        });

        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (!this.isDragging) return;
            const dx = pointer.x - this.dragStartX;
            const dy = pointer.y - this.dragStartY;
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                cam.stopFollow();
                cam.scrollX = this.camStartX - dx / cam.zoom;
                cam.scrollY = this.camStartY - dy / cam.zoom;
            }
        });

        this.input.on('pointerup', () => {
            this.isDragging = false;
        });

        // Arrow keys move the scholar
        const cursors = this.input.keyboard!.createCursorKeys();
        this.events.on('update', () => {
            if (cursors.left.isDown) {
                this.moveScholar(-1, 0);
                cam.startFollow(this.scholar, true, 0.08, 0.08);
            }
            if (cursors.right.isDown) {
                this.moveScholar(1, 0);
                cam.startFollow(this.scholar, true, 0.08, 0.08);
            }
            if (cursors.up.isDown) {
                this.moveScholar(0, -1);
                cam.startFollow(this.scholar, true, 0.08, 0.08);
            }
            if (cursors.down.isDown) {
                this.moveScholar(0, 1);
                cam.startFollow(this.scholar, true, 0.08, 0.08);
            }
        });

        // Tab toggles dashboard, Y toggles trophy case, Escape closes overlays
        this.input.keyboard!.on('keydown-TAB', (event: KeyboardEvent) => {
            event.preventDefault();
            this.toggleDashboard();
        });
        this.input.keyboard!.on('keydown-Y', () => {
            this.toggleTrophyCase();
        });
        this.input.keyboard!.on('keydown-ESC', () => {
            if (this.buildingDetailVisible) this.hideBuildingDetail();
            else if (this.dashboardOverlayVisible) this.hideDashboard();
            else if (this.travelOverlayVisible) this.hideTravelOverlay();
            else if (this.trophyCaseOverlayVisible) this.hideTrophyCase();
            else if (this.dialogueOverlayVisible) this.closeNpcDialogue();
        });
    }

    // ─── Audio ───
    private setupAudio() {
        // Restore mute preference from localStorage
        try {
            const muted = localStorage.getItem('phd-sim-muted');
            if (muted === 'true') {
                this.sound.mute = true;
            }
        } catch { /* ignore */ }

        // Start music on first user interaction (browser autoplay policy)
        const startMusic = () => {
            if (this.musicStarted) return;
            this.musicStarted = true;

            this.bgm = this.sound.add('bgm_lofi', {
                volume: 0.3,
                loop: true,
            });
            this.bgm.play();
        };

        this.input.on('pointerdown', startMusic);
        this.input.keyboard!.on('keydown', startMusic);
    }

    // ─── Upgrade animations ───
    private animateUpgrades(upgrades: Array<{ type: string; oldLevel: number; newLevel: number }>) {
        let delay = 500;
        for (const upgrade of upgrades) {
            const building = this.buildings.find(b => b.type === upgrade.type);
            if (!building) continue;

            this.time.delayedCall(delay, () => {
                this.cameras.main.pan(building.sprite.x, building.sprite.y, 600, 'Sine.easeInOut');
                this.sfx.playUpgrade();

                this.tweens.add({
                    targets: building.sprite,
                    scaleX: 1.2, scaleY: 1.2,
                    duration: 300,
                    yoyo: true,
                    ease: 'Back.easeOut',
                    onComplete: () => {
                        building.sprite.setTexture(`${upgrade.type}_lv${upgrade.newLevel}`);
                        building.level = upgrade.newLevel;
                        building.sprite.setScale(0);
                        this.tweens.add({
                            targets: building.sprite,
                            scaleX: 1, scaleY: 1,
                            duration: 500,
                            ease: 'Back.easeOut',
                        });
                        this.particles.burstAt(building.sprite.x, building.sprite.y, 0xFFD700, 20);
                    },
                });

                const upgradeText = this.add.text(
                    building.sprite.x, building.sprite.y - 70,
                    `Level Up! ${upgrade.newLevel}`,
                    { fontFamily: 'Georgia, serif', fontSize: '18px', color: '#FFD700', stroke: '#000000', strokeThickness: 5, fontStyle: 'bold' }
                ).setOrigin(0.5).setDepth(1400);

                this.tweens.add({
                    targets: upgradeText,
                    y: upgradeText.y - 50,
                    alpha: 0,
                    duration: 2500,
                    ease: 'Cubic.easeOut',
                    onComplete: () => upgradeText.destroy(),
                });
            });
            delay += 1500;
        }
    }

    // ─── Public API ───
    public updateVillage(progress: VillageProgress) {
        this.villageProgress = progress;
        for (const building of this.buildings) {
            if (building.type === BuildingType.HOUSE) continue;
            const newData = progress.buildings[building.type];
            if (newData.level !== building.level) {
                building.sprite.setTexture(`${building.type}_lv${newData.level}`);
                building.level = newData.level;
            }
        }
        EventBus.emit('village-updated', progress);

        // Check achievements after every village update
        const achState = loadState();
        this.achievementSystem.checkAchievements(progress, achState.config);
    }

    // ─── Trophy Case Overlay ───
    private toggleTrophyCase() {
        if (this.dialogueOverlayVisible) this.closeNpcDialogue();
        if (this.travelOverlayVisible) this.hideTravelOverlay();
        if (this.dashboardOverlayVisible) this.hideDashboard();
        if (this.buildingDetailVisible) this.hideBuildingDetail();
        if (this.trophyCaseOverlayVisible) {
            this.hideTrophyCase();
        } else {
            this.trophyCaseCategory = 'all';
            this.showTrophyCase();
        }
    }

    private showTrophyCase() {
        this.trophyCaseOverlayVisible = true;
        this.sfx.playOpen();
        const cam = this.cameras.main;
        const w = cam.width;
        const h = cam.height;
        const items: GameObjects.GameObject[] = [];
        const state = loadState();
        const config = state.config;
        const vp = this.villageProgress;

        // Backdrop
        const backdrop = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.85)
            .setScrollFactor(0).setDepth(3000).setInteractive();
        backdrop.on('pointerdown', () => this.hideTrophyCase());
        items.push(backdrop);

        // Title
        const title = this.add.text(w / 2, 35, '\u2550\u2550\u2550  Trophy Case  \u2550\u2550\u2550', {
            fontFamily: 'Georgia, serif', fontSize: '20px', color: '#FFD700',
            fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3001);
        items.push(title);

        // Summary
        const unlockedCount = this.achievementSystem.getUnlockedCount();
        const totalCount = this.achievementSystem.getTotalCount();
        const totalPoints = this.achievementSystem.getTotalPoints();
        const summary = this.add.text(w / 2, 58,
            `${unlockedCount}/${totalCount} achievements  \u2022  ${totalPoints} points`, {
            fontFamily: 'Arial', fontSize: '12px', color: '#aaaaaa',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3001);
        items.push(summary);

        // Category tabs
        const categories: Array<AchievementCategory | 'all'> = ['all', 'buildings', 'resources', 'travel', 'social', 'milestones', 'meta'];
        const tabY = 82;
        let tabX = 60;
        for (const cat of categories) {
            const label = cat === 'all' ? 'All' : CATEGORY_META[cat].label;
            const isSelected = this.trophyCaseCategory === cat;
            const tab = this.add.text(tabX, tabY, label, {
                fontFamily: 'Arial', fontSize: '11px',
                color: isSelected ? '#FFD700' : '#666666',
                fontStyle: isSelected ? 'bold' : 'normal',
                backgroundColor: isSelected ? 'rgba(255,215,0,0.1)' : undefined,
                padding: { x: 6, y: 3 },
            }).setScrollFactor(0).setDepth(3001).setInteractive({ useHandCursor: true });

            tab.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
                pointer.event.stopPropagation();
                this.trophyCaseCategory = cat;
                this.hideTrophyCase();
                this.showTrophyCase();
            });
            tab.on('pointerover', () => { if (!isSelected) tab.setColor('#cccccc'); });
            tab.on('pointerout', () => { if (!isSelected) tab.setColor('#666666'); });

            items.push(tab);
            tabX += tab.width + 10;
        }

        // Filter achievements by category
        const filtered = this.trophyCaseCategory === 'all'
            ? ACHIEVEMENTS
            : ACHIEVEMENTS.filter(a => a.category === this.trophyCaseCategory);

        // Sort: unlocked first, then by tier (gold, silver, bronze)
        const tierOrder = { gold: 0, silver: 1, bronze: 2 };
        const sorted = [...filtered].sort((a, b) => {
            const aUnlocked = this.achievementSystem.isUnlocked(a.id) ? 0 : 1;
            const bUnlocked = this.achievementSystem.isUnlocked(b.id) ? 0 : 1;
            if (aUnlocked !== bUnlocked) return aUnlocked - bUnlocked;
            return tierOrder[a.tier] - tierOrder[b.tier];
        });

        // Render achievements
        let yPos = 110;
        const leftX = 60;
        const maxY = h - 40;
        let lastCategory: string | null = null;

        for (const achievement of sorted) {
            if (yPos > maxY) break;

            // Category header when showing "all"
            if (this.trophyCaseCategory === 'all' && achievement.category !== lastCategory) {
                lastCategory = achievement.category;
                const catMeta = CATEGORY_META[achievement.category];
                const catHeader = this.add.text(leftX, yPos, `${catMeta.icon} ${catMeta.label.toUpperCase()}`, {
                    fontFamily: 'Arial', fontSize: '10px', color: catMeta.color, fontStyle: 'bold',
                }).setScrollFactor(0).setDepth(3001);
                items.push(catHeader);
                yPos += 18;
            }

            const isUnlocked = this.achievementSystem.isUnlocked(achievement.id);
            const tierColor = TIER_COLORS[achievement.tier];
            const progress = this.achievementSystem.getProgress(achievement, vp, config);

            // Icon
            const icon = this.add.text(leftX, yPos, isUnlocked ? achievement.icon : '\u2753', {
                fontSize: '16px',
            }).setScrollFactor(0).setDepth(3001);
            items.push(icon);

            // Name
            const name = this.add.text(leftX + 28, yPos, isUnlocked ? achievement.name : '??????', {
                fontFamily: 'Georgia, serif', fontSize: '12px',
                color: isUnlocked ? '#e0e0e0' : '#555555',
                fontStyle: 'bold',
            }).setScrollFactor(0).setDepth(3001);
            items.push(name);

            // Tier badge
            const tierLabel = achievement.tier.charAt(0).toUpperCase() + achievement.tier.slice(1);
            const tier = this.add.text(w - 80, yPos, tierLabel, {
                fontFamily: 'Arial', fontSize: '10px', color: tierColor, fontStyle: 'bold',
            }).setOrigin(1, 0).setScrollFactor(0).setDepth(3001);
            items.push(tier);

            yPos += 18;

            // Description/hint
            const descText = isUnlocked ? achievement.description : achievement.hint;
            const desc = this.add.text(leftX + 28, yPos, descText, {
                fontFamily: 'Arial', fontSize: '10px',
                color: isUnlocked ? '#999999' : '#555555',
                fontStyle: isUnlocked ? 'normal' : 'italic',
            }).setScrollFactor(0).setDepth(3001);
            items.push(desc);

            // Progress bar + status
            const barX = w - 230;
            const barW = 120;
            const barH = 6;

            const barBg = this.add.rectangle(barX + barW / 2, yPos + 4, barW, barH, 0x333333)
                .setScrollFactor(0).setDepth(3001);
            items.push(barBg);

            if (progress > 0) {
                const fillW = Math.max(2, barW * progress);
                const fillColorNum = parseInt(tierColor.replace('#', ''), 16);
                const barFill = this.add.rectangle(barX + fillW / 2, yPos + 4, fillW, barH, fillColorNum)
                    .setScrollFactor(0).setDepth(3002);
                items.push(barFill);
            }

            const pctText = `${Math.round(progress * 100)}%`;
            const pct = this.add.text(w - 80, yPos, pctText, {
                fontFamily: 'Arial', fontSize: '10px',
                color: isUnlocked ? '#66BB6A' : '#777777',
            }).setOrigin(1, 0).setScrollFactor(0).setDepth(3001);
            items.push(pct);

            // Unlock date (if unlocked)
            if (isUnlocked) {
                const ts = this.achievementSystem.getUnlockTimestamp(achievement.id);
                if (ts) {
                    const dateStr = new Date(ts).toLocaleDateString();
                    const dateText = this.add.text(leftX + 28, yPos + 14, `Unlocked ${dateStr}`, {
                        fontFamily: 'Arial', fontSize: '9px', color: '#4a4a4a',
                    }).setScrollFactor(0).setDepth(3001);
                    items.push(dateText);
                    yPos += 14;
                }
            }

            yPos += 22;
        }

        // Close hint
        const closeHint = this.add.text(w / 2, h - 20, 'Press Y or click to close', {
            fontFamily: 'Arial', fontSize: '11px', color: '#555555',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3001);
        items.push(closeHint);

        this.trophyCaseOverlayItems = items;
    }

    private hideTrophyCase() {
        this.sfx.playClose();
        for (const item of this.trophyCaseOverlayItems) {
            item.destroy();
        }
        this.trophyCaseOverlayItems = [];
        this.trophyCaseOverlayVisible = false;
    }

    // ─── Achievement Toast Notifications ───
    private queueAchievementToast(achievement: AchievementDefinition) {
        this.achievementToastQueue.push(achievement);
        if (!this.isShowingToast) {
            this.showNextToast();
        }
    }

    private showNextToast() {
        if (this.achievementToastQueue.length === 0) {
            this.isShowingToast = false;
            return;
        }

        this.isShowingToast = true;
        const achievement = this.achievementToastQueue.shift()!;
        this.sfx.playAchievement();
        const cam = this.cameras.main;

        const toastW = 280;
        const toastH = 60;
        const toastX = cam.width - toastW / 2 - 20;
        const startY = -toastH;
        const targetY = 60;

        const tierColor = TIER_COLORS[achievement.tier];
        const tierColorNum = parseInt(tierColor.replace('#', ''), 16);

        // Background
        const bg = this.add.rectangle(toastX, startY, toastW, toastH, 0x1a1a2e, 0.95)
            .setStrokeStyle(2, tierColorNum)
            .setScrollFactor(0).setDepth(4000);

        // Icon
        const icon = this.add.text(toastX - toastW / 2 + 24, startY, achievement.icon, {
            fontSize: '24px',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(4001);

        // "Achievement Unlocked!" label
        const label = this.add.text(toastX - toastW / 2 + 50, startY - 12, 'Achievement Unlocked!', {
            fontFamily: 'Arial', fontSize: '9px', color: tierColor, fontStyle: 'bold',
        }).setScrollFactor(0).setDepth(4001);

        // Achievement name
        const nameText = this.add.text(toastX - toastW / 2 + 50, startY + 2, achievement.name, {
            fontFamily: 'Georgia, serif', fontSize: '13px', color: '#ffffff', fontStyle: 'bold',
        }).setScrollFactor(0).setDepth(4001);

        // Description
        const desc = this.add.text(toastX - toastW / 2 + 50, startY + 18, achievement.description, {
            fontFamily: 'Arial', fontSize: '10px', color: '#aaaaaa',
        }).setScrollFactor(0).setDepth(4001);

        const allItems = [bg, icon, label, nameText, desc];

        // Slide in from top
        this.tweens.add({
            targets: allItems,
            y: `+=${targetY - startY}`,
            duration: 400,
            ease: 'Back.easeOut',
            onComplete: () => {
                // Confetti burst at toast position
                const tierConfettiColors: Record<string, number[]> = {
                    bronze: [0xCD7F32, 0xDDA15E, 0xB87333],
                    silver: [0xC0C0C0, 0xE8E8E8, 0xA9A9A9],
                    gold: [0xFFD700, 0xFFF44F, 0xDAA520],
                };
                this.particles.confettiBurst(toastX, targetY, tierConfettiColors[achievement.tier] || tierConfettiColors.bronze);
                // Hold for 3 seconds, then slide out
                this.time.delayedCall(3000, () => {
                    this.tweens.add({
                        targets: allItems,
                        y: `-=${targetY - startY}`,
                        alpha: 0,
                        duration: 300,
                        ease: 'Cubic.easeIn',
                        onComplete: () => {
                            for (const item of allItems) item.destroy();
                            this.showNextToast();
                        },
                    });
                });
            },
        });
    }
}
