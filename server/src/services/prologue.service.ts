/**
 * Prologue Service
 * Handles calculation of player profile (stats, personality, inventory) based on prologue choices.
 * Ported from bot/src/engine/prologue-evaluator.ts
 */

import * as storyService from "./story.service.js";

interface TraitVector {
  [trait: string]: number;
}

interface PrologueResult {
  baseStats: {
    str: number;
    dex: number;
    int: number;
    cha: number;
    wis: number;
    con: number;
  };
  personalityType: string;
  personalityDescription: string;
  dominantTraits: string[];
  startingInventory: string[];
}

const PERSONALITY_TYPES: Record<
  string,
  { name: string; description: string; requiredTraits: string[] }
> = {
  strategist: {
    name: "The Strategist",
    description:
      "You approach problems with calculated precision, weighing options before acting.",
    requiredTraits: ["cautious", "observant", "analytical"],
  },
  berserker: {
    name: "The Berserker",
    description:
      "You charge headfirst into danger, relying on instinct and raw power.",
    requiredTraits: ["aggressive", "brave", "impulsive"],
  },
  diplomat: {
    name: "The Diplomat",
    description:
      "Words are your weapon. You resolve conflicts through charm and persuasion.",
    requiredTraits: ["charismatic", "empathetic", "peaceful"],
  },
  shadow: {
    name: "The Shadow",
    description:
      "You move unseen, striking from darkness when opportunity presents itself.",
    requiredTraits: ["stealthy", "patient", "cunning"],
  },
  guardian: {
    name: "The Guardian",
    description:
      "Protection comes naturally. You stand between danger and those who cannot defend themselves.",
    requiredTraits: ["protective", "selfless", "brave"],
  },
  seeker: {
    name: "The Seeker",
    description:
      "Knowledge drives you. Every mystery is a puzzle waiting to be solved.",
    requiredTraits: ["curious", "observant", "analytical"],
  },
  wildcard: {
    name: "The Wildcard",
    description:
      "Unpredictable and adaptable, you thrive in chaos where others falter.",
    requiredTraits: ["impulsive", "adaptable", "creative"],
  },
};

const TRAIT_TO_STAT: Record<string, keyof PrologueResult["baseStats"]> = {
  aggressive: "str",
  brave: "str",
  protective: "str",
  stealthy: "dex",
  patient: "dex",
  quick: "dex",
  analytical: "int",
  curious: "int",
  observant: "int",
  charismatic: "cha",
  empathetic: "cha",
  persuasive: "cha",
  cautious: "wis",
  peaceful: "wis",
  selfless: "wis",
  resilient: "con",
  impulsive: "con",
  adaptable: "con",
};

const TRAIT_INVENTORY: Record<string, string> = {
  aggressive: "worn_blade",
  brave: "courage_charm",
  stealthy: "shadow_cloak",
  analytical: "scholars_tome",
  charismatic: "silver_tongue_ring",
  cautious: "protective_amulet",
  curious: "explorers_compass",
  protective: "guardians_shield",
  // Fallback items
  patient: "hunters_cloak",
  quick: "boots_of_speed",
  persuasive: "diplomats_badge",
  peaceful: "olive_branch",
  selfless: "healers_kit",
  resilient: "iron_band",
  impulsive: "lucky_coin",
  adaptable: "travelers_pack",
};

export function calculatePrologueResult(
  storyId: string,
  choices: { choiceId: string }[]
): PrologueResult | null {
  const story = storyService.getStory(storyId);
  if (!story || !story.traitMappings) {
    return null;
  }

  const traitVector: TraitVector = {};
  const traitMappings = story.traitMappings;

  // 1. Accumulate Traits
  for (const choice of choices) {
    const traits = traitMappings[choice.choiceId];
    if (traits) {
      for (const [trait, value] of Object.entries(traits)) {
        traitVector[trait] = (traitVector[trait] || 0) + (value as number);
      }
    }
  }

  // 2. Determine Dominant Traits
  const dominantTraits = getDominantTraits(traitVector);

  // 3. Match Personality
  const personality = matchPersonalityType(dominantTraits);

  // 4. Calculate Stats
  const baseStats = calculateBaseStats(traitVector);

  // 5. Determine Inventory
  const startingInventory = determineStartingInventory(dominantTraits);

  return {
    baseStats,
    personalityType: personality.name,
    personalityDescription: personality.description,
    dominantTraits,
    startingInventory,
  };
}

function getDominantTraits(traitVector: TraitVector): string[] {
  const sortedTraits = Object.entries(traitVector)
    .filter(([_, value]) => value > 0)
    .sort(([, a], [, b]) => b - a);
  return sortedTraits.slice(0, 3).map(([trait]) => trait);
}

function matchPersonalityType(dominantTraits: string[]): {
  name: string;
  description: string;
} {
  let bestMatch = {
    name: "The Wanderer",
    description: "Your path is yours alone to define.",
  };
  let bestScore = 0;

  for (const [_, personality] of Object.entries(PERSONALITY_TYPES)) {
    let score = 0;
    for (const trait of personality.requiredTraits) {
      if (dominantTraits.includes(trait)) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = {
        name: personality.name,
        description: personality.description,
      };
    }
  }
  return bestMatch;
}

function calculateBaseStats(
  traitVector: TraitVector
): PrologueResult["baseStats"] {
  const stats: PrologueResult["baseStats"] = {
    str: 10,
    dex: 10,
    int: 10,
    cha: 10,
    wis: 10,
    con: 10,
  };

  for (const [trait, value] of Object.entries(traitVector)) {
    const stat = TRAIT_TO_STAT[trait];
    if (stat && value > 0) {
      stats[stat] += Math.floor(value / 2);
    }
  }

  // Cap stats
  for (const key of Object.keys(stats) as (keyof typeof stats)[]) {
    stats[key] = Math.min(20, Math.max(1, stats[key]));
  }
  return stats;
}

function determineStartingInventory(dominantTraits: string[]): string[] {
  const inventory: string[] = ["basic_supplies"];
  const uniqueItems = new Set<string>();
  
  for (const trait of dominantTraits) {
    if (TRAIT_INVENTORY[trait]) {
      uniqueItems.add(TRAIT_INVENTORY[trait]);
    }
  }
  
  inventory.push(...Array.from(uniqueItems));
  return inventory.slice(0, 5); // Allow slightly more items
}
