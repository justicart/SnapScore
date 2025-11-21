import Peer, { DataConnection } from 'peerjs';
import { P2PMessage } from '../types';

// Helper to create a peer ID that is somewhat readable but unique
// e.g. "snapscore-abc12"
export const generateShortId = () => {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
};

export class P2PService {
  private peer: Peer | null = null;
  private connections: DataConnection[] = [];
  private onMessageCallback: ((msg: P2PMessage) => void) | null = null;
  private hostId: string | null = null;

  constructor() {
    // Initialize empty
  }

  init(id?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.peer) {
        resolve(this.peer.id);
        return;
      }

      // If no ID provided, generate one.
      // Note: In a real prod app, we might want a STUN/TURN server config here for better connectivity
      this.peer = new Peer(id || generateShortId(), {
        debug: 1
      });

      this.peer.on('open', (id) => {
        console.log('My Peer ID is: ' + id);
        this.hostId = id;
        resolve(id);
      });

      this.peer.on('connection', (conn) => {
        console.log('Incoming connection from', conn.peer);
        this.setupConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.error('PeerJS error:', err);
        reject(err);
      });
    });
  }

  connect(hostId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.peer) {
        this.init().then(() => this._connectToHost(hostId, resolve, reject));
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
    // As a client, we typically only have one connection (to the host)
    // But we can iterate to be safe
    this.connections.forEach(conn => {
        if(conn.open) conn.send(msg);
    });
  }
  
  getMyId() {
      return this.peer?.id;
  }

  destroy() {
    this.connections.forEach(c => c.close());
    this.peer?.destroy();
    this.peer = null;
    this.connections = [];
  }
}

export const p2p = new P2PService();