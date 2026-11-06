/**
 * DataSquad Hub UI: Hotel-Tycoon – Steuerung, Panels und Netzwerk
 * Klassisches Script – teilt den globalen Scope mit den übrigen ui/*.js (Ladereihenfolge siehe index.html).
 * Alle Informationen stehen zusätzlich als Text in den Panels (Barrierefreiheit), die Szene ist nur Darstellung.
 */

// ==========================================
// GAME 9: HOTEL-TYCOON
// ==========================================
const hotelStage = document.getElementById('hotel-stage');
const hotelCanvasHost = document.getElementById('hotel-canvas-host');
const hotelCanvas2d = document.getElementById('hotel-canvas-2d');
const hotelLoading = document.getElementById('hotel-loading');
const hotelBanner = document.getElementById('hotel-banner');
const hotelFloaters = document.getElementById('hotel-floaters');
const hotelRosterEl = document.getElementById('hotel-roster');
const hotelActionsEl = document.getElementById('hotel-actions');
const hotelLogEl = document.getElementById('hotel-log');
const hotelStatusText = document.getElementById('hotel-status-text');
const hotelTurnTimer = document.getElementById('hotel-turn-timer');
const hotelWinnerOverlay = document.getElementById('hotel-winner-overlay');
const hotelWinnerText = document.getElementById('hotel-winner-text');
const btnPlayAgainHotel = document.querySelector('.btn-play-again-hotel');
const hotelBtnFollow = document.getElementById('hotel-btn-follow');
const hotelBtnView = document.getElementById('hotel-btn-view');

let hotelScene = null;
let hotel2d = null;
let hotelMode = ''; // '3d' | '2d'
let hotelModeBusy = false;
let hotelUse3D = true;
let hotelFollow = true;
let hotelLatest = null;
let hotelAnimUntil = 0;
let hotelSeenDice = 0;
let hotelInitDone = false;
let hotelSeenEvent = -1;
let hotelPanelTimer = null;
let hotelPanelSig = '';

try {
    hotelUse3D = localStorage.getItem('hotel3d') !== 'off';
} catch { /* Speicher gesperrt: Standard */ }

const hotelFmt = (n) => Number(n || 0).toLocaleString('de-DE') + ' €';

function broadcastHotelState() {
    if (!networkManager.isHost) return;
    const snap = hotelGame.getSnapshot();
    networkManager.broadcast('HOTEL_STATE', snap);
    renderHotelSnapshot(snap);
}

function hotelAct(action, arg) {
    if (window.soundFX) window.soundFX.playClick();
    if (networkManager.isHost) {
        if (hotelGame.act(myPlayerId, action, arg)) broadcastHotelState();
    } else {
        networkManager.sendToHost('HOTEL_ACT', { action, arg });
    }
}

// ---------- 3D / 2D Umschaltung ----------
function hotelShowMode(mode) {
    hotelMode = mode;
    hotelCanvasHost.style.display = mode === '3d' ? 'block' : 'none';
    hotelCanvas2d.style.display = mode === '2d' ? 'block' : 'none';
    hotelLoading.style.display = 'none';
    if (hotelBtnView) {
        hotelBtnView.textContent = mode === '3d' ? '🧊' : '🗺️';
        hotelBtnView.title = mode === '3d' ? 'Zur flachen 2D-Karte wechseln' : 'Zur 3D-Ansicht wechseln';
    }
    if (hotelBtnFollow) hotelBtnFollow.style.display = mode === '3d' ? '' : 'none';
}

