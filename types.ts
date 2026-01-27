
export interface DetectedCard {
  rank: string; // '2'-'10', 'J', 'Q', 'K', 'A', 'Joker', '+2', 'x2', '-2', 'Star'
  suit: string; // 'Spades', 'Hearts', 'Diamonds', 'Clubs', 'Stars', 'None'
  id: string;   // Unique ID for React keys
}

export type GamePreset = 'standard' | 'flip7' | 'gnoming_around';

export type Round = 
  | { type: 'manual'; id: string; score: number; timestamp: number }
  | { type: 'scan'; id: string; cards: DetectedCard[]; timestamp: number; wentOutFirst?: boolean; lowestInRound?: boolean; calculationDurationMs?: number };

export interface Player {
  id: string;
  name: string;
  deviceId?: string;
  rounds: Round[];
}

export interface CardSettings {
  preset: GamePreset;
  jokerValue: number;
  aceValue: number;
  faceCardBehavior: 'face' | 'fixed'; 
  fixedFaceValue?: number;
  numberCardBehavior: 'face' | 'fixed';
  fixedNumberValue?: number;
  winningScoreType: 'lowest' | 'highest';
}

export enum AppView {
  SETUP = 'SETUP',
  GAME = 'GAME',
  SETTINGS = 'SETTINGS',
  SCAN = 'SCAN',
}

export interface ScanResult {
  cards: Omit<DetectedCard, 'id'>[]; 
}

export type P2PMessage = 
  | { type: 'SYNC_STATE'; payload: GameState }
  | { type: 'REQUEST_SAVE_ROUND'; payload: { playerId: string; round: Round; index?: number } }
  | { type: 'REQUEST_DELETE_ROUND'; payload: { playerId: string; roundId: string } }
  | { type: 'REQUEST_RESET'; payload: null }
  | { type: 'REQUEST_SETTINGS_UPDATE'; payload: CardSettings }
  | { type: 'REQUEST_ADD_PLAYERS'; payload: Player[] }
  | { type: 'REQUEST_REMOVE_PLAYER'; payload: { playerId: string } }
  | { type: 'HEARTBEAT'; payload: number }
  | { type: 'GAME_ENDED'; payload: null }
  | { type: 'ACK'; payload: { seq: number } }
  | { type: 'RESYNC'; payload: { lastReceivedSeq: number } };

export type GameState = {
  players: Player[];
  settings: CardSettings;
  view: AppView;
};

export interface DurableEnvelope {
  seq: number;
  senderId: string;
  message: P2PMessage;
  timestamp: number;
}