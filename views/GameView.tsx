import React, { useState } from 'react';
import { Player } from '../types';
import { Button } from '../components/Button';
import { IconSettings, IconCamera, IconPlus, IconX, IconQrCode } from '../components/Icons';

interface GameViewProps {
  players: Player[];
  onScoreUpdate: (playerId: string, score: number) => void;
  onRequestScan: (playerId: string) => void;
  onOpenSettings: () => void;
  onReset: () => void;
  onOpenMultiplayer: () => void;
  isClient: boolean;
}

export const GameView: React.FC<GameViewProps> = ({ 
  players, 
  onScoreUpdate, 
  onRequestScan,
  onOpenSettings,
  onReset,
  onOpenMultiplayer,
  isClient
}) => {
  const [manualEntryPlayerId, setManualEntryPlayerId] = useState<string | null>(null);
  const [manualScore, setManualScore] = useState<string>('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualEntryPlayerId && manualScore !== '' && !isNaN(parseInt(manualScore))) {
        onScoreUpdate(manualEntryPlayerId, parseInt(manualScore));
        setManualEntryPlayerId(null);
        setManualScore('');
    }
  };

  const activePlayerName = players.find(p => p.id === manualEntryPlayerId)?.name;
  
  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <header className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800 p-4 sticky top-0 z-10 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
             Scoreboard
             {isClient && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30">JOINED</span>}
          </h1>
          <p className="text-xs text-slate-400">Round {players[0]?.history.length + 1 || 1}</p>
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
        {players.map((player) => (
          <div key={player.id} className="bg-slate-800 rounded-xl p-4 shadow-lg border border-slate-700/50 relative overflow-hidden group">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-bold text-white truncate max-w-[120px]">{player.name}</h3>
              <div className="text-right">
                <span className="text-3xl font-black text-emerald-400">{player.score}</span>
                <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Total Pts</div>
              </div>
            </div>
            
            {/* History Snippet */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-2 text-xs text-slate-400 scrollbar-hide">
               {player.history.length === 0 && <span className="italic opacity-50">No rounds played</span>}
               {player.history.map((s, i) => (
                   <span key={i} className="bg-slate-900/50 px-2 py-1 rounded">{s}</span>
               ))}
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 mt-2">
                <button 
                    onClick={() => onRequestScan(player.id)}
                    className="flex items-center justify-center gap-2 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20 py-2 rounded-lg border border-emerald-600/20 transition-colors font-medium text-sm"
                >
                    <IconCamera className="w-4 h-4" />
                    Scan Hand
                </button>
                <button 
                     onClick={() => {
                        setManualEntryPlayerId(player.id);
                        setManualScore('');
                     }}
                    className="flex items-center justify-center gap-2 bg-slate-700 text-slate-300 hover:bg-slate-600 py-2 rounded-lg transition-colors font-medium text-sm"
                >
                    <IconPlus className="w-4 h-4" />
                    Manual
                </button>
            </div>
          </div>
        ))}
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-800 w-full max-w-sm rounded-2xl shadow-2xl border border-slate-700 p-6 animate-pulse-fast">
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

      {/* Manual Entry Modal */}
      {manualEntryPlayerId && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-800 w-full max-w-sm rounded-2xl shadow-2xl border border-slate-700 overflow-hidden animate-pulse-fast">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                    <h3 className="text-lg font-bold text-white">Add Score</h3>
                    <button onClick={() => setManualEntryPlayerId(null)} className="text-slate-400 hover:text-white">
                        <IconX className="w-6 h-6" />
                    </button>
                </div>
                <form onSubmit={handleManualSubmit} className="p-6 space-y-6">
                    <div className="text-center">
                        <p className="text-slate-400 text-sm mb-2">Enter points for</p>
                        <p className="text-xl font-bold text-emerald-400">{activePlayerName}</p>
                    </div>
                    
                    <input
                        type="number"
                        value={manualScore}
                        onChange={(e) => setManualScore(e.target.value)}
                        placeholder="0"
                        autoFocus
                        className="w-full bg-slate-900 border-2 border-slate-700 focus:border-emerald-500 rounded-xl text-center text-4xl font-bold text-white py-4 focus:outline-none transition-colors"
                    />

                    <div className="grid grid-cols-2 gap-3">
                        <Button type="button" variant="secondary" onClick={() => setManualEntryPlayerId(null)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!manualScore}>
                            {isClient ? 'Send Request' : 'Save'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};