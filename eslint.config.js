import js from '@eslint/js';
import globals from 'globals';

// Names that one <script> file declares and another one uses.
// Keep in sync when adding shared classes/constants (see index.html load order).
const sharedScriptGlobals = Object.fromEntries([
    // network.js / games/utils.js / games/qr.js / games/pad.js
    'networkManager', 'shuffleArray', 'bumpStat',
    'qrEncode', 'qrToSvg', 'padBuildLink', 'padHasController', 'padStickToDirs',
    // game classes
    'CurveGame', 'CodenamesGame', 'SkribblGame', 'TankGame', 'OctaPongGame',
    'UnoGame', 'DodgeballGame', 'FreigabeRouletteGame', 'HotelGame',
    'EveningSession', 'extractGameResult', 'EVENING_GAMES',
    // constants used by the renderer in ui/*.js
    'PLAYER_COLORS', 'ARENA_WIDTH', 'ARENA_HEIGHT', 'LINE_RADIUS',
    'TANK_ARENA_W', 'TANK_ARENA_H', 'BULLET_RADIUS', 'TANK_RADIUS', 'TANK_PICKUPS',
    'PADDLE_WIDTH_RATIO', 'BALL_RADIUS',
    'DB_CENTER_X', 'DB_ARENA_W', 'DB_ARENA_H', 'DB_PLAYER_RADIUS',
    'HOTEL_FIELDS', 'HOTEL_LOTS', 'HOTEL_STAGES', 'HOTEL_START_MONEY',
    // ui/hotel3d.js (three.js wird lazy nachgeladen)
    'THREE', 'HotelScene', 'Hotel2D', 'HOTEL_FIELD_COUNT_UI', 'hotelStars', 'hotelWebGLAvailable',
    'hotelReducedMotion', 'loadThree'
].map(name => [name, 'readonly']));

// Cross-file state and helpers shared between ui/*.js (classic scripts loaded in index.html order)
const uiSharedGlobals = {
    // Writable shared state variables across ui/*.js
    activeGameType: 'writable',
    myPlayerId: 'writable',
    selectedColor: 'writable',
    myAvatar: 'writable',
    myHat: 'writable',
    roomStarted: 'writable',
    isSpectator: 'writable',
    eveningMode: 'writable',
    beamerMode: 'writable',
    padMode: 'writable',
    padActive: 'writable',
    evening: 'writable',
    dodgeballFillBots: 'writable',
    dbAimAngle: 'writable',
    dbMouseThrow: 'writable',
    // Read-only shared DOM refs, instances, maps & functions across ui/*.js
    ...Object.fromEntries([
        'homeScreen', 'lobbyScreen', 'playerNameInput', 'colorPickerContainer',
        'joinCodeInput', 'btnJoinRoom', 'lobbyGameTitle', 'lobbyRoleText',
        'displayRoomCode', 'btnCopyLink', 'lobbyPlayerList', 'playerCount',
        'lobbyMaxPlayers', 'btnAddBot', 'btnStartGame', 'btnLeaveLobby',
        'hostLobbyControls', 'clientLobbyNotice', 'curveSettings', 'btnToggleGaps',
        'gameViews', 'MAX_HUB_PLAYERS', 'MAX_NAME_LENGTH', 'getMaxPlayers',
        'esc', 'safeColor', 'sanitizeName', 'playerProfiles', 'setProfile',
        'avatarHtml', 'avatarText', 'getRejoinKey', 'getPlayerName',
        'getShareableLink', 'showScreen', 'openHub',
        'curveGame', 'codenamesGame', 'skribblGame', 'tankGame',
        'octaPongGame', 'unoGame', 'dodgeballGame', 'rouletteGame', 'hotelGame',
        'getActiveGameInstance', 'getUnusedColor',
        // ui/session.js
        'identities', 'spectators', 'resetSessionState', 'clearGamePlayers',
        'nameOfPlayer', 'showToast', 'broadcastProfiles', 'applyProfiles',
        'joinPayload', 'sendGameStateTo', 'hostHandleJoin', 'hostHandlePeerGone',
        'promoteSpectatorsInto', 'setSpectator', 'clientHandleHostLost',
        'spawnReaction', 'hostHandleReaction', 'sendReaction',
        // ui/beamer.js & ui/pad.js
        'optBeamer', 'optPad', 'isBeamerRequested', 'isPadRequested',
        'refreshInvite', 'updateBeamerBadge', 'updatePadVisibility', 'tankTwin',
        // ui/lobby.js & ui/settings.js & ui/evening.js
        'updateLobbyUI', 'setupLobbyForGame', 'hostLobby', 'joinRoomWithCode',
        'broadcastLobby', 'launchGameView', 'updateGameSettingsVisibility',
        'fillDodgeballBots', 'eveningRoster', 'resetEveningState',
        'renderEveningPanel', 'startEvening', 'eveningTick',
        'handleEveningState', 'handleBackToLobby',
        // ui/help.js & game UI modules
        'updateLobbyInstructions', 'syncCurvePerksUI', 'renderCurve',
        'curveCtx', 'curveScoresContainer', 'curveRoundDisplay',
        'curveCountdownOverlay', 'curveCountdownNum', 'curveWinnerOverlay', 'curveWinnerText',
        'keys', 'bindTouch',
        'broadcastCodenamesState', 'renderCodenamesBoard',
        'setupSkribblUI', 'applySkStroke', 'clearSkCanvas', 'undoSkLocal',
        'addSkChatMsg', 'handleSkribblGuessResult', 'broadcastSkribblState', 'renderSkribblSnapshot',
        'renderTank', 'renderPong',
        'broadcastUnoState', 'renderUnoSnapshot',
        'renderDodgeball',
        'broadcastRouletteState', 'renderRouletteSnapshot',
        'broadcastHotelState', 'renderHotelSnapshot', 'hotelResetView',
        // ui/routing.js
        'handleHostGameEvent', 'handleClientGameEvent'
    ].map(name => [name, 'readonly']))
};

export default [
    {
        ignores: ['peerjs.min.js', 'three.min.js', 'node_modules/**']
    },
    js.configs.recommended,
    {
        // Browser files are classic <script> tags sharing one global scope
        files: ['*.js', 'games/**/*.js', 'ui/**/*.js'],
        ignores: ['eslint.config.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: {
                ...globals.browser,
                ...sharedScriptGlobals,
                Peer: 'readonly'
            }
        },
        rules: {
            // Top-level declarations are shared between scripts, so only check locals
            'no-unused-vars': ['error', { args: 'none', vars: 'local' }],
            'no-redeclare': ['error', { builtinGlobals: false }]
        }
    },
    {
        // ui/*.js share one global scope; validate all references against uiSharedGlobals
        files: ['ui/**/*.js'],
        languageOptions: {
            globals: uiSharedGlobals
        },
        rules: {
            'no-redeclare': 'off'
        }
    },
    {
        files: ['test/**/*.mjs', 'eslint.config.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: { ...globals.node }
        }
    }
];
