// Resource calculation multipliers
export const RESOURCE_MULTIPLIERS = {
    researchPoints: {
        commitPoints: 1,
        prMergedPoints: 5,
        issueClosedPoints: 2,
        academicEventPoints: 0.5,
    },
    knowledge: {
        coursePoints: 10,
        publicationPoints: 20,
        taskPoints: 1,
    },
    reputation: {
        citationPoints: 1,
        hIndexPoints: 10,
        fundingPoints: 50,
    },
} as const;

// Decoration thresholds
export const DECORATION_THRESHOLDS = {
    treesPerCitations: 5,
    bannersPerPRs: 5,
    fountainsPerHIndex: 3,
} as const;
