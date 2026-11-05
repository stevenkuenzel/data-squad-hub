/**
 * DataSquad Hub: Corporate Dodgeball (Data Squad vs. ComM)
 * 2D Action-Arena / Büro-Völkerball
 * 
 * Data Squad (Links) vs. ComM (Rechts)
 * Mit Steinen im Weg, Code-Releases, Aktenordnern, Agentur-Rechnungen & Kaffeepausen.
 */

const DB_ARENA_W = 1200;
const DB_ARENA_H = 800;
const DB_CENTER_X = 600;
const DB_PLAYER_RADIUS = 22;
const DB_BALL_RADIUS = 12;
const DB_PLAYER_SPEED = 240;
const DB_DASH_SPEED = 560;

const DB_BALL_TYPES = [
    { type: 'release', name: 'Code-Release', icon: '📦', color: '#00f3ff', speed: 520, damage: 1, desc: 'Pfeilschnelles Release' },
    { type: 'dashboard', name: 'Live-Dashboard', icon: '📊', color: '#39ff14', speed: 460, damage: 1, bounces: 2, desc: 'Prallt von Wänden ab' },
    { type: 'coffee', name: 'Kaffee-Becher', icon: '☕', color: '#ffaa00', speed: 490, damage: 1, desc: 'Vollgepackt mit Koffein' },
    { type: 'stone', name: 'Stein im Weg', icon: '🪨', color: '#ff0055', speed: 420, damage: 1, leavesRock: true, desc: 'Hinterlässt bürokratischen Felsen' },
    { type: 'folder', name: 'Aktenordner', icon: '📁', color: '#ff00aa', speed: 440, damage: 1, boomerang: true, desc: 'Feedback-Schleife' },
    { type: 'bill', name: 'Agentur-Rechnung', icon: '💸', color: '#ffff00', speed: 470, damage: 1, desc: 'Teuer & schmerzhaft' }
];

const DB_QUOTES = [
    '„Dafür haben wir leider kein Budget!“',
    '„Wir beauftragen lieber eine externe Agentur.“',
    '„Das Corporate Design von 2018 erlaubt das nicht.“',
    '„Haben wir dafür ein Ticket im System?“',
    '„Ich bin dafür nicht zuständig.“',
    '„Lass uns dazu erstmal einen 4-Stunden-Workshop machen.“',
    '„Gute Lösung, aber hier ist ein neues Problem!“',
    '„Das Logo muss 2 Millimeter weiter nach rechts.“',
    '„Out of Office: Bin bis nächste Woche im Alignment.“'
];

class DodgeballGame {
    constructor() {
        this.players = new Map(); // id -> Player
        this.balls = [];          // Projectiles & floor balls
        this.rocks = [];          // Temporary obstacle rocks on the floor
        this.particles = [];
        this.status = 'LOBBY';    // LOBBY, COUNTDOWN, PLAYING, ROUND_OVER, MATCH_OVER
        this.round = 1;
        this.maxRounds = 3;
        this.scoreSquad = 0;
        this.scoreComM = 0;
        this.countdownTimer = 0;
        this.roundOverTimer = 0;
        this.winner = null;
        this.banner = null;       // { text, color, timer }
        this.ballSpawnTimer = 2.0;
        this.nextBallId = 1;
    }

