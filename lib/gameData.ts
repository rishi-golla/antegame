import type {
  Tile,
  PropertyTile,
  RailroadTile,
  UtilityTile,
  TaxTile,
  ChanceTile,
  CommunityChestTile,
  CornerTile,
  Card,
  ColorGroup,
} from '@/types/game';

function prop(
  index: number,
  name: string,
  colorGroup: ColorGroup,
  price: number,
  rent: [number, number, number, number, number, number],
  houseCost: number
): PropertyTile {
  return {
    index,
    name,
    type: 'property',
    colorGroup,
    price,
    rent,
    houseCost,
    mortgageValue: price / 2,
  };
}

function rr(index: number, name: string): RailroadTile {
  return { index, name, type: 'railroad', price: 200, mortgageValue: 100 };
}

function util(index: number, name: string): UtilityTile {
  return { index, name, type: 'utility', price: 150, mortgageValue: 75 };
}

function tax(index: number, name: string, amount: number): TaxTile {
  return { index, name, type: 'tax', amount };
}

function chance(index: number): ChanceTile {
  return { index, name: 'Chance', type: 'chance' };
}

function chest(index: number): CommunityChestTile {
  return { index, name: 'Community Chest', type: 'community-chest' };
}

function corner(
  index: number,
  name: string,
  cornerKind: CornerTile['cornerKind']
): CornerTile {
  return { index, name, type: 'corner', cornerKind };
}

export const TILES: Tile[] = [
  /* 0  */ corner(0, 'GO', 'go'),
  /* 1  */ prop(1, 'Coral Street', 'brown', 60, [2, 4, 10, 30, 90, 160], 50),
  /* 2  */ chest(2),
  /* 3  */ prop(3, 'Mint Avenue', 'brown', 60, [4, 8, 20, 60, 180, 320], 50),
  /* 4  */ tax(4, 'Income Tax', 200),
  /* 5  */ rr(5, 'North Railroad'),
  /* 6  */ prop(6, 'Lemon Square', 'light-blue', 100, [6, 12, 30, 90, 270, 400], 50),
  /* 7  */ chance(7),
  /* 8  */ prop(8, 'Clover Drive', 'light-blue', 100, [6, 12, 30, 90, 270, 400], 50),
  /* 9  */ prop(9, 'Sunset Boulevard', 'light-blue', 120, [8, 16, 40, 100, 300, 450], 50),
  /* 10 */ corner(10, 'Jail', 'jail'),
  /* 11 */ prop(11, 'Orchid Lane', 'pink', 140, [10, 20, 50, 150, 450, 625], 100),
  /* 12 */ util(12, 'Electric Company'),
  /* 13 */ prop(13, 'Lake View', 'pink', 140, [10, 20, 50, 150, 450, 625], 100),
  /* 14 */ prop(14, 'Rosewood Place', 'pink', 160, [12, 24, 60, 180, 500, 700], 100),
  /* 15 */ rr(15, 'East Railroad'),
  /* 16 */ prop(16, 'Maple Park', 'orange', 180, [14, 28, 70, 200, 550, 750], 100),
  /* 17 */ chest(17),
  /* 18 */ prop(18, 'Cherry Row', 'orange', 180, [14, 28, 70, 200, 550, 750], 100),
  /* 19 */ prop(19, 'Oak Crest', 'orange', 200, [16, 32, 80, 220, 600, 800], 100),
  /* 20 */ corner(20, 'Free Parking', 'free-parking'),
  /* 21 */ prop(21, 'Sapphire Street', 'red', 220, [18, 36, 90, 250, 700, 875], 150),
  /* 22 */ chance(22),
  /* 23 */ prop(23, 'Pearl Street', 'red', 220, [18, 36, 90, 250, 700, 875], 150),
  /* 24 */ prop(24, 'Hill Crest', 'red', 240, [20, 40, 100, 300, 750, 925], 150),
  /* 25 */ rr(25, 'West Railroad'),
  /* 26 */ prop(26, 'Luna Avenue', 'yellow', 260, [22, 44, 110, 330, 800, 975], 150),
  /* 27 */ prop(27, 'Garden Street', 'yellow', 260, [22, 44, 110, 330, 800, 975], 150),
  /* 28 */ util(28, 'Water Works'),
  /* 29 */ prop(29, 'Willow Drive', 'yellow', 280, [24, 48, 120, 360, 850, 1025], 150),
  /* 30 */ corner(30, 'Go To Jail', 'go-to-jail'),
  /* 31 */ prop(31, 'Plaza Way', 'green', 300, [26, 52, 130, 390, 900, 1100], 200),
  /* 32 */ prop(32, 'Birch Point', 'green', 300, [26, 52, 130, 390, 900, 1100], 200),
  /* 33 */ chest(33),
  /* 34 */ prop(34, 'River Side', 'green', 320, [28, 56, 150, 450, 1000, 1200], 200),
  /* 35 */ rr(35, 'South Railroad'),
  /* 36 */ chance(36),
  /* 37 */ prop(37, 'Golden Road', 'dark-blue', 350, [35, 70, 175, 500, 1100, 1300], 200),
  /* 38 */ tax(38, 'Luxury Tax', 100),
  /* 39 */ prop(39, 'Park Lane', 'dark-blue', 400, [50, 100, 200, 600, 1400, 1700], 200),
];

export const COLOR_GROUPS: Record<ColorGroup, number[]> = {
  brown: [1, 3],
  'light-blue': [6, 8, 9],
  pink: [11, 13, 14],
  orange: [16, 18, 19],
  red: [21, 23, 24],
  yellow: [26, 27, 29],
  green: [31, 32, 34],
  'dark-blue': [37, 39],
};

