
import React, { useState, useEffect, useRef } from 'react';
import { Player, AppView, CardSettings, Round, P2PMessage } from './types';
import { SetupView } from './views/SetupView';
import { GameView } from './views/GameView';
import { SettingsView } from './views/SettingsView';
import { ScanView } from './views/ScanView';
import { MultiplayerModal } from './components/MultiplayerModal';
import { Button } from './components/Button';
import { p2p } from './services/p2pService';
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
  
  // Initialize isClient based on localStorage to support refresh/reconnect
  const [isClient, setIsClient] = useState(() => !!localStorage.getItem('snapscore_host_id'));
  const [isJoining, setIsJoining] = useState(false);
  
  // Refs
  const joinCancelledRef = useRef(false);
  
  // Force sync effect on connection events
  const [p2pUpdateTick, setP2pUpdateTick] = useState(0);
  
  // --- P2P Setup ---
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

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
        // 4. NOTE: If storedDeviceId was invalid/taken, p2p.init returned a NEW id. Update storage.
        if ((storedDeviceId || storedHostId || joinId) && storedDeviceId !== id) {
            localStorage.setItem('snapscore_device_id', id);
        }
        
        p2p.onMessage((msg) => {
          handleP2PMessage(msg);
        });
        
        p2p.onConnectionChange(() => {
            setConnectedPeers(p2p.activeConnectionsCount);
            setP2pUpdateTick(t => t + 1);
        });

        // Backup polling interval (just in case events miss)
        intervalId = setInterval(() => {
             const count = p2p.activeConnectionsCount;
             if (count !== connectedPeers) {
                 setConnectedPeers(count);
             }
        }, 5000);

        if (joinId) {
            window.history.replaceState({}, document.title, window.location.pathname);
            handleJoinGame(joinId);
        } else if (storedHostId) {
            handleJoinGame(storedHostId, true);
        }

      } catch (err) {
        // Suppress expected PeerJS disconnection errors during hot reloads
        if (String(err).includes("Lost connection")) return;
        console.error("Failed to init P2P", err);
      }
    };
    initP2p();

    // Cleanup on unload to help PeerJS server release ID faster
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
        // If we have active connections (Host with peers OR Client connected to Host),
        // we must persist our ID to survive refreshes.
        localStorage.setItem('snapscore_device_id', peerId);
    }
  }, [connectedPeers, peerId]);

  // --- Auto-Reconnect Effect ---
  useEffect(() => {
    // If we think we are a client, but we have no connections, try to reconnect
    if (!isClient) return;

    if (connectedPeers === 0) {
      const hostId = localStorage.getItem('snapscore_host_id');
      if (hostId) {
        // Debounce reconnection attempts
        const timer = setTimeout(() => {
            if (!isJoining && connectedPeers === 0) {
                console.log("Connection lost. Attempting to reconnect to host:", hostId);
                handleJoinGame(hostId, true);
            }
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [isClient, connectedPeers, isJoining]);

  // --- Sync Logic ---
  useEffect(() => {
    // If I am Host and I have peers, broadcast state
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
          setPlayers(msg.payload.players);
          setSettings(msg.payload.settings);
          if (msg.payload.view === AppView.GAME || msg.payload.view === AppView.SETUP) {
              setView(msg.payload.view);
          }
      } else if (msg.type === 'REQUEST_SAVE_ROUND') {
          handleSaveRound(msg.payload.playerId, msg.payload.round);
      } else if (msg.type === 'REQUEST_RESET') {
          handleResetGame();
      } else if (msg.type === 'REQUEST_SETTINGS_UPDATE') {
          setSettings(msg.payload);
      } else if (msg.type === 'REQUEST_ADD_PLAYERS') {
          setPlayers(prev => [...prev, ...msg.payload]);
      }
  };

  const handleJoinGame = async (targetHostId: string, silent = false) => {
      joinCancelledRef.current = false;
      setIsJoining(true);
      try {
          await p2p.connect(targetHostId);
          
          // Check if user cancelled while connecting
          if (joinCancelledRef.current) return;

          setIsClient(true);
          localStorage.setItem('snapscore_host_id', targetHostId);
          
          // Ensure our ID is persisted so we can reconnect if we refresh
          const myId = p2p.getMyId();
          if (myId) {
              localStorage.setItem('snapscore_device_id', myId);
          }
          
          setIsMultiplayerOpen(false);
      } catch (e) {
          if (joinCancelledRef.current) return;
          console.error("Join Game Error:", e);
          if (!silent) alert("Could not connect to host. Please try again.");
          // Do not remove localStorage item here to allow retries on refresh/reconnect
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
      setIsClient(false); // Stop auto-reconnect loop
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
            // Migration check: if players have 'history' (array of numbers), convert to 'rounds'
            const migratedPlayers: Player[] = parsed.map((p: any) => {
                if (p.rounds) return p;
                // Convert old history of numbers to Manual rounds
                const rounds: Round[] = (p.history || []).map((score: number) => ({
                    type: 'manual',
                    id: uuidv4(),
                    score,
                    timestamp: Date.now()
                }));
                return { id: p.id, name: p.name, rounds };
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
    if (isClient) {
        p2p.sendToHost({ type: 'REQUEST_ADD_PLAYERS', payload: newPlayers });
        return;
    }
    
    // Host merges new players with existing ones
    setPlayers(prev => [...prev, ...newPlayers]);
    setView(AppView.GAME);

    // We are committing to a session (Game Started), so persist the ID to survive refreshes.
    // This ensures the Host ID stays stable even if no one has connected yet.
    if (peerId) localStorage.setItem('snapscore_device_id', peerId);
  };

  const handleUpdatePlayers = (newPlayers: Player[]) => {
      if (isClient) return; // Clients cannot reorder/delete roster directly
      setPlayers(newPlayers);
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
        // Check if this round ID already exists (update) or is new (append)
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

  const handleResetGame = () => {
    if (isClient) {
        p2p.sendToHost({ type: 'REQUEST_RESET', payload: null });
        return;
    }
    // Host Logic: New Game -> New ID
    setPlayers([]);
    localStorage.removeItem('snapscore_players');
    
    // Explicitly destroy old session and generate new ID
    localStorage.removeItem('snapscore_device_id');
    p2p.destroy();
    
    p2p.init().then(id => {
        setPeerId(id);
        // Do NOT save snapscore_device_id yet; waiting for Start Game or Connection
    });
    
    setView(AppView.SETUP);
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

  // Show loading screen if manually joining OR if we are a disconnected client trying to reconnect
  const showLoading = isJoining || (isClient && connectedPeers === 0);

  if (showLoading) {
      return (
          <div className="h-[100dvh] bg-felt-900 flex flex-col items-center justify-center p-6">
              <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-6"></div>
              <h2 className="text-xl font-bold text-white animate-pulse">
                {isJoining ? "Joining Game..." : "Reconnecting..."}
              </h2>
              <p className="text-sm text-slate-400 mt-2 text-center max-w-[250px]">
                {isJoining 
                  ? "Connecting to host..." 
                  : "Lost connection to host. Retrying..."
                }
              </p>
              <Button variant="secondary" onClick={handleCancelJoin} className="mt-8 border border-slate-700 bg-slate-800/50 text-slate-300 hover:text-white">
                  Cancel
              </Button>
          </div>
      );
  }

  return (
    <div className="max-w-md mx-auto h-[100dvh] bg-felt-900 flex flex-col shadow-2xl relative overflow-hidden">
      {isMultiplayerOpen && (
          <MultiplayerModal 
            hostId={peerId} 
            onClose={() => setIsMultiplayerOpen(false)}
            onJoin={(id) => handleJoinGame(id)}
            connectedPeersCount={connectedPeers}
          />
      )}

      {view === AppView.SETUP && (
        <SetupView 
          onStart={handleStartGame} 
          onOpenSettings={() => setView(AppView.SETTINGS)}
          onOpenMultiplayer={() => setIsMultiplayerOpen(true)}
          isClient={isClient}
          players={players}
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
          onReset={handleResetGame}
          onOpenMultiplayer={() => setIsMultiplayerOpen(true)}
          isClient={isClient}
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
