import React, { useState, useEffect, useRef } from 'react';
import { Player, AppView, CardSettings, ScanResult, GameState, P2PMessage } from './types';
import { SetupView } from './views/SetupView';
import { GameView } from './views/GameView';
import { SettingsView } from './views/SettingsView';
import { ScanView } from './views/ScanView';
import { MultiplayerModal } from './components/MultiplayerModal';
import { p2p } from './services/p2pService';

const DEFAULT_SETTINGS: CardSettings = {
  jokerValue: 50,
  aceValue: 20,
  faceCardBehavior: 'fixed',
  fixedFaceValue: 10,
  numberCardBehavior: 'face',
  fixedNumberValue: 5
};

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.SETUP);
  const [players, setPlayers] = useState<Player[]>([]);
  const [settings, setSettings] = useState<CardSettings>(DEFAULT_SETTINGS);
  
  // Scanning State
  const [scanPlayerId, setScanPlayerId] = useState<string | null>(null);

  // Multiplayer State
  const [isMultiplayerOpen, setIsMultiplayerOpen] = useState(false);
  const [peerId, setPeerId] = useState<string>('');
  const [connectedPeers, setConnectedPeers] = useState<number>(0);
  const [isClient, setIsClient] = useState(false); // If true, we are NOT the host

  // --- P2P Setup ---
  useEffect(() => {
    // Initialize P2P immediately as host/local
    const initP2p = async () => {
      try {
        const id = await p2p.init();
        setPeerId(id);
        
        p2p.onMessage((msg) => {
          handleP2PMessage(msg);
        });

        // Only tracking connection count indirectly for now by checking connection array length
        // In a real app, p2pService would emit connection events. 
        // Hack: Poll for connection count or add event emitter to service.
        // For simplicity, we just update it when we get a message or broadcast.
        setInterval(() => {
             // @ts-ignore - accessing private for quick count, ideally service exposes getter
             if (p2p.connections) setConnectedPeers(p2p.connections.length);
        }, 2000);

        // Check for join link in URL
        const params = new URLSearchParams(window.location.search);
        const joinId = params.get('join');
        if (joinId) {
            console.log("Found join ID in URL:", joinId);
            // Clean URL immediately to avoid re-joining on refresh if logic changes
            window.history.replaceState({}, document.title, window.location.pathname);
            handleJoinGame(joinId);
        }

      } catch (err) {
        console.error("Failed to init P2P", err);
      }
    };
    initP2p();

    return () => {
      p2p.destroy();
    };
  }, []);

  // --- Sync Logic ---

  // If we are HOST, anytime players or settings change, broadcast to clients
  useEffect(() => {
    if (!isClient && connectedPeers > 0) {
        // Small debounce could be good here
        broadcastState();
    }
  }, [players, settings, view, connectedPeers]); // removed isClient to avoid loop

  const broadcastState = () => {
     p2p.broadcast({
         type: 'SYNC_STATE',
         payload: {
             players,
             settings,
             view: view === AppView.SCAN ? AppView.GAME : view // Don't sync Scan view to others, keep them on Game
         }
     });
  };

  const handleP2PMessage = (msg: P2PMessage) => {
      if (msg.type === 'SYNC_STATE') {
          // We are a client receiving state
          setIsClient(true);
          setPlayers(msg.payload.players);
          setSettings(msg.payload.settings);
          // We generally follow the host's view, but maybe not into Settings/Scan screens blindly
          if (msg.payload.view === AppView.GAME || msg.payload.view === AppView.SETUP) {
              setView(msg.payload.view);
          }
      } else if (msg.type === 'REQUEST_SCORE_UPDATE') {
          // We are host receiving a score update request
          handleUpdateScore(msg.payload.playerId, msg.payload.scoreToAdd);
      } else if (msg.type === 'REQUEST_RESET') {
          handleResetGame();
      } else if (msg.type === 'REQUEST_SETTINGS_UPDATE') {
          setSettings(msg.payload);
      }
  };

  const handleJoinGame = async (targetHostId: string) => {
      try {
          // Visual feedback handled by UI state change if successful
          await p2p.connect(targetHostId);
          setIsClient(true);
          setIsMultiplayerOpen(false);
          // We don't alert here, the UI will update to "JOINED" badge in GameView
      } catch (e) {
          console.error(e);
          alert("Could not connect to host. The game may have ended or the ID is incorrect.");
      }
  };

  // --- Local Storage (Only if Host) ---
  useEffect(() => {
    if (!isClient) {
        const savedPlayers = localStorage.getItem('snapscore_players');
        const savedSettings = localStorage.getItem('snapscore_settings');
        if (savedPlayers) {
            const p = JSON.parse(savedPlayers);
            setPlayers(p);
            if (p.length > 0) setView(AppView.GAME);
        }
        if (savedSettings) {
            const parsed = JSON.parse(savedSettings);
             const migratedSettings: CardSettings = {
                ...DEFAULT_SETTINGS,
                ...parsed,
                fixedFaceValue: parsed.fixedFaceValue ?? parsed.faceValue ?? DEFAULT_SETTINGS.fixedFaceValue,
                faceCardBehavior: parsed.faceCardBehavior ?? DEFAULT_SETTINGS.faceCardBehavior
            };
            setSettings(migratedSettings);
        }
    }
  }, []); // On mount only

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
    if (isClient) return; // Clients shouldn't start games directly usually
    setPlayers(newPlayers);
    setView(AppView.GAME);
  };

  const handleUpdateScore = (playerId: string, scoreToAdd: number) => {
    if (isClient) {
        p2p.sendToHost({
            type: 'REQUEST_SCORE_UPDATE',
            payload: { playerId, scoreToAdd }
        });
        return;
    }

    setPlayers(prev => prev.map(p => {
      if (p.id === playerId) {
        return {
          ...p,
          score: p.score + scoreToAdd,
          history: [...p.history, scoreToAdd]
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
    setPlayers([]);
    localStorage.removeItem('snapscore_players');
    setView(AppView.SETUP);
  };

  const handleUpdateSettings = (newSettings: CardSettings) => {
      if (isClient) {
          p2p.sendToHost({ type: 'REQUEST_SETTINGS_UPDATE', payload: newSettings });
          return;
      }
      setSettings(newSettings);
      // Logic for navigation
      setView(players.length > 0 ? AppView.GAME : AppView.SETUP);
  };

  const handleRequestScan = (playerId: string) => {
    setScanPlayerId(playerId);
    setView(AppView.SCAN);
  };

  const handleScanComplete = (score: number) => {
    if (scanPlayerId) {
      handleUpdateScore(scanPlayerId, score);
      setScanPlayerId(null);
      setView(AppView.GAME);
    }
  };

  const handleCancelScan = () => {
    setScanPlayerId(null);
    setView(AppView.GAME);
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-felt-900 flex flex-col shadow-2xl relative overflow-hidden">
      {/* Multiplayer Modal Overlay */}
      {isMultiplayerOpen && (
          <MultiplayerModal 
            hostId={peerId} 
            onClose={() => setIsMultiplayerOpen(false)}
            onJoin={handleJoinGame}
            connectedPeersCount={connectedPeers}
          />
      )}

      {view === AppView.SETUP && (
        <SetupView 
          onStart={handleStartGame} 
          onOpenSettings={() => setView(AppView.SETTINGS)}
          onOpenMultiplayer={() => setIsMultiplayerOpen(true)}
        />
      )}

      {view === AppView.SETTINGS && (
        <SettingsView 
          settings={settings} 
          onSave={handleUpdateSettings}
          onCancel={() => setView(players.length > 0 ? AppView.GAME : AppView.SETUP)}
        />
      )}

      {view === AppView.GAME && (
        <GameView 
          players={players}
          onScoreUpdate={handleUpdateScore}
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
          settings={settings}
          onComplete={handleScanComplete}
          onCancel={handleCancelScan}
        />
      )}
    </div>
  );
};

export default App;