/**
 * DataSquad Hub UI: Spieleabend – Playlist, Gesamtwertung, Podium & Awards
 * Klassisches Script – teilt den globalen Scope mit den übrigen ui/*.js (Ladereihenfolge siehe index.html).
 */

// ==========================================
// STATE
// ==========================================
let evening = null;                 // Host: EveningSession (Punkte, Verlauf, Awards)
const eveningRoster = new Map();    // Host: alle Teilnehmer des Abends (id -> { id, name, color, isBot })
let eveningFinishing = false;       // Host: Spiel ist vorbei, kurze Pause vor der Wertung
let eveningDelay = 0;
let eveningPendingResult = null;
let eveningView = null;             // alle: letzter empfangener Stand der Gesamtwertung

// Reihenfolge + Auswahl der Playlist (Host, Lobby)
let eveningOrder = ['curve', 'codenames', 'dodgeball', 'tank', 'uno', 'skribbl', 'pong', 'roulette', 'hotel'];
const eveningEnabled = new Set(['curve', 'codenames', 'dodgeball']);
let eveningCatchUp = false;

const eveningOverlay = document.getElementById('evening-overlay');

function resetEveningState() {
    evening = null;
    eveningRoster.clear();
    eveningFinishing = false;
    eveningPendingResult = null;
    eveningView = null;
    if (eveningOverlay) eveningOverlay.style.display = 'none';
}

// ==========================================
// LOBBY PANEL: PLAYLIST BUILDER
// ==========================================
function renderEveningPanel() {
    const panel = document.getElementById('evening-settings');
    const list = document.getElementById('evening-playlist');
    if (!panel || !list) return;
    list.innerHTML = '';

    eveningOrder.forEach((type, idx) => {
        const def = EVENING_GAMES[type];
        const on = eveningEnabled.has(type);
        const li = document.createElement('li');
        li.className = 'ev-pick' + (on ? ' on' : '');

        const check = document.createElement('input');
        check.type = 'checkbox';
        check.checked = on;
        check.addEventListener('change', () => {
            if (check.checked) eveningEnabled.add(type); else eveningEnabled.delete(type);
            renderEveningPanel();
        });

        const label = document.createElement('span');
        label.className = 'ev-pick-name';
        const pos = on ? eveningOrder.filter(t => eveningEnabled.has(t)).indexOf(type) + 1 : '–';
        label.textContent = `${pos}. ${def.icon} ${def.name}`;

        const up = document.createElement('button');
        up.className = 'icon-btn';
        up.textContent = '▲';
        up.disabled = idx === 0;
        up.addEventListener('click', () => {
            [eveningOrder[idx - 1], eveningOrder[idx]] = [eveningOrder[idx], eveningOrder[idx - 1]];
            renderEveningPanel();
        });
        const down = document.createElement('button');
        down.className = 'icon-btn';
        down.textContent = '▼';
        down.disabled = idx === eveningOrder.length - 1;
        down.addEventListener('click', () => {
            [eveningOrder[idx + 1], eveningOrder[idx]] = [eveningOrder[idx], eveningOrder[idx + 1]];
            renderEveningPanel();
        });

        li.append(check, label, up, down);
        list.appendChild(li);
    });

    const catchBtn = document.getElementById('btn-evening-catchup');
    if (catchBtn) {
        catchBtn.textContent = eveningCatchUp ? 'AN' : 'AUS';
        catchBtn.classList.toggle('btn-primary', eveningCatchUp);
        catchBtn.classList.toggle('btn-secondary', !eveningCatchUp);
    }
}

const btnEveningCatchUp = document.getElementById('btn-evening-catchup');
if (btnEveningCatchUp) {
    btnEveningCatchUp.addEventListener('click', () => {
        eveningCatchUp = !eveningCatchUp;
        renderEveningPanel();
    });
}

// ==========================================
// HOST: START / NEXT GAME
// ==========================================
function startEvening() {
    if (!networkManager.isHost) return;
    const playlist = eveningOrder.filter(t => eveningEnabled.has(t));
    if (playlist.length === 0) {
        alert('Bitte wähle mindestens ein Spiel für den Abend aus.');
        return;
    }
    const lobbyPlayers = Array.from(getActiveGameInstance().players.values());
    if (lobbyPlayers.length < 2) {
        alert('Für einen Spieleabend braucht ihr mindestens 2 Teilnehmer (Bots zählen mit).');
        return;
    }

    resetEveningState();
    evening = new EveningSession();
    evening.catchUpEnabled = eveningCatchUp;
    for (const p of lobbyPlayers) {
        eveningRoster.set(p.id, { id: p.id, name: p.name, color: p.color, isBot: !!p.isBot });
    }
    evening.start(playlist, rosterWithProfiles());
    launchEveningGame(playlist[0]);
}

