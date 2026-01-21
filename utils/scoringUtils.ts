
import { CardSettings, DetectedCard, Player, Round } from '../types';

export const calculateCardScore = (card: Omit<DetectedCard, 'id'>, settings: CardSettings): number => {
  const rank = card.rank.toUpperCase();
  
  // Multipliers (x2, x3) return 0 base score - they are handled in calculateRoundScore
  if (rank.startsWith('X')) {
    return 0;
  }

  // Additive Modifier Cards (+2, +10)
  if (rank.startsWith('+')) {
    const val = parseInt(rank.slice(1));
    return isNaN(val) ? 0 : val;
  }

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
    return num;
  }

  return 0;
};

export const calculateRoundScore = (round: Round, settings: CardSettings): number => {
  if (round.type === 'manual') {
    return round.score;
  }
  
  if (round.type === 'scan') {
    let sum = 0;
    let multiplier = 1;

    round.cards.forEach(card => {
      const rank = card.rank.toUpperCase();
      if (rank.startsWith('X')) {
        const m = parseInt(rank.slice(1));
        if (!isNaN(m)) multiplier *= m;
      } else {
        sum += calculateCardScore(card, settings);
      }
    });

    return sum * multiplier;
  }
  
  return 0;
};

export const calculatePlayerTotal = (player: Player, settings: CardSettings): number => {
  return player.rounds.reduce((sum, round) => sum + calculateRoundScore(round, settings), 0);
};
