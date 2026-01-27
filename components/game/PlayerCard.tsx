import React, { useRef, useEffect } from 'react';
import { Player, CardSettings, Round } from '../../types';
import { IconCamera, IconPlus, IconStar, IconTrash } from '../Icons';
import { calculatePlayerTotal, calculateRoundScore, getGnomingBreakdown } from '../../utils/scoringUtils';

interface PlayerCardProps {
  player: Player;
  players: Player[];
  index: number;
  totalPlayers: number;
  settings: CardSettings;
  maxRounds: number;
  isEditMode: boolean;
  isWinner: boolean;
  onMove?: (index: number, direction: 'up' | 'down') => void;
  onNameChange?: (index: number, name: string) => void;
  onDelete?: (id: string) => void;
  onRequestScan: (playerId: string, roundId?: string, index?: number) => void;
  onManualEntry: (playerId: string, roundId?: string, initialScore?: number, index?: number) => void;
  onQuickZero?: (playerId: string, index?: number) => void;
  onRoundClick: (round: Round, playerName: string, playerId: string, index: number) => void;
  onLongPress?: () => void;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({
  player,
  players,
  index,
  totalPlayers,
  settings,
  maxRounds,
  isEditMode,
  isWinner,
  onMove,
  onNameChange,
  onDelete,
  onRequestScan,
  onManualEntry,
  onQuickZero,
  onRoundClick,
  onLongPress
}) => {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the end of the round list when a new round is added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        left: scrollRef.current.scrollWidth,
        behavior: 'smooth'
      });
    }
  }, [player.rounds.length, maxRounds]);

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
      <div className="bg-surface rounded-xl p-3 shadow-lg border-2 border-dashed border-primary/50 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 mr-2">
          <div className="flex flex-col gap-1 shrink-0">
            <button 
              onClick={(e) => { e.stopPropagation(); onMove?.(index, 'up'); }}
              disabled={index === 0}
              className="p-1 bg-surface-highlight rounded disabled:opacity-30 text-primary-soft z-10 relative hover:bg-surface-highlight/80"
            >
              <svg className="w-4 h-4 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onMove?.(index, 'down'); }}
              disabled={index === totalPlayers - 1}
              className="p-1 bg-surface-highlight rounded disabled:opacity-30 text-primary-soft z-10 relative hover:bg-surface-highlight/80"
            >
              <svg className="w-4 h-4 -rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
            </button>
          </div>
          <input 
            type="text"
            value={player.name}
            onChange={(e) => onNameChange?.(index, e.target.value)}
            className="bg-transparent border-b border-surface-highlight focus:border-primary text-white font-bold text-lg focus:outline-none w-full min-w-0"
            placeholder="Player name"
          />
        </div>
        <button 
          onClick={(e) => { 
            e.stopPropagation(); 
            onDelete?.(player.id); 
          }}
          className="p-3 bg-danger/10 text-danger rounded-lg z-10 relative hover:bg-danger/20 cursor-pointer"
        >
          <IconTrash className="w-6 h-6 pointer-events-none" />
        </button>
      </div>
    );
  }

  // Logic for the "Primary" action buttons (Scan, Manual, 0)
  const playerRoundsCount = player.rounds.length;
  const isBehind = maxRounds > 0 && playerRoundsCount < maxRounds;
  
  let targetIndex: number;
  if (maxRounds === 0) {
      targetIndex = 0;
  } else if (isBehind) {
      targetIndex = maxRounds - 1;
  } else {
      targetIndex = maxRounds;
  }

  const displayCount = Math.max(1, maxRounds, targetIndex + 1);

  return (
    <div 
      className={`bg-surface rounded-xl p-3 shadow-lg transition-all duration-300 relative overflow-hidden group select-none border ${
        isBehind 
          ? 'border-primary shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-primary/20' 
          : 'border-surface-highlight/50'
      }`}
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
          {isWinner && <IconStar className="w-5 h-5 text-accent drop-shadow-md animate-pulse-slow" />}
        </h3>
        <div className="text-right">
          <span className={`text-3xl font-black leading-none ${isWinner ? 'text-accent' : 'text-primary-soft'}`}>
            {calculatePlayerTotal(player, settings, players)}
          </span>
        </div>
      </div>
      
      {/* History Snippet with Placeholder Slots */}
      <div 
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-2 mb-1 text-xs text-ink-muted scrollbar-hide scroll-smooth"
      >
         {Array.from({ length: displayCount }).map((_, i) => {
             const round = player.rounds[i];
             const isTargetedSlot = i === targetIndex;

             if (round) {
                 let buttonClass = "w-8 h-7 flex items-center justify-center rounded border border-transparent transition-colors cursor-pointer shrink-0 font-bold ";
                 
                 // Handle specific coloring for Gnoming Around "Went Out First" bonus/penalty
                 let isBonus = false;
                 let isPenalty = false;
                 
                 if (settings.preset === 'gnoming_around' && round.type === 'scan' && round.wentOutFirst) {
                    const breakdown = getGnomingBreakdown(round.cards, round, players, i);
                    const mod = breakdown.modifiers.find(m => m.label.includes('Out First'));
                    if (mod) {
                        if (mod.value < 0) isBonus = true;
                        else if (mod.value > 0) isPenalty = true;
                    }
                 }

                 if (isBonus) {
                    buttonClass += "bg-primary/10 border-primary/30 text-primary-soft hover:bg-primary/20";
                 } else if (isPenalty) {
                    buttonClass += "bg-danger/10 border-danger/30 text-danger-soft hover:bg-danger/20";
                 } else {
                    buttonClass += "bg-surface-dark/50 hover:bg-surface-dark hover:text-primary-soft";
                 }

                 return (
                     <button 
                        key={round.id || i} 
                        onClick={(e) => {
                            e.stopPropagation();
                            onRoundClick(round, player.name, player.id, i + 1);
                        }}
                        className={buttonClass}
                     >
                       {calculateRoundScore(round, settings, players, i)}
                     </button>
                 );
             } else {
                 return (
                     <button 
                        key={`empty-${i}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            onManualEntry(player.id, undefined, undefined, i);
                        }}
                        className={`w-8 h-7 rounded flex items-center justify-center transition-all cursor-pointer shrink-0 border border-dashed ${
                            isTargetedSlot 
                            ? 'border-primary bg-primary/10 text-primary-soft shadow-[0_0_8px_rgba(16,185,129,0.3)] animate-pulse-slow' 
                            : 'border-surface-highlight bg-surface-dark/20 text-ink-subtle hover:border-primary/40 hover:bg-primary/5 hover:text-primary-soft'
                        }`}
                        title={`Enter score for Round ${i + 1}`}
                     >
                        <IconPlus className={`w-3 h-3 ${isTargetedSlot ? 'scale-110' : ''}`} />
                     </button>
                 );
             }
         })}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-1 relative z-10">
          <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                onRequestScan(player.id, undefined, targetIndex); 
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border transition-colors font-medium text-sm bg-primary/10 text-primary-soft hover:bg-primary/20 border-primary/20"
          >
              <IconCamera className="w-4 h-4" />
              Scan
          </button>
          
          <button 
              onClick={(e) => {
                  e.stopPropagation();
                  onManualEntry(player.id, undefined, undefined, targetIndex);
              }}
              className="flex-1 flex items-center justify-center gap-2 bg-surface-highlight text-ink-muted hover:bg-surface-highlight/80 py-2 rounded-lg transition-colors font-medium text-sm border border-surface-highlight/50"
          >
              <IconPlus className="w-4 h-4" />
              Manual
          </button>

          <button
              onClick={(e) => {
                  e.stopPropagation();
                  onQuickZero?.(player.id, targetIndex);
              }}
              className="w-11 flex items-center justify-center bg-surface-highlight text-primary-soft hover:bg-primary hover:text-white rounded-lg transition-colors font-black text-sm border border-surface-highlight/50"
              title="Add 0 points"
          >
              0
          </button>
      </div>
    </div>
  );
};