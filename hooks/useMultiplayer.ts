
import { useState, useEffect, useRef } from 'react';
import { Player, CardSettings, AppView, P2PMessage } from '../types';
import { p2p } from '../services/p2pService';

const MAX_RETRIES = 5;

interface UseMultiplayerProps {
  players: Player[];
  settings: CardSettings;
  view: AppView;
  onMessage: (msg: P2PMessage) => void;
}

export const useMultiplayer = ({ players, settings, view, onMessage }: UseMultiplayerProps) => {
  const [peerId, setPeerId] = useState<string>('');
  const [connectedPeers, setConnectedPeers] = useState<number>(0);
  const [connectedPeerIds, setConnectedPeerIds] = useState<string[]>([]);
  
  const [isClient, setIsClient] = useState(() => !!localStorage.getItem('snapscore_host_id'));
  const [isJoining, setIsJoining] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [hostEndedSession, setHostEndedSession] = useState(false);
  
  // Refs
  const joinCancelledRef = useRef(false);
  const onMessageRef = useRef(onMessage);
  
  // Force sync tick
  const [p2pUpdateTick, setP2pUpdateTick] = useState(0);

  // Keep callback fresh
  useEffect(() => {
    onMessageRef.current = onMessage;
  });

  // Init P2P
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    const initP2p = async () => {
      try {
        const storedDeviceId = localStorage.getItem('snapscore_device_id');
        const storedHostId = localStorage.getItem('snapscore_host_id');
        const params = new URLSearchParams(window.location.search);
        const joinId = params.get('join');
        
        const id = await p2p.init(storedDeviceId || undefined);
        setPeerId(id);
        
        if ((storedDeviceId || storedHostId || joinId) && storedDeviceId !== id) {
            localStorage.setItem('snapscore_device_id', id);
        }
        
        p2p.onMessage((msg) => {
          if (msg.type === 'HEARTBEAT') return; 
          onMessageRef.current(msg);
        });
        
        p2p.onConnectionChange(() => {
            setConnectedPeers(p2p.activeConnectionsCount);
            setConnectedPeerIds(p2p.connectedPeerIds);
            setP2pUpdateTick(t => t + 1);
        });

        // Backup polling
        intervalId = setInterval(() => {
             const count = p2p.activeConnectionsCount;
             const ids = p2p.connectedPeerIds;
             if (count !== connectedPeers) setConnectedPeers(count);
             if (JSON.stringify(ids) !== JSON.stringify(connectedPeerIds)) setConnectedPeerIds(ids);
        }, 3000);

        if (joinId) {
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

    const handleUnload = () => p2p.destroy();
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener('beforeunload', handleUnload);
      p2p.destroy();
    };
  }, []);

  // Persist ID
  useEffect(() => {
    if (connectedPeers > 0 && peerId) {
        localStorage.setItem('snapscore_device_id', peerId);
    }
  }, [connectedPeers, peerId]);

  // Auto-Reconnect
  useEffect(() => {
    if (!isClient || hostEndedSession) return;

    if (connectedPeers === 0) {
      const hostId = localStorage.getItem('snapscore_host_id');
      if (hostId) {
        if (retryCount >= MAX_RETRIES) {
            console.warn("Max retries reached. Stopping auto-reconnect.");
            return;
        }

        const timer = setTimeout(() => {
            if (!isJoining && p2p.activeConnectionsCount === 0) {
                console.log(`Connection lost. Reconnecting to host: ${hostId} (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
                handleJoinGame(hostId, true);
            }
        }, 3000); 
        return () => clearTimeout(timer);
      }
    }
  }, [isClient, connectedPeers, isJoining, retryCount, hostEndedSession]);

  // Broadcast State (Host Only)
  useEffect(() => {
    if (!isClient && connectedPeers > 0) {
         p2p.broadcast({
             type: 'SYNC_STATE',
             payload: {
                 players,
                 settings,
                 view: view === AppView.SCAN ? AppView.GAME : view
             }
         });
    }
  }, [players, settings, view, connectedPeers, p2pUpdateTick]);


  // Actions
  const handleJoinGame = async (targetHostId: string, silent = false) => {
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

          setIsClient(true);
          setHostEndedSession(false);
          localStorage.setItem('snapscore_host_id', targetHostId);
          setRetryCount(0);
          
          const myId = p2p.getMyId();
          if (myId) localStorage.setItem('snapscore_device_id', myId);
          
          return true;
      } catch (e: any) {
          if (joinCancelledRef.current) return false;
          console.error("Join Game Error:", e);
          
          if (e?.type === 'peer-unavailable' || String(e).includes('Could not connect to peer')) {
               if (!silent) alert("Could not find host. The QR code might be old.");
               setIsClient(false);
               localStorage.removeItem('snapscore_host_id');
               setRetryCount(0);
               setIsJoining(false);
               return false;
          }
          
          if (!silent) {
              alert("Could not connect to host. Please try again.");
              setIsClient(false);
              localStorage.removeItem('snapscore_host_id');
          } else {
              setRetryCount(prev => prev + 1);
          }
          return false;
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
  
  const handleHostEndSession = async () => {
      if (isClient) return;
      p2p.broadcast({ type: 'GAME_ENDED', payload: null });
      setTimeout(() => {
          localStorage.removeItem('snapscore_host_id');
          p2p.destroy();
          p2p.init().then(id => setPeerId(id));
      }, 500);
  };

  const sendToHostAction = async (msg: P2PMessage) => {
      const hostId = localStorage.getItem('snapscore_host_id');
      if (!hostId) return;

      if (!p2p.connectedPeerIds.includes(hostId)) {
          console.log("Action triggered while disconnected. Attempting to reconnect...");
          try {
              await handleJoinGame(hostId, true);
              if (!p2p.connectedPeerIds.includes(hostId)) throw new Error("Reconnection failed");
          } catch (e) {
              console.error("Action failed: Could not reconnect to host", e);
              return;
          }
      }
      p2p.sendToHost(msg);
  };

  return {
      peerId,
      isClient, setIsClient,
      isJoining,
      hostEndedSession, setHostEndedSession,
      connectedPeers,
      connectedPeerIds,
      handleJoinGame,
      handleCancelJoin,
      handleLeaveGame,
      handleHostEndSession,
      sendToHostAction,
      setRetryCount // exposed for rare manual resets
  };
};