async function hotelEnsureRenderer() {
    if (hotelModeBusy) return;
    const want3D = hotelUse3D && hotelWebGLAvailable();
    if (want3D && hotelMode === '3d' && hotelScene) return;
    if (!want3D && hotelMode === '2d' && hotel2d) return;
    hotelModeBusy = true;
    try {
        if (want3D) {
            hotelLoading.style.display = 'flex';
            try {
                await loadThree();
                if (!hotelScene) {
                    hotelScene = new HotelScene(hotelCanvasHost, {
                        follow: hotelFollow,
                        onSlow: () => {
                            showToast('Die 3D-Ansicht läuft auf diesem Gerät zäh – wechsle zur 2D-Karte.');
                            hotelUse3D = false;
                            hotelEnsureRenderer();
                        }
                    });
                }
                hotelShowMode('3d');
                hotelScene.resize();
                if (hotelLatest) hotelScene.setState(hotelLatest);
                return;
            } catch (err) {
                console.warn('Hotel: 3D nicht verfügbar, nutze 2D', err);
                if (hotelScene) { hotelScene.destroy(); hotelScene = null; }
            }
        }
        if (hotelScene) { hotelScene.stop(); }
        if (!hotel2d) hotel2d = new Hotel2D(hotelCanvas2d);
        hotelShowMode('2d');
        if (hotelLatest) hotel2d.setState(hotelLatest);
    } finally {
        hotelModeBusy = false;
    }
}

if (hotelBtnView) {
    hotelBtnView.addEventListener('click', () => {
        hotelUse3D = hotelMode !== '3d';
        try { localStorage.setItem('hotel3d', hotelUse3D ? 'on' : 'off'); } catch { /* ignorieren */ }
        if (window.soundFX) window.soundFX.playClick();
        hotelEnsureRenderer();
    });
}

if (hotelBtnFollow) {
    hotelBtnFollow.addEventListener('click', () => {
        hotelFollow = !hotelFollow;
        hotelBtnFollow.setAttribute('aria-pressed', String(hotelFollow));
        hotelBtnFollow.classList.toggle('active', hotelFollow);
        if (hotelScene) hotelScene.setFollow(hotelFollow);
    });
    hotelBtnFollow.classList.add('active');
}

// ---------- Snapshot anzeigen ----------
function renderHotelSnapshot(snap) {
    if (!snap) return;
    hotelLatest = snap;

    // Szene sofort füttern, damit Würfel und Auto loslegen
    if (hotelMode === '3d' && hotelScene) hotelScene.setState(snap);
    else if (hotelMode === '2d' && hotel2d) hotel2d.setState(snap);
    else hotelEnsureRenderer();

    // Neue Würfe: Anzeige der Ergebnisse (Geld, Log, Knöpfe) bis zum Ende der Animation zurückhalten.
    // Der erste Stand einer laufenden Partie (Beitritt/Rejoin) wird ohne Animation übernommen.
    if (snap.status !== 'LOBBY') {
        if (!hotelInitDone) {
            hotelInitDone = true;
            hotelSeenDice = snap.dice ? snap.dice.seq : 0;
        } else if (snap.dice && snap.dice.seq > hotelSeenDice) {
            hotelSeenDice = snap.dice.seq;
            const lm = snap.lastMove;
            const steps = lm ? (lm.to - lm.from + HOTEL_FIELD_COUNT_UI) % HOTEL_FIELD_COUNT_UI : 0;
            hotelAnimUntil = (hotelReducedMotion() || hotelMode === '2d') ? 0 : Date.now() + 1500 + steps * 220 + 450;
            if (window.soundFX) window.soundFX.playDie();
        }
    }
    hotelSchedulePanels();
}

function hotelSchedulePanels() {
    clearTimeout(hotelPanelTimer);
    const wait = hotelAnimUntil - Date.now();
    if (wait > 0) {
        hotelPanelTimer = setTimeout(() => hotelApplyPanels(hotelLatest), wait + 20);
    } else {
        hotelApplyPanels(hotelLatest);
    }
}

function hotelPhaseText(snap, cur) {
    const who = cur ? esc(cur.name) : 'Jemand';
    switch (snap.phase) {
        case 'BUY': return `${who} überlegt, ob das Grundstück gekauft wird …`;
        case 'BUILD': return `${who} plant einen Bau …`;
        case 'PERMIT': return `${who} wählt eine Baustelle …`;
        case 'DEBT': return `${who} kann nicht zahlen und muss Hotels verkaufen …`;
        default: return `${who} würfelt …`;
    }
}

