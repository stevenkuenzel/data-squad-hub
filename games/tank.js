/**
 * DataSquad Hub: Tank Trouble (2D Maze Tank Battle with Bouncing Bullets)
 * P2P WebRTC Multiplayer (2 - 8 Spieler & Bots)
 */

const TANK_ARENA_W = 1200;
const TANK_ARENA_H = 800;
const TANK_SPEED = 140;
const TANK_TURN_SPEED = 3.2;
const TANK_RADIUS = 16;
const BULLET_SPEED = 320;
const BULLET_MAX_BOUNCES = 5;
const BULLET_RADIUS = 3.5;

class TankGame {
    constructor() {
        this.players = new Map(); // id -> TankPlayer
        this.bullets = [];        // active bouncing bullets
        this.walls = [];          // line segments: { x1, y1, x2, y2 }
        this.particles = [];
        this.status = 'LOBBY';    // LOBBY, PLAYING, ROUND_OVER, MATCH_OVER
        this.round = 1;
        this.maxRounds = 5;
        this.roundOverTimer = 0;
        this.roundWinner = null;
        this.matchWinner = null;
        this.nextBulletId = 1;
    }

    addPlayer(id, name, color, isBot = false) {
        if (!this.players.has(id)) {
            this.players.set(id, {
                id,
                name: String(name).slice(0, 16),
                color: color || '#00f3ff',
                score: 0,
                alive: true,
                isBot,
                x: 0,
                y: 0,
                angle: 0,
                cooldown: 0,
                shootCooldown: 1.0 + Math.random() * 1.5,
                inputFwd: false,
                inputBack: false,
                inputLeft: false,
                inputRight: false,
                inputShoot: false
            });
        }
        return this.players.get(id);
    }

    removePlayer(id) {
        this.players.delete(id);
    }

    setInput(id, fwd, back, left, right, shoot) {
        const p = this.players.get(id);
        if (p) {
            p.inputFwd = !!fwd;
            p.inputBack = !!back;
            p.inputLeft = !!left;
            p.inputRight = !!right;
            p.inputShoot = !!shoot;
        }
    }

