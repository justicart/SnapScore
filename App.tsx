
import React, { useState, useEffect } from 'react';
import { Player, AppView, CardSettings, Round, GameState, P2PMessage } from './types';
import { SetupView } from './views/SetupView';
import { GameView } from './views/GameView';
import { SettingsView } from './views/SettingsView';
import { ScanView } from './views/ScanView';
import { MultiplayerModal } from './components/MultiplayerModal';
import { p2p } from './services/p2pService';
import { v4 as uuidv4 } from 'uuid';

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
  const [scanRoundId, setScanRoundId] = useState<string | null>(null);

  // Multiplayer State
  const [isMultiplayerOpen, setIsMultiplayerOpen] = useState(false);
  const [peerId, setPeerId] = useState<string>('');
  const [connectedPeers, setConnectedPeers] = useState<number>(0);
  const [isClient, setIsClient] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  // --- P2P Setup ---
  useEffect(() => {
    const initP2p = async () => {
      try {
        const id = await p2p.init();
        setPeerId(id);
        
        p2p.onMessage((msg) => {
          handleP2PMessage(msg);
        });

        setInterval(() => {
             // @ts-ignore
             if (p2p.connections) setConnectedPeers(p2p.connections.length);
        }, 2000);

        const params = new URLSearchParams(window.location.search);
        const joinId = params.get('join');
        if (joinId) {
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
  useEffect(() => {
    if (!isClient && connectedPeers > 0) {
        broadcastState();
    }
  }, [players, settings, view, connectedPeers]);

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
      }
  };

  const handleJoinGame = async (targetHostId: string) => {
      setIsJoining(true);
      try {
          await p2p.connect(targetHostId);
          setIsClient(true);
          setIsMultiplayerOpen(false);
      } catch (e) {
          console.error(e);
          alert("Could not connect to host.");
      } finally {
          setIsJoining(false);
      }
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
                faceCardBehavior: parsed.faceCardBehavior ?? DEFAULT_SETTINGS.faceCardBehavior
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
    if (isClient) return;
    setPlayers(newPlayers);
    setView(AppView.GAME);
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

  if (isJoining) {
      return (
          <div className="min-h-screen bg-felt-900 flex flex-col items-center justify-center p-6">
              <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-6"></div>
              <h2 className="text-xl font-bold text-white animate-pulse">Joining Game...</h2>
          </div>
      );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-felt-900 flex flex-col shadow-2xl relative overflow-hidden">
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
          settings={settings}
          onSaveRound={handleSaveRound}
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
