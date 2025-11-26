
import React from 'react';
import { IconSettings } from '../Icons';

interface GameHeaderProps {
  isEditMode: boolean;
  setIsEditMode: (value: boolean) => void;
  isClient: boolean;
  isConnected: boolean;
  playersCount: number;
  maxRounds: number;
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
  onOpenSettings,
  setShowLeaveConfirm,
  setShowNewGameConfirm
}) => {
  return (
    <header 
      className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800 p-4 sticky top-0 z-10 flex justify-between items-center transition-colors duration-300" 
      style={{ backgroundColor: isEditMode ? 'rgba(6, 78, 59, 0.9)' : undefined }}
    >
      <div>
        {isEditMode ? (
          <h1 className="text-xl font-bold text-white animate-pulse">Editing Roster</h1>
        ) : (
          <>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Scoreboard
              {isClient && (
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${isConnected ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">{isConnected ? 'Online' : 'Offline'}</span>
                </div>
              )}
            </h1>
            <p className="text-xs text-slate-400">
              Round {Math.max(1, maxRounds) + (playersCount > 0 && maxRounds > 0 ? 0 : 1)}
            </p>
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
            {isClient ? (
              <button 
                onClick={() => setShowLeaveConfirm(true)} 
                className="text-xs font-bold text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded mr-1 border border-slate-700"
              >
                Leave Game
              </button>
            ) : (
              <button 
                onClick={() => setShowNewGameConfirm(true)} 
                className="text-xs font-bold text-emerald-400 hover:text-white px-2 py-1 bg-emerald-500/10 rounded mr-1 border border-emerald-500/20 hover:bg-emerald-500/20"
              >
                New Game
              </button>
            )}
            
            <button 
              onClick={onOpenSettings} 
              className="p-2 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              <IconSettings className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
    </header>
  );
};
