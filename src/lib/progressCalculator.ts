import { VillageProgress } from '../game/types/gameState';
import { BuildingType } from '../game/types/gameState';
import { getLevelForCount, getHouseCount, getDecorationCount } from '../game/data/buildingConfig';
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

export interface SheetData {
    tasksCompleted: number;
    coursesCompleted: number;
    skillsLearned: number;
    milestonesCompleted: number;
    conferences: Array<{ name: string; theme: string }>;
}

export function calculateProgress(
    github: GitHubData | null,
    orcid: OrcidData | null,
    scholar: ScholarData | null,
    sheet: SheetData | null
): VillageProgress {
    const gh = github ?? { totalCommits: 0, totalPRsMerged: 0, totalIssuesClosed: 0 };
    const or = orcid ?? { totalPublications: 0, educationEntries: 0 };
    const sc = scholar ?? { totalCitations: 0, hIndex: 0 };
    const sh = sheet ?? { tasksCompleted: 0, coursesCompleted: 0, skillsLearned: 0, milestonesCompleted: 0, conferences: [] };

    // Calculate resources
    const researchPoints =
        gh.totalCommits * RESOURCE_MULTIPLIERS.researchPoints.commitPoints +
        gh.totalPRsMerged * RESOURCE_MULTIPLIERS.researchPoints.prMergedPoints +
        gh.totalIssuesClosed * RESOURCE_MULTIPLIERS.researchPoints.issueClosedPoints;

    const knowledge =
        sh.coursesCompleted * RESOURCE_MULTIPLIERS.knowledge.coursePoints +
        or.totalPublications * RESOURCE_MULTIPLIERS.knowledge.publicationPoints +
        sh.tasksCompleted * RESOURCE_MULTIPLIERS.knowledge.taskPoints;

    const reputation =
        sc.totalCitations * RESOURCE_MULTIPLIERS.reputation.citationPoints +
        sc.hIndex * RESOURCE_MULTIPLIERS.reputation.hIndexPoints;

    // Calculate building levels
    const libraryLevel = getLevelForCount(BuildingType.LIBRARY, or.totalPublications);
    const labLevel = getLevelForCount(BuildingType.LABORATORY, gh.totalCommits);
    const towerLevel = getLevelForCount(BuildingType.TOWER, sh.coursesCompleted);
    const workshopLevel = getLevelForCount(BuildingType.WORKSHOP, sh.skillsLearned);
    const castleLevel = getLevelForCount(BuildingType.CASTLE, sh.milestonesCompleted);
    const houseCount = getHouseCount(sh.tasksCompleted);

    // Calculate decorations
    const trees = getDecorationCount(sc.totalCitations, DECORATION_THRESHOLDS.treesPerCitations);
    const banners = getDecorationCount(gh.totalPRsMerged, DECORATION_THRESHOLDS.bannersPerPRs);
    const fountains = getDecorationCount(sc.hIndex, DECORATION_THRESHOLDS.fountainsPerHIndex);

    // Map conferences to regions
    const directions: Array<'north' | 'south' | 'east' | 'west'> = ['north', 'east', 'south', 'west'];
    const conferences = sh.conferences.map((conf, i) => ({
        name: conf.name,
        theme: conf.theme || 'forest',
        unlocked: true,
        direction: directions[i % directions.length],
    }));

    return {
        resources: { researchPoints, knowledge, reputation },
        buildings: {
            library: { level: libraryLevel, rawCount: or.totalPublications },
            laboratory: { level: labLevel, rawCount: gh.totalCommits },
            tower: { level: towerLevel, rawCount: sh.coursesCompleted },
            workshop: { level: workshopLevel, rawCount: sh.skillsLearned },
            castle: { level: castleLevel, rawCount: sh.milestonesCompleted },
            houses: { count: houseCount },
        },
        decorations: { trees, banners, fountains },
        conferences,
        lastUpdated: new Date().toISOString(),
    };
}
