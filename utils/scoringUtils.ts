
import { CardSettings, DetectedCard, Player, Round } from '../types';

export const calculateCardScore = (card: Omit<DetectedCard, 'id'>, settings: CardSettings): number => {
  const rank = card.rank.toUpperCase();
  
  // Joker
  if (rank === 'JOKER') {
    return settings.jokerValue;
  }

  // Ace
  if (rank === 'A' || rank === 'ACE') {
    return settings.aceValue;
  }

  // Face Cards (K, Q, J)
  if (['K', 'Q', 'J', 'KING', 'QUEEN', 'JACK'].includes(rank)) {
    if (settings.faceCardBehavior === 'fixed') {
      return settings.fixedFaceValue || 10;
    }
    // Face values
    if (rank.startsWith('J')) return 11;
    if (rank.startsWith('Q')) return 12;
    if (rank.startsWith('K')) return 13;
  }

  // Number Cards
  const num = parseInt(rank);
  if (!isNaN(num)) {
    if (settings.numberCardBehavior === 'fixed') {
      return settings.fixedNumberValue || 5;
    }
    return num; // Face value
  }

  // Fallback
  return 0;
};

export const calculateRoundScore = (round: Round, settings: CardSettings): number => {
  if (round.type === 'manual') {
    return round.score;
  }
  if (round.type === 'scan') {
    return round.cards.reduce((sum, card) => sum + calculateCardScore(card, settings), 0);
  }
  return 0;
};

export const calculatePlayerTotal = (player: Player, settings: CardSettings): number => {
  return player.rounds.reduce((sum, round) => sum + calculateRoundScore(round, settings), 0);
};
