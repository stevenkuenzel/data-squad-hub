/**
 * DataSquad Hub UI: Octa-Pong UI
 * Klassisches Script – teilt den globalen Scope mit den übrigen ui/*.js (Ladereihenfolge siehe index.html).
 */

// ==========================================
// GAME 5: OCTA-PONG (8-SPIELER PONG)
// ==========================================
const pongCanvas = document.getElementById('pongCanvas');
const pongCtx = pongCanvas.getContext('2d');
const pongScoresContainer = document.getElementById('pong-scores-container');
const pongCountdownOverlay = document.getElementById('pong-countdown-overlay');
const pongCountdownNum = document.getElementById('pong-countdown-num');
const pongWinnerOverlay = document.getElementById('pong-winner-overlay');
const pongWinnerText = document.getElementById('pong-winner-text');

document.querySelector('.btn-play-again-pong').addEventListener('click', () => {
    pongWinnerOverlay.style.display = 'none';
    if (networkManager.isHost) {
        octaPongGame.startMatch();
    }
});

function renderPong() {
    pongCtx.fillStyle = '#05070d';
    pongCtx.fillRect(0, 0, 1200, 800);

    // Draw Octagon Perimeter & Paddles
    for (let s = 0; s < 8; s++) {
        const { p1, p2 } = octaPongGame.getSideSegment(s);
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;

        // Find active player on this side
        let player = null;
        for (const pl of octaPongGame.players.values()) {
            if (pl.sideIdx === s && pl.alive) {
                player = pl;
                break;
            }
        }

        if (player) {
            // Goal perimeter line (dimmed)
            pongCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            pongCtx.lineWidth = 2;
            pongCtx.beginPath();
            pongCtx.moveTo(p1.x, p1.y);
            pongCtx.lineTo(p2.x, p2.y);
            pongCtx.stroke();

            // Draw Sliding Paddle
            const halfW = PADDLE_WIDTH_RATIO / 2;
            const padStartT = Math.max(0, player.paddlePos - halfW);
            const padEndT = Math.min(1, player.paddlePos + halfW);

            const padX1 = p1.x + dx * padStartT;
            const padY1 = p1.y + dy * padStartT;
            const padX2 = p1.x + dx * padEndT;
            const padY2 = p1.y + dy * padEndT;

            pongCtx.save();
            pongCtx.strokeStyle = player.color;
            pongCtx.shadowColor = player.color;
            pongCtx.shadowBlur = 12;
            pongCtx.lineWidth = 7;
            pongCtx.lineCap = 'round';
            pongCtx.beginPath();
            pongCtx.moveTo(padX1, padY1);
            pongCtx.lineTo(padX2, padY2);
            pongCtx.stroke();
            pongCtx.restore();
        } else {
            // Solid Bounce Wall
            pongCtx.strokeStyle = 'rgba(0, 243, 255, 0.45)';
            pongCtx.lineWidth = 4;
            pongCtx.beginPath();
            pongCtx.moveTo(p1.x, p1.y);
            pongCtx.lineTo(p2.x, p2.y);
            pongCtx.stroke();
        }
    }

    // Draw Balls
    for (const b of octaPongGame.balls) {
        pongCtx.save();
        pongCtx.fillStyle = '#ffffff';
        pongCtx.shadowColor = 'var(--cyan)';
        pongCtx.shadowBlur = 14;
        pongCtx.beginPath();
        pongCtx.arc(b.x, b.y, BALL_RADIUS, 0, Math.PI * 2);
        pongCtx.fill();
        pongCtx.restore();
    }

    // Particles
    for (const pt of octaPongGame.particles) {
        pongCtx.save();
        pongCtx.globalAlpha = Math.max(0, pt.life);
        pongCtx.fillStyle = pt.color;
        pongCtx.beginPath();
        pongCtx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
        pongCtx.fill();
        pongCtx.restore();
    }

    // Pong Scores / Lives
    pongScoresContainer.innerHTML = '';
    for (const p of octaPongGame.players.values()) {
        const badge = document.createElement('div');
        badge.className = 'score-badge' + (!p.alive ? ' dead' : '');
        badge.style.borderLeft = `3px solid ${safeColor(p.color)}`;
        const hearts = '❤️'.repeat(Math.min(10, Math.max(0, Number(p.lives) || 0)));
        badge.innerHTML = `<span style="color: ${safeColor(p.color)};">${avatarHtml(p.id, p.isBot)}${esc(p.name)}</span><span>${hearts || '💀'}</span>`;
        pongScoresContainer.appendChild(badge);
    }

    if (octaPongGame.status === 'COUNTDOWN') {
        pongCountdownOverlay.style.display = 'block';
        pongCountdownNum.textContent = octaPongGame.countdownTimer > 0 ? Math.ceil(octaPongGame.countdownTimer) : 'LOS!';
        pongWinnerOverlay.style.display = 'none';
    } else if (octaPongGame.status === 'GAME_OVER') {
        pongCountdownOverlay.style.display = 'none';
        pongWinnerOverlay.style.display = 'block';
        const btnAgainPong = document.querySelector('.btn-play-again-pong');
        if (btnAgainPong) btnAgainPong.style.display = networkManager.isHost ? 'block' : 'none';
        pongWinnerText.textContent = octaPongGame.winner ? `🏆 ${octaPongGame.winner.name} GEWINNT!` : 'SPIEL ENDE';
    } else {
        pongCountdownOverlay.style.display = 'none';
        pongWinnerOverlay.style.display = 'none';
    }
}
