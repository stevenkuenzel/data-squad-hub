/**
 * DataSquad Hub UI: Montagsmaler UI
 * Klassisches Script – teilt den globalen Scope mit den übrigen ui/*.js (Ladereihenfolge siehe index.html).
 */

// ==========================================
// GAME 3: SKRIBBL (MONTAGSMALER)
// ==========================================
const skribblCanvas = document.getElementById('skribblCanvas');
const skCtx = skribblCanvas.getContext('2d');
const skTimeLeft = document.getElementById('sk-time-left');
const skWordHint = document.getElementById('sk-word-hint');
const skRoundNum = document.getElementById('sk-round-num');
const skPlayersList = document.getElementById('sk-players-list');
const skChatLog = document.getElementById('sk-chat-log');
const skChatForm = document.getElementById('sk-chat-form');
const skGuessInput = document.getElementById('sk-guess-input');
const skDrawTools = document.getElementById('sk-draw-tools');
const skColorPalette = document.getElementById('sk-color-palette');
const btnSkClear = document.getElementById('btn-sk-clear');
const skWordChoiceOverlay = document.getElementById('sk-word-choice-overlay');
const skWordChoiceContainer = document.getElementById('sk-word-choice-container');

let skCurrentColor = '#000000';
let skCurrentSize = 4;
let isDrawingSk = false;
let lastDrawX = 0, lastDrawY = 0;

const SK_PALETTE = ['#000000', '#ffffff', '#ff0000', '#0099ff', '#00cc44', '#ffaa00', '#9900ff', '#8b5a2b'];
SK_PALETTE.forEach((hex, idx) => {
    const btn = document.createElement('div');
    btn.className = 'sk-color-btn' + (idx === 0 ? ' selected' : '');
    btn.style.backgroundColor = hex;
    btn.addEventListener('click', () => {
        document.querySelectorAll('.sk-color-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        skCurrentColor = hex;
    });
    skColorPalette.appendChild(btn);
});

document.querySelectorAll('.size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        skCurrentSize = parseInt(btn.getAttribute('data-size'), 10);
    });
});

btnSkClear.addEventListener('click', () => {
    if (!skribblGame.isDrawer(myPlayerId)) return;
    skCtx.fillStyle = '#ffffff';
    skCtx.fillRect(0, 0, skribblCanvas.width, skribblCanvas.height);
    if (networkManager.isHost) {
        skribblGame.clearCanvas();
        networkManager.broadcast('SK_CLEAR', {});
    } else {
        networkManager.sendToHost('SK_CLEAR', {});
    }
});

function getCanvasCoords(e) {
    const rect = skribblCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const scaleX = skribblCanvas.width / rect.width;
    const scaleY = skribblCanvas.height / rect.height;
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

function startSkDraw(e) {
    if (skribblGame.activeDrawerId !== myPlayerId || skribblGame.status !== 'DRAWING') return;
    isDrawingSk = true;
    const coords = getCanvasCoords(e);
    lastDrawX = coords.x;
    lastDrawY = coords.y;
}

function moveSkDraw(e) {
    if (!isDrawingSk || skribblGame.activeDrawerId !== myPlayerId || skribblGame.status !== 'DRAWING') return;
    const coords = getCanvasCoords(e);
    const stroke = {
        x1: Math.round(lastDrawX),
        y1: Math.round(lastDrawY),
        x2: Math.round(coords.x),
        y2: Math.round(coords.y),
        color: skCurrentColor,
        size: skCurrentSize
    };
    drawSkStroke(stroke);

    if (networkManager.isHost) {
        skribblGame.addStroke(stroke);
        networkManager.broadcast('SK_STROKE', stroke);
    } else {
        networkManager.sendToHost('SK_STROKE', stroke);
    }
    lastDrawX = coords.x;
    lastDrawY = coords.y;
}

function stopSkDraw() { isDrawingSk = false; }

skribblCanvas.addEventListener('mousedown', startSkDraw);
skribblCanvas.addEventListener('mousemove', moveSkDraw);
window.addEventListener('mouseup', stopSkDraw);

skribblCanvas.addEventListener('touchstart', (e) => { e.preventDefault(); startSkDraw(e); }, { passive: false });
skribblCanvas.addEventListener('touchmove', (e) => { e.preventDefault(); moveSkDraw(e); }, { passive: false });
window.addEventListener('touchend', stopSkDraw);

function drawSkStroke(s) {
    skCtx.lineCap = 'round';
    skCtx.lineJoin = 'round';
    skCtx.strokeStyle = s.color;
    skCtx.lineWidth = s.size;
    skCtx.beginPath();
    skCtx.moveTo(s.x1, s.y1);
    skCtx.lineTo(s.x2, s.y2);
    skCtx.stroke();
}

skChatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (skGuessInput.disabled) return;
    const text = skGuessInput.value.trim();
    if (!text) return;
    skGuessInput.value = '';

    if (networkManager.isHost) {
        const res = skribblGame.handleGuess(myPlayerId, text);
        handleSkribblGuessResult(res);
    } else {
        networkManager.sendToHost('SK_GUESS', { text });
    }
});

