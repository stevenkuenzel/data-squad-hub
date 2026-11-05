/**
 * Authoritative Curve Game Engine with Spatial Hashing Collision
 */

const ARENA_WIDTH = 1200;
const ARENA_HEIGHT = 800;
const SPEED = 160;             // Arena units per second
const TURN_SPEED = 3.4;        // Radians per second
const LINE_RADIUS = 3.5;       // Trail half-width
const GRID_CELL_SIZE = 50;     // Spatial hash cell size

// Available vibrant player colors
const PLAYER_COLORS = [
    { name: 'Neon Cyan', hex: '#00f3ff', glow: 'rgba(0, 243, 255, 0.6)' },
    { name: 'Laser Pink', hex: '#ff007f', glow: 'rgba(255, 0, 127, 0.6)' },
    { name: 'Acid Lime', hex: '#39ff14', glow: 'rgba(57, 255, 20, 0.6)' },
    { name: 'Solar Amber', hex: '#ffaa00', glow: 'rgba(255, 170, 0, 0.6)' },
    { name: 'Electric Violet', hex: '#bd00ff', glow: 'rgba(189, 0, 255, 0.6)' },
    { name: 'Crimson Glow', hex: '#ff3333', glow: 'rgba(255, 51, 51, 0.6)' },
];

