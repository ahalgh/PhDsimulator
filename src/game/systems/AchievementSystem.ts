import { VillageProgress, UserConfig } from '../types/gameState';
import { AchievementDefinition, AchievementCondition, ACHIEVEMENTS } from '../data/achievementConfig';
import { EventBus } from '../EventBus';

const STORAGE_KEY = 'phd-sim-achievements';

export interface UnlockedAchievement {
    id: string;
    unlockedAt: string;
}

interface PersistedState {
    unlocked: UnlockedAchievement[];
    version: number;
}

export class AchievementSystem {
    private unlocked: Map<string, UnlockedAchievement>;

    constructor() {
        const persisted = this.loadState();
        this.unlocked = new Map(persisted.unlocked.map(u => [u.id, u]));
    }

    /** Check all achievements. Returns array of newly unlocked ones. */
    checkAchievements(progress: VillageProgress, config: UserConfig): AchievementDefinition[] {
        const newlyUnlocked: AchievementDefinition[] = [];

        for (const achievement of ACHIEVEMENTS) {
            if (this.unlocked.has(achievement.id)) continue;

            if (this.evaluateCondition(achievement.condition, progress, config)) {
                this.unlock(achievement);
                newlyUnlocked.push(achievement);
            }
        }

        if (newlyUnlocked.length > 0) {
            this.saveState();
            for (const a of newlyUnlocked) {
                EventBus.emit('achievement-unlocked', a);
            }
        }

        return newlyUnlocked;
    }

    getUnlocked(): UnlockedAchievement[] {
        return [...this.unlocked.values()];
    }

    getUnlockedCount(): number {
        return this.unlocked.size;
    }

    getTotalCount(): number {
        return ACHIEVEMENTS.length;
    }

    getTotalPoints(): number {
        let total = 0;
        for (const [id] of this.unlocked) {
            const def = ACHIEVEMENTS.find(a => a.id === id);
            if (def) total += def.points;
        }
        return total;
    }

    isUnlocked(id: string): boolean {
        return this.unlocked.has(id);
    }

    getUnlockTimestamp(id: string): string | null {
        return this.unlocked.get(id)?.unlockedAt ?? null;
    }

    /** Calculate partial progress (0.0–1.0) for a locked achievement. */
    getProgress(achievement: AchievementDefinition, progress: VillageProgress, config: UserConfig): number {
        if (this.unlocked.has(achievement.id)) return 1;

        const cond = achievement.condition;

        if (cond.resourceMin) {
            const r = progress.resources;
            if (cond.resourceMin.researchPoints) {
                return Math.min(1, r.researchPoints / cond.resourceMin.researchPoints);
            }
            if (cond.resourceMin.knowledge) {
                return Math.min(1, r.knowledge / cond.resourceMin.knowledge);
            }
            if (cond.resourceMin.reputation) {
                return Math.min(1, r.reputation / cond.resourceMin.reputation);
            }
        }

        if (cond.minDestinations) {
            const unlocked = progress.travelDestinations.filter(d => d.unlocked).length;
            return Math.min(1, unlocked / cond.minDestinations);
        }

        if (cond.hasDestinations) {
            return progress.travelDestinations.filter(d => d.unlocked).length > 0 ? 1 : 0;
        }

        if (cond.minTotalBuildingLevel) {
            const total =
                progress.buildings.library.level +
                progress.buildings.laboratory.level +
                progress.buildings.tower.level +
                progress.buildings.workshop.level +
                progress.buildings.castle.level;
            return Math.min(1, total / cond.minTotalBuildingLevel);
        }

        if (cond.minHouses) {
            return Math.min(1, progress.buildings.houses.count / cond.minHouses);
        }

        if (cond.minDataSources) {
            const count = this.countDataSources(config);
            return Math.min(1, count / cond.minDataSources);
        }

        if (cond.allBuildingsMinLevel) {
            const target = cond.allBuildingsMinLevel * 5;
            const levels = [
                progress.buildings.library.level,
                progress.buildings.laboratory.level,
                progress.buildings.tower.level,
                progress.buildings.workshop.level,
                progress.buildings.castle.level,
            ];
            const actual = levels.reduce((sum, lv) => sum + Math.min(lv, cond.allBuildingsMinLevel!), 0);
            return Math.min(1, actual / target);
        }

        if (cond.buildingMinLevel) {
            for (const [type, minLv] of Object.entries(cond.buildingMinLevel)) {
                if (type === 'house') continue;
                const building = progress.buildings[type as keyof typeof progress.buildings];
                if (building && 'level' in building) {
                    return Math.min(1, building.level / (minLv ?? 1));
                }
            }
        }

        return 0;
    }

    // ─── Private ───

    private unlock(achievement: AchievementDefinition): void {
        this.unlocked.set(achievement.id, {
            id: achievement.id,
            unlockedAt: new Date().toISOString(),
        });
    }

    private evaluateCondition(
        cond: AchievementCondition,
        progress: VillageProgress,
        config: UserConfig,
    ): boolean {
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

        if (cond.minTotalBuildingLevel !== undefined) {
            const total =
                progress.buildings.library.level +
                progress.buildings.laboratory.level +
                progress.buildings.tower.level +
                progress.buildings.workshop.level +
                progress.buildings.castle.level;
            if (total < cond.minTotalBuildingLevel) return false;
        }

        if (cond.hasDestinations !== undefined) {
            const has = progress.travelDestinations.filter(d => d.unlocked).length > 0;
            if (cond.hasDestinations !== has) return false;
        }

        if (cond.minDestinations !== undefined) {
            if (progress.travelDestinations.filter(d => d.unlocked).length < cond.minDestinations) return false;
        }

        if (cond.minHouses !== undefined) {
            if (progress.buildings.houses.count < cond.minHouses) return false;
        }

        if (cond.minDataSources !== undefined) {
            if (this.countDataSources(config) < cond.minDataSources) return false;
        }

        if (cond.allBuildingsMinLevel !== undefined) {
            const minLv = cond.allBuildingsMinLevel;
            if (progress.buildings.library.level < minLv) return false;
            if (progress.buildings.laboratory.level < minLv) return false;
            if (progress.buildings.tower.level < minLv) return false;
            if (progress.buildings.workshop.level < minLv) return false;
            if (progress.buildings.castle.level < minLv) return false;
        }

        return true;
    }

    private countDataSources(config: UserConfig): number {
        let count = 0;
        if (config.githubUsername) count++;
        if (config.orcidId) count++;
        if (config.googleScholarId) count++;
        if (config.googleTasksEnabled) count++;
        if (config.googleCalendarId) count++;
        return count;
    }

    private loadState(): PersistedState {
        try {
            if (typeof localStorage === 'undefined') return { unlocked: [], version: 1 };
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                return {
                    unlocked: parsed.unlocked ?? [],
                    version: parsed.version ?? 1,
                };
            }
        } catch { /* ignore */ }
        return { unlocked: [], version: 1 };
    }

    private saveState(): void {
        try {
            if (typeof localStorage === 'undefined') return;
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                unlocked: [...this.unlocked.values()],
                version: 1,
            }));
        } catch { /* ignore */ }
    }
}
