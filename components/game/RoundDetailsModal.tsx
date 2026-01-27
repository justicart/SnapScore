import React, { useState } from 'react';
import { Round, DetectedCard, CardSettings, Player } from '../../types';
import { Button } from '../Button';
import { IconX, IconPlus, IconCheck, IconTrash, IconPencil, IconCamera, IconStar } from '../Icons';
import { calculateRoundScore, calculateCardScore, getGnomingBreakdown } from '../../utils/scoringUtils';
import { v4 as uuidv4 } from 'uuid';

const RANKS = [
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', 
  '-2', '-1', 'J', 'Q', 'K', 'A', 'Joker', 'Star', 'X',
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
  players?: Player[];
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
  players = [],
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

  const toggleWentOut = () => {
      if (round.type === 'scan') {
          onChange({ ...round, wentOutFirst: !round.wentOutFirst });
      }
  };

  const isGnoming = settings.preset === 'gnoming_around';
  const displayIndex = roundIndex !== null ? roundIndex - 1 : undefined;
  const gnomingBreakdown = (isGnoming && round.type === 'scan') ? getGnomingBreakdown(round.cards, round, players, displayIndex) : null;

  // Determine color for "Went Out First" button based on modifier
  let outFirstColorClass = 'bg-surface border-surface-highlight text-ink-muted';
  let outFirstIconColor = '';
  
  if (round.type === 'scan' && round.wentOutFirst) {
      const outFirstMod = gnomingBreakdown?.modifiers.find(m => m.label.includes('Out first'));
      if (outFirstMod && outFirstMod.value > 0) {
          // Penalty (Red)
          outFirstColorClass = 'bg-danger/10 border-danger text-danger-soft shadow-[0_0_15px_rgba(239,68,68,0.1)]';
      } else {
          // Bonus/Default (Green)
          outFirstColorClass = 'bg-primary/10 border-primary text-primary-soft shadow-[0_0_15px_rgba(16,185,129,0.1)]';
      }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-canvas flex flex-col w-full md:max-w-md md:mx-auto md:border-x md:border-surface">
      <div className="p-4 border-b border-surface flex justify-between items-center bg-surface-dark/50 shrink-0">
        <div>
          <h3 className="text-lg font-bold text-white">Round {roundIndex}</h3>
          <p className="text-xs text-ink-muted">{playerName}</p>
        </div>
        <button onClick={onClose} className="text-ink-muted hover:text-white p-2 -mr-2 rounded-full">
          <IconX className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {round.type === 'manual' ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="bg-surface/50 rounded-full w-24 h-24 flex items-center justify-center mb-6">
              <IconPlus className="w-10 h-10 text-ink-subtle" />
            </div>
            <p className="text-ink-muted mb-2">Manual entry</p>
            <p className="text-6xl font-bold text-primary-soft">{round.score}</p>
          </div>
        ) : (
          <div className="space-y-6 pb-6">
            {isGnoming && round.cards.length === 9 ? (
                <div className="space-y-4">
                    <h4 className="text-xs text-ink-subtle uppercase font-bold text-center tracking-widest">3x3 grid layout</h4>
                    <div className="grid grid-cols-3 gap-2 aspect-square max-w-[280px] mx-auto p-2 bg-surface/20 rounded-2xl border border-surface-highlight/30 shadow-inner">
                        {round.cards.map((card) => (
                            <button
                                key={card.id}
                                onClick={() => setEditingCardId(card.id)}
                                className={`rounded-xl border-2 flex flex-col items-center justify-center p-2 transition-all h-full ${
                                    editingCardId === card.id 
                                    ? 'bg-primary border-white shadow-lg scale-105 z-10' 
                                    : 'bg-surface border-surface-highlight/50 hover:border-surface-highlight'
                                }`}
                            >
                                <span className={`text-2xl font-black ${
                                    card.rank === 'X' ? 'text-danger-soft' : 
                                    card.rank === 'Star' ? 'text-accent' : 
                                    (parseInt(card.rank) < 0) ? 'text-blue-400' : 'text-white'
                                }`}>
                                    {card.rank === 'Star' ? '★' : card.rank}
                                </span>
                            </button>
                        ))}
                    </div>

                    {gnomingBreakdown && (
                      <div className="mt-6 bg-surface/50 p-4 rounded-xl border border-surface-highlight/50 space-y-4 shadow-lg">
                          <h4 className="text-xs text-primary uppercase font-bold tracking-widest border-b border-surface-highlight/50 pb-2 flex items-center gap-2">
                             <IconStar className="w-3 h-3" /> Breakdown
                          </h4>
                          
                          {gnomingBreakdown.sets.length > 0 && (
                            <div className="space-y-1">
                              {gnomingBreakdown.sets.map((s, i) => (
                                <div key={i} className="flex justify-between items-center text-blue-400 font-bold bg-blue-500/5 px-2 py-1 rounded">
                                    <span className="text-sm">{s.label}</span>
                                    <span className="font-mono">{s.value}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="space-y-1">
                              {gnomingBreakdown.loneCards.map((c, i) => (
                                 <div key={i} className="flex justify-between items-center text-ink-muted px-2 py-0.5 border-b border-surface-highlight/30 last:border-0">
                                    <span className={`text-sm ${c.isHazard ? 'text-danger-soft font-bold' : c.rank === 'Star' ? 'text-accent' : ''}`}>
                                        {c.rank === 'Star' ? 'Unused star' : c.isHazard ? 'Hazard (X)' : c.rank}
                                    </span>
                                    <span className={`font-mono ${c.value > 0 ? 'text-primary-soft' : c.value < 0 ? 'text-blue-400' : 'text-ink-subtle'}`}>
                                        {c.value >= 0 ? `+${c.value}` : c.value}
                                    </span>
                                 </div>
                              ))}
                          </div>

                          {gnomingBreakdown.modifiers.length > 0 && (
                             <div className="pt-2 border-t border-surface-highlight/50 space-y-1">
                                {gnomingBreakdown.modifiers.map((m, i) => (
                                    <div key={i} className="flex justify-between items-center bg-surface-dark/40 px-2 py-1 rounded italic">
                                        <span className="text-sm text-ink-muted">{m.label}</span>
                                        <span className={m.value < 0 ? 'text-primary-soft font-bold' : 'text-danger-soft font-bold'}>{m.value >= 0 ? `+${m.value}` : m.value}</span>
                                    </div>
                                ))}
                             </div>
                          )}
                      </div>
                    )}

                    {editingCardId && (
                        <div className="bg-surface p-4 rounded-xl border border-surface-highlight animate-in fade-in slide-in-from-top-2 duration-200 shadow-2xl">
                             <div className="flex justify-between items-center mb-3">
                                <span className="text-xs font-bold text-ink-muted uppercase tracking-widest">Update card</span>
                                <button onClick={() => setEditingCardId(null)} className="p-1 text-ink-muted hover:text-white"><IconX className="w-4 h-4"/></button>
                             </div>
                             <div className="flex gap-2">
                                <select 
                                    value={round.cards.find(c => c.id === editingCardId)?.rank} 
                                    onChange={(e) => updateCard(editingCardId, 'rank', e.target.value)}
                                    className="flex-1 bg-surface-highlight text-white rounded-lg px-3 py-2 text-lg font-bold border border-surface-highlight focus:border-primary focus:ring-1 focus:ring-primary"
                                >
                                    {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                                <button onClick={() => deleteCard(editingCardId)} className="bg-danger/20 text-danger-soft p-3 rounded-lg border border-danger/20 hover:bg-danger/30 transition-colors"><IconTrash className="w-5 h-5"/></button>
                             </div>
                        </div>
                    )}
                </div>
            ) : (
                <ul className="space-y-2">
                    {round.cards.map((card) => {
                        const isMultiplier = card.rank.toLowerCase().startsWith('x');
                        const isAdditive = card.rank.toLowerCase().startsWith('+');
                        return (
                        <li key={card.id} className="flex justify-between items-center bg-surface/50 p-2 rounded-lg border border-surface-highlight/50 min-h-[48px]">
                            {editingCardId === card.id ? (
                            <div className="flex items-center gap-2 flex-1">
                                <select 
                                value={card.rank} 
                                onChange={(e) => updateCard(card.id, 'rank', e.target.value)}
                                className="bg-surface-highlight text-white rounded px-2 py-1 text-sm font-bold border border-surface-highlight outline-none w-16 text-center"
                                >
                                {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                                <select 
                                value={card.suit} 
                                onChange={(e) => updateCard(card.id, 'suit', e.target.value)}
                                className="bg-surface-highlight text-white rounded px-2 py-1 text-sm font-bold border border-surface-highlight outline-none flex-1"
                                >
                                {SUITS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <button onClick={() => setEditingCardId(null)} className="p-1.5 rounded bg-primary/20 text-primary-soft"><IconCheck className="w-4 h-4" /></button>
                            </div>
                            ) : (
                            <>
                                <div className="flex-1 ml-2 flex items-baseline gap-2">
                                <span className={`text-xl font-black ${isMultiplier ? 'text-accent' : isAdditive ? 'text-primary-soft' : (parseInt(card.rank) < 0) ? 'text-blue-400' : 'text-white'}`}>
                                    {card.rank === 'Star' ? '★' : card.rank}
                                </span>
                                {card.suit !== 'None' && <span className="text-sm font-medium text-primary-soft/60">{card.suit}</span>}
                                </div>
                                <div className="flex items-center gap-3">
                                <span className={`text-base font-mono font-bold ${isMultiplier ? 'text-accent' : 'text-primary-soft'}`}>
                                    {isMultiplier ? `${card.rank} MOD` : card.rank === 'X' ? 'Hazard' : `+${calculateCardScore(card, settings)}`}
                                </span>
                                <div className="flex gap-1">
                                    <button onClick={() => setEditingCardId(card.id)} className="p-1 text-ink-subtle hover:text-white"><IconPencil className="w-4 h-4" /></button>
                                    <button onClick={() => deleteCard(card.id)} className="p-1 text-ink-subtle hover:text-danger-soft"><IconTrash className="w-4 h-4" /></button>
                                </div>
                                </div>
                            </>
                            )}
                        </li>
                        );
                    })}
                </ul>
            )}

            {!isGnoming && (
                <div className="pt-3">
                    <Button variant="ghost" fullWidth onClick={addCard} className="border-2 border-dashed border-surface-highlight py-2"><IconPlus className="w-4 h-4 mr-2" /> Add card</Button>
                </div>
            )}

            {isGnoming && (
                <div className="bg-surface/30 p-4 rounded-xl space-y-4 border border-surface-highlight/50 mt-4 shadow-inner">
                    <div className="flex justify-between items-center border-b border-surface-highlight/50 pb-2">
                        <h4 className="text-xs font-bold text-ink-subtle uppercase tracking-widest">Game modifiers</h4>
                        <IconStar className="w-4 h-4 text-primary-soft/50" />
                    </div>
                    <button 
                        onClick={toggleWentOut}
                        className={`w-full flex justify-between items-center p-3 rounded-xl border-2 transition-all ${outFirstColorClass}`}
                    >
                        <span className="font-bold">I went out first</span>
                        {round.wentOutFirst ? <IconCheck className="w-5 h-5" /> : <div className="w-5 h-5 rounded-full border border-ink-subtle" />}
                    </button>
                    {round.wentOutFirst && (
                        <p className="text-[10px] text-ink-subtle uppercase font-bold text-center px-4 animate-in fade-in duration-300">
                           Bonus/Penalty applied automatically based on group scores.
                        </p>
                    )}
                </div>
            )}

            {round.calculationDurationMs !== undefined && (
              <div className="flex flex-col items-center justify-center pt-4 opacity-40 hover:opacity-100 transition-opacity">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-1">Vision analysis</p>
                <p className="text-xs text-ink-muted font-mono">
                  {(round.calculationDurationMs / 1000).toFixed(2)} seconds to calculate
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-surface bg-surface-dark/30 shrink-0 space-y-4">
        <div className="flex justify-between items-center px-2">
          <span className="text-ink-muted font-semibold uppercase text-xs tracking-widest">Total round score</span>
          <span className="text-4xl font-black text-white">{calculateRoundScore(round, settings, players, displayIndex)}</span>
        </div>
        <div className="flex gap-3">
          <Button variant="danger" onClick={() => setShowDeleteConfirm(true)} className="px-4"><IconTrash className="w-5 h-5" /></Button>
          <div className="flex-1 grid grid-cols-2 gap-3">
            <Button variant="soft" onClick={onRequestScan}><IconCamera className="w-4 h-4 mr-2" /> Rescan</Button>
            <Button variant="primary" onClick={onSave} className="shadow-lg shadow-primary/20">Save</Button>
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="absolute inset-0 z-20 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="bg-surface w-full max-w-xs rounded-2xl p-6 border border-surface-highlight shadow-2xl">
                <h4 className="text-xl font-bold text-white mb-2">Delete score?</h4>
                <p className="text-sm text-ink-muted mb-6">This round will be permanently removed.</p>
                <div className="grid grid-cols-2 gap-3">
                    <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                    <Button variant="danger" onClick={() => { onDelete?.(); setShowDeleteConfirm(false); }}>Delete</Button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