function distToSegmentSquared(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return (px - x1) * (px - x1) + (py - y1) * (py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * (x2 - x1);
    const projY = y1 + t * (y2 - y1);
    return (px - projX) * (px - projX) + (py - projY) * (py - projY);
}

class SpatialGrid {
    constructor(cellSize = GRID_CELL_SIZE) {
        this.cellSize = cellSize;
        this.grid = new Map();
    }

    clear() {
        this.grid.clear();
    }

    _key(cx, cy) {
        return `${cx},${cy}`;
    }

    addSegment(segment) {
        const minX = Math.floor(Math.min(segment.x1, segment.x2) / this.cellSize);
        const maxX = Math.floor(Math.max(segment.x1, segment.x2) / this.cellSize);
        const minY = Math.floor(Math.min(segment.y1, segment.y2) / this.cellSize);
        const maxY = Math.floor(Math.max(segment.y1, segment.y2) / this.cellSize);

        for (let cx = minX; cx <= maxX; cx++) {
            for (let cy = minY; cy <= maxY; cy++) {
                const key = this._key(cx, cy);
                let cell = this.grid.get(key);
                if (!cell) {
                    cell = [];
                    this.grid.set(key, cell);
                }
                cell.push(segment);
            }
        }
    }

    getNearbySegments(x, y, radius) {
        const minX = Math.floor((x - radius) / this.cellSize);
        const maxX = Math.floor((x + radius) / this.cellSize);
        const minY = Math.floor((y - radius) / this.cellSize);
        const maxY = Math.floor((y + radius) / this.cellSize);

        const seen = new Set();
        const results = [];

        for (let cx = minX; cx <= maxX; cx++) {
            for (let cy = minY; cy <= maxY; cy++) {
                const cell = this.grid.get(this._key(cx, cy));
                if (cell) {
                    for (const seg of cell) {
                        if (!seen.has(seg.id)) {
                            seen.add(seg.id);
                            results.push(seg);
                        }
                    }
                }
            }
        }
        return results;
    }
}

class CurveGame {
    constructor() {
        this.players = new Map(); // id -> PlayerState
        this.segments = [];       // all line segments
        this.newSegmentsQueue = [];
        this.particles = [];
        this.grid = new SpatialGrid();
        this.nextSegmentId = 1;

        this.state = 'LOBBY'; // LOBBY, COUNTDOWN, PLAYING, ROUND_OVER, MATCH_OVER
        this.countdownTimer = 0;
        this.roundNumber = 1;
        this.maxRounds = 5;
        this.roundOverTimer = 0;
        this.enableGaps = true;           // Option: true for Curve Fever gaps, false for solid Tron lines
        this.clearSegmentsOnClients = false; // Flag to instruct clients to wipe old trails

        this.lastUpdateTime = performance.now();
        this.roundWinner = null;
        this.matchWinner = null;
    }

    resetMatch() {
        this.roundNumber = 1;
        for (const player of this.players.values()) {
            player.score = 0;
        }
        this.matchWinner = null;
        this.roundWinner = null;
        this.resetRound();
    }

    resetRound() {
        this.segments = [];
        this.newSegmentsQueue = [];
        this.clearSegmentsOnClients = true;
        this.grid.clear();
        this.particles = [];
        this.nextSegmentId = 1;

        // Position players in random positions pointing towards center
        const playerCount = this.players.size;
        let index = 0;

        const margin = 180;
        const width = ARENA_WIDTH - margin * 2;
        const height = ARENA_HEIGHT - margin * 2;

        for (const player of this.players.values()) {
            player.x = margin + Math.random() * width;
            player.y = margin + Math.random() * height;
            // Angle generally pointing roughly inward
            const targetAngle = Math.atan2(ARENA_HEIGHT / 2 - player.y, ARENA_WIDTH / 2 - player.x);
            player.angle = targetAngle + (Math.random() - 0.5) * 0.8;
            player.alive = true;
            player.isDrawing = true;
            player.gapTimer = 2.0 + Math.random() * 2.5;
            player.gapRemaining = 0;
            player.recentSegments = [];
            player.lastX = player.x;
            player.lastY = player.y;
            index++;
        }
    }

    addPlayer(id, name, colorHex, isBot = false) {
        if (this.players.has(id)) return this.players.get(id);

        const player = {
            id,
            name: name.slice(0, 16),
            color: colorHex,
            score: 0,
            alive: true,
            isBot,
            x: 0,
            y: 0,
            lastX: 0,
            lastY: 0,
            angle: 0,
            isDrawing: true,
            gapTimer: 2.0,
            gapRemaining: 0,
            inputLeft: false,
            inputRight: false,
            recentSegments: []
        };

        this.players.set(id, player);
        return player;
    }

    removePlayer(id) {
        this.players.delete(id);
    }

    setPlayerInput(id, left, right) {
        const p = this.players.get(id);
        if (p) {
            p.inputLeft = !!left;
            p.inputRight = !!right;
        }
    }

    startCountdown() {
        this.resetRound();
        this.state = 'COUNTDOWN';
        this.countdownTimer = 3.0; // 3 seconds countdown
        if (window.soundFX) window.soundFX.playCountdown(false);
    }

    /**
     * Authoritative tick (runs on Host)
     */
    update(dt) {
        if (this.state === 'COUNTDOWN') {
            const prevSec = Math.ceil(this.countdownTimer);
            this.countdownTimer -= dt;
            const curSec = Math.ceil(this.countdownTimer);
            if (curSec < prevSec && curSec > 0) {
                if (window.soundFX) window.soundFX.playCountdown(false);
            }
            if (this.countdownTimer <= 0) {
                this.state = 'PLAYING';
                if (window.soundFX) window.soundFX.playCountdown(true);
            }
            return;
        }

        if (this.state === 'ROUND_OVER') {
            this.roundOverTimer -= dt;
            this.updateParticles(dt);
            if (this.roundOverTimer <= 0) {
                // Check if any player reached winning score or max rounds
                let highestScore = 0;
                let leader = null;
                for (const p of this.players.values()) {
                    if (p.score > highestScore) {
                        highestScore = p.score;
                        leader = p;
                    }
                }

                const targetScore = Math.max(10, (this.players.size - 1) * 4);
                if (highestScore >= targetScore || this.roundNumber >= this.maxRounds) {
                    this.state = 'MATCH_OVER';
                    this.matchWinner = leader;
                    if (window.soundFX) window.soundFX.playWin();
                } else {
                    this.roundNumber++;
                    this.startCountdown();
                }
            }
            return;
        }

        if (this.state === 'MATCH_OVER') {
            this.updateParticles(dt);
            return;
        }

        if (this.state !== 'PLAYING') return;

        // Bot AI logic
        for (const p of this.players.values()) {
            if (p.isBot && p.alive) {
                this.updateBotAI(p, dt);
            }
        }

        // Move alive players
        let aliveCount = 0;
        let lastAlivePlayer = null;

        for (const p of this.players.values()) {
            if (!p.alive) continue;
            aliveCount++;
            lastAlivePlayer = p;

            // Turning
            if (p.inputLeft && !p.inputRight) {
                p.angle -= TURN_SPEED * dt;
            } else if (p.inputRight && !p.inputLeft) {
                p.angle += TURN_SPEED * dt;
            }

            // Move forward
            const stepDist = SPEED * dt;
            const nextX = p.x + Math.cos(p.angle) * stepDist;
            const nextY = p.y + Math.sin(p.angle) * stepDist;

            // Gap management (if enabled)
            if (this.enableGaps) {
                if (p.gapRemaining > 0) {
                    p.gapRemaining -= dt;
                    p.isDrawing = false;
                    if (p.gapRemaining <= 0) {
                        p.isDrawing = true;
                        p.gapTimer = 2.0 + Math.random() * 3.0;
                    }
                } else {
                    p.gapTimer -= dt;
                    if (p.gapTimer <= 0) {
                        p.gapRemaining = 0.35 + Math.random() * 0.15;
                        p.isDrawing = false;
                        if (window.soundFX) window.soundFX.playGap();
                    }
                }
            } else {
                p.isDrawing = true;
            }

            // Check collision for head at next position
            const hit = this.checkCollision(p, nextX, nextY);
            if (hit) {
                p.alive = false;
                this.spawnExplosion(p.x, p.y, p.color);
                if (window.soundFX) window.soundFX.playDie();

                // Award 1 point to all currently alive players
                for (const other of this.players.values()) {
                    if (other.alive && other.id !== p.id) {
                        other.score += 1;
                    }
                }
                continue;
            }

            // Create new segment if drawing
            if (p.isDrawing) {
                const seg = {
                    id: this.nextSegmentId++,
                    playerId: p.id,
                    color: p.color,
                    x1: p.x,
                    y1: p.y,
                    x2: nextX,
                    y2: nextY
                };

                this.segments.push(seg);
                this.newSegmentsQueue.push(seg);
                this.grid.addSegment(seg);

                p.recentSegments.push(seg.id);
                // Keep only last 8 recent segments in exclusion queue
                if (p.recentSegments.length > 8) {
                    p.recentSegments.shift();
                }
            }

            p.x = nextX;
            p.y = nextY;
        }

        this.updateParticles(dt);

        // Check round end: if only 1 player remains (or 0 in solo/tie)
        const totalPlayers = this.players.size;
        const requiredAlive = totalPlayers > 1 ? 1 : 0;

        if (aliveCount <= requiredAlive) {
            this.state = 'ROUND_OVER';
            this.roundOverTimer = 2.8;
            this.roundWinner = lastAlivePlayer;
            if (lastAlivePlayer) {
                if (window.soundFX) window.soundFX.playWin();
            }
        }
    }

    checkCollision(player, nextX, nextY) {
        const r = LINE_RADIUS;

        // Arena boundary check
        if (nextX - r <= 0 || nextX + r >= ARENA_WIDTH ||
            nextY - r <= 0 || nextY + r >= ARENA_HEIGHT) {
            return true;
        }

        // Query spatial grid around head
        const nearby = this.grid.getNearbySegments(nextX, nextY, r * 2.5);
        const exclusionSet = new Set(player.recentSegments);

        const checkRadiusSq = (r * 1.8) * (r * 1.8);

        for (const seg of nearby) {
            if (seg.playerId === player.id && exclusionSet.has(seg.id)) {
                continue; // Skip own very recent neck
            }

            const distSq = distToSegmentSquared(nextX, nextY, seg.x1, seg.y1, seg.x2, seg.y2);
            if (distSq <= checkRadiusSq) {
                return true;
            }
        }

        return false;
    }

    updateBotAI(bot, dt) {
        // Lookahead probe rays: Straight, Slight Left, Slight Right
        const lookahead = 42;
        const checkAngles = [
            { angle: bot.angle, steer: 'none' },
            { angle: bot.angle - 0.45, steer: 'left' },
            { angle: bot.angle + 0.45, steer: 'right' },
            { angle: bot.angle - 0.9, steer: 'hard-left' },
            { angle: bot.angle + 0.9, steer: 'hard-right' }
        ];

        let straightDanger = false;
        let leftScore = 0;
        let rightScore = 0;

        for (const probe of checkAngles) {
            const px = bot.x + Math.cos(probe.angle) * lookahead;
            const py = bot.y + Math.sin(probe.angle) * lookahead;

            const hit = this.checkCollision(bot, px, py);
            if (probe.steer === 'none' && hit) {
                straightDanger = true;
            }

            if (hit) {
                if (probe.steer.includes('left')) leftScore += 10;
                if (probe.steer.includes('right')) rightScore += 10;
            }
        }

        // Wall closeness penalty
        const margin = 50;
        if (bot.x < margin) rightScore += (margin - bot.x);
        if (bot.x > ARENA_WIDTH - margin) leftScore += (bot.x - (ARENA_WIDTH - margin));
        if (bot.y < margin) rightScore += (margin - bot.y);
        if (bot.y > ARENA_HEIGHT - margin) leftScore += (bot.y - (ARENA_HEIGHT - margin));

        if (straightDanger || leftScore > 0 || rightScore > 0) {
            if (leftScore < rightScore) {
                bot.inputLeft = true;
                bot.inputRight = false;
            } else {
                bot.inputLeft = false;
                bot.inputRight = true;
            }
        } else {
            // Slight wander
            if (Math.random() < 0.05) {
                const turn = Math.random();
                bot.inputLeft = turn < 0.3;
                bot.inputRight = turn > 0.7;
            }
        }
    }

    spawnExplosion(x, y, color) {
        const count = 35;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 40 + Math.random() * 200;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color,
                life: 1.0,
                maxLife: 0.6 + Math.random() * 0.5,
                radius: 2 + Math.random() * 3.5
            });
        }
    }

    updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 0.94;
            p.vy *= 0.94;
            p.life -= dt / p.maxLife;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    /**
     * Compact snapshot for client network sync
     */
    getSnapshot() {
        const heads = [];
        for (const p of this.players.values()) {
            heads.push({
                id: p.id,
                name: p.name,
                color: p.color,
                score: p.score,
                alive: p.alive,
                x: Math.round(p.x * 10) / 10,
                y: Math.round(p.y * 10) / 10,
                angle: Math.round(p.angle * 100) / 100,
                isDrawing: p.isDrawing
            });
        }

        const newSegs = this.newSegmentsQueue.map(s => ({
            id: s.id,
            p: s.playerId,
            c: s.color,
            x1: Math.round(s.x1 * 100) / 100,
            y1: Math.round(s.y1 * 100) / 100,
            x2: Math.round(s.x2 * 100) / 100,
            y2: Math.round(s.y2 * 100) / 100
        }));
        this.newSegmentsQueue = [];

        const clearSegs = this.clearSegmentsOnClients;
        this.clearSegmentsOnClients = false;

        return {
            state: this.state,
            round: this.roundNumber,
            maxRounds: this.maxRounds,
            countdown: Math.ceil(this.countdownTimer),
            roundWinner: this.roundWinner ? this.roundWinner.name : null,
            matchWinner: this.matchWinner ? this.matchWinner.name : null,
            clearSegments: clearSegs,
            enableGaps: this.enableGaps,
            heads,
            newSegs
        };
    }

    /**
     * Apply snapshot on client
     */
    applySnapshot(snap) {
        if (snap.clearSegments) {
            this.segments = [];
            this.particles = [];
        }

        if (snap.enableGaps !== undefined) {
            this.enableGaps = snap.enableGaps;
        }

        this.state = snap.state;
        this.roundNumber = snap.round;
        this.maxRounds = snap.maxRounds;
        this.countdownTimer = snap.countdown;

        if (snap.roundWinner) {
            this.roundWinner = { name: snap.roundWinner };
        } else {
            this.roundWinner = null;
        }

        if (snap.matchWinner) {
            this.matchWinner = { name: snap.matchWinner };
        } else {
            this.matchWinner = null;
        }

        // Apply new trail segments
        if (snap.newSegs && snap.newSegs.length > 0) {
            for (const s of snap.newSegs) {
                this.segments.push({
                    id: s.id,
                    playerId: s.p,
                    color: s.c,
                    x1: s.x1,
                    y1: s.y1,
                    x2: s.x2,
                    y2: s.y2
                });
            }
        }

        // Update heads
        for (const h of snap.heads) {
            let p = this.players.get(h.id);
            if (!p) {
                p = this.addPlayer(h.id, h.name, h.color);
            }
            if (p.alive && !h.alive) {
                this.spawnExplosion(h.x, h.y, h.color);
                if (window.soundFX) window.soundFX.playDie();
            }
            p.name = h.name;
            p.color = h.color;
            p.score = h.score;
            p.alive = h.alive;
            p.x = h.x;
            p.y = h.y;
            p.angle = h.angle;
            p.isDrawing = h.isDrawing;
        }
    }
}

window.CurveGame = CurveGame;
window.ARENA_WIDTH = ARENA_WIDTH;
window.ARENA_HEIGHT = ARENA_HEIGHT;
window.PLAYER_COLORS = PLAYER_COLORS;
