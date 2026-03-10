import { BuildingType } from '../types/gameState';

export interface BuildingConfig {
    type: BuildingType;
    label: string;
    description: string;
    maxLevel: number;
    levelThresholds: number[];
    spriteWidth: number;
    spriteHeight: number;
}

export const BUILDING_CONFIGS: Record<BuildingType, BuildingConfig> = {
    [BuildingType.LIBRARY]: {
        type: BuildingType.LIBRARY,
        label: 'The Grand Library',
        description: 'Publications and scholarly works',
        maxLevel: 5,
        levelThresholds: [0, 1, 3, 6, 10],
        spriteWidth: 64,
        spriteHeight: 96,
    },
    [BuildingType.LABORATORY]: {
        type: BuildingType.LABORATORY,
        label: 'The Laboratory',
        description: 'Code commits and research experiments',
        maxLevel: 5,
        levelThresholds: [0, 50, 200, 500, 1000],
        spriteWidth: 64,
        spriteHeight: 96,
    },
    [BuildingType.TOWER]: {
        type: BuildingType.TOWER,
        label: 'Tower of Knowledge',
        description: 'Courses and certifications completed',
        maxLevel: 5,
        levelThresholds: [0, 2, 5, 10, 15],
        spriteWidth: 64,
        spriteHeight: 96,
    },
    [BuildingType.WORKSHOP]: {
        type: BuildingType.WORKSHOP,
        label: 'The Workshop',
        description: 'Tools and skills mastered',
        maxLevel: 5,
        levelThresholds: [0, 3, 8, 15, 25],
        spriteWidth: 64,
        spriteHeight: 96,
    },
    [BuildingType.CASTLE]: {
        type: BuildingType.CASTLE,
        label: 'The Keep',
        description: 'Major PhD milestones',
        maxLevel: 5,
        levelThresholds: [0, 1, 2, 3, 3],
        spriteWidth: 64,
        spriteHeight: 96,
    },
    [BuildingType.HOUSE]: {
        type: BuildingType.HOUSE,
        label: 'Village House',
        description: 'Short-term tasks completed',
        maxLevel: 5,
        levelThresholds: [0, 10, 20, 30, 50],
        spriteWidth: 64,
        spriteHeight: 96,
    },
};

export function getLevelForCount(type: BuildingType, count: number): number {
    const config = BUILDING_CONFIGS[type];
    let level = 1;
    for (let i = config.levelThresholds.length - 1; i >= 0; i--) {
        if (count >= config.levelThresholds[i]) {
            level = i + 1;
            break;
        }
    }
    return Math.min(level, config.maxLevel);
}

export function getHouseCount(tasksCompleted: number): number {
    return Math.floor(tasksCompleted / 10);
}

export function getDecorationCount(rawCount: number, per: number): number {
    return Math.floor(rawCount / per);
}

// Expanded map: main village (left) + conference regions (east)
export const VILLAGE_LAYOUT = {
    gridWidth: 30,
    gridHeight: 18,
    tileWidth: 64,
    tileHeight: 32,

    // Building plot positions (centered in the grid)
    plots: {
        [BuildingType.CASTLE]:      { tileX: 9, tileY: 5 },
        [BuildingType.LIBRARY]:     { tileX: 6, tileY: 7 },
        [BuildingType.LABORATORY]:  { tileX: 12, tileY: 7 },
        [BuildingType.TOWER]:       { tileX: 6, tileY: 11 },
        [BuildingType.WORKSHOP]:    { tileX: 12, tileY: 11 },
    },

    // House positions around the village center
    housePlots: [
        { tileX: 8, tileY: 8 },
        { tileX: 10, tileY: 8 },
        { tileX: 8, tileY: 10 },
        { tileX: 10, tileY: 10 },
        { tileX: 7, tileY: 9 },
        { tileX: 11, tileY: 9 },
        { tileX: 9, tileY: 8 },
        { tileX: 9, tileY: 10 },
    ],

    // Decoration zones (expanded for larger map)
    decorationZones: {
        trees: [
            // Northern forest edge
            { tileX: 2, tileY: 1 }, { tileX: 4, tileY: 1 }, { tileX: 6, tileY: 1 },
            { tileX: 12, tileY: 1 }, { tileX: 14, tileY: 1 }, { tileX: 16, tileY: 1 },
            { tileX: 1, tileY: 2 }, { tileX: 3, tileY: 2 }, { tileX: 15, tileY: 2 },
            // Eastern forest
            { tileX: 15, tileY: 5 }, { tileX: 16, tileY: 6 }, { tileX: 15, tileY: 8 },
            { tileX: 16, tileY: 10 }, { tileX: 15, tileY: 12 },
            // Western forest
            { tileX: 2, tileY: 5 }, { tileX: 1, tileY: 6 }, { tileX: 2, tileY: 8 },
            { tileX: 1, tileY: 10 }, { tileX: 2, tileY: 12 },
            // Southern forest
            { tileX: 2, tileY: 15 }, { tileX: 4, tileY: 16 }, { tileX: 6, tileY: 15 },
            { tileX: 12, tileY: 16 }, { tileX: 14, tileY: 15 }, { tileX: 16, tileY: 16 },
        ],
        banners: [
            { tileX: 8, tileY: 6 }, { tileX: 10, tileY: 6 },
            { tileX: 8, tileY: 12 }, { tileX: 10, tileY: 12 },
            { tileX: 7, tileY: 7 }, { tileX: 11, tileY: 7 },
        ],
        fountains: [
            { tileX: 9, tileY: 9 },
        ],
    },

    // Conference regions — new explorable islands connected by bridges
    conferenceRegions: [
        {
            id: 'atlantia',
            name: 'Atlantia',
            // Island center and bounds (within the 30x18 grid)
            centerX: 24,
            centerY: 9,
            radius: 4, // tiles from center that are land
            // Bridge from main village to this region
            bridge: { fromX: 16, toX: 21, y: 9 },
            // Landmark building position
            landmark: { tileX: 24, tileY: 9 },
            // Theme affects terrain colors
            theme: 'aquatic' as const,
        },
    ],
} as const;