function hotelApplyPanels(snap) {
    if (!snap) return;
    const players = snap.players;
    const byId = new Map(players.map(p => [p.id, p]));
    const cur = byId.get(snap.turnId) || null;
    const me = byId.get(myPlayerId) || null;
    const myTurn = snap.status === 'PLAYING' && !!cur && cur.id === myPlayerId && !isSpectator;

    // ---- HUD ----
    hotelStatusText.textContent = snap.status === 'LOBBY'
        ? 'Wartet auf Spieler'
        : `Runde ${Math.min(snap.round, snap.maxRounds)} / ${snap.maxRounds}`;
    hotelTurnTimer.textContent = snap.status !== 'PLAYING' ? '–' : (cur && cur.isBot ? '🤖' : `${snap.turnTimer} s`);

    // ---- Banner ----
    let banner = '';
    if (snap.status === 'LOBBY') banner = '⏳ Warte auf mindestens 2 Spieler …';
    else if (snap.status === 'PLAYING' && cur) banner = myTurn ? '🎲 Du bist dran!' : `${cur.name} ist dran`;
    hotelBanner.textContent = banner;
    hotelBanner.classList.toggle('mine', myTurn);
    hotelBanner.style.display = banner ? 'block' : 'none';
    hotelBanner.style.borderColor = cur ? safeColor(cur.color) : '';

    // ---- Roster ----
    const stagesOf = (id) => snap.lots.filter(l => l.owner === id);
    hotelRosterEl.innerHTML = players.map(p => {
        const owned = stagesOf(p.id);
        const stars = owned.reduce((sum, l) => sum + l.stage, 0);
        const cls = ['hotel-pl'];
        if (p.id === snap.turnId && snap.status === 'PLAYING') cls.push('turn');
        if (!p.alive) cls.push('out');
        if (p.id === myPlayerId) cls.push('me');
        return `<div class="${cls.join(' ')}" style="--pc:${safeColor(p.color)}">
            <span class="hotel-pl-dot"></span>
            ${avatarHtml(p.id, p.isBot)}
            <strong class="hotel-pl-name">${esc(p.name)}${p.alive ? '' : ' 💥'}${p.freeEntry ? ' 🎟️' : ''}</strong>
            <span class="hotel-pl-money">${hotelFmt(p.money)}</span>
            <small class="hotel-pl-sub">Vermögen ${hotelFmt(p.net)} · 🏨 ${owned.length} · ${stars}★</small>
        </div>`;
    }).join('');

    // ---- Log ----
    hotelLogEl.innerHTML = (snap.logs || []).map(l => `<div class="hotel-log-line">${esc(l)}</div>`).join('');

    // ---- Schwebende Geldzahlen ----
    hotelSpawnFloaters(snap);

    // ---- Aktionen ----
    const owned = me ? snap.lots.filter(l => l.owner === me.id) : [];
    const sig = [snap.status, snap.phase, snap.turnId, JSON.stringify(snap.pending), myTurn, me ? me.money : 0,
        owned.map(l => l.id + ':' + l.stage).join(','), snap.winner ? snap.winner.id : ''].join('|');
    if (sig !== hotelPanelSig) {
        hotelPanelSig = sig;
        hotelActionsEl.innerHTML = hotelActionsHtml(snap, cur, me, myTurn, owned);
        hotelBindActions(snap);
    }

    // ---- Gewinner ----
    if (snap.status === 'GAME_OVER') {
        hotelWinnerOverlay.style.display = 'block';
        const ranking = players.slice().sort((a, b) => (b.alive - a.alive) || (b.net - a.net));
        hotelWinnerText.textContent = snap.winner ? `🏆 ${snap.winner.name.toUpperCase()} GEWINNT!` : 'SPIEL ENDE';
        let list = hotelWinnerOverlay.querySelector('.hotel-final-list');
        if (!list) {
            list = document.createElement('ol');
            list.className = 'hotel-final-list';
            hotelWinnerText.insertAdjacentElement('afterend', list);
        }
        list.innerHTML = ranking.map(p => `<li><span class="hotel-pl-dot" style="background:${safeColor(p.color)}"></span>${esc(p.name)} – ${p.alive ? hotelFmt(p.net) : 'pleite'}</li>`).join('');
        if (btnPlayAgainHotel) btnPlayAgainHotel.style.display = networkManager.isHost ? 'block' : 'none';
        if (!hotelWinnerOverlay.dataset.shown) {
            hotelWinnerOverlay.dataset.shown = '1';
            if (window.soundFX) window.soundFX.playWin();
        }
    } else {
        hotelWinnerOverlay.style.display = 'none';
        delete hotelWinnerOverlay.dataset.shown;
    }
}

