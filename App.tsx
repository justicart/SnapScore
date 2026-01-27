
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
  
  const [isClientState, setIsClientState] = useState(() => !!localStorage.getItem('snapscore_host_id'));
  
  const {
      players, setPlayers,
      settings, setSettings,
      view, setView,
      scanPlayerId, setScanPlayerId,
      scanRoundId, setScanRoundId,
      targetRoundIndex, setTargetRoundIndex,
      updatePlayerRound,
      deletePlayerRound,
      removePlayer,
      addPlayers,
      resetRounds,
      clearSession
  } = useGameState(isClientState);

  const handleP2PMessage = (msg: P2PMessage) => {
      if (msg.type === 'SYNC_STATE') {
          setIsClientState(true); 
          setPlayers(msg.payload.players);
          setSettings(msg.payload.settings);
          if (msg.payload.view === AppView.GAME || msg.payload.view === AppView.SETUP) {
              setView(msg.payload.view);
          }
      } else if (msg.type === 'REQUEST_SAVE_ROUND') {
          updatePlayerRound(msg.payload.playerId, msg.payload.round, msg.payload.index);
      } else if (msg.type === 'REQUEST_DELETE_ROUND') {
          deletePlayerRound(msg.payload.playerId, msg.payload.roundId);
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
          clearSession();
          setView(AppView.SETUP);
      }
  };

  const multiplayer = useMultiplayer({
      players,
      settings,
      view,
      onMessage: handleP2PMessage
  });

  if (multiplayer.isClient !== isClientState) {
      setIsClientState(multiplayer.isClient);
  }

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
    
    addPlayers(playersWithIdentity);
    setView(AppView.GAME);
  };

  const handleSaveRound = (playerId: string, round: Round, index?: number) => {
    if (isClientState) {
        multiplayer.sendToHostAction({ type: 'REQUEST_SAVE_ROUND', payload: { playerId, round, index } });
        return;
    }
    updatePlayerRound(playerId, round, index);
  };

  const handleDeleteRound = (playerId: string, roundId: string) => {
    if (isClientState) {
        multiplayer.sendToHostAction({ type: 'REQUEST_DELETE_ROUND', payload: { playerId, roundId } });
        return;
    }
    deletePlayerRound(playerId, roundId);
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
    if (isClientState) {
        multiplayer.handleLeaveGame();
        return;
    }
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

  const handleRequestScan = (playerId: string, roundId?: string, index?: number) => {
    setScanPlayerId(playerId);
    setScanRoundId(roundId || null);
    setTargetRoundIndex(index !== undefined ? index : null);
    setView(AppView.SCAN);
  };

  const handleReconnect = () => {
      const hostId = localStorage.getItem('snapscore_host_id');
      if (isClientState && hostId) {
          multiplayer.handleJoinGame(hostId);
      } else {
          // Soft refresh for host to reset Peer connection
          window.location.reload();
      }
  };

  if (multiplayer.isJoining) {
      return (
          <div className="h-[100dvh] bg-felt-900 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-8"></div>
              <h2 className="text-2xl font-bold text-white mb-2">Syncing Stream</h2>
              <p className="text-slate-400">Negotiating durable connection...</p>
          </div>
      );
  }

  return (
    <div className="max-w-md mx-auto h-[100dvh] bg-felt-900 flex flex-col shadow-2xl relative overflow-hidden">
      {multiplayer.hostEndedSession && (
          <div className="absolute top-0 left-0 right-0 bg-red-500 text-white text-center p-3 z-50 flex justify-between items-center animate-slide-down">
              <span className="text-sm font-bold">Host ended session.</span>
              <button onClick={() => multiplayer.setHostEndedSession(false)} className="p-1"><IconX className="w-5 h-5" /></button>
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
          settings={settings}
          onClearSession={handleClearSession}
          onRemovePlayer={(id) => {
              if (isClientState) multiplayer.sendToHostAction({ type: 'REQUEST_REMOVE_PLAYER', payload: { playerId: id } });
              else removePlayer(id);
          }}
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
          onDeleteRound={handleDeleteRound}
          onUpdatePlayers={setPlayers}
          onRequestScan={handleRequestScan}
          onOpenSettings={() => setView(AppView.SETTINGS)}
          onNewGame={handleRestartGame}
          onLeave={multiplayer.handleLeaveGame}
          onOpenMultiplayer={() => setIsMultiplayerOpen(true)}
          onReconnect={handleReconnect}
          isClient={isClientState}
          isMultiplayer={isClientState || multiplayer.connectedPeerIds.length > 0}
          isConnected={!isClientState || multiplayer.connectedPeers > 0}
        />
      )}

      {view === AppView.SCAN && scanPlayerId && (
        <ScanView 
          player={players.find(p => p.id === scanPlayerId)!}
          players={players}
          existingRoundId={scanRoundId || undefined}
          targetIndex={targetRoundIndex !== null ? targetRoundIndex : undefined}
          settings={settings}
          onComplete={(round, index) => {
            handleSaveRound(scanPlayerId, round, index);
            setScanPlayerId(null);
            setScanRoundId(null);
            setTargetRoundIndex(null);
            setView(AppView.GAME);
          }}
          onCancel={() => { 
            setScanPlayerId(null); 
            setTargetRoundIndex(null);
            setView(AppView.GAME); 
          }}
        />
      )}
    </div>
  );
};

export default App;
