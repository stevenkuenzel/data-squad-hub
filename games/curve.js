/**
 * Authoritative Curve Game Engine with Spatial Hashing Collision
 */

const ARENA_WIDTH = 1200;
const ARENA_HEIGHT = 800;
const SPEED = 160;             // Arena units per second
const TURN_SPEED = 3.4;        // Radians per second
const LINE_RADIUS = 3.5;       // Trail half-width
const HEAD_RADIUS = 5.0;       // Head collision radius
const GRID_CELL_SIZE = 50;     // Spatial hash cell size

// Available vibrant player colors (14 distinct high-contrast colors for up to 12 players)
const PLAYER_COLORS = [
    { name: 'Neon Cyan', hex: '#00f3ff', glow: 'rgba(0, 243, 255, 0.6)' },
    { name: 'Laser Pink', hex: '#ff007f', glow: 'rgba(255, 0, 127, 0.6)' },
    { name: 'Acid Lime', hex: '#39ff14', glow: 'rgba(57, 255, 20, 0.6)' },
    { name: 'Solar Amber', hex: '#ffaa00', glow: 'rgba(255, 170, 0, 0.6)' },
    { name: 'Electric Violet', hex: '#bd00ff', glow: 'rgba(189, 0, 255, 0.6)' },
    { name: 'Crimson Glow', hex: '#ff3333', glow: 'rgba(255, 51, 51, 0.6)' },
    { name: 'Emerald Wave', hex: '#00ffaa', glow: 'rgba(0, 255, 170, 0.6)' },
    { name: 'Sky Azure', hex: '#0099ff', glow: 'rgba(0, 153, 255, 0.6)' },
    { name: 'Hot Magenta', hex: '#ff00aa', glow: 'rgba(255, 0, 170, 0.6)' },
    { name: 'Bright Gold', hex: '#ffd700', glow: 'rgba(255, 215, 0, 0.6)' },
    { name: 'Tangerine', hex: '#ff5500', glow: 'rgba(255, 85, 0, 0.6)' },
    { name: 'Teal Mint', hex: '#00e5c0', glow: 'rgba(0, 229, 192, 0.6)' },
    { name: 'Lilac', hex: '#a855f7', glow: 'rgba(168, 85, 247, 0.6)' },
    { name: 'Rose Glow', hex: '#ff4081', glow: 'rgba(255, 64, 129, 0.6)' }
];

