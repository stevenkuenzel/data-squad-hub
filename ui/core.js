/**
 * DataSquad Hub Controller: Universal Multi-Game Router & Network Coordinator
 * Games: Curve Arena, Codenames, Montagsmaler (Skribbl), Tank Trouble, Octa-Pong
 */

// DOM Elements - Hub & Navigation
const homeScreen = document.getElementById('home-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const playerNameInput = document.getElementById('player-name');
const colorPickerContainer = document.getElementById('color-picker');
const joinCodeInput = document.getElementById('join-code-input');
const btnJoinRoom = document.getElementById('btn-join-room');

// Universal Lobby Elements
const lobbyGameTitle = document.getElementById('lobby-game-title');
const lobbyRoleText = document.getElementById('lobby-role-text');
const displayRoomCode = document.getElementById('display-room-code');
const btnCopyLink = document.getElementById('btn-copy-link');
const lobbyPlayerList = document.getElementById('lobby-player-list');
const playerCount = document.getElementById('player-count');
const lobbyMaxPlayers = document.getElementById('lobby-max-players');
const btnAddBot = document.getElementById('btn-add-bot');
const btnStartGame = document.getElementById('btn-start-game');
const btnLeaveLobby = document.getElementById('btn-leave-lobby');
const hostLobbyControls = document.getElementById('host-lobby-controls');
const clientLobbyNotice = document.getElementById('client-lobby-notice');
const curveSettings = document.getElementById('curve-settings');
const btnToggleGaps = document.getElementById('btn-toggle-gaps');

// Game Views
const gameViews = {
    curve: document.getElementById('game-curve'),
    codenames: document.getElementById('game-codenames'),
    skribbl: document.getElementById('game-skribbl'),
    tank: document.getElementById('game-tank'),
    pong: document.getElementById('game-pong'),
    uno: document.getElementById('game-uno'),
    dodgeball: document.getElementById('game-dodgeball'),
    roulette: document.getElementById('game-roulette')
};

// State
let activeGameType = 'curve';
let myPlayerId = 'p-' + Math.floor(Math.random() * 100000);
const MAX_HUB_PLAYERS = 12;
const MAX_NAME_LENGTH = 16;
const EIGHT_PLAYER_GAMES = new Set(['tank', 'pong', 'uno', 'dodgeball', 'roulette']);

function getMaxPlayers(gameType = activeGameType) {
    if (typeof eveningMode !== 'undefined' && eveningMode) return MAX_HUB_PLAYERS;
    return EIGHT_PLAYER_GAMES.has(gameType) ? 8 : MAX_HUB_PLAYERS;
}

// Escape any text before it goes into innerHTML (names, logs, clues come from other peers)
function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Only allow plain hex colors in style attributes
function safeColor(value) {
    return /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : '#cccccc';
}

function sanitizeName(value) {
    const name = (typeof value === 'string' ? value : '')
        // eslint-disable-next-line no-control-regex -- stripping control chars is intended
        .replace(/[\u0000-\u001f\u007f<>]/g, '')
        .trim()
        .slice(0, MAX_NAME_LENGTH);
    return name || 'Player';
}


// Color Setup
const randomInitialColorIdx = Math.floor(Math.random() * PLAYER_COLORS.length);
let selectedColor = PLAYER_COLORS[randomInitialColorIdx].hex;

PLAYER_COLORS.forEach((c, idx) => {
    const swatch = document.createElement('div');
    swatch.className = 'color-option' + (idx === randomInitialColorIdx ? ' selected' : '');
    swatch.style.backgroundColor = c.hex;
    swatch.title = c.name;
    swatch.addEventListener('click', () => {
        document.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
        swatch.classList.add('selected');
        selectedColor = c.hex;
        if (window.soundFX) window.soundFX.playClick();
    });
    colorPickerContainer.appendChild(swatch);
});

// Avatar (Emoji) + Hut/Accessoire, shown in lobby, scoreboards and on the game pieces
const AVATARS = ['😀', '😎', '🤓', '🥳', '🤠', '🦊', '🐼', '🐸', '🦄', '🐙', '🚀', '🍕'];
const HATS = ['', '🎩', '👑', '🧢', '🎓', '🎀', '🪖'];
const playerProfiles = new Map(); // player id -> { avatar, hat }

function readSetting(key, fallback) {
    try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function writeSetting(key, value) {
    try { localStorage.setItem(key, value); } catch { /* storage may be unavailable */ }
}

let myAvatar = AVATARS.includes(readSetting('dsg_avatar', '')) ? readSetting('dsg_avatar', '') : AVATARS[Math.floor(Math.random() * AVATARS.length)];
let myHat = HATS.includes(readSetting('dsg_hat', '')) ? readSetting('dsg_hat', '') : '';

// Only whitelisted emoji are accepted from other peers
function setProfile(id, avatar, hat) {
    playerProfiles.set(String(id), {
        avatar: AVATARS.includes(avatar) ? avatar : '',
        hat: HATS.includes(hat) ? hat : ''
    });
}

// Markup for a player's avatar (bots without a profile get a robot)
function avatarHtml(id, isBot = false) {
    const pr = playerProfiles.get(id);
    const av = (pr && pr.avatar) || (isBot ? '🤖' : '');
    const hat = pr ? pr.hat : '';
    if (!av && !hat) return '';
    return `<span class="av">${hat ? `<span class="av-hat">${esc(hat)}</span>` : ''}${esc(av)}</span>`;
}

// Plain-text version for canvases and chips
function avatarText(id, isBot = false) {
    const pr = playerProfiles.get(id);
    return (pr && pr.avatar) || (isBot ? '🤖' : '');
}

const btnAvatar = document.getElementById('btn-avatar');
const btnHat = document.getElementById('btn-hat');
function paintAvatarButtons() {
    if (btnAvatar) btnAvatar.textContent = myAvatar;
    if (btnHat) btnHat.textContent = myHat || '🚫';
}
if (btnAvatar) btnAvatar.addEventListener('click', () => {
    myAvatar = AVATARS[(AVATARS.indexOf(myAvatar) + 1) % AVATARS.length];
    writeSetting('dsg_avatar', myAvatar);
    paintAvatarButtons();
});
if (btnHat) btnHat.addEventListener('click', () => {
    myHat = HATS[(HATS.indexOf(myHat) + 1) % HATS.length];
    writeSetting('dsg_hat', myHat);
    paintAvatarButtons();
});
paintAvatarButtons();

// Secret that lets this browser tab take its seat (and score) back after a connection loss
function getRejoinKey() {
    let key = null;
    try { key = sessionStorage.getItem('dsg_rejoin_key'); } catch { /* ignore */ }
    if (!key) {
        const bytes = new Uint8Array(12);
        crypto.getRandomValues(bytes);
        key = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
        try { sessionStorage.setItem('dsg_rejoin_key', key); } catch { /* ignore */ }
    }
    return key;
}

const savedName = localStorage.getItem('dsg_player_name');
if (savedName) playerNameInput.value = savedName;

function getPlayerName() {
    const val = playerNameInput.value.trim() || 'Player 1';
    localStorage.setItem('dsg_player_name', val);
    return val;
}

// Einladungslink; controller=true öffnet auf dem Handy direkt den Touch-Controller
function getShareableLink(gameType, code, controller = false) {
    return padBuildLink(window.location.href, gameType, code, controller);
}

// ==========================================
// VIEW ROUTING
// ==========================================
function showScreen(screenEl) {
    homeScreen.classList.remove('active');
    lobbyScreen.classList.remove('active');
    Object.values(gameViews).forEach(v => v.classList.remove('active'));
    if (screenEl) screenEl.classList.add('active');
    // Reaction bar etc. only make sense inside a room
    document.body.classList.toggle('in-room', !!screenEl && screenEl !== homeScreen);
    if (typeof updatePadVisibility === 'function') updatePadVisibility(screenEl);
    if (typeof updateBeamerBadge === 'function') updateBeamerBadge(screenEl);
}

function openHub() {
    resetSessionState();
    if (typeof optPad !== 'undefined' && optPad) optPad.checked = false;
    padMode = false;
    if (networkManager.peer) networkManager.disconnect();
    showScreen(homeScreen);
    const url = new URL(window.location.href);
    url.search = '';
    window.history.replaceState({}, '', url.toString());
}

document.querySelectorAll('.btn-hub-back').forEach(btn => {
    btn.addEventListener('click', () => {
        if (confirm('Möchtest du das aktuelle Spiel verlassen und zum Hub zurückkehren?')) {
            openHub();
        }
    });
});

// Room-Code-Pillen in den Spielansichten kopieren beim Anklicken den Einladungslink
[
    ['curve-room-pill', 'curve'],
    ['cn-room-pill', 'codenames'],
    ['tank-room-pill', 'tank'],
    ['pong-room-pill', 'pong'],
    ['uno-room-pill', 'uno'],
    ['db-room-pill', 'dodgeball']
].forEach(([pillId, gameType]) => {
    const pill = document.getElementById(pillId);
    if (!pill) return;
    pill.addEventListener('click', () => {
        if (!networkManager.roomCode) return;
        const link = getShareableLink(gameType, networkManager.roomCode, beamerMode);
        navigator.clipboard.writeText(link).then(() => {
            const strong = pill.querySelector('strong');
            const orig = strong ? strong.textContent : '';
            if (strong && orig !== 'KOPIERT!') {
                strong.textContent = 'KOPIERT!';
                setTimeout(() => { strong.textContent = networkManager.roomCode || orig; }, 1500);
            }
        });
    });
});

// Mute & Fullscreen buttons
document.querySelectorAll('.btn-mute-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
        const isMuted = window.soundFX.toggleMute();
        document.querySelectorAll('.btn-mute-toggle').forEach(b => b.textContent = isMuted ? '🔇' : '🔊');
    });
});