function rosterWithProfiles() {
    return Array.from(eveningRoster.values()).map(r => {
        const pr = playerProfiles.get(r.id) || {};
        return { ...r, avatar: pr.avatar || '', hat: pr.hat || '' };
    });
}

function launchEveningGame(type) {
    activeGameType = type;
    const g = getActiveGameInstance();

    // Latecomers who watched so far are full participants from now on
    for (const s of spectators.values()) {
        eveningRoster.set(s.id, { id: s.id, name: s.name, color: s.color, isBot: false });
        networkManager.sendToPlayer(s.id, { type: 'PROMOTED', payload: {} });
    }
    spectators.clear();

    clearGamePlayers(g);
    for (const r of eveningRoster.values()) {
        // Players who are gone for now are played by a bot until they reconnect
        const online = r.isBot || r.id === myPlayerId || networkManager.isPlayerConnected(r.id);
        const p = g.addPlayer(r.id, r.name, r.color, r.isBot || !online);
        if (p && !r.isBot && !online) p.offline = true;
    }
    evening.syncRoster(rosterWithProfiles());

    g.handicaps = evening.catchUpMap();
    if (typeof g.shuffleTeams === 'function') g.shuffleTeams();

    setupLobbyForGame(type);
    broadcastLobby();
    broadcastProfiles();
    networkManager.broadcast('START_GAME', {
        gameType: type,
        snapshot: g.getSnapshot ? g.getSnapshot() : null,
        evening: true
    });
    launchGameView(type, true);
    broadcastEvening();
}

function advanceEvening() {
    if (!networkManager.isHost || !evening) return;
    const type = evening.next();
    if (type) launchEveningGame(type);
}

// Host: watch the running game; when it is over, score it after a short pause
function eveningTick(dt) {
    if (!evening) return;
    if (evening.phase === 'PLAYING' && !eveningFinishing) {
        const result = extractGameResult(activeGameType, getActiveGameInstance());
        if (result) {
            eveningFinishing = true;
            eveningDelay = 3.5; // let everybody see the final game screen first
            eveningPendingResult = { ...result, stats: JSON.parse(JSON.stringify(result.stats || {})) };
        }
    }
    if (eveningFinishing) {
        eveningDelay -= dt;
        if (eveningDelay <= 0) {
            eveningFinishing = false;
            const { unlocked } = evening.recordResult(activeGameType, eveningPendingResult);
            eveningPendingResult = null;
            unlocked.forEach(u => showToast(`${u.icon} ${nameOfEveningPlayer(u.playerId)}: ${u.title}`));
            broadcastEvening();
        }
    }
}

function nameOfEveningPlayer(id) {
    const r = eveningRoster.get(id);
    return r ? r.name : 'Jemand';
}

function broadcastEvening() {
    if (!networkManager.isHost || !evening) return;
    const snap = evening.getSnapshot();
    networkManager.broadcast('EVENING_STATE', snap);
    handleEveningState(snap);
}

function backToEveningLobby() {
    if (!networkManager.isHost || !evening) return;
    evening.reset();
    roomStarted = false;
    activeGameType = 'curve';
    const g = getActiveGameInstance();
    clearGamePlayers(g);
    for (const s of spectators.values()) {
        eveningRoster.set(s.id, { id: s.id, name: s.name, color: s.color, isBot: false });
        networkManager.sendToPlayer(s.id, { type: 'PROMOTED', payload: {} });
    }
    spectators.clear();
    for (const r of eveningRoster.values()) {
        const online = r.isBot || r.id === myPlayerId || networkManager.isPlayerConnected(r.id);
        if (online) g.addPlayer(r.id, r.name, r.color, r.isBot);
    }
    eveningRoster.clear();
    networkManager.broadcast('BACK_TO_LOBBY', {});
    handleBackToLobby();
    broadcastLobby();
}

function handleBackToLobby() {
    eveningView = null;
    document.body.classList.remove('evening-active');
    setSpectator(false);
    if (eveningOverlay) eveningOverlay.style.display = 'none';
    setupLobbyForGame('curve');
    updateLobbyUI();
    updateGameSettingsVisibility();
    renderEveningPanel();
    showScreen(lobbyScreen);
}

// ==========================================
// OVERLAY: STANDINGS, PODIUM, AWARDS (all clients)
// ==========================================
function handleEveningState(snap) {
    eveningView = snap;
    renderEveningOverlay(snap);
}

function evRow(t, idx) {
    const delta = t.last > 0 ? `<span class="ev-delta">+${esc(t.last)}</span>` : '';
    const ach = (t.achievements || []).map(a => `<span title="${esc(a.title)}: ${esc(a.desc)}">${esc(a.icon)}</span>`).join('');
    return `<li class="ev-row rank-${Math.min(t.rank, 4)}" style="animation-delay:${idx * 0.08}s">
        <span class="ev-rank">${esc(t.rank)}</span>
        <span class="ev-dot" style="background:${safeColor(t.color)}"></span>
        ${avatarHtml(t.id, t.isBot)}
        <span class="ev-name">${esc(t.name)}</span>
        <span class="ev-ach">${ach}</span>
        ${delta}
        <strong class="ev-total">${esc(t.points)}</strong>
    </li>`;
}

