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

  useEffect(() => {
    let animationFrameId: number;
    let stream: MediaStream | null = null;

    if (mode === 'JOIN') {
      setIsScanning(true);
      setJoinError(null);
      
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(mediaStream => {
          stream = mediaStream;
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
            // Found a code!
            console.log("Found QR:", code.data);
            if (code.data) {
                onJoin(code.data);
                // Don't need to close here, parent will handle loading state or closing
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
    <div className="absolute inset-0 z-50 bg-felt-900/95 backdrop-blur-sm flex flex-col p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Multiplayer</h2>
        <button onClick={onClose} className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white">
          <IconX className="w-6 h-6" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-800 p-1 rounded-xl mb-6">
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
          Join Game
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-800/50 rounded-2xl p-6 border border-slate-700 overflow-hidden relative">
        
        {mode === 'HOST' && (
          <div className="text-center space-y-6 w-full">
            {qrDataUrl ? (
              <div className="bg-white p-4 rounded-xl inline-block">
                <img src={qrDataUrl} alt="Host QR Code" className="w-56 h-56" />
              </div>
            ) : (
              <div className="w-56 h-56 flex items-center justify-center mx-auto">
                 <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            
            <div>
              <p className="text-slate-400 mb-2 text-sm">Ask friends to scan this code to join.</p>
              {connectedPeersCount > 0 && (
                <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-full text-sm font-bold">
                  <IconCheck className="w-4 h-4" />
                  {connectedPeersCount} Connected
                </div>
              )}
            </div>
            
            <div className="pt-2">
                <button 
                    onClick={handleCopyLink}
                    className="flex items-center justify-center gap-2 w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg transition-all"
                >
                    {copySuccess ? <IconCheck className="w-5 h-5 text-emerald-400" /> : <IconLink className="w-5 h-5" />}
                    {copySuccess ? 'Link Copied!' : 'Copy Invite Link'}
                </button>
                <p className="text-xs text-slate-600 font-mono mt-3 select-all">ID: {hostId}</p>
            </div>
          </div>
        )}

        {mode === 'JOIN' && (
           <div className="w-full h-full flex flex-col items-center justify-center relative">
              {joinError ? (
                 <div className="text-red-400 text-center">
                    <p className="mb-4">{joinError}</p>
                    <Button onClick={() => setMode('JOIN')}>Retry</Button>
                 </div>
              ) : (
                 <>
                    <div className="relative w-full max-w-xs aspect-square bg-black rounded-xl overflow-hidden border-2 border-emerald-500/50 shadow-2xl">
                       <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-80" playsInline muted />
                       <canvas ref={canvasRef} className="hidden" />
                       <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-48 h-48 border-2 border-emerald-400 rounded-lg relative">
                             <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-400 -mt-1 -ml-1"></div>
                             <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-400 -mt-1 -mr-1"></div>
                             <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-400 -mb-1 -ml-1"></div>
                             <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-400 -mb-1 -mr-1"></div>
                          </div>
                       </div>
                    </div>
                    <p className="mt-6 text-slate-400 text-sm text-center animate-pulse">Scanning for Host QR Code...</p>
                 </>
              )}
           </div>
        )}

      </div>
    </div>
  );
};