export const RAILROAD_INDICES = [5, 15, 25, 35];
export const UTILITY_INDICES = [12, 28];

export const RAILROAD_RENTS = [25, 50, 100, 200];

export const STARTING_MONEY = 1500;
export const GO_SALARY = 200;
export const JAIL_BAIL = 50;
export const MAX_JAIL_TURNS = 3;
export const MAX_HOUSES = 5; // 5 = hotel

export const CHANCE_CARDS: Card[] = [
  { id: 'ch-1', deckType: 'chance', text: 'Advance to GO. Collect $200.', effect: { kind: 'move-to', tileIndex: 0 } },
  { id: 'ch-2', deckType: 'chance', text: 'Advance to Park Lane.', effect: { kind: 'move-to', tileIndex: 39 } },
  { id: 'ch-3', deckType: 'chance', text: 'Advance to Sapphire Street. If you pass GO, collect $200.', effect: { kind: 'move-to', tileIndex: 21 } },
  { id: 'ch-4', deckType: 'chance', text: 'Advance to Orchid Lane. If you pass GO, collect $200.', effect: { kind: 'move-to', tileIndex: 11 } },
  { id: 'ch-5', deckType: 'chance', text: 'Advance to the nearest Railroad.', effect: { kind: 'nearest-railroad' } },
  { id: 'ch-6', deckType: 'chance', text: 'Advance to the nearest Railroad.', effect: { kind: 'nearest-railroad' } },
  { id: 'ch-7', deckType: 'chance', text: 'Advance to the nearest Utility.', effect: { kind: 'nearest-utility' } },
  { id: 'ch-8', deckType: 'chance', text: 'Bank pays you dividend of $50.', effect: { kind: 'collect', amount: 50 } },
  { id: 'ch-9', deckType: 'chance', text: 'Get Out of Jail Free.', effect: { kind: 'get-out-of-jail' } },
  { id: 'ch-10', deckType: 'chance', text: 'Go back 3 spaces.', effect: { kind: 'move-relative', steps: -3 } },
  { id: 'ch-11', deckType: 'chance', text: 'Go to Jail. Go directly to Jail. Do not pass GO.', effect: { kind: 'go-to-jail' } },
  { id: 'ch-12', deckType: 'chance', text: 'Make general repairs. Pay $25 per house, $100 per hotel.', effect: { kind: 'repairs', perHouse: 25, perHotel: 100 } },
  { id: 'ch-13', deckType: 'chance', text: 'Pay poor tax of $15.', effect: { kind: 'pay', amount: 15 } },
  { id: 'ch-14', deckType: 'chance', text: 'Take a trip to North Railroad. If you pass GO, collect $200.', effect: { kind: 'move-to', tileIndex: 5 } },
  { id: 'ch-15', deckType: 'chance', text: 'You have been elected Chairman of the Board. Pay each player $50.', effect: { kind: 'pay-each-player', amount: 50 } },
  { id: 'ch-16', deckType: 'chance', text: 'Your building loan matures. Collect $150.', effect: { kind: 'collect', amount: 150 } },
];

export const COMMUNITY_CHEST_CARDS: Card[] = [
  { id: 'cc-1', deckType: 'community-chest', text: 'Advance to GO. Collect $200.', effect: { kind: 'move-to', tileIndex: 0 } },
  { id: 'cc-2', deckType: 'community-chest', text: 'Bank error in your favor. Collect $200.', effect: { kind: 'collect', amount: 200 } },
  { id: 'cc-3', deckType: 'community-chest', text: "Doctor's fees. Pay $50.", effect: { kind: 'pay', amount: 50 } },
  { id: 'cc-4', deckType: 'community-chest', text: 'From sale of stock you get $50.', effect: { kind: 'collect', amount: 50 } },
  { id: 'cc-5', deckType: 'community-chest', text: 'Get Out of Jail Free.', effect: { kind: 'get-out-of-jail' } },
  { id: 'cc-6', deckType: 'community-chest', text: 'Go to Jail. Go directly to Jail. Do not pass GO.', effect: { kind: 'go-to-jail' } },
  { id: 'cc-7', deckType: 'community-chest', text: 'Holiday fund matures. Collect $100.', effect: { kind: 'collect', amount: 100 } },
  { id: 'cc-8', deckType: 'community-chest', text: 'Income tax refund. Collect $20.', effect: { kind: 'collect', amount: 20 } },
  { id: 'cc-9', deckType: 'community-chest', text: 'It is your birthday. Collect $10 from every player.', effect: { kind: 'collect-from-each', amount: 10 } },
  { id: 'cc-10', deckType: 'community-chest', text: 'Life insurance matures. Collect $100.', effect: { kind: 'collect', amount: 100 } },
  { id: 'cc-11', deckType: 'community-chest', text: 'Hospital fees. Pay $100.', effect: { kind: 'pay', amount: 100 } },
  { id: 'cc-12', deckType: 'community-chest', text: 'School fees. Pay $50.', effect: { kind: 'pay', amount: 50 } },
  { id: 'cc-13', deckType: 'community-chest', text: 'Consultancy fee. Collect $25.', effect: { kind: 'collect', amount: 25 } },
  { id: 'cc-14', deckType: 'community-chest', text: 'You are assessed for street repairs. Pay $40 per house, $115 per hotel.', effect: { kind: 'repairs', perHouse: 40, perHotel: 115 } },
  { id: 'cc-15', deckType: 'community-chest', text: 'You have won second prize in a beauty contest. Collect $10.', effect: { kind: 'collect', amount: 10 } },
  { id: 'cc-16', deckType: 'community-chest', text: 'You inherit $100.', effect: { kind: 'collect', amount: 100 } },
];
