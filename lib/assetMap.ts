import type { Tile, ColorGroup, CornerKind } from '@/types/game';

/** Map color group to tile background image path */
const GROUP_TILE_IMAGES: Record<ColorGroup, string> = {
  brown: '/assets/tiles/prop-brown.webp',
  'light-blue': '/assets/tiles/prop-light-blue.webp',
  pink: '/assets/tiles/prop-pink.webp',
  orange: '/assets/tiles/prop-orange.webp',
  red: '/assets/tiles/prop-red.webp',
  yellow: '/assets/tiles/prop-yellow.webp',
  green: '/assets/tiles/prop-green.webp',
  'dark-blue': '/assets/tiles/prop-dark-blue.webp',
};

const CORNER_TILE_IMAGES: Record<CornerKind, string> = {
  go: '/assets/tiles/corner-go.webp',
  jail: '/assets/tiles/corner-jail.webp',
  'free-parking': '/assets/tiles/corner-free-parking.webp',
  'go-to-jail': '/assets/tiles/corner-go-to-jail.webp',
};

const UTILITY_TILE_IMAGES: Record<string, string> = {
  'Electric Company': '/assets/tiles/utility-electric.webp',
  'Water Works': '/assets/tiles/utility-water.webp',
};

/** Get the background image path for a given tile, or null if none */
export function getTileImage(tile: Tile): string | null {
  switch (tile.type) {
    case 'property':
      return GROUP_TILE_IMAGES[tile.colorGroup];
    case 'railroad':
      return '/assets/tiles/railroad.webp';
    case 'utility':
      return UTILITY_TILE_IMAGES[tile.name] ?? '/assets/tiles/utility-electric.webp';
    case 'tax':
      return '/assets/tiles/tax.webp';
    case 'chance':
      return '/assets/tiles/chance.webp';
    case 'community-chest':
      return '/assets/misc/community-chest-deck.webp';
    case 'corner':
      return CORNER_TILE_IMAGES[tile.cornerKind];
    default:
      return null;
  }
}

/** Character data for player selection */
export interface CharacterDef {
  id: string;
  name: string;
  sprite: string;
  color: string;
}

export const CHARACTERS: CharacterDef[] = [
  { id: 'high-roller', name: 'High Roller', sprite: '/assets/sprites/high-roller.webp', color: '#ff6b6b' },
  { id: 'singer', name: 'Singer', sprite: '/assets/sprites/singer.webp', color: '#ffd166' },
  { id: 'dealer', name: 'Dealer', sprite: '/assets/sprites/dealer.webp', color: '#5cd6c0' },
  { id: 'mobster', name: 'Mobster', sprite: '/assets/sprites/mobster.webp', color: '#8fb8ff' },
  { id: 'tourist', name: 'Tourist', sprite: '/assets/sprites/tourist.webp', color: '#fb923c' },
  { id: 'card-shark', name: 'Card Shark', sprite: '/assets/sprites/card-shark.webp', color: '#c084fc' },
  { id: 'vip', name: 'VIP', sprite: '/assets/sprites/vip.webp', color: '#f472b6' },
  { id: 'bartender', name: 'Bartender', sprite: '/assets/sprites/bartender.webp', color: '#34d399' },
];
