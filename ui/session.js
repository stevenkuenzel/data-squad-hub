/**
 * DataSquad Hub UI: Sitzung – Beitritt/Wiederverbinden, Zuschauer, Profile, Reaktionen
 * Klassisches Script – teilt den globalen Scope mit den übrigen ui/*.js (Ladereihenfolge siehe index.html).
 */

// ==========================================
// SESSION STATE
// ==========================================
const identities = new Map();    // Host: Wiederverbinden-Schlüssel -> Spieler-ID
const spectators = new Map();    // Host: Spieler-ID -> { id, name, color } (steigen in der nächsten Partie ein)
let roomStarted = false;         // Host: läuft (oder lief) schon ein Spiel in diesem Raum?
let isSpectator = false;         // Client: schaue ich nur zu?
let eveningMode = false;         // Spieleabend-Raum? (gilt für Host und Gäste)
let beamerMode = false;          // Host: reine Anzeige (Beamer) ohne eigene Spielfigur
let padMode = false;             // Client: Handy-Controller statt Spielfeld

function resetSessionState() {
    identities.clear();
    spectators.clear();
    roomStarted = false;
    eveningMode = false;
    beamerMode = false;
    document.body.classList.remove('beamer-mode');
    reconnecting = false;
    setSpectator(false);
    hideReconnectOverlay();
    document.body.classList.remove('evening-active');
    if (typeof resetEveningState === 'function') resetEveningState();
}

// Several game classes keep their own order lists next to the players map
function clearGamePlayers(g) {
    g.players.clear();
    if (Array.isArray(g.playerOrder)) g.playerOrder = [];
    if (Array.isArray(g.turnQueue)) g.turnQueue = [];
}

function nameOfPlayer(id) {
    const g = getActiveGameInstance();
    const p = g.players.get(id) || spectators.get(id);
    return p ? p.name : 'Jemand';
}

// ==========================================
// TOASTS
// ==========================================
function showToast(text) {
    const box = document.getElementById('toast-box');
    if (!box) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    box.appendChild(el);
    setTimeout(() => el.remove(), 4200);
}

// ==========================================
// PROFILES (Avatar + Hut), synchronised from the host
// ==========================================
function broadcastProfiles() {
    if (!networkManager.isHost) return;
    const list = [];
    for (const [id, pr] of playerProfiles) list.push({ id, avatar: pr.avatar, hat: pr.hat });
    networkManager.broadcast('PROFILES', { list });
}

function applyProfiles(list) {
    if (!Array.isArray(list)) return;
    for (const e of list.slice(0, 64)) {
        if (e && typeof e.id === 'string') setProfile(e.id, e.avatar, e.hat);
    }
    if (lobbyScreen.classList.contains('active')) updateLobbyUI();
}

function joinPayload(expectedGame = null) {
    return {
        name: getPlayerName(),
        color: selectedColor,
        avatar: myAvatar,
        hat: myHat,
        key: getRejoinKey(),
        expectedGame
    };
}

// ==========================================
// HOST: JOIN / REJOIN / SPECTATE
// ==========================================
function sendGameStateTo(peerId, playerId, spectator) {
    const g = getActiveGameInstance();
    const send = (type, payload) => networkManager.sendTo(peerId, { type, payload });
    send('START_GAME', {
        gameType: activeGameType,
        snapshot: g.getSnapshot ? g.getSnapshot(playerId) : null,
        spectator,
        evening: eveningMode
    });
    // Turn-based games only push state on changes, so a newcomer needs the current state once
    switch (activeGameType) {
        case 'codenames': send('CN_STATE', codenamesGame.getSnapshot(playerId)); break;
        case 'skribbl':
            send('SK_STATE', skribblGame.getSnapshot(playerId));
            send('SK_SYNC', { strokes: skribblGame.strokes });
            break;
        case 'uno': send('UNO_STATE', unoGame.getSnapshot(playerId)); break;
        case 'roulette': send('ROULETTE_STATE', rouletteGame.getSnapshot(playerId)); break;
    }
    if (eveningMode && evening && evening.phase !== 'PLAYING') send('EVENING_STATE', evening.getSnapshot());
}