    generateMaze() {
        this.walls = [];
        const margin = 28;

        // Outer boundaries
        this.walls.push({ x1: margin, y1: margin, x2: TANK_ARENA_W - margin, y2: margin });
        this.walls.push({ x1: TANK_ARENA_W - margin, y1: margin, x2: TANK_ARENA_W - margin, y2: TANK_ARENA_H - margin });
        this.walls.push({ x1: TANK_ARENA_W - margin, y1: TANK_ARENA_H - margin, x2: margin, y2: TANK_ARENA_H - margin });
        this.walls.push({ x1: margin, y1: TANK_ARENA_H - margin, x2: margin, y2: margin });

        // Wide, spacious layout: 5 cols x 3 rows (cells are ~228 x ~248 px)
        // With large corridor gaps (90px) so tanks (width 32px) have plenty of maneuvering room
        const cols = 5;
        const rows = 3;
        const cellW = (TANK_ARENA_W - 2 * margin) / cols;
        const cellH = (TANK_ARENA_H - 2 * margin) / rows;
        const gap = 90;

        // Vertical internal walls with wide openings
        for (let c = 1; c < cols; c++) {
            for (let r = 0; r < rows; r++) {
                if (Math.random() < 0.42) {
                    const x = margin + c * cellW;
                    const y1 = margin + r * cellH + gap / 2;
                    const y2 = margin + (r + 1) * cellH - gap / 2;
                    if (y2 - y1 > 35) {
                        this.walls.push({ x1: x, y1, x2: x, y2 });
                    }
                }
            }
        }

        // Horizontal internal walls with wide openings
        for (let r = 1; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (Math.random() < 0.42) {
                    const y = margin + r * cellH;
                    const x1 = margin + c * cellW + gap / 2;
                    const x2 = margin + (c + 1) * cellW - gap / 2;
                    if (x2 - x1 > 35) {
                        this.walls.push({ x1, y1: y, x2, y2: y });
                    }
                }
            }
        }
    }

    startMatch(maxRounds = 5) {
        this.maxRounds = maxRounds;
        this.round = 1;
        this.matchWinner = null;
        for (const p of this.players.values()) {
            p.score = 0;
        }
        this.startRound();
    }

    startRound() {
        this.generateMaze();
        this.bullets = [];
        this.particles = [];
        this.roundWinner = null;
        this.status = 'PLAYING';

        // Spawn players in random free locations
        const spawns = [
            { x: 100, y: 100 }, { x: TANK_ARENA_W - 100, y: 100 },
            { x: 100, y: TANK_ARENA_H - 100 }, { x: TANK_ARENA_W - 100, y: TANK_ARENA_H - 100 },
            { x: TANK_ARENA_W / 2, y: 100 }, { x: TANK_ARENA_W / 2, y: TANK_ARENA_H - 100 },
            { x: 100, y: TANK_ARENA_H / 2 }, { x: TANK_ARENA_W - 100, y: TANK_ARENA_H / 2 }
        ].sort(() => Math.random() - 0.5);

        let sIdx = 0;
        for (const p of this.players.values()) {
            const sp = spawns[sIdx % spawns.length];
            p.x = sp.x + (Math.random() - 0.5) * 40;
            p.y = sp.y + (Math.random() - 0.5) * 40;
            p.angle = Math.random() * Math.PI * 2;
            p.alive = true;
            p.cooldown = 0;
            sIdx++;
        }
    }

    update(dt) {
        if (this.status === 'ROUND_OVER') {
            this.roundOverTimer -= dt;
            this.updateParticles(dt);
            if (this.roundOverTimer <= 0) {
                // Check match winner
                let leader = null;
                let maxPts = 0;
                for (const p of this.players.values()) {
                    if (p.score > maxPts) {
                        maxPts = p.score;
                        leader = p;
                    }
                }
                if (maxPts >= this.maxRounds || this.round >= this.maxRounds * 2) {
                    this.status = 'MATCH_OVER';
                    this.matchWinner = leader;
                    if (window.soundFX) window.soundFX.playWin();
                } else {
                    this.round++;
                    this.startRound();
                }
            }
            return;
        }

        if (this.status !== 'PLAYING') return;

        // 1. Tank updates
        let aliveCount = 0;
        let lastAlive = null;

        for (const p of this.players.values()) {
            if (!p.alive) continue;
            aliveCount++;
            lastAlive = p;

            if (p.isBot) {
                this.updateTankBot(p, dt);
            }

            // Turning
            if (p.inputLeft) p.angle -= TANK_TURN_SPEED * dt;
            if (p.inputRight) p.angle += TANK_TURN_SPEED * dt;

            // Driving
            let moveDir = 0;
            if (p.inputFwd) moveDir += 1;
            if (p.inputBack) moveDir -= 0.6;

            if (moveDir !== 0) {
                const nextX = p.x + Math.cos(p.angle) * TANK_SPEED * moveDir * dt;
                const nextY = p.y + Math.sin(p.angle) * TANK_SPEED * moveDir * dt;
                if (!this.checkTankWallCollision(nextX, nextY)) {
                    p.x = nextX;
                    p.y = nextY;
                }
            }

            // Shooting (max 5 active bullets per tank to prevent spam)
            if (p.cooldown > 0) p.cooldown -= dt;
            const myActiveBullets = this.bullets.filter(b => b.ownerId === p.id).length;
            if (p.inputShoot && p.cooldown <= 0 && myActiveBullets < 5) {
                this.shootBullet(p);
                p.cooldown = 0.45; // balanced fire rate
            }
        }

        // 2. Bullet physics & bounces
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.life -= dt;

            // Bounce off walls
            for (const w of this.walls) {
                if (this.checkLineCircleCollision(w.x1, w.y1, w.x2, w.y2, b.x, b.y, BULLET_RADIUS)) {
                    // Reflect bullet vector
                    const dx = w.x2 - w.x1;
                    const dy = w.y2 - w.y1;
                    const len = Math.hypot(dx, dy);
                    const nx = -dy / len;
                    const ny = dx / len;

                    const dot = b.vx * nx + b.vy * ny;
                    b.vx -= 2 * dot * nx;
                    b.vy -= 2 * dot * ny;
                    b.bounces++;
                    if (window.soundFX) window.soundFX.playClick();
                    break;
                }
            }

            // Hit test against tanks
            for (const p of this.players.values()) {
                if (!p.alive) continue;
                // Exclude shooter for the first 0.15 seconds so tank doesn't shoot itself immediately
                if (b.ownerId === p.id && b.timeAlive < 0.15) continue;

                const dist = Math.hypot(p.x - b.x, p.y - b.y);
                if (dist < TANK_RADIUS + BULLET_RADIUS) {
                    p.alive = false;
                    this.spawnExplosion(p.x, p.y, p.color);
                    if (window.soundFX) window.soundFX.playDie();

                    // Award point to shooter if not suicide
                    if (b.ownerId !== p.id) {
                        const shooter = this.players.get(b.ownerId);
                        if (shooter) shooter.score++;
                    }

                    b.life = 0; // destroy bullet
                    break;
                }
            }

            b.timeAlive += dt;
            if (b.life <= 0 || b.bounces >= BULLET_MAX_BOUNCES) {
                this.bullets.splice(i, 1);
            }
        }

        this.updateParticles(dt);

        // Round completion check
        const totalPlayers = this.players.size;
        const requiredAlive = totalPlayers > 1 ? 1 : 0;
        if (aliveCount <= requiredAlive) {
            this.status = 'ROUND_OVER';
            this.roundOverTimer = 2.5;
            this.roundWinner = lastAlive;
            if (lastAlive && window.soundFX) window.soundFX.playWin();
        }
    }

    shootBullet(tank) {
        const barrelLen = TANK_RADIUS + 8;
        const startX = tank.x + Math.cos(tank.angle) * barrelLen;
        const startY = tank.y + Math.sin(tank.angle) * barrelLen;

        this.bullets.push({
            id: this.nextBulletId++,
            ownerId: tank.id,
            color: tank.color,
            x: startX,
            y: startY,
            vx: Math.cos(tank.angle) * BULLET_SPEED,
            vy: Math.sin(tank.angle) * BULLET_SPEED,
            bounces: 0,
            life: 6.0,
            timeAlive: 0
        });

        if (window.soundFX) window.soundFX.playGap();
    }

    checkTankWallCollision(x, y) {
        for (const w of this.walls) {
            if (this.checkLineCircleCollision(w.x1, w.y1, w.x2, w.y2, x, y, TANK_RADIUS)) {
                return true;
            }
        }
        return false;
    }

    checkLineCircleCollision(x1, y1, x2, y2, cx, cy, r) {
        const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
        if (l2 === 0) return Math.hypot(cx - x1, cy - y1) <= r;
        let t = ((cx - x1) * (x2 - x1) + (cy - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        const projX = x1 + t * (x2 - x1);
        const projY = y1 + t * (y2 - y1);
        return Math.hypot(cx - projX, cy - projY) <= r;
    }

    hasLineOfSight(x1, y1, x2, y2) {
        for (const w of this.walls) {
            if (this.checkLineSegmentsIntersect(x1, y1, x2, y2, w.x1, w.y1, w.x2, w.y2)) {
                return false;
            }
        }
        return true;
    }

    checkLineSegmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
        const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
        if (denom === 0) return false;
        const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
        const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
        return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
    }

    updateTankBot(bot, dt) {
        bot.shootCooldown = Math.max(0, (bot.shootCooldown || 0) - dt);

        // Find closest enemy tank
        let target = null;
        let minDist = Infinity;
        for (const other of this.players.values()) {
            if (other.id !== bot.id && other.alive) {
                const d = Math.hypot(other.x - bot.x, other.y - bot.y);
                if (d < minDist) {
                    minDist = d;
                    target = other;
                }
            }
        }

        if (target) {
            const hasSight = this.hasLineOfSight(bot.x, bot.y, target.x, target.y);
            const desiredAngle = Math.atan2(target.y - bot.y, target.x - bot.x);
            let angleDiff = desiredAngle - bot.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

            bot.inputLeft = angleDiff < -0.15;
            bot.inputRight = angleDiff > 0.15;

            // Obstacle check directly ahead
            const lookAheadX = bot.x + Math.cos(bot.angle) * 36;
            const lookAheadY = bot.y + Math.sin(bot.angle) * 36;
            const obstacleAhead = this.checkTankWallCollision(lookAheadX, lookAheadY);

            bot.inputFwd = !obstacleAhead && Math.abs(angleDiff) < 0.75 && (minDist > 140 || !hasSight);
            bot.inputBack = obstacleAhead;

            // Shoot only when:
            // 1. Aimed directly towards enemy (|angleDiff| < 0.22)
            // 2. Clear line of sight (no wall in between)
            // 3. Enemy is within weapon range (< 650px)
            // 4. Cooldown timer has expired (1.2s - 2.2s between shots, NO spam!)
            if (hasSight && Math.abs(angleDiff) < 0.22 && minDist < 650 && bot.shootCooldown <= 0) {
                bot.inputShoot = true;
                bot.shootCooldown = 1.2 + Math.random() * 1.0;
            } else {
                bot.inputShoot = false;
            }
        } else {
            bot.inputFwd = true;
            bot.inputLeft = Math.random() < 0.05;
            bot.inputRight = Math.random() < 0.05;
            bot.inputShoot = false;
        }
    }

    spawnExplosion(x, y, color) {
        for (let i = 0; i < 30; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 40 + Math.random() * 220;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color,
                life: 1.0,
                maxLife: 0.7
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
            round: this.round,
            maxRounds: this.maxRounds,
            roundWinner: this.roundWinner ? this.roundWinner.name : null,
            matchWinner: this.matchWinner ? this.matchWinner.name : null,
            walls: this.walls,
            tanks: Array.from(this.players.values()).map(p => ({
                id: p.id,
                name: p.name,
                color: p.color,
                score: p.score,
                alive: p.alive,
                x: Math.round(p.x * 10) / 10,
                y: Math.round(p.y * 10) / 10,
                angle: Math.round(p.angle * 100) / 100
            })),
            bullets: this.bullets.map(b => ({
                id: b.id,
                x: Math.round(b.x * 10) / 10,
                y: Math.round(b.y * 10) / 10,
                color: b.color
            }))
        };
    }

    applySnapshot(snap) {
        this.status = snap.status;
        this.round = snap.round;
        this.maxRounds = snap.maxRounds;
        this.roundWinner = snap.roundWinner ? { name: snap.roundWinner } : null;
        this.matchWinner = snap.matchWinner ? { name: snap.matchWinner } : null;
        this.walls = snap.walls || [];
        this.bullets = snap.bullets || [];

        for (const t of snap.tanks) {
            let p = this.players.get(t.id);
            if (!p) p = this.addPlayer(t.id, t.name, t.color);
            if (p.alive && !t.alive) {
                this.spawnExplosion(t.x, t.y, t.color);
                if (window.soundFX) window.soundFX.playDie();
            }
            p.name = t.name;
            p.color = t.color;
            p.score = t.score;
            p.alive = t.alive;
            p.x = t.x;
            p.y = t.y;
            p.angle = t.angle;
        }
    }
}

window.TankGame = TankGame;
window.TANK_ARENA_W = TANK_ARENA_W;
window.TANK_ARENA_H = TANK_ARENA_H;
