
import React, { useState } from 'react';
import { Round, DetectedCard, CardSettings } from '../../types';
import { Button } from '../Button';
import { IconX, IconPlus, IconCheck, IconTrash, IconPencil, IconCamera } from '../Icons';
import { calculateRoundScore, calculateCardScore } from '../../utils/scoringUtils';
import { v4 as uuidv4 } from 'uuid';

const RANKS = [
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', 
  'J', 'Q', 'K', 'A', 'Joker', 
  '+1', '+2', '+5', '+10', 
  'x2', 'x3'
];
const SUITS = ['Spades', 'Hearts', 'Diamonds', 'Clubs', 'Stars', 'None'];

interface RoundDetailsModalProps {
  round: Round;
  playerName: string | null;
  playerId: string | null;
  roundIndex: number | null;
  settings: CardSettings;
  onChange: (updatedRound: Round) => void;
  onSave: () => void;
  onDelete?: () => void;
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
  onDelete,
  onClose,
  onEditScoreManual,
  onRequestScan
}) => {
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
      const newCard: DetectedCard = { id: uuidv4(), rank: '1', suit: 'None' };
      onChange({ ...round, cards: [...round.cards, newCard] });
      setEditingCardId(newCard.id);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-felt-900 flex flex-col w-full md:max-w-md md:mx-auto md:border-x md:border-slate-800">
      <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
        <div>
          <h3 className="text-lg font-bold text-white">Round {roundIndex}</h3>
          <p className="text-xs text-slate-400">{playerName}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white p-2 -mr-2 rounded-full">
          <IconX className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {round.type === 'manual' ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="bg-slate-800/50 rounded-full w-24 h-24 flex items-center justify-center mb-6">
              <IconPlus className="w-10 h-10 text-slate-500" />
            </div>
            <p className="text-slate-400 mb-2">Manual Entry</p>
            <p className="text-6xl font-bold text-emerald-400">{round.score}</p>
          </div>
        ) : (
          <div>
            <ul className="space-y-2">
              {round.cards.map((card) => {
                const isMultiplier = card.rank.toLowerCase().startsWith('x');
                const isAdditive = card.rank.toLowerCase().startsWith('+');
                return (
                  <li key={card.id} className="flex justify-between items-center bg-slate-800/50 p-2 rounded-lg border border-slate-700/50 min-h-[48px]">
                    {editingCardId === card.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <select 
                          value={card.rank} 
                          onChange={(e) => updateCard(card.id, 'rank', e.target.value)}
                          className="bg-slate-700 text-white rounded px-2 py-1 text-sm font-bold border border-slate-600 outline-none w-16 text-center"
                        >
                          {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <select 
                          value={card.suit} 
                          onChange={(e) => updateCard(card.id, 'suit', e.target.value)}
                          className="bg-slate-700 text-white rounded px-2 py-1 text-sm font-bold border border-slate-600 outline-none flex-1"
                        >
                          {SUITS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <button onClick={() => setEditingCardId(null)} className="p-1.5 rounded bg-emerald-500/20 text-emerald-400"><IconCheck className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 ml-2 flex items-baseline gap-2">
                          <span className={`text-xl font-black ${isMultiplier ? 'text-gold-400' : isAdditive ? 'text-emerald-400' : 'text-white'}`}>{card.rank}</span>
                          {card.suit !== 'None' && <span className="text-sm font-medium text-emerald-100/60">{card.suit}</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-base font-mono font-bold ${isMultiplier ? 'text-gold-400' : 'text-emerald-400'}`}>
                              {isMultiplier ? `${card.rank} MOD` : `+${calculateCardScore(card, settings)}`}
                          </span>
                          <div className="flex gap-1">
                            <button onClick={() => setEditingCardId(card.id)} className="p-1 text-slate-500 hover:text-white"><IconPencil className="w-4 h-4" /></button>
                            <button onClick={() => deleteCard(card.id)} className="p-1 text-slate-500 hover:text-red-400"><IconTrash className="w-4 h-4" /></button>
                          </div>
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="pt-3">
              <Button variant="ghost" fullWidth onClick={addCard} className="border-2 border-dashed border-slate-700 py-2"><IconPlus className="w-4 h-4 mr-2" /> Add Card</Button>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-800 bg-slate-900/30 shrink-0 space-y-4">
        <div className="flex justify-between items-center px-2">
          <span className="text-slate-400 font-semibold uppercase text-sm">Total Score</span>
          <span className="text-2xl font-bold text-white">{calculateRoundScore(round, settings)}</span>
        </div>
        <div className="flex gap-3">
          <Button variant="danger" onClick={() => setShowDeleteConfirm(true)} className="px-4"><IconTrash className="w-5 h-5" /></Button>
          {round.type === 'manual' ? (
            <Button variant="secondary" fullWidth onClick={onEditScoreManual}>Edit Score</Button>
          ) : (
            <div className="flex-1 grid grid-cols-2 gap-3">
              <Button variant="soft" onClick={onRequestScan}><IconCamera className="w-4 h-4 mr-2" /> Rescan</Button>
              <Button variant="primary" onClick={onSave}>Save</Button>
            </div>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="absolute inset-0 z-20 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="bg-slate-800 w-full max-w-xs rounded-2xl p-6">
                <h4 className="text-xl font-bold text-white mb-2">Delete Score?</h4>
                <div className="grid grid-cols-2 gap-3 mt-6">
                    <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                    <Button variant="danger" onClick={() => { onDelete?.(); setShowDeleteConfirm(false); }}>Delete</Button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