function renderEveningOverlay(snap) {
    if (!eveningOverlay) return;
    if (!snap || snap.phase === 'PLAYING' || snap.phase === 'LOBBY') {
        eveningOverlay.style.display = 'none';
        return;
    }
    const finished = snap.phase === 'FINISHED';
    const title = finished
        ? '🏆 Spieleabend beendet – Gesamtwertung'
        : `${snap.lastGame ? snap.lastGame.icon + ' ' + snap.lastGame.name : ''} – Zwischenstand`;
    document.getElementById('evening-title').textContent = title;

    document.getElementById('evening-progress').innerHTML = snap.playlist.map((g, i) => {
        const cls = i < snap.index || (finished && i <= snap.index) ? 'done' : (i === snap.index + 1 ? 'next' : '');
        return `<span class="ev-chip ${cls}">${esc(g.icon)} ${esc(g.name)}</span>`;
    }).join('');

    // Podium (top 3) with the final results
    const podium = document.getElementById('evening-podium');
    if (finished) {
        const top = snap.standings.slice(0, 3);
        const order = [top[1], top[0], top[2]].filter(Boolean);
        podium.innerHTML = order.map(t => `<div class="podium-col place-${Math.min(t.rank, 3)}">
            <div class="podium-who">${avatarHtml(t.id, t.isBot)}<span>${esc(t.name)}</span></div>
            <div class="podium-block">${t.rank === 1 ? '🥇' : t.rank === 2 ? '🥈' : '🥉'}<small>${esc(t.points)} Pkt</small></div>
        </div>`).join('');
        podium.style.display = 'flex';
    } else {
        podium.style.display = 'none';
        podium.innerHTML = '';
    }

    document.getElementById('evening-standings').innerHTML = snap.standings.map(evRow).join('');

    // Award ceremony
    const awardsEl = document.getElementById('evening-awards');
    const byId = Object.fromEntries(snap.standings.map(t => [t.id, t]));
    if (finished && snap.awards.length > 0) {
        awardsEl.innerHTML = '<h3>🎖️ Die Awards des Abends</h3>' + snap.awards.map((a, i) => {
            const t = byId[a.playerId];
            return `<div class="award-card" style="animation-delay:${1 + i * 0.7}s">
                <span class="award-icon">${esc(a.icon)}</span>
                <div><div class="award-title">${esc(a.title)}</div>
                <div class="award-who">${t ? avatarHtml(t.id, t.isBot) + ' ' + esc(t.name) : ''} · ${esc(a.value)} ${esc(a.unit)}</div></div>
            </div>`;
        }).join('');
        awardsEl.style.display = 'block';
    } else {
        awardsEl.style.display = 'none';
        awardsEl.innerHTML = '';
    }

    // All achievements unlocked tonight
    const achEl = document.getElementById('evening-achievements');
    const unlocked = snap.standings.flatMap(t => (t.achievements || []).map(a => ({ ...a, who: t.name })));
    if (unlocked.length > 0) {
        achEl.innerHTML = '<h3>🏅 Erfolge</h3>' + unlocked.map(a =>
            `<span class="ev-chip ach" title="${esc(a.desc)}">${esc(a.icon)} ${esc(a.title)} · ${esc(a.who)}</span>`).join('');
        achEl.style.display = 'block';
    } else {
        achEl.style.display = 'none';
        achEl.innerHTML = '';
    }

    // Host controls vs. waiting notice
    const btnNext = document.getElementById('btn-evening-next');
    const btnEnd = document.getElementById('btn-evening-lobby');
    const waitEl = document.getElementById('evening-wait');
    const isHost = networkManager.isHost;
    btnNext.style.display = (isHost && !finished && snap.next) ? 'inline-flex' : 'none';
    btnNext.textContent = snap.next ? `Weiter: ${snap.next.icon} ${snap.next.name} ▶` : 'Weiter ▶';
    btnEnd.style.display = (isHost && finished) ? 'inline-flex' : 'none';
    waitEl.style.display = isHost ? 'none' : 'block';
    waitEl.textContent = finished ? 'Warte auf den Host …' : 'Der Host startet gleich das nächste Spiel …';
    if (snap.catchUp && !finished) waitEl.textContent += ' (Aufholmechanik aktiv)';

    eveningOverlay.style.display = 'flex';
}

const btnEveningNext = document.getElementById('btn-evening-next');
if (btnEveningNext) btnEveningNext.addEventListener('click', advanceEvening);
const btnEveningLobby = document.getElementById('btn-evening-lobby');
if (btnEveningLobby) btnEveningLobby.addEventListener('click', backToEveningLobby);
