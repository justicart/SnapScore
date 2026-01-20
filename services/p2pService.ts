
import Peer, { DataConnection } from 'peerjs';
import { P2PMessage, DurableEnvelope } from '../types';

/**
 * DurableStream manages a single logical connection to a peer.
 * It persists state (buffers, sequence numbers) even if the physical
 * connection drops, allowing for seamless resyncing on reconnection.
 */
class DurableStream {
  private outboundBuffer: DurableEnvelope[] = [];
  private nextSeqToSend = 1;
  private lastReceivedSeq = 0;
  private processedSeqs = new Set<number>();
  private lastSeenAt = Date.now();
  
  // Physical connection
  private connection: DataConnection | null = null;

  constructor(
    public readonly remotePeerId: string,
    private readonly myPeerId: string,
    private readonly onMessage: (msg: P2PMessage) => void
  ) {}

  public get lastSeen() { return this.lastSeenAt; }
  public get isConnected() { return !!this.connection?.open; }
  public get status(): 'online' | 'stale' | 'offline' {
    if (!this.isConnected) return 'offline';
    const diff = Date.now() - this.lastSeenAt;
    if (diff > 15000) return 'stale';
    return 'online';
  }

  public attach(conn: DataConnection) {
    if (this.connection) this.connection.close();
    this.connection = conn;
    this.setupListeners(conn);
    // On new physical connection, initiate resync
    this.sendControl({ type: 'RESYNC', payload: { lastReceivedSeq: this.lastReceivedSeq } });
  }

  private setupListeners(conn: DataConnection) {
    conn.on('data', (data: any) => {
      const envelope = data as DurableEnvelope;
      if (!envelope || typeof envelope.seq !== 'number') return;
      this.lastSeenAt = Date.now();
      this.handleEnvelope(envelope);
    });
  }

  private handleEnvelope(envelope: DurableEnvelope) {
    const { seq, message } = envelope;

    // 1. Handle Acknowledgments
    if (message.type === 'ACK') {
      const ackedSeq = message.payload.seq;
      this.outboundBuffer = this.outboundBuffer.filter(e => e.seq > ackedSeq);
      return;
    }

    // 2. Handle Resync Requests
    if (message.type === 'RESYNC') {
      const peerLastReceived = message.payload.lastReceivedSeq;
      const toResend = this.outboundBuffer.filter(e => e.seq > peerLastReceived);
      toResend.forEach(e => this.connection?.send(e));
      return;
    }

    // 3. Handle Heartbeats
    if (message.type === 'HEARTBEAT') return;

    // 4. Handle Data Messages (Reliable)
    if (seq > 0) {
      // Send ACK immediately
      this.sendControl({ type: 'ACK', payload: { seq } });

      // Duplicate detection
      if (this.processedSeqs.has(seq) || seq <= this.lastReceivedSeq) return;

      this.lastReceivedSeq = Math.max(this.lastReceivedSeq, seq);
      this.processedSeqs.add(seq);

      // Keep processed list manageable
      if (this.processedSeqs.size > 200) {
        const sorted = Array.from(this.processedSeqs).sort((a, b) => a - b);
        this.processedSeqs = new Set(sorted.slice(-100));
      }
    }

    // Emit the message
    this.onMessage(message);
  }

  /**
   * Send a reliable data message
   */
  public send(message: P2PMessage) {
    const envelope: DurableEnvelope = {
      seq: this.nextSeqToSend++,
      senderId: this.myPeerId,
      message,
      timestamp: Date.now()
    };

    this.outboundBuffer.push(envelope);
    if (this.outboundBuffer.length > 100) this.outboundBuffer.shift();

    if (this.isConnected) {
      try {
        this.connection!.send(envelope);
      } catch (e) {
        console.warn("[DurableStream] Send failed, will resync later", e);
      }
    }
  }

  /**
   * Send a control message (ACK, HEARTBEAT, RESYNC) - seq 0, not buffered
   */
  public sendControl(message: P2PMessage) {
    if (this.isConnected) {
      this.connection!.send({
        seq: 0,
        senderId: this.myPeerId,
        message,
        timestamp: Date.now()
      });
    }
  }

  public close() {
    this.connection?.close();
    this.connection = null;
  }
}

export class P2PService {
  private peer: Peer | null = null;
  private sessions = new Map<string, DurableStream>();
  private onMessageCallback: ((msg: P2PMessage) => void) | null = null;
  private onConnectionChangeCallback: (() => void) | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  init(preferredId?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.peer && !this.peer.destroyed) return resolve(this.peer.id);

      const id = preferredId || Math.random().toString(36).substring(2, 7).toUpperCase();
      const peer = new Peer(id, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      peer.on('open', (newId) => {
        this.peer = peer;
        this.setupPeerListeners(peer);
        this.startHeartbeat();
        resolve(newId);
      });

      peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
          peer.destroy();
          this.init().then(resolve).catch(reject);
          return;
        }
        reject(err);
      });
    });
  }

  private setupPeerListeners(peer: Peer) {
    peer.on('connection', (conn) => {
      conn.on('open', () => this.handleNewPhysicalConnection(conn));
    });

    peer.on('disconnected', () => peer.reconnect());
  }

  private handleNewPhysicalConnection(conn: DataConnection) {
    let session = this.sessions.get(conn.peer);
    if (!session) {
      session = new DurableStream(conn.peer, this.peer!.id, (msg) => this.onMessageCallback?.(msg));
      this.sessions.set(conn.peer, session);
    }
    session.attach(conn);
    this.notifyChange();
    
    conn.on('close', () => {
      this.notifyChange();
    });
  }

  async connect(remoteId: string): Promise<void> {
    if (!this.peer) throw new Error("Peer not initialized");
    if (this.sessions.get(remoteId)?.isConnected) return;

    return new Promise((resolve, reject) => {
      const conn = this.peer!.connect(remoteId, { serialization: 'json' });
      const timeout = setTimeout(() => reject(new Error("Connection timed out")), 10000);

      conn.on('open', () => {
        clearTimeout(timeout);
        this.handleNewPhysicalConnection(conn);
        resolve();
      });

      conn.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => {
      this.sessions.forEach(s => s.sendControl({ type: 'HEARTBEAT', payload: Date.now() }));
    }, 5000);
  }

  broadcast(msg: P2PMessage) {
    this.sessions.forEach(s => s.send(msg));
  }

  sendTo(peerId: string, msg: P2PMessage) {
    this.sessions.get(peerId)?.send(msg);
  }

  onMessage(callback: (msg: P2PMessage) => void) {
    this.onMessageCallback = callback;
  }

  onConnectionChange(callback: () => void) {
    this.onConnectionChangeCallback = callback;
  }

  private notifyChange() {
    this.onConnectionChangeCallback?.();
  }

  get activePeerIds() {
    return Array.from(this.sessions.entries())
      .filter(([_, s]) => s.isConnected)
      .map(([id]) => id);
  }

  get myId() { return this.peer?.id; }

  destroy() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.sessions.forEach(s => s.close());
    this.sessions.clear();
    this.peer?.destroy();
    this.peer = null;
  }
}

export const p2p = new P2PService();
