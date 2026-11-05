/**
 * Network Manager using PeerJS (WebRTC)
 * Zero external servers required - works directly in static GitHub Pages
 */
class NetworkManager {
    constructor() {
        this.peer = null;
        this.isHost = false;
        this.myPeerId = null;
        this.roomCode = null;
        this.connections = new Map(); // peerId -> connection (for Host)
        this.hostConn = null;         // Connection to host (for Client)
        this.onEvent = null;          // Callback for game events: (event, data, senderId) => {}
        this.connectedPeers = new Set();
        this.ping = 0;
        this.lastPingSent = 0;
    }

    generateRoomCode() {
        // 5 random uppercase alphanumeric chars (excluding confusing 0/O, 1/I)
        const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
        let code = '';
        for (let i = 0; i < 5; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    prefixRoomId(code) {
        return `dsg-curve-${code.toUpperCase()}`;
    }

    /**
     * Start hosting a room
     */
    hostRoom(customCode = null) {
        return new Promise((resolve, reject) => {
            this.isHost = true;
            this.roomCode = (customCode || this.generateRoomCode()).toUpperCase();
            const hostPeerId = this.prefixRoomId(this.roomCode);

            if (this.peer) this.peer.destroy();

            this.peer = new Peer(hostPeerId, {
                debug: 1
            });

            this.peer.on('open', (id) => {
                this.myPeerId = id;
                console.log(`[Net] Hosting room ${this.roomCode} with peer ID: ${id}`);
                resolve(this.roomCode);
            });

            this.peer.on('connection', (conn) => {
                this._handleIncomingConnection(conn);
            });

            this.peer.on('error', (err) => {
                console.error('[Net] Host Peer error:', err);
                if (err.type === 'unavailable-id') {
                    // ID taken, try another random room code if we didn't specify a custom one
                    if (!customCode) {
                        this.hostRoom().then(resolve).catch(reject);
                        return;
                    }
                }
                reject(err);
            });
        });
    }

    _handleIncomingConnection(conn) {
        conn.on('open', () => {
            console.log(`[Net] Peer connected: ${conn.peer}`);
            this.connections.set(conn.peer, conn);
            this.connectedPeers.add(conn.peer);

            conn.on('data', (data) => {
                this._handleData(data, conn.peer);
            });

            conn.on('close', () => {
                console.log(`[Net] Peer disconnected: ${conn.peer}`);
                this.connections.delete(conn.peer);
                this.connectedPeers.delete(conn.peer);
                if (this.onEvent) {
                    this.onEvent('PEER_DISCONNECTED', { peerId: conn.peer }, conn.peer);
                }
            });
        });

        conn.on('error', (err) => {
            console.error(`[Net] Connection error with ${conn.peer}:`, err);
        });
    }

    /**
     * Join an existing room
     */
    joinRoom(roomCode) {
        return new Promise((resolve, reject) => {
            this.isHost = false;
            this.roomCode = roomCode.trim().toUpperCase();
            const hostPeerId = this.prefixRoomId(this.roomCode);

            if (this.peer) this.peer.destroy();

            // Client gets a random peer ID
            this.peer = new Peer(null, {
                debug: 1
            });

            this.peer.on('open', (id) => {
                this.myPeerId = id;
                console.log(`[Net] Client initialized with ID: ${id}. Connecting to host: ${hostPeerId}`);

                const conn = this.peer.connect(hostPeerId, {
                    reliable: false // low-latency UDP-style DataChannel for real-time controls
                });

                conn.on('open', () => {
                    console.log('[Net] Successfully connected to host!');
                    this.hostConn = conn;
                    this.startPingInterval();
                    resolve(this.roomCode);
                });

                conn.on('data', (data) => {
                    this._handleData(data, hostPeerId);
                });

                conn.on('close', () => {
                    console.warn('[Net] Connection to host closed.');
                    if (this.onEvent) {
                        this.onEvent('HOST_DISCONNECTED', {}, hostPeerId);
                    }
                });

                conn.on('error', (err) => {
                    console.error('[Net] Host connection error:', err);
                    reject(err);
                });
            });

            this.peer.on('error', (err) => {
                console.error('[Net] Client Peer error:', err);
                reject(err);
            });
        });
    }

    _handleData(msg, senderId) {
        if (!msg || typeof msg !== 'object') return;

        // Built-in Ping / Pong
        if (msg.type === 'PING') {
            this.sendTo(senderId, { type: 'PONG', t: msg.t });
            return;
        }
        if (msg.type === 'PONG') {
            this.ping = Math.round(performance.now() - msg.t);
            return;
        }

        if (this.onEvent) {
            this.onEvent(msg.type, msg.payload, senderId);
        }
    }

    startPingInterval() {
        setInterval(() => {
            if (this.hostConn && this.hostConn.open) {
                this.sendToHost('PING', null, { t: performance.now() });
            }
        }, 2000);
    }

    sendTo(peerId, rawMsg) {
        const conn = this.connections.get(peerId);
        if (conn && conn.open) {
            conn.send(rawMsg);
        }
    }

    sendToHost(type, payload, meta = {}) {
        if (this.hostConn && this.hostConn.open) {
            this.hostConn.send({ type, payload, ...meta });
        }
    }

    /**
     * Broadcast to all connected clients (Host only)
     */
    broadcast(type, payload) {
        if (!this.isHost) return;
        const msg = { type, payload };
        for (const conn of this.connections.values()) {
            if (conn.open) {
                conn.send(msg);
            }
        }
    }

    disconnect() {
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        this.connections.clear();
        this.connectedPeers.clear();
        this.hostConn = null;
        this.isHost = false;
        this.roomCode = null;
    }
}

window.networkManager = new NetworkManager();
