
import React, { useState, useEffect, useRef } from 'react';
import { Player, AppView, CardSettings, Round, P2PMessage } from './types';
import { SetupView } from './views/SetupView';
import { GameView } from './views/GameView';
import { SettingsView } from './views/SettingsView';
import { ScanView } from './views/ScanView';
import { MultiplayerModal } from './components/MultiplayerModal';
import { Button } from './components/Button';
import { p2p } from './services/p2pService';
import { IconX } from './components/Icons';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_SETTINGS: CardSettings = {
  jokerValue: 50,
  aceValue: 20,
  faceCardBehavior: 'fixed',
  fixedFaceValue: 10,
  numberCardBehavior: 'face',
  fixedNumberValue: 5,
  winningScoreType: 'lowest'
};

const MAX_RETRIES = 5;

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.SETUP);
  const [players, setPlayers] = useState<Player[]>([]);
  const [settings, setSettings] = useState<CardSettings>(DEFAULT_SETTINGS);
  
  // Scanning State
  const [scanPlayerId, setScanPlayerId] = useState<string | null>(null);
  const [scanRoundId, setScanRoundId] = useState<string | null>(null);

  // Multiplayer State
  const [isMultiplayerOpen, setIsMultiplayerOpen] = useState(false);
  const [peerId, setPeerId] = useState<string>('');
  const [connectedPeers, setConnectedPeers] = useState<number>(0);
  const [connectedPeerIds, setConnectedPeerIds] = useState<string[]>([]);
  
  // Initialize isClient based on localStorage to support refresh/reconnect
  const [isClient, setIsClient] = useState(() => !!localStorage.getItem('snapscore_host_id'));
  const [isJoining, setIsJoining] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [hostEndedSession, setHostEndedSession] = useState(false);
  
  // Refs
  const joinCancelledRef = useRef(false);
  const handleP2PMessageRef = useRef<(msg: P2PMessage) => void>(() => {});
  
  // Force sync effect on connection events
  const [p2pUpdateTick, setP2pUpdateTick] = useState(0);
  
  // --- P2P Setup ---
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    const initP2p = async () => {
      try {
        // Try to restore previous session ID to allow refresh-reconnect
        const storedDeviceId = localStorage.getItem('snapscore_device_id');
        const storedHostId = localStorage.getItem('snapscore_host_id');
        const params = new URLSearchParams(window.location.search);
        const joinId = params.get('join');
        
        // Only use stored ID if we are actually recovering a session or joining
        const id = await p2p.init(storedDeviceId || undefined);
        setPeerId(id);
        
        // Only persist ID if:
        // 1. We already had one (recovering session)
        // 2. We are a client (storedHostId exists)
        // 3. We are joining a game via URL
        if ((storedDeviceId || storedHostId || joinId) && storedDeviceId !== id) {
            localStorage.setItem('snapscore_device_id', id);
        }
        
        p2p.onMessage((msg) => {
          if (msg.type === 'HEARTBEAT') return; // Should be filtered by service, but safety check
          handleP2PMessageRef.current(msg);
        });
        
        p2p.onConnectionChange(() => {
            setConnectedPeers(p2p.activeConnectionsCount);
            setConnectedPeerIds(p2p.connectedPeerIds);
            setP2pUpdateTick(t => t + 1);
        });

        // Backup polling interval
        intervalId = setInterval(() => {
             const count = p2p.activeConnectionsCount;
             const ids = p2p.connectedPeerIds;
             if (count !== connectedPeers) {
                 setConnectedPeers(count);
             }
             if (JSON.stringify(ids) !== JSON.stringify(connectedPeerIds)) {
                 setConnectedPeerIds(ids);
             }
        }, 3000);

        if (joinId) {
            // If joining via URL, clear previous session state to prevent fallback loop
            localStorage.removeItem('snapscore_host_id');
            setIsClient(false);
            setRetryCount(0);
            setHostEndedSession(false);
            window.history.replaceState({}, document.title, window.location.pathname);
            handleJoinGame(joinId);
        } else if (storedHostId) {
            handleJoinGame(storedHostId, true);
        }

      } catch (err) {
        if (String(err).includes("Lost connection")) return;
        console.error("Failed to init P2P", err);
      }
    };
    initP2p();

    const handleUnload = () => {
        p2p.destroy();
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener('beforeunload', handleUnload);
      p2p.destroy();
    };
  }, []);

  // --- Persist ID when game is active or peers connected ---
  useEffect(() => {
    if (connectedPeers > 0 && peerId) {
        localStorage.setItem('snapscore_device_id', peerId);
    }
  }, [connectedPeers, peerId]);

  // --- Auto-Reconnect Effect ---
  useEffect(() => {
    // If we think we are a client, but we have no connections, try to reconnect
    // UNLESS the host explicitly ended the game
    if (!isClient || hostEndedSession) return;

    // Check if connections are truly 0 (using P2P service directly to avoid state lag)
    if (connectedPeers === 0) {
      const hostId = localStorage.getItem('snapscore_host_id');
      if (hostId) {
        if (retryCount >= MAX_RETRIES) {
            console.warn("Max retries reached. Stopping auto-reconnect.");
            // Don't fully disconnect, just let them see offline state
            return;
        }

        // Debounce reconnection attempts
        const timer = setTimeout(() => {
            // Critical check: Ensure we aren't already joining OR already connected (via direct service check)
            if (!isJoining && p2p.activeConnectionsCount === 0) {
                console.log(`Connection lost. Attempting to reconnect to host: ${hostId} (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
                handleJoinGame(hostId, true);
            }
        }, 3000); // Increased delay to absorb quick flicker
        return () => clearTimeout(timer);
      }
    }
  }, [isClient, connectedPeers, isJoining, retryCount, hostEndedSession]);

  // --- Sync Logic ---
  useEffect(() => {
    if (!isClient && connectedPeers > 0) {
        broadcastState();
    }
  }, [players, settings, view, connectedPeers, p2pUpdateTick]);

  const broadcastState = () => {
     p2p.broadcast({
         type: 'SYNC_STATE',
         payload: {
             players,
             settings,
             view: view === AppView.SCAN ? AppView.GAME : view
         }
     });
  };

  const handleP2PMessage = (msg: P2PMessage) => {
      if (msg.type === 'SYNC_STATE') {
          setIsClient(true);
          setHostEndedSession(false); // Clear any previous disconnect messages
          setPlayers(msg.payload.players);
          setSettings(msg.payload.settings);
          if (msg.payload.view === AppView.GAME || msg.payload.view === AppView.SETUP) {
              setView(msg.payload.view);
          }
      } else if (msg.type === 'REQUEST_SAVE_ROUND') {
          handleSaveRound(msg.payload.playerId, msg.payload.round);
      } else if (msg.type === 'REQUEST_RESET') {
          handleRestartGame();
      } else if (msg.type === 'REQUEST_SETTINGS_UPDATE') {
          setSettings(msg.payload);
      } else if (msg.type === 'REQUEST_ADD_PLAYERS') {
          setPlayers(prev => [...prev, ...msg.payload]);
      } else if (msg.type === 'REQUEST_REMOVE_PLAYER') {
          setPlayers(prev => prev.filter(p => p.id !== msg.payload.playerId));
      } else if (msg.type === 'GAME_ENDED') {
          // Save history before clearing
          if (players.length > 0) {
             try {
                 localStorage.setItem('snapscore_last_game', JSON.stringify({ 
                     timestamp: Date.now(), 
                     players, 
                     settings 
                 }));
             } catch (e) { console.warn("Failed to save history", e); }
          }

          // Host explicitly ended the session
          setHostEndedSession(true);
          setIsClient(false);
          localStorage.removeItem('snapscore_host_id');
          setRetryCount(0);
          // Clear local state so user sees a fresh setup screen, not the old game
          setPlayers([]);
          setSettings(DEFAULT_SETTINGS);
          localStorage.removeItem('snapscore_players');
          localStorage.removeItem('snapscore_settings');
          setView(AppView.SETUP);
      }
  };

  // Keep handler ref up to date so P2P listener always sees fresh state
  useEffect(() => {
      handleP2PMessageRef.current = handleP2PMessage;
  });

  const handleJoinGame = async (targetHostId: string, silent = false) => {
      // If we are already connected to this host, don't try again
      if (p2p.connectedPeerIds.includes(targetHostId)) {
          console.log("Already connected to", targetHostId);
          setIsJoining(false);
          setRetryCount(0);
          setIsClient(true);
          return;
      }

      joinCancelledRef.current = false;
      setIsJoining(true);
      try {
          await p2p.connect(targetHostId);
          
          if (joinCancelledRef.current) return;

          // Connection success
          setIsClient(true);
          setHostEndedSession(false);
          localStorage.setItem('snapscore_host_id', targetHostId);
          setRetryCount(0); // Reset retries on success
          
          const myId = p2p.getMyId();
          if (myId) {
              localStorage.setItem('snapscore_device_id', myId);
          }
          
          setIsMultiplayerOpen(false);
      } catch (e: any) {
          if (joinCancelledRef.current) return;
          console.error("Join Game Error:", e);
          
          // Fail Fast: If peer ID is invalid, stop retrying immediately
          if (e?.type === 'peer-unavailable' || String(e).includes('Could not connect to peer')) {
               if (!silent) alert("Could not find host. The QR code might be old.");
               setIsClient(false);
               localStorage.removeItem('snapscore_host_id');
               setRetryCount(0);
               setIsJoining(false);
               return;
          }
          
          if (!silent) {
              alert("Could not connect to host. Please try again.");
              setIsClient(false);
              localStorage.removeItem('snapscore_host_id');
          } else {
              // Increment retry count if silent failure
              setRetryCount(prev => prev + 1);
          }
      } finally {
          if (!joinCancelledRef.current) {
              setIsJoining(false);
          }
      }
  };

  const handleCancelJoin = () => {
      joinCancelledRef.current = true;
      setIsJoining(false);
      localStorage.removeItem('snapscore_host_id');
      setIsClient(false);
      setRetryCount(0);
  };

  const handleLeaveGame = () => {
      localStorage.removeItem('snapscore_host_id');
      window.location.reload();
  };

  // --- Local Storage & Migration (Only if Host) ---
  useEffect(() => {
    if (!isClient) {
        const savedPlayers = localStorage.getItem('snapscore_players');
        const savedSettings = localStorage.getItem('snapscore_settings');
        
        if (savedPlayers) {
            const parsed = JSON.parse(savedPlayers);
            const migratedPlayers: Player[] = parsed.map((p: any) => {
                if (p.rounds) return { ...p, deviceId: p.deviceId }; // Keep deviceId
                // Migration for old format
                const rounds: Round[] = (p.history || []).map((score: number) => ({
                    type: 'manual',
                    id: uuidv4(),
                    score,
                    timestamp: Date.now()
                }));
                return { id: p.id, name: p.name, rounds, deviceId: p.deviceId };
            });
            setPlayers(migratedPlayers);
            if (migratedPlayers.length > 0) setView(AppView.GAME);
        }

        if (savedSettings) {
            const parsed = JSON.parse(savedSettings);
            const migratedSettings: CardSettings = {
                ...DEFAULT_SETTINGS,
                ...parsed,
                fixedFaceValue: parsed.fixedFaceValue ?? parsed.faceValue ?? DEFAULT_SETTINGS.fixedFaceValue,
                faceCardBehavior: parsed.faceCardBehavior ?? DEFAULT_SETTINGS.faceCardBehavior,
                winningScoreType: parsed.winningScoreType ?? DEFAULT_SETTINGS.winningScoreType
            };
            setSettings(migratedSettings);
        }
    }
  }, []);

  useEffect(() => {
    if (!isClient) {
        localStorage.setItem('snapscore_players', JSON.stringify(players));
    }
  }, [players, isClient]);

  useEffect(() => {
    if (!isClient) {
        localStorage.setItem('snapscore_settings', JSON.stringify(settings));
    }
  }, [settings, isClient]);


  // --- Actions ---

  const handleStartGame = (newPlayers: Player[]) => {
    const currentDeviceId = peerId || localStorage.getItem('snapscore_device_id');
    const playersWithIdentity = newPlayers.map(p => ({ 
        ...p, 
        deviceId: currentDeviceId || undefined 
    }));

    if (isClient) {
        p2p.sendToHost({ type: 'REQUEST_ADD_PLAYERS', payload: playersWithIdentity });
        return;
    }
    
    // Ensure host state is clean
    setIsClient(false);
    localStorage.removeItem('snapscore_host_id');

    setPlayers(prev => [...prev, ...playersWithIdentity]);
    setView(AppView.GAME);

    if (peerId) localStorage.setItem('snapscore_device_id', peerId);
  };

  const handleUpdatePlayers = (newPlayers: Player[]) => {
      if (isClient) return; 
      setPlayers(newPlayers);
  };
  
  const handleRemovePlayer = (playerId: string) => {
      if (isClient) {
          p2p.sendToHost({ type: 'REQUEST_REMOVE_PLAYER', payload: { playerId } });
          return;
      }
      setPlayers(prev => prev.filter(p => p.id !== playerId));
  };

  const handleSaveRound = (playerId: string, round: Round) => {
    if (isClient) {
        p2p.sendToHost({
            type: 'REQUEST_SAVE_ROUND',
            payload: { playerId, round }
        });
        return;
    }

    setPlayers(prev => prev.map(p => {
      if (p.id === playerId) {
        const existingRoundIndex = p.rounds.findIndex(r => r.id === round.id);
        let newRounds;
        
        if (existingRoundIndex >= 0) {
            newRounds = [...p.rounds];
            newRounds[existingRoundIndex] = round;
        } else {
            newRounds = [...p.rounds, round];
        }
        
        return {
          ...p,
          rounds: newRounds
        };
      }
      return p;
    }));
  };

  // Soft Reset: Clears scores, keeps players, goes to lobby
  const handleRestartGame = () => {
    if (isClient) {
        // Clients technically shouldn't trigger this, but if they do:
        p2p.sendToHost({ type: 'REQUEST_RESET', payload: null });
        return;
    }

    // Save history
    if (players.length > 0) {
        try {
            localStorage.setItem('snapscore_last_game', JSON.stringify({ 
                timestamp: Date.now(), 
                players, 
                settings 
            }));
        } catch (e) { console.warn("Failed to save history", e); }
    }
    
    // Clear rounds, keep players
    const resetPlayers = players.map(p => ({ ...p, rounds: [] }));
    setPlayers(resetPlayers);
    
    // Go to Lobby
    setView(AppView.SETUP);
  };

  // Hard Reset: Clears everything, destroys session, new ID
  const handleClearSession = async () => {
    if (isClient) return;

    // Broadcast end to clients
    p2p.broadcast({ type: 'GAME_ENDED', payload: null });

    // Wait briefly then destroy
    setTimeout(() => {
        setPlayers([]);
        localStorage.removeItem('snapscore_players');
        localStorage.removeItem('snapscore_device_id');
        localStorage.removeItem('snapscore_host_id');
        setIsClient(false);
        setIsJoining(false);
        
        p2p.destroy();
        
        // Start fresh
        p2p.init().then(id => {
            setPeerId(id);
        });
        
        setView(AppView.SETUP);
    }, 500);
  };

  const handleUpdateSettings = (newSettings: CardSettings) => {
      if (isClient) {
          p2p.sendToHost({ type: 'REQUEST_SETTINGS_UPDATE', payload: newSettings });
          return;
      }
      setSettings(newSettings);
      setView(players.length > 0 ? AppView.GAME : AppView.SETUP);
  };

  const handleRequestScan = (playerId: string, roundId?: string) => {
    setScanPlayerId(playerId);
    setScanRoundId(roundId || null);
    setView(AppView.SCAN);
  };

  const handleScanComplete = (round: Round) => {
    if (scanPlayerId) {
      handleSaveRound(scanPlayerId, round);
      setScanPlayerId(null);
      setScanRoundId(null);
      setView(AppView.GAME);
    }
  };

  const handleCancelScan = () => {
    setScanPlayerId(null);
    setScanRoundId(null);
    setView(AppView.GAME);
  }

  // Only show blocking loading screen for initial join. 
  // If disconnected during game, we show "Offline" badge in GameView instead.
  const showLoading = isJoining;

  if (showLoading) {
      return (
          <div className="h-[100dvh] bg-felt-900 flex flex-col items-center justify-center p-6">
              <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-6"></div>
              <h2 className="text-xl font-bold text-white animate-pulse">
                Joining Game...
              </h2>
              <p className="text-sm text-slate-400 mt-2 text-center max-w-[250px]">
                Connecting to host...
              </p>
              
              <div className="mt-6 p-4 bg-slate-800/30 rounded-lg text-center border border-slate-700/30 w-full max-w-xs">
                   <p className="text-xs text-slate-500 font-mono mb-2">
                       <span className="block uppercase text-[10px] tracking-wider text-slate-600 font-bold">My Device ID</span>
                       <span className="text-slate-300 select-all">{localStorage.getItem('snapscore_device_id') || peerId || 'Generating...'}</span>
                   </p>
                   <p className="text-xs text-slate-500 font-mono">
                       <span className="block uppercase text-[10px] tracking-wider text-slate-600 font-bold">Connecting To Host</span>
                       <span className="text-slate-300 select-all">{localStorage.getItem('snapscore_host_id') || 'Unknown'}</span>
                   </p>
              </div>

              <Button variant="secondary" onClick={handleCancelJoin} className="mt-8 border border-slate-700 bg-slate-800/50 text-slate-300 hover:text-white">
                  Cancel
              </Button>
          </div>
      );
  }

  return (
    <div className="max-w-md mx-auto h-[100dvh] bg-felt-900 flex flex-col shadow-2xl relative overflow-hidden">
      {hostEndedSession && (
          <div className="absolute top-0 left-0 right-0 bg-red-500 text-white text-center p-3 z-50 flex justify-between items-center shadow-lg animate-slide-down">
              <span className="text-sm font-bold ml-2">Host has ended the game.</span>
              <button onClick={() => setHostEndedSession(false)} className="p-1 hover:bg-red-600 rounded-full">
                  <IconX className="w-5 h-5" />
              </button>
          </div>
      )}

      {isMultiplayerOpen && (
          <MultiplayerModal 
            hostId={peerId} 
            onClose={() => setIsMultiplayerOpen(false)}
            onJoin={(id) => handleJoinGame(id)}
            connectedPeers={connectedPeerIds}
            players={players}
          />
      )}

      {view === AppView.SETUP && (
        <SetupView 
          onStart={handleStartGame} 
          onOpenSettings={() => setView(AppView.SETTINGS)}
          onOpenMultiplayer={() => setIsMultiplayerOpen(true)}
          isClient={isClient}
          players={players}
          onClearSession={handleClearSession}
          onRemovePlayer={handleRemovePlayer}
        />
      )}

      {view === AppView.SETTINGS && (
        <SettingsView 
          settings={settings} 
          onSave={handleUpdateSettings}
          onCancel={() => setView(players.length > 0 ? AppView.GAME : AppView.SETUP)}
          isClient={isClient}
          onLeave={handleLeaveGame}
        />
      )}

      {view === AppView.GAME && (
        <GameView 
          players={players}
          settings={settings}
          onSaveRound={handleSaveRound}
          onUpdatePlayers={handleUpdatePlayers}
          onRequestScan={handleRequestScan}
          onOpenSettings={() => setView(AppView.SETTINGS)}
          onNewGame={handleRestartGame}
          onLeave={handleLeaveGame}
          onOpenMultiplayer={() => setIsMultiplayerOpen(true)}
          isClient={isClient}
          isConnected={!isClient || connectedPeers > 0}
        />
      )}

      {view === AppView.SCAN && scanPlayerId && (
        <ScanView 
          player={players.find(p => p.id === scanPlayerId)!}
          existingRoundId={scanRoundId || undefined}
          settings={settings}
          onComplete={handleScanComplete}
          onCancel={handleCancelScan}
        />
      )}
    </div>
  );
};

export default App;
