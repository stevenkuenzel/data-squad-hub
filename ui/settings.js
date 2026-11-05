/**
 * DataSquad Hub UI: Lobby-Einstellungen pro Spiel (nur für den Host sichtbar)
 * Klassisches Script – teilt den globalen Scope mit den übrigen ui/*.js (Ladereihenfolge siehe index.html).
 */

const gameSettingsPanels = {
    codenames: 'codenames-settings',
    uno: 'uno-settings',
    dodgeball: 'dodgeball-settings',
    tank: 'tank-settings'
};

// Dodgeball: balance uneven teams with bots when the match starts
let dodgeballFillBots = true;

function updateGameSettingsVisibility() {
    for (const [game, id] of Object.entries(gameSettingsPanels)) {
        const el = document.getElementById(id);
        if (el) el.style.display = (networkManager.isHost && activeGameType === game) ? 'block' : 'none';
    }
}

function bindToggle(id, get, set) {
    const btn = document.getElementById(id);
    if (!btn) return;
    const paint = () => {
        const on = get();
        btn.textContent = on ? 'AN' : 'AUS';
        btn.classList.toggle('btn-primary', on);
        btn.classList.toggle('btn-secondary', !on);
    };
    paint();
    btn.addEventListener('click', () => {
        set(!get());
        paint();
        if (window.soundFX) window.soundFX.playClick();
    });
}

function bindSelect(id, get, set) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = String(get());
    el.addEventListener('change', () => set(el.value));
}

bindSelect('cn-timer-select', () => codenamesGame.timerSeconds, v => { codenamesGame.timerSeconds = parseInt(v, 10) || 0; });

bindToggle('btn-uno-stack', () => unoGame.rules.stack, v => { unoGame.rules.stack = v; });
bindToggle('btn-uno-sevenzero', () => unoGame.rules.sevenZero, v => { unoGame.rules.sevenZero = v; });

bindSelect('db-timer-select', () => dodgeballGame.roundTimeLimit, v => { dodgeballGame.roundTimeLimit = parseInt(v, 10) || 0; });
bindToggle('btn-db-powerups', () => dodgeballGame.powerupsEnabled, v => { dodgeballGame.powerupsEnabled = v; });
bindToggle('btn-db-fillbots', () => dodgeballFillBots, v => { dodgeballFillBots = v; });

bindSelect('tank-layout-select', () => tankGame.layout, v => { tankGame.layout = v; });
bindToggle('btn-tank-pickups', () => tankGame.pickupsEnabled, v => { tankGame.pickupsEnabled = v; });

const DODGEBALL_MAX_PLAYERS = 8;

function fillDodgeballBots() {
    const g = dodgeballGame;
    const count = team => Array.from(g.players.values()).filter(p => p.team === team).length;
    const names = ['Cyber', 'Pulse', 'Shadow', 'Apex', 'Matrix', 'Volt', 'Titan', 'Viper'];
    let n = 0;
    while (g.players.size < DODGEBALL_MAX_PLAYERS && (count('squad') !== count('comn') || count('squad') === 0)) {
        const team = count('squad') <= count('comn') ? 'squad' : 'comn';
        g.addPlayer(`bot-fill-${++n}`, 'Bot ' + names[(n - 1) % names.length], getUnusedColor(), true, team);
    }
}
