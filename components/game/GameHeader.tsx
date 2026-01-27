import React from 'react';
import { IconSettings } from '../Icons';
import { CardSettings } from '../../types';

interface GameHeaderProps {
  isEditMode: boolean;
  setIsEditMode: (value: boolean) => void;
  isClient: boolean;
  isConnected: boolean;
  playersCount: number;
  maxRounds: number;
  settings: CardSettings;
  onLeave: () => void;
  onNewGame: () => void;
  onOpenSettings: () => void;
  setShowLeaveConfirm: (value: boolean) => void;
  setShowNewGameConfirm: (value: boolean) => void;
}

export const GameHeader: React.FC<GameHeaderProps> = ({
  isEditMode,
  setIsEditMode,
  isClient,
  isConnected,
  playersCount,
  maxRounds,
  settings,
  onOpenSettings,
  setShowLeaveConfirm,
  setShowNewGameConfirm
}) => {
  const getPresetName = (p: string) => {
    if (p === 'flip7') return 'Flip 7';
    if (p === 'gnoming_around') return 'Gnoming Around';
    return 'Standard';
  };

  return (
    <header 
      className="bg-surface-dark/50 backdrop-blur-md border-b border-surface p-4 sticky top-0 z-10 flex justify-between items-center transition-colors duration-300" 
      style={{ backgroundColor: isEditMode ? 'rgba(6, 78, 59, 0.9)' : undefined }}
    >
      <div>
        {isEditMode ? (
          <h1 className="text-xl font-bold text-white animate-pulse">Editing roster</h1>
        ) : (
          <>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Scoreboard
              {isClient && (
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${isConnected ? 'bg-primary/10 border-primary/20 text-primary-soft' : 'bg-danger/10 border-danger/20 text-danger-soft'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-primary animate-pulse' : 'bg-danger'}`} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">{isConnected ? 'Online' : 'Offline'}</span>
                </div>
              )}
            </h1>
            <p className="text-xs text-ink-muted">
              {getPresetName(settings.preset)} • Round {Math.max(1, maxRounds) + (playersCount > 0 && maxRounds > 0 ? 0 : 1)}
            </p>
          </>
        )}
      </div>
      <div className="flex gap-2">
        {isEditMode ? (
          <button 
            onClick={() => setIsEditMode(false)}
            className="bg-white text-primary-deep px-4 py-2 rounded-full font-bold text-sm shadow-lg"
          >
            Done
          </button>
        ) : (
          <>
            {isClient ? (
              <button 
                onClick={() => setShowLeaveConfirm(true)} 
                className="text-xs font-bold text-ink-muted hover:text-white px-2 py-1 bg-surface rounded mr-1 border border-surface-highlight"
              >
                Leave game
              </button>
            ) : (
              <button 
                onClick={() => setShowNewGameConfirm(true)} 
                className="text-xs font-bold text-primary-soft hover:text-white px-2 py-1 bg-primary/10 rounded mr-1 border border-primary/20 hover:bg-primary/20"
              >
                New game
              </button>
            )}
            
            <button 
              onClick={onOpenSettings} 
              className="p-2 rounded-full bg-surface text-ink-muted hover:bg-surface-highlight"
            >
              <IconSettings className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
    </header>
  );
};