import React, { useState, useRef, useEffect } from 'react';
import { Player, CardSettings, ScanResult, DetectedCard, Round } from '../types';
import { Button } from '../components/Button';
import { IconCamera, IconChevronLeft, IconCheck, IconPhoto, IconX, IconTrash, IconPencil, IconPlus, IconStar } from '../components/Icons';
import { analyzeHand } from '../services/geminiService';
import { calculateCardScore, calculateRoundScore, getGnomingBreakdown } from '../utils/scoringUtils';
import { v4 as uuidv4 } from 'uuid';

const RANKS = [
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', 
  '-4', '-3', '-2', '-1', 'J', 'Q', 'K', 'A', 'Joker', 'Star', 'X',
  '+2', '+4', '+6', '+8', '+10', 
  'x2'
];
const SUITS = ['Spades', 'Hearts', 'Diamonds', 'Clubs', 'Stars', 'None'];

interface ScanViewProps {
  player: Player;
  players?: Player[];
  settings: CardSettings;
  existingRoundId?: string;
  targetIndex?: number;
  onComplete: (round: Round, index?: number) => void;
  onCancel: () => void;
}

export const ScanView: React.FC<ScanViewProps> = ({ player, players = [], settings, existingRoundId, targetIndex, onComplete, onCancel }) => {
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fullCards, setFullCards] = useState<DetectedCard[]>([]);
  const [wentOutFirst, setWentOutFirst] = useState(false);
  const [calculationDuration, setCalculationDuration] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [isCameraMode, setIsCameraMode] = useState(true);
  const [cameraError, setCameraError] = useState(false);
  const [isMirrored, setIsMirrored] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (existingRoundId) {
      const existing = player.rounds.find(r => r.id === existingRoundId);
      if (existing && existing.type === 'scan') {
        setFullCards(existing.cards);
        setWentOutFirst(!!existing.wentOutFirst);
        setCalculationDuration(existing.calculationDurationMs);
      }
    }
  }, [existingRoundId, player.rounds]);

  useEffect(() => {
    if (image || !isCameraMode) {
      stopCamera();
      return;
    }
    let mounted = true;
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false
        });
        if (!mounted) {
            stream.getTracks().forEach(track => track.stop());
            return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        const videoSettings = track.getSettings();
        setIsMirrored(videoSettings.facingMode !== 'environment');
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try { await videoRef.current.play(); } catch (e) { console.warn(e); }
        }
        setCameraError(false);
      } catch (err) {
        if (!mounted) return;
        setCameraError(true);
        setIsCameraMode(false);
      }
    };
    startCamera();
    return () => {
      mounted = false;
      stopCamera();
    };
  }, [isCameraMode, image]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setImage(dataUrl);
        processImage(dataUrl);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setImage(base64String);
        processImage(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = async (base64: string) => {
    setIsProcessing(true);
    setError(null);
    const startTime = performance.now();
    try {
      const data = await analyzeHand(base64, settings);
      const endTime = performance.now();
      setCalculationDuration(endTime - startTime);
      const cardsWithIds = data.cards.map(c => ({ ...c, id: uuidv4() }));
      setFullCards(cardsWithIds);
    } catch (err) {
      setError("Could not identify cards. Please try again or enter manually.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = () => {
    if (fullCards.length >= 0) {
        const round: Round = {
            type: 'scan',
            id: existingRoundId || uuidv4(), 
            cards: fullCards,
            wentOutFirst,
            timestamp: Date.now(),
            calculationDurationMs: calculationDuration
        };
        onComplete(round, targetIndex);
    }
  };

  const handleRetake = () => {
    setImage(null);
    setFullCards([]);
    setError(null);
    setIsCameraMode(true);
    setEditingCardId(null);
    setCalculationDuration(undefined);
  };

  const handleAddCard = () => {
      const newCard: DetectedCard = { id: uuidv4(), rank: '1', suit: 'None' };
      setFullCards([...fullCards, newCard]);
      setEditingCardId(newCard.id);
  };

  const handleDeleteCard = (id: string) => {
      setFullCards(fullCards.filter(c => c.id !== id));
  };

  const handleUpdateCard = (id: string, field: 'rank' | 'suit', value: string) => {
      setFullCards(fullCards.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const tempRound: Round = { type: 'scan', id: existingRoundId || 'temp', cards: fullCards, timestamp: 0, wentOutFirst };
  const calculatedTotal = calculateRoundScore(tempRound, settings, players, targetIndex);
  const isGnoming = settings.preset === 'gnoming_around';
  const gnomingBreakdown = isGnoming ? getGnomingBreakdown(fullCards, tempRound as any, players, targetIndex) : null;
  
  // Determine color for "Went Out First" button based on modifier
  let outFirstColorClass = 'bg-surface border-surface-highlight text-ink-muted';
  let outFirstIconColor = 'text-ink-subtle';
  
  if (wentOutFirst) {
      const outFirstMod = gnomingBreakdown?.modifiers.find(m => m.label.includes('Out First'));
      if (outFirstMod && outFirstMod.value > 0) {
          // Penalty (Red)
          outFirstColorClass = 'bg-danger/10 border-danger text-danger-soft shadow-lg shadow-danger-deep/10';
          outFirstIconColor = 'text-danger-soft';
      } else {
          // Bonus/Default (Green)
          outFirstColorClass = 'bg-primary/10 border-primary text-primary-soft shadow-lg shadow-primary-deep/10';
          outFirstIconColor = 'text-primary-soft';
      }
  }

  if (!image) {
    return (
      <div className="flex-1 flex flex-col w-full h-full bg-canvas relative overflow-hidden">
        <canvas ref={canvasRef} className="hidden" />
        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
        {isCameraMode && !cameraError ? (
          <>
            <video ref={videoRef} autoPlay playsInline muted onLoadedMetadata={() => videoRef.current?.play()} className={`absolute inset-0 w-full h-full object-cover transition-transform duration-300 ${isMirrored ? 'scale-x-[-1]' : ''}`} />
            <div className="absolute inset-0 flex flex-col justify-between p-6 z-10 bg-gradient-to-b from-black/50 via-transparent to-black/50 pointer-events-none">
               <div className="flex justify-between items-center pointer-events-auto">
                 <button onClick={onCancel} className="p-2 rounded-full bg-black/20 text-white backdrop-blur-md hover:bg-black/40 transition-colors">
                   <IconX className="w-6 h-6" />
                 </button>
                 <span className="text-white font-semibold text-sm shadow-sm drop-shadow-md">Scan {player.name}'s hand</span>
                 <div className="w-10"></div>
               </div>
               <div className="flex items-center justify-between pointer-events-auto pb-8">
                  <button onClick={() => fileInputRef.current?.click()} className="p-4 rounded-full text-white/80 hover:text-white transition-colors hover:bg-white/10">
                    <IconPhoto className="w-8 h-8" />
                  </button>
                  <button onClick={handleCapture} className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-white/20 active:bg-white/50 transition-all hover:scale-105">
                    <div className="w-16 h-16 rounded-full bg-white"></div>
                  </button>
                  <div className="w-16"></div>
               </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-canvas">
            <div className="w-24 h-24 bg-surface rounded-full flex items-center justify-center mb-6"><IconCamera className="w-10 h-10 text-ink-subtle" /></div>
            <h3 className="text-xl font-bold text-white mb-2">Camera unavailable</h3>
            <Button fullWidth onClick={() => fileInputRef.current?.click()} className="mb-4">Select photo</Button>
            <Button variant="secondary" fullWidth onClick={onCancel}>Cancel</Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-canvas overflow-hidden">
      <div className="relative h-[25dvh] bg-black shrink-0">
        <img src={image} alt="Cards" className="w-full h-full object-contain opacity-80" />
        <button onClick={handleRetake} className="absolute top-4 left-4 bg-black/50 p-2 rounded-full text-white backdrop-blur hover:bg-black/70 transition-colors">
            <IconChevronLeft className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 bg-canvas -mt-4 rounded-t-2xl relative z-10 p-4 flex flex-col shadow-2xl border-t border-surface min-h-0">
        {isProcessing ? (
          <div className="flex-1 flex flex-col items-center justify-center text-primary-soft space-y-4">
             <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
             <p className="animate-pulse text-lg font-medium">Identifying cards...</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="bg-danger/10 p-4 rounded-full mb-4"><IconX className="w-8 h-8 text-danger" /></div>
            <p className="text-ink-muted mb-6 max-w-xs">{error}</p>
            <Button onClick={handleRetake} fullWidth>Try again</Button>
          </div>
        ) : (
          <>
             <div className="flex justify-between items-end mb-4 shrink-0">
                <div>
                    <h3 className="text-sm text-ink-muted font-semibold uppercase tracking-wider">
                      {targetIndex !== undefined ? `Round ${targetIndex + 1} score` : 'Score'}
                    </h3>
                    <div className="flex items-center gap-2">
                        <span className="text-5xl font-black text-primary-soft">{calculatedTotal}</span>
                        {!isGnoming && fullCards.some(c => c.rank.toLowerCase().startsWith('x')) && (
                            <span className="text-primary-soft/50 text-xs font-bold bg-primary/10 px-2 py-1 rounded-full uppercase tracking-tighter">Multiplied</span>
                        )}
                    </div>
                </div>
                <div className="text-right pb-2">
                    <span className="text-xs text-ink-subtle block uppercase tracking-wider mb-1">Found</span>
                    <span className="text-white text-lg font-bold bg-surface px-3 py-1 rounded-lg border border-surface-highlight">
                        {fullCards.length} cards
                    </span>
                </div>
             </div>

             <div className="flex-1 overflow-y-auto mb-4 bg-surface/50 rounded-xl p-3 border border-surface-highlight/50 custom-scrollbar flex flex-col min-h-0">
                <h4 className="text-xs text-ink-subtle uppercase font-bold mb-3 flex items-center gap-2">
                    <IconCheck className="w-4 h-4 text-primary" />
                    Breakdown
                </h4>
                
                {isGnoming && gnomingBreakdown ? (
                   <div className="space-y-4">
                      {gnomingBreakdown.sets.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[10px] text-ink-subtle uppercase font-bold tracking-widest">Matching sets</p>
                          {gnomingBreakdown.sets.map((s, i) => (
                            <div key={i} className="flex justify-between items-center text-blue-400 font-bold border-b border-surface-highlight/30 pb-1">
                                <span>{s.label}</span>
                                <span>{s.value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="space-y-1">
                          <p className="text-[10px] text-ink-subtle uppercase font-bold tracking-widest">Individual cards</p>
                          {gnomingBreakdown.loneCards.map((c, i) => (
                             <div key={i} className="flex justify-between items-center text-ink-muted border-b border-surface-highlight/30 pb-1">
                                <span className={c.isHazard ? 'text-danger-soft font-bold' : c.rank === 'Star' ? 'text-accent' : ''}>{c.rank === 'Star' ? 'Star (Unused)' : c.rank === 'X' ? 'X (Hazard)' : c.rank}</span>
                                <span className={c.value > 0 ? 'text-primary-soft' : 'text-blue-400'}>{c.value >= 0 ? `+${c.value}` : c.value}</span>
                             </div>
                          ))}
                      </div>
                      {gnomingBreakdown.modifiers.map((m, i) => (
                        <div key={i} className="flex justify-between items-center text-ink-muted italic text-sm pt-1 border-t border-surface-highlight/30">
                            <span>{m.label}</span>
                            <span className={m.value < 0 ? 'text-primary-soft font-bold' : 'text-danger-soft font-bold'}>{m.value >= 0 ? `+${m.value}` : m.value}</span>
                        </div>
                      ))}
                   </div>
                ) : (
                  <ul className="space-y-2 flex-1">
                      {fullCards.map((card) => {
                          const isMultiplier = card.rank.toLowerCase().startsWith('x');
                          const isAdditive = card.rank.toLowerCase().startsWith('+');
                          
                          return (
                          <li key={card.id} className="flex justify-between items-center text-ink border-b border-surface-highlight/30 last:border-0 pb-2 last:pb-0 min-h-[48px]">
                              {editingCardId === card.id ? (
                                  <div className="flex items-center gap-2 flex-1">
                                      <select 
                                          value={card.rank} 
                                          onChange={(e) => handleUpdateCard(card.id, 'rank', e.target.value)}
                                          className="bg-surface-highlight text-white rounded px-2 py-1 text-sm font-bold border border-surface-highlight focus:border-primary outline-none w-16 text-center"
                                      >
                                          {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                                      </select>
                                      <span className="text-ink-subtle text-xs">of</span>
                                      <select 
                                          value={card.suit} 
                                          onChange={(e) => handleUpdateCard(card.id, 'suit', e.target.value)}
                                          className="bg-surface-highlight text-white rounded px-2 py-1 text-sm font-bold border border-surface-highlight focus:border-primary outline-none flex-1"
                                      >
                                          {SUITS.map(s => <option key={s} value={s}>{s}</option>)}
                                      </select>
                                      <button onClick={() => setEditingCardId(null)} className="p-1.5 rounded bg-primary/20 text-primary-soft"><IconCheck className="w-4 h-4" /></button>
                                      <button onClick={() => handleDeleteCard(card.id)} className="p-1.5 rounded bg-surface-highlight text-ink-muted hover:text-danger-soft ml-1"><IconTrash className="w-4 h-4" /></button>
                                  </div>
                              ) : (
                                  <>
                                      <div className="flex-1 flex items-baseline gap-2">
                                          <span className={`text-xl font-black ${isMultiplier ? 'text-accent' : isAdditive ? 'text-primary-soft' : 'text-white'}`}>{card.rank}</span>
                                          {card.suit !== 'None' && <span className="text-sm font-medium text-primary-soft/60">{card.suit}</span>}
                                      </div>
                                      <div className="flex items-center gap-3">
                                          <span className={`text-sm font-mono ${isMultiplier ? 'text-accent font-bold' : 'text-primary-soft'}`}>
                                              {isMultiplier ? `${card.rank} MOD` : `+${calculateCardScore(card, settings)}`}
                                          </span>
                                          <div className="flex gap-1">
                                              <button onClick={() => setEditingCardId(card.id)} className="p-1 text-ink-subtle hover:text-white"><IconPencil className="w-4 h-4" /></button>
                                              <button onClick={() => handleDeleteCard(card.id)} className="p-1 text-ink-subtle hover:text-danger-soft"><IconTrash className="w-4 h-4" /></button>
                                          </div>
                                      </div>
                                  </>
                              )}
                          </li>
                          );
                      })}
                  </ul>
                )}

                {!isGnoming && (
                  <div className="pt-3 mt-2">
                      <Button variant="ghost" fullWidth onClick={handleAddCard} className="border-2 border-dashed border-surface-highlight hover:border-surface-highlight py-2 text-sm">
                          <IconPlus className="w-4 h-4 mr-2" /> Add card
                      </Button>
                  </div>
                )}
             </div>

             {isGnoming && (
                <div className="px-1 mb-4">
                    <button 
                        onClick={() => setWentOutFirst(!wentOutFirst)}
                        className={`w-full flex justify-between items-center p-4 rounded-xl border-2 transition-all ${outFirstColorClass}`}
                    >
                        <div className="flex items-center gap-3">
                            <IconStar className={`w-5 h-5 ${outFirstIconColor}`} />
                            <span className="font-bold">I went out first</span>
                        </div>
                        {wentOutFirst && <IconCheck className="w-5 h-5" />}
                    </button>
                </div>
             )}

             <div className="space-y-3 shrink-0">
                <Button onClick={handleSave} fullWidth>
                    {existingRoundId ? 'Update score' : 'Save score'}
                </Button>
                <Button variant="secondary" onClick={onCancel} fullWidth>
                    Cancel
                </Button>
             </div>
          </>
        )}
      </div>
    </div>
  );
};