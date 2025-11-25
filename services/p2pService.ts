
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

  init(id?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.peer && !this.peer.destroyed) {
        resolve(this.peer.id);
        return;
      }

      this.peer = new Peer(id || generateShortId(), {
        debug: 1,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' }
            ]
        }
      });

      this.peer.on('open', (id) => {
        console.log('My Peer ID is: ' + id);
        this.hostId = id;
        resolve(id);
      });

      this.peer.on('disconnected', () => {
        if (this.peer && !this.peer.destroyed) {
            console.log('Peer disconnected from server, attempting reconnect...');
            this.peer.reconnect();
        }
      });

      this.peer.on('connection', (conn) => {
        console.log('Incoming connection from', conn.peer);
        // Wait for open to ensure we can send data immediately if needed
        conn.on('open', () => {
             this.setupConnection(conn);
        });
        // If already open (rare for incoming immediately), setup
        if (conn.open) this.setupConnection(conn);
      });

      this.peer.on('error', (err) => {
        const errStr = String(err);
        if (
            err.type === 'network' || 
            err.type === 'server-error' || 
            errStr.includes("Lost connection") ||
            errStr.includes("Could not connect to peer")
        ) {
             if (this.hostId && this.peer && !this.peer.destroyed) {
                 console.warn('P2P Network Warning:', errStr);
             }
             return;
        }
        
        console.error('PeerJS error:', err);
        if (!this.hostId) {
            reject(err);
        }
      });
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

    // Set a timeout for connection
    const timeout = setTimeout(() => {
        reject(new Error("Connection timed out"));
    }, 10000);

    const conn = this.peer.connect(hostId);

    conn.on('open', () => {
      clearTimeout(timeout);
      console.log('Connected to host:', hostId);
      this.setupConnection(conn);
      resolve();
    });

    conn.on('error', (err) => {
      clearTimeout(timeout);
      console.error('Connection error:', err);
      reject(err);
    });
    
    // Also handle immediate close/error cases before open
    conn.on('close', () => {
        clearTimeout(timeout);
    });
  }

  private setupConnection(conn: DataConnection) {
    // Avoid duplicates
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
        
        // Listen for open event again if setupConnection called early, 
        // to trigger notification when actually ready
        conn.on('open', () => {
            this.notifyConnectionChange();
        });
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
      return this.connections.filter(c => c.open).length;
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
