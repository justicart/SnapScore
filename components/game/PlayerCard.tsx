
import React, { useRef } from 'react';
import { Player, CardSettings, Round } from '../../types';
import { IconCamera, IconPlus, IconStar, IconTrash } from '../Icons';
import { calculatePlayerTotal, calculateRoundScore } from '../../utils/scoringUtils';

interface PlayerCardProps {
  player: Player;
  index: number;
  totalPlayers: number;
  settings: CardSettings;
  isEditMode: boolean;
  isWinner: boolean;
  onMove?: (index: number, direction: 'up' | 'down') => void;
  onNameChange?: (index: number, name: string) => void;
  onDelete?: (id: string) => void;
  onRequestScan: (playerId: string) => void;
  onManualEntry: (playerId: string) => void;
  onRoundClick: (round: Round, playerName: string, playerId: string, index: number) => void;
  onLongPress?: () => void;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({
  player,
  index,
  totalPlayers,
  settings,
  isEditMode,
  isWinner,
  onMove,
  onNameChange,
  onDelete,
  onRequestScan,
  onManualEntry,
  onRoundClick,
  onLongPress
}) => {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePressStart = () => {
    if (!onLongPress) return;
    pressTimer.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(50);
      onLongPress();
    }, 600);
  };

  const handlePressEnd = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  if (isEditMode) {
    return (
      <div className="bg-slate-800 rounded-xl p-3 shadow-lg border-2 border-dashed border-emerald-500/50 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 mr-2">
          <div className="flex flex-col gap-1 shrink-0">
            <button 
              onClick={(e) => { e.stopPropagation(); onMove?.(index, 'up'); }}
              disabled={index === 0}
              className="p-1 bg-slate-700 rounded disabled:opacity-30 text-emerald-400 z-10 relative hover:bg-slate-600"
            >
              <svg className="w-4 h-4 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onMove?.(index, 'down'); }}
              disabled={index === totalPlayers - 1}
              className="p-1 bg-slate-700 rounded disabled:opacity-30 text-emerald-400 z-10 relative hover:bg-slate-600"
            >
              <svg className="w-4 h-4 -rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
            </button>
          </div>
          <input 
            type="text"
            value={player.name}
            onChange={(e) => onNameChange?.(index, e.target.value)}
            className="bg-transparent border-b border-slate-600 focus:border-emerald-500 text-white font-bold text-lg focus:outline-none w-full min-w-0"
            placeholder="Player Name"
          />
        </div>
        <button 
          onClick={(e) => { 
            e.stopPropagation(); 
            onDelete?.(player.id); 
          }}
          className="p-3 bg-red-500/10 text-red-500 rounded-lg z-10 relative hover:bg-red-500/20 cursor-pointer"
        >
          <IconTrash className="w-6 h-6 pointer-events-none" />
        </button>
      </div>
    );
  }

  return (
    <div 
      className="bg-slate-800 rounded-xl p-3 shadow-lg border border-slate-700/50 relative overflow-hidden group select-none"
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={handlePressEnd}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      onTouchMove={handlePressEnd}
    >
      <div className="flex justify-between items-center mb-2 pointer-events-none">
        <h3 className="text-lg font-bold text-white truncate max-w-[180px] flex items-center gap-2">
          {player.name}
          {isWinner && <IconStar className="w-5 h-5 text-gold-400 drop-shadow-md animate-pulse-slow" />}
        </h3>
        <span className={`text-3xl font-black ${isWinner ? 'text-gold-400' : 'text-emerald-400'}`}>
          {calculatePlayerTotal(player, settings)}
        </span>
      </div>
      
      {/* History Snippet */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-1 text-xs text-slate-400 scrollbar-hide">
         {player.rounds.length === 0 && <span className="italic opacity-50">No rounds played</span>}
         {player.rounds.map((round, i) => (
             <button 
                key={round.id || i} 
                onClick={(e) => {
                    e.stopPropagation();
                    onRoundClick(round, player.name, player.id, i + 1);
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
                  onManualEntry(player.id);
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
