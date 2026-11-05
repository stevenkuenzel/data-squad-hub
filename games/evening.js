/**
 * DataSquad Hub: Spieleabend (Playlist, Gesamtwertung, Awards, Achievements, Aufholmechanik)
 * Reine Logik ohne DOM – läuft auf dem Host und ist per Node testbar.
 */

const EVENING_GAMES = {
    curve: { name: 'Curve Arena', icon: '🐍' },
    codenames: { name: 'Codenames', icon: '🕵️' },
    skribbl: { name: 'Montagsmaler', icon: '🎨' },
    tank: { name: 'Tank Trouble', icon: '💥' },
    pong: { name: 'Octa-Pong', icon: '🏓' },
    uno: { name: 'UNO', icon: '🃏' },
    dodgeball: { name: 'Corporate Dodgeball', icon: '🤾' },
    roulette: { name: 'Freigabe-Roulette', icon: '🎲' }
};

// Punkte pro Platz (Einzelspiele) bzw. für Sieger/Verlierer-Team (Teamspiele)
const EVENING_POINTS = [10, 7, 5, 4, 3, 2, 1];
const EVENING_TEAM_POINTS = [8, 3];

// Statistiken, bei denen der beste Einzelwert zählt statt der Summe
const EVENING_MAX_STATS = ['survival'];

// Kleine Erfolge pro Spiel. test(stats, ctx) – stats sind die Zahlen des Spielers aus game.stats
const EVENING_ACHIEVEMENTS = [
    { id: 'catch3', game: 'dodgeball', icon: '🧤', title: 'Fang-Profi', desc: '3 Bälle in einer Partie gefangen', test: s => (s.catches || 0) >= 3 },
    { id: 'rocks3', game: 'dodgeball', icon: '🪨', title: 'Steinmetz', desc: '3 Steine im Weg platziert', test: s => (s.rocks || 0) >= 3 },
    { id: 'cleanwin', game: 'uno', icon: '🃏', title: 'Saubere Hände', desc: 'UNO ohne Ziehen gewonnen', test: (s, c) => c.place === 1 && (s.draws || 0) === 0 },
    { id: 'collector', game: 'uno', icon: '📚', title: 'Kartensammler', desc: '12 Karten oder mehr gezogen', test: s => (s.draws || 0) >= 12 },
    { id: 'sharp', game: 'tank', icon: '🎯', title: 'Scharfschütze', desc: '5 Abschüsse in einer Partie', test: s => (s.kills || 0) >= 5 },
    { id: 'friendlyfire', game: 'tank', icon: '🔥', title: 'Eigentor-Experte', desc: '2× sich selbst abgeschossen', test: s => (s.selfKills || 0) >= 2 },
    { id: 'marathon', game: 'curve', icon: '🏃', title: 'Dauerläufer', desc: '45 Sekunden in einer Runde überlebt', test: s => (s.survival || 0) >= 45 },
    { id: 'mindreader', game: 'skribbl', icon: '🧠', title: 'Gedankenleser', desc: '4 Begriffe erraten', test: s => (s.correct || 0) >= 4 },
    { id: 'detective', game: 'codenames', icon: '🔍', title: 'Meisterdetektiv', desc: '5 eigene Karten aufgedeckt', test: s => (s.found || 0) >= 5 },
    { id: 'oops', game: 'codenames', icon: '☠️', title: 'Attentäter-Pech', desc: 'Den Attentäter aufgedeckt', test: s => (s.assassin || 0) >= 1 }
];

// Lustige Titel für die Zeremonie. stat 'wins' kommt aus der Gesamtwertung, alle anderen aus den Spielstatistiken.
const EVENING_AWARDS = [
    { id: 'wins', icon: '🏆', title: 'Bürokratie-Bezwinger', unit: 'Spielsiege' },
    { id: 'selfKills', icon: '🔥', title: 'Friendly-Fire-Champion', unit: 'Eigentore' },
    { id: 'catches', icon: '🧤', title: 'Meister des Fangens', unit: 'Fänge' },
    { id: 'survival', icon: '⏱️', title: 'Längste Überlebenszeit', unit: 's' },
    { id: 'rocks', icon: '🪨', title: 'Hat am meisten Steine in den Weg gelegt', unit: 'Steine' },
    { id: 'kills', icon: '💥', title: 'Panzerknacker', unit: 'Abschüsse' },
    { id: 'hits', icon: '🎯', title: 'Volltreffer-König', unit: 'Treffer' },
    { id: 'correct', icon: '🕵️', title: 'Wort-Detektiv', unit: 'erratene Begriffe' },
    { id: 'found', icon: '🔍', title: 'Chefermittler', unit: 'Agenten gefunden' },
    { id: 'draws', icon: '🃏', title: 'Kartensammler', unit: 'gezogene Karten' }
];

