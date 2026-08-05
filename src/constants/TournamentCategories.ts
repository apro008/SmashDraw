import { CategoryName, SkillLevel } from '~/types';

export interface CategoryPreset {
  name: CategoryName;
  entry_fee: number;
  max_players: number;
  skill_level: SkillLevel | 'open';
  prize: string | null;
}

export interface EditableCategoryPreset extends CategoryPreset {
  id: string;
  enabled: boolean;
  is_custom?: boolean;
  prizeEdited?: boolean;
}

export const DEFAULT_TOURNAMENT_CATEGORIES: CategoryPreset[] = [
  {
    name: "Men's Singles",
    entry_fee: 500,
    max_players: 32,
    skill_level: 'open',
    prize: null,
  },
  {
    name: "Women's Singles",
    entry_fee: 500,
    max_players: 32,
    skill_level: 'open',
    prize: null,
  },
  {
    name: "Men's Doubles",
    entry_fee: 900,
    max_players: 32,
    skill_level: 'open',
    prize: null,
  },
  {
    name: "Women's Doubles",
    entry_fee: 900,
    max_players: 32,
    skill_level: 'open',
    prize: null,
  },
  {
    name: 'Mixed Doubles',
    entry_fee: 900,
    max_players: 32,
    skill_level: 'open',
    prize: null,
  },
];

export function isDoublesCategory(name: string) {
  return name.toLowerCase().includes('doubles');
}

export function getCategoryEntryLabel(name: string) {
  return isDoublesCategory(name) ? 'Teams' : 'Players';
}

export function getAutoPrizeDistribution(entryFee: number, maxEntries: number) {
  if (entryFee <= 0 || maxEntries <= 0) return null;

  const prizePool = entryFee * maxEntries;
  const firstPrize = roundToNearest50(prizePool * 0.6);
  const secondPrize = roundToNearest50(prizePool * 0.3);

  return `1st Prize: ₹${firstPrize}\n2nd Prize: ₹${secondPrize}`;
}

export function createEditableCategoryPresets(): EditableCategoryPreset[] {
  return DEFAULT_TOURNAMENT_CATEGORIES.map((category, index) => ({
    ...category,
    id: `preset-${index}`,
    enabled: index === 0,
    prize: getAutoPrizeDistribution(category.entry_fee, category.max_players),
  }));
}

function roundToNearest50(value: number) {
  return Math.round(value / 50) * 50;
}
