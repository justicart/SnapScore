
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../Button';
import { IconX } from '../Icons';

interface ManualEntryModalProps {
  playerName?: string;
  initialScore?: string;
  isEdit?: boolean;
  onClose: () => void;
  onSave: (score: number) => void;
  isClient: boolean;
}

export const ManualEntryModal: React.FC<ManualEntryModalProps> = ({
  playerName,
  initialScore = '',
  isEdit = false,
  onClose,
  onSave,
  isClient
}) => {
  const [score, setScore] = useState<string>(initialScore);
  const manualInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (manualInputRef.current) {
      manualInputRef.current.select();
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const scoreValue = score === '' ? 0 : parseInt(score);
    if (!isNaN(scoreValue)) {
      onSave(scoreValue);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[60] bg-felt-900 flex flex-col w-full md:max-w-md md:mx-auto md:border-x md:border-slate-800"
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
        <h3 className="text-lg font-bold text-white">{isEdit ? 'Edit Score' : 'Add Score'}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white p-2 -mr-2 rounded-full">
          <IconX className="w-6 h-6" />
        </button>
      </div>

      {/* Content */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-center p-6 overflow-y-auto">
        <div className="text-center space-y-2 mb-8">
          <p className="text-slate-400 text-sm">Enter points for</p>
          <p className="text-2xl font-bold text-emerald-400">{playerName}</p>
        </div>
        
        <input
          ref={manualInputRef}
          type="number"
          value={score}
          onChange={(e) => setScore(e.target.value)}
          placeholder="0"
          autoFocus
          className="w-full bg-slate-900 border-2 border-slate-700 focus:border-emerald-500 rounded-2xl text-center text-6xl font-black text-white py-8 focus:outline-none transition-all shadow-inner"
        />
      </form>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/30 shrink-0 grid grid-cols-2 gap-4">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSubmit} className="bg-emerald-500 text-white">
          Save
        </Button>
      </div>
    </div>
  );
};
