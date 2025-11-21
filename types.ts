export interface Player {
  id: string;
  name: string;
  score: number;
  history: number[]; // Score history per round
}

export interface CardSettings {
  jokerValue: number;
  aceValue: number;
  faceCardBehavior: 'face' | 'fixed'; // New: 'face' means J=11, Q=12, K=13
  fixedFaceValue?: number; // Used if faceCardBehavior is 'fixed'
  numberCardBehavior: 'face' | 'fixed'; // 'face' means 2=2, 10=10. 'fixed' might be for games where all number cards are 5.
  fixedNumberValue?: number; // Used if numberCardBehavior is 'fixed'
}

export enum AppView {
  SETUP = 'SETUP',
  GAME = 'GAME',
  SETTINGS = 'SETTINGS',
  SCAN = 'SCAN',
}

export interface ScanResult {
  score: number;
  cardsDetected: string[];
  explanation?: string;
}

// --- P2P / Multiplayer Types ---

export type GameState = {
  players: Player[];
  settings: CardSettings;
  view: AppView;
};

export type P2PMessage = 
  | { type: 'SYNC_STATE'; payload: GameState }
  | { type: 'REQUEST_SCORE_UPDATE'; payload: { playerId: string; scoreToAdd: number } }
  | { type: 'REQUEST_RESET'; payload: null }
  | { type: 'REQUEST_SETTINGS_UPDATE'; payload: CardSettings };
