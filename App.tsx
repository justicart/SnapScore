
import React, { useState } from 'react';
import { Player, AppView, CardSettings, Round, P2PMessage } from './types';
import { SetupView } from './views/SetupView';
import { GameView } from './views/GameView';
import { SettingsView } from './views/SettingsView';
import { ScanView } from './views/ScanView';
import { MultiplayerModal } from './components/MultiplayerModal';
import { Button } from './components/Button';
import { IconX } from './components/Icons';
import { useGameState, DEFAULT_SETTINGS } from './hooks/useGameState';
import { useMultiplayer } from './hooks/useMultiplayer';

const App: React.FC = () => {
  const [isMultiplayerOpen, setIsMultiplayerOpen] = useState(false);
  
  // 1. Network State Initialization
  // We initialize the client state based on localStorage to break the dependency cycle
  // between useGameState (needs isClient) and useMultiplayer (determines isClient).
  const [isClientState, setIsClientState] = useState(() => !!localStorage.getItem('snapscore_host_id'));
  
  // 2. Game State
  const {
      players, setPlayers,
      settings, setSettings,
      view, setView,
      scanPlayerId, setScanPlayerId,
      scanRoundId, setScanRoundId,
      updatePlayerRound,
      removePlayer,
      addPlayers,
      resetRounds,
      clearSession
  } = useGameState(isClientState);

  // 3. Message Handler
  // Defined here so it can access the state setters from useGameState
  const handleP2PMessage = (msg: P2PMessage) => {
      if (msg.type === 'SYNC_STATE') {
          setIsClientState(true); 
          setPlayers(msg.payload.players);
          setSettings(msg.payload.settings);
          if (msg.payload.view === AppView.GAME || msg.payload.view === AppView.SETUP) {
              setView(msg.payload.view);
          }
      } else if (msg.type === 'REQUEST_SAVE_ROUND') {
          handleSaveRoundLogic(msg.payload.playerId, msg.payload.round, true); // force local update
      } else if (msg.type === 'REQUEST_RESET') {
          resetRounds();
          setView(AppView.SETUP);
      } else if (msg.type === 'REQUEST_SETTINGS_UPDATE') {
          setSettings(msg.payload);
      } else if (msg.type === 'REQUEST_ADD_PLAYERS') {
          addPlayers(msg.payload);
      } else if (msg.type === 'REQUEST_REMOVE_PLAYER') {
          removePlayer(msg.payload.playerId);
      } else if (msg.type === 'GAME_ENDED') {
          multiplayer.setHostEndedSession(true);
          setIsClientState(false);
          localStorage.removeItem('snapscore_host_id');
          multiplayer.setRetryCount(0);
          
          clearSession();
          setView(AppView.SETUP);
      }
  };

  // 4. Multiplayer Hook
  const multiplayer = useMultiplayer({
      players,
      settings,
      view,
      onMessage: handleP2PMessage
  });

  // Sync internal isClientState with multiplayer hook's source of truth
  if (multiplayer.isClient !== isClientState) {
      setIsClientState(multiplayer.isClient);
  }

  // --- Actions ---

  const handleStartGame = (newPlayers: Player[]) => {
    const currentDeviceId = multiplayer.peerId || localStorage.getItem('snapscore_device_id');
    const playersWithIdentity = newPlayers.map(p => ({ 
        ...p, 
        deviceId: currentDeviceId || undefined 
    }));

    if (isClientState) {
        multiplayer.sendToHostAction({ type: 'REQUEST_ADD_PLAYERS', payload: playersWithIdentity });
        return;
    }
    
    // Ensure host state is clean
    setIsClientState(false);
    localStorage.removeItem('snapscore_host_id');

    addPlayers(playersWithIdentity);
    setView(AppView.GAME);

    if (multiplayer.peerId) localStorage.setItem('snapscore_device_id', multiplayer.peerId);
  };

  const handleUpdatePlayers = (newPlayers: Player[]) => {
      if (isClientState) return; 
      setPlayers(newPlayers);
  };
  
  const handleRemovePlayer = (playerId: string) => {
      if (isClientState) {
          multiplayer.sendToHostAction({ type: 'REQUEST_REMOVE_PLAYER', payload: { playerId } });
          return;
      }
      removePlayer(playerId);
  };

  // Split logic: Routing vs Execution
  const handleSaveRound = (playerId: string, round: Round) => {
    if (isClientState) {
        multiplayer.sendToHostAction({
            type: 'REQUEST_SAVE_ROUND',
            payload: { playerId, round }
        });
        return;
    }
    handleSaveRoundLogic(playerId, round);
  };

  const handleSaveRoundLogic = (playerId: string, round: Round, isRemoteRequest = false) => {
      // If we are client and receiving this, we update (synced). 
      // If we are host, we update.
      updatePlayerRound(playerId, round);
  };

  const handleRestartGame = () => {
    if (isClientState) {
        multiplayer.sendToHostAction({ type: 'REQUEST_RESET', payload: null });
        return;
    }
    resetRounds();
    setView(AppView.SETUP);
  };

  const handleClearSession = async () => {
    if (isClientState) return;
    multiplayer.handleHostEndSession();
    clearSession();
    setIsClientState(false);
    setView(AppView.SETUP);
  };

  const handleUpdateSettings = (newSettings: CardSettings) => {
      if (isClientState) {
          multiplayer.sendToHostAction({ type: 'REQUEST_SETTINGS_UPDATE', payload: newSettings });
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

  // --- Rendering ---
  
  const showLoading = multiplayer.isJoining;

  if (showLoading) {
      return (
          <div className="h-[100dvh] bg-felt-900 flex flex-col items-center justify-center p-6">
              <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-6"></div>
              <h2 className="text-xl font-bold text-white animate-pulse">
                {localStorage.getItem('snapscore_host_id') ? 'Reconnecting...' : 'Joining Game...'}
              </h2>
              <p className="text-sm text-slate-400 mt-2 text-center max-w-[250px]">
                Syncing with host...
              </p>
              
              <div className="mt-6 p-4 bg-slate-800/30 rounded-lg text-center border border-slate-700/30 w-full max-w-xs">
                   <p className="text-xs text-slate-500 font-mono mb-2">
                       <span className="block uppercase text-[10px] tracking-wider text-slate-600 font-bold">My Device ID</span>
                       <span className="text-slate-300 select-all">{localStorage.getItem('snapscore_device_id') || multiplayer.peerId || 'Generating...'}</span>
                   </p>
                   <p className="text-xs text-slate-500 font-mono">
                       <span className="block uppercase text-[10px] tracking-wider text-slate-600 font-bold">Connecting To Host</span>
                       <span className="text-slate-300 select-all">{localStorage.getItem('snapscore_host_id') || 'Unknown'}</span>
                   </p>
              </div>

              <Button variant="secondary" onClick={multiplayer.handleCancelJoin} className="mt-8 border border-slate-700 bg-slate-800/50 text-slate-300 hover:text-white">
                  Cancel
              </Button>
          </div>
      );
  }

  return (
    <div className="max-w-md mx-auto h-[100dvh] bg-felt-900 flex flex-col shadow-2xl relative overflow-hidden">
      {multiplayer.hostEndedSession && (
          <div className="absolute top-0 left-0 right-0 bg-red-500 text-white text-center p-3 z-50 flex justify-between items-center shadow-lg animate-slide-down">
              <span className="text-sm font-bold ml-2">Host has ended the game.</span>
              <button onClick={() => multiplayer.setHostEndedSession(false)} className="p-1 hover:bg-red-600 rounded-full">
                  <IconX className="w-5 h-5" />
              </button>
          </div>
      )}

      {isMultiplayerOpen && (
          <MultiplayerModal 
            hostId={multiplayer.peerId} 
            onClose={() => setIsMultiplayerOpen(false)}
            onJoin={(id) => multiplayer.handleJoinGame(id)}
            connectedPeers={multiplayer.connectedPeerIds}
            players={players}
          />
      )}

      {view === AppView.SETUP && (
        <SetupView 
          onStart={handleStartGame} 
          onOpenSettings={() => setView(AppView.SETTINGS)}
          onOpenMultiplayer={() => setIsMultiplayerOpen(true)}
          isClient={isClientState}
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
          isClient={isClientState}
          onLeave={multiplayer.handleLeaveGame}
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
          onLeave={multiplayer.handleLeaveGame}
          onOpenMultiplayer={() => setIsMultiplayerOpen(true)}
          isClient={isClientState}
          isConnected={!isClientState || multiplayer.connectedPeers > 0}
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
