
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

  constructor() {
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

    // Cleanup existing connection to same host to prevent duplicates/zombies
    const existingConn = this.connections.find(c => c.peer === hostId);
    if (existingConn) {
        console.log("Closing existing stale connection to host:", hostId);
        existingConn.close();
        this.connections = this.connections.filter(c => c !== existingConn);
    }

    // Set a timeout for the connection attempt
    const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Connection timed out"));
    }, 10000);

    const conn = this.peer.connect(hostId);

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

    // Critical: Listen for 'peer-unavailable' on the PEER instance, 
    // because sometimes it doesn't fire on the connection object depending on PeerJS version/browser.
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
    if (!this.connections.find(c => c.peer === conn.peer)) {
        this.connections.push(conn);
        this.notifyConnectionChange();

        conn.on('data', (data: any) => {
            if (this.onMessageCallback) {
                this.onMessageCallback(data as P2PMessage);
            }
        });

        conn.on('close', () => {
            this.connections = this.connections.filter(c => c !== conn);
            console.log('Connection closed');
            this.notifyConnectionChange();
        });
        
        // Ensure we notify again in case listener was attached late
        this.notifyConnectionChange();
    }
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
      if (conn.open) {
        conn.send(msg);
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
      // We only add to this.connections when 'open' fires, so length is reliable
      return this.connections.length;
  }

  get connectedPeerIds() {
      return this.connections.map(c => c.peer);
  }

  destroy() {
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