
import React, { useState } from 'react';
import { CardSettings, GamePreset } from '../types';
import { Button } from '../components/Button';
import { IconChevronLeft, IconStar, IconCheck } from '../components/Icons';

interface SettingsViewProps {
  settings: CardSettings;
  onSave: (settings: CardSettings) => void;
  onCancel: () => void;
  isClient?: boolean;
  onLeave?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onSave, onCancel, isClient, onLeave }) => {
  const [formData, setFormData] = useState<CardSettings>(settings);

  const handleChange = (field: keyof CardSettings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const selectPreset = (p: GamePreset) => {
    let newSettings: CardSettings = { ...formData, preset: p };
    
    if (p === 'flip7') {
        newSettings.winningScoreType = 'highest';
    } else if (p === 'gnoming_around') {
        newSettings.winningScoreType = 'lowest';
    } else {
        newSettings.winningScoreType = 'lowest';
    }
    
    setFormData(newSettings);
  };

  return (
    <div className="flex flex-col h-full bg-felt-900">
      <div className="flex items-center p-4 bg-slate-800 shadow-sm">
        <button onClick={onCancel} className="p-2 -ml-2 text-slate-400 hover:text-white">
          <IconChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="text-lg font-bold ml-2">Game Rules</h2>
      </div>

      <div className="p-6 space-y-10 overflow-y-auto flex-1">
        
        {/* Presets */}
        <div className="space-y-3">
            <label className="block text-sm font-medium text-emerald-400 uppercase tracking-widest">Game Preset</label>
            <div className="grid grid-cols-1 gap-2">
                {[
                    { id: 'standard', name: 'Standard / Custom', desc: 'Manual scoring sliders.' },
                    { id: 'flip7', name: 'Flip 7', desc: 'Additive (+X) & Multiplier (xX) cards.' },
                    { id: 'gnoming_around', name: 'Gnoming Around', desc: '3x3 Grid sets, Star wilds, X hazards.' }
                ].map((p) => (
                    <button
                        key={p.id}
                        onClick={() => selectPreset(p.id as GamePreset)}
                        className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all ${
                            formData.preset === p.id 
                            ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
                            : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                        }`}
                    >
                        <div className="flex justify-between w-full items-center mb-1">
                            <span className={`font-bold ${formData.preset === p.id ? 'text-white' : 'text-slate-200'}`}>{p.name}</span>
                            {formData.preset === p.id && <IconCheck className="w-5 h-5 text-emerald-400" />}
                        </div>
                        <span className="text-xs text-slate-500 text-left leading-tight">{p.desc}</span>
                    </button>
                ))}
            </div>
        </div>

        {formData.preset === 'standard' ? (
            <div className="space-y-6 animate-in fade-in duration-500">
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
                        <div className="mt-2 bg-slate-800 p-3 rounded-lg border border-slate-700">
                        <input 
                            type="number" 
                            value={formData.fixedNumberValue || 5}
                            onChange={(e) => handleChange('fixedNumberValue', parseInt(e.target.value))}
                            className="w-full bg-transparent text-white font-bold text-center text-xl outline-none"
                        />
                        </div>
                    )}
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
                        <div className="mt-2 bg-slate-800 p-4 rounded-lg border border-slate-700 flex items-center gap-4">
                            <span className="text-2xl font-black text-emerald-400 w-10">{formData.fixedFaceValue || 10}</span>
                            <input 
                                type="range" min="0" max="50" step="1"
                                value={formData.fixedFaceValue || 10}
                                onChange={(e) => handleChange('fixedFaceValue', parseInt(e.target.value))}
                                className="flex-1 accent-emerald-500 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                    )}
                </div>

                {/* Aces */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-emerald-400 uppercase tracking-wider">Aces</label>
                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex items-center gap-4">
                        <span className="text-2xl font-black text-emerald-400 w-10">{formData.aceValue}</span>
                        <input 
                            type="range" min="0" max="50" step="1"
                            value={formData.aceValue}
                            onChange={(e) => handleChange('aceValue', parseInt(e.target.value))}
                            className="flex-1 accent-emerald-500 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                </div>

                {/* Jokers */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-emerald-400 uppercase tracking-wider">Jokers</label>
                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex items-center gap-4">
                        <span className="text-2xl font-black text-emerald-400 w-10">{formData.jokerValue}</span>
                        <input 
                            type="range" min="0" max="100" step="5"
                            value={formData.jokerValue}
                            onChange={(e) => handleChange('jokerValue', parseInt(e.target.value))}
                            className="flex-1 accent-emerald-500 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                </div>
            </div>
        ) : (
            <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-2 text-emerald-400 mb-2">
                    <IconStar className="w-5 h-5" />
                    <span className="font-bold uppercase tracking-widest text-sm">Preset Active</span>
                </div>
                <p className="text-slate-400 text-sm leading-snug">
                    Preset rules for <span className="text-white font-bold">{formData.preset === 'flip7' ? 'Flip 7' : 'Gnoming Around'}</span> are automatically applied. Manual scoring overrides are disabled to ensure mathematical accuracy.
                </p>
            </div>
        )}

        <hr className="border-slate-800" />

        {/* Advanced AI Toggle (Moved to bottom) */}
        <div className="space-y-3">
            <label className="block text-sm font-medium text-emerald-400 uppercase tracking-widest">Vision Engine</label>
            <button
                onClick={() => handleChange('useGambit', !formData.useGambit)}
                className={`w-full flex justify-between items-center p-4 rounded-xl border-2 transition-all ${
                    formData.useGambit 
                    ? 'bg-emerald-500/10 border-emerald-500 shadow-lg shadow-emerald-500/10' 
                    : 'bg-slate-800 border-slate-700'
                }`}
            >
                <div className="text-left">
                    <span className={`block font-bold ${formData.useGambit ? 'text-white' : 'text-slate-300'}`}>
                        Advanced AI Mode (Gambit)
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">
                        {formData.useGambit ? 'Enabled: Multi-turn verification' : 'Disabled: Single-shot prompt'}
                    </span>
                </div>
                <div className={`w-12 h-6 rounded-full relative transition-colors ${formData.useGambit ? 'bg-emerald-500' : 'bg-slate-600'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.useGambit ? 'left-7' : 'left-1'}`} />
                </div>
            </button>
            <p className="text-[10px] text-slate-500 px-1">
                Advanced Mode uses more tokens but verifies complex scoring rules (like Gnoming rows) before finalizing the result. Recommended for complex games.
            </p>
        </div>

        {isClient && onLeave && (
            <div className="pt-2">
                 <Button variant="danger" fullWidth onClick={onLeave}>
                     Disconnect & Leave Game
                 </Button>
            </div>
        )}

      </div>

      <div className="p-4 border-t border-slate-800 bg-felt-900">
        <Button fullWidth onClick={() => onSave(formData)}>
          {isClient ? "Close" : "Apply Rules"}
        </Button>
      </div>
    </div>
  );
};
