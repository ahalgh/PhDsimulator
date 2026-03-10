import { BuildingType } from '../types/gameState';

// ─── NPC identity ───

export type NpcId = 'farmer' | 'guard' | 'merchant';

export interface NpcConfig {
    id: NpcId;
    spriteKey: string;
    displayName: string;
    title: string;
    homeTile: { x: number; y: number };
    themeColor: number;
}

export const NPC_CONFIGS: Record<NpcId, NpcConfig> = {
    farmer: {
        id: 'farmer',
        spriteKey: 'villager_farmer',
        displayName: 'Agatha',
        title: 'The Diligent Farmer',
        homeTile: { x: 7, y: 8 },
        themeColor: 0x66BB6A,
    },
    guard: {
        id: 'guard',
        spriteKey: 'villager_guard',
        displayName: 'Rowan',
        title: 'The Steadfast Guard',
        homeTile: { x: 11, y: 10 },
        themeColor: 0x42A5F5,
    },
    merchant: {
        id: 'merchant',
        spriteKey: 'villager_merchant',
        displayName: 'Orin',
        title: 'The Traveling Merchant',
        homeTile: { x: 8, y: 12 },
        themeColor: 0xFFD700,
    },
};

// ─── Dialogue conditions & lines ───

export interface DialogueCondition {
    buildingMinLevel?: Partial<Record<string, number>>;
    resourceMin?: { researchPoints?: number; knowledge?: number; reputation?: number };
    resourceMax?: { researchPoints?: number; knowledge?: number; reputation?: number };
    minTotalBuildingLevel?: number;
    maxTotalBuildingLevel?: number;
    hasDestinations?: boolean;
    minDestinations?: number;
}

export interface DialogueLine {
    id: string;
    text: string;
    condition?: DialogueCondition;
    priority?: number;
    onceOnly?: boolean;
}

// ─── Dialogue pools per NPC ───

