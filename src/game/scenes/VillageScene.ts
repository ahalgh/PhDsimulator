import { Scene, GameObjects } from 'phaser';
import { EventBus } from '../EventBus';
import { BuildingType, VillageProgress, TravelDestination, getDefaultVillageProgress } from '../types/gameState';
import { BUILDING_CONFIGS, VILLAGE_LAYOUT, TRAVEL_DESTINATIONS, TravelDestinationConfig } from '../data/buildingConfig';
import { loadState, getStateDiff } from '../../lib/stateManager';

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
    private wanderers: GameObjects.Image[] = [];

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

    // Audio
    private bgm: Phaser.Sound.BaseSound | null = null;
    private musicStarted = false;

    constructor() {
        super('VillageScene');
    }

    create() {
        this.cameras.main.setBackgroundColor(0x0d2b06);

        const state = loadState();
        this.villageProgress = state.village;

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

            this.buildings.push({ type, level, sprite, label, tileX: plot.tileX, tileY: plot.tileY });
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
                .setScale(0.85);

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
        if (this.travelOverlayVisible) {
            this.hideTravelOverlay();
        } else {
            this.showTravelOverlay();
        }
    }

    private showTravelOverlay() {
        this.travelOverlayVisible = true;
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
        const npcDefs = [
            { key: 'villager_farmer', startTile: { x: 7, y: 8 } },
            { key: 'villager_guard',  startTile: { x: 11, y: 10 } },
            { key: 'villager_merchant', startTile: { x: 8, y: 12 } },
        ];

        for (const def of npcDefs) {
            const { x, y } = this.tileToScreen(def.startTile.x, def.startTile.y);
            const npc = this.add.image(x, y - 10, def.key)
                .setDepth(def.startTile.y * 10 + 4)
                .setScale(0.9);

            this.wanderers.push(npc);
            this.wanderNPC(npc, def.startTile);
        }
    }

    private wanderNPC(npc: GameObjects.Image, home: { x: number; y: number }) {
        const wander = () => {
            // Random tile near home
            const dx = Math.floor(Math.random() * 5) - 2;
            const dy = Math.floor(Math.random() * 5) - 2;
            const targetTX = Phaser.Math.Clamp(home.x + dx, 5, 13);
            const targetTY = Phaser.Math.Clamp(home.y + dy, 6, 13);
            const { x, y } = this.tileToScreen(targetTX, targetTY);

            // Flip sprite based on direction
            npc.setFlipX(x < npc.x);

            this.tweens.add({
                targets: npc,
                x: x,
                y: y - 10,
                duration: 2000 + Math.random() * 3000,
                ease: 'Sine.easeInOut',
                onComplete: () => {
                    // Pause, then wander again
                    this.time.delayedCall(1000 + Math.random() * 4000, wander);
                },
            });
        };

        this.time.delayedCall(Math.random() * 3000, wander);
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
    }
}
