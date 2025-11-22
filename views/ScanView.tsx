
import React, { useState, useRef, useEffect } from 'react';
import { Player, CardSettings, ScanResult, DetectedCard, Round } from '../types';
import { Button } from '../components/Button';
import { IconCamera, IconChevronLeft, IconCheck, IconPhoto, IconX } from '../components/Icons';
import { analyzeHand } from '../services/geminiService';
import { calculateCardScore } from '../utils/scoringUtils';
import { v4 as uuidv4 } from 'uuid';

interface ScanViewProps {
  player: Player;
  settings: CardSettings;
  existingRoundId?: string;
  onComplete: (round: Round) => void;
  onCancel: () => void;
}

export const ScanView: React.FC<ScanViewProps> = ({ player, settings, existingRoundId, onComplete, onCancel }) => {
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [fullCards, setFullCards] = useState<DetectedCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Camera states
  const [isCameraMode, setIsCameraMode] = useState(true);
  const [cameraError, setCameraError] = useState(false);
  const [isMirrored, setIsMirrored] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize Camera
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
        const settings = track.getSettings();
        setIsMirrored(settings.facingMode !== 'environment');
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
    try {
      const data = await analyzeHand(base64);
      setResult(data);
      // Hydrate with UUIDs
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
            id: existingRoundId || uuidv4(), // Use existing ID if provided (edit mode)
            cards: fullCards,
            timestamp: Date.now()
        };
        onComplete(round);
    }
  };

  const handleRetake = () => {
    setImage(null);
    setResult(null);
    setFullCards([]);
    setError(null);
    setIsCameraMode(true);
  };

  // Calculate current values based on settings
  const calculatedTotal = fullCards.reduce((sum, card) => sum + calculateCardScore(card, settings), 0);

  if (!image) {
    return (
      <div className="flex-1 flex flex-col w-full h-full bg-black relative overflow-hidden">
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
                 <span className="text-white font-semibold text-sm shadow-sm drop-shadow-md">Scan {player.name}'s Hand</span>
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
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-felt-900">
            <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-6"><IconCamera className="w-10 h-10 text-slate-500" /></div>
            <h3 className="text-xl font-bold text-white mb-2">Camera Unavailable</h3>
            <Button fullWidth onClick={() => fileInputRef.current?.click()} className="mb-4">Select Photo</Button>
            <Button variant="secondary" fullWidth onClick={onCancel}>Cancel</Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-felt-900">
      <div className="relative h-1/3 bg-black shrink-0">
        <img src={image} alt="Cards" className="w-full h-full object-contain opacity-80" />
        <button onClick={handleRetake} className="absolute top-4 left-4 bg-black/50 p-2 rounded-full text-white backdrop-blur hover:bg-black/70 transition-colors">
            <IconChevronLeft className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 bg-felt-900 -mt-4 rounded-t-2xl relative z-10 p-6 flex flex-col shadow-2xl border-t border-slate-800">
        {isProcessing ? (
          <div className="flex-1 flex flex-col items-center justify-center text-emerald-400 space-y-4">
             <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
             <p className="animate-pulse text-lg font-medium">Identifying cards...</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="bg-red-500/10 p-4 rounded-full mb-4"><IconX className="w-8 h-8 text-red-500" /></div>
            <p className="text-slate-300 mb-6 max-w-xs">{error}</p>
            <Button onClick={handleRetake} fullWidth>Try Again</Button>
          </div>
        ) : (
          <>
             <div className="flex justify-between items-end mb-6">
                <div>
                    <h3 className="text-sm text-slate-400 font-semibold uppercase tracking-wider">Total Score</h3>
                    <span className="text-5xl font-black text-emerald-400">{calculatedTotal}</span>
                </div>
                <div className="text-right pb-2">
                    <span className="text-xs text-slate-500 block uppercase tracking-wider mb-1">Found</span>
                    <span className="text-white text-lg font-bold bg-slate-800 px-3 py-1 rounded-lg border border-slate-700">
                        {fullCards.length} Cards
                    </span>
                </div>
             </div>

             <div className="flex-1 overflow-y-auto mb-6 bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 custom-scrollbar flex flex-col">
                <h4 className="text-xs text-slate-500 uppercase font-bold mb-3 flex items-center gap-2">
                    <IconCheck className="w-4 h-4 text-emerald-500" />
                    Breakdown
                </h4>
                <ul className="space-y-2 flex-1">
                    {fullCards.map((card, i) => (
                        <li key={card.id} className="flex justify-between items-center text-slate-200 border-b border-slate-700/30 last:border-0 pb-2 last:pb-0">
                            <span className="text-sm">{card.rank} of {card.suit}</span>
                            <span className="text-sm font-mono text-emerald-400">+{calculateCardScore(card, settings)}</span>
                        </li>
                    ))}
                </ul>
                <div className="mt-4 pt-3 border-t border-slate-600 flex justify-between items-center">
                    <span className="text-slate-400 font-semibold uppercase text-xs">Total</span>
                    <span className="text-xl font-bold text-white">{calculatedTotal}</span>
                </div>
             </div>

             <div className="space-y-3 mt-auto pt-2">
                 <Button fullWidth onClick={handleSave} className="py-4 text-lg shadow-emerald-900/50">
                    {existingRoundId ? 'Save Changes' : 'Add Score'}
                 </Button>
                 <Button variant="ghost" fullWidth onClick={handleRetake}>
                    Retake Photo
                 </Button>
             </div>
          </>
        )}
      </div>
    </div>
  );
};