function sanitizeName(raw) {
    if (typeof raw !== 'string') return 'Player';
    // Remove control characters, HTML tags, trim, and limit to 16 chars
    const clean = raw.trim().replace(/[<>'"&]/g, '').slice(0, 16);
    return clean || 'Player';
}

function sanitizeColor(hex) {
    if (typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(hex)) {
        return hex;
    }
    return PLAYER_COLORS[0].hex;
}

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

const POWERUP_TYPES = [
    { type: 'invert', name: 'Invert Controls', icon: '🔀', color: '#ff0055', target: 'others', duration: 4.5, desc: 'Steuerung aller Gegner vertauscht!' },
    { type: 'turbo', name: 'Hyper-Turbo', icon: '🚀', color: '#ff5500', target: 'others', duration: 3.5, desc: 'Alle Gegner rasen mit 1.8x Speed!' },
    { type: 'fat', name: 'Fat Lines', icon: '🐘', color: '#ff00aa', target: 'others', duration: 5.0, desc: 'Gegner zeichnen dicke Barrieren!' },
    { type: 'ghost', name: 'Geist-Modus', icon: '👻', color: '#00f3ff', target: 'self', duration: 3.5, desc: 'Unverwundbar! Durchdringt alle Linien!' },
    { type: 'slow', name: 'Slow-Motion', icon: '🐢', color: '#39ff14', target: 'self', duration: 4.0, desc: 'Präzisions-Schleichgang!' },
    { type: 'bomb', name: 'Bombe / Cleanse', icon: '💣', color: '#ffe600', target: 'global', duration: 0, desc: 'Löscht alle Linien im Umkreis!' }
];

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
        this.botDifficulty = 'medium';    // 'easy', 'medium', 'hard', 'insane'

        // Mario Kart Style Power-Ups
        this.powerUpsEnabled = true;
        this.powerUps = [];               // array of active orbs on field
        this.activeEffects = [];          // array of currently running effects on players
        this.powerUpSpawnTimer = 3.5;
        this.banner = null;               // { text, color, timer }
        this.nextPowerUpId = 1;

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
        this.powerUps = [];
        this.activeEffects = [];
        this.banner = null;
        this.powerUpSpawnTimer = 3.5;

        // Position players in random positions pointing towards center

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
        }
    }

    setPowerUpsEnabled(enabled) {
        this.powerUpsEnabled = !!enabled;
        if (!this.powerUpsEnabled) {
            this.powerUps = [];
            this.activeEffects = [];
            this.banner = null;
        }
    }

    addPlayer(id, name, colorHex, isBot = false) {
        if (this.players.has(id)) return this.players.get(id);

        const safeId = String(id).slice(0, 40);
        const safeName = sanitizeName(name);
        const safeColor = sanitizeColor(colorHex);

        const player = {
            id: safeId,
            name: safeName,
            color: safeColor,
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

        // Active Banner timer
        if (this.banner) {
            this.banner.timer -= dt;
            if (this.banner.timer <= 0) this.banner = null;
        }

        // Active Effects countdowns
        for (let i = this.activeEffects.length - 1; i >= 0; i--) {
            const eff = this.activeEffects[i];
            eff.remaining -= dt;
            if (eff.remaining <= 0) {
                this.activeEffects.splice(i, 1);
            }
        }

        // Spawn Power-Ups periodically
        if (this.powerUpsEnabled) {
            this.powerUpSpawnTimer -= dt;
            if (this.powerUpSpawnTimer <= 0) {
                this.powerUpSpawnTimer = 4.0 + Math.random() * 3.5;
                if (this.powerUps.length < 4) {
                    this.spawnPowerUp();
                }
            }
        }

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

            // Player effects lookup
            const pEffects = this.activeEffects.filter(e => e.targetPlayerId === p.id);
            const isInverted = pEffects.some(e => e.type === 'invert');
            const isTurbo = pEffects.some(e => e.type === 'turbo');
            const isSlow = pEffects.some(e => e.type === 'slow');
            const isGhost = pEffects.some(e => e.type === 'ghost');
            const isFat = pEffects.some(e => e.type === 'fat');

            // Turning (Mario Kart Invert effect!)
            let turnLeft = p.inputLeft;
            let turnRight = p.inputRight;
            if (isInverted) {
                turnLeft = p.inputRight;
                turnRight = p.inputLeft;
            }

            if (turnLeft && !turnRight) {
                p.angle -= TURN_SPEED * dt;
            } else if (turnRight && !turnLeft) {
                p.angle += TURN_SPEED * dt;
            }

            // Move forward with speed modifiers
            let speedMult = 1.0;
            if (isTurbo) speedMult *= 1.85;
            if (isSlow) speedMult *= 0.55;

            const stepDist = SPEED * speedMult * dt;
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

            // Check collision for head at next position (Ghost mode phases through!)
            let hit = false;
            if (!isGhost) {
                hit = this.checkCollision(p, nextX, nextY);
            } else {
                // In ghost mode, deflect gently from boundary walls
                if (nextX < 15 || nextX > ARENA_WIDTH - 15 || nextY < 15 || nextY > ARENA_HEIGHT - 15) {
                    p.angle = Math.atan2(ARENA_HEIGHT / 2 - nextY, ARENA_WIDTH / 2 - nextX);
                }
            }

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

            // Create new segment if drawing (Fat Lines modifier creates thicker walls)
            if (p.isDrawing) {
                const segLineWidth = isFat ? 8 : 4;
                const seg = {
                    id: this.nextSegmentId++,
                    playerId: p.id,
                    color: p.color,
                    lineWidth: segLineWidth,
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

            // Power-Up pickup collision check
            if (this.powerUpsEnabled) {
                for (let i = this.powerUps.length - 1; i >= 0; i--) {
                    const pu = this.powerUps[i];
                    const dist = Math.hypot(p.x - pu.x, p.y - pu.y);
                    if (dist <= HEAD_RADIUS + pu.radius) {
                        this.powerUps.splice(i, 1);
                        this.activatePowerUp(p, pu);
                        break;
                    }
                }
            }
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

        for (const seg of nearby) {
            if (seg.playerId === player.id && exclusionSet.has(seg.id)) {
                continue; // Skip own very recent neck
            }

            const checkR = seg.lineWidth ? (seg.lineWidth / 2 + r * 0.9) : (r * 1.8);
            const distSq = distToSegmentSquared(nextX, nextY, seg.x1, seg.y1, seg.x2, seg.y2);
            if (distSq <= checkR * checkR) {
                return true;
            }
        }

        return false;
    }

    spawnPowerUp() {
        const template = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
        const margin = 120;
        const x = margin + Math.random() * (ARENA_WIDTH - margin * 2);
        const y = margin + Math.random() * (ARENA_HEIGHT - margin * 2);
        this.powerUps.push({
            id: this.nextPowerUpId++,
            type: template.type,
            name: template.name,
            icon: template.icon,
            color: template.color,
            target: template.target,
            duration: template.duration,
            x,
            y,
            radius: 18
        });
    }

    activatePowerUp(player, pu) {
        if (window.soundFX) window.soundFX.playWin();

        // Pickup explosion particles
        for (let i = 0; i < 22; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 40 + Math.random() * 140;
            this.particles.push({
                x: pu.x,
                y: pu.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: pu.color,
                radius: 3 + Math.random() * 3,
                life: 0.9,
                maxLife: 0.9
            });
        }

        this.banner = {
            text: `${player.name} aktiviert ${pu.icon} ${pu.name.toUpperCase()}!`,
            color: pu.color,
            timer: 2.8
        };

        if (pu.type === 'bomb') {
            // Detonate bomb: destroy all line segments in 170px radius
            const bombRadiusSq = 170 * 170;
            const remaining = [];
            this.grid.clear();
            for (const s of this.segments) {
                const midX = (s.x1 + s.x2) / 2;
                const midY = (s.y1 + s.y2) / 2;
                const dSq = (midX - pu.x) * (midX - pu.x) + (midY - pu.y) * (midY - pu.y);
                if (dSq > bombRadiusSq) {
                    remaining.push(s);
                    this.grid.addSegment(s);
                }
            }
            this.segments = remaining;
            this.clearSegmentsOnClients = true;
            this.newSegmentsQueue = [...remaining];

            // Shockwave particles
            for (let i = 0; i < 50; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 90 + Math.random() * 260;
                this.particles.push({
                    x: pu.x,
                    y: pu.y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    color: '#ffe600',
                    radius: 4 + Math.random() * 4,
                    life: 1.1,
                    maxLife: 1.1
                });
            }
        } else if (pu.target === 'self') {
            this.activeEffects.push({
                id: Math.random(),
                type: pu.type,
                targetPlayerId: player.id,
                remaining: pu.duration,
                icon: pu.icon,
                label: pu.name,
                color: pu.color
            });
        } else if (pu.target === 'others') {
            for (const other of this.players.values()) {
                if (other.id !== player.id && other.alive) {
                    this.activeEffects.push({
                        id: Math.random(),
                        type: pu.type,
                        targetPlayerId: other.id,
                        remaining: pu.duration,
                        icon: pu.icon,
                        label: pu.name,
                        color: pu.color
                    });
                }
            }
        }
    }

    getRayClearance(bot, originX, originY, angle, maxDist, step = 14) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        let dist = 0;

        while (dist < maxDist) {
            dist += step;
            const px = originX + cos * dist;
            const py = originY + sin * dist;
            if (this.checkCollision(bot, px, py)) {
                return Math.max(0, dist - step);
            }
        }
        return maxDist;
    }

    updateBotAI(bot, dt) {
        const profiles = {
            easy: {
                lookahead: 55,
                emergencyDist: 28,
                angles: [0.35, 0.75, 1.25],
                jitter: 0.12,
                step: 18
            },
            medium: {
                lookahead: 95,
                emergencyDist: 38,
                angles: [0.25, 0.55, 0.90, 1.35],
                jitter: 0.04,
                step: 16
            },
            hard: {
                lookahead: 140,
                emergencyDist: 50,
                angles: [0.20, 0.45, 0.75, 1.10, 1.50],
                jitter: 0.01,
                step: 14
            },
            insane: {
                lookahead: 195,
                emergencyDist: 65,
                angles: [0.15, 0.35, 0.60, 0.90, 1.25, 1.65],
                jitter: 0.00,
                step: 12
            }
        };

        const prof = profiles[this.botDifficulty] || profiles.medium;

        // 1. Immediate frontal clearance check
        const frontClearance = this.getRayClearance(bot, bot.x, bot.y, bot.angle, prof.emergencyDist, prof.step);
        const inEmergency = frontClearance < prof.emergencyDist;

        // 2. Spatial fan clearance calculation (Left vs Right)
        let leftScore = 0;
        let rightScore = 0;

        prof.angles.forEach((offset, idx) => {
            const weight = 1.0 / (1.0 + idx * 0.2); // slight preference for forward-diagonal rays

            // Left probe
            const lDist = this.getRayClearance(bot, bot.x, bot.y, bot.angle - offset, prof.lookahead, prof.step);
            leftScore += (lDist * lDist) * weight;

            // Right probe
            const rDist = this.getRayClearance(bot, bot.x, bot.y, bot.angle + offset, prof.lookahead, prof.step);
            rightScore += (rDist * rDist) * weight;
        });

        // 3. Wall awareness buffer
        const wallBuffer = 70;
        if (bot.x < wallBuffer) {
            // Wall on the left/west: penalize turning left if facing towards it
            const westward = Math.cos(bot.angle);
            if (westward < 0) leftScore *= 0.3;
        }
        if (bot.x > ARENA_WIDTH - wallBuffer) {
            const eastward = Math.cos(bot.angle);
            if (eastward > 0) rightScore *= 0.3;
        }
        if (bot.y < wallBuffer) {
            const northward = Math.sin(bot.angle);
            if (northward < 0) leftScore *= 0.3;
        }
        if (bot.y > ARENA_HEIGHT - wallBuffer) {
            const southward = Math.sin(bot.angle);
            if (southward > 0) rightScore *= 0.3;
        }

        // 4. Decision logic
        const maxScore = Math.max(leftScore, rightScore, 1);
        const diffRatio = Math.abs(leftScore - rightScore) / maxScore;

        if (inEmergency || diffRatio > 0.06) {
            if (leftScore > rightScore) {
                bot.inputLeft = true;
                bot.inputRight = false;
            } else {
                bot.inputLeft = false;
                bot.inputRight = true;
            }
        } else {
            // Front is clear and sides are balanced
            bot.inputLeft = false;
            bot.inputRight = false;

            // Occasional wander based on difficulty jitter
            if (Math.random() < prof.jitter) {
                const wander = Math.random();
                bot.inputLeft = wander < 0.45;
                bot.inputRight = wander > 0.55;
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
            w: s.lineWidth || 4,
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
            botDifficulty: this.botDifficulty,
            powerUpsEnabled: this.powerUpsEnabled,
            powerUps: this.powerUps.map(pu => ({
                id: pu.id,
                type: pu.type,
                name: pu.name,
                icon: pu.icon,
                color: pu.color,
                x: Math.round(pu.x),
                y: Math.round(pu.y),
                radius: pu.radius
            })),
            activeEffects: this.activeEffects.map(e => ({
                type: e.type,
                targetPlayerId: e.targetPlayerId,
                remaining: Math.round(e.remaining * 10) / 10,
                icon: e.icon,
                label: e.label,
                color: e.color
            })),
            banner: this.banner ? {
                text: this.banner.text,
                color: this.banner.color,
                timer: Math.round(this.banner.timer * 10) / 10
            } : null,
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

        if (snap.botDifficulty !== undefined) {
            this.botDifficulty = snap.botDifficulty;
        }

        if (snap.powerUpsEnabled !== undefined) {
            this.powerUpsEnabled = snap.powerUpsEnabled;
            if (!this.powerUpsEnabled) {
                this.powerUps = [];
                this.activeEffects = [];
                this.banner = null;
            }
        }

        if (snap.powerUps) this.powerUps = snap.powerUps;
        if (snap.activeEffects) this.activeEffects = snap.activeEffects;
        if (snap.banner !== undefined) this.banner = snap.banner;

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
                    lineWidth: s.w || 4,
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
window.LINE_RADIUS = LINE_RADIUS;
window.HEAD_RADIUS = HEAD_RADIUS;
window.PLAYER_COLORS = PLAYER_COLORS;
window.POWERUP_TYPES = POWERUP_TYPES;
