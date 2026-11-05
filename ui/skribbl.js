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
const btnSkUndo = document.getElementById('btn-sk-undo');
const skWordChoiceOverlay = document.getElementById('sk-word-choice-overlay');
const skWordChoiceContainer = document.getElementById('sk-word-choice-container');

let skCurrentColor = '#000000';
let skCurrentSize = 4;
let skTool = 'pen';          // 'pen' | 'eraser' | 'fill'
let skGroup = 0;             // id of the current stroke group (one mouse-down..up or one fill)
let skStrokes = [];          // every stroke of the current drawing, kept on all clients for undo/redraw
let skLastStatus = null;
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

document.querySelectorAll('#sk-tools [data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#sk-tools [data-tool]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        skTool = btn.getAttribute('data-tool');
    });
});

function clearSkCanvas() {
    skStrokes = [];
    skCtx.fillStyle = '#ffffff';
    skCtx.fillRect(0, 0, skribblCanvas.width, skribblCanvas.height);
}

function redrawSkCanvas() {
    skCtx.fillStyle = '#ffffff';
    skCtx.fillRect(0, 0, skribblCanvas.width, skribblCanvas.height);
    skStrokes.forEach(drawSkStroke);
}

// Remove the newest stroke group locally (every client mirrors the host's undo)
function undoSkLocal() {
    if (skStrokes.length === 0) return;
    const g = skStrokes[skStrokes.length - 1].g;
    while (skStrokes.length > 0 && skStrokes[skStrokes.length - 1].g === g) skStrokes.pop();
    redrawSkCanvas();
}

// Store + paint one stroke received from the network or drawn locally
function applySkStroke(s) {
    skStrokes.push(s);
    drawSkStroke(s);
}

btnSkUndo.addEventListener('click', () => {
    if (!skribblGame.isDrawer(myPlayerId) || skribblGame.status !== 'DRAWING') return;
    if (networkManager.isHost) {
        if (!skribblGame.undoLast()) return;
        undoSkLocal();
        networkManager.broadcast('SK_UNDO', {});
    } else {
        networkManager.sendToHost('SK_UNDO', {});
    }
});

btnSkClear.addEventListener('click', () => {
    if (!skribblGame.isDrawer(myPlayerId)) return;
    clearSkCanvas();
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

function sendSkStroke(stroke) {
    applySkStroke(stroke);
    if (networkManager.isHost) {
        skribblGame.addStroke(stroke);
        networkManager.broadcast('SK_STROKE', stroke);
    } else {
        networkManager.sendToHost('SK_STROKE', stroke);
    }
}

function currentSkStroke(x1, y1, x2, y2) {
    // The eraser is a fat white pen
    return {
        g: skGroup,
        x1: Math.round(x1),
        y1: Math.round(y1),
        x2: Math.round(x2),
        y2: Math.round(y2),
        color: skTool === 'eraser' ? '#ffffff' : skCurrentColor,
        size: skTool === 'eraser' ? Math.min(32, skCurrentSize * 3) : skCurrentSize
    };
}

function startSkDraw(e) {
    if (skribblGame.activeDrawerId !== myPlayerId || skribblGame.status !== 'DRAWING') return;
    const coords = getCanvasCoords(e);
    skGroup = Math.floor(Math.random() * 2000000000) + 1;

    if (skTool === 'fill') {
        sendSkStroke({ g: skGroup, fill: true, x1: Math.round(coords.x), y1: Math.round(coords.y), x2: Math.round(coords.x), y2: Math.round(coords.y), color: skCurrentColor, size: 1 });
        return;
    }

    isDrawingSk = true;
    lastDrawX = coords.x;
    lastDrawY = coords.y;
    // A click without movement still leaves a dot
    sendSkStroke(currentSkStroke(coords.x, coords.y, coords.x + 0.5, coords.y));
}

function moveSkDraw(e) {
    if (!isDrawingSk || skribblGame.activeDrawerId !== myPlayerId || skribblGame.status !== 'DRAWING') return;
    const coords = getCanvasCoords(e);
    sendSkStroke(currentSkStroke(lastDrawX, lastDrawY, coords.x, coords.y));
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

// Scanline-free stack flood fill on the canvas pixels (tolerant to anti-aliased edges)
function floodFillSk(startX, startY, hex) {
    const w = skribblCanvas.width;
    const h = skribblCanvas.height;
    const x0 = Math.max(0, Math.min(w - 1, Math.round(startX)));
    const y0 = Math.max(0, Math.min(h - 1, Math.round(startY)));
    const img = skCtx.getImageData(0, 0, w, h);
    const d = img.data;
    const tr = parseInt(hex.slice(1, 3), 16);
    const tg = parseInt(hex.slice(3, 5), 16);
    const tb = parseInt(hex.slice(5, 7), 16);
    const i0 = (y0 * w + x0) * 4;
    const sr = d[i0], sg = d[i0 + 1], sb = d[i0 + 2];
    if (Math.abs(sr - tr) + Math.abs(sg - tg) + Math.abs(sb - tb) < 12) return;

    const tolerance = 60;
    const visited = new Uint8Array(w * h);
    const stack = [y0 * w + x0];
    while (stack.length > 0) {
        const idx = stack.pop();
        if (visited[idx]) continue;
        visited[idx] = 1;
        const o = idx * 4;
        if (Math.abs(d[o] - sr) + Math.abs(d[o + 1] - sg) + Math.abs(d[o + 2] - sb) > tolerance) continue;
        d[o] = tr; d[o + 1] = tg; d[o + 2] = tb; d[o + 3] = 255;
        const x = idx % w;
        if (x > 0) stack.push(idx - 1);
        if (x < w - 1) stack.push(idx + 1);
        if (idx >= w) stack.push(idx - w);
        if (idx < w * (h - 1)) stack.push(idx + w);
    }
    skCtx.putImageData(img, 0, 0);
}

function drawSkStroke(s) {
    if (s.fill) {
        floodFillSk(s.x1, s.y1, s.color);
        return;
    }
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
    clearSkCanvas();
    skLastStatus = null;
    renderSkribblSnapshot(skribblGame.getSnapshot(myPlayerId));
}

function renderSkribblSnapshot(snap) {
    if (!networkManager.isHost) {
        // Clients need the drawer/status locally for the drawing guards
        skribblGame.activeDrawerId = snap.activeDrawerId;
        skribblGame.status = snap.status;
    }
    // A new turn starts with an empty canvas on every client
    if (snap.status === 'CHOOSING' && skLastStatus !== 'CHOOSING') clearSkCanvas();
    skLastStatus = snap.status;

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
        div.innerHTML = `<strong>${esc(p.name)}${p.isBot ? ' 🤖' : ''}</strong><br><span style="color: var(--cyan);">${esc(p.score)} Pkt</span>`;
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