document.querySelectorAll('.btn-fullscreen-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    });
});

// ==========================================
// GAME INSTANCES
// ==========================================
const curveGame = new CurveGame();
const codenamesGame = new CodenamesGame();
const skribblGame = new SkribblGame();
const tankGame = new TankGame();
const octaPongGame = new OctaPongGame();
const unoGame = new UnoGame();
const dodgeballGame = new DodgeballGame();
const rouletteGame = new FreigabeRouletteGame();

function getActiveGameInstance() {
    switch (activeGameType) {
        case 'curve': return curveGame;
        case 'codenames': return codenamesGame;
        case 'skribbl': return skribblGame;
        case 'tank': return tankGame;
        case 'pong': return octaPongGame;
        case 'uno': return unoGame;
        case 'dodgeball': return dodgeballGame;
        case 'roulette': return rouletteGame;
        default: return curveGame;
    }
}

function getUnusedColor() {
    const g = getActiveGameInstance();
    const used = new Set();
    for (const p of g.players.values()) {
        if (p.color) used.add(p.color.toLowerCase());
    }
    const avail = PLAYER_COLORS.filter(c => !used.has(c.hex.toLowerCase()));
    if (avail.length > 0) return avail[Math.floor(Math.random() * avail.length)].hex;
    return PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)].hex;
}
