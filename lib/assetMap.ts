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
  'Electric Co': '/assets/tiles/utility-electric.webp',
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
      return '/assets/tiles/community-chest.webp';
    case 'corner':
      return CORNER_TILE_IMAGES[tile.cornerKind];
    default:
      return null;
  }
}

/** Character buff types */
export type BuffType =
  | 'buy-discount'
  | 'salary-boost'
  | 'rent-collect-boost'
  | 'rent-pay-discount'
  | 'railroad-bonus'
  | 'minigame-boost'
  | 'build-discount'
  | 'tax-discount';

export interface CharacterBuff {
  type: BuffType;
  name: string;
  description: string;
  modifier: number; // percentage as decimal (0.10 = 10%)
}

/** Character data for player selection */
export interface CharacterDef {
  id: string;
  name: string;
  sprite: string;
  color: string;
  buff: CharacterBuff;
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'high-roller', name: 'High Roller', sprite: '/assets/sprites/high-roller.webp', color: '#ff6b6b',
    buff: { type: 'buy-discount', name: 'Big Spender', description: 'Properties cost 10% less to buy', modifier: 0.10 },
  },
  {
    id: 'singer', name: 'Singer', sprite: '/assets/sprites/singer.webp', color: '#ffd166',
    buff: { type: 'salary-boost', name: 'Crowd Favorite', description: 'Collect 20% more when passing GO', modifier: 0.20 },
  },
  {
    id: 'dealer', name: 'Dealer', sprite: '/assets/sprites/dealer.webp', color: '#5cd6c0',
    buff: { type: 'rent-collect-boost', name: 'House Advantage', description: 'Collect 15% more rent from opponents', modifier: 0.15 },
  },
  {
    id: 'mobster', name: 'Mobster', sprite: '/assets/sprites/mobster.webp', color: '#8fb8ff',
    buff: { type: 'rent-pay-discount', name: 'Protection Racket', description: 'Pay 15% less rent to opponents', modifier: 0.15 },
  },
  {
    id: 'tourist', name: 'Tourist', sprite: '/assets/sprites/tourist.webp', color: '#fb923c',
    buff: { type: 'railroad-bonus', name: 'Lucky Traveler', description: 'Railroads cost nothing and +1 rent tier', modifier: 1.0 },
  },
  {
    id: 'card-shark', name: 'Card Shark', sprite: '/assets/sprites/card-shark.webp', color: '#c084fc',
    buff: { type: 'minigame-boost', name: 'Stacked Deck', description: 'Minigame payouts are 20% higher', modifier: 0.20 },
  },
  {
    id: 'vip', name: 'VIP', sprite: '/assets/sprites/vip.webp', color: '#f472b6',
    buff: { type: 'build-discount', name: 'Penthouse Suite', description: 'Houses cost 15% less to build', modifier: 0.15 },
  },
  {
    id: 'bartender', name: 'Bartender', sprite: '/assets/sprites/bartender.webp', color: '#34d399',
    buff: { type: 'tax-discount', name: 'On the House', description: 'Tax payments reduced by 50%', modifier: 0.50 },
  },
];
