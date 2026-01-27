
import { CardSettings, DetectedCard, Player, Round } from '../types';

export const calculateCardScore = (card: Omit<DetectedCard, 'id'>, settings: CardSettings): number => {
  const rank = card.rank.toUpperCase();
  
  if (settings.preset === 'gnoming_around') {
      if (rank === 'X') return 10;
      if (rank === 'STAR') return 0;
      const val = parseInt(rank);
      return isNaN(val) ? 0 : val;
  }

  if (rank.startsWith('X') && settings.preset === 'flip7') {
    return 0;
  }

  if (rank.startsWith('+')) {
    const val = parseInt(rank.slice(1));
    return isNaN(val) ? 0 : val;
  }

  if (rank === 'JOKER' || rank === '$') return settings.jokerValue;
  if (rank === 'A' || rank === 'ACE') return settings.aceValue;

  if (['K', 'Q', 'J', 'KING', 'QUEEN', 'JACK'].includes(rank)) {
    if (settings.faceCardBehavior === 'fixed') return settings.fixedFaceValue || 10;
    if (rank.startsWith('J')) return 11;
    if (rank.startsWith('Q')) return 12;
    if (rank.startsWith('K')) return 13;
  }

  const num = parseInt(rank);
  if (!isNaN(num)) {
    if (settings.numberCardBehavior === 'fixed' && settings.preset === 'standard') return settings.fixedNumberValue || 5;
    return num;
  }

  return 0;
};

/**
 * Calculates the raw Gnoming Around score for a 3x3 grid (before bonuses).
 */
export const calculateGnomingSubtotal = (cards: DetectedCard[]): number => {
    if (cards.length !== 9) {
        return cards.reduce((s, c) => s + calculateCardScore(c, { preset: 'gnoming_around' } as CardSettings), 0);
    }

    const lines = [
        { indices: [0, 1, 2] }, { indices: [3, 4, 5] }, { indices: [6, 7, 8] },
        { indices: [0, 3, 6] }, { indices: [1, 4, 7] }, { indices: [2, 5, 8] }
    ];

    const usedInAnySetIndices = new Set<number>();
    let setDeductions = 0;

    lines.forEach(line => {
        const lineCards = line.indices.map(i => cards[i]);
        const nonWilds = lineCards.filter(c => c.rank.toUpperCase() !== 'STAR' && c.rank.toUpperCase() !== 'X');
        
        let isSet = false;
        let setVal = 0;

        if (nonWilds.length === 0) {
            const hasHazards = lineCards.some(c => c.rank.toUpperCase() === 'X');
            if (!hasHazards) { isSet = true; setVal = 0; }
        } else {
            const firstRank = nonWilds[0].rank;
            const allMatch = nonWilds.every(c => c.rank === firstRank);
            const hasHazards = lineCards.some(c => c.rank.toUpperCase() === 'X');
            const val = parseInt(firstRank);
            if (allMatch && !hasHazards && !isNaN(val) && val > 0) {
                isSet = true;
                setVal = val;
            }
        }

        if (isSet) {
            setDeductions += setVal;
            line.indices.forEach(idx => usedInAnySetIndices.add(idx));
        }
    });

    let subtotal = -setDeductions;
    cards.forEach((card, i) => {
        if (!usedInAnySetIndices.has(i)) {
            subtotal += calculateCardScore(card, { preset: 'gnoming_around' } as CardSettings);
        }
    });

    return subtotal;
};

export interface GnomingBreakdown {
    sets: { label: string, value: number }[];
    loneCards: { rank: string, value: number, isHazard?: boolean }[];
    modifiers: { label: string, value: number }[];
    total: number;
}

