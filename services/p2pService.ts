
import Peer, { DataConnection } from 'peerjs';
import { P2PMessage, DurableEnvelope } from '../types';

export const generateShortId = () => {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
};

const MAX_BUFFER_SIZE = 100;
const STALE_THRESHOLD_MS = 15000; // 15 seconds without a word = stale
const DISCONNECT_THRESHOLD_MS = 45000; // 45 seconds = dead

class ReliablePeerConnection {
  private outboundBuffer: DurableEnvelope[] = [];
  private nextSeq = 1;
  private _lastReceivedSeq = 0;
  private processedSeqs = new Set<number>();
  private _lastSeen = Date.now();
  
  constructor(
    public readonly conn: DataConnection,
    private readonly myPeerId: string,
    private readonly onValidatedMessage: (msg: P2PMessage) => void
  ) {
    this.setupListeners();
  }

  public get lastSeen() { return this._lastSeen; }
  public get lastReceivedSeq() { return this._lastReceivedSeq; }
  public get isStale() { return (Date.now() - this._lastSeen) > STALE_THRESHOLD_MS; }
  public get isDead() { return (Date.now() - this._lastSeen) > DISCONNECT_THRESHOLD_MS; }

  private setupListeners() {
    this.conn.on('data', (data: any) => {
      const envelope = data as DurableEnvelope;
      if (!envelope || typeof envelope.seq !== 'number') return;

      this._lastSeen = Date.now(); // We heard something!
      this.handleEnvelope(envelope);
    });
  }

  private handleEnvelope(envelope: DurableEnvelope) {
    const { seq, message } = envelope;

    if (message.type !== 'ACK') {
      this.conn.send({
        seq: 0,
        senderId: this.myPeerId,
        message: { type: 'ACK', payload: { seq } },
        timestamp: Date.now()
      });
    }

    if (message.type === 'ACK') {
      this.outboundBuffer = this.outboundBuffer.filter(e => e.seq > message.payload.seq);
      return;
    }

    if (message.type === 'RESYNC_QUERY') {
      this.handleResync(message.payload.lastReceivedSeq);
      return;
    }

    if (seq > 0) {
      if (this.processedSeqs.has(seq) || seq <= this._lastReceivedSeq) {
        return;
      }
      this._lastReceivedSeq = Math.max(this._lastReceivedSeq, seq);
      this.processedSeqs.add(seq);
      
      if (this.processedSeqs.size > MAX_BUFFER_SIZE) {
        const minSeq = Math.min(...this.processedSeqs);
        this.processedSeqs.delete(minSeq);
      }
    }

    this.onValidatedMessage(message);
  }

  private handleResync(lastReceivedByPeer: number) {
    console.log(`[DurableStream] Resyncing from ${lastReceivedByPeer} for peer ${this.conn.peer}`);
    const missing = this.outboundBuffer.filter(e => e.seq > lastReceivedByPeer);
    missing.forEach(e => {
      if (this.conn.open) this.conn.send(e);
    });
  }

  public send(message: P2PMessage) {
    const envelope: DurableEnvelope = {
      seq: this.nextSeq++,
      senderId: this.myPeerId,
      message,
      timestamp: Date.now()
    };

    if (message.type !== 'HEARTBEAT') {
      this.outboundBuffer.push(envelope);
      if (this.outboundBuffer.length > MAX_BUFFER_SIZE) {
        this.outboundBuffer.shift();
      }
    }

    if (this.conn.open) {
      try {
        this.conn.send(envelope);
      } catch (e) {
        console.warn("[DurableStream] Send failed, buffered for retry", e);
      }
    }
  }

  public initiateHandshake() {
    if (this.conn.open) {
      this.conn.send({
        seq: 0,
        senderId: this.myPeerId,
        message: { type: 'RESYNC_QUERY', payload: { lastReceivedSeq: this._lastReceivedSeq } },
        timestamp: Date.now()
      });
    }
  }
}

