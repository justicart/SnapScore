
import Peer, { DataConnection } from 'peerjs';
import { P2PMessage } from '../types';

export const generateShortId = () => {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
};

export class P2PService {
  private peer: Peer | null = null;
  private connections: DataConnection[] = [];
  private onMessageCallback: ((msg: P2PMessage) => void) | null = null;
  private onConnectionChangeCallback: (() => void) | null = null;
  private hostId: string | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
      this.startHeartbeat();
  }

  init(preferredId?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.peer && !this.peer.destroyed) {
        resolve(this.peer.id);
        return;
      }

      const createPeer = (idToUse?: string) => {
          const peer = new Peer(idToUse || generateShortId(), {
            debug: 1,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' }
                ]
            }
          });

          peer.on('open', (id) => {
            console.log('My Peer ID is: ' + id);
            this.hostId = id;
            this.peer = peer;
            this.attachRuntimeListeners(peer);
            resolve(id);
          });

          peer.on('error', (err) => {
             const errStr = String(err);
             
             // Handle ID taken -> retry with new ID (fallback)
             if (err.type === 'unavailable-id') {
                 console.warn(`Peer ID ${idToUse} unavailable, regenerating...`);
                 peer.destroy();
                 createPeer(undefined); // Retry without specific ID
                 return;
             }

             // Suppress common connection loss errors which are often non-fatal during reloads
             if (
                err.type === 'network' || 
                err.type === 'peer-unavailable' ||
                err.type === 'server-error' || 
                errStr.includes("Lost connection") ||
                errStr.includes("Could not connect to peer")
             ) {
                 if (this.hostId && !peer.destroyed) {
                     console.warn("PeerJS non-fatal error:", err);
                     return; 
                 }
             }
             
             // If we haven't resolved yet (initialization phase fatal error)
             if (!this.hostId) {
                reject(err);
             } else {
                 console.error('PeerJS fatal error:', err);
             }
          });
      };

      createPeer(preferredId);
    });
  }

  private attachRuntimeListeners(peer: Peer) {
      peer.on('disconnected', () => {
        if (peer && !peer.destroyed) {
            peer.reconnect();
        }
      });

      peer.on('connection', (conn) => {
        // Handle incoming connections (Host side)
        conn.on('open', () => {
             this.setupConnection(conn);
        });
        // If already open (rare race condition), setup immediately
        if (conn.open) {
            this.setupConnection(conn);
        }
      });
  }

  connect(hostId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.peer || this.peer.destroyed) {
        this.init().then(() => this._connectToHost(hostId, resolve, reject)).catch(reject);
      } else {
        this._connectToHost(hostId, resolve, reject);
      }
    });
  }

  private _connectToHost(hostId: string, resolve: () => void, reject: (err: any) => void) {
    if (!this.peer) {
        reject(new Error("Peer not initialized"));
        return;
    }

    // Cleanup existing outgoing connection to same host to prevent duplicates/zombies on client side
    const existingConn = this.connections.find(c => c.peer === hostId);
    if (existingConn) {
        if (!existingConn.open) {
            console.log("Closing stale outgoing connection to host:", hostId);
            existingConn.close();
            this.connections = this.connections.filter(c => c !== existingConn);
        } else {
             console.log("Already connected to host:", hostId);
             resolve();
             return;
        }
    }

    const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Connection timed out"));
    }, 10000);

    const conn = this.peer.connect(hostId, {
        serialization: 'json'
    });

    const cleanup = () => {
        conn.off('open', onOpen);
        conn.off('error', onError);
        conn.off('close', onClose);
        this.peer?.off('error', onPeerError);
    };

    const onOpen = () => {
      clearTimeout(timeout);
      cleanup();
      console.log('Connected to host:', hostId);
      this.setupConnection(conn);
      resolve();
    };

    const onError = (err: any) => {
      clearTimeout(timeout);
      cleanup();
      console.error('Connection error:', err);
      reject(err);
    };
    
    const onClose = () => {
        // Connection closed during handshake
    };

    const onPeerError = (err: any) => {
        if (err.type === 'peer-unavailable' && String(err.message).includes(hostId)) {
            clearTimeout(timeout);
            cleanup();
            console.warn(`Host ${hostId} unavailable (Fast Fail)`);
            reject(err);
        }
    };

    conn.on('open', onOpen);
    conn.on('error', onError);
    conn.on('close', onClose);
    this.peer.on('error', onPeerError);
  }

  private setupConnection(conn: DataConnection) {
    // 1. If we are already tracking this specific connection object, do nothing.
    if (this.connections.includes(conn)) return;

    // 2. CHECK FOR STALE CONNECTIONS (Aggressive Replacement)
    // If we already have a connection for this Peer ID, it is likely a stale connection.
    if (conn.peer) {
        const existingIndex = this.connections.findIndex(c => c.peer === conn.peer);
        
        if (existingIndex !== -1) {
            const staleConn = this.connections[existingIndex];
            console.log(`[P2P] Replacing stale connection for peer: ${conn.peer}`);
            
            // Critical: Remove listeners to prevent side effects and close immediately
            staleConn.removeAllListeners();
            staleConn.close();
            
            this.connections.splice(existingIndex, 1);
        }
    }

    // 3. Add the new connection
    this.connections.push(conn);
    this.notifyConnectionChange();

    // 4. Setup listeners
    conn.on('data', (data: any) => {
        const msg = data as P2PMessage;
        
        // Handle Heartbeat internally
        if (msg.type === 'HEARTBEAT') {
            return;
        }

        if (this.onMessageCallback) {
            this.onMessageCallback(msg);
        }
    });

    conn.on('close', () => {
        if (this.connections.includes(conn)) {
            this.connections = this.connections.filter(c => c !== conn);
            console.log('Connection closed:', conn.peer);
            this.notifyConnectionChange();
        }
    });
    
    conn.on('error', (err) => {
        console.error("Connection error for peer:", conn.peer, err);
        // We rely on 'close' to handle cleanup.
    });
  }

  private startHeartbeat() {
      if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = setInterval(() => {
          this.broadcast({ type: 'HEARTBEAT', payload: Date.now() });
      }, 2000); 
  }

  onMessage(callback: (msg: P2PMessage) => void) {
    this.onMessageCallback = callback;
  }
  
  onConnectionChange(callback: () => void) {
      this.onConnectionChangeCallback = callback;
  }
  
  private notifyConnectionChange() {
      if (this.onConnectionChangeCallback) {
          this.onConnectionChangeCallback();
      }
  }

  broadcast(msg: P2PMessage) {
    this.connections.forEach(conn => {
      // Only send if connection is open
      if (conn.open) {
        try {
            conn.send(msg);
        } catch (e) {
            console.warn("Failed to send to peer:", conn.peer, e);
        }
      }
    });
  }

  sendToHost(msg: P2PMessage) {
    this.connections.forEach(conn => {
        if(conn.open) conn.send(msg);
    });
  }
  
  getMyId() {
      return this.peer?.id;
  }
  
  get activeConnectionsCount() {
      return this.connections.length;
  }

  get connectedPeerIds() {
      return this.connections.map(c => c.peer);
  }

  destroy() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.connections.forEach(c => c.close());
    if (this.peer) {
        this.peer.removeAllListeners();
        this.peer.destroy();
    }
    this.peer = null;
    this.connections = [];
    this.hostId = null;
  }
}

export const p2p = new P2PService();
