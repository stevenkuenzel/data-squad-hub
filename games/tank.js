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


// Feste Labyrinth-Layouts (Wandsegmente im 1200x800-Feld). Spawnpunkte und Korridore (>= 80px) bleiben frei.
function tankBox(cx, cy, w, h) {
    const x1 = cx - w / 2, x2 = cx + w / 2, y1 = cy - h / 2, y2 = cy + h / 2;
    return [
        { x1, y1, x2, y2: y1 }, { x1: x2, y1, x2, y2 },
        { x1: x2, y1: y2, x2: x1, y2 }, { x1, y1: y2, x2: x1, y2: y1 }
    ];
}

const TANK_LAYOUTS = {
    cross: () => [
        { x1: 330, y1: 400, x2: 540, y2: 400 }, { x1: 660, y1: 400, x2: 870, y2: 400 },
        { x1: 600, y1: 180, x2: 600, y2: 330 }, { x1: 600, y1: 470, x2: 600, y2: 620 }
    ],
    pillars: () => [
        [300, 250], [600, 250], [900, 250], [300, 550], [600, 550], [900, 550], [450, 400], [750, 400]
    ].flatMap(([cx, cy]) => tankBox(cx, cy, 70, 70)),
    chambers: () => [
        { x1: 400, y1: 130, x2: 400, y2: 330 }, { x1: 400, y1: 470, x2: 400, y2: 670 },
        { x1: 800, y1: 130, x2: 800, y2: 330 }, { x1: 800, y1: 470, x2: 800, y2: 670 }
    ],
    zigzag: () => [
        { x1: 200, y1: 250, x2: 800, y2: 250 }, { x1: 400, y1: 550, x2: 1000, y2: 550 },
        { x1: 800, y1: 250, x2: 800, y2: 360 }, { x1: 400, y1: 550, x2: 400, y2: 440 }
    ],
    arena: () => [
        { x1: 420, y1: 300, x2: 560, y2: 300 }, { x1: 640, y1: 300, x2: 780, y2: 300 },
        { x1: 420, y1: 500, x2: 560, y2: 500 }, { x1: 640, y1: 500, x2: 780, y2: 500 },
        { x1: 420, y1: 300, x2: 420, y2: 360 }, { x1: 420, y1: 440, x2: 420, y2: 500 },
        { x1: 780, y1: 300, x2: 780, y2: 360 }, { x1: 780, y1: 440, x2: 780, y2: 500 }
    ]
};

