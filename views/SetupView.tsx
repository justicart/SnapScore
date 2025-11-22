
import React, { useState } from 'react';
import { Player } from '../types';
import { Button } from '../components/Button';
import { IconTrash, IconSettings, IconPlus, IconQrCode } from '../components/Icons';
import { v4 as uuidv4 } from 'uuid';

interface SetupViewProps {
  onStart: (players: Player[]) => void;
  onOpenSettings: () => void;
  onOpenMultiplayer: () => void;
}

export const SetupView: React.FC<SetupViewProps> = ({ onStart, onOpenSettings, onOpenMultiplayer }) => {
  const [names, setNames] = useState<string[]>(['']);
  
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

    if (validPlayers.length > 0) {
      onStart(validPlayers);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">SnapScore</h1>
        <div className="flex gap-2">
            <button 
                onClick={onOpenMultiplayer}
                className="p-2 rounded-full bg-slate-800 text-emerald-400 hover:bg-slate-700 transition-colors"
            >
                <IconQrCode className="w-6 h-6" />
            </button>
            <button 
                onClick={onOpenSettings}
                className="p-2 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
            >
                <IconSettings className="w-6 h-6" />
            </button>
        </div>
      </div>

      <div className="flex-1">
        <h2 className="text-xl text-emerald-400 font-semibold mb-4">Add Players</h2>
        <form id="setup-form" onSubmit={handleSubmit} className="space-y-3">
          {names.map((name, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(index, e.target.value)}
                placeholder={`Player ${index + 1} Name`}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                autoFocus={index === names.length - 1 && index > 0}
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
            className="mt-4 border-dashed border-2 border-slate-600 bg-transparent"
          >
            <IconPlus className="w-5 h-5 mr-2" />
            Add Player
          </Button>
        </form>
      </div>

      <div className="mt-8 pt-6 border-t border-slate-800">
        <Button 
          type="submit" 
          form="setup-form" 
          fullWidth 
          disabled={names.filter(n => n.trim()).length === 0}
        >
          Start Game
        </Button>
      </div>
    </div>
  );
};