export class P2PService {
  private peer: Peer | null = null;
  private reliableConnections: Map<string, ReliablePeerConnection> = new Map();
  private onMessageCallback: ((msg: P2PMessage) => void) | null = null;
  private onConnectionChangeCallback: (() => void) | null = null;
  private hostId: string | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private monitorInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startHeartbeat();
    this.startLivenessMonitor();
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
            this.hostId = id;
            this.peer = peer;
            this.attachRuntimeListeners(peer);
            resolve(id);
          });

          peer.on('error', (err) => {
             if (err.type === 'unavailable-id') {
                 peer.destroy();
                 createPeer(undefined);
                 return;
             }
             if (!this.hostId) reject(err);
          });
      };

      createPeer(preferredId);
    });
  }

  private attachRuntimeListeners(peer: Peer) {
      peer.on('disconnected', () => {
        if (peer && !peer.destroyed) peer.reconnect();
      });

      peer.on('connection', (conn) => {
        conn.on('open', () => this.setupReliableConnection(conn));
      });
  }

  private setupReliableConnection(conn: DataConnection) {
    const existing = this.reliableConnections.get(conn.peer);
    if (existing) {
      existing.conn.close();
      this.reliableConnections.delete(conn.peer);
    }

    const reliable = new ReliablePeerConnection(
      conn, 
      this.peer!.id, 
      (msg) => this.onMessageCallback?.(msg)
    );
    
    this.reliableConnections.set(conn.peer, reliable);
    
    conn.on('close', () => {
      this.reliableConnections.delete(conn.peer);
      this.notifyConnectionChange();
    });

    reliable.initiateHandshake();
    this.notifyConnectionChange();
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
    if (!this.peer) return reject(new Error("Peer not initialized"));
    const conn = this.peer.connect(hostId, { serialization: 'json' });
    conn.on('open', () => {
      this.setupReliableConnection(conn);
      resolve();
    });
    conn.on('error', reject);
    setTimeout(() => { if (!conn.open) reject(new Error("Connection timed out")); }, 10000);
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => {
      this.broadcast({ type: 'HEARTBEAT', payload: Date.now() });
    }, 5000); 
  }

  private startLivenessMonitor() {
    if (this.monitorInterval) clearInterval(this.monitorInterval);
    this.monitorInterval = setInterval(() => {
      let changed = false;
      this.reliableConnections.forEach((rc, peerId) => {
        if (rc.isDead) {
          console.log(`[P2P] Peer ${peerId} is dead, closing.`);
          rc.conn.close();
          this.reliableConnections.delete(peerId);
          changed = true;
        } else if (rc.isStale) {
          // Send resync query to attempt to "wake" the connection
          rc.initiateHandshake();
          changed = true;
        }
      });
      if (changed) this.notifyConnectionChange();
    }, 5000);
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
    this.reliableConnections.forEach(rc => rc.send(msg));
  }

  sendToHost(msg: P2PMessage) {
    this.reliableConnections.forEach(rc => rc.send(msg));
  }
  
  getMyId() { return this.peer?.id; }
  
  get activeConnectionsCount() {
      return Array.from(this.reliableConnections.values()).filter(rc => rc.conn.open).length;
  }

  get connectedPeerIds() {
      return Array.from(this.reliableConnections.values()).filter(rc => rc.conn.open).map(rc => rc.conn.peer);
  }

  get stalePeerIds() {
      return Array.from(this.reliableConnections.entries())
        .filter(([_, rc]) => rc.isStale && rc.conn.open)
        .map(([id]) => id);
  }

  destroy() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.monitorInterval) clearInterval(this.monitorInterval);
    this.reliableConnections.forEach(rc => rc.conn.close());
    if (this.peer) this.peer.destroy();
    this.peer = null;
    this.reliableConnections.clear();
  }
}

export const p2p = new P2PService();