    addPlayer(id, name, color, isBot = false, preferredTeam = null) {
        if (this.players.has(id)) return this.players.get(id);

        // Auto-balance teams: Squad (Left) vs ComM (Right)
        let team = preferredTeam;
        if (!team) {
            let squadCount = 0;
            let commCount = 0;
            for (const p of this.players.values()) {
                if (p.team === 'squad') squadCount++;
                else commCount++;
            }
            team = squadCount <= commCount ? 'squad' : 'comm';
        }

        const isSquad = team === 'squad';
        const defaultColor = isSquad ? '#00f3ff' : '#ff0055';

        const p = {
            id,
            name: String(name || (isSquad ? 'Dev' : 'ComM-Berater')).slice(0, 16),
            team,
            color: color || defaultColor,
            isBot,
            x: isSquad ? 220 + Math.random() * 200 : 780 + Math.random() * 200,
            y: 200 + Math.random() * 400,
            vx: 0,
            vy: 0,
            angle: isSquad ? 0 : Math.PI,
            hp: 3,
            maxHp: 3,
            alive: true,
            hasBall: null,       // Currently held ball template
            dashCooldown: 0,
            dashTimer: 0,
            shieldTimer: 0,
            inputFwd: false,
            inputBack: false,
            inputLeft: false,
            inputRight: false,
            inputThrow: false,
            inputDash: false,
            aimAngle: isSquad ? 0 : Math.PI,
            botCooldown: 0.5 + Math.random() * 0.5
        };

        this.players.set(id, p);
        return p;
    }

    removePlayer(id) {
        this.players.delete(id);
    }

    startMatch(maxRounds = 3) {
        this.maxRounds = maxRounds;
        this.round = 1;
        this.scoreSquad = 0;
        this.scoreComM = 0;
        this.winner = null;
        this.startRound();
    }

    startRound() {
        this.status = 'COUNTDOWN';
        this.countdownTimer = 3.0;
        this.balls = [];
        this.rocks = [];
        this.particles = [];
        this.banner = {
            text: '🔔 RUNDE ' + this.round + ': DATA SQUAD VS. COMM!',
            color: '#00f3ff',
            timer: 2.8
        };

        // Reset positions
        let sIdx = 0;
        let cIdx = 0;
        for (const p of this.players.values()) {
            p.alive = true;
            p.hp = p.maxHp;
            p.hasBall = null;
            p.dashCooldown = 0;
            p.dashTimer = 0;
            p.shieldTimer = 0;
            p.vx = 0;
            p.vy = 0;

            if (p.team === 'squad') {
                p.x = 180;
                p.y = 180 + (sIdx++ * 130) % 500;
                p.angle = 0;
                p.aimAngle = 0;
            } else {
                p.x = DB_ARENA_W - 180;
                p.y = 180 + (cIdx++ * 130) % 500;
                p.angle = Math.PI;
                p.aimAngle = Math.PI;
            }
        }

        // Spawn initial balls along center dividing line (Rush for the balls!)
        const initialCount = Math.max(3, Math.min(6, this.players.size));
        const spacing = (DB_ARENA_H - 200) / (initialCount + 1);
        for (let i = 1; i <= initialCount; i++) {
            const template = DB_BALL_TYPES[i % DB_BALL_TYPES.length];
            this.balls.push({
                id: this.nextBallId++,
                type: template.type,
                name: template.name,
                icon: template.icon,
                color: template.color,
                x: DB_CENTER_X + (i % 2 === 0 ? -12 : 12),
                y: 100 + i * spacing,
                vx: 0,
                vy: 0,
                state: 'FLOOR', // 'FLOOR', 'FLYING'
                thrownBy: null,
                thrownTeam: null,
                bouncesLeft: template.bounces || 0,
                leavesRock: !!template.leavesRock,
                boomerang: !!template.boomerang,
                curveAngle: 0
            });
        }
        this.ballSpawnTimer = 4.0;
    }

    setInput(playerId, up, down, left, right, throwBall, dash, aimAngle) {
        const p = this.players.get(playerId);
        if (!p || !p.alive) return;
        p.inputFwd = !!up;
        p.inputBack = !!down;
        p.inputLeft = !!left;
        p.inputRight = !!right;
        p.inputThrow = !!throwBall;
        p.inputDash = !!dash;
        if (typeof aimAngle === 'number') {
            p.aimAngle = aimAngle;
        }
    }