function hostHandleJoin(peerId, payload) {
    const key = typeof payload.key === 'string' ? payload.key.slice(0, 64) : '';
    const g = getActiveGameInstance();

    // A returning browser keeps its player id (and thus score, hand, team ...)
    const playerId = (key && identities.get(key)) || peerId;
    if (key) identities.set(key, playerId);
    networkManager.mapPeer(peerId, playerId);
    setProfile(playerId, payload.avatar, payload.hat);

    const info = { gameType: activeGameType, evening: eveningMode };
    const existing = g.players.get(playerId);

    if (existing) {
        // Reconnect: take the seat back from the bot that is playing in the meantime
        const wasOffline = !!existing.offline;
        existing.isBot = false;
        delete existing.offline;
        networkManager.sendTo(peerId, { type: 'ROOM_INFO', payload: info });
        networkManager.sendTo(peerId, { type: 'REJOINED', payload: { playerId } });
        if (roomStarted) sendGameStateTo(peerId, playerId, false);
        else broadcastLobby();
        broadcastProfiles();
        updateLobbyUI();
        if (wasOffline) showToast(`${existing.name} ist wieder da!`);
        return;
    }

    if (spectators.has(playerId)) {
        // Spectator refreshed the page
        networkManager.sendTo(peerId, { type: 'ROOM_INFO', payload: info });
        networkManager.sendTo(peerId, { type: 'REJOINED', payload: { playerId } });
        sendGameStateTo(peerId, playerId, true);
        broadcastProfiles();
        return;
    }

    if (g.players.size + spectators.size >= getMaxPlayers()) {
        networkManager.sendTo(peerId, { type: 'ROOM_FULL', payload: { msg: 'Raum voll.' } });
        return;
    }

    const name = sanitizeName(payload.name);
    const color = getUnusedColor();
    networkManager.sendTo(peerId, { type: 'ROOM_INFO', payload: info });
    networkManager.sendTo(peerId, { type: 'REJOINED', payload: { playerId } });

    if (roomStarted) {
        // Late arrival: watch the running game, play from the next one
        spectators.set(playerId, { id: playerId, name, color });
        sendGameStateTo(peerId, playerId, true);
        broadcastProfiles();
        showToast(`${name} schaut zu und spielt in der nächsten Partie mit.`);
        return;
    }

    g.addPlayer(playerId, name, color, false);
    broadcastLobby();
    broadcastProfiles();
    updateLobbyUI();
}

function hostHandlePeerGone(peerId) {
    const playerId = networkManager.playerIdOf(peerId);
    networkManager.peerPlayer.delete(peerId);
    // A fresh connection may already carry this player again (quick page refresh)
    if (networkManager.isPlayerConnected(playerId)) return;

    if (spectators.delete(playerId)) {
        broadcastProfiles();
        return;
    }
    const g = getActiveGameInstance();
    if (!roomStarted) {
        g.removePlayer(playerId);
        broadcastLobby();
        updateLobbyUI();
        return;
    }
    // Running game: a bot keeps the seat warm until the player comes back
    const p = g.players.get(playerId);
    if (p && !p.isBot) {
        p.offline = true;
        p.isBot = true;
        showToast(`${p.name} hat die Verbindung verloren – ein Bot übernimmt.`);
    }
}

// Spectators join the game instance as soon as a new match starts (any "play again" included)
function promoteSpectatorsInto(g) {
    if (!networkManager.isHost || spectators.size === 0) return;
    const maxP = getMaxPlayers();
    for (const s of spectators.values()) {
        if (g.players.size >= maxP) break;
        g.addPlayer(s.id, s.name, s.color, false);
        if (typeof eveningRoster !== 'undefined' && evening) {
            eveningRoster.set(s.id, { id: s.id, name: s.name, color: s.color, isBot: false });
        }
        networkManager.sendToPlayer(s.id, { type: 'PROMOTED', payload: {} });
        spectators.delete(s.id);
    }
    broadcastProfiles();
}

