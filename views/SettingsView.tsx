
import React, { useState } from 'react';
import { CardSettings } from '../types';
import { Button } from '../components/Button';
import { IconChevronLeft } from '../components/Icons';

interface SettingsViewProps {
  settings: CardSettings;
  onSave: (settings: CardSettings) => void;
  onCancel: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onSave, onCancel }) => {
  const [formData, setFormData] = useState<CardSettings>(settings);

  const handleChange = (field: keyof CardSettings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="flex flex-col h-full bg-felt-900">
      <div className="flex items-center p-4 bg-slate-800 shadow-sm">
        <button onClick={onCancel} className="p-2 -ml-2 text-slate-400 hover:text-white">
          <IconChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="text-lg font-bold ml-2">Scoring Rules</h2>
      </div>

      <div className="p-6 space-y-6 overflow-y-auto flex-1">
        
        {/* Winning Condition */}
        <div className="space-y-2">
            <label className="block text-sm font-medium text-emerald-400 uppercase tracking-wider">Winning Condition</label>
            <div className="flex gap-2 p-1 bg-slate-800 rounded-lg">
                <button
                type="button"
                onClick={() => handleChange('winningScoreType', 'lowest')}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                    formData.winningScoreType === 'lowest' 
                    ? 'bg-emerald-600 text-white shadow-lg' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                >
                Lowest Score
                </button>
                <button
                type="button"
                onClick={() => handleChange('winningScoreType', 'highest')}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                    formData.winningScoreType === 'highest' 
                    ? 'bg-emerald-600 text-white shadow-lg' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                >
                Highest Score
                </button>
            </div>
            <p className="text-xs text-slate-500">
                {formData.winningScoreType === 'lowest' 
                ? 'The player with the fewest points wins (e.g. Golf).' 
                : 'The player with the most points wins.'}
            </p>
        </div>

        {/* Number Cards */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-emerald-400 uppercase tracking-wider">Number Cards (2-10)</label>
          <div className="flex gap-2 p-1 bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => handleChange('numberCardBehavior', 'face')}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                formData.numberCardBehavior === 'face' 
                  ? 'bg-emerald-600 text-white shadow-lg' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Face Value
            </button>
            <button
              type="button"
              onClick={() => handleChange('numberCardBehavior', 'fixed')}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                formData.numberCardBehavior === 'fixed' 
                  ? 'bg-emerald-600 text-white shadow-lg' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Fixed Value
            </button>
          </div>
          
          {formData.numberCardBehavior === 'fixed' && (
            <div className="mt-2">
               <label className="text-xs text-slate-400">Points per number card</label>
               <input 
                 type="number" 
                 value={formData.fixedNumberValue || 5}
                 onChange={(e) => handleChange('fixedNumberValue', parseInt(e.target.value))}
                 className="w-full mt-1 bg-slate-800 border border-slate-700 rounded px-3 py-2"
               />
            </div>
          )}
          <p className="text-xs text-slate-500">
            {formData.numberCardBehavior === 'face' 
              ? 'Example: A 5 of Hearts is worth 5 points.' 
              : `Example: Any number card is worth ${formData.fixedNumberValue || 5} points.`}
          </p>
        </div>

        {/* Face Cards */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-emerald-400 uppercase tracking-wider">Face Cards (K, Q, J)</label>
          <div className="flex gap-2 p-1 bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => handleChange('faceCardBehavior', 'face')}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                formData.faceCardBehavior === 'face' 
                  ? 'bg-emerald-600 text-white shadow-lg' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Face Value
            </button>
            <button
              type="button"
              onClick={() => handleChange('faceCardBehavior', 'fixed')}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                formData.faceCardBehavior === 'fixed' 
                  ? 'bg-emerald-600 text-white shadow-lg' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Fixed Value
            </button>
          </div>

          {formData.faceCardBehavior === 'fixed' && (
             <div className="mt-2">
               <label className="text-xs text-slate-400">Points per face card</label>
               <div className="flex items-center gap-4 bg-slate-800 p-4 rounded-lg border border-slate-700 mt-1">
                 <span className="text-2xl font-bold text-slate-200">{formData.fixedFaceValue || 10}</span>
                 <input 
                   type="range" 
                   min="0" 
                   max="50" 
                   step="1"
                   value={formData.fixedFaceValue || 10}
                   onChange={(e) => handleChange('fixedFaceValue', parseInt(e.target.value))}
                   className="flex-1 accent-emerald-500 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                 />
                 <span className="text-sm text-slate-400 w-12 text-right">Points</span>
               </div>
            </div>
          )}
          <p className="text-xs text-slate-500 mt-1">
            {formData.faceCardBehavior === 'face' 
              ? 'Jack = 11, Queen = 12, King = 13.' 
              : `Example: Any King, Queen, or Jack is worth ${formData.fixedFaceValue || 10} points.`}
          </p>
        </div>

        {/* Aces */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-emerald-400 uppercase tracking-wider">Aces</label>
          <div className="flex items-center gap-4 bg-slate-800 p-4 rounded-lg border border-slate-700">
            <span className="text-2xl font-bold text-slate-200">{formData.aceValue}</span>
            <input 
              type="range" 
              min="0" 
              max="50" 
              step="1"
              value={formData.aceValue}
              onChange={(e) => handleChange('aceValue', parseInt(e.target.value))}
              className="flex-1 accent-emerald-500 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-sm text-slate-400 w-12 text-right">Points</span>
          </div>
        </div>

        {/* Jokers */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-emerald-400 uppercase tracking-wider">Jokers</label>
          <div className="flex items-center gap-4 bg-slate-800 p-4 rounded-lg border border-slate-700">
            <span className="text-2xl font-bold text-slate-200">{formData.jokerValue}</span>
            <input 
              type="range" 
              min="0" 
              max="100" 
              step="5"
              value={formData.jokerValue}
              onChange={(e) => handleChange('jokerValue', parseInt(e.target.value))}
              className="flex-1 accent-emerald-500 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-sm text-slate-400 w-12 text-right">Points</span>
          </div>
        </div>

      </div>

      <div className="p-4 border-t border-slate-800 bg-felt-900">
        <Button fullWidth onClick={() => onSave(formData)}>
          Save Rules
        </Button>
      </div>
    </div>
  );
};
