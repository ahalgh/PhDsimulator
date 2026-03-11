import { GameState, VillageProgress, getDefaultGameState } from '../game/types/gameState';

const STORAGE_KEY = 'phd-simulator-state';
const CONFIG_KEY = 'phd-simulator-config';
const FETCH_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

export function loadState(): GameState {
    if (typeof window === 'undefined') return getDefaultGameState();

    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return getDefaultGameState();

        const parsed = JSON.parse(raw) as GameState;

        if (!parsed.version) {
            return getDefaultGameState();
        }

        // Migrate v1 → v2: conferences → travelDestinations
        if (parsed.version === 1) {
            const village = parsed.village as any;
            if (village?.conferences) {
                village.travelDestinations = village.conferences.map((c: any) => ({
                    id: c.name?.toLowerCase().replace(/\s+/g, '-') || 'unknown',
                    name: c.name || '',
                    fantasyName: c.name || '',
                    region: 'any',
                    unlocked: c.unlocked ?? true,
                    conferenceKey: c.name || '',
                }));
                delete village.conferences;
            } else if (!village?.travelDestinations) {
                village.travelDestinations = [];
            }
            if (parsed.previousVillage) {
                const prev = parsed.previousVillage as any;
                if (prev.conferences) {
                    prev.travelDestinations = prev.conferences.map((c: any) => ({
                        id: c.name?.toLowerCase().replace(/\s+/g, '-') || 'unknown',
                        name: c.name || '',
                        fantasyName: c.name || '',
                        region: 'any',
                        unlocked: c.unlocked ?? true,
                        conferenceKey: c.name || '',
                    }));
                    delete prev.conferences;
                } else if (!prev.travelDestinations) {
                    prev.travelDestinations = [];
                }
            }
            parsed.version = 2;
        }

        // Migrate v2 → v3: Google Sheets → Google Tasks + Calendar
        if (parsed.version === 2) {
            const config = parsed.config as any;
            delete config.sheetsSpreadsheetId;
            delete config.sheetMapping;
            if (config.googleTasksEnabled === undefined) {
                config.googleTasksEnabled = false;
            }
            if (config.googleCalendarId === undefined) {
                config.googleCalendarId = '';
            }
            parsed.version = 3;
        }

        return parsed;
    } catch {
        return getDefaultGameState();
    }
}

export function saveState(state: GameState): void {
    if (typeof window === 'undefined') return;

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.error('Failed to save game state:', e);
    }
}

export function saveConfig(config: GameState['config']): void {
    if (typeof window === 'undefined') return;

    try {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    } catch (e) {
        console.error('Failed to save config:', e);
    }
}

export function loadConfig(): GameState['config'] | null {
    if (typeof window === 'undefined') return null;

    try {
        const raw = localStorage.getItem(CONFIG_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export function clearFetchCooldown(): void {
    if (typeof window === 'undefined') return;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const state = JSON.parse(raw) as GameState;
        state.lastFetchTimestamp = '';
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* ignore */ }
}

export function shouldFetch(state: GameState): boolean {
    if (!state.lastFetchTimestamp) return true;

    const lastFetch = new Date(state.lastFetchTimestamp).getTime();
    const now = Date.now();

    return now - lastFetch > FETCH_COOLDOWN_MS;
}

export interface StateDiff {
    buildingUpgrades: Array<{
        type: string;
        oldLevel: number;
        newLevel: number;
    }>;
    newHouses: number;
    newDecorations: {
        trees: number;
        banners: number;
        fountains: number;
    };
    newDestinations: string[];
    resourceChanges: {
        researchPoints: number;
        knowledge: number;
        reputation: number;
    };
}

export function getStateDiff(
    oldVillage: VillageProgress | null,
    newVillage: VillageProgress
): StateDiff {
    if (!oldVillage) {
        return {
            buildingUpgrades: [],
            newHouses: 0,
            newDecorations: { trees: 0, banners: 0, fountains: 0 },
            newDestinations: [],
            resourceChanges: { researchPoints: 0, knowledge: 0, reputation: 0 },
        };
    }

    const buildingUpgrades: StateDiff['buildingUpgrades'] = [];
    const buildingTypes = ['library', 'laboratory', 'tower', 'workshop', 'castle'] as const;

    for (const type of buildingTypes) {
        const oldLevel = oldVillage.buildings[type].level;
        const newLevel = newVillage.buildings[type].level;
        if (newLevel > oldLevel) {
            buildingUpgrades.push({ type, oldLevel, newLevel });
        }
    }

    return {
        buildingUpgrades,
        newHouses: newVillage.buildings.houses.count - oldVillage.buildings.houses.count,
        newDecorations: {
            trees: newVillage.decorations.trees - oldVillage.decorations.trees,
            banners: newVillage.decorations.banners - oldVillage.decorations.banners,
            fountains: newVillage.decorations.fountains - oldVillage.decorations.fountains,
        },
        newDestinations: newVillage.travelDestinations
            .filter(d => d.unlocked)
            .filter(d => !oldVillage.travelDestinations.find(od => od.id === d.id && od.unlocked))
            .map(d => d.fantasyName),
        resourceChanges: {
            researchPoints: newVillage.resources.researchPoints - oldVillage.resources.researchPoints,
            knowledge: newVillage.resources.knowledge - oldVillage.resources.knowledge,
            reputation: newVillage.resources.reputation - oldVillage.resources.reputation,
        },
    };
}
