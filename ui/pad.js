/**
 * DataSquad Hub UI: Handy-Controller
 * Klassisches Script – teilt den globalen Scope mit den übrigen ui/*.js (Ladereihenfolge siehe index.html).
 *
 * Wer mit dem Handy beitritt (Controller-Modus), sieht statt des Spielfelds nur große Touch-Controller.
 * Die Controller schreiben in dieselben Eingabe-Variablen wie die Tastatur (`keys`, `dbAimAngle`),
 * dadurch läuft der bestehende Eingabe-Versand an den Host (ui/main.js) unverändert weiter.
 */

const padScreen = document.getElementById('pad-screen');
const padBody = document.getElementById('pad-body');
const padStatus = document.getElementById('pad-status');
let padActive = false;      // Controller ist gerade sichtbar (Spielfeld wird dann nicht gezeichnet)
let padBuiltFor = '';       // für welches Spiel der Controller aufgebaut ist
let padWakeLock = null;
let padStatusTimer = null;

if (optPad) optPad.addEventListener('change', () => { padMode = optPad.checked; });
padMode = isPadRequested();

// ----- Eingabe-Bausteine -----
const PAD_KEY_CODES = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft'];

function padReleaseAll() {
    PAD_KEY_CODES.forEach(code => { keys[code] = false; });
    padBody.querySelectorAll('.pad-btn.active').forEach(el => el.classList.remove('active'));
    padBody.querySelectorAll('.pad-knob').forEach(el => { el.style.transform = 'translate(0px, 0px)'; });
}

// Gedrückt-halten-Taste; Pointer-Capture hält die Taste auch bei Fingerwanderung
function padHoldButton(el, onChange) {
    const set = (down) => {
        el.classList.toggle('active', down);
        onChange(down);
        if (down && navigator.vibrate) navigator.vibrate(8);
    };
    el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        try { el.setPointerCapture(e.pointerId); } catch { /* nicht überall möglich */ }
        set(true);
    });
    const up = (e) => { e.preventDefault(); set(false); };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', () => set(false));
    el.addEventListener('contextmenu', e => e.preventDefault());
}

// Analog-Stick: wertet die Auslenkung über padStickToDirs (games/pad.js) aus
function padStick(zone, onMove) {
    const base = zone.querySelector('.pad-base');
    const knob = zone.querySelector('.pad-knob');
    let pointerId = null;

    const move = (clientX, clientY) => {
        const rect = base.getBoundingClientRect();
        const radius = rect.width / 2;
        const d = padStickToDirs(
            clientX - (rect.left + radius),
            clientY - (rect.top + radius),
            radius * 0.7,
            radius * 0.18
        );
        knob.style.transform = `translate(${d.x}px, ${d.y}px)`;
        onMove(d);
    };
    const end = () => {
        pointerId = null;
        knob.style.transform = 'translate(0px, 0px)';
        onMove({ fwd: false, back: false, left: false, right: false, active: false, angle: 0 });
    };

    zone.addEventListener('pointerdown', (e) => {
        if (pointerId !== null) return;
        e.preventDefault();
        pointerId = e.pointerId;
        try { zone.setPointerCapture(e.pointerId); } catch { /* ignorieren */ }
        move(e.clientX, e.clientY);
    });
    zone.addEventListener('pointermove', (e) => {
        if (e.pointerId === pointerId) { e.preventDefault(); move(e.clientX, e.clientY); }
    });
    const up = (e) => { if (e.pointerId === pointerId) end(); };
    zone.addEventListener('pointerup', up);
    zone.addEventListener('pointercancel', up);
    zone.addEventListener('lostpointercapture', up);
}

const stickMarkup = '<div class="pad-stick"><div class="pad-base"><div class="pad-knob"></div></div></div>';

function setDirKeys(d) {
    keys.ArrowUp = d.fwd;
    keys.ArrowDown = d.back;
    keys.ArrowLeft = d.left;
    keys.ArrowRight = d.right;
}

