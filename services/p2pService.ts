
import Peer, { DataConnection } from 'peerjs';
import { P2PMessage } from '../types';

export const generateShortId = () => {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
};

export class P2PService {
  private peer: Peer | null = null;
  private connections: DataConnection[] = [];
  private onMessageCallback: ((msg: P2PMessage) => void) | null = null;
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
        // If we are null, we likely destroyed it intentionally, so don't spam logs
        if (this.peer && !this.peer.destroyed) {
            console.log('Peer disconnected from server, attempting reconnect...');
            this.peer.reconnect();
        }
      });

      this.peer.on('connection', (conn) => {
        console.log('Incoming connection from', conn.peer);
        this.setupConnection(conn);
      });

      this.peer.on('error', (err) => {
        // Filter out expected errors during cleanup or network flakes
        const errStr = String(err);
        if (
            err.type === 'network' || 
            err.type === 'server-error' || 
            errStr.includes("Lost connection") ||
            errStr.includes("Could not connect to peer")
        ) {
             // Only log if we expect to be connected
             if (this.hostId && this.peer && !this.peer.destroyed) {
                 console.warn('P2P Network Warning:', errStr);
             }
             return;
        }
        
        console.error('PeerJS error:', err);
        // Only reject if we are in the initialization phase
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
    if (!this.peer) return;

    const conn = this.peer.connect(hostId);

    conn.on('open', () => {
      console.log('Connected to host:', hostId);
      this.setupConnection(conn);
      resolve();
    });

    conn.on('error', (err) => {
      console.error('Connection error:', err);
      reject(err);
    });
  }

  private setupConnection(conn: DataConnection) {
    this.connections.push(conn);

    conn.on('data', (data: any) => {
      if (this.onMessageCallback) {
        this.onMessageCallback(data as P2PMessage);
      }
    });

    conn.on('close', () => {
      this.connections = this.connections.filter(c => c !== conn);
      console.log('Connection closed');
    });
  }

  onMessage(callback: (msg: P2PMessage) => void) {
    this.onMessageCallback = callback;
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
