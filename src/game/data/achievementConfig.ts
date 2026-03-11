import { BuildingType } from '../types/gameState';

// ─── Achievement types ───

export type AchievementCategory = 'buildings' | 'resources' | 'travel' | 'social' | 'milestones' | 'meta';
export type AchievementTier = 'bronze' | 'silver' | 'gold';

export interface AchievementCondition {
    buildingMinLevel?: Partial<Record<string, number>>;
    minTotalBuildingLevel?: number;
    resourceMin?: { researchPoints?: number; knowledge?: number; reputation?: number };
    minDestinations?: number;
    hasDestinations?: boolean;
    minHouses?: number;
    minDataSources?: number;
    allBuildingsMinLevel?: number; // every main building >= this level
}

export interface AchievementDefinition {
    id: string;
    name: string;
    description: string;
    hint: string;
    icon: string;
    category: AchievementCategory;
    tier: AchievementTier;
    condition: AchievementCondition;
    points: number;
}

// ─── Achievement catalog ───

export const ACHIEVEMENTS: AchievementDefinition[] = [
    // ─── BUILDINGS ───

    {
        id: 'first_upgrade',
        name: 'Foundation Stone',
        description: 'Upgrade any building to level 2',
        hint: 'Every great settlement starts with a single upgrade...',
        icon: '\u{1F9F1}',
        category: 'buildings',
        tier: 'bronze',
        condition: { minTotalBuildingLevel: 6 },
        points: 10,
    },
    {
        id: 'library_lv3',
        name: 'Well-Read Scholar',
        description: 'Upgrade the Library to level 3',
        hint: 'Fill the Library with more publications...',
        icon: '\u{1F4DA}',
        category: 'buildings',
        tier: 'bronze',
        condition: { buildingMinLevel: { [BuildingType.LIBRARY]: 3 } },
        points: 10,
    },
    {
        id: 'lab_lv3',
        name: 'Lab Rat',
        description: 'Upgrade the Laboratory to level 3',
        hint: 'Commit more code experiments to your repository...',
        icon: '\u{1F9EA}',
        category: 'buildings',
        tier: 'bronze',
        condition: { buildingMinLevel: { [BuildingType.LABORATORY]: 3 } },
        points: 10,
    },
    {
        id: 'all_buildings_lv3',
        name: 'Growing Settlement',
        description: 'All main buildings reach level 3',
        hint: 'Balance your efforts across all domains...',
        icon: '\u{1F3D8}',
        category: 'buildings',
        tier: 'silver',
        condition: { allBuildingsMinLevel: 3 },
        points: 25,
    },
    {
        id: 'library_lv5',
        name: 'Grand Librarian',
        description: 'Upgrade the Library to maximum level',
        hint: 'A truly prolific scholar fills the Library to its pinnacle...',
        icon: '\u{1F3DB}',
        category: 'buildings',
        tier: 'silver',
        condition: { buildingMinLevel: { [BuildingType.LIBRARY]: 5 } },
        points: 25,
    },
    {
        id: 'lab_lv5',
        name: 'Mad Scientist',
        description: 'Upgrade the Laboratory to maximum level',
        hint: 'Over a thousand experiments fill the Laboratory...',
        icon: '\u{1F52C}',
        category: 'buildings',
        tier: 'silver',
        condition: { buildingMinLevel: { [BuildingType.LABORATORY]: 5 } },
        points: 25,
    },
    {
        id: 'all_buildings_lv5',
        name: 'Atlantis Perfected',
        description: 'All main buildings reach maximum level',
        hint: 'Master every domain to perfect your island...',
        icon: '\u{1F451}',
        category: 'buildings',
        tier: 'gold',
        condition: { allBuildingsMinLevel: 5 },
        points: 50,
    },

    // ─── RESOURCES ───

    {
        id: 'rp_100',
        name: 'Apprentice Researcher',
        description: 'Earn 100 Research Points',
        hint: 'Keep committing code and closing issues...',
        icon: '\u{1F52D}',
        category: 'resources',
        tier: 'bronze',
        condition: { resourceMin: { researchPoints: 100 } },
        points: 10,
    },
    {
        id: 'knowledge_50',
        name: 'Eager Learner',
        description: 'Accumulate 50 Knowledge',
        hint: 'Complete courses and publish your findings...',
        icon: '\u{1F4D6}',
        category: 'resources',
        tier: 'bronze',
        condition: { resourceMin: { knowledge: 50 } },
        points: 10,
    },
    {
        id: 'rp_500',
        name: 'Seasoned Researcher',
        description: 'Earn 500 Research Points',
        hint: 'Hundreds of experiments lie ahead...',
        icon: '\u{2697}',
        category: 'resources',
        tier: 'silver',
        condition: { resourceMin: { researchPoints: 500 } },
        points: 25,
    },
    {
        id: 'rp_1000',
        name: 'Research Titan',
        description: 'Earn 1000 Research Points',
        hint: 'A true giant in the laboratory of science...',
        icon: '\u{1F31F}',
        category: 'resources',
        tier: 'gold',
        condition: { resourceMin: { researchPoints: 1000 } },
        points: 50,
    },

    // ─── TRAVEL ───

    {
        id: 'first_voyage',
        name: 'First Voyage',
        description: 'Unlock your first travel destination',
        hint: 'Attend a conference to discover a new port...',
        icon: '\u{26F5}',
        category: 'travel',
        tier: 'bronze',
        condition: { hasDestinations: true },
        points: 10,
    },
    {
        id: 'voyages_3',
        name: 'Seasoned Traveler',
        description: 'Unlock 3 travel destinations',
        hint: 'The sea chart grows with each conference...',
        icon: '\u{1F5FA}',
        category: 'travel',
        tier: 'silver',
        condition: { minDestinations: 3 },
        points: 25,
    },
    {
        id: 'voyages_6',
        name: 'World Explorer',
        description: 'Unlock 6 travel destinations',
        hint: 'Almost every port on the sea chart is yours...',
        icon: '\u{1F30D}',
        category: 'travel',
        tier: 'gold',
        condition: { minDestinations: 6 },
        points: 50,
    },

    // ─── SOCIAL (Reputation) ───

    {
        id: 'rep_10',
        name: 'Getting Noticed',
        description: 'Earn 10 Reputation',
        hint: 'Citations begin to trickle in...',
        icon: '\u{1F4E2}',
        category: 'social',
        tier: 'bronze',
        condition: { resourceMin: { reputation: 10 } },
        points: 10,
    },
    {
        id: 'rep_50',
        name: 'Rising Star',
        description: 'Earn 50 Reputation',
        hint: 'Scholars begin to recognize your name...',
        icon: '\u{2B50}',
        category: 'social',
        tier: 'silver',
        condition: { resourceMin: { reputation: 50 } },
        points: 25,
    },
    {
        id: 'rep_200',
        name: 'Renowned Scholar',
        description: 'Earn 200 Reputation',
        hint: 'Your name echoes across the academic world...',
        icon: '\u{1F396}',
        category: 'social',
        tier: 'gold',
        condition: { resourceMin: { reputation: 200 } },
        points: 50,
    },

    // ─── MILESTONES (Castle) ───

    {
        id: 'castle_lv2',
        name: 'First Milestone',
        description: 'Complete your first PhD milestone',
        hint: 'Pass your qualifying exam or equivalent...',
        icon: '\u{1F3F0}',
        category: 'milestones',
        tier: 'bronze',
        condition: { buildingMinLevel: { [BuildingType.CASTLE]: 2 } },
        points: 10,
    },
    {
        id: 'castle_lv3',
        name: 'Proposal Defended',
        description: 'Reach Castle level 3',
        hint: 'Another major milestone stands before you...',
        icon: '\u{1F6E1}',
        category: 'milestones',
        tier: 'silver',
        condition: { buildingMinLevel: { [BuildingType.CASTLE]: 3 } },
        points: 25,
    },
    {
        id: 'castle_lv5',
        name: 'Doctor of Philosophy',
        description: 'Reach Castle level 5 -- dissertation defended!',
        hint: 'The ultimate pinnacle of the Keep awaits...',
        icon: '\u{1F393}',
        category: 'milestones',
        tier: 'gold',
        condition: { buildingMinLevel: { [BuildingType.CASTLE]: 5 } },
        points: 50,
    },

    // ─── META ───

    {
        id: 'houses_3',
        name: 'Growing Community',
        description: 'Build 3 houses in your village',
        hint: 'Complete more short-term tasks to attract villagers...',
        icon: '\u{1F3E0}',
        category: 'meta',
        tier: 'bronze',
        condition: { minHouses: 3 },
        points: 10,
    },
    {
        id: 'data_source_1',
        name: 'Connected Scholar',
        description: 'Connect at least 1 data source',
        hint: 'Link GitHub, ORCID, Scholar, or Sheets...',
        icon: '\u{1F517}',
        category: 'meta',
        tier: 'bronze',
        condition: { minDataSources: 1 },
        points: 10,
    },
    {
        id: 'data_source_3',
        name: 'Data Driven',
        description: 'Connect 3 or more data sources',
        hint: 'The more sources, the richer your village...',
        icon: '\u{1F4CA}',
        category: 'meta',
        tier: 'silver',
        condition: { minDataSources: 3 },
        points: 25,
    },
    {
        id: 'houses_6',
        name: 'Thriving Village',
        description: 'Build 6 houses in your village',
        hint: 'A bustling settlement of diligent task-doers...',
        icon: '\u{1F3D8}',
        category: 'meta',
        tier: 'silver',
        condition: { minHouses: 6 },
        points: 25,
    },
    {
        id: 'data_source_4',
        name: 'Fully Integrated',
        description: 'Connect all 4 data sources',
        hint: 'GitHub, ORCID, Scholar, and Sheets -- the complete set...',
        icon: '\u{1F4A1}',
        category: 'meta',
        tier: 'gold',
        condition: { minDataSources: 4 },
        points: 50,
    },
];

// ─── Display metadata ───

export const CATEGORY_META: Record<AchievementCategory, { label: string; icon: string; color: string }> = {
    buildings:  { label: 'Buildings',   icon: '\u{1F3D7}',  color: '#FF9800' },
    resources:  { label: 'Resources',   icon: '\u{1F48E}',  color: '#42A5F5' },
    travel:     { label: 'Travel',      icon: '\u{26F5}',   color: '#26C6DA' },
    social:     { label: 'Social',      icon: '\u{1F4E3}',  color: '#FFD700' },
    milestones: { label: 'Milestones',  icon: '\u{1F3F0}',  color: '#78909C' },
    meta:       { label: 'Meta',        icon: '\u{2B50}',   color: '#AB47BC' },
};

export const TIER_COLORS: Record<AchievementTier, string> = {
    bronze: '#CD7F32',
    silver: '#C0C0C0',
    gold:   '#FFD700',
};
