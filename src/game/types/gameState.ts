export enum BuildingType {
    LIBRARY = 'library',
    LABORATORY = 'laboratory',
    TOWER = 'tower',
    WORKSHOP = 'workshop',
    CASTLE = 'castle',
    HOUSE = 'house',
}

export enum DecorationType {
    TREE = 'tree',
    BANNER = 'banner',
    FOUNTAIN = 'fountain',
}

export interface BuildingState {
    type: BuildingType;
    level: number;
    tileX: number;
    tileY: number;
}

export interface DecorationState {
    type: DecorationType;
    tileX: number;
    tileY: number;
}

export interface TravelDestination {
    id: string;
    name: string;
    fantasyName: string;
    region: string;
    unlocked: boolean;
    conferenceKey: string;
}

export interface Resources {
    researchPoints: number;
    knowledge: number;
    reputation: number;
}

export interface VillageProgress {
    resources: Resources;
    buildings: {
        library: { level: number; rawCount: number };
        laboratory: { level: number; rawCount: number };
        tower: { level: number; rawCount: number };
        workshop: { level: number; rawCount: number };
        castle: { level: number; rawCount: number };
        houses: { count: number };
    };
    decorations: {
        trees: number;
        banners: number;
        fountains: number;
    };
    travelDestinations: TravelDestination[];
    lastUpdated: string;
}

export interface UserConfig {
    githubUsername: string;
    orcidId: string;
    googleScholarId: string;
    googleTasksEnabled: boolean;
    googleCalendarId: string;
    manualMilestones: {
        qualifyingExam: boolean;
        proposalDefense: boolean;
        dissertationDefense: boolean;
    };
}

export interface GameState {
    version: number;
    config: UserConfig;
    village: VillageProgress;
    previousVillage: VillageProgress | null;
    buildingPositions: Record<string, { tileX: number; tileY: number }>;
    lastFetchTimestamp: string;
    createdAt: string;
}

export function getDefaultConfig(): UserConfig {
    return {
        githubUsername: '',
        orcidId: '',
        googleScholarId: '',
        googleTasksEnabled: false,
        googleCalendarId: '',
        manualMilestones: {
            qualifyingExam: false,
            proposalDefense: false,
            dissertationDefense: false,
        },
    };
}

export function getDefaultVillageProgress(): VillageProgress {
    return {
        resources: { researchPoints: 0, knowledge: 0, reputation: 0 },
        buildings: {
            library: { level: 1, rawCount: 0 },
            laboratory: { level: 1, rawCount: 0 },
            tower: { level: 1, rawCount: 0 },
            workshop: { level: 1, rawCount: 0 },
            castle: { level: 1, rawCount: 0 },
            houses: { count: 0 },
        },
        decorations: { trees: 0, banners: 0, fountains: 0 },
        travelDestinations: [
            // Scholar Port is always unlocked — the home port, open from day one
            { id: 'scholar-port', name: 'Home Port', fantasyName: 'Scholar Port', region: 'any', unlocked: true, conferenceKey: 'scholar-port' },
        ],
        lastUpdated: new Date().toISOString(),
    };
}

export function getDefaultGameState(): GameState {
    return {
        version: 3,
        config: getDefaultConfig(),
        village: getDefaultVillageProgress(),
        previousVillage: null,
        buildingPositions: {
            library:     { tileX: 3, tileY: 2 },
            laboratory:  { tileX: 6, tileY: 2 },
            tower:       { tileX: 3, tileY: 5 },
            workshop:    { tileX: 6, tileY: 5 },
            castle:      { tileX: 5, tileY: 0 },
            house_0:     { tileX: 1, tileY: 4 },
        },
        lastFetchTimestamp: '',
        createdAt: new Date().toISOString(),
    };
}
