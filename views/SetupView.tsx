
import React, { useState, useRef, useEffect } from 'react';
import { Player, CardSettings } from '../types';
import { Button } from '../components/Button';
import { IconTrash, IconSettings, IconPlus, IconQrCode, IconCheck } from '../components/Icons';
import { v4 as uuidv4 } from 'uuid';
import { calculatePlayerTotal } from '../utils/scoringUtils';

interface SetupViewProps {
  onStart: (players: Player[]) => void;
  onOpenSettings: () => void;
  onOpenMultiplayer: () => void;
  isClient: boolean;
  players: Player[]; // existing roster
}

export const SetupView: React.FC<SetupViewProps> = ({ 
  onStart, 
  onOpenSettings, 
  onOpenMultiplayer,
  isClient,
  players
}) => {
  const [names, setNames] = useState<string[]>(['']);
  const [joined, setJoined] = useState(false);
  const [lastGame, setLastGame] = useState<{players: Player[], settings: CardSettings, timestamp: number} | null>(null);
  
  // Refs for auto-focusing new inputs
  const lastInputRef = useRef<HTMLInputElement>(null);
  const prevNamesLength = useRef(names.length);

  // Load last game history
  useEffect(() => {
      const stored = localStorage.getItem('snapscore_last_game');
      if (stored) {
          try {
              setLastGame(JSON.parse(stored));
          } catch (e) {
              console.error("Failed to parse last game", e);
          }
      }
  }, []);

  // Focus the last input when a new player is added
  useEffect(() => {
    if (names.length > prevNamesLength.current) {
      lastInputRef.current?.focus();
    }
    prevNamesLength.current = names.length;
  }, [names.length]);
  
  const handleNameChange = (index: number, value: string) => {
    const newNames = [...names];
    newNames[index] = value;
    setNames(newNames);
  };

  const addPlayer = () => {
    setNames([...names, '']);
  };

  const removePlayer = (index: number) => {
    if (names.length > 1) {
      const newNames = names.filter((_, i) => i !== index);
      setNames(newNames);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    // Check for Tab press on the last input
    if (e.key === 'Tab' && !e.shiftKey && index === names.length - 1) {
      // Only add if the current field has text to prevent infinite empty loops
      if (names[index].trim() !== '') {
        e.preventDefault();
        addPlayer();
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const validPlayers: Player[] = names
      .map(name => name.trim())
      .filter(name => name.length > 0)
      .map(name => ({
        id: uuidv4(),
        name,
        rounds: []
      }));

    // Track locally created players
    if (validPlayers.length > 0) {
      try {
        const stored = localStorage.getItem('snapscore_my_player_ids');
        const existing = stored ? JSON.parse(stored) : [];
        const newIds = validPlayers.map(p => p.id);
        localStorage.setItem('snapscore_my_player_ids', JSON.stringify([...existing, ...newIds]));
      } catch (err) {
        console.error("Failed to save player ownership", err);
      }
    }

    if (isClient) {
        // Client: Send players to host if any are typed
        if (validPlayers.length > 0) {
            onStart(validPlayers);
            setNames(['']); // Reset form
            setJoined(true);
            // Clear "Joined" message after a delay
            setTimeout(() => setJoined(false), 3000);
        }
    } else {
        // Host: Start game if we have players (either in roster or new inputs)
        if (validPlayers.length > 0 || players.length > 0) {
            onStart(validPlayers);
        }
    }
  };

  // Determine if submit button should be disabled
  const hasInput = names.some(n => n.trim().length > 0);
  const canSubmit = isClient ? hasInput : (hasInput || players.length > 0);

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="flex justify-between items-center px-6 pt-6 pb-4 shrink-0">
        <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">SnapScore</h1>
            {isClient && <span className="text-xs text-emerald-400 font-bold tracking-wider uppercase">Joined Lobby</span>}
        </div>
        <div className="flex gap-2">
            <button 
                onClick={onOpenSettings}
                className="p-2 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
            >
                <IconSettings className="w-6 h-6" />
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-8">
        
        {/* Existing Roster (Host & Client see this) */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs text-slate-500 uppercase font-bold">Current Roster ({players.length})</h3>
                <div className="flex items-center gap-2">
                    {isClient && players.length === 0 && <span className="animate-pulse w-2 h-2 bg-emerald-500 rounded-full"></span>}
                    {!isClient && (
                        <button 
                            onClick={onOpenMultiplayer}
                            className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                        >
                            <IconQrCode className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>
            
            {players.length === 0 ? (
                <div className="text-center py-4">
                    <p className="text-slate-500 italic text-sm">No players joined yet.</p>
                    {isClient && <p className="text-slate-600 text-xs mt-1">Waiting for host or you to add players...</p>}
                </div>
            ) : (
                <ul className="space-y-2">
                    {players.map(p => (
                        <li key={p.id} className="text-white font-medium flex items-center gap-3 bg-slate-900/50 p-2 rounded-lg">
                            <div className="w-8 h-8 bg-emerald-900 text-emerald-400 rounded-full flex items-center justify-center text-sm font-bold">
                                {p.name.charAt(0).toUpperCase()}
                            </div>
                            {p.name}
                        </li>
                    ))}
                </ul>
            )}
        </div>

        {/* Add Player Form */}
        <div className="pb-2"> {/* Extra padding for focus rings */}
            <h2 className="text-xl text-emerald-400 font-semibold mb-4">
                {isClient ? "Join Game" : "Add Players"}
            </h2>
            <p className="text-xs text-slate-400 mb-3">
                {isClient 
                    ? "Enter your name (and friends) to join the roster." 
                    : "Enter local players or wait for friends to join via QR code."
                }
            </p>

            <form id="setup-form" onSubmit={handleSubmit} className="space-y-3">
            {names.map((name, index) => (
                <div key={index} className="flex gap-2 group">
                <input
                    ref={index === names.length - 1 ? lastInputRef : null}
                    type="text"
                    value={name}
                    onChange={(e) => handleNameChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    placeholder={isClient ? "Your Name" : `Player ${players.length + index + 1} Name`}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow"
                    autoFocus={index === 0 && names.length === 1}
                />
                {names.length > 1 && (
                    <button
                    type="button"
                    onClick={() => removePlayer(index)}
                    className="p-3 text-slate-400 hover:text-red-400 transition-colors"
                    >
                    <IconTrash className="w-5 h-5" />
                    </button>
                )}
                </div>
            ))}
            
            <Button 
                type="button" 
                variant="secondary" 
                fullWidth 
                onClick={addPlayer}
                className="mt-4 border-dashed border-2 border-slate-600 bg-transparent hover:border-slate-500"
            >
                <IconPlus className="w-5 h-5 mr-2" />
                Add Another
            </Button>
            </form>
        </div>

        {/* Last Game Section */}
        {lastGame && (
            <div className="pt-6 border-t border-slate-800">
                <h3 className="text-xs text-slate-500 uppercase font-bold mb-3">Last Game Results</h3>
                <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                    <div className="flex justify-between text-xs text-slate-500 mb-2">
                        <span>{new Date(lastGame.timestamp).toLocaleDateString()}</span>
                        <span>{new Date(lastGame.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    <ul className="space-y-2">
                        {lastGame.players
                            .map(p => ({...p, score: calculatePlayerTotal(p, lastGame.settings)}))
                            .sort((a, b) => {
                                // Sort based on winning condition
                                if (lastGame.settings.winningScoreType === 'highest') return b.score - a.score;
                                return a.score - b.score;
                            })
                            .map((p, i) => (
                            <li key={p.id} className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${i === 0 ? 'bg-gold-500/20 text-gold-400' : 'bg-slate-700 text-slate-400'}`}>
                                        {i + 1}
                                    </span>
                                    <span className="text-slate-300 text-sm">{p.name}</span>
                                </div>
                                <span className={`font-mono font-bold ${i === 0 ? 'text-gold-400' : 'text-slate-400'}`}>
                                    {p.score}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        )}
      </div>

      <div className="p-6 border-t border-slate-800 bg-felt-900 shrink-0 z-10">
        {isClient && joined && (
            <div className="mb-4 p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-lg flex items-center gap-2 text-emerald-400 text-sm">
                <IconCheck className="w-5 h-5" />
                <span>Joined successfully! Waiting for host...</span>
            </div>
        )}

        <Button 
          type="submit" 
          form="setup-form" 
          fullWidth 
          disabled={!canSubmit}
          variant={isClient ? "secondary" : "primary"}
        >
          {isClient ? "Join Roster" : "Start Game"}
        </Button>
        
        {isClient && players.length > 0 && !hasInput && (
            <p className="text-center text-xs text-slate-500 mt-4 animate-pulse">
                Host will start the game soon...
            </p>
        )}
      </div>
    </div>
  );
};
