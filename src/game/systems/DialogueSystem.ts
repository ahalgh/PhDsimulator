import { VillageProgress } from '../types/gameState';
import { NpcId, DialogueLine, DialogueCondition, DIALOGUE_POOLS } from '../data/dialogueConfig';

const SEEN_STORAGE_KEY = 'phd-sim-dialogue-seen';
const NPC_COOLDOWN_MS = 30_000;

interface PersistedState {
    seenOnceOnly: string[];
    lastShownPerNpc: Record<string, string>;
}

export class DialogueSystem {
    private seenOnceOnly: Set<string>;
    private lastShownPerNpc: Record<string, string>;
    private lastInteractTime: Record<string, number> = {};

    constructor() {
        const persisted = this.loadState();
        this.seenOnceOnly = new Set(persisted.seenOnceOnly);
        this.lastShownPerNpc = persisted.lastShownPerNpc;
    }

    selectDialogue(npcId: NpcId, progress: VillageProgress): DialogueLine | null {
        const pool = DIALOGUE_POOLS[npcId];
        if (!pool || pool.length === 0) return null;

        // Cooldown: return same line if clicked recently
        const now = Date.now();
        const lastTime = this.lastInteractTime[npcId] ?? 0;
        if (now - lastTime < NPC_COOLDOWN_MS) {
            const lastId = this.lastShownPerNpc[npcId];
            if (lastId) {
                const lastLine = pool.find(l => l.id === lastId);
                if (lastLine) return lastLine;
            }
        }

        // Filter by conditions and onceOnly
        const eligible = pool.filter(line => {
            if (line.onceOnly && this.seenOnceOnly.has(line.id)) return false;
            if (!line.condition) return true;
            return this.evaluateCondition(line.condition, progress);
        });

        if (eligible.length === 0) return null;

        // Find highest priority
        const maxPriority = Math.max(...eligible.map(l => l.priority ?? 0));
        const topTier = eligible.filter(l => (l.priority ?? 0) === maxPriority);

        // Pick randomly, avoiding last shown
        const lastShownId = this.lastShownPerNpc[npcId];
        let candidates = topTier.length > 1
            ? topTier.filter(l => l.id !== lastShownId)
            : topTier;
        if (candidates.length === 0) candidates = topTier;

        const selected = candidates[Math.floor(Math.random() * candidates.length)];

        // Record
        this.lastShownPerNpc[npcId] = selected.id;
        this.lastInteractTime[npcId] = now;
        if (selected.onceOnly) {
            this.seenOnceOnly.add(selected.id);
        }
        this.saveState();

        return selected;
    }

    private evaluateCondition(cond: DialogueCondition, progress: VillageProgress): boolean {
        if (cond.buildingMinLevel) {
            for (const [type, minLv] of Object.entries(cond.buildingMinLevel)) {
                if (type === 'house') continue;
                const building = progress.buildings[type as keyof typeof progress.buildings];
                if (!building || !('level' in building)) continue;
                if (building.level < (minLv ?? 0)) return false;
            }
        }

        if (cond.resourceMin) {
            const r = progress.resources;
            if (cond.resourceMin.researchPoints !== undefined && r.researchPoints < cond.resourceMin.researchPoints) return false;
            if (cond.resourceMin.knowledge !== undefined && r.knowledge < cond.resourceMin.knowledge) return false;
            if (cond.resourceMin.reputation !== undefined && r.reputation < cond.resourceMin.reputation) return false;
        }

        if (cond.resourceMax) {
            const r = progress.resources;
            if (cond.resourceMax.researchPoints !== undefined && r.researchPoints > cond.resourceMax.researchPoints) return false;
            if (cond.resourceMax.knowledge !== undefined && r.knowledge > cond.resourceMax.knowledge) return false;
            if (cond.resourceMax.reputation !== undefined && r.reputation > cond.resourceMax.reputation) return false;
        }

        if (cond.minTotalBuildingLevel !== undefined || cond.maxTotalBuildingLevel !== undefined) {
            const total =
                progress.buildings.library.level +
                progress.buildings.laboratory.level +
                progress.buildings.tower.level +
                progress.buildings.workshop.level +
                progress.buildings.castle.level;
            if (cond.minTotalBuildingLevel !== undefined && total < cond.minTotalBuildingLevel) return false;
            if (cond.maxTotalBuildingLevel !== undefined && total > cond.maxTotalBuildingLevel) return false;
        }

        if (cond.hasDestinations !== undefined) {
            const has = progress.travelDestinations.length > 0;
            if (cond.hasDestinations !== has) return false;
        }

        if (cond.minDestinations !== undefined) {
            if (progress.travelDestinations.length < cond.minDestinations) return false;
        }

        return true;
    }

    private loadState(): PersistedState {
        try {
            if (typeof localStorage === 'undefined') return { seenOnceOnly: [], lastShownPerNpc: {} };
            const raw = localStorage.getItem(SEEN_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                return {
                    seenOnceOnly: parsed.seenOnceOnly ?? [],
                    lastShownPerNpc: parsed.lastShownPerNpc ?? {},
                };
            }
        } catch { /* ignore */ }
        return { seenOnceOnly: [], lastShownPerNpc: {} };
    }

    private saveState(): void {
        try {
            if (typeof localStorage === 'undefined') return;
            localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify({
                seenOnceOnly: [...this.seenOnceOnly],
                lastShownPerNpc: this.lastShownPerNpc,
            }));
        } catch { /* ignore */ }
    }
}