const TANK_PICKUPS = {
    laser: { icon: '🔦', name: 'Laser', color: '#ff3355' },
    mine: { icon: '💣', name: 'Mine', color: '#ffaa00' }
};
const TANK_LASER_BOUNCES = 2;
const TANK_MINE_ARM_TIME = 1.5;
const TANK_MINE_RADIUS = 20;

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

        // Einstellungen des Hosts
        this.layout = 'maze';           // 'maze' | 'mix' | Schlüssel aus TANK_LAYOUTS
        this.pickupsEnabled = true;
        this.pickups = [];              // { id, type, x, y }
        this.mines = [];                // { id, ownerId, x, y, arm, color }
        this.lasers = [];               // { points, life, color } – nur zur Darstellung
        this.pickupTimer = 6;
        this.nextItemId = 1;

        // Spieleabend: Statistiken + Aufholmechanik (id -> 'leader' | 'trailer')
        this.stats = {};
        this.handicaps = {};
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
                weapon: null,
                inputFwd: false,
                inputBack: false,
                inputLeft: false,
                inputRight: false,
                inputShoot: false,
                // Zwei-Stick-Steuerung (Handy): freie Fahrtrichtung + getrenntes Zielen
                twin: false,
                moveX: 0,
                moveY: 0,
                aimAngle: null
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
            p.twin = false;
        }
    }

    // Zwei Analog-Sticks: (mx, my) fährt in beliebige Richtung (Länge 0..1), aim dreht Rohr und Panzer,
    // fire schießt. Alle Werte kommen von Peers und werden hier geprüft.
    setTwinStick(id, mx, my, aim, fire) {
        const p = this.players.get(id);
        if (!p) return;
        let x = Number.isFinite(mx) ? mx : 0;
        let y = Number.isFinite(my) ? my : 0;
        const len = Math.hypot(x, y);
        if (len > 1) { x /= len; y /= len; }
        p.twin = true;
        p.moveX = x;
        p.moveY = y;
        p.aimAngle = Number.isFinite(aim) ? aim : null;
        p.inputShoot = !!fire && p.aimAngle !== null;
        p.inputFwd = p.inputBack = p.inputLeft = p.inputRight = false;
    }

    // Dreht den Panzer höchstens um maxStep in Richtung target (kürzester Weg)
    turnTowards(p, target, maxStep) {
        let diff = target - p.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        p.angle += Math.max(-maxStep, Math.min(maxStep, diff));
    }

    generateMaze() {
        this.walls = [];
        const margin = 28;

        // Outer boundaries
        this.walls.push({ x1: margin, y1: margin, x2: TANK_ARENA_W - margin, y2: margin });
        this.walls.push({ x1: TANK_ARENA_W - margin, y1: margin, x2: TANK_ARENA_W - margin, y2: TANK_ARENA_H - margin });
        this.walls.push({ x1: TANK_ARENA_W - margin, y1: TANK_ARENA_H - margin, x2: margin, y2: TANK_ARENA_H - margin });
        this.walls.push({ x1: margin, y1: TANK_ARENA_H - margin, x2: margin, y2: margin });

        // Fixed layouts (or a random pick among all of them in "mix" mode)
        let kind = this.layout;
        if (kind === 'mix') {
            const kinds = ['maze', ...Object.keys(TANK_LAYOUTS)];
            kind = kinds[Math.floor(Math.random() * kinds.length)];
        }
        if (TANK_LAYOUTS[kind]) {
            this.walls.push(...TANK_LAYOUTS[kind]());
            return;
        }

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
        this.stats = {};
        for (const p of this.players.values()) {
            p.score = 0;
        }
        this.startRound();
    }

    startRound() {
        this.generateMaze();
        this.bullets = [];
        this.particles = [];
        this.pickups = [];
        this.mines = [];
        this.lasers = [];
        this.pickupTimer = 6;
        this.roundWinner = null;
        this.status = 'PLAYING';

        // Spawn players in random free locations
        const spawns = shuffleArray([
            { x: 100, y: 100 }, { x: TANK_ARENA_W - 100, y: 100 },
            { x: 100, y: TANK_ARENA_H - 100 }, { x: TANK_ARENA_W - 100, y: TANK_ARENA_H - 100 },
            { x: TANK_ARENA_W / 2, y: 100 }, { x: TANK_ARENA_W / 2, y: TANK_ARENA_H - 100 },
            { x: 100, y: TANK_ARENA_H / 2 }, { x: TANK_ARENA_W - 100, y: TANK_ARENA_H / 2 }
        ]);

        let sIdx = 0;
        for (const p of this.players.values()) {
            const sp = spawns[sIdx % spawns.length];
            p.x = sp.x + (Math.random() - 0.5) * 40;
            p.y = sp.y + (Math.random() - 0.5) * 40;
            p.angle = Math.random() * Math.PI * 2;
            p.alive = true;
            p.cooldown = 0;
            p.weapon = null;
            // Aufholmechanik: Zurückliegende starten mit einer Spezialwaffe
            if (this.handicaps[p.id] === 'trailer') p.weapon = Math.random() < 0.5 ? 'laser' : 'mine';
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

        this.updatePickups(dt);
        this.updateMines(dt);
        for (let i = this.lasers.length - 1; i >= 0; i--) {
            this.lasers[i].life -= dt;
            if (this.lasers[i].life <= 0) this.lasers.splice(i, 1);
        }

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

            if (p.twin) {
                // Zwei-Stick-Steuerung: Zielstick bestimmt die Blickrichtung, sonst die Fahrtrichtung
                const moving = Math.hypot(p.moveX, p.moveY) > 0.05;
                if (p.aimAngle !== null) this.turnTowards(p, p.aimAngle, TANK_TURN_SPEED * 2.5 * dt);
                else if (moving) this.turnTowards(p, Math.atan2(p.moveY, p.moveX), TANK_TURN_SPEED * 2.5 * dt);
                if (moving) {
                    const dx = p.moveX * TANK_SPEED * dt;
                    const dy = p.moveY * TANK_SPEED * dt;
                    // An Wänden entlanggleiten statt hängen zu bleiben
                    if (!this.checkTankWallCollision(p.x + dx, p.y + dy)) { p.x += dx; p.y += dy; }
                    else if (!this.checkTankWallCollision(p.x + dx, p.y)) p.x += dx;
                    else if (!this.checkTankWallCollision(p.x, p.y + dy)) p.y += dy;
                }
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
            if (p.inputShoot && p.cooldown <= 0 && p.weapon) {
                // Special weapons are used up with the next trigger pull
                if (p.weapon === 'laser') this.fireLaser(p);
                else if (p.weapon === 'mine') this.layMine(p);
                p.weapon = null;
                p.cooldown = 0.45;
            } else if (p.inputShoot && p.cooldown <= 0 && myActiveBullets < 5) {
                this.shootBullet(p);
                p.cooldown = 0.45 * (this.handicaps[p.id] === 'leader' ? 1.4 : 1); // balanced fire rate
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
                    this.killTank(p, b.ownerId);
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

    // Kills a tank and credits the shooter (no point for suicide)
    killTank(victim, killerId) {
        if (!victim.alive) return;
        victim.alive = false;
        this.spawnExplosion(victim.x, victim.y, victim.color);
        if (window.soundFX) window.soundFX.playDie();
        if (killerId && killerId !== victim.id) {
            const shooter = this.players.get(killerId);
            if (shooter) shooter.score++;
            bumpStat(this, killerId, 'kills');
        } else if (killerId === victim.id) {
            bumpStat(this, victim.id, 'selfKills');
        }
    }

    updatePickups(dt) {
        if (!this.pickupsEnabled) return;
        this.pickupTimer -= dt;
        if (this.pickupTimer <= 0 && this.pickups.length < 2) {
            this.pickupTimer = 8 + Math.random() * 6;
            for (let attempt = 0; attempt < 30; attempt++) {
                const x = 80 + Math.random() * (TANK_ARENA_W - 160);
                const y = 80 + Math.random() * (TANK_ARENA_H - 160);
                if (this.checkTankWallCollision(x, y)) continue;
                // keep clear of walls so the pickup is reachable
                if (this.walls.some(w => this.checkLineCircleCollision(w.x1, w.y1, w.x2, w.y2, x, y, TANK_RADIUS * 2))) continue;
                const type = Math.random() < 0.5 ? 'laser' : 'mine';
                this.pickups.push({ id: this.nextItemId++, type, x, y });
                break;
            }
        }
        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const pu = this.pickups[i];
            for (const p of this.players.values()) {
                if (!p.alive || Math.hypot(p.x - pu.x, p.y - pu.y) > TANK_RADIUS + 14) continue;
                p.weapon = pu.type;
                this.pickups.splice(i, 1);
                if (window.soundFX) window.soundFX.playGap();
                break;
            }
        }
    }

    layMine(tank) {
        this.mines.push({
            id: this.nextItemId++, ownerId: tank.id, x: tank.x, y: tank.y,
            arm: TANK_MINE_ARM_TIME, color: tank.color
        });
        if (window.soundFX) window.soundFX.playClick();
    }

    updateMines(dt) {
        for (let i = this.mines.length - 1; i >= 0; i--) {
            const m = this.mines[i];
            m.arm = Math.max(0, m.arm - dt);
            if (m.arm > 0) continue;
            for (const p of this.players.values()) {
                if (!p.alive || Math.hypot(p.x - m.x, p.y - m.y) > TANK_RADIUS + TANK_MINE_RADIUS * 0.5) continue;
                this.spawnExplosion(m.x, m.y, '#ffaa00');
                this.killTank(p, m.ownerId);
                this.mines.splice(i, 1);
                break;
            }
        }
    }

    // Distance along the ray (ox,oy)+t*(dx,dy) to the nearest wall; returns { t, wall } or null
    rayCastWall(ox, oy, dx, dy) {
        let best = null;
        for (const w of this.walls) {
            const sx = w.x2 - w.x1;
            const sy = w.y2 - w.y1;
            const denom = dx * sy - dy * sx;
            if (Math.abs(denom) < 1e-9) continue;
            const t = ((w.x1 - ox) * sy - (w.y1 - oy) * sx) / denom;
            const u = ((w.x1 - ox) * dy - (w.y1 - oy) * dx) / denom;
            if (t > 0.001 && u >= 0 && u <= 1 && (!best || t < best.t)) best = { t, wall: w };
        }
        return best;
    }

    // Instant laser: travels (and bounces) through walls and kills every tank on its path
    fireLaser(tank) {
        let ox = tank.x + Math.cos(tank.angle) * (TANK_RADIUS + 4);
        let oy = tank.y + Math.sin(tank.angle) * (TANK_RADIUS + 4);
        let dx = Math.cos(tank.angle);
        let dy = Math.sin(tank.angle);
        const points = [[tank.x, tank.y]];

        for (let seg = 0; seg <= TANK_LASER_BOUNCES; seg++) {
            const hit = this.rayCastWall(ox, oy, dx, dy);
            const len = hit ? hit.t : 1600;
            const ex = ox + dx * len;
            const ey = oy + dy * len;

            for (const p of this.players.values()) {
                if (!p.alive || p.id === tank.id) continue;
                if (this.checkLineCircleCollision(ox, oy, ex, ey, p.x, p.y, TANK_RADIUS)) {
                    this.killTank(p, tank.id);
                }
            }
            points.push([ex, ey]);
            if (!hit) break;

            // reflect off the wall
            const wx = hit.wall.x2 - hit.wall.x1;
            const wy = hit.wall.y2 - hit.wall.y1;
            const wl = Math.hypot(wx, wy);
            const nx = -wy / wl;
            const ny = wx / wl;
            const dot = dx * nx + dy * ny;
            dx -= 2 * dot * nx;
            dy -= 2 * dot * ny;
            ox = ex + dx * 2;
            oy = ey + dy * 2;
        }
        this.lasers.push({ points, life: 0.35, color: tank.color });
        if (window.soundFX) window.soundFX.playGap();
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
        bot.avoidTimer = Math.max(0, (bot.avoidTimer || 0) - dt);

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

        // Whisker raycasts for smooth maze navigation without wall jitter
        const feelerDist = 52;
        const centerAheadX = bot.x + Math.cos(bot.angle) * feelerDist;
        const centerAheadY = bot.y + Math.sin(bot.angle) * feelerDist;
        const centerHit = !this.hasLineOfSight(bot.x, bot.y, centerAheadX, centerAheadY) || this.checkTankWallCollision(centerAheadX, centerAheadY);

        if (centerHit && bot.avoidTimer <= 0) {
            // Wall directly ahead! Check left and right feelers to pick open corridor
            const leftFeelerX = bot.x + Math.cos(bot.angle - 0.75) * feelerDist;
            const leftFeelerY = bot.y + Math.sin(bot.angle - 0.75) * feelerDist;
            const rightFeelerX = bot.x + Math.cos(bot.angle + 0.75) * feelerDist;
            const rightFeelerY = bot.y + Math.sin(bot.angle + 0.75) * feelerDist;

            const leftHit = !this.hasLineOfSight(bot.x, bot.y, leftFeelerX, leftFeelerY) || this.checkTankWallCollision(leftFeelerX, leftFeelerY);
            const rightHit = !this.hasLineOfSight(bot.x, bot.y, rightFeelerX, rightFeelerY) || this.checkTankWallCollision(rightFeelerX, rightFeelerY);

            if (!leftHit && rightHit) {
                bot.avoidDir = -1; // Turn left
            } else if (leftHit && !rightHit) {
                bot.avoidDir = 1;  // Turn right
            } else {
                bot.avoidDir = Math.random() < 0.5 ? -1 : 1;
            }
            bot.avoidTimer = 0.8 + Math.random() * 0.4; // Commit to navigating around corner
        }

        if (bot.avoidTimer > 0) {
            // Maneuver smoothly around corner into open space
            bot.inputFwd = true;
            bot.inputBack = false;
            bot.inputLeft = bot.avoidDir < 0;
            bot.inputRight = bot.avoidDir > 0;
            bot.inputShoot = false;
            return;
        }

        // Detour to a visible weapon pickup when unarmed
        if (!bot.weapon && this.pickups.length > 0) {
            let nearest = null;
            let nearestDist = 380;
            for (const pu of this.pickups) {
                const d = Math.hypot(pu.x - bot.x, pu.y - bot.y);
                if (d < nearestDist && this.hasLineOfSight(bot.x, bot.y, pu.x, pu.y)) {
                    nearestDist = d;
                    nearest = pu;
                }
            }
            if (nearest) {
                let diff = Math.atan2(nearest.y - bot.y, nearest.x - bot.x) - bot.angle;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                bot.inputLeft = diff < -0.15;
                bot.inputRight = diff > 0.15;
                bot.inputFwd = Math.abs(diff) < 0.9;
                bot.inputBack = false;
                bot.inputShoot = false;
                return;
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
            bot.inputFwd = Math.abs(angleDiff) < 0.8 && (minDist > 140 || !hasSight);
            bot.inputBack = false;

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
            bot.inputBack = false;
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
                angle: Math.round(p.angle * 100) / 100,
                weapon: p.weapon
            })),
            pickups: this.pickups.map(pu => ({ id: pu.id, type: pu.type, x: Math.round(pu.x), y: Math.round(pu.y) })),
            mines: this.mines.map(m => ({ id: m.id, x: Math.round(m.x), y: Math.round(m.y), armed: m.arm <= 0, color: m.color })),
            lasers: this.lasers.map(l => ({ points: l.points.map(pt => [Math.round(pt[0]), Math.round(pt[1])]), life: Math.round(l.life * 100) / 100, color: l.color })),
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
        this.pickups = snap.pickups || [];
        this.mines = snap.mines || [];
        this.lasers = snap.lasers || [];

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
            p.weapon = t.weapon || null;
        }
    }
}

window.TankGame = TankGame;
window.TANK_ARENA_W = TANK_ARENA_W;
window.TANK_ARENA_H = TANK_ARENA_H;