export const getGnomingBreakdown = (
  cards: DetectedCard[], 
  round: Extract<Round, { type: 'scan' }>, 
  players: Player[] = [], 
  roundIndex?: number
): GnomingBreakdown => {
    const breakdown: GnomingBreakdown = { sets: [], loneCards: [], modifiers: [], total: 0 };
    
    // 1. Calculate base sets and lone cards for breakdown display
    if (cards.length === 9) {
        const lines = [
            { indices: [0, 1, 2], label: 'Row 1' },
            { indices: [3, 4, 5], label: 'Row 2' },
            { indices: [6, 7, 8], label: 'Row 3' },
            { indices: [0, 3, 6], label: 'Col 1' },
            { indices: [1, 4, 7], label: 'Col 2' },
            { indices: [2, 5, 8], label: 'Col 3' }
        ];
        const usedInAnySetIndices = new Set<number>();
        
        lines.forEach(line => {
            const lineCards = line.indices.map(i => cards[i]);
            const nonWilds = lineCards.filter(c => c.rank.toUpperCase() !== 'STAR' && c.rank.toUpperCase() !== 'X');
            let isSet = false;
            let setVal = 0;

            if (nonWilds.length === 0) {
                if (!lineCards.some(c => c.rank.toUpperCase() === 'X')) { isSet = true; setVal = 0; }
            } else {
                const firstRank = nonWilds[0].rank;
                const val = parseInt(firstRank);
                if (nonWilds.every(c => c.rank === firstRank) && !lineCards.some(c => c.rank.toUpperCase() === 'X') && !isNaN(val) && val > 0) {
                    isSet = true;
                    setVal = val;
                }
            }
            if (isSet) {
                breakdown.sets.push({ label: `${line.label} (${setVal}s)`, value: -setVal });
                line.indices.forEach(idx => usedInAnySetIndices.add(idx));
            }
        });

        cards.forEach((card, i) => {
            if (!usedInAnySetIndices.has(i)) {
                const val = calculateCardScore(card, { preset: 'gnoming_around' } as CardSettings);
                breakdown.loneCards.push({ rank: card.rank, value: val, isHazard: card.rank.toUpperCase() === 'X' });
            }
        });
    } else {
        breakdown.loneCards = cards.map(c => ({ rank: c.rank, value: calculateCardScore(c, { preset: 'gnoming_around' } as CardSettings), isHazard: c.rank.toUpperCase() === 'X' }));
    }

    const subtotal = calculateGnomingSubtotal(cards);
    let finalTotal = subtotal;

    // 2. Automated "Went Out First" Bonus/Penalty
    if (round.wentOutFirst) {
        let isLowest = true;
        if (typeof roundIndex === 'number' && players.length > 0) {
            const otherSubtotals = players
                .filter(p => p.rounds[roundIndex] && p.rounds[roundIndex].id !== round.id)
                .map(p => {
                    const r = p.rounds[roundIndex];
                    return r.type === 'manual' ? r.score : calculateGnomingSubtotal(r.cards);
                });
            
            if (otherSubtotals.length > 0) {
                isLowest = subtotal <= Math.min(...otherSubtotals);
            }
        }
        const modifier = isLowest ? -5 : 5;
        finalTotal += modifier;
        breakdown.modifiers.push({ label: isLowest ? 'Out First (Lowest Score)' : 'Out First (Not Lowest)', value: modifier });
    }

    breakdown.total = finalTotal;
    return breakdown;
};

export const calculateRoundScore = (round: Round, settings: CardSettings, players: Player[] = [], roundIndex?: number): number => {
  if (round.type === 'manual') return round.score;
  if (round.type === 'scan') {
    if (settings.preset === 'gnoming_around') {
        return getGnomingBreakdown(round.cards, round, players, roundIndex).total;
    }
    let sum = 0;
    let multiplier = 1;
    round.cards.forEach(card => {
      const rank = card.rank.toUpperCase();
      if (rank.startsWith('X') && settings.preset === 'flip7') {
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

export const calculatePlayerTotal = (player: Player, settings: CardSettings, allPlayers?: Player[]): number => {
  return player.rounds.reduce((sum, round, index) => sum + calculateRoundScore(round, settings, allPlayers, index), 0);
};
