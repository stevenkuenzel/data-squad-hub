/**
 * DataSquad Hub UI: UNO UI
 * Klassisches Script – teilt den globalen Scope mit den übrigen ui/*.js (Ladereihenfolge siehe index.html).
 */

// ==========================================
// GAME 6: UNO
// ==========================================
const unoTurnIndicator = document.getElementById('uno-turn-indicator');
const unoActiveColorBadge = document.getElementById('uno-active-color-badge');
const unoOpponentsBar = document.getElementById('uno-opponents-bar');
const btnUnoDraw = document.getElementById('btn-uno-draw');
const unoDeckCount = document.getElementById('uno-deck-count');
const unoTopCardContainer = document.getElementById('uno-top-card-container');
const unoHandCards = document.getElementById('uno-hand-cards');
const btnCallUno = document.getElementById('btn-call-uno');
const unoColorModal = document.getElementById('uno-color-modal');
const unoSwapModal = document.getElementById('uno-swap-modal');
const unoSwapOptions = document.getElementById('uno-swap-options');
const unoWinnerOverlay = document.getElementById('uno-winner-overlay');
const unoWinnerText = document.getElementById('uno-winner-text');

let pendingWildCardId = null;
let lastUnoSnap = null;

function renderUnoCardElement(card, isPlayable = false) {
    const div = document.createElement('div');
    div.className = `uno-card color-${card.color}` + (isPlayable ? ' playable' : ' unplayable');
    div.setAttribute('data-card-id', card.id);

    const valMap = {
        skip: '🚫',
        reverse: '🔄',
        draw2: '+2',
        wild: '🌈',
        wild4: '+4'
    };
    const displayVal = valMap[card.value] || card.value;

    div.innerHTML = `
        <span class="card-corner top">${esc(displayVal)}</span>
        <div class="uno-card-center"><span>${esc(displayVal)}</span></div>
        <span class="card-corner bottom">${esc(displayVal)}</span>
    `;
    return div;
}

function renderUnoSnapshot(snap) {
    if (!snap) return;
    lastUnoSnap = snap;

    const isMyTurn = snap.currentTurnPlayerId === myPlayerId;
    const btnPass = document.getElementById('btn-uno-pass');
    if (btnPass) btnPass.style.display = (isMyTurn && snap.drewThisTurn && snap.status === 'PLAYING') ? 'inline-flex' : 'none';
    if (unoTurnIndicator) {
        const pendingText = snap.pendingDraw > 0 ? ` · ⚠️ +${snap.pendingDraw} offen` : '';
        unoTurnIndicator.textContent = (isMyTurn ? 'AM ZUG: DU' : `AM ZUG: ${snap.currentTurnName}`) + pendingText;
        unoTurnIndicator.style.color = isMyTurn ? 'var(--cyan)' : '#f59e0b';
    }

    // Active color badge
    if (unoActiveColorBadge) {
        const colorLabels = {
            red: '🔴 Rot',
            blue: '🔵 Blau',
            green: '🟢 Grün',
            yellow: '🟡 Gelb'
        };
        unoActiveColorBadge.textContent = `Farbe: ${colorLabels[snap.activeColor] || snap.activeColor}`;
        const colorStyleMap = {
            red: '#ef4444',
            blue: '#3b82f6',
            green: '#10b981',
            yellow: '#f59e0b'
        };
        unoActiveColorBadge.style.color = colorStyleMap[snap.activeColor] || '#fff';
    }

    // Deck count
    if (unoDeckCount) unoDeckCount.textContent = snap.drawPileCount;

    // Top discard card
    if (unoTopCardContainer) {
        unoTopCardContainer.innerHTML = '';
        if (snap.topCard) {
            const topEl = renderUnoCardElement(snap.topCard, false);
            unoTopCardContainer.appendChild(topEl);
        }
    }

    // Opponents roster
    if (unoOpponentsBar) {
        unoOpponentsBar.innerHTML = '';
        (snap.players || []).forEach(p => {
            if (p.id === myPlayerId) return; // Don't show self in opponents row
            const b = document.createElement('div');
            b.className = 'uno-opponent-badge' + (p.isCurrentTurn ? ' active-turn' : '');
            b.innerHTML = `
                ${avatarHtml(p.id, p.isBot)}<span style="color: ${safeColor(p.color)}; font-weight: bold;">${esc(p.name)}</span>
                <span class="cards-tag">${esc(p.cardCount)} 🎴</span>
                ${p.calledUno ? '<span style="color: #f59e0b; font-weight: bold;">UNO!</span>' : ''}
            `;
            unoOpponentsBar.appendChild(b);
        });
    }

    // My hand cards
    if (unoHandCards) {
        unoHandCards.innerHTML = '';
        (snap.myHand || []).forEach(card => {
            let canPlay;
            if (!isMyTurn || snap.awaitingColorChoice || snap.awaitingSwap) {
                canPlay = false;
            } else if (snap.pendingDraw > 0) {
                // Stacking house rule: only +2/+4 may answer an open penalty
                canPlay = snap.pendingType === 'wild4'
                    ? card.value === 'wild4'
                    : (card.value === 'draw2' || card.value === 'wild4');
            } else {
                canPlay = card.color === 'wild' ||
                    card.color === snap.activeColor ||
                    (snap.topCard && card.value === snap.topCard.value);
            }

            const cardEl = renderUnoCardElement(card, canPlay);
            if (canPlay) {
                cardEl.addEventListener('click', () => {
                    if (card.color === 'wild') {
                        pendingWildCardId = card.id;
                        if (unoColorModal) unoColorModal.style.display = 'flex';
                    } else {
                        if (networkManager.isHost) {
                            unoGame.playCard(myPlayerId, card.id);
                            broadcastUnoState();
                        } else {
                            networkManager.sendToHost('UNO_PLAY', { cardId: card.id });
                        }
                    }
                });
            }
            unoHandCards.appendChild(cardEl);
        });
    }

    // 7-0 house rule: swap partner selection
    if (unoSwapModal) {
        if (snap.awaitingSwap && snap.swapChooserId === myPlayerId) {
            unoSwapModal.style.display = 'flex';
            unoSwapOptions.innerHTML = '';
            (snap.players || []).filter(p => p.id !== myPlayerId).forEach(p => {
                const b = document.createElement('button');
                b.className = 'color-pick-btn';
                b.textContent = `${p.name}${p.isBot ? ' 🤖' : ''} (${p.cardCount} 🎴)`;
                b.addEventListener('click', () => {
                    unoSwapModal.style.display = 'none';
                    if (networkManager.isHost) {
                        unoGame.chooseSwapTarget(myPlayerId, p.id);
                        broadcastUnoState();
                    } else {
                        networkManager.sendToHost('UNO_SWAP', { targetId: p.id });
                    }
                });
                unoSwapOptions.appendChild(b);
            });
        } else {
            unoSwapModal.style.display = 'none';
        }
    }

    // Winner overlay
    if (snap.status === 'GAME_OVER' && snap.winner) {
        if (unoWinnerOverlay) unoWinnerOverlay.style.display = 'flex';
        if (btnPlayAgainUno) btnPlayAgainUno.style.display = networkManager.isHost ? 'block' : 'none';
        if (unoWinnerText) unoWinnerText.textContent = `🏆 ${snap.winner} GEWINNT UNO!`;
    } else {
        if (unoWinnerOverlay) unoWinnerOverlay.style.display = 'none';
    }
}

