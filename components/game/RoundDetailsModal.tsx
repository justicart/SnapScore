
import React, { useState } from 'react';
import { Round, DetectedCard, CardSettings } from '../../types';
import { Button } from '../Button';
import { IconX, IconPlus, IconCheck, IconTrash, IconPencil, IconCamera } from '../Icons';
import { calculateRoundScore, calculateCardScore } from '../../utils/scoringUtils';
import { v4 as uuidv4 } from 'uuid';

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', 'Joker'];
const SUITS = ['Spades', 'Hearts', 'Diamonds', 'Clubs', 'Stars', 'None'];

interface RoundDetailsModalProps {
  round: Round;
  playerName: string | null;
  playerId: string | null;
  roundIndex: number | null;
  settings: CardSettings;
  onChange: (updatedRound: Round) => void;
  onSave: () => void;
  onClose: () => void;
  onEditScoreManual: () => void;
  onRequestScan: () => void;
}

export const RoundDetailsModal: React.FC<RoundDetailsModalProps> = ({
  round,
  playerName,
  playerId,
  roundIndex,
  settings,
  onChange,
  onSave,
  onClose,
  onEditScoreManual,
  onRequestScan
}) => {
  const [editingCardId, setEditingCardId] = useState<string | null>(null);

  const updateCard = (cardId: string, field: 'rank' | 'suit', value: string) => {
    if (round.type === 'scan') {
      const updatedCards = round.cards.map(c => c.id === cardId ? { ...c, [field]: value } : c);
      onChange({ ...round, cards: updatedCards });
    }
  };

  const deleteCard = (cardId: string) => {
    if (round.type === 'scan') {
      const updatedCards = round.cards.filter(c => c.id !== cardId);
      onChange({ ...round, cards: updatedCards });
    }
  };

  const addCard = () => {
    if (round.type === 'scan') {
      const newCard: DetectedCard = { id: uuidv4(), rank: 'A', suit: 'Spades' };
      onChange({ ...round, cards: [...round.cards, newCard] });
      setEditingCardId(newCard.id);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-felt-900 flex flex-col w-full md:max-w-md md:mx-auto md:border-x md:border-slate-800">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
        <div>
          <h3 className="text-lg font-bold text-white">Round {roundIndex}</h3>
          <p className="text-xs text-slate-400">{playerName}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white p-2 -mr-2 rounded-full">
          <IconX className="w-6 h-6" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {round.type === 'manual' ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="bg-slate-800/50 rounded-full w-24 h-24 flex items-center justify-center mb-6">
              <IconPlus className="w-10 h-10 text-slate-500" />
            </div>
            <p className="text-slate-400 mb-2">Manual Entry</p>
            <p className="text-6xl font-bold text-emerald-400">{round.score}</p>
            <p className="text-sm text-slate-500 mt-2">Points added manually</p>
          </div>
        ) : (
          <div>
            <ul className="space-y-2">
              {round.cards.map((card) => (
                <li key={card.id} className="flex justify-between items-center bg-slate-800/50 p-2 rounded-lg border border-slate-700/50 min-h-[48px]">
                  {editingCardId === card.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <select 
                        value={card.rank} 
                        onChange={(e) => updateCard(card.id, 'rank', e.target.value)}
                        className="bg-slate-700 text-white rounded px-2 py-1 text-sm font-bold border border-slate-600 focus:border-emerald-500 outline-none w-16 text-center"
                      >
                        {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <span className="text-slate-500 text-xs">of</span>
                      <select 
                        value={card.suit} 
                        onChange={(e) => updateCard(card.id, 'suit', e.target.value)}
                        className="bg-slate-700 text-white rounded px-2 py-1 text-sm font-bold border border-slate-600 focus:border-emerald-500 outline-none flex-1"
                      >
                        {SUITS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <button 
                        onClick={() => setEditingCardId(null)}
                        className="p-1.5 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                      >
                        <IconCheck className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => deleteCard(card.id)}
                        className="p-1.5 rounded bg-slate-700 text-slate-400 hover:text-red-400 hover:bg-slate-600 ml-1"
                      >
                        <IconTrash className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 ml-2 flex items-baseline gap-2">
                        <span className="text-xl font-black text-white">{card.rank}</span>
                        {card.suit !== 'None' && (
                          <span className="text-sm font-medium text-emerald-100/60">{card.suit}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-base font-mono font-bold text-emerald-400">+{calculateCardScore(card, settings)}</span>
                        <div className="flex gap-1">
                          <button onClick={() => setEditingCardId(card.id)} className="p-1 text-slate-500 hover:text-white">
                            <IconPencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteCard(card.id)} className="p-1 text-slate-500 hover:text-red-400">
                            <IconTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <div className="pt-3 mt-2">
              <Button variant="ghost" fullWidth onClick={addCard} className="border-2 border-dashed border-slate-700 hover:border-slate-600 py-2 text-sm">
                <IconPlus className="w-4 h-4 mr-2" /> Add Card
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/30 shrink-0 space-y-4">
        {round.type === 'scan' && (
          <div className="flex justify-between items-center px-2">
            <span className="text-slate-400 font-semibold uppercase text-sm">Round Total</span>
            <span className="text-2xl font-bold text-white">{calculateRoundScore(round, settings)}</span>
          </div>
        )}
        {round.type === 'manual' ? (
          <Button 
            fullWidth
            variant="secondary" 
            onClick={onEditScoreManual}
          >
            Edit Score
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Button 
              variant="soft"
              onClick={onRequestScan}
            >
              <IconCamera className="w-4 h-4 mr-2" />
              Rescan
            </Button>
            <Button 
              variant="primary" 
              onClick={onSave}
            >
              Save Changes
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
