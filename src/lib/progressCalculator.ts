import { VillageProgress, TravelDestination } from '../game/types/gameState';
import { BuildingType } from '../game/types/gameState';
import { getLevelForCount, getHouseCount, getDecorationCount, TRAVEL_DESTINATIONS } from '../game/data/buildingConfig';
import { RESOURCE_MULTIPLIERS, DECORATION_THRESHOLDS } from '../game/data/resourceConfig';

export interface GitHubData {
    totalCommits: number;
    totalPRsMerged: number;
    totalIssuesClosed: number;
}

export interface OrcidData {
    totalPublications: number;
    educationEntries: number;
}

export interface ScholarData {
    totalCitations: number;
    hIndex: number;
}

export interface TasksData {
    tasksCompleted: number;
    coursesCompleted: number;
    skillsLearned: number;
    conferences: Array<{ name: string; theme: string; location?: string }>;
}

export interface CalendarData {
    conferences: Array<{ name: string; theme: string; location?: string }>;
    academicEventCount: number;
}

export function calculateProgress(
    github: GitHubData | null,
    orcid: OrcidData | null,
    scholar: ScholarData | null,
    tasks: TasksData | null,
    calendar: CalendarData | null,
    manualMilestones: number
): VillageProgress {
    const gh = github ?? { totalCommits: 0, totalPRsMerged: 0, totalIssuesClosed: 0 };
    const or = orcid ?? { totalPublications: 0, educationEntries: 0 };
    const sc = scholar ?? { totalCitations: 0, hIndex: 0 };
    const tk = tasks ?? { tasksCompleted: 0, coursesCompleted: 0, skillsLearned: 0, conferences: [] };
    const cal = calendar ?? { conferences: [], academicEventCount: 0 };

    // Calculate resources
    const researchPoints =
        gh.totalCommits * RESOURCE_MULTIPLIERS.researchPoints.commitPoints +
        gh.totalPRsMerged * RESOURCE_MULTIPLIERS.researchPoints.prMergedPoints +
        gh.totalIssuesClosed * RESOURCE_MULTIPLIERS.researchPoints.issueClosedPoints +
        Math.floor(cal.academicEventCount * RESOURCE_MULTIPLIERS.researchPoints.academicEventPoints);

    const knowledge =
        tk.coursesCompleted * RESOURCE_MULTIPLIERS.knowledge.coursePoints +
        or.totalPublications * RESOURCE_MULTIPLIERS.knowledge.publicationPoints +
        tk.tasksCompleted * RESOURCE_MULTIPLIERS.knowledge.taskPoints;

    const reputation =
        sc.totalCitations * RESOURCE_MULTIPLIERS.reputation.citationPoints +
        sc.hIndex * RESOURCE_MULTIPLIERS.reputation.hIndexPoints;

    // Calculate building levels
    const libraryLevel = getLevelForCount(BuildingType.LIBRARY, or.totalPublications);
    const labLevel = getLevelForCount(BuildingType.LABORATORY, gh.totalCommits);
    const towerLevel = getLevelForCount(BuildingType.TOWER, tk.coursesCompleted);
    const workshopLevel = getLevelForCount(BuildingType.WORKSHOP, tk.skillsLearned);
    const castleLevel = getLevelForCount(BuildingType.CASTLE, manualMilestones);
    const houseCount = getHouseCount(tk.tasksCompleted);

    // Calculate decorations
    const trees = getDecorationCount(sc.totalCitations, DECORATION_THRESHOLDS.treesPerCitations);
    const banners = getDecorationCount(gh.totalPRsMerged, DECORATION_THRESHOLDS.bannersPerPRs);
    const fountains = getDecorationCount(sc.hIndex, DECORATION_THRESHOLDS.fountainsPerHIndex);

    // Map conferences/internships to travel destinations
    // Merge conferences from both Tasks and Calendar, deduplicate by name
    const allConferences = [...tk.conferences, ...cal.conferences];
    const seenNames = new Set<string>();
    const uniqueConferences = allConferences.filter(c => {
        const key = c.name.toLowerCase().trim();
        if (seenNames.has(key)) return false;
        seenNames.add(key);
        return true;
    });

    const travelDestinations: TravelDestination[] = [];
    const matchedIds = new Set<string>();

    for (const conf of uniqueConferences) {
        const nameLower = conf.name.toLowerCase();
        const locLower = (conf.location || '').toLowerCase();

        // Find best matching destination by conference name patterns first, then location
        let matched = TRAVEL_DESTINATIONS.find(dest =>
            dest.conferencePatterns.some(p => nameLower.includes(p))
        );
        if (!matched && locLower) {
            matched = TRAVEL_DESTINATIONS.find(dest =>
                dest.locationPatterns.some(p => locLower.includes(p))
            );
        }
        // Fall back to catch-all
        if (!matched) {
            matched = TRAVEL_DESTINATIONS.find(d => d.id === 'scholar-port')!;
        }

        if (!matchedIds.has(matched.id)) {
            matchedIds.add(matched.id);
            travelDestinations.push({
                id: matched.id,
                name: conf.name,
                fantasyName: matched.fantasyName,
                region: matched.region,
                unlocked: true,
                conferenceKey: conf.name,
            });
        }
    }

    return {
        resources: { researchPoints, knowledge, reputation },
        buildings: {
            library: { level: libraryLevel, rawCount: or.totalPublications },
            laboratory: { level: labLevel, rawCount: gh.totalCommits },
            tower: { level: towerLevel, rawCount: tk.coursesCompleted },
            workshop: { level: workshopLevel, rawCount: tk.skillsLearned },
            castle: { level: castleLevel, rawCount: manualMilestones },
            houses: { count: houseCount },
        },
        decorations: { trees, banners, fountains },
        travelDestinations,
        lastUpdated: new Date().toISOString(),
    };
}
