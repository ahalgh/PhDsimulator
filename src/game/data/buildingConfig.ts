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

export const BUILDING_ACADEMIC_CONTEXT: Record<BuildingType, {
    dataSource: string;
    metric: string;
    configKey: string;
    themeColor: number;
    levelLabels: string[];
}> = {
    [BuildingType.LIBRARY]: {
        dataSource: 'ORCID',
        metric: 'publications',
        configKey: 'orcidId',
        themeColor: 0xFFD700,
        levelLabels: ['Shelf', 'Reading Room', 'Archive', 'Grand Hall', 'Grand Library'],
    },
    [BuildingType.LABORATORY]: {
        dataSource: 'GitHub',
        metric: 'commits',
        configKey: 'githubUsername',
        themeColor: 0x42A5F5,
        levelLabels: ['Workbench', 'Study', 'Lab', 'Research Center', 'Grand Laboratory'],
    },
    [BuildingType.TOWER]: {
        dataSource: 'Google Tasks',
        metric: 'courses completed',
        configKey: 'googleTasksEnabled',
        themeColor: 0xCE93D8,
        levelLabels: ['Watchtower', 'Lookout', 'Spire', 'Observatory', 'Tower of Knowledge'],
    },
    [BuildingType.WORKSHOP]: {
        dataSource: 'Google Tasks',
        metric: 'skills mastered',
        configKey: 'googleTasksEnabled',
        themeColor: 0xFF9800,
        levelLabels: ['Shed', 'Forge', 'Workshop', 'Armory', 'Grand Workshop'],
    },
    [BuildingType.CASTLE]: {
        dataSource: 'Manual Milestones',
        metric: 'PhD milestones',
        configKey: '',
        themeColor: 0x78909C,
        levelLabels: ['Foundation', 'Walls', 'Battlements', 'Towers', 'The Keep'],
    },
    [BuildingType.HOUSE]: {
        dataSource: 'Google Tasks',
        metric: 'tasks completed',
        configKey: 'googleTasksEnabled',
        themeColor: 0x8D6E63,
        levelLabels: ['Hut', 'Cottage', 'House', 'Manor', 'Estate'],
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

// Village map: Atlantis island
export const VILLAGE_LAYOUT = {
    gridWidth: 20,
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

    // Dock and ship positions on the southeast coast
    dock: {
        tileX: 14,
        tileY: 13,
        shipTileX: 16,
        shipTileY: 14,
    },

    // Decoration zones
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
} as const;

// Travel destination configs — map conferences/internships to fantasy locations
export interface TravelDestinationConfig {
    id: string;
    fantasyName: string;
    region: string;
    description: string;
    themeColor: number;
    conferencePatterns: string[];
    locationPatterns: string[];
}

export const TRAVEL_DESTINATIONS: TravelDestinationConfig[] = [
    {
        id: 'bayou-landing',
        fantasyName: 'Bayou Landing',
        region: 'north-america',
        description: 'A misty port in the southern bayous',
        themeColor: 0x7B1FA2,
        conferencePatterns: ['neurips', 'nips'],
        locationPatterns: ['new orleans', 'louisiana'],
    },
    {
        id: 'alpine-spire',
        fantasyName: 'Alpine Spire',
        region: 'europe',
        description: 'A crystalline citadel high in the mountains',
        themeColor: 0x1565C0,
        conferencePatterns: ['iclr'],
        locationPatterns: ['vienna', 'austria', 'singapore'],
    },
    {
        id: 'pacific-pavilion',
        fantasyName: 'Pacific Pavilion',
        region: 'north-america',
        description: 'A grand hall overlooking the western sea',
        themeColor: 0x00897B,
        conferencePatterns: ['icml'],
        locationPatterns: ['honolulu', 'hawaii', 'baltimore'],
    },
    {
        id: 'cedar-haven',
        fantasyName: 'Cedar Haven',
        region: 'north-america',
        description: 'A lodge nestled among ancient redwoods',
        themeColor: 0x2E7D32,
        conferencePatterns: ['cvpr'],
        locationPatterns: ['seattle', 'nashville', 'vancouver'],
    },
    {
        id: 'sakura-isle',
        fantasyName: 'Sakura Isle',
        region: 'asia',
        description: 'An island of cherry blossoms and ancient temples',
        themeColor: 0xE91E63,
        conferencePatterns: ['acl', 'emnlp'],
        locationPatterns: ['tokyo', 'bangkok', 'japan', 'korea'],
    },
    {
        id: 'coral-reach',
        fantasyName: 'Coral Reach',
        region: 'north-america',
        description: 'A vibrant reef city beneath the southern stars',
        themeColor: 0xFF6F00,
        conferencePatterns: ['aaai'],
        locationPatterns: ['washington', 'phoenix', 'philadelphia'],
    },
    {
        id: 'ivory-docks',
        fantasyName: 'Ivory Docks',
        region: 'europe',
        description: 'A bustling port of commerce and knowledge',
        themeColor: 0x6D4C41,
        conferencePatterns: ['eccv', 'iccv'],
        locationPatterns: ['milan', 'glasgow', 'paris', 'amsterdam'],
    },
    {
        id: 'scholar-port',
        fantasyName: 'Scholar Port',
        region: 'any',
        description: 'A harbor for visiting scholars and interns',
        themeColor: 0x546E7A,
        conferencePatterns: [],
        locationPatterns: [],
    },
];