function broadcastUnoState() {
    for (const conn of networkManager.connections.values()) {
        if (conn.open) {
            conn.send({
                type: 'UNO_STATE',
                payload: unoGame.getSnapshot(networkManager.playerIdOf(conn.peer))
            });
        }
    }
    renderUnoSnapshot(unoGame.getSnapshot(myPlayerId));
}

// Deck Draw button click
if (btnUnoDraw) {
    btnUnoDraw.addEventListener('click', () => {
        // Clients only know the last snapshot, not the engine state
        const snap = lastUnoSnap;
        if (snap && snap.status === 'PLAYING' && snap.currentTurnPlayerId === myPlayerId &&
            !snap.awaitingColorChoice && !snap.awaitingSwap) {
            if (networkManager.isHost) {
                unoGame.playerDrawCard(myPlayerId);
                broadcastUnoState();
            } else {
                networkManager.sendToHost('UNO_DRAW', {});
            }
        }
    });
}

// Passen nach dem Ziehen
const btnUnoPass = document.getElementById('btn-uno-pass');
if (btnUnoPass) {
    btnUnoPass.addEventListener('click', () => {
        if (networkManager.isHost) {
            unoGame.passTurn(myPlayerId);
            broadcastUnoState();
        } else {
            networkManager.sendToHost('UNO_PASS', {});
        }
    });
}

// UNO call button
if (btnCallUno) {
    btnCallUno.addEventListener('click', () => {
        if (networkManager.isHost) {
            unoGame.callUno(myPlayerId);
            broadcastUnoState();
        } else {
            networkManager.sendToHost('UNO_CALL', {});
        }
    });
}

// Color picker buttons
document.querySelectorAll('.color-pick-btn').forEach(b => {
    b.addEventListener('click', () => {
        const chosenCol = b.getAttribute('data-color');
        if (unoColorModal) unoColorModal.style.display = 'none';
        if (pendingWildCardId) {
            if (networkManager.isHost) {
                unoGame.playCard(myPlayerId, pendingWildCardId, chosenCol);
                broadcastUnoState();
            } else {
                networkManager.sendToHost('UNO_PLAY', { cardId: pendingWildCardId, color: chosenCol });
            }
            pendingWildCardId = null;
        }
    });
});

// Play again button
const btnPlayAgainUno = document.querySelector('.btn-play-again-uno');
if (btnPlayAgainUno) {
    btnPlayAgainUno.addEventListener('click', () => {
        if (unoWinnerOverlay) unoWinnerOverlay.style.display = 'none';
        if (networkManager.isHost) {
            unoGame.startMatch();
            broadcastUnoState();
        }
    });
}
