
import React, { useState, useRef, useEffect } from 'react';
import { Player, CardSettings, Round, DetectedCard } from '../types';
import { Button } from '../components/Button';
import { IconSettings, IconCamera, IconPlus, IconX, IconQrCode, IconCheck, IconPencil, IconTrash } from '../components/Icons';
import { calculatePlayerTotal, calculateRoundScore, calculateCardScore } from '../utils/scoringUtils';
import { v4 as uuidv4 } from 'uuid';

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', 'Joker'];
const SUITS = ['Spades', 'Hearts', 'Diamonds', 'Clubs', 'Stars', 'None'];

interface GameViewProps {
  players: Player[];
  settings: CardSettings;
  onSaveRound: (playerId: string, round: Round) => void;
  onRequestScan: (playerId: string, roundId?: string) => void;
  onOpenSettings: () => void;
  onReset: () => void;
  onOpenMultiplayer: () => void;
  isClient: boolean;
}

export const GameView: React.FC<GameViewProps> = ({ 
  players, 
  settings,
  onSaveRound, 
  onRequestScan,
  onOpenSettings,
  onReset,
  onOpenMultiplayer,
  isClient
}) => {
  const [manualEntryPlayerId, setManualEntryPlayerId] = useState<string | null>(null);
  const [manualEntryRoundId, setManualEntryRoundId] = useState<string | null>(null);
  const [manualScore, setManualScore] = useState<string>('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  
  // State for viewing round details
  const [activeRound, setActiveRound] = useState<Round | null>(null);
  const [activeRoundPlayerName, setActiveRoundPlayerName] = useState<string | null>(null);
  const [activeRoundPlayerId, setActiveRoundPlayerId] = useState<string | null>(null);
  const [activeRoundIndex, setActiveRoundIndex] = useState<number | null>(null);
  
  // Edit state for active round
  const [editingCardId, setEditingCardId] = useState<string | null>(null);

  // Load my players
  const [myPlayerIds] = useState<Set<string>>(() => {
    try {
        const stored = localStorage.getItem('snapscore_my_player_ids');
        return new Set(stored ? JSON.parse(stored) : []);
    } catch {
        return new Set();
    }
  });

  const manualInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (manualEntryPlayerId && manualInputRef.current) {
      manualInputRef.current.select();
    }
  }, [manualEntryPlayerId]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualEntryPlayerId) {
        // Default to 0 if empty
        const scoreValue = manualScore === '' ? 0 : parseInt(manualScore);
        
        if (!isNaN(scoreValue)) {
            const round: Round = {
                type: 'manual',
                id: manualEntryRoundId || uuidv4(), // Use existing ID if editing, else new
                score: scoreValue,
                timestamp: Date.now()
            };
            onSaveRound(manualEntryPlayerId, round);
            setManualEntryPlayerId(null);
            setManualEntryRoundId(null);
            setManualScore('');
        }
    }
  };

  const handleSaveChanges = () => {
      if (activeRound && activeRoundPlayerId) {
          onSaveRound(activeRoundPlayerId, activeRound);
          setActiveRound(null);
      }
  };

  // Helper to update active round cards
  const updateActiveRoundCard = (cardId: string, field: 'rank' | 'suit', value: string) => {
      if (activeRound && activeRound.type === 'scan') {
          const updatedCards = activeRound.cards.map(c => c.id === cardId ? { ...c, [field]: value } : c);
          setActiveRound({ ...activeRound, cards: updatedCards });
      }
  };

  const deleteActiveRoundCard = (cardId: string) => {
      if (activeRound && activeRound.type === 'scan') {
          const updatedCards = activeRound.cards.filter(c => c.id !== cardId);
          setActiveRound({ ...activeRound, cards: updatedCards });
      }
  };

  const addActiveRoundCard = () => {
      if (activeRound && activeRound.type === 'scan') {
          const newCard: DetectedCard = { id: uuidv4(), rank: 'A', suit: 'Spades' };
          setActiveRound({ ...activeRound, cards: [...activeRound.cards, newCard] });
          setEditingCardId(newCard.id);
      }
  };

  const manualEntryName = players.find(p => p.id === manualEntryPlayerId)?.name;

  const myPlayers = players.filter(p => myPlayerIds.has(p.id));
  const otherPlayers = players.filter(p => !myPlayerIds.has(p.id));
  
  const renderPlayerCard = (player: Player) => {
    const totalScore = calculatePlayerTotal(player, settings);
    return (
      <div key={player.id} className="bg-slate-800 rounded-xl p-4 shadow-lg border border-slate-700/50 relative overflow-hidden group">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-lg font-bold text-white truncate max-w-[120px]">{player.name}</h3>
          <div className="text-right">
            <span className="text-3xl font-black text-emerald-400">{totalScore}</span>
            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Total Pts</div>
          </div>
        </div>
        
        {/* History Snippet */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-2 text-xs text-slate-400 scrollbar-hide">
           {player.rounds.length === 0 && <span className="italic opacity-50">No rounds played</span>}
           {player.rounds.map((round, i) => (
               <button 
                  key={round.id || i} 
                  onClick={() => {
                      setActiveRound(round);
                      setActiveRoundPlayerName(player.name);
                      setActiveRoundPlayerId(player.id);
                      setActiveRoundIndex(i + 1);
                  }}
                  className="bg-slate-900/50 hover:bg-slate-900 hover:text-emerald-400 px-2 py-1 rounded border border-transparent hover:border-emerald-500/30 transition-colors cursor-pointer"
               >
                 {calculateRoundScore(round, settings)}
               </button>
           ))}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 mt-2">
            <button 
                onClick={() => onRequestScan(player.id)}
                className="flex items-center justify-center gap-2 py-2 rounded-lg border transition-colors font-medium text-sm bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20 border-emerald-600/20"
            >
                <IconCamera className="w-4 h-4" />
                Scan Hand
            </button>
            <button 
                 onClick={() => {
                    setManualEntryPlayerId(player.id);
                    setManualEntryRoundId(null);
                    setManualScore('');
                 }}
                className="flex items-center justify-center gap-2 bg-slate-700 text-slate-300 hover:bg-slate-600 py-2 rounded-lg transition-colors font-medium text-sm"
            >
                <IconPlus className="w-4 h-4" />
                Manual
            </button>
        </div>
      </div>
    );
  };
  
  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <header className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800 p-4 sticky top-0 z-10 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
             Scoreboard
             {isClient && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30">JOINED</span>}
          </h1>
          <p className="text-xs text-slate-400">Round {Math.max(1, ...players.map(p => p.rounds.length)) + (players.some(p => p.rounds.length < Math.max(...players.map(pl => pl.rounds.length))) ? 0 : 1)}</p>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setShowResetConfirm(true)} className="text-xs text-slate-500 hover:text-red-400 px-2">New Game</button>
             <button onClick={onOpenMultiplayer} className="p-2 rounded-full bg-slate-800 text-emerald-400 hover:bg-slate-700">
                <IconQrCode className="w-5 h-5" />
            </button>
            <button onClick={onOpenSettings} className="p-2 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700">
            <IconSettings className="w-5 h-5" />
            </button>
        </div>
      </header>

      {/* Player List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        {/* Render My Players First */}
        {myPlayers.map(renderPlayerCard)}

        {/* Divider if both sections exist */}
        {myPlayers.length > 0 && otherPlayers.length > 0 && (
            <div className="flex items-center gap-3 py-2 opacity-50">
                 <div className="h-px bg-slate-600 flex-1"></div>
                 <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Remote Players</span>
                 <div className="h-px bg-slate-600 flex-1"></div>
            </div>
        )}

        {/* Render Other Players */}
        {otherPlayers.map(renderPlayerCard)}
        
        {players.length === 0 && (
            <div className="text-center py-10 opacity-50">
                <p>No players added.</p>
            </div>
        )}
      </div>

      {/* Reset Confirmation Dialog - Kept as centered alert */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-800 w-full max-w-xs rounded-2xl shadow-2xl border border-slate-700 p-6 flex flex-col justify-center">
                <h3 className="text-xl font-bold text-white mb-2">Start New Game?</h3>
                <p className="text-slate-400 mb-6 text-sm">All current scores and progress will be lost.</p>
                <div className="grid grid-cols-2 gap-3">
                    <Button variant="secondary" onClick={() => setShowResetConfirm(false)}>
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={() => {
                        onReset();
                        setShowResetConfirm(false);
                    }}>
                        Reset
                    </Button>
                </div>
            </div>
        </div>
      )}

      {/* Manual Entry Modal - Full Screen */}
      {manualEntryPlayerId && (
        <div className="fixed inset-0 z-[60] bg-felt-900 flex flex-col h-[100dvh] w-full md:max-w-md md:mx-auto md:border-x md:border-slate-800">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
                <h3 className="text-lg font-bold text-white">{manualEntryRoundId ? 'Edit Score' : 'Add Score'}</h3>
                <button onClick={() => { setManualEntryPlayerId(null); setManualEntryRoundId(null); }} className="text-slate-400 hover:text-white p-2 -mr-2 rounded-full">
                    <IconX className="w-6 h-6" />
                </button>
            </div>

            {/* Content */}
            <form onSubmit={handleManualSubmit} className="flex-1 flex flex-col justify-center p-6 overflow-y-auto">
                <div className="text-center space-y-2 mb-8">
                    <p className="text-slate-400 text-sm">Enter points for</p>
                    <p className="text-2xl font-bold text-emerald-400">{manualEntryName}</p>
                </div>
                
                <input
                    ref={manualInputRef}
                    type="number"
                    value={manualScore}
                    onChange={(e) => setManualScore(e.target.value)}
                    placeholder="0"
                    autoFocus
                    className="w-full bg-slate-900 border-2 border-slate-700 focus:border-emerald-500 rounded-2xl text-center text-6xl font-black text-white py-8 focus:outline-none transition-all shadow-inner"
                />
            </form>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/30 shrink-0 grid grid-cols-2 gap-4">
                <Button type="button" variant="secondary" onClick={() => { setManualEntryPlayerId(null); setManualEntryRoundId(null); }}>
                    Cancel
                </Button>
                <Button type="button" onClick={handleManualSubmit} className="bg-emerald-500 text-white">
                    {isClient ? "Save" : "Save"}
                </Button>
            </div>
        </div>
      )}

      {/* Round Details Modal - Full Screen */}
      {activeRound && (
        <div className="fixed inset-0 z-[60] bg-felt-900 flex flex-col h-[100dvh] w-full md:max-w-md md:mx-auto md:border-x md:border-slate-800">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
                <div>
                    <h3 className="text-lg font-bold text-white">Round {activeRoundIndex}</h3>
                    <p className="text-xs text-slate-400">{activeRoundPlayerName}</p>
                </div>
                <button onClick={() => setActiveRound(null)} className="text-slate-400 hover:text-white p-2 -mr-2 rounded-full">
                    <IconX className="w-6 h-6" />
                </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {activeRound.type === 'manual' ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-12">
                            <div className="bg-slate-800/50 rounded-full w-24 h-24 flex items-center justify-center mb-6">
                            <IconPlus className="w-10 h-10 text-slate-500" />
                            </div>
                            <p className="text-slate-400 mb-2">Manual Entry</p>
                            <p className="text-6xl font-bold text-emerald-400">{activeRound.score}</p>
                            <p className="text-sm text-slate-500 mt-2">Points added manually</p>
                    </div>
                ) : (
                    <div>
                        <ul className="space-y-2">
                            {activeRound.cards.map((card) => (
                                <li key={card.id} className="flex justify-between items-center bg-slate-800/50 p-2 rounded-lg border border-slate-700/50 min-h-[48px]">
                                    {editingCardId === card.id ? (
                                        <div className="flex items-center gap-2 flex-1">
                                            <select 
                                                value={card.rank} 
                                                onChange={(e) => updateActiveRoundCard(card.id, 'rank', e.target.value)}
                                                className="bg-slate-700 text-white rounded px-2 py-1 text-sm font-bold border border-slate-600 focus:border-emerald-500 outline-none w-16 text-center"
                                            >
                                                {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                                            </select>
                                            <span className="text-slate-500 text-xs">of</span>
                                            <select 
                                                value={card.suit} 
                                                onChange={(e) => updateActiveRoundCard(card.id, 'suit', e.target.value)}
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
                                                onClick={() => deleteActiveRoundCard(card.id)}
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
                                                    <button onClick={() => deleteActiveRoundCard(card.id)} className="p-1 text-slate-500 hover:text-red-400">
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
                            <Button variant="ghost" fullWidth onClick={addActiveRoundCard} className="border-2 border-dashed border-slate-700 hover:border-slate-600 py-2 text-sm">
                                <IconPlus className="w-4 h-4 mr-2" /> Add Card
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/30 shrink-0 space-y-4">
                    {activeRound.type === 'scan' && (
                    <div className="flex justify-between items-center px-2">
                        <span className="text-slate-400 font-semibold uppercase text-sm">Round Total</span>
                        <span className="text-2xl font-bold text-white">{calculateRoundScore(activeRound, settings)}</span>
                    </div>
                    )}
                {activeRound.type === 'manual' ? (
                    <Button 
                        fullWidth
                        variant="secondary" 
                        onClick={() => {
                            if (activeRoundPlayerId && activeRound) {
                                setManualEntryPlayerId(activeRoundPlayerId);
                                setManualEntryRoundId(activeRound.id);
                                setManualScore(calculateRoundScore(activeRound, settings).toString());
                                setActiveRound(null);
                            }
                        }}
                    >
                        Edit Score
                    </Button>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        <Button 
                            variant="soft"
                            onClick={() => {
                                if (activeRoundPlayerId && activeRound) {
                                    onRequestScan(activeRoundPlayerId, activeRound.id);
                                    setActiveRound(null);
                                }
                            }}
                        >
                            <IconCamera className="w-4 h-4 mr-2" />
                            Rescan
                        </Button>
                        <Button 
                            variant="primary" 
                            onClick={handleSaveChanges}
                        >
                            Save Changes
                        </Button>
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
};
