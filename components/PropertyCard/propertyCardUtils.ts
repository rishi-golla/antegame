import type { ColorGroup, GameState, Player, Tile } from '@/types/game';
import { COLOR_GROUPS, RAILROAD_INDICES, UTILITY_INDICES } from '@/lib/gameData';

/** Ordered color groups for display (board order) */
export const GROUP_ORDER: (ColorGroup | 'railroad' | 'utility')[] = [
  'brown',
  'light-blue',
  'pink',
  'orange',
  'red',
  'yellow',
  'green',
  'dark-blue',
  'railroad',
  'utility',
];

/** Map color group names to CSS-friendly hex colors */
export const GROUP_COLORS: Record<string, string> = {
  brown: '#8B4513',
  'light-blue': '#87CEEB',
  pink: '#FF69B4',
  orange: '#FF8C00',
  red: '#DC143C',
  yellow: '#FFD700',
  green: '#228B22',
  'dark-blue': '#00008B',
  railroad: '#555',
  utility: '#777',
};

/** Display name for a group */
export const GROUP_LABELS: Record<string, string> = {
  brown: 'Brown',
  'light-blue': 'Light Blue',
  pink: 'Pink',
  orange: 'Orange',
  red: 'Red',
  yellow: 'Yellow',
  green: 'Green',
  'dark-blue': 'Dark Blue',
  railroad: 'Railroads',
  utility: 'Utilities',
};

/** Check if a player owns the full color group */
export function hasFullGroup(player: Player, colorGroup: ColorGroup): boolean {
  const group = COLOR_GROUPS[colorGroup];
  return group.every((idx) => player.properties.includes(idx));
}

/** Check if a full group is buildable (all owned, none mortgaged in group) */
export function isGroupBuildable(player: Player, colorGroup: ColorGroup, tiles: Tile[]): boolean {
  if (!hasFullGroup(player, colorGroup)) return false;
  const group = COLOR_GROUPS[colorGroup];
  return !group.some((idx) => player.mortgaged.includes(idx));
}

/** Get grouped properties for a player, ordered by GROUP_ORDER */
export function getGroupedProperties(
  player: Player,
  tiles: Tile[]
): { group: string; indices: number[] }[] {
  const groups: { group: string; indices: number[] }[] = [];

  for (const g of GROUP_ORDER) {
    let indices: number[];
    if (g === 'railroad') {
      indices = RAILROAD_INDICES.filter((i) => player.properties.includes(i));
    } else if (g === 'utility') {
      indices = UTILITY_INDICES.filter((i) => player.properties.includes(i));
    } else {
      indices = COLOR_GROUPS[g].filter((i) => player.properties.includes(i));
    }
    if (indices.length > 0) {
      groups.push({ group: g, indices });
    }
  }

  return groups;
}

/** Count how many railroads a player owns */
export function railroadCount(player: Player): number {
  return RAILROAD_INDICES.filter((i) => player.properties.includes(i)).length;
}

/** Count how many utilities a player owns */
export function utilityCount(player: Player): number {
  return UTILITY_INDICES.filter((i) => player.properties.includes(i)).length;
}
