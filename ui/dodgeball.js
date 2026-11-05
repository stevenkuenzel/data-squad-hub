/**
 * DataSquad Hub UI: Dodgeball UI
 * Klassisches Script – teilt den globalen Scope mit den übrigen ui/*.js (Ladereihenfolge siehe index.html).
 */

// ==========================================
// GAME 7: CORPORATE DODGEBALL (Data Squad vs. ComN)
// ==========================================
const dbCanvas = document.getElementById('dodgeballCanvas');
const dbCtx = dbCanvas ? dbCanvas.getContext('2d') : null;
let dbMouseX = DB_CENTER_X;
let dbMouseY = DB_ARENA_H / 2;
let dbAimAngle = 0;
let dbMouseThrow = false;

if (dbCanvas) {
    dbCanvas.addEventListener('mousemove', (e) => {
        const rect = dbCanvas.getBoundingClientRect();
        dbMouseX = (e.clientX - rect.left) * (DB_ARENA_W / rect.width);
        dbMouseY = (e.clientY - rect.top) * (DB_ARENA_H / rect.height);
        const me = dodgeballGame.players.get(myPlayerId);
        if (me) {
            dbAimAngle = Math.atan2(dbMouseY - me.y, dbMouseX - me.x);
        }
    });

    dbCanvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) dbMouseThrow = true;
        if (e.button === 2) {
            // Right click = Dash / Fangen!
            e.preventDefault();
            keys.ShiftLeft = true;
            setTimeout(() => { keys.ShiftLeft = false; }, 320);
        }
    });

    dbCanvas.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('mouseup', (e) => {
        if (e.button === 0) dbMouseThrow = false;
        if (e.button === 2) keys.ShiftLeft = false;
    });
}

const btnPlayAgainDb = document.querySelector('.btn-play-again-db');
if (btnPlayAgainDb) {
    btnPlayAgainDb.addEventListener('click', () => {
        const overlay = document.getElementById('db-winner-overlay');
        if (overlay) overlay.style.display = 'none';
        if (networkManager.isHost) {
            dodgeballGame.startMatch(3);
        }
    });
}

// Touch controls for Dodgeball
bindTouch('db-touch-up', 'KeyW');
bindTouch('db-touch-down', 'KeyS');
bindTouch('db-touch-left', 'KeyA');
bindTouch('db-touch-right', 'KeyD');
bindTouch('db-touch-throw', 'Space');
bindTouch('db-touch-dash', 'ShiftLeft');

