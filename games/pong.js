/**
 * DataSquad Hub: Octa-Pong (8-Player Octagon Pong mit Diagonalen)
 * P2P WebRTC Multiplayer (2 - 8 Spieler & Bots)
 */

const PONG_CENTER_X = 600;
const PONG_CENTER_Y = 400;
const PONG_RADIUS = 340;
const PADDLE_WIDTH_RATIO = 0.42; // Width of paddle relative to side length
const BALL_INITIAL_SPEED = 280;
const BALL_MAX_SPEED = 540;
const BALL_RADIUS = 7;

class OctaPongGame {
    constructor() {
        this.players = new Map(); // id -> PongPlayer { id, name, color, sideIdx: 0..7, paddlePos: 0.5, lives: 4, alive: true, isBot }
        this.balls = [];          // active balls
        this.particles = [];
        this.status = 'LOBBY';    // LOBBY, COUNTDOWN, PLAYING, GAME_OVER
        this.countdownTimer = 0;
        this.winner = null;
        this.nextBallId = 1;
        this.stats = {};

        // Precompute 8 vertices of the regular octagon
        this.vertices = [];
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI / 4) - (Math.PI / 8);
            this.vertices.push({
                x: PONG_CENTER_X + Math.cos(angle) * PONG_RADIUS,
                y: PONG_CENTER_Y + Math.sin(angle) * PONG_RADIUS
            });
        }
    }

    addPlayer(id, name, color, isBot = false) {
        if (!this.players.has(id)) {
            if (this.players.size >= 8) return null;
            // Find first available side 0..7
            const takenSides = new Set(Array.from(this.players.values()).map(p => p.sideIdx));
            let sideIdx = 0;
            for (let i = 0; i < 8; i++) {
                if (!takenSides.has(i)) {
                    sideIdx = i;
                    break;
                }
            }

            this.players.set(id, {
                id,
                name: String(name).slice(0, 16),
                color: color || '#00f3ff',
                sideIdx,
                paddlePos: 0.5, // 0.0 to 1.0 along the segment
                lives: 4,
                alive: true,
                isBot,
                inputLeft: false,
                inputRight: false
            });
        }
        return this.players.get(id);
    }

    removePlayer(id) {
        this.players.delete(id);
    }

    setInput(id, left, right) {
        const p = this.players.get(id);
        if (p) {
            p.inputLeft = !!left;
            p.inputRight = !!right;
        }
    }

    startMatch() {
        this.winner = null;
        this.stats = {};
        this.particles = [];
        for (const p of this.players.values()) {
            p.lives = 4;
            p.alive = true;
            p.paddlePos = 0.5;
        }
        this.startCountdown();
    }

    startCountdown() {
        this.status = 'COUNTDOWN';
        this.countdownTimer = 3.0;
        this.balls = [];
        this.spawnBall();
        if (window.soundFX) window.soundFX.playCountdown(false);
    }

    spawnBall() {
        const angle = Math.random() * Math.PI * 2;
        this.balls.push({
            id: this.nextBallId++,
            x: PONG_CENTER_X,
            y: PONG_CENTER_Y,
            vx: Math.cos(angle) * BALL_INITIAL_SPEED,
            vy: Math.sin(angle) * BALL_INITIAL_SPEED,
            speed: BALL_INITIAL_SPEED
        });
    }

    getSideSegment(sideIdx) {
        const p1 = this.vertices[sideIdx];
        const p2 = this.vertices[(sideIdx + 1) % 8];
        return { p1, p2 };
    }

    update(dt) {
        if (this.status === 'COUNTDOWN') {
            this.countdownTimer -= dt;
            if (this.countdownTimer <= 0) {
                this.status = 'PLAYING';
                if (window.soundFX) window.soundFX.playCountdown(true);
            }
            return;
        }

        if (this.status !== 'PLAYING') return;

        // 1. Move player paddles
        const paddleMoveSpeed = 1.4; // fraction of side per second
        for (const p of this.players.values()) {
            if (!p.alive) continue;

            if (p.isBot) {
                this.updateBot(p, dt);
            }

            if (p.inputLeft && !p.inputRight) {
                p.paddlePos = Math.max(0.12, p.paddlePos - paddleMoveSpeed * dt);
            } else if (p.inputRight && !p.inputLeft) {
                p.paddlePos = Math.min(0.88, p.paddlePos + paddleMoveSpeed * dt);
            }
        }

        // 2. Ball physics & octagon boundary collision with sub-stepping (prevents tunneling at high speeds)
        const SUB_STEPS = 4;
        const subDt = dt / SUB_STEPS;

        for (let step = 0; step < SUB_STEPS; step++) {
            for (let bIdx = this.balls.length - 1; bIdx >= 0; bIdx--) {
                const b = this.balls[bIdx];
                b.x += b.vx * subDt;
                b.y += b.vy * subDt;

                // Check collision against all 8 sides
                for (let s = 0; s < 8; s++) {
                    const { p1, p2 } = this.getSideSegment(s);
                    const dx = p2.x - p1.x;
                    const dy = p2.y - p1.y;
                    const sideLen = Math.hypot(dx, dy);

                    // Inward normal vector pointing towards center
                    const nx = -(p2.y - p1.y) / sideLen;
                    const ny = (p2.x - p1.x) / sideLen;

                    // Dot product: only collide when ball is moving OUTWARDS toward the boundary
                    const dot = b.vx * nx + b.vy * ny;
                    if (dot >= 0) continue; // Moving inward away from wall, skip

                    // Distance from ball to boundary line (positive inside court, 0 on line, negative outside)
                    const distToLine = (b.x - p1.x) * nx + (b.y - p1.y) * ny;

                    if (distToLine <= BALL_RADIUS) {
                        // Projection t along segment [0, 1]
                        const t = ((b.x - p1.x) * dx + (b.y - p1.y) * dy) / (sideLen * sideLen);

                        if (t >= -0.08 && t <= 1.08) {
                            // Find active player on this side
                            let playerOnSide = null;
                            for (const pl of this.players.values()) {
                                if (pl.sideIdx === s && pl.alive) {
                                    playerOnSide = pl;
                                    break;
                                }
                            }

                            if (playerOnSide) {
                                // Generous paddle hit tolerance: half paddle width + safety margin
                                const halfW = PADDLE_WIDTH_RATIO / 2;
                                if (Math.abs(t - playerOnSide.paddlePos) <= halfW + 0.08) {
                                    // HIT PADDLE! Deflect cleanly back inward
                                    const hitOffset = Math.max(-1, Math.min(1, (t - playerOnSide.paddlePos) / halfW));
                                    const inwardNormalAngle = Math.atan2(ny, nx);
                                    const deflectAngle = inwardNormalAngle + hitOffset * 0.70;

                                    b.speed = Math.min(BALL_MAX_SPEED, b.speed * 1.05);
                                    b.vx = Math.cos(deflectAngle) * b.speed;
                                    b.vy = Math.sin(deflectAngle) * b.speed;

                                    // Position ball safely inside court on paddle face
                                    b.x = p1.x + t * dx + nx * (BALL_RADIUS + 4);
                                    b.y = p1.y + t * dy + ny * (BALL_RADIUS + 4);
                                    bumpStat(this, playerOnSide.id, 'saves');

                                    if (window.soundFX) window.soundFX.playClick();
                                    break;
                                } else if (distToLine <= 0) {
                                    // GOAL! Ball passed paddle completely
                                    playerOnSide.lives--;
                                    this.spawnGoalExplosion(b.x, b.y, playerOnSide.color);
                                    if (window.soundFX) window.soundFX.playDie();

                                    if (playerOnSide.lives <= 0) {
                                        playerOnSide.alive = false;
                                    }

                                    // Reset ball to center
                                    b.x = PONG_CENTER_X;
                                    b.y = PONG_CENTER_Y;
                                    const resetAngle = Math.random() * Math.PI * 2;
                                    b.speed = BALL_INITIAL_SPEED;
                                    b.vx = Math.cos(resetAngle) * b.speed;
                                    b.vy = Math.sin(resetAngle) * b.speed;
                                    break;
                                }
                            } else {
                                // Solid wall bounce (no active player on this side)
                                b.vx -= 2 * dot * nx;
                                b.vy -= 2 * dot * ny;
                                b.x = p1.x + t * dx + nx * (BALL_RADIUS + 4);
                                b.y = p1.y + t * dy + ny * (BALL_RADIUS + 4);
                                if (window.soundFX) window.soundFX.playClick();
                                break;
                            }
                        }
                    }
                }
            }
        }

        // Add 2nd ball after 30 seconds for extra madness
        if (this.balls.length === 1 && Math.random() < 0.001) {
            this.spawnBall();
        }

        this.updateParticles(dt);

        // Check if only 1 player remains alive
        const alivePlayers = Array.from(this.players.values()).filter(p => p.alive);
        if (alivePlayers.length <= (this.players.size > 1 ? 1 : 0)) {
            this.status = 'GAME_OVER';
            this.winner = alivePlayers[0] || null;
            if (this.winner && window.soundFX) window.soundFX.playWin();
        }
    }

    updateBot(bot, dt) {
        // Track the closest ball heading towards this side
        const { p1, p2 } = this.getSideSegment(bot.sideIdx);
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const sideLen = Math.hypot(dx, dy);

        let targetT = 0.5;
        let minD = Infinity;

        for (const b of this.balls) {
            const dist = Math.hypot(b.x - PONG_CENTER_X, b.y - PONG_CENTER_Y);
            if (dist < minD) {
                minD = dist;
                // Project ball onto side segment
                targetT = ((b.x - p1.x) * dx + (b.y - p1.y) * dy) / (sideLen * sideLen);
            }
        }

        targetT = Math.max(0.15, Math.min(0.85, targetT));
        bot.inputLeft = bot.paddlePos > targetT + 0.05;
        bot.inputRight = bot.paddlePos < targetT - 0.05;
    }

    spawnGoalExplosion(x, y, color) {
        for (let i = 0; i < 25; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 40 + Math.random() * 200;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color,
                life: 1.0,
                maxLife: 0.6
            });
        }
    }

    updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt / p.maxLife;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
    }

    getSnapshot() {
        return {
            status: this.status,
            countdownTimer: Math.ceil(this.countdownTimer),
            winner: this.winner ? this.winner.name : null,
            balls: this.balls.map(b => ({
                id: b.id,
                x: Math.round(b.x),
                y: Math.round(b.y)
            })),
            players: Array.from(this.players.values()).map(p => ({
                id: p.id,
                name: p.name,
                color: p.color,
                sideIdx: p.sideIdx,
                paddlePos: Math.round(p.paddlePos * 100) / 100,
                lives: p.lives,
                alive: p.alive,
                isBot: p.isBot
            }))
        };
    }

    applySnapshot(snap) {
        this.status = snap.status;
        this.countdownTimer = snap.countdownTimer;
        this.winner = snap.winner ? { name: snap.winner } : null;
        this.balls = snap.balls || [];

        const playerIds = new Set(snap.players.map(pl => pl.id));
        for (const id of Array.from(this.players.keys())) {
            if (!playerIds.has(id)) this.players.delete(id);
        }
        for (const pl of snap.players) {
            let p = this.players.get(pl.id);
            if (!p) p = this.addPlayer(pl.id, pl.name, pl.color, pl.isBot);
            if (p.lives > pl.lives) {
                if (window.soundFX) window.soundFX.playDie();
            }
            p.name = pl.name;
            p.color = pl.color;
            p.sideIdx = pl.sideIdx;
            p.paddlePos = pl.paddlePos;
            p.lives = pl.lives;
            p.alive = pl.alive;
        }
    }
}

window.OctaPongGame = OctaPongGame;
window.PONG_CENTER_X = PONG_CENTER_X;
window.PONG_CENTER_Y = PONG_CENTER_Y;
window.PONG_RADIUS = PONG_RADIUS;
window.PADDLE_WIDTH_RATIO = PADDLE_WIDTH_RATIO;
window.BALL_RADIUS = BALL_RADIUS;
