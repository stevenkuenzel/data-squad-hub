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
const unoWinnerOverlay = document.getElementById('uno-winner-overlay');
const unoWinnerText = document.getElementById('uno-winner-text');

let pendingWildCardId = null;

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

    const isMyTurn = snap.currentTurnPlayerId === myPlayerId;
    if (unoTurnIndicator) {
        unoTurnIndicator.textContent = isMyTurn ? 'AM ZUG: DU' : `AM ZUG: ${snap.currentTurnName}`;
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
                <span style="color: ${safeColor(p.color)}; font-weight: bold;">${esc(p.name)}${p.isBot ? ' 🤖' : ''}</span>
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
            const canPlay = isMyTurn && !snap.awaitingColorChoice && (
                card.color === 'wild' ||
                card.color === snap.activeColor ||
                (snap.topCard && card.value === snap.topCard.value)
            );

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

    // Winner overlay
    if (snap.status === 'GAME_OVER' && snap.winner) {
        if (unoWinnerOverlay) unoWinnerOverlay.style.display = 'flex';
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
                payload: unoGame.getSnapshot(conn.peer)
            });
        }
    }
    renderUnoSnapshot(unoGame.getSnapshot(myPlayerId));
}

// Deck Draw button click
if (btnUnoDraw) {
    btnUnoDraw.addEventListener('click', () => {
        if (unoGame.status === 'PLAYING') {
            const curr = unoGame.getCurrentPlayer();
            if (curr && curr.id === myPlayerId) {
                if (networkManager.isHost) {
                    unoGame.playerDrawCard(myPlayerId);
                    broadcastUnoState();
                } else {
                    networkManager.sendToHost('UNO_DRAW', {});
                }
            }
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
