
import { useState, useEffect, useRef } from 'react';
import { Player, CardSettings, AppView, P2PMessage } from '../types';
import { p2p } from '../services/p2pService';

interface UseMultiplayerProps {
  players: Player[];
  settings: CardSettings;
  view: AppView;
  onMessage: (msg: P2PMessage) => void;
}

export const useMultiplayer = ({ players, settings, view, onMessage }: UseMultiplayerProps) => {
  const [peerId, setPeerId] = useState<string>('');
  const [connectedPeerIds, setConnectedPeerIds] = useState<string[]>([]);
  const [isClient, setIsClient] = useState(() => !!localStorage.getItem('snapscore_host_id'));
  const [isJoining, setIsJoining] = useState(false);
  const [hostEndedSession, setHostEndedSession] = useState(false);
  
  // Refs for stable callbacks
  const onMessageRef = useRef(onMessage);
  useEffect(() => { onMessageRef.current = onMessage; });

  const reconnectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const init = async () => {
      const storedId = localStorage.getItem('snapscore_device_id');
      const id = await p2p.init(storedId || undefined);
      setPeerId(id);
      localStorage.setItem('snapscore_device_id', id);

      p2p.onMessage((msg) => {
        if (msg.type === 'GAME_ENDED') setHostEndedSession(true);
        onMessageRef.current(msg);
      });

      p2p.onConnectionChange(() => {
        const active = p2p.activePeerIds;
        setConnectedPeerIds(active);
        
        // If we are a client and lost our host, start reconnecting
        const hostId = localStorage.getItem('snapscore_host_id');
        if (isClient && hostId && active.length === 0 && !hostEndedSession) {
          startReconnectionLoop(hostId);
        } else if (active.length > 0) {
          stopReconnectionLoop();
        }
      });

      // Initial Join Logic
      const params = new URLSearchParams(window.location.search);
      const joinId = params.get('join');
      if (joinId) {
        window.history.replaceState({}, document.title, window.location.pathname);
        handleJoinGame(joinId);
      } else {
        const hostId = localStorage.getItem('snapscore_host_id');
        if (hostId) handleJoinGame(hostId, true);
      }
    };

    init();
    return () => {
      stopReconnectionLoop();
      p2p.destroy();
    };
  }, [isClient, hostEndedSession]);

  const startReconnectionLoop = (hostId: string) => {
    if (reconnectTimerRef.current) return;
    console.log("[Multiplayer] Host disconnected. Starting reconnection loop...");
    reconnectTimerRef.current = setInterval(() => {
      handleJoinGame(hostId, true);
    }, 5000); // Try every 5 seconds
  };

  const stopReconnectionLoop = () => {
    if (reconnectTimerRef.current) {
      clearInterval(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  // Broadcast Host State
  useEffect(() => {
    if (!isClient && connectedPeerIds.length > 0) {
      p2p.broadcast({
        type: 'SYNC_STATE',
        payload: {
          players,
          settings,
          view: view === AppView.SCAN ? AppView.GAME : view
        }
      });
    }
  }, [players, settings, view, connectedPeerIds, isClient]);

  const handleJoinGame = async (targetId: string, silent = false) => {
    // Prevent overlapping join attempts
    if (isJoining) return;
    
    // If we're already physically connected, no need to join
    if (p2p.activePeerIds.includes(targetId)) return;

    if (!silent) setIsJoining(true);
    try {
      await p2p.connect(targetId);
      setIsClient(true);
      setHostEndedSession(false);
      localStorage.setItem('snapscore_host_id', targetId);
      stopReconnectionLoop();
    } catch (e) {
      // Silent mode is for background retries, we don't alert the user
      if (!silent) {
        console.error("Join failed", e);
        alert("Failed to connect to host. Check the ID and try again.");
      }
    } finally {
      if (!silent) setIsJoining(false);
    }
  };

  const handleLeaveGame = () => {
    stopReconnectionLoop();
    localStorage.removeItem('snapscore_host_id');
    window.location.reload();
  };

  const handleHostEndSession = () => {
    stopReconnectionLoop();
    p2p.broadcast({ type: 'GAME_ENDED', payload: null });
    p2p.destroy();
    setIsClient(false);
    localStorage.removeItem('snapscore_host_id');
    setTimeout(() => window.location.reload(), 500);
  };

  return {
    peerId,
    isClient,
    isJoining,
    connectedPeers: connectedPeerIds.length,
    connectedPeerIds,
    handleJoinGame,
    handleLeaveGame,
    handleHostEndSession,
    sendToHostAction: (msg: P2PMessage) => {
      const hostId = localStorage.getItem('snapscore_host_id');
      if (hostId) p2p.sendTo(hostId, msg);
    },
    hostEndedSession,
    setHostEndedSession
  };
};
