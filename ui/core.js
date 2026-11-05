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
const MAX_NAME_LENGTH = 15;

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

const savedName = localStorage.getItem('dsg_player_name');
if (savedName) playerNameInput.value = savedName;

function getPlayerName() {
    const val = playerNameInput.value.trim() || 'Player 1';
    localStorage.setItem('dsg_player_name', val);
    return val;
}

function getShareableLink(gameType, code) {
    const url = new URL(window.location.href);
    url.searchParams.set('game', gameType);
    url.searchParams.set('room', code);
    return url.toString();
}

// ==========================================
// VIEW ROUTING
// ==========================================
function showScreen(screenEl) {
    homeScreen.classList.remove('active');
    lobbyScreen.classList.remove('active');
    Object.values(gameViews).forEach(v => v.classList.remove('active'));
    if (screenEl) screenEl.classList.add('active');
}

function openHub() {
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
