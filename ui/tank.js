/**
 * DataSquad Hub UI: Tank Trouble UI
 * Klassisches Script – teilt den globalen Scope mit den übrigen ui/*.js (Ladereihenfolge siehe index.html).
 */

// ==========================================
// GAME 4: TANK TROUBLE
// ==========================================
const tankCanvas = document.getElementById('tankCanvas');
const tankCtx = tankCanvas.getContext('2d');
const tankRoundDisplay = document.getElementById('tank-round-display');
const tankScoresContainer = document.getElementById('tank-scores-container');
const tankWinnerOverlay = document.getElementById('tank-winner-overlay');
const tankWinnerText = document.getElementById('tank-winner-text');

function renderTank() {
    tankCtx.fillStyle = '#060810';
    tankCtx.fillRect(0, 0, TANK_ARENA_W, TANK_ARENA_H);

    // Draw Maze Walls
    tankCtx.strokeStyle = 'rgba(0, 243, 255, 0.5)';
    tankCtx.lineWidth = 4;
    tankCtx.lineCap = 'round';
    for (const w of tankGame.walls) {
        tankCtx.beginPath();
        tankCtx.moveTo(w.x1, w.y1);
        tankCtx.lineTo(w.x2, w.y2);
        tankCtx.stroke();
    }

    // Mines
    for (const m of tankGame.mines) {
        tankCtx.save();
        tankCtx.fillStyle = m.armed ? '#ff3355' : '#664400';
        tankCtx.shadowColor = m.armed ? '#ff3355' : '#000';
        tankCtx.shadowBlur = m.armed ? 10 : 0;
        tankCtx.globalAlpha = m.armed ? (0.6 + 0.4 * Math.sin(performance.now() / 150)) : 0.8;
        tankCtx.beginPath();
        tankCtx.arc(m.x, m.y, 9, 0, Math.PI * 2);
        tankCtx.fill();
        tankCtx.restore();
    }

    // Weapon pickups
    for (const pu of tankGame.pickups) {
        const def = TANK_PICKUPS[pu.type];
        if (!def) continue;
        tankCtx.save();
        tankCtx.strokeStyle = def.color;
        tankCtx.shadowColor = def.color;
        tankCtx.shadowBlur = 14;
        tankCtx.lineWidth = 3;
        tankCtx.beginPath();
        tankCtx.arc(pu.x, pu.y, 17 + Math.sin(performance.now() / 200) * 2, 0, Math.PI * 2);
        tankCtx.stroke();
        tankCtx.font = '20px "Segoe UI Emoji", sans-serif';
        tankCtx.textAlign = 'center';
        tankCtx.textBaseline = 'middle';
        tankCtx.fillText(def.icon, pu.x, pu.y + 1);
        tankCtx.restore();
    }

    // Laser beams (brief flash)
    for (const l of tankGame.lasers) {
        tankCtx.save();
        tankCtx.globalAlpha = Math.max(0, Math.min(1, l.life / 0.35));
        tankCtx.strokeStyle = '#ffffff';
        tankCtx.shadowColor = l.color || '#ff3355';
        tankCtx.shadowBlur = 20;
        tankCtx.lineWidth = 4;
        tankCtx.beginPath();
        l.points.forEach((pt, i) => (i === 0 ? tankCtx.moveTo(pt[0], pt[1]) : tankCtx.lineTo(pt[0], pt[1])));
        tankCtx.stroke();
        tankCtx.restore();
    }

    // Draw Bouncing Bullets
    for (const b of tankGame.bullets) {
        tankCtx.fillStyle = b.color || '#ff007f';
        tankCtx.beginPath();
        tankCtx.arc(b.x, b.y, BULLET_RADIUS, 0, Math.PI * 2);
        tankCtx.fill();
    }

    // Draw Tanks
    for (const p of tankGame.players.values()) {
        if (!p.alive) continue;
        tankCtx.save();
        tankCtx.translate(p.x, p.y);
        tankCtx.rotate(p.angle);

        // Tank Body
        tankCtx.fillStyle = p.color;
        tankCtx.shadowColor = p.color;
        tankCtx.shadowBlur = 10;
        tankCtx.fillRect(-TANK_RADIUS, -TANK_RADIUS * 0.75, TANK_RADIUS * 2, TANK_RADIUS * 1.5);

        // Turret Cannon
        tankCtx.fillStyle = '#ffffff';
        tankCtx.fillRect(0, -2.5, TANK_RADIUS + 8, 5);

        tankCtx.restore();

        // Special weapon indicator above the tank
        if (p.weapon && TANK_PICKUPS[p.weapon]) {
            tankCtx.font = '16px "Segoe UI Emoji", sans-serif';
            tankCtx.textAlign = 'center';
            tankCtx.fillText(TANK_PICKUPS[p.weapon].icon, p.x, p.y - TANK_RADIUS - 8);
        }
    }

    // Particles
    for (const pt of tankGame.particles) {
        tankCtx.save();
        tankCtx.globalAlpha = Math.max(0, pt.life);
        tankCtx.fillStyle = pt.color;
        tankCtx.beginPath();
        tankCtx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
        tankCtx.fill();
        tankCtx.restore();
    }

    // Tank HUD
    tankRoundDisplay.textContent = `${tankGame.round} / ${tankGame.maxRounds}`;
    tankScoresContainer.innerHTML = '';
    for (const p of tankGame.players.values()) {
        const badge = document.createElement('div');
        badge.className = 'score-badge' + (!p.alive ? ' dead' : '');
        badge.style.borderLeft = `3px solid ${safeColor(p.color)}`;
        badge.innerHTML = `<span style="color: ${safeColor(p.color)};">${avatarHtml(p.id, p.isBot)}${esc(p.name)}</span><span>${esc(p.score)}</span>`;
        tankScoresContainer.appendChild(badge);
    }

    if (tankGame.status === 'ROUND_OVER' || tankGame.status === 'MATCH_OVER') {
        tankWinnerOverlay.style.display = 'block';
        tankWinnerText.textContent = tankGame.matchWinner 
            ? `🏆 ${tankGame.matchWinner.name} HAT GEWONNEN!` 
            : (tankGame.roundWinner ? `${tankGame.roundWinner.name} gewinnt die Runde!` : 'Unentschieden!');
    } else {
        tankWinnerOverlay.style.display = 'none';
    }
}
