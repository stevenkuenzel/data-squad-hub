/**
 * DataSquad Hub UI: Freigabe-Roulette UI
 * Klassisches Script – teilt den globalen Scope mit den übrigen ui/*.js (Ladereihenfolge siehe index.html).
 */

// ==========================================
// GAME 8: FREIGABE-ROULETTE
// ==========================================
const rouletteStatusText = document.getElementById('roulette-status-text');
const rouletteRoomPill = document.getElementById('roulette-room-pill');
const rouletteTurnCards = document.getElementById('roulette-turn-cards');
const rouletteRoster = document.getElementById('roulette-roster');
const rouletteDrawCount = document.getElementById('roulette-draw-count');
const rouletteDiscardSlot = document.getElementById('roulette-discard-slot');
const rouletteLogList = document.getElementById('roulette-log-list');
const rouletteHandCount = document.getElementById('roulette-hand-count');
const btnRouletteEndTurn = document.getElementById('btn-roulette-end-turn');
const rouletteHandCards = document.getElementById('roulette-hand-cards');
const rouletteTargetModal = document.getElementById('roulette-target-modal');
const rouletteTargetButtons = document.getElementById('roulette-target-buttons');
const btnRouletteCancelTarget = document.getElementById('btn-cancel-target') || document.getElementById('btn-roulette-cancel-target');
const rouletteWinnerOverlay = document.getElementById('roulette-winner-overlay');
const rouletteWinnerText = document.getElementById('roulette-winner-text');
const btnPlayAgainRoulette = document.querySelector('.btn-play-again-roulette');

let pendingRouletteCardUid = null;
let latestRouletteSnapshot = null;

if (rouletteRoomPill) {
    rouletteRoomPill.addEventListener('click', () => {
        if (!networkManager.roomCode) return;
        const link = getShareableLink('roulette', networkManager.roomCode);
        navigator.clipboard.writeText(link).then(() => {
            const strong = rouletteRoomPill.querySelector('strong');
            const orig = strong ? strong.textContent : '';
            if (strong) strong.textContent = 'KOPIERT!';
            setTimeout(() => { if (strong) strong.textContent = orig; }, 1500);
        });
    });
}

function renderRouletteCardElement(card, isPlayable = false) {
    const div = document.createElement('div');
    div.className = `roulette-card cat-${card.category}` + (isPlayable ? ' playable' : '');
    div.setAttribute('data-card-uid', card.uid);

    const catLabel = {
        progress: 'FORTSCHRITT',
        blocker: 'COMN-BLOCK',
        reaction: 'REAKTION',
        action: 'AKTION'
    }[card.category] || card.category.toUpperCase();

    const valBadge = card.value > 0 ? `+${card.value}%` : (card.penalty > 0 ? `-${card.penalty}%` : '');

    div.innerHTML = `
        <div class="roulette-card-header">
            <span>${esc(catLabel)}</span>
            <span>${esc(valBadge)}</span>
        </div>
        <div class="roulette-card-center-icon">${esc(card.icon)}</div>
        <div class="roulette-card-title">${esc(card.title)}</div>
        <div class="roulette-card-desc">${esc(card.desc)}</div>
    `;
    return div;
}

function handleRouletteCardClick(card) {
    const snap = latestRouletteSnapshot || rouletteGame.getSnapshot(myPlayerId);
    if (!snap || snap.status !== 'PLAYING') return;
    if (snap.currentTurnPlayerId !== myPlayerId) return;
    if (snap.cardsPlayedThisTurn >= snap.maxCardsPerTurn) return;

    if (card.target === 'enemy') {
        pendingRouletteCardUid = card.uid;
        if (rouletteTargetButtons) {
            rouletteTargetButtons.innerHTML = '';
            const enemies = (snap.players || []).filter(p => p.id !== myPlayerId);
            if (enemies.length === 0) return;
            enemies.forEach(player => {
                const btn = document.createElement('button');
                btn.className = 'btn btn-secondary';
                btn.style.width = '100%';
                btn.style.textAlign = 'left';
                btn.style.display = 'flex';
                btn.style.justifyContent = 'space-between';
                btn.innerHTML = `<span style="color:${safeColor(player.color)}">● ${esc(player.name)}</span><span>${esc(player.progress)}% Fortschritt</span>`;
                btn.addEventListener('click', () => {
                    if (rouletteTargetModal) rouletteTargetModal.style.display = 'none';
                    executeRoulettePlay(pendingRouletteCardUid, player.id);
                    pendingRouletteCardUid = null;
                });
                rouletteTargetButtons.appendChild(btn);
            });
        }
        if (rouletteTargetModal) rouletteTargetModal.style.display = 'flex';
    } else {
        executeRoulettePlay(card.uid, null);
    }
}

function executeRoulettePlay(cardUid, targetId) {
    if (networkManager.isHost) {
        rouletteGame.playCard(myPlayerId, cardUid, targetId);
        broadcastRouletteState();
    } else {
        networkManager.sendToHost('ROULETTE_PLAY', { cardUid, targetId });
    }
}