[
    [curveGame, 'resetMatch'], [codenamesGame, 'startNewGame'], [skribblGame, 'startMatch'],
    [tankGame, 'startMatch'], [octaPongGame, 'startMatch'], [unoGame, 'startMatch'],
    [dodgeballGame, 'startMatch'], [rouletteGame, 'startMatch']
].forEach(([game, method]) => {
    const original = game[method].bind(game);
    game[method] = (...args) => {
        promoteSpectatorsInto(game);
        return original(...args);
    };
});

function setSpectator(flag) {
    isSpectator = flag;
    const banner = document.getElementById('spectator-banner');
    if (banner) banner.style.display = flag ? 'block' : 'none';
}

// ==========================================
// CLIENT: AUTOMATIC RECONNECT
// ==========================================
let reconnecting = false;

function showReconnectOverlay(text) {
    const el = document.getElementById('reconnect-overlay');
    if (!el) return;
    document.getElementById('reconnect-text').textContent = text;
    el.style.display = 'flex';
}

function hideReconnectOverlay() {
    const el = document.getElementById('reconnect-overlay');
    if (el) el.style.display = 'none';
}

async function clientHandleHostLost() {
    if (reconnecting || networkManager.isHost || !networkManager.roomCode) return;
    reconnecting = true;
    const code = networkManager.roomCode;
    const maxAttempts = 24;

    for (let attempt = 1; attempt <= maxAttempts && reconnecting; attempt++) {
        showReconnectOverlay(`Verbindung verloren – verbinde neu … (${attempt}/${maxAttempts})`);
        await new Promise(r => setTimeout(r, 2500));
        if (!reconnecting) return; // user left in the meantime
        try {
            await networkManager.joinRoom(code);
            myPlayerId = networkManager.myPeerId;
            networkManager.sendToHost('JOIN', joinPayload());
            reconnecting = false;
            hideReconnectOverlay();
            showToast('Wieder verbunden!');
            return;
        } catch {
            // host not reachable yet – try again
        }
    }
    if (reconnecting) {
        reconnecting = false;
        hideReconnectOverlay();
        alert('Der Host ist nicht mehr erreichbar.');
        openHub();
    }
}

// ==========================================
// EMOJI REACTIONS
// ==========================================
const REACTIONS = ['👏', '😂', '🔥', '😱', '🪨'];
const lastReactionAt = new Map();

function spawnReaction(emoji, name) {
    const layer = document.getElementById('reaction-layer');
    if (!layer || !REACTIONS.includes(emoji)) return;
    const el = document.createElement('div');
    el.className = 'reaction-float';
    el.style.left = (8 + Math.random() * 84) + '%';
    el.innerHTML = `<span class="reaction-emoji">${esc(emoji)}</span><span class="reaction-name">${esc(name || '')}</span>`;
    layer.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

function hostHandleReaction(playerId, payload) {
    if (!REACTIONS.includes(payload.emoji)) return;
    const now = performance.now();
    if (now - (lastReactionAt.get(playerId) || 0) < 350) return; // anti-spam
    lastReactionAt.set(playerId, now);
    const name = nameOfPlayer(playerId);
    spawnReaction(payload.emoji, name);
    networkManager.broadcast('REACT', { emoji: payload.emoji, name });
}

function sendReaction(emoji) {
    if (networkManager.isHost) {
        hostHandleReaction(myPlayerId, { emoji });
    } else {
        networkManager.sendToHost('REACT', { emoji });
    }
}

const reactionBar = document.getElementById('reaction-bar');
const reactionToggle = document.getElementById('reaction-toggle');
// Auf dem Handy ist die Leiste eingeklappt und schließt sich nach dem Senden wieder
if (reactionBar && reactionToggle) {
    reactionToggle.addEventListener('click', () => reactionBar.classList.toggle('open'));
    reactionBar.addEventListener('click', () => reactionBar.classList.remove('open'));
}
if (reactionBar) {
    REACTIONS.forEach(emoji => {
        const b = document.createElement('button');
        b.className = 'reaction-btn';
        b.textContent = emoji;
        b.addEventListener('click', () => sendReaction(emoji));
        reactionBar.appendChild(b);
    });
}
