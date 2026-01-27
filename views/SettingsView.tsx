
import React, { useState } from 'react';
import { CardSettings, GamePreset } from '../types';
import { Button } from '../components/Button';
import { IconChevronLeft, IconStar, IconCheck, IconChevronDown, IconX, IconSettings } from '../components/Icons';

interface SettingsViewProps {
  settings: CardSettings;
  onSave: (settings: CardSettings) => void;
  onCancel: () => void;
  isClient?: boolean;
  onLeave?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onSave, onCancel, isClient, onLeave }) => {
  const [formData, setFormData] = useState<CardSettings>(settings);
  const [isPresetSheetOpen, setIsPresetSheetOpen] = useState(false);

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

  const PRESETS = [
    { id: 'standard', name: 'Standard / Custom', desc: 'Manual scoring sliders.' },
    { id: 'flip7', name: 'Flip 7', desc: 'Additive (+X) & Multiplier (xX) cards.' },
    { id: 'gnoming_around', name: 'Gnoming Around', desc: '3x3 Grid sets, Star wilds, X hazards.' }
  ];

  const currentPreset = PRESETS.find(p => p.id === formData.preset) || PRESETS[0];

  return (
    <div className="flex flex-col h-full bg-felt-900 relative">
      <div className="flex items-center p-4 bg-slate-800 shadow-sm">
        <button onClick={onCancel} className="p-2 -ml-2 text-slate-400 hover:text-white">
          <IconChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="text-lg font-bold ml-2">Game rules</h2>
      </div>

      <div className="p-6 space-y-10 overflow-y-auto flex-1">
        
        {/* Preset Selector */}
        <div className="space-y-3">
            <label className="block text-sm font-medium text-emerald-400 uppercase tracking-widest">Game preset</label>
             <button
                onClick={() => setIsPresetSheetOpen(true)}
                className="w-full flex items-center justify-between bg-slate-800 border border-slate-700 rounded-xl p-4 text-left hover:border-emerald-500 transition-colors group"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-700 rounded-lg group-hover:bg-emerald-500/20 group-hover:text-emerald-400 transition-colors text-slate-400">
                        {formData.preset === 'standard' ? <IconSettings className="w-6 h-6" /> : <IconStar className="w-6 h-6" />}
                    </div>
                    <div>
                        <span className="block font-bold text-white text-lg">{currentPreset.name}</span>
                        <span className="block text-xs text-slate-500">{currentPreset.desc}</span>
                    </div>
                </div>
                <IconChevronDown className="w-5 h-5 text-slate-500 group-hover:text-emerald-400" />
            </button>
        </div>

        {formData.preset === 'standard' ? (
            <div className="space-y-6 animate-in fade-in duration-500">
                {/* Winning Condition */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-emerald-400 uppercase tracking-wider">Winning condition</label>
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
                        Lowest score
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
                        Highest score
                        </button>
                    </div>
                </div>

                {/* Number Cards */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-emerald-400 uppercase tracking-wider">Number cards (2-10)</label>
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
                        Face value
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
                        Fixed value
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
                    <label className="block text-sm font-medium text-emerald-400 uppercase tracking-wider">Face cards (K, Q, J)</label>
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
                        Face value
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
                        Fixed value
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
                    <span className="font-bold uppercase tracking-widest text-sm">Preset active</span>
                </div>
                <p className="text-slate-400 text-sm leading-snug">
                    Preset rules for <span className="text-white font-bold">{formData.preset === 'flip7' ? 'Flip 7' : 'Gnoming Around'}</span> are automatically applied. Manual scoring overrides are disabled to ensure mathematical accuracy.
                </p>
            </div>
        )}

        <hr className="border-slate-800" />

        {isClient && onLeave && (
            <div className="pt-2">
                 <Button variant="danger" fullWidth onClick={onLeave}>
                     Disconnect & leave game
                 </Button>
            </div>
        )}

      </div>

      <div className="p-4 border-t border-slate-800 bg-felt-900">
        <Button fullWidth onClick={() => onSave(formData)}>
          {isClient ? "Close" : "Apply rules"}
        </Button>
      </div>

      {/* Preset Selection Sheet */}
      {isPresetSheetOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end justify-center sm:items-center p-4 sm:p-0" onClick={() => setIsPresetSheetOpen(false)}>
            <div 
                className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-800 p-6 space-y-4 animate-in slide-in-from-bottom duration-200 shadow-2xl mb-4 sm:mb-0"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xl font-bold text-white">Select preset</h3>
                    <button onClick={() => setIsPresetSheetOpen(false)} className="p-2 -mr-2 text-slate-400 hover:text-white rounded-full">
                        <IconX className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {PRESETS.map(p => (
                        <button
                            key={p.id}
                            onClick={() => {
                                selectPreset(p.id as GamePreset);
                                setIsPresetSheetOpen(false);
                            }}
                            className={`w-full flex items-center justify-between p-4 rounded-xl border-2 text-left transition-all ${
                                formData.preset === p.id 
                                ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                                : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                 <div className={`p-2 rounded-lg ${formData.preset === p.id ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                                    {p.id === 'standard' ? <IconSettings className="w-5 h-5" /> : <IconStar className="w-5 h-5" />}
                                 </div>
                                 <div>
                                    <span className={`block font-bold ${formData.preset === p.id ? 'text-emerald-400' : 'text-white'}`}>{p.name}</span>
                                    <span className="text-xs text-slate-500">{p.desc}</span>
                                </div>
                            </div>
                            {formData.preset === p.id && <div className="bg-emerald-500 rounded-full p-1"><IconCheck className="w-3 h-3 text-white" /></div>}
                        </button>
                    ))}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