if (btnRouletteCancelTarget) {
    btnRouletteCancelTarget.addEventListener('click', () => {
        if (rouletteTargetModal) rouletteTargetModal.style.display = 'none';
        pendingRouletteCardUid = null;
    });
}

if (btnRouletteEndTurn) {
    btnRouletteEndTurn.addEventListener('click', () => {
        const snap = latestRouletteSnapshot || rouletteGame.getSnapshot(myPlayerId);
        if (snap && snap.status === 'PLAYING' && snap.currentTurnPlayerId === myPlayerId) {
            if (networkManager.isHost) {
                rouletteGame.endTurn();
                broadcastRouletteState();
            } else {
                networkManager.sendToHost('ROULETTE_END_TURN', {});
            }
        }
    });
}

if (btnPlayAgainRoulette) {
    btnPlayAgainRoulette.addEventListener('click', () => {
        if (rouletteWinnerOverlay) rouletteWinnerOverlay.style.display = 'none';
        if (networkManager.isHost) {
            rouletteGame.startMatch();
            broadcastRouletteState();
        }
    });
}

function renderRouletteSnapshot(snap) {
    if (!snap) return;
    latestRouletteSnapshot = snap;

    const isMyTurn = snap.currentTurnPlayerId === myPlayerId;
    if (rouletteStatusText) {
        rouletteStatusText.textContent = isMyTurn ? 'AM ZUG: DU' : (snap.currentTurnName ? `AM ZUG: ${snap.currentTurnName}` : 'Warten...');
        rouletteStatusText.style.color = isMyTurn ? 'var(--cyan)' : '#f59e0b';
    }

    if (rouletteTurnCards) {
        rouletteTurnCards.textContent = `${snap.cardsPlayedThisTurn} / ${snap.maxCardsPerTurn}`;
    }

    if (rouletteRoster) {
        rouletteRoster.innerHTML = '';
        (snap.players || []).forEach(p => {
            const card = document.createElement('div');
            card.className = 'roulette-player-card' + (p.isCurrentTurn ? ' active-turn' : '');
            const shieldIcon = p.shielded ? ' 🛡️' : '';
            const skipIcon = p.skipped ? ' 🗣️' : '';
            card.innerHTML = `
                <div class="roulette-player-info">
                    <strong style="color: ${safeColor(p.color)};">${esc(p.name)}${shieldIcon}${skipIcon}</strong>
                    <span>${esc(p.progress)}% (${esc(p.cardCount)} Karten)</span>
                </div>
                <div class="roulette-progress-wrapper">
                    <div class="roulette-progress-bar" style="width: ${Math.min(100, Math.max(0, Number(p.progress) || 0))}%; background: ${safeColor(p.color)};"></div>
                </div>
            `;
            rouletteRoster.appendChild(card);
        });
    }

    if (rouletteDrawCount) {
        rouletteDrawCount.textContent = snap.drawPileCount;
    }

    if (rouletteDiscardSlot) {
        rouletteDiscardSlot.innerHTML = '';
        if (snap.discardTop) {
            rouletteDiscardSlot.appendChild(renderRouletteCardElement(snap.discardTop, false));
        } else {
            rouletteDiscardSlot.innerHTML = '<span class="discard-placeholder" style="color:rgba(255,255,255,0.4); font-size:0.8rem;">Ablagestapel</span>';
        }
    }

    if (rouletteLogList) {
        rouletteLogList.innerHTML = (snap.logs || []).map(log => `<div>${esc(log)}</div>`).join('');
    }

    if (rouletteHandCards) {
        rouletteHandCards.innerHTML = '';
        if (rouletteHandCount) rouletteHandCount.textContent = snap.myHand ? snap.myHand.length : 0;

        const canPlay = isMyTurn && snap.cardsPlayedThisTurn < snap.maxCardsPerTurn && snap.status === 'PLAYING';
        if (snap.myHand) {
            snap.myHand.forEach(card => {
                const cardPlayable = canPlay && card.category !== 'reaction';
                const el = renderRouletteCardElement(card, cardPlayable);
                if (cardPlayable) {
                    el.addEventListener('click', () => handleRouletteCardClick(card));
                }
                rouletteHandCards.appendChild(el);
            });
        }
    }

    if (rouletteWinnerOverlay) {
        if (snap.status === 'GAME_OVER' && snap.winner) {
            rouletteWinnerOverlay.style.display = 'block';
            if (btnPlayAgainRoulette) btnPlayAgainRoulette.style.display = networkManager.isHost ? 'block' : 'none';
            if (rouletteWinnerText) {
                rouletteWinnerText.textContent = `🎉 ${snap.winner.toUpperCase()} ERREICHT 100% GO-LIVE!`;
            }
        } else {
            rouletteWinnerOverlay.style.display = 'none';
        }
    }
}

function broadcastRouletteState() {
    for (const conn of networkManager.connections.values()) {
        if (conn.open) {
            conn.send({
                type: 'ROULETTE_STATE',
                payload: rouletteGame.getSnapshot(networkManager.playerIdOf(conn.peer))
            });
        }
    }
    renderRouletteSnapshot(rouletteGame.getSnapshot(myPlayerId));
}