function hotelActionsHtml(snap, cur, me, myTurn, owned) {
    if (snap.status === 'LOBBY') return '<div class="hotel-hint">Das Spiel startet, sobald mindestens zwei Spieler dabei sind.</div>';
    if (snap.status === 'GAME_OVER') return '<div class="hotel-hint">Die Partie ist vorbei.</div>';
    if (isSpectator || !me) return `<div class="hotel-hint">👀 Du schaust zu. ${hotelPhaseText(snap, cur)}</div>`;
    if (!me.alive) return `<div class="hotel-hint">💥 Du bist pleite und schaust zu. ${hotelPhaseText(snap, cur)}</div>`;
    if (!myTurn) return `<div class="hotel-hint">⏳ ${hotelPhaseText(snap, cur)}</div>`;

    const pend = snap.pending;
    switch (snap.phase) {
        case 'ROLL':
            return `<div class="hotel-hint">Du bist dran. Würfle und fahre los!</div>
                <button class="btn btn-primary hotel-act" data-act="roll">🎲 Würfeln</button>`;
        case 'BUY': {
            const lot = HOTEL_LOTS[pend.lot];
            return `<div class="hotel-card"><strong>${esc(lot.name)}</strong>
                <span>${pend.forced ? 'Fremdes Land ohne Gebäude – Pflichtkauf zum halben Preis' : 'Freies Grundstück'}</span>
                <span>Preis: <b>${hotelFmt(pend.price)}</b> · Du hast ${hotelFmt(me.money)}</span></div>
                <button class="btn btn-primary hotel-act" data-act="buy">🏷️ Kaufen (${hotelFmt(pend.price)})</button>
                ${pend.forced ? '' : '<button class="btn btn-secondary hotel-act" data-act="decline">Nein danke</button>'}`;
        }
        case 'BUILD': {
            const buttons = pend.options.map((o, i) => {
                const lot = HOTEL_LOTS[o.lot];
                const label = o.kind === 'stage'
                    ? `🏗️ ${HOTEL_STAGES[snap.lots[o.lot].stage].name} bauen (${hotelStars(snap.lots[o.lot].stage + 1)})`
                    : '🚪 Eingang eröffnen';
                return `<button class="btn btn-primary hotel-act" data-act="build" data-arg="${i}">${esc(label)} – ${esc(lot.name)} · ${hotelFmt(o.cost)}</button>`;
            }).join('');
            return `<div class="hotel-hint">Du stehst auf deinem Grundstück. Jetzt bauen?</div>${buttons}
                <button class="btn btn-secondary hotel-act" data-act="skip">Überspringen</button>`;
        }
        case 'PERMIT': {
            const modeText = { normal: 'Baugenehmigung erteilt – du musst bauen.', free: 'Kostenlos bauen!', double: 'Genehmigt, aber doppelte Kosten – du musst bauen.' }[pend.mode] || '';
            const buttons = pend.options.map(o => {
                const lot = HOTEL_LOTS[o.lot];
                const next = snap.lots[o.lot].stage;
                return `<button class="btn btn-primary hotel-act" data-act="permit" data-arg="${o.lot}">🏗️ ${esc(lot.name)}: ${esc(HOTEL_STAGES[next].name)} (${hotelStars(next + 1)}) – ${o.cost === 0 ? 'gratis' : hotelFmt(o.cost)}</button>`;
            }).join('');
            return `<div class="hotel-hint">📋 ${modeText}</div>${buttons}`;
        }
        case 'DEBT': {
            const creditor = pend.creditor ? snap.players.find(p => p.id === pend.creditor) : null;
            const sell = owned.map(l => `<button class="btn btn-secondary hotel-act" data-act="sell" data-arg="${l.id}">🔨 ${esc(HOTEL_LOTS[l.id].name)} ${l.stage > 0 ? hotelStars(l.stage) : '(Land)'} verkaufen · +${hotelFmt(hotelGame.sellValue(l.id))}</button>`).join('');
            return `<div class="hotel-card debt"><strong>Du schuldest ${hotelFmt(pend.amount)}</strong>
                <span>an ${creditor ? esc(creditor.name) : 'die Bank'} · Du hast ${hotelFmt(me.money)}</span></div>
                ${sell}<button class="btn btn-danger hotel-act" data-act="giveup">Aufgeben</button>`;
        }
        default: return '';
    }
}

