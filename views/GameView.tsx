
import React, { useState } from 'react';
import { Player, CardSettings, Round } from '../types';
import { Button } from '../components/Button';
import { calculatePlayerTotal, calculateRoundScore } from '../utils/scoringUtils';
import { v4 as uuidv4 } from 'uuid';

// Imported Components
import { GameHeader } from '../components/game/GameHeader';
import { PlayerCard } from '../components/game/PlayerCard';
import { RoundDetailsModal } from '../components/game/RoundDetailsModal';
import { ManualEntryModal } from '../components/game/ManualEntryModal';

interface GameViewProps {
  players: Player[];
  settings: CardSettings;
  onSaveRound: (playerId: string, round: Round) => void;
  onRequestScan: (playerId: string, roundId?: string) => void;
  onUpdatePlayers: (players: Player[]) => void;
  onOpenSettings: () => void;
  onNewGame: () => void; // Soft reset for Host/Solo
  onLeave: () => void;   // Leave for Client
  onOpenMultiplayer: () => void;
  isClient: boolean;
  isConnected?: boolean;
}

export const GameView: React.FC<GameViewProps> = ({ 
  players, 
  settings,
  onSaveRound, 
  onRequestScan,
  onUpdatePlayers,
  onOpenSettings,
  onNewGame,
  onLeave,
  onOpenMultiplayer,
  isClient,
  isConnected = true
}) => {
  const [manualEntryPlayerId, setManualEntryPlayerId] = useState<string | null>(null);
  const [manualEntryRoundId, setManualEntryRoundId] = useState<string | null>(null);
  const [manualScore, setManualScore] = useState<string>('');
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState<string | null>(null);
  
  // Roster Editing State
  const [isEditMode, setIsEditMode] = useState(false);
  
  // State for viewing round details
  const [activeRound, setActiveRound] = useState<Round | null>(null);
  const [activeRoundPlayerName, setActiveRoundPlayerName] = useState<string | null>(null);
  const [activeRoundPlayerId, setActiveRoundPlayerId] = useState<string | null>(null);
  const [activeRoundIndex, setActiveRoundIndex] = useState<number | null>(null);
  
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

  // Handlers for Manual Entry
  const openManualEntry = (playerId: string, roundId?: string, initialScore?: number) => {
    setManualEntryPlayerId(playerId);
    setManualEntryRoundId(roundId || null);
    setManualScore(initialScore !== undefined ? initialScore.toString() : '');
  };

  const handleManualSave = (scoreValue: number) => {
    if (manualEntryPlayerId) {
        const round: Round = {
            type: 'manual',
            id: manualEntryRoundId || uuidv4(),
            score: scoreValue,
            timestamp: Date.now()
        };
        onSaveRound(manualEntryPlayerId, round);
        setManualEntryPlayerId(null);
        setManualEntryRoundId(null);
        setManualScore('');
    }
  };

  // Handlers for Round Details
  const handleRoundSave = () => {
      if (activeRound && activeRoundPlayerId) {
          onSaveRound(activeRoundPlayerId, activeRound);
          setActiveRound(null);
      }
  };

  // Handlers for Roster Editing
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

  // Calculate winner
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

  // Helper to render PlayerCard with correct props
  const renderPlayerCardComponent = (player: Player, index: number) => (
      <PlayerCard
        key={player.id}
        player={player}
        index={index}
        totalPlayers={players.length}
        settings={settings}
        isEditMode={isEditMode}
        isWinner={winningPlayerIds.has(player.id)}
        onMove={movePlayer}
        onNameChange={handleNameChange}
        onDelete={setPlayerToDelete}
        onRequestScan={onRequestScan}
        onManualEntry={openManualEntry}
        onRoundClick={(round, pName, pId, rIndex) => {
            setActiveRound(round);
            setActiveRoundPlayerName(pName);
            setActiveRoundPlayerId(pId);
            setActiveRoundIndex(rIndex);
        }}
        onLongPress={isClient ? undefined : () => setIsEditMode(true)}
      />
  );
  
  return (
    <div className="flex flex-col h-full relative">
      <GameHeader
        isEditMode={isEditMode}
        setIsEditMode={setIsEditMode}
        isClient={isClient}
        isConnected={isConnected}
        playersCount={players.length}
        maxRounds={Math.max(0, ...players.map(p => p.rounds.length))}
        onLeave={onLeave}
        onNewGame={onNewGame}
        onOpenSettings={onOpenSettings}
        setShowLeaveConfirm={setShowLeaveConfirm}
        setShowNewGameConfirm={setShowNewGameConfirm}
      />

      {/* Player List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
        {/* If in edit mode, show simple list. If standard, show split list */}
        {isEditMode ? (
            players.map((p, i) => renderPlayerCardComponent(p, i))
        ) : (
            <>
                {myPlayers.length > 0 && players.filter(p => !myPlayerIds.has(p.id)).length > 0 && (
                     // Only split if we have local AND remote players
                    players.filter(p => myPlayerIds.has(p.id)).map(p => renderPlayerCardComponent(p, players.indexOf(p)))
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
                   return renderPlayerCardComponent(p, i);
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

      {/* New Game Confirmation Dialog */}
      {showNewGameConfirm && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-800 w-full max-w-xs rounded-2xl shadow-2xl border border-slate-700 p-6 flex flex-col justify-center">
                <h3 className="text-xl font-bold text-white mb-2">Start New Game?</h3>
                <p className="text-slate-400 mb-6 text-sm">
                    Current scores will be cleared, but players and settings will be kept.
                </p>
                <div className="grid grid-cols-2 gap-3">
                    <Button variant="secondary" onClick={() => setShowNewGameConfirm(false)}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={() => {
                        onNewGame();
                        setShowNewGameConfirm(false);
                    }}>
                        New Game
                    </Button>
                </div>
            </div>
        </div>
      )}

      {/* Leave Game Confirmation Dialog */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-800 w-full max-w-xs rounded-2xl shadow-2xl border border-slate-700 p-6 flex flex-col justify-center">
                <h3 className="text-xl font-bold text-white mb-2">Leave Game?</h3>
                <p className="text-slate-400 mb-6 text-sm">
                    You will disconnect from the session.
                </p>
                <div className="grid grid-cols-2 gap-3">
                    <Button variant="secondary" onClick={() => setShowLeaveConfirm(false)}>
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={() => {
                        onLeave();
                        setShowLeaveConfirm(false);
                    }}>
                        Leave
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

      {/* Manual Entry Modal */}
      {manualEntryPlayerId && (
        <ManualEntryModal
          playerName={players.find(p => p.id === manualEntryPlayerId)?.name}
          initialScore={manualScore}
          isEdit={!!manualEntryRoundId}
          onClose={() => { setManualEntryPlayerId(null); setManualEntryRoundId(null); }}
          onSave={handleManualSave}
          isClient={isClient}
        />
      )}

      {/* Round Details Modal */}
      {activeRound && (
        <RoundDetailsModal
          round={activeRound}
          playerName={activeRoundPlayerName}
          playerId={activeRoundPlayerId}
          roundIndex={activeRoundIndex}
          settings={settings}
          onChange={setActiveRound}
          onSave={handleRoundSave}
          onClose={() => setActiveRound(null)}
          onRequestScan={() => {
              if (activeRoundPlayerId && activeRound) {
                  onRequestScan(activeRoundPlayerId, activeRound.id);
                  setActiveRound(null);
              }
          }}
          onEditScoreManual={() => {
              if (activeRoundPlayerId && activeRound) {
                  openManualEntry(activeRoundPlayerId, activeRound.id, calculateRoundScore(activeRound, settings));
                  setActiveRound(null);
              }
          }}
        />
      )}
    </div>
  );
};
