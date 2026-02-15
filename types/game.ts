export type ColorGroup =
  | 'brown'
  | 'light-blue'
  | 'pink'
  | 'orange'
  | 'red'
  | 'yellow'
  | 'green'
  | 'dark-blue';

export type TileType =
  | 'property'
  | 'railroad'
  | 'utility'
  | 'tax'
  | 'chance'
  | 'community-chest'
  | 'corner';

export type CornerKind = 'go' | 'jail' | 'free-parking' | 'go-to-jail';

export interface PropertyTile {
  index: number;
  name: string;
  type: 'property';
  colorGroup: ColorGroup;
  price: number;
  rent: [number, number, number, number, number, number]; // base, set, 1h, 2h, 3h, 4h/hotel
  houseCost: number;
  mortgageValue: number;
}

export interface RailroadTile {
  index: number;
  name: string;
  type: 'railroad';
  price: number;
  mortgageValue: number;
}

export interface UtilityTile {
  index: number;
  name: string;
  type: 'utility';
  price: number;
  mortgageValue: number;
}

export interface TaxTile {
  index: number;
  name: string;
  type: 'tax';
  amount: number;
}

export interface ChanceTile {
  index: number;
  name: string;
  type: 'chance';
}

export interface CommunityChestTile {
  index: number;
  name: string;
  type: 'community-chest';
}

export interface CornerTile {
  index: number;
  name: string;
  type: 'corner';
  cornerKind: CornerKind;
}

export type Tile =
  | PropertyTile
  | RailroadTile
  | UtilityTile
  | TaxTile
  | ChanceTile
  | CommunityChestTile
  | CornerTile;

export type CardEffectKind =
  | 'move-to'
  | 'move-relative'
  | 'collect'
  | 'pay'
  | 'pay-each-player'
  | 'collect-from-each'
  | 'get-out-of-jail'
  | 'go-to-jail'
  | 'nearest-railroad'
  | 'nearest-utility'
  | 'repairs';

export interface CardEffect {
  kind: CardEffectKind;
  tileIndex?: number;
  amount?: number;
  perHouse?: number;
  perHotel?: number;
  steps?: number;
}

export interface Card {
  id: string;
  deckType: 'chance' | 'community-chest';
  text: string;
  effect: CardEffect;
}

export interface Player {
  id: number;
  name: string;
  color: string;
  sprite?: string;
  money: number;
  position: number;
  properties: number[];
  mortgaged: number[]; // tile indices of mortgaged properties
  houses: Record<number, number>; // tileIndex -> house count (5 = hotel)
  inJail: boolean;
  jailTurns: number;
  getOutOfJailCards: number;
  bankrupt: boolean;
}

export type GamePhase =
  | 'waiting'
  | 'rolling'
  | 'landed'
  | 'buying'
  | 'paying-rent'
  | 'drawing-card'
  | 'applying-card'
  | 'in-jail'
  | 'turn-end'
  | 'trading'
  | 'game-over';

export interface GameLog {
  message: string;
  playerIndex?: number;
  timestamp: number;
}

export interface TradeOffer {
  fromPlayer: number;
  toPlayer: number;
  offerMoney: number;
  requestMoney: number;
  offerProperties: number[];
  requestProperties: number[];
}

export interface GameState {
  players: Player[];
  currentPlayerIndex: number;
  tiles: Tile[];
  chanceDeck: Card[];
  communityChestDeck: Card[];
  chanceDiscard: Card[];
  communityChestDiscard: Card[];
  dice: [number, number];
  doublesCount: number;
  phase: GamePhase;
  drawnCard: Card | null;
  log: GameLog[];
  winner: number | null;
  activeTradeOffer: TradeOffer | null;
  previousPhase: GamePhase | null;
}
