
import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { Button } from './Button';
import { IconX, IconCamera, IconCheck, IconCopy, IconLink } from './Icons';

interface MultiplayerModalProps {
  hostId: string; // The current device's Peer ID
  onJoin: (targetHostId: string) => void;
  onClose: () => void;
  connectedPeersCount: number;
}

export const MultiplayerModal: React.FC<MultiplayerModalProps> = ({ 
  hostId, 
  onJoin, 
  onClose,
  connectedPeersCount
}) => {
  const [mode, setMode] = useState<'HOST' | 'JOIN'>('HOST');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Host Mode: Generate QR
  useEffect(() => {
    if (mode === 'HOST' && hostId) {
      QRCode.toDataURL(hostId, { margin: 2, width: 300, color: { dark: '#0f221b', light: '#10b981' } })
        .then(url => setQrDataUrl(url))
        .catch(err => console.error(err));
    }
  }, [mode, hostId]);

  const handleCopyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}?join=${hostId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Join Mode: Camera & Scanning
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isMirrored, setIsMirrored] = useState(false);

  useEffect(() => {
    let animationFrameId: number;
    let stream: MediaStream | null = null;

    if (mode === 'JOIN') {
      setIsScanning(true);
      setJoinError(null);
      
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(mediaStream => {
          stream = mediaStream;
          const track = stream.getVideoTracks()[0];
          const settings = track.getSettings();
          setIsMirrored(settings.facingMode !== 'environment');

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(e => console.warn("Play error", e));
          }
          requestAnimationFrame(tick);
        })
        .catch(err => {
          console.error("Camera error", err);
          setJoinError("Could not access camera.");
        });
    }

    const tick = () => {
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);

          if (code) {
            console.log("Found QR:", code.data);
            if (code.data) {
                onJoin(code.data);
                return; 
            }
          }
        }
      }
      if (mode === 'JOIN') {
        animationFrameId = requestAnimationFrame(tick);
      }
    };

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [mode]);

  return (
    <div className="fixed inset-0 z-50 bg-felt-900 flex flex-col h-[100dvh] w-full md:max-w-md md:mx-auto md:border-x md:border-slate-800">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-900/50 shrink-0">
        <h2 className="text-xl font-bold text-white">Multiplayer</h2>
        <button onClick={onClose} className="p-2 -mr-2 rounded-full text-slate-400 hover:text-white">
          <IconX className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Tabs */}
        <div className="px-6 pt-6 shrink-0 z-10">
          <div className="flex bg-slate-800 p-1 rounded-xl">
            <button 
              onClick={() => setMode('HOST')}
              className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${
                mode === 'HOST' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Host Game
            </button>
            <button 
              onClick={() => setMode('JOIN')}
              className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${
                mode === 'JOIN' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Scan QR
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
            {mode === 'HOST' && (
            <div className="text-center space-y-6 w-full mt-4">
                {qrDataUrl ? (
                <div className="bg-white p-4 rounded-xl inline-block shadow-xl">
                    <img src={qrDataUrl} alt="Host QR Code" className="w-56 h-56" />
                </div>
                ) : (
                <div className="w-56 h-56 flex items-center justify-center mx-auto">
                    <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                )}
                
                <div className="bg-slate-800/50 rounded-lg p-4">
                    <p className="text-slate-400 mb-2 text-sm">Friends can scan this code to join.</p>
                    {connectedPeersCount > 0 ? (
                        <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-full text-sm font-bold animate-pulse">
                        <IconCheck className="w-4 h-4" />
                        {connectedPeersCount} Connected
                        </div>
                    ) : (
                        <p className="text-xs text-slate-500 italic">Waiting for players...</p>
                    )}
                </div>
                
                <div className="pt-2">
                    <button 
                        onClick={handleCopyLink}
                        className="flex items-center justify-center gap-2 w-full bg-slate-700 hover:bg-slate-600 text-white py-4 rounded-xl transition-all font-semibold"
                    >
                        {copySuccess ? <IconCheck className="w-5 h-5 text-emerald-400" /> : <IconLink className="w-5 h-5" />}
                        {copySuccess ? 'Link Copied!' : 'Copy Invite Link'}
                    </button>
                    <p className="text-xs text-slate-600 font-mono mt-3 select-all">ID: {hostId}</p>
                </div>
            </div>
            )}

            {mode === 'JOIN' && (
            <div className="w-full h-full flex flex-col items-center justify-center relative mt-4">
                {joinError ? (
                    <div className="text-red-400 text-center bg-red-500/10 p-6 rounded-xl">
                        <p className="mb-4 font-semibold">{joinError}</p>
                        <Button onClick={() => setMode('JOIN')}>Retry Camera</Button>
                    </div>
                ) : (
                    <>
                        <div className="relative w-full max-w-xs aspect-square bg-black rounded-2xl overflow-hidden border-2 border-emerald-500/50 shadow-2xl">
                        <video 
                            ref={videoRef} 
                            className={`absolute inset-0 w-full h-full object-cover opacity-80 transition-transform ${isMirrored ? 'scale-x-[-1]' : ''}`} 
                            playsInline 
                            muted 
                        />
                        <canvas ref={canvasRef} className="hidden" />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-56 h-56 border-2 border-emerald-400 rounded-lg relative">
                                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400 -mt-1 -ml-1 rounded-tl-sm"></div>
                                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400 -mt-1 -mr-1 rounded-tr-sm"></div>
                                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400 -mb-1 -ml-1 rounded-bl-sm"></div>
                                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400 -mb-1 -mr-1 rounded-br-sm"></div>
                            </div>
                        </div>
                        </div>
                        <p className="mt-8 text-slate-400 text-sm text-center animate-pulse bg-slate-900/50 px-4 py-2 rounded-full">
                            Point camera at Host QR Code
                        </p>
                    </>
                )}
            </div>
            )}
        </div>
      </div>
    </div>
  );
};