function renderDodgeball() {
    if (!dbCtx) return;

    // Background
    dbCtx.fillStyle = '#060814';
    dbCtx.fillRect(0, 0, DB_ARENA_W, DB_ARENA_H);

    // Team floor highlights
    // Data Squad half (Left)
    dbCtx.fillStyle = 'rgba(0, 243, 255, 0.04)';
    dbCtx.fillRect(30, 30, DB_CENTER_X - 30, DB_ARENA_H - 60);

    // ComN half (Right)
    dbCtx.fillStyle = 'rgba(255, 0, 85, 0.04)';
    dbCtx.fillRect(DB_CENTER_X, 30, DB_CENTER_X - 30, DB_ARENA_H - 60);

    // Big Court Lettering
    dbCtx.save();
    dbCtx.font = '900 46px sans-serif';
    dbCtx.textAlign = 'center';
    dbCtx.textBaseline = 'middle';
    dbCtx.fillStyle = 'rgba(0, 243, 255, 0.06)';
    dbCtx.fillText('DATA SQUAD', 315, DB_ARENA_H / 2);

    dbCtx.fillStyle = 'rgba(255, 0, 85, 0.06)';
    dbCtx.fillText('COMN', 885, DB_ARENA_H / 2);
    dbCtx.restore();

    // Outer Arena Border
    dbCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    dbCtx.lineWidth = 3;
    dbCtx.strokeRect(30, 30, DB_ARENA_W - 60, DB_ARENA_H - 60);

    // Center Dividing Line (The Office Wall / Demarcation)
    dbCtx.save();
    dbCtx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
    dbCtx.lineWidth = 4;
    dbCtx.setLineDash([16, 12]);
    dbCtx.beginPath();
    dbCtx.moveTo(DB_CENTER_X, 30);
    dbCtx.lineTo(DB_CENTER_X, DB_ARENA_H - 30);
    dbCtx.stroke();
    dbCtx.restore();

    // Draw Obstacle Rocks (Steine im Weg)
    for (const r of dodgeballGame.rocks) {
        dbCtx.save();
        dbCtx.shadowColor = '#ff0055';
        dbCtx.shadowBlur = 14;
        dbCtx.fillStyle = '#374151';
        dbCtx.beginPath();
        dbCtx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        dbCtx.fill();
        dbCtx.strokeStyle = '#ff0055';
        dbCtx.lineWidth = 2.5;
        dbCtx.stroke();

        dbCtx.font = '18px sans-serif';
        dbCtx.textAlign = 'center';
        dbCtx.textBaseline = 'middle';
        dbCtx.fillText('🪨', r.x, r.y + 1);
        dbCtx.restore();
    }

    // Draw Balls on Floor
    for (const b of dodgeballGame.balls) {
        if (b.state === 'FLOOR') {
            const r = b.type === 'comn_package' ? 24 : 18;
            dbCtx.save();
            // Outer glow
            dbCtx.shadowColor = b.color || '#00f3ff';
            dbCtx.shadowBlur = 12;

            // High contrast dark backing circle
            dbCtx.fillStyle = '#0a0f1d';
            dbCtx.beginPath();
            dbCtx.arc(b.x, b.y, r, 0, Math.PI * 2);
            dbCtx.fill();

            // Bright neon border
            dbCtx.strokeStyle = b.color || '#00f3ff';
            dbCtx.lineWidth = b.type === 'comn_package' ? 3.5 : 2.5;
            dbCtx.stroke();

            // Crisp large emoji
            dbCtx.shadowBlur = 0;
            dbCtx.font = `${r + 5}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
            dbCtx.textAlign = 'center';
            dbCtx.textBaseline = 'middle';
            dbCtx.fillText(b.icon || '📦', b.x, b.y + 1);

            // Clear mini label below floor balls
            dbCtx.font = 'bold 10px sans-serif';
            dbCtx.fillStyle = b.color || '#fff';
            const labelText = b.name.replace('Das große ', '');
            dbCtx.fillText(labelText, b.x, b.y + r + 11);

            dbCtx.restore();
        }
    }

    // Draw Flying Balls (With Speed Trail & Aura)
    for (const b of dodgeballGame.balls) {
        if (b.state === 'FLYING') {
            const r = b.type === 'comn_package' ? 26 : 20;
            dbCtx.save();

            // Motion speed trail
            if (b.vx !== 0 || b.vy !== 0) {
                const angle = Math.atan2(b.vy, b.vx);
                dbCtx.strokeStyle = b.color || '#00f3ff';
                dbCtx.lineWidth = r * 0.9;
                dbCtx.lineCap = 'round';
                dbCtx.beginPath();
                dbCtx.moveTo(b.x - Math.cos(angle) * (r * 1.6), b.y - Math.sin(angle) * (r * 1.6));
                dbCtx.lineTo(b.x, b.y);
                dbCtx.stroke();
            }

            // Glowing core
            dbCtx.shadowColor = b.color || '#fff';
            dbCtx.shadowBlur = 22;
            dbCtx.fillStyle = '#0a0f1d';
            dbCtx.beginPath();
            dbCtx.arc(b.x, b.y, r, 0, Math.PI * 2);
            dbCtx.fill();

            dbCtx.strokeStyle = b.color || '#00f3ff';
            dbCtx.lineWidth = 3;
            dbCtx.stroke();

            // Crisp large emoji
            dbCtx.shadowBlur = 0;
            dbCtx.font = `${r + 7}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
            dbCtx.textAlign = 'center';
            dbCtx.textBaseline = 'middle';
            dbCtx.fillText(b.icon || '📦', b.x, b.y + 1);

            dbCtx.restore();
        }
    }

    // Draw Players
    for (const p of dodgeballGame.players.values()) {
        if (!p.alive) {
            // Ghostly elimination cross
            dbCtx.save();
            dbCtx.font = '24px sans-serif';
            dbCtx.textAlign = 'center';
            dbCtx.textBaseline = 'middle';
            dbCtx.fillText('💀', p.x, p.y);
            dbCtx.restore();
            continue;
        }

        dbCtx.save();
        const isSquad = p.team === 'squad';

        // Dashing glow
        if (p.dashTimer > 0) {
            dbCtx.shadowColor = p.color;
            dbCtx.shadowBlur = 24;
            dbCtx.globalAlpha = 0.85;
        } else {
            dbCtx.shadowColor = p.color;
            dbCtx.shadowBlur = 12;
        }

        // Player body
        dbCtx.fillStyle = isSquad ? '#0f172a' : '#1f0d18';
        dbCtx.beginPath();
        dbCtx.arc(p.x, p.y, DB_PLAYER_RADIUS, 0, Math.PI * 2);
        dbCtx.fill();

        // Team outline
        dbCtx.strokeStyle = p.color;
        dbCtx.lineWidth = 3.5;
        dbCtx.stroke();

        // Direction pointer / Aim laser
        const aim = typeof p.aimAngle === 'number' ? p.aimAngle : (isSquad ? 0 : Math.PI);
        dbCtx.strokeStyle = p.color;
        dbCtx.lineWidth = 2;
        dbCtx.beginPath();
        dbCtx.moveTo(p.x, p.y);
        dbCtx.lineTo(p.x + Math.cos(aim) * (DB_PLAYER_RADIUS + 12), p.y + Math.sin(aim) * (DB_PLAYER_RADIUS + 12));
        dbCtx.stroke();

        // Shield bubble
        if (p.shieldTimer > 0) {
            dbCtx.strokeStyle = 'rgba(0, 243, 255, 0.9)';
            dbCtx.fillStyle = 'rgba(0, 243, 255, 0.15)';
            dbCtx.lineWidth = 3;
            dbCtx.beginPath();
            dbCtx.arc(p.x, p.y, DB_PLAYER_RADIUS + 9, 0, Math.PI * 2);
            dbCtx.fill();
            dbCtx.stroke();
        }
        if (p.doubleThrow) {
            dbCtx.font = '14px "Segoe UI Emoji", sans-serif';
            dbCtx.textAlign = 'center';
            dbCtx.fillText('✌️', p.x + DB_PLAYER_RADIUS, p.y - DB_PLAYER_RADIUS);
        }

        // Held Ball Icon
        if (p.hasBall) {
            dbCtx.font = '16px "Segoe UI Emoji", sans-serif';
            dbCtx.textAlign = 'center';
            dbCtx.textBaseline = 'middle';
            dbCtx.fillText(p.hasBall.icon || '📦', p.x, p.y - DB_PLAYER_RADIUS - 12);
        }

        // Player Name & HP Pips
        dbCtx.font = 'bold 12px sans-serif';
        dbCtx.fillStyle = '#ffffff';
        dbCtx.textAlign = 'center';
        dbCtx.fillText(p.name, p.x, p.y + DB_PLAYER_RADIUS + 15);

        // HP pips
        const maxPips = p.maxHp || 3;
        const currentHp = p.hp || 0;
        const pipWidth = 8;
        const pipGap = 4;
        const totalPipW = maxPips * pipWidth + (maxPips - 1) * pipGap;
        const startPipX = p.x - totalPipW / 2;

        for (let i = 0; i < maxPips; i++) {
            dbCtx.fillStyle = i < currentHp ? (isSquad ? '#00f3ff' : '#ff0055') : '#475569';
            dbCtx.fillRect(startPipX + i * (pipWidth + pipGap), p.y + DB_PLAYER_RADIUS + 20, pipWidth, 4);
        }

        dbCtx.restore();
    }

    // Power-up pickups (pulsing)
    const puPulse = 1 + Math.sin(performance.now() / 180) * 0.12;
    for (const pu of dodgeballGame.powerups) {
        dbCtx.save();
        dbCtx.shadowColor = pu.color;
        dbCtx.shadowBlur = 18;
        dbCtx.strokeStyle = pu.color;
        dbCtx.lineWidth = 3;
        dbCtx.beginPath();
        dbCtx.arc(pu.x, pu.y, 20 * puPulse, 0, Math.PI * 2);
        dbCtx.stroke();
        dbCtx.font = '22px "Segoe UI Emoji", sans-serif';
        dbCtx.textAlign = 'center';
        dbCtx.textBaseline = 'middle';
        dbCtx.fillText(pu.icon, pu.x, pu.y + 1);
        dbCtx.restore();
    }

    // Particles
    for (const pt of dodgeballGame.particles) {
        dbCtx.save();
        dbCtx.globalAlpha = Math.max(0, pt.life);
        dbCtx.fillStyle = pt.color;
        dbCtx.beginPath();
        dbCtx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
        dbCtx.fill();
        dbCtx.restore();
    }

    // HUD Updates
    const roundDisp = document.getElementById('db-round-display');
    if (roundDisp) {
        const timerText = (dodgeballGame.roundTimeLimit > 0 && dodgeballGame.status === 'PLAYING')
            ? ` · ⏱ ${Math.max(0, Math.ceil(dodgeballGame.roundTimeLeft))}s` : '';
        roundDisp.textContent = `${dodgeballGame.round} / ${dodgeballGame.maxRounds}${timerText}`;
    }

    const scoreSquadEl = document.getElementById('db-score-squad');
    if (scoreSquadEl) scoreSquadEl.textContent = String(dodgeballGame.scoreSquad);

    const scoreComNEl = document.getElementById('db-score-comn');
    if (scoreComNEl) scoreComNEl.textContent = String(dodgeballGame.scoreComN);

    // Banner Popup
    const bannerEl = document.getElementById('db-banner');
    if (bannerEl) {
        if (dodgeballGame.banner && dodgeballGame.banner.timer > 0) {
            bannerEl.style.display = 'block';
            bannerEl.textContent = dodgeballGame.banner.text;
            bannerEl.style.borderColor = dodgeballGame.banner.color || '#ffaa00';
        } else {
            bannerEl.style.display = 'none';
        }
    }

    // Overlays
    const countdownOverlay = document.getElementById('db-countdown-overlay');
    const countdownNum = document.getElementById('db-countdown-num');
    const winnerOverlay = document.getElementById('db-winner-overlay');
    const winnerText = document.getElementById('db-winner-text');

    if (dodgeballGame.status === 'COUNTDOWN') {
        if (countdownOverlay) countdownOverlay.style.display = 'block';
        if (countdownNum) countdownNum.textContent = dodgeballGame.countdownTimer > 0 ? Math.ceil(dodgeballGame.countdownTimer) : 'LOS!';
        if (winnerOverlay) winnerOverlay.style.display = 'none';
    } else if (dodgeballGame.status === 'ROUND_OVER' || dodgeballGame.status === 'MATCH_OVER') {
        if (countdownOverlay) countdownOverlay.style.display = 'none';
        if (winnerOverlay) winnerOverlay.style.display = 'block';
        if (winnerText) {
            winnerText.textContent = dodgeballGame.winner
                ? `🏆 ${dodgeballGame.winner.toUpperCase()} GEWINNT DAS MATCH!`
                : (dodgeballGame.banner ? dodgeballGame.banner.text : 'RUNDE VORBEI!');
        }
    } else {
        if (countdownOverlay) countdownOverlay.style.display = 'none';
        if (winnerOverlay) winnerOverlay.style.display = 'none';
    }
}