    update(dt) {
        if (this.banner) {
            this.banner.timer -= dt;
            if (this.banner.timer <= 0) this.banner = null;
        }

        if (this.status === 'COUNTDOWN') {
            this.countdownTimer -= dt;
            if (this.countdownTimer <= 0) {
                this.status = 'PLAYING';
                if (window.soundFX) window.soundFX.playCountdown(true);
            }
            this.updateParticles(dt);
            return;
        }

        if (this.status === 'ROUND_OVER') {
            this.roundOverTimer -= dt;
            this.updateParticles(dt);
            if (this.roundOverTimer <= 0) {
                if (this.scoreSquad >= Math.ceil(this.maxRounds / 2) || this.scoreComM >= Math.ceil(this.maxRounds / 2)) {
                    this.status = 'MATCH_OVER';
                    this.winner = this.scoreSquad > this.scoreComM ? 'Data Squad' : 'ComM (Kommunikation)';
                    if (window.soundFX) window.soundFX.playWin();
                } else {
                    this.round++;
                    this.startRound();
                }
            }
            return;
        }

        if (this.status !== 'PLAYING') {
            this.updateParticles(dt);
            return;
        }

        // 1. Spawning new office balls if count is low
        this.ballSpawnTimer -= dt;
        if (this.ballSpawnTimer <= 0 && this.balls.length < 8) {
            this.ballSpawnTimer = 3.5 + Math.random() * 2.5;
            this.spawnCenterBall();
        }

        // 2. Update Rocks expiration
        for (let i = this.rocks.length - 1; i >= 0; i--) {
            this.rocks[i].life -= dt;
            if (this.rocks[i].life <= 0) {
                this.rocks.splice(i, 1);
            }
        }

        // 3. Update Bots
        for (const p of this.players.values()) {
            if (p.isBot && p.alive) {
                this.updateBot(p, dt);
            }
        }

        // 4. Update Players Movement & Actions
        for (const p of this.players.values()) {
            if (!p.alive) continue;

            p.dashCooldown = Math.max(0, p.dashCooldown - dt);
            p.dashTimer = Math.max(0, p.dashTimer - dt);
            p.shieldTimer = Math.max(0, p.shieldTimer - dt);

            // Dash activation
            if (p.inputDash && p.dashCooldown <= 0 && p.dashTimer <= 0) {
                p.dashTimer = 0.28;
                p.dashCooldown = 1.4;
                if (window.soundFX) window.soundFX.playGap();
                // Dash particle trail
                this.spawnDashTrail(p);
            }

            const isDashing = p.dashTimer > 0;
            const currentSpeed = isDashing ? DB_DASH_SPEED : DB_PLAYER_SPEED;

            // Directional movement
            let mx = 0;
            let my = 0;
            if (p.inputLeft) mx -= 1;
            if (p.inputRight) mx += 1;
            if (p.inputFwd) my -= 1;
            if (p.inputBack) my += 1;

            if (mx !== 0 && my !== 0) {
                const len = Math.hypot(mx, my);
                mx /= len;
                my /= len;
            }

            p.vx = mx * currentSpeed;
            p.vy = my * currentSpeed;

            p.x += p.vx * dt;
            p.y += p.vy * dt;

            // Half-Court Boundary Enforcement (Data Squad on Left, ComM on Right)
            const minX = p.team === 'squad' ? 36 + DB_PLAYER_RADIUS : DB_CENTER_X + 16 + DB_PLAYER_RADIUS;
            const maxX = p.team === 'squad' ? DB_CENTER_X - 16 - DB_PLAYER_RADIUS : DB_ARENA_W - 36 - DB_PLAYER_RADIUS;
            const minY = 36 + DB_PLAYER_RADIUS;
            const maxY = DB_ARENA_H - 36 - DB_PLAYER_RADIUS;

            p.x = Math.max(minX, Math.min(maxX, p.x));
            p.y = Math.max(minY, Math.min(maxY, p.y));

            // Collision with Rock Obstacles
            for (const r of this.rocks) {
                const d = Math.hypot(p.x - r.x, p.y - r.y);
                const minDist = DB_PLAYER_RADIUS + r.radius;
                if (d < minDist && d > 0) {
                    const push = (minDist - d);
                    p.x += ((p.x - r.x) / d) * push;
                    p.y += ((p.y - r.y) / d) * push;
                }
            }

            // Pickup Balls on Floor
            if (!p.hasBall) {
                for (let i = this.balls.length - 1; i >= 0; i--) {
                    const b = this.balls[i];
                    if (b.state === 'FLOOR') {
                        const d = Math.hypot(p.x - b.x, p.y - b.y);
                        if (d <= DB_PLAYER_RADIUS + DB_BALL_RADIUS + 6) {
                            // Picked up!
                            p.hasBall = {
                                type: b.type,
                                name: b.name,
                                icon: b.icon,
                                color: b.color,
                                leavesRock: b.leavesRock,
                                bounces: b.bouncesLeft,
                                boomerang: b.boomerang
                            };
                            this.balls.splice(i, 1);
                            if (window.soundFX) window.soundFX.playClick();
                            break;
                        }
                    }
                }
            }

            // Throw Ball
            if (p.inputThrow && p.hasBall) {
                const b = p.hasBall;
                p.hasBall = null;
                p.inputThrow = false;

                const throwAngle = typeof p.aimAngle === 'number' ? p.aimAngle : (p.team === 'squad' ? 0 : Math.PI);
                const speed = b.type === 'release' ? 560 : 480;

                this.balls.push({
                    id: this.nextBallId++,
                    type: b.type,
                    name: b.name,
                    icon: b.icon,
                    color: b.color,
                    x: p.x + Math.cos(throwAngle) * (DB_PLAYER_RADIUS + 14),
                    y: p.y + Math.sin(throwAngle) * (DB_PLAYER_RADIUS + 14),
                    vx: Math.cos(throwAngle) * speed,
                    vy: Math.sin(throwAngle) * speed,
                    state: 'FLYING',
                    thrownBy: p.id,
                    thrownTeam: p.team,
                    bouncesLeft: b.bounces || 0,
                    leavesRock: b.leavesRock,
                    boomerang: b.boomerang,
                    curveAngle: throwAngle
                });

                if (window.soundFX) window.soundFX.playClick();

                // Random corporate banter on throws
                if (Math.random() < 0.28) {
                    const quote = DB_QUOTES[Math.floor(Math.random() * DB_QUOTES.length)];
                    this.banner = { text: `${p.name}: ${quote}`, color: p.color, timer: 2.2 };
                }
            }
        }

        // 5. Update Flying Balls Physics & Hits
        for (let i = this.balls.length - 1; i >= 0; i--) {
            const b = this.balls[i];
            if (b.state !== 'FLYING') continue;

            // Boomerang arc for Aktenordner
            if (b.boomerang) {
                b.curveAngle += dt * 3.5;
                const spd = Math.hypot(b.vx, b.vy);
                b.vx = Math.cos(b.curveAngle) * spd;
                b.vy = Math.sin(b.curveAngle) * spd;
            }

            b.x += b.vx * dt;
            b.y += b.vy * dt;

            // Bounce off top/bottom walls
            if (b.y - DB_BALL_RADIUS <= 30 || b.y + DB_BALL_RADIUS >= DB_ARENA_H - 30) {
                b.vy = -b.vy;
                b.y = Math.max(32 + DB_BALL_RADIUS, Math.min(DB_ARENA_H - 32 - DB_BALL_RADIUS, b.y));
                if (b.bouncesLeft > 0) {
                    b.bouncesLeft--;
                } else {
                    this.dropBallToFloor(b);
                    continue;
                }
            }

            // Bounce off end walls
            if (b.x - DB_BALL_RADIUS <= 30 || b.x + DB_BALL_RADIUS >= DB_ARENA_W - 30) {
                if (b.bouncesLeft > 0) {
                    b.vx = -b.vx;
                    b.bouncesLeft--;
                } else {
                    this.dropBallToFloor(b);
                    continue;
                }
            }

            // Hit test against enemy players
            for (const enemy of this.players.values()) {
                if (!enemy.alive || enemy.team === b.thrownTeam) continue;

                const dist = Math.hypot(enemy.x - b.x, enemy.y - b.y);
                if (dist <= DB_PLAYER_RADIUS + DB_BALL_RADIUS) {
                    // Check if dashing: CATCH THE BALL!
                    if (enemy.dashTimer > 0 && !enemy.hasBall) {
                        enemy.hasBall = {
                            type: b.type,
                            name: b.name,
                            icon: b.icon,
                            color: b.color,
                            leavesRock: b.leavesRock,
                            bounces: b.bouncesLeft,
                            boomerang: b.boomerang
                        };
                        this.balls.splice(i, 1);
                        this.banner = {
                            text: `🎯 GEFANGEN! ${enemy.name} fängt ${b.name} aus der Luft!`,
                            color: enemy.color,
                            timer: 2.2
                        };
                        if (window.soundFX) window.soundFX.playWin();
                        break;
                    }

                    // Direct Hit!
                    enemy.hp -= 1;
                    this.spawnHitExplosion(b.x, b.y, b.color);

                    // If Stein: drop a rock obstacle where it hit
                    if (b.leavesRock) {
                        this.rocks.push({
                            id: Math.random(),
                            x: b.x,
                            y: b.y,
                            radius: 20,
                            life: 7.0
                        });
                        this.banner = { text: '🪨 STEIN IM WEG! Bürokratisches Hindernis platziert!', color: '#ff0055', timer: 2.0 };
                    }

                    if (window.soundFX) window.soundFX.playDie();

                    if (enemy.hp <= 0) {
                        enemy.alive = false;
                        this.banner = {
                            text: `💥 ${enemy.name} scheidet aus! (${enemy.team === 'squad' ? 'Data Squad' : 'ComM'})`,
                            color: '#ff0055',
                            timer: 2.5
                        };
                    }

                    this.balls.splice(i, 1);
                    break;
                }
            }
        }

        this.updateParticles(dt);

        // 6. Check Round Win Condition (One team fully eliminated)
        let squadAlive = 0;
        let commAlive = 0;
        for (const p of this.players.values()) {
            if (p.alive) {
                if (p.team === 'squad') squadAlive++;
                else commAlive++;
            }
        }

        if (squadAlive === 0 || commAlive === 0) {
            this.status = 'ROUND_OVER';
            this.roundOverTimer = 2.6;
            if (squadAlive > 0) {
                this.scoreSquad++;
                this.banner = { text: '🎉 DATA SQUAD GEWINNT DIE RUNDE! 🎉', color: '#00f3ff', timer: 2.5 };
                if (window.soundFX) window.soundFX.playWin();
            } else if (commAlive > 0) {
                this.scoreComM++;
                this.banner = { text: '📄 COMM GEWINNT DIE RUNDE! (Wegen Formfehler)', color: '#ff0055', timer: 2.5 };
                if (window.soundFX) window.soundFX.playDie();
            } else {
                this.banner = { text: '🤝 UNENTSCHIEDEN! Beide Teams im Meeting!', color: '#ffff00', timer: 2.5 };
            }
        }
    }