export const DIALOGUE_POOLS: Record<NpcId, DialogueLine[]> = {
    farmer: [
        // Generic
        {
            id: 'farmer_hello',
            text: "Another day in the fields! Tending crops is a lot like writing a thesis... one row at a time.",
        },
        {
            id: 'farmer_patience',
            text: "Patience, scholar. Even the mightiest oak was once a stubborn seed that refused to give up.",
        },
        {
            id: 'farmer_daily',
            text: "I find that starting each day with a small task builds momentum. Have you tried that?",
        },
        {
            id: 'farmer_rest',
            text: "Don't forget to rest. A fallow field grows the richest harvest next season.",
        },
        {
            id: 'farmer_seasons',
            text: "Every season has its purpose. Spring for planting, autumn for reaping. Where are you in your journey?",
        },
        // Context-aware
        {
            id: 'farmer_early_stage',
            text: "Every great scholar started with a blank page. Your village will grow, I promise.",
            condition: { maxTotalBuildingLevel: 7 },
            priority: 1,
        },
        {
            id: 'farmer_library_growing',
            text: "The Library is filling up nicely! Each publication is a seed for future scholars to find.",
            condition: { buildingMinLevel: { [BuildingType.LIBRARY]: 3 } },
            priority: 2,
        },
        {
            id: 'farmer_lab_busy',
            text: "I hear hammering from the Laboratory day and night. You've been busy with experiments!",
            condition: { buildingMinLevel: { [BuildingType.LABORATORY]: 3 } },
            priority: 2,
        },
        {
            id: 'farmer_high_progress',
            text: "Look how the village has flourished! I remember when this was all empty plots.",
            condition: { minTotalBuildingLevel: 18 },
            priority: 3,
        },
        {
            id: 'farmer_castle_upgrade',
            text: "The Keep grows taller with each milestone you conquer. Truly impressive!",
            condition: { buildingMinLevel: { [BuildingType.CASTLE]: 3 } },
            priority: 2,
        },
    ],
    guard: [
        // Generic
        {
            id: 'guard_hello',
            text: "Standing watch over your progress, scholar. No setback shall breach these walls.",
        },
        {
            id: 'guard_persevere',
            text: "A PhD is a marathon, not a sprint. The scholars who persist... they build empires.",
        },
        {
            id: 'guard_defend',
            text: "Guard your time as fiercely as I guard this village. Say no to distractions!",
        },
        {
            id: 'guard_routine',
            text: "Discipline is doing what needs to be done, even when you don't feel like it. I patrol rain or shine.",
        },
        {
            id: 'guard_walls',
            text: "Strong walls are built brick by brick, just like a dissertation is built paragraph by paragraph.",
        },
        // Context-aware
        {
            id: 'guard_first_milestone',
            text: "You've reached a milestone! The Keep stands stronger. I'll protect it with my life.",
            condition: { buildingMinLevel: { [BuildingType.CASTLE]: 2 } },
            priority: 2,
            onceOnly: true,
        },
        {
            id: 'guard_castle_high',
            text: "The Keep is a fortress now. Your dedication to milestones is legendary in this village.",
            condition: { buildingMinLevel: { [BuildingType.CASTLE]: 4 } },
            priority: 3,
        },
        {
            id: 'guard_tower_comment',
            text: "The Tower of Knowledge grows taller. Each course strengthens the foundations of your work.",
            condition: { buildingMinLevel: { [BuildingType.TOWER]: 3 } },
            priority: 2,
        },
        {
            id: 'guard_early',
            text: "Your village is young, but so was Rome once. Keep building. I'll keep watch.",
            condition: { maxTotalBuildingLevel: 7 },
            priority: 1,
        },
        {
            id: 'guard_high_progress',
            text: "I've watched this village transform from a clearing to a thriving settlement. You should be proud.",
            condition: { minTotalBuildingLevel: 20 },
            priority: 3,
        },
    ],
    merchant: [
        // Generic
        {
            id: 'merchant_hello',
            text: "Greetings, scholar! Word of your work travels far. Let's talk about building your reputation.",
        },
        {
            id: 'merchant_network',
            text: "In my travels, I've learned that who you know matters as much as what you know. Collaborate widely!",
        },
        {
            id: 'merchant_reputation',
            text: "Reputation is like compound interest. Every citation, every collaboration... it all adds up.",
        },
        {
            id: 'merchant_advice',
            text: "A wise merchant diversifies their portfolio. A wise scholar diversifies their skills.",
        },
        {
            id: 'merchant_trade',
            text: "The best trades I've made were built on trust. In academia, your word is your currency.",
        },
        // Context-aware
        {
            id: 'merchant_high_rep',
            text: "Your reputation precedes you, scholar! Even in distant ports they speak of your contributions.",
            condition: { resourceMin: { reputation: 50 } },
            priority: 2,
        },
        {
            id: 'merchant_very_high_rep',
            text: "I could sell your autograph for a fortune in Bayou Landing! Your name carries weight across the seas.",
            condition: { resourceMin: { reputation: 200 } },
            priority: 3,
        },
        {
            id: 'merchant_first_travel',
            text: "I see the ship has taken you abroad! Conference voyages are the lifeblood of a traveling merchant.",
            condition: { hasDestinations: true },
            priority: 2,
            onceOnly: true,
        },
        {
            id: 'merchant_many_travels',
            text: "A well-traveled scholar is a well-connected scholar. Your sea chart is filling up beautifully!",
            condition: { minDestinations: 3 },
            priority: 3,
        },
        {
            id: 'merchant_skills',
            text: "The Workshop hums with activity! Mastering tools and skills -- that's a tradesman after my own heart.",
            condition: { buildingMinLevel: { [BuildingType.WORKSHOP]: 3 } },
            priority: 2,
        },
        {
            id: 'merchant_low_rep',
            text: "Don't worry about reputation just yet. First, do good work. The recognition will follow.",
            condition: { resourceMax: { reputation: 10 } },
            priority: 1,
        },
    ],
};
