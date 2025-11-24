
import React, { useState, useRef, useEffect } from 'react';
import { Player, CardSettings, Round, DetectedCard } from '../types';
import { Button } from '../components/Button';
import { IconSettings, IconCamera, IconPlus, IconX, IconQrCode, IconCheck, IconPencil, IconTrash, IconStar, IconChevronLeft } from '../components/Icons';
import { calculatePlayerTotal, calculateRoundScore, calculateCardScore } from '../utils/scoringUtils';
import { v4 as uuidv4 } from 'uuid';

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', 'Joker'];
const SUITS = ['Spades', 'Hearts', 'Diamonds', 'Clubs', 'Stars', 'None'];

interface GameViewProps {
  players: Player[];
  settings: CardSettings;
  onSaveRound: (playerId: string, round: Round) => void;
  onRequestScan: (playerId: string, roundId?: string) => void;
  onUpdatePlayers: (players: Player[]) => void;
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
  onUpdatePlayers,
  onOpenSettings,
  onReset,
  onOpenMultiplayer,
  isClient
}) => {
  const [manualEntryPlayerId, setManualEntryPlayerId] = useState<string | null>(null);
  const [manualEntryRoundId, setManualEntryRoundId] = useState<string | null>(null);
  const [manualScore, setManualScore] = useState<string>('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState<string | null>(null);
  
  // Roster Editing State
  const [isEditMode, setIsEditMode] = useState(false);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  
  // State for viewing round details
  const [activeRound, setActiveRound] = useState<Round | null>(null);
  const [activeRoundPlayerName, setActiveRoundPlayerName] = useState<string | null>(null);
  const [activeRoundPlayerId, setActiveRoundPlayerId] = useState<string | null>(null);
  const [activeRoundIndex, setActiveRoundIndex] = useState<number | null>(null);
  
  // Edit state for active round
  const [editingCardId, setEditingCardId] = useState<string | null>(null);

  // Viewport Height for Mobile Keyboard Handling
  const [viewportHeight, setViewportHeight] = useState<string | number>('100dvh');

  useEffect(() => {
    const handleResize = () => {
      if (window.visualViewport) {
        // We set the height to the visual viewport height to ensure 
        // footers are visible above the keyboard
        setViewportHeight(window.visualViewport.height);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      handleResize(); // Initial set
    }
    
    return () => window.visualViewport?.removeEventListener('resize', handleResize);
  }, []);

  // Load my players
  const [myPlayerIds] = useState<Set<string>>(() => {
    try {
        const stored = localStorage.getItem('snapscore_my_player_ids');
        return new Set(stored ? JSON.parse(stored) : []);
    } catch {
        return new Set();
    }
  });

  const myPlayers = players.filter(p => myPlayerIds.has(p.id));

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

  // --- Roster Editing Logic ---
  const handlePressStart = () => {
      if (isClient) return; // Clients cannot edit roster
      pressTimer.current = setTimeout(() => {
          if (navigator.vibrate) navigator.vibrate(50);
          setIsEditMode(true);
      }, 600);
  };

  const handlePressEnd = () => {
      if (pressTimer.current) {
          clearTimeout(pressTimer.current);
          pressTimer.current = null;
      }
  };
  
  // Cancel long press if user scrolls
  const handleTouchMove = () => {
      if (pressTimer.current) {
          clearTimeout(pressTimer.current);
          pressTimer.current = null;
      }
  };

  const movePlayer = (index: number, direction: 'up' | 'down') => {
      if (direction === 'up' && index === 0) return;
      if (direction === 'down' && index === players.length - 1) return;
      
      const newPlayers = [...players];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      
      [newPlayers[index], newPlayers[targetIndex]] = [newPlayers[targetIndex], newPlayers[index]];
      onUpdatePlayers(newPlayers);
  };

  const handleNameChange = (index: number, newName: string) => {
      const newPlayers = [...players];
      newPlayers[index] = { ...newPlayers[index], name: newName };
      onUpdatePlayers(newPlayers);
  };

  const confirmDeletePlayer = () => {
      if (playerToDelete) {
          onUpdatePlayers(players.filter(p => p.id !== playerToDelete));
          setPlayerToDelete(null);
          // If no players left, exit edit mode
          if (players.length <= 1) setIsEditMode(false);
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

  // Calculate winner
  // Rules: Only if ALL players have at least one round recorded.
  const allPlayersHavePlayed = players.length > 0 && players.every(p => p.rounds.length > 0);
  let winningPlayerIds = new Set<string>();

  if (allPlayersHavePlayed) {
    const playerTotals = players.map(p => ({ id: p.id, total: calculatePlayerTotal(p, settings) }));
    const totals = playerTotals.map(pt => pt.total);
    const targetScore = settings.winningScoreType === 'highest' 
        ? Math.max(...totals) 
        : Math.min(...totals);
    
    playerTotals.forEach(pt => {
        if (pt.total === targetScore) {
            winningPlayerIds.add(pt.id);
        }
    });
  }

  const renderPlayerCard = (player: Player, index: number) => {
    const totalScore = calculatePlayerTotal(player, settings);
    const isWinner = winningPlayerIds.has(player.id);
    const isLocal = myPlayerIds.has(player.id);

    if (isEditMode) {
        return (
            <div key={player.id} className="bg-slate-800 rounded-xl p-3 shadow-lg border-2 border-dashed border-emerald-500/50 flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 mr-2">
                    <div className="flex flex-col gap-1 shrink-0">
                        <button 
                            onClick={(e) => { e.stopPropagation(); movePlayer(index, 'up'); }}
                            disabled={index === 0}
                            className="p-1 bg-slate-700 rounded disabled:opacity-30 text-emerald-400 z-10 relative hover:bg-slate-600"
                        >
                            <svg className="w-4 h-4 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); movePlayer(index, 'down'); }}
                            disabled={index === players.length - 1}
                            className="p-1 bg-slate-700 rounded disabled:opacity-30 text-emerald-400 z-10 relative hover:bg-slate-600"
                        >
                             <svg className="w-4 h-4 -rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
                        </button>
                    </div>
                    <input 
                        type="text"
                        value={player.name}
                        onChange={(e) => handleNameChange(index, e.target.value)}
                        className="bg-transparent border-b border-slate-600 focus:border-emerald-500 text-white font-bold text-lg focus:outline-none w-full min-w-0"
                        placeholder="Player Name"
                    />
                </div>
                <button 
                    onClick={(e) => { 
                        e.stopPropagation(); 
                        setPlayerToDelete(player.id); 
                    }}
                    className="p-3 bg-red-500/10 text-red-500 rounded-lg z-10 relative hover:bg-red-500/20 cursor-pointer"
                >
                    <IconTrash className="w-6 h-6 pointer-events-none" />
                </button>
            </div>
        )
    }

    return (
      <div 
        key={player.id} 
        className="bg-slate-800 rounded-xl p-3 shadow-lg border border-slate-700/50 relative overflow-hidden group select-none"
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        onTouchMove={handleTouchMove}
      >
        <div className="flex justify-between items-center mb-2 pointer-events-none">
          <h3 className="text-lg font-bold text-white truncate max-w-[180px] flex items-center gap-2">
            {player.name}
            {isWinner && <IconStar className="w-5 h-5 text-gold-400 drop-shadow-md animate-pulse-slow" />}
          </h3>
          <span className={`text-3xl font-black ${isWinner ? 'text-gold-400' : 'text-emerald-400'}`}>{totalScore}</span>
        </div>
        
        {/* History Snippet */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-1 text-xs text-slate-400 scrollbar-hide">
           {player.rounds.length === 0 && <span className="italic opacity-50">No rounds played</span>}
           {player.rounds.map((round, i) => (
               <button 
                  key={round.id || i} 
                  onClick={(e) => {
                      e.stopPropagation();
                      setActiveRound(round);
                      setActiveRoundPlayerName(player.name);
                      setActiveRoundPlayerId(player.id);
                      setActiveRoundIndex(i + 1);
                  }}
                  className="bg-slate-900/50 hover:bg-slate-900 hover:text-emerald-400 px-2 py-1 rounded border border-transparent hover:border-emerald-500/30 transition-colors cursor-pointer shrink-0"
               >
                 {calculateRoundScore(round, settings)}
               </button>
           ))}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2 mt-1 relative z-10">
            <button 
                onClick={(e) => { e.stopPropagation(); onRequestScan(player.id); }}
                className="flex items-center justify-center gap-2 py-2 rounded-lg border transition-colors font-medium text-sm bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20 border-emerald-600/20"
            >
                <IconCamera className="w-4 h-4" />
                Scan Hand
            </button>
            <button 
                 onClick={(e) => {
                    e.stopPropagation();
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
      <header className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800 p-4 sticky top-0 z-10 flex justify-between items-center transition-colors duration-300" 
         style={{ backgroundColor: isEditMode ? 'rgba(6, 78, 59, 0.9)' : undefined }}>
        <div>
            {isEditMode ? (
                <h1 className="text-xl font-bold text-white animate-pulse">Editing Roster</h1>
            ) : (
                <>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                    Scoreboard
                    {isClient && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30">JOINED</span>}
                </h1>
                <p className="text-xs text-slate-400">Round {Math.max(1, ...players.map(p => p.rounds.length)) + (players.some(p => p.rounds.length < Math.max(...players.map(pl => pl.rounds.length))) ? 0 : 1)}</p>
                </>
            )}
        </div>
        <div className="flex gap-2">
            {isEditMode ? (
                <button 
                    onClick={() => setIsEditMode(false)}
                    className="bg-white text-emerald-900 px-4 py-2 rounded-full font-bold text-sm shadow-lg"
                >
                    Done
                </button>
            ) : (
                <>
                <button onClick={() => setShowResetConfirm(true)} className="text-xs text-slate-500 hover:text-red-400 px-2">New Game</button>
                <button onClick={onOpenMultiplayer} className="p-2 rounded-full bg-slate-800 text-emerald-400 hover:bg-slate-700">
                    <IconQrCode className="w-5 h-5" />
                </button>
                <button onClick={onOpenSettings} className="p-2 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700">
                <IconSettings className="w-5 h-5" />
                </button>
                </>
            )}
        </div>
      </header>

      {/* Player List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
        {/* If in edit mode, show simple list. If standard, show split list */}
        {isEditMode ? (
            players.map((p, i) => renderPlayerCard(p, i))
        ) : (
            <>
                {myPlayers.length > 0 && players.filter(p => !myPlayerIds.has(p.id)).length > 0 && (
                     // Only split if we have local AND remote players
                    players.filter(p => myPlayerIds.has(p.id)).map(p => renderPlayerCard(p, players.indexOf(p)))
                )}
                
                {myPlayers.length > 0 && players.filter(p => !myPlayerIds.has(p.id)).length > 0 && (
                     <div className="flex items-center gap-3 py-1 opacity-50">
                        <div className="h-px bg-slate-600 flex-1"></div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Remote Players</span>
                        <div className="h-px bg-slate-600 flex-1"></div>
                    </div>
                )}
                
                {/* 
                   Fallback logic: if we don't have the split scenario, 
                   or just for the rest of the players
                */}
                {players.map((p, i) => {
                   const isSplitView = myPlayers.length > 0 && players.length > myPlayers.length;
                   // If split view is active, skip the ones we already rendered
                   if (isSplitView && myPlayerIds.has(p.id)) return null;
                   return renderPlayerCard(p, i);
                })}
            </>
        )}
        
        {players.length === 0 && (
            <div className="text-center py-10 opacity-50">
                <p>No players added.</p>
            </div>
        )}
        
        {!isClient && !isEditMode && players.length > 0 && (
             <div className="text-center mt-8">
                 <p className="text-xs text-slate-600">Tip: Press and hold a player card to reorder, rename, or delete.</p>
             </div>
        )}
      </div>

      {/* Reset Confirmation Dialog */}
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

      {/* Delete Player Confirmation Dialog */}
      {playerToDelete && (
        <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-800 w-full max-w-xs rounded-2xl shadow-2xl border border-slate-700 p-6 flex flex-col justify-center">
                <h3 className="text-xl font-bold text-white mb-2">Remove Player?</h3>
                <p className="text-slate-400 mb-6 text-sm">
                    <span className="text-emerald-400 font-bold">{players.find(p => p.id === playerToDelete)?.name}</span> will be removed from the game.
                </p>
                <div className="grid grid-cols-2 gap-3">
                    <Button variant="secondary" onClick={() => setPlayerToDelete(null)}>
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={confirmDeletePlayer}>
                        Remove
                    </Button>
                </div>
            </div>
        </div>
      )}

      {/* Manual Entry Modal - Full Screen */}
      {manualEntryPlayerId && (
        <div 
          className="fixed top-0 left-0 right-0 z-[60] bg-felt-900 flex flex-col w-full md:max-w-md md:mx-auto md:border-x md:border-slate-800"
          style={{ height: viewportHeight }}
        >
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
        <div 
          className="fixed top-0 left-0 right-0 z-[60] bg-felt-900 flex flex-col w-full md:max-w-md md:mx-auto md:border-x md:border-slate-800"
          style={{ height: viewportHeight }}
        >
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