    dropBallToFloor(b) {
        b.state = 'FLOOR';
        b.vx = 0;
        b.vy = 0;
        b.thrownBy = null;
        b.thrownTeam = null;
    }

    spawnCenterBall() {
        const template = DB_BALL_TYPES[Math.floor(Math.random() * DB_BALL_TYPES.length)];
        this.balls.push({
            id: this.nextBallId++,
            type: template.type,
            name: template.name,
            icon: template.icon,
            color: template.color,
            x: DB_CENTER_X + (Math.random() - 0.5) * 80,
            y: 80 + Math.random() * (DB_ARENA_H - 160),
            vx: 0,
            vy: 0,
            state: 'FLOOR',
            thrownBy: null,
            thrownTeam: null,
            bouncesLeft: template.bounces || 0,
            leavesRock: !!template.leavesRock,
            boomerang: !!template.boomerang,
            curveAngle: 0
        });
    }

    updateBot(bot, dt) {
        bot.botCooldown -= dt;

        // 1. Check for incoming enemy balls to dodge
        let threat = null;
        let minThreatDist = Infinity;
        for (const b of this.balls) {
            if (b.state === 'FLYING' && b.thrownTeam !== bot.team) {
                const dist = Math.hypot(bot.x - b.x, bot.y - b.y);
                if (dist < 260 && dist < minThreatDist) {
                    minThreatDist = dist;
                    threat = b;
                }
            }
        }

        if (threat) {
            // Dodge perpendicular to incoming ball velocity
            const dodgeDir = Math.atan2(threat.vy, threat.vx) + (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
            bot.inputLeft = Math.cos(dodgeDir) < -0.3;
            bot.inputRight = Math.cos(dodgeDir) > 0.3;
            bot.inputFwd = Math.sin(dodgeDir) < -0.3;
            bot.inputBack = Math.sin(dodgeDir) > 0.3;

            // Occasional reflex dash
            if (minThreatDist < 120 && Math.random() < 0.65) {
                bot.inputDash = true;
            }
            return;
        }

        bot.inputDash = false;

        // 2. If bot does not have a ball, seek closest reachable ball
        if (!bot.hasBall) {
            let closestBall = null;
            let minDist = Infinity;
            for (const b of this.balls) {
                if (b.state === 'FLOOR') {
                    // Check if ball is on bot's half or accessible near center
                    const onMyHalf = bot.team === 'squad' ? b.x <= DB_CENTER_X + 20 : b.x >= DB_CENTER_X - 20;
                    if (onMyHalf) {
                        const dist = Math.hypot(bot.x - b.x, bot.y - b.y);
                        if (dist < minDist) {
                            minDist = dist;
                            closestBall = b;
                        }
                    }
                }
            }

            if (closestBall) {
                const angleToBall = Math.atan2(closestBall.y - bot.y, closestBall.x - bot.x);
                bot.inputLeft = Math.cos(angleToBall) < -0.2;
                bot.inputRight = Math.cos(angleToBall) > 0.2;
                bot.inputFwd = Math.sin(angleToBall) < -0.2;
                bot.inputBack = Math.sin(angleToBall) > 0.2;
                return;
            }
        }

        // 3. Bot has ball: find closest alive enemy and aim
        if (bot.hasBall) {
            let target = null;
            let minDist = Infinity;
            for (const other of this.players.values()) {
                if (other.alive && other.team !== bot.team) {
                    const d = Math.hypot(other.x - bot.x, other.y - bot.y);
                    if (d < minDist) {
                        minDist = d;
                        target = other;
                    }
                }
            }

            if (target) {
                // Lead target slightly
                const leadX = target.x + target.vx * 0.2;
                const leadY = target.y + target.vy * 0.2;
                bot.aimAngle = Math.atan2(leadY - bot.y, leadX - bot.x);

                // Move closer to center line to throw
                const targetX = bot.team === 'squad' ? DB_CENTER_X - 60 : DB_CENTER_X + 60;
                bot.inputLeft = targetX < bot.x - 20;
                bot.inputRight = targetX > bot.x + 20;
                bot.inputFwd = bot.y > target.y + 40;
                bot.inputBack = bot.y < target.y - 40;

                if (bot.botCooldown <= 0) {
                    bot.inputThrow = true;
                    bot.botCooldown = 1.0 + Math.random() * 0.8;
                }
                return;
            }
        }

        // Default wander
        bot.inputLeft = false;
        bot.inputRight = false;
        bot.inputFwd = false;
        bot.inputBack = false;
    }

    spawnDashTrail(player) {
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x: player.x + (Math.random() - 0.5) * 20,
                y: player.y + (Math.random() - 0.5) * 20,
                vx: -player.vx * 0.2,
                vy: -player.vy * 0.2,
                color: player.color,
                radius: 4 + Math.random() * 3,
                life: 0.4,
                maxLife: 0.4
            });
        }
    }

    spawnHitExplosion(x, y, color) {
        for (let i = 0; i < 28; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = 60 + Math.random() * 220;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd,
                color,
                radius: 3 + Math.random() * 4,
                life: 0.6,
                maxLife: 0.6
            });
        }
    }

    updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 0.92;
            p.vy *= 0.92;
            p.life -= dt;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    getSnapshot() {
        const playersList = [];
        for (const p of this.players.values()) {
            playersList.push({
                id: p.id,
                name: p.name,
                team: p.team,
                color: p.color,
                isBot: p.isBot,
                x: Math.round(p.x * 10) / 10,
                y: Math.round(p.y * 10) / 10,
                hp: p.hp,
                maxHp: p.maxHp,
                alive: p.alive,
                aimAngle: Math.round((p.aimAngle || 0) * 100) / 100,
                hasBallIcon: p.hasBall ? p.hasBall.icon : null,
                isDashing: p.dashTimer > 0
            });
        }

        const ballsList = this.balls.map(b => ({
            id: b.id,
            icon: b.icon,
            color: b.color,
            x: Math.round(b.x),
            y: Math.round(b.y),
            state: b.state
        }));

        const rocksList = this.rocks.map(r => ({
            id: r.id,
            x: Math.round(r.x),
            y: Math.round(r.y),
            radius: r.radius
        }));

        return {
            status: this.status,
            round: this.round,
            maxRounds: this.maxRounds,
            scoreSquad: this.scoreSquad,
            scoreComM: this.scoreComM,
            countdown: Math.ceil(this.countdownTimer),
            winner: this.winner,
            banner: this.banner ? {
                text: this.banner.text,
                color: this.banner.color,
                timer: Math.round(this.banner.timer * 10) / 10
            } : null,
            players: playersList,
            balls: ballsList,
            rocks: rocksList
        };
    }

    applySnapshot(snap) {
        this.status = snap.status;
        this.round = snap.round;
        this.maxRounds = snap.maxRounds;
        this.scoreSquad = snap.scoreSquad;
        this.scoreComM = snap.scoreComM;
        this.countdownTimer = snap.countdown;
        this.winner = snap.winner;
        this.banner = snap.banner;

        if (snap.balls) {
            this.balls = snap.balls;
        }

        if (snap.rocks) {
            this.rocks = snap.rocks;
        }

        if (snap.players) {
            for (const sp of snap.players) {
                let p = this.players.get(sp.id);
                if (!p) {
                    p = this.addPlayer(sp.id, sp.name, sp.color, sp.isBot, sp.team);
                }
                p.x = sp.x;
                p.y = sp.y;
                p.hp = sp.hp;
                p.maxHp = sp.maxHp;
                p.alive = sp.alive;
                p.team = sp.team;
                p.aimAngle = sp.aimAngle;
                p.hasBall = sp.hasBallIcon ? { icon: sp.hasBallIcon } : null;
                p.dashTimer = sp.isDashing ? 0.2 : 0;
            }
        }
    }
}

window.DodgeballGame = DodgeballGame;
window.DB_ARENA_W = DB_ARENA_W;
window.DB_ARENA_H = DB_ARENA_H;
window.DB_CENTER_X = DB_CENTER_X;