// Gleiche Werte teilen sich einen Platz. entries: [{ id, value }] (höher = besser)
function groupRanking(entries) {
    const sorted = [...entries].sort((a, b) => b.value - a.value);
    const groups = [];
    for (const e of sorted) {
        const last = groups[groups.length - 1];
        if (last && last.value === e.value) last.ids.push(e.id);
        else groups.push({ value: e.value, ids: [e.id] });
    }
    return groups.map(g => g.ids);
}

/**
 * Liest das Ergebnis eines beendeten Spiels aus der Spielinstanz.
 * Gibt null zurück, solange das Spiel noch läuft.
 * { ranking: [[ids auf Platz 1], [ids auf Platz 2], ...], teams: boolean, stats }
 */
function extractGameResult(gameType, g) {
    const players = Array.from(g.players.values());
    const byScore = key => groupRanking(players.map(p => ({ id: p.id, value: p[key] || 0 })));
    const result = ranking => ({ ranking, teams: false, stats: g.stats || {} });

    switch (gameType) {
        case 'curve':
            return g.state === 'MATCH_OVER' ? result(byScore('score')) : null;
        case 'tank':
            return g.status === 'MATCH_OVER' ? result(byScore('score')) : null;
        case 'skribbl':
            return g.status === 'GAME_OVER' ? result(byScore('score')) : null;
        case 'pong': {
            if (g.status !== 'GAME_OVER') return null;
            const winnerId = g.winner ? g.winner.id : null;
            const rest = players.filter(p => p.id !== winnerId);
            const ranking = groupRanking(rest.map(p => ({ id: p.id, value: p.lives || 0 })));
            if (winnerId) ranking.unshift([winnerId]);
            return result(ranking);
        }
        case 'uno': {
            if (g.status !== 'GAME_OVER') return null;
            const winnerId = g.winner ? g.winner.id : null;
            const rest = players.filter(p => p.id !== winnerId);
            const ranking = groupRanking(rest.map(p => ({ id: p.id, value: -p.hand.length })));
            if (winnerId) ranking.unshift([winnerId]);
            return result(ranking);
        }
        case 'roulette': {
            if (g.status !== 'GAME_OVER') return null;
            const winnerId = g.winner ? g.winner.id : null;
            const rest = players.filter(p => p.id !== winnerId);
            const ranking = groupRanking(rest.map(p => ({ id: p.id, value: p.progress || 0 })));
            if (winnerId) ranking.unshift([winnerId]);
            return result(ranking);
        }
        case 'dodgeball': {
            if (g.status !== 'MATCH_OVER' || !g.winner) return null;
            const winTeam = g.winner === 'Data Squad' ? 'squad' : 'comn';
            const win = players.filter(p => p.team === winTeam).map(p => p.id);
            const lose = players.filter(p => p.team !== winTeam).map(p => p.id);
            return { ranking: [win, lose].filter(r => r.length > 0), teams: true, stats: g.stats || {} };
        }
        case 'codenames': {
            if (g.gameStatus !== 'GAME_OVER' || !g.winner) return null;
            const win = players.filter(p => p.team === g.winner).map(p => p.id);
            const lose = players.filter(p => (p.team === 'red' || p.team === 'blue') && p.team !== g.winner).map(p => p.id);
            return { ranking: [win, lose].filter(r => r.length > 0), teams: true, stats: g.stats || {} };
        }
        default:
            return null;
    }
}

class EveningSession {
    constructor() {
        this.reset();
    }

    reset() {
        this.playlist = [];
        this.index = -1;
        this.phase = 'LOBBY';        // LOBBY, PLAYING, STANDINGS, FINISHED
        this.catchUpEnabled = false;
        this.totals = {};            // id -> { id, name, color, avatar, hat, isBot, points, wins, games, last, stats, achievements }
        this.history = [];           // [{ type, ranking, teams, points }]
        this.lastGame = null;
    }

    upsertPlayer(p) {
        const t = this.totals[p.id] || (this.totals[p.id] = {
            id: p.id, points: 0, wins: 0, games: 0, last: 0, stats: {}, achievements: []
        });
        t.name = p.name;
        t.color = p.color;
        t.avatar = p.avatar || '';
        t.hat = p.hat || '';
        t.isBot = !!p.isBot;
        return t;
    }

    syncRoster(players) {
        players.forEach(p => this.upsertPlayer(p));
    }

    start(playlist, players) {
        this.playlist = playlist.filter(t => EVENING_GAMES[t]);
        this.index = 0;
        this.phase = 'PLAYING';
        this.history = [];
        this.lastGame = null;
        for (const t of Object.values(this.totals)) {
            t.points = 0; t.wins = 0; t.games = 0; t.last = 0; t.stats = {}; t.achievements = [];
        }
        players.forEach(p => this.upsertPlayer(p));
        return this.playlist.length > 0;
    }

    get currentGame() {
        return this.playlist[this.index] || null;
    }