// ----- Controller je Spiel -----
function buildPad(gameType) {
    padReleaseAll();
    padBody.className = 'pad-body pad-' + gameType;
    if (gameType === 'curve' || gameType === 'pong') {
        padBody.innerHTML =
            '<button class="pad-btn pad-half" id="pad-left" type="button">◀</button>' +
            '<button class="pad-btn pad-half" id="pad-right" type="button">▶</button>';
        padHoldButton(document.getElementById('pad-left'), down => { keys.ArrowLeft = down; });
        padHoldButton(document.getElementById('pad-right'), down => { keys.ArrowRight = down; });
    } else if (gameType === 'tank') {
        padBody.innerHTML = `<div class="pad-zone" id="pad-move">${stickMarkup}</div>` +
            '<div class="pad-zone"><button class="pad-btn pad-fire" id="pad-fire" type="button">💥<small>FEUER</small></button></div>';
        padStick(document.getElementById('pad-move'), setDirKeys);
        padHoldButton(document.getElementById('pad-fire'), down => { keys.Space = down; });
    } else if (gameType === 'dodgeball') {
        padBody.innerHTML = `<div class="pad-zone" id="pad-move">${stickMarkup}</div>` +
            '<div class="pad-zone pad-actions">' +
            '<button class="pad-btn pad-fire" id="pad-throw" type="button">📦<small>WURF</small></button>' +
            '<button class="pad-btn pad-dash" id="pad-dash" type="button">🧤<small>FANGEN / DASH</small></button></div>';
        // Der Stick bewegt UND zielt: geworfen wird in die zuletzt gelenkte Richtung
        padStick(document.getElementById('pad-move'), (d) => {
            setDirKeys(d);
            if (d.active) dbAimAngle = d.angle;
        });
        padHoldButton(document.getElementById('pad-throw'), down => { keys.Space = down; });
        padHoldButton(document.getElementById('pad-dash'), down => { keys.ShiftLeft = down; });
    }
    padBuiltFor = gameType;
}

// ----- Anzeige -----
function padStatusText() {
    const g = getActiveGameInstance();
    const me = g.players && g.players.get(myPlayerId);
    if (isSpectator) return '👀 Du schaust zu und spielst in der nächsten Partie mit.';
    if (!me) return '';
    if (g.status === 'COUNTDOWN' || g.status === 'LOBBY') return 'Gleich geht\'s los – such deine Figur auf dem Beamer!';
    if (me.alive === false) return '💀 Ausgeschieden – schau zum Beamer.';
    if (g.status === 'ROUND_OVER' || g.status === 'MATCH_OVER' || g.status === 'GAME_OVER') return 'Runde vorbei – schau zum Beamer.';
    return '';
}

function paintPadHeader() {
    const g = getActiveGameInstance();
    const me = g.players && g.players.get(myPlayerId);
    document.getElementById('pad-name').textContent = me ? me.name : getPlayerName();
    document.getElementById('pad-dot').style.backgroundColor = safeColor(me ? me.color : selectedColor);
    document.getElementById('pad-avatar').textContent = avatarText(myPlayerId);
    document.getElementById('pad-room').textContent = networkManager.roomCode || '';
    padStatus.textContent = padStatusText();
    padStatus.classList.toggle('pad-status-alert', !!(me && me.alive === false));
}

async function padRequestWakeLock() {
    try {
        if (navigator.wakeLock && !padWakeLock) {
            padWakeLock = await navigator.wakeLock.request('screen');
            padWakeLock.addEventListener('release', () => { padWakeLock = null; });
        }
    } catch { /* Display-Sperre ist optional */ }
}

function updatePadVisibility(screenEl) {
    const gameType = Object.keys(gameViews).find(k => gameViews[k] === screenEl);
    const show = padMode && !networkManager.isHost && !!gameType && padHasController(gameType);
    if (show) {
        if (padBuiltFor !== gameType) buildPad(gameType);
        paintPadHeader();
        if (!padStatusTimer) padStatusTimer = setInterval(paintPadHeader, 250);
        padRequestWakeLock();
    } else {
        padReleaseAll();
        padBuiltFor = '';
        if (padStatusTimer) { clearInterval(padStatusTimer); padStatusTimer = null; }
        if (padWakeLock) { padWakeLock.release().catch(() => {}); padWakeLock = null; }
    }
    padActive = show;
    padScreen.style.display = show ? 'flex' : 'none';
    document.body.classList.toggle('pad-active', show);
}

document.getElementById('pad-leave').addEventListener('click', () => {
    if (confirm('Controller verlassen und zum Hub zurückkehren?')) openHub();
});

// Verliert die Seite den Fokus, dürfen keine Tasten hängen bleiben
document.addEventListener('visibilitychange', () => { if (document.hidden) padReleaseAll(); });
window.addEventListener('blur', padReleaseAll);

// Kein Zoomen/Scrollen/Auswählen beim Spielen
padScreen.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
