import js from '@eslint/js';
import globals from 'globals';

// Names that one <script> file declares and another one uses.
// Keep in sync when adding shared classes/constants (see index.html load order).
const sharedScriptGlobals = Object.fromEntries([
    // network.js / games/utils.js
    'networkManager', 'shuffleArray', 'bumpStat',
    // game classes
    'CurveGame', 'CodenamesGame', 'SkribblGame', 'TankGame', 'OctaPongGame',
    'UnoGame', 'DodgeballGame', 'FreigabeRouletteGame',
    'EveningSession', 'extractGameResult', 'EVENING_GAMES',
    // constants used by the renderer in app.js
    'PLAYER_COLORS', 'ARENA_WIDTH', 'ARENA_HEIGHT', 'LINE_RADIUS',
    'TANK_ARENA_W', 'TANK_ARENA_H', 'BULLET_RADIUS', 'TANK_RADIUS',
    'PADDLE_WIDTH_RATIO', 'BALL_RADIUS',
    'DB_CENTER_X', 'DB_ARENA_W', 'DB_ARENA_H', 'DB_PLAYER_RADIUS'
].map(name => [name, 'readonly']));

export default [
    {
        ignores: ['peerjs.min.js', 'node_modules/**']
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
        // ui/*.js share one global scope (former app.js closure); cross-file names can't be resolved per file
        files: ['ui/**/*.js'],
        rules: { 'no-undef': 'off', 'no-unused-vars': 'off', 'no-redeclare': 'off' }
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
