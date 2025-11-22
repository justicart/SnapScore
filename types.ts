
export interface DetectedCard {
  rank: string; // '2'-'10', 'J', 'Q', 'K', 'A', 'Joker'
  suit: string; // 'Spades', 'Hearts', 'Diamonds', 'Clubs', 'None'
  id: string;   // Unique ID for React keys
}

export type Round = 
  | { type: 'manual'; id: string; score: number; timestamp: number }
  | { type: 'scan'; id: string; cards: DetectedCard[]; timestamp: number };

export interface Player {
  id: string;
  name: string;
  rounds: Round[];
}

export interface CardSettings {
  jokerValue: number;
  aceValue: number;
  faceCardBehavior: 'face' | 'fixed'; // 'face' means J=11, Q=12, K=13
  fixedFaceValue?: number; // Used if faceCardBehavior is 'fixed'
  numberCardBehavior: 'face' | 'fixed'; // 'face' means 2=2, 10=10
  fixedNumberValue?: number; // Used if numberCardBehavior is 'fixed'
}

export enum AppView {
  SETUP = 'SETUP',
  GAME = 'GAME',
  SETTINGS = 'SETTINGS',
  SCAN = 'SCAN',
}

export interface ScanResult {
  cards: Omit<DetectedCard, 'id'>[]; // AI doesn't generate UUIDs, we add them later
}

// --- P2P / Multiplayer Types ---

export type GameState = {
  players: Player[];
  settings: CardSettings;
  view: AppView;
};

export type P2PMessage = 
  | { type: 'SYNC_STATE'; payload: GameState }
  | { type: 'REQUEST_SAVE_ROUND'; payload: { playerId: string; round: Round } }
  | { type: 'REQUEST_RESET'; payload: null }
  | { type: 'REQUEST_SETTINGS_UPDATE'; payload: CardSettings }
  | { type: 'REQUEST_ADD_PLAYERS'; payload: Player[] };