function hotelBindActions() {
    hotelActionsEl.querySelectorAll('.hotel-act').forEach(btn => {
        btn.addEventListener('click', () => {
            const arg = btn.dataset.arg;
            hotelAct(btn.dataset.act, arg === undefined ? undefined : parseInt(arg, 10));
        });
    });
}

// ---------- Schwebende Zahlen ----------
function hotelSpawnFloaters(snap) {
    const events = snap.events || [];
    if (hotelSeenEvent < 0) {
        // erster Blick (z. B. Rejoin): nichts nachträglich abspielen
        hotelSeenEvent = events.length ? events[events.length - 1].seq : 0;
        return;
    }
    for (const ev of events) {
        if (ev.seq <= hotelSeenEvent) continue;
        hotelSeenEvent = ev.seq;
        if (ev.type !== 'money' || !ev.amount) continue;
        const renderer = hotelMode === '3d' ? hotelScene : hotel2d;
        if (!renderer) continue;
        const pos = renderer.fieldToScreen(ev.field);
        if (!pos || pos.visible === false) continue;
        const pl = snap.players.find(p => p.id === ev.pid);
        const el = document.createElement('div');
        el.className = 'hotel-floater ' + (ev.amount > 0 ? 'plus' : 'minus');
        el.textContent = (ev.amount > 0 ? '+' : '−') + Math.abs(ev.amount).toLocaleString('de-DE');
        if (pl) el.style.borderColor = safeColor(pl.color);
        el.style.left = pos.x + 'px';
        el.style.top = pos.y + 'px';
        hotelFloaters.appendChild(el);
        setTimeout(() => el.remove(), 2200);
    }
}

// ---------- Nochmal spielen ----------
if (btnPlayAgainHotel) {
    btnPlayAgainHotel.addEventListener('click', () => {
        hotelWinnerOverlay.style.display = 'none';
        if (networkManager.isHost) {
            hotelGame.startMatch();
            broadcastHotelState();
        }
    });
}

// Beim Betreten eines Hotel-Raums alles zurücksetzen (neuer Raum = neue Sequenzen, neue Szene)
function hotelResetView() {
    clearTimeout(hotelPanelTimer);
    if (hotelScene) { hotelScene.destroy(); hotelScene = null; }
    hotelMode = '';
    hotelModeBusy = false;
    hotelLatest = null;
    hotelAnimUntil = 0;
    hotelSeenDice = 0;
    hotelInitDone = false;
    hotelSeenEvent = -1;
    hotelPanelSig = '';
    hotelFloaters.innerHTML = '';
    hotelWinnerOverlay.style.display = 'none';
    delete hotelWinnerOverlay.dataset.shown;
}