function addSkChatMsg(name, text, isCorrect = false) {
    const div = document.createElement('div');
    div.className = 'chat-msg' + (isCorrect ? ' correct' : '');
    div.textContent = isCorrect ? text : `${name}: ${text}`;
    skChatLog.appendChild(div);
    skChatLog.scrollTop = skChatLog.scrollHeight;
}

function setupSkribblUI() {
    skCtx.fillStyle = '#ffffff';
    skCtx.fillRect(0, 0, skribblCanvas.width, skribblCanvas.height);
    renderSkribblSnapshot(skribblGame.getSnapshot(myPlayerId));
}

function renderSkribblSnapshot(snap) {
    if (!networkManager.isHost) {
        // Clients need the drawer/status locally for the drawing guards
        skribblGame.activeDrawerId = snap.activeDrawerId;
        skribblGame.status = snap.status;
    }
    skTimeLeft.textContent = `${snap.timeLeft}s`;
    skRoundNum.textContent = `${snap.currentRound} / ${snap.totalRounds}`;
    skWordHint.textContent = snap.displayWord;

    const isDrawer = snap.activeDrawerId === myPlayerId;
    skDrawTools.style.display = isDrawer ? 'flex' : 'none';

    // Manage Guess Input: Drawer cannot guess, players who already guessed cannot guess again
    const myPlayer = snap.players.find(p => p.id === myPlayerId);
    const hasGuessed = myPlayer ? myPlayer.hasGuessed : false;
    const skSubmitBtn = skChatForm.querySelector('button[type="submit"]');

    if (isDrawer) {
        skGuessInput.disabled = true;
        skGuessInput.placeholder = "Du zeichnest gerade! (Kein Raten möglich)";
        if (skSubmitBtn) skSubmitBtn.disabled = true;
    } else if (hasGuessed) {
        skGuessInput.disabled = true;
        skGuessInput.placeholder = "Richtig erraten! Warte auf die nächste Runde...";
        if (skSubmitBtn) skSubmitBtn.disabled = true;
    } else if (snap.status === 'CHOOSING') {
        skGuessInput.disabled = true;
        skGuessInput.placeholder = `${snap.activeDrawerName || 'Der Zeichner'} wählt ein Wort...`;
        if (skSubmitBtn) skSubmitBtn.disabled = true;
    } else {
        skGuessInput.disabled = false;
        skGuessInput.placeholder = "Begriff eingeben & Enter...";
        if (skSubmitBtn) skSubmitBtn.disabled = false;
    }

    // Word choices modal
    if (isDrawer && snap.status === 'CHOOSING' && snap.wordChoices.length > 0) {
        skWordChoiceOverlay.style.display = 'block';
        skWordChoiceContainer.innerHTML = '';
        snap.wordChoices.forEach(w => {
            const b = document.createElement('button');
            b.className = 'btn btn-primary';
            b.textContent = w;
            b.addEventListener('click', () => {
                skWordChoiceOverlay.style.display = 'none';
                if (networkManager.isHost) {
                    skribblGame.chooseWord(w);
                    broadcastSkribblState();
                } else {
                    networkManager.sendToHost('SK_CHOOSE_WORD', { word: w });
                }
            });
            skWordChoiceContainer.appendChild(b);
        });
    } else {
        skWordChoiceOverlay.style.display = 'none';
    }

    // Players Panel
    skPlayersList.innerHTML = '';
    snap.players.sort((a, b) => b.score - a.score).forEach(p => {
        const div = document.createElement('div');
        div.style.padding = '6px';
        div.style.marginBottom = '4px';
        div.style.borderRadius = '4px';
        div.style.background = p.hasGuessed ? 'rgba(57, 255, 20, 0.15)' : 'rgba(255,255,255,0.03)';
        div.innerHTML = `<strong>${esc(p.name)}</strong><br><span style="color: var(--cyan);">${esc(p.score)} Pkt</span>`;
        skPlayersList.appendChild(div);
    });
}

function broadcastSkribblState() {
    for (const conn of networkManager.connections.values()) {
        if (conn.open) {
            conn.send({
                type: 'SK_STATE',
                payload: skribblGame.getSnapshot(conn.peer)
            });
        }
    }
    renderSkribblSnapshot(skribblGame.getSnapshot(myPlayerId));
}

function handleSkribblGuessResult(res) {
    if (res.isMatch) {
        addSkChatMsg('', res.systemMsg, true);
        if (window.soundFX) window.soundFX.playWin();
        broadcastSkribblState();
        networkManager.broadcast('SK_CHAT', { systemMsg: res.systemMsg, isMatch: true });
    } else if (res.chatMsg && res.chatMsg.name) {
        addSkChatMsg(res.chatMsg.name, res.chatMsg.text, false);
        networkManager.broadcast('SK_CHAT', { chatMsg: res.chatMsg });
    }
}