    get isLastGame() {
        return this.index >= this.playlist.length - 1;
    }

    // Punkte verteilen, Statistiken zusammenführen, Achievements auswerten
    recordResult(gameType, result) {
        const table = result.teams ? EVENING_TEAM_POINTS : EVENING_POINTS;
        const points = {};
        const unlocked = [];
        const participants = new Set();

        result.ranking.forEach((group, place) => {
            const pts = table[Math.min(place, table.length - 1)];
            for (const id of group) {
                participants.add(id);
                points[id] = pts;
                const t = this.totals[id];
                if (!t) continue;
                t.points += pts;
                t.last = pts;
                t.games += 1;
                if (place === 0) t.wins += 1;
            }
        });
        for (const t of Object.values(this.totals)) {
            if (!participants.has(t.id)) t.last = 0;
        }

        // Statistiken + Achievements
        result.ranking.forEach((group, place) => {
            for (const id of group) {
                const t = this.totals[id];
                const s = (result.stats && result.stats[id]) || {};
                if (!t) continue;
                for (const [k, v] of Object.entries(s)) {
                    t.stats[k] = EVENING_MAX_STATS.includes(k) ? Math.max(t.stats[k] || 0, v) : (t.stats[k] || 0) + v;
                }
                for (const a of EVENING_ACHIEVEMENTS) {
                    if (a.game !== gameType) continue;
                    if (a.test(s, { place: place + 1, teams: result.teams })) {
                        const entry = { id: a.id, icon: a.icon, title: a.title, desc: a.desc, game: gameType };
                        t.achievements.push(entry);
                        unlocked.push({ playerId: id, ...entry });
                    }
                }
            }
        });

        this.lastGame = { type: gameType, ranking: result.ranking, teams: !!result.teams, points };
        this.history.push(this.lastGame);
        this.phase = this.isLastGame ? 'FINISHED' : 'STANDINGS';
        return { points, unlocked };
    }

    // Weiter zum nächsten Spiel. Gibt dessen Typ zurück (oder null, wenn der Abend vorbei ist).
    next() {
        if (this.phase !== 'STANDINGS') return null;
        this.index += 1;
        this.phase = 'PLAYING';
        return this.currentGame;
    }

    standings() {
        const list = Object.values(this.totals).sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name));
        let rank = 0;
        let prev = null;
        return list.map((t, i) => {
            if (!prev || prev.points !== t.points) rank = i + 1;
            prev = t;
            return { ...t, rank };
        });
    }

    // Aufholmechanik: Führende bekommen kleine Handicaps, die Letzten kleine Boni
    catchUpMap() {
        if (!this.catchUpEnabled || this.history.length === 0) return {};
        const list = this.standings();
        if (list.length < 2) return {};
        const max = list[0].points;
        const min = list[list.length - 1].points;
        if (max === min) return {};
        const limit = Math.max(1, Math.ceil(list.length / 3));
        const map = {};
        list.filter(t => t.points === max).slice(0, limit).forEach(t => { map[t.id] = 'leader'; });
        list.filter(t => t.points === min).slice(-limit).forEach(t => { map[t.id] = 'trailer'; });
        return map;
    }

    computeAwards() {
        const awards = [];
        for (const def of EVENING_AWARDS) {
            let best = null;
            for (const t of Object.values(this.totals)) {
                const v = def.id === 'wins' ? t.wins : (t.stats[def.id] || 0);
                if (v > 0 && (!best || v > best.value)) best = { playerId: t.id, value: v };
            }
            if (best) {
                const v = def.id === 'survival' ? Math.round(best.value) : best.value;
                awards.push({ id: def.id, icon: def.icon, title: def.title, playerId: best.playerId, value: v, unit: def.unit });
            }
        }
        return awards;
    }

    getSnapshot() {
        const upcoming = this.phase === 'STANDINGS' ? this.playlist[this.index + 1] : null;
        const slim = t => ({
            id: t.id, name: t.name, color: t.color, avatar: t.avatar, hat: t.hat, isBot: t.isBot,
            points: t.points, wins: t.wins, last: t.last, rank: t.rank,
            achievements: t.achievements.map(a => ({ icon: a.icon, title: a.title, desc: a.desc }))
        });
        return {
            phase: this.phase,
            index: this.index,
            playlist: this.playlist.map(type => ({ type, ...EVENING_GAMES[type] })),
            lastGame: this.lastGame ? { type: this.lastGame.type, ...EVENING_GAMES[this.lastGame.type] } : null,
            next: upcoming ? { type: upcoming, ...EVENING_GAMES[upcoming] } : null,
            catchUp: this.catchUpEnabled,
            standings: this.standings().map(slim),
            awards: this.phase === 'FINISHED' ? this.computeAwards() : []
        };
    }
}

window.EVENING_GAMES = EVENING_GAMES;
window.EveningSession = EveningSession;
window.extractGameResult = extractGameResult;
