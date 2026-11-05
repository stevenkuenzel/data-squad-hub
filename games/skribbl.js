/**
 * DataSquad Hub: Montagsmaler / Skribbl (P2P Multiplayer)
 * Deutsche Begriffe, Live-Canvas-Sync & Chat-Erkennung
 */

const SKRIBBL_WORDS = [
    // Tiere
    "Hund", "Katze", "Maus", "Elefant", "Giraffe", "Löwe", "Tiger", "Pferd", "Kuh", "Schwein",
    "Schaf", "Ente", "Huhn", "Frosch", "Schlange", "Schildkröte", "Krokodil", "Pinguin", "Delfin", "Hai",
    "Wal", "Oktopus", "Krabbe", "Spinne", "Biene", "Schmetterling", "Marienkäfer", "Affe", "Bär", "Fuchs",
    "Igel", "Eichhörnchen", "Känguru", "Panda", "Zebra", "Eule", "Adler", "Fledermaus", "Kamel", "Flamingo",

    // Gegenstände & Alltag
    "Stuhl", "Tisch", "Bett", "Lampe", "Uhr", "Brille", "Buch", "Stift", "Schere", "Schlüssel",
    "Schloss", "Tür", "Fenster", "Haus", "Garten", "Baum", "Blume", "Sonne", "Mond", "Stern",
    "Wolke", "Regen", "Schnee", "Schneemann", "Feuer", "Wasser", "Kerze", "Spiegel", "Tasche", "Koffer",
    "Fahrrad", "Auto", "Bus", "Zug", "Flugzeug", "Hubschrauber", "Boot", "Schiff", "Rakete", "Ballon",
    "Tasse", "Glas", "Teller", "Gabel", "Löffel", "Messer", "Flasche", "Eimer", "Besen", "Gitarre",

    // Essen & Kleidung
    "Apfel", "Banane", "Erdbeere", "Zitrone", "Kirsche", "Kuchen", "Torte", "Eis", "Pizza", "Burger",
    "Brot", "Käse", "Ei", "Schokolade", "Keks", "Karotte", "Pilz", "Pommes", "Suppe", "Waffel",
    "Hose", "Hemd", "Kleid", "Schuh", "Socke", "Hut", "Mütze", "Schal", "Handschuh", "Gürtel"
];


// Einfache Strichzeichnungen für Bot-Zeichner (Canvas 800x600). Nur Begriffe aus SKRIBBL_WORDS.
function skCircle(cx, cy, r, n = 28, from = 0, to = Math.PI * 2) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
        const a = from + (to - from) * (i / n);
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return pts;
}

function skStar(cx, cy, r) {
    const pts = [];
    for (let i = 0; i <= 5; i++) {
        const a = -Math.PI / 2 + ((i * 2) % 5) * (Math.PI * 2 / 5);
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return pts;
}

const SKRIBBL_BOT_DRAWINGS = {
    Sonne: [
        { color: '#ffaa00', size: 8, pts: skCircle(400, 300, 80) },
        ...Array.from({ length: 12 }, (_, i) => {
            const a = (Math.PI * 2 * i) / 12;
            return { color: '#ffaa00', size: 6, pts: [[400 + Math.cos(a) * 115, 300 + Math.sin(a) * 115], [400 + Math.cos(a) * 170, 300 + Math.sin(a) * 170]] };
        })
    ],
    Haus: [
        { color: '#8b5a2b', size: 8, pts: [[260, 300], [540, 300], [540, 500], [260, 500], [260, 300]] },
        { color: '#ff0000', size: 8, pts: [[230, 300], [400, 170], [570, 300], [230, 300]] },
        { color: '#000000', size: 6, pts: [[370, 500], [370, 410], [430, 410], [430, 500]] },
        { color: '#0099ff', size: 6, pts: [[290, 340], [340, 340], [340, 390], [290, 390], [290, 340]] }
    ],
    Baum: [
        { color: '#8b5a2b', size: 10, pts: [[370, 530], [372, 380]] },
        { color: '#8b5a2b', size: 10, pts: [[430, 530], [428, 380]] },
        { color: '#00cc44', size: 10, pts: skCircle(400, 290, 120) }
    ],
    Mond: [
        { color: '#ffaa00', size: 8, pts: skCircle(400, 300, 120, 28, Math.PI - 1.3, Math.PI + 1.3) },
        { color: '#ffaa00', size: 8, pts: [[432, 184], [380, 300], [432, 416]] }
    ],
    Stern: [
        { color: '#ffaa00', size: 8, pts: skStar(400, 310, 190) }
    ],
    Blume: [
        { color: '#00cc44', size: 8, pts: [[400, 540], [400, 340]] },
        { color: '#00cc44', size: 6, pts: [[400, 460], [350, 420], [400, 440]] },
        ...Array.from({ length: 6 }, (_, i) => {
            const a = (Math.PI * 2 * i) / 6;
            return { color: '#ff0000', size: 6, pts: skCircle(400 + Math.cos(a) * 62, 290 + Math.sin(a) * 62, 38, 14) };
        }),
        { color: '#ffaa00', size: 8, pts: skCircle(400, 290, 28, 12) }
    ],
    Schneemann: [
        { color: '#0099ff', size: 7, pts: skCircle(400, 450, 90) },
        { color: '#0099ff', size: 7, pts: skCircle(400, 320, 68) },
        { color: '#0099ff', size: 7, pts: skCircle(400, 225, 46) },
        { color: '#000000', size: 10, pts: [[385, 215], [387, 215]] },
        { color: '#000000', size: 10, pts: [[415, 215], [417, 215]] },
        { color: '#ffaa00', size: 7, pts: [[400, 230], [445, 238]] },
        { color: '#000000', size: 8, pts: [[355, 175], [445, 175]] },
        { color: '#000000', size: 8, pts: [[372, 175], [372, 130], [428, 130], [428, 175]] }
    ],
    Auto: [
        { color: '#ff0000', size: 8, pts: [[200, 370], [600, 370], [600, 450], [200, 450], [200, 370]] },
        { color: '#ff0000', size: 8, pts: [[270, 370], [330, 300], [480, 300], [540, 370]] },
        { color: '#000000', size: 8, pts: skCircle(290, 455, 36, 14) },
        { color: '#000000', size: 8, pts: skCircle(510, 455, 36, 14) }
    ]
};

// Limits for data coming from other peers
const SKRIBBL_MAX_STROKES = 20000;
const SKRIBBL_MAX_COORD = 4000;
const SKRIBBL_MAX_GUESS_LENGTH = 100;

class SkribblGame {
    constructor() {
        this.players = new Map(); // id -> { id, name, score, hasGuessed, color }
        this.status = 'LOBBY';    // LOBBY, CHOOSING, DRAWING, ROUND_OVER, GAME_OVER
        this.currentRound = 1;
        this.totalRounds = 3;
        this.turnQueue = [];
        this.activeDrawerId = null;
        this.wordChoices = [];
        this.secretWord = '';
        this.revealedHint = '';
        this.timeLeft = 0;
        this.timerInterval = null;
        this.chatMessages = [];
        this.strokes = []; // drawing history
        this.pendingStrokes = []; // strokes produced by bot drawers, drained by the host loop
        this.events = [];         // guess results produced by bot guessers, drained by the host loop
        this.botQueue = [];
        this.botDrawAcc = 0;
        this.botDrawRate = 20;
        this.nextGroupId = 1;
    }

    addPlayer(id, name, color, isBot = false) {
        if (!this.players.has(id)) {
            this.players.set(id, {
                id,
                name: String(name).slice(0, 16),
                score: 0,
                hasGuessed: false,
                color: color || '#00f3ff',
                isBot: !!isBot,
                guessAt: Infinity
            });
        }
        return this.players.get(id);
    }

    removePlayer(id) {
        this.players.delete(id);
        this.turnQueue = this.turnQueue.filter(pid => pid !== id);
        if (this.activeDrawerId === id && this.status === 'DRAWING') {
            this.endTurnEarly('Der Zeichner hat das Spiel verlassen.');
        }
    }

    startMatch(rounds = 3) {
        this.totalRounds = rounds;
        this.currentRound = 1;
        this.stats = {};
        for (const p of this.players.values()) {
            p.score = 0;
            p.hasGuessed = false;
        }
        this.buildTurnQueue();
        this.startNextTurn();
    }

    buildTurnQueue() {
        this.turnQueue = shuffleArray(Array.from(this.players.keys()));
    }

    startNextTurn() {
        if (this.turnQueue.length === 0) {
            // Check if rounds remain
            this.currentRound++;
            if (this.currentRound > this.totalRounds) {
                this.status = 'GAME_OVER';
                return;
            }
            this.buildTurnQueue();
        }

        this.activeDrawerId = this.turnQueue.shift();
        for (const p of this.players.values()) {
            p.hasGuessed = false;
        }

        // Pick 3 random distinct words (bot drawers only get words they can draw)
        const drawer = this.players.get(this.activeDrawerId);
        const pool = (drawer && drawer.isBot) ? Object.keys(SKRIBBL_BOT_DRAWINGS) : SKRIBBL_WORDS;
        const shuffled = shuffleArray([...pool]);
        this.wordChoices = [shuffled[0], shuffled[1], shuffled[2]];
        this.secretWord = '';
        this.strokes = [];
        this.status = 'CHOOSING';
        this.timeLeft = 15; // 15 seconds to pick word
    }

    // playerId is optional: internal calls (timeouts) skip the drawer check
    isDrawer(playerId) {
        return playerId == null || playerId === this.activeDrawerId;
    }

    chooseWord(word, playerId = null) {
        if (this.status !== 'CHOOSING' || !this.isDrawer(playerId)) return false;
        if (!this.wordChoices.includes(word)) return false;
        this.secretWord = word.trim().toUpperCase();
        this.revealedHint = this.secretWord.replace(/[A-ZÄÖÜß]/g, '_');
        this.status = 'DRAWING';
        this.timeLeft = 60; // 60 seconds drawing round
        this.strokes = [];
        this.pendingStrokes = [];
        this.setupBots(word);
        return true;
    }

    /**
     * Validates a stroke and stores a cleaned copy.
     * Returns the cleaned stroke, or null if rejected.
     */
    addStroke(stroke, playerId = null) {
        if (this.status !== 'DRAWING' || !this.isDrawer(playerId)) return null;
        if (!stroke || typeof stroke !== 'object') return null;
        if (this.strokes.length >= SKRIBBL_MAX_STROKES) return null;

        const coord = v => Number.isFinite(v) ? Math.round(Math.min(SKRIBBL_MAX_COORD, Math.max(0, v))) : null;
        const clean = {
            g: Number.isInteger(stroke.g) ? Math.min(2147483647, Math.max(0, stroke.g)) : 0,
            fill: stroke.fill === true,
            x1: coord(stroke.x1),
            y1: coord(stroke.y1),
            x2: coord(stroke.x2),
            y2: coord(stroke.y2),
            color: /^#[0-9a-fA-F]{6}$/.test(stroke.color) ? stroke.color : null,
            size: Number.isFinite(stroke.size) ? Math.min(32, Math.max(1, Math.round(stroke.size))) : null
        };
        if (Object.values(clean).some(v => v === null)) return null;

        this.strokes.push(clean);
        return clean;
    }

    clearCanvas(playerId = null) {
        if (!this.isDrawer(playerId)) return false;
        this.strokes = [];
        return true;
    }

    // Removes the most recent stroke group (one mouse-down to mouse-up, or one fill)
    undoLast(playerId = null) {
        if (this.status !== 'DRAWING' || !this.isDrawer(playerId)) return false;
        if (this.strokes.length === 0) return false;
        const g = this.strokes[this.strokes.length - 1].g;
        while (this.strokes.length > 0 && this.strokes[this.strokes.length - 1].g === g) {
            this.strokes.pop();
        }
        return true;
    }

    // --- Bots -------------------------------------------------------------

    setupBots(word) {
        // Bot guessers: most of them find the word after a random delay
        for (const p of this.players.values()) {
            if (p.isBot && p.id !== this.activeDrawerId) {
                p.guessAt = Math.random() < 0.85 ? 8 + Math.random() * 38 : Infinity;
            }
        }
        // Bot drawer: queue the line segments of a prepared drawing
        this.botQueue = [];
        const drawer = this.players.get(this.activeDrawerId);
        const drawing = SKRIBBL_BOT_DRAWINGS[word];
        if (drawer && drawer.isBot && drawing) {
            for (const line of drawing) {
                const g = this.nextGroupId++;
                for (let i = 0; i < line.pts.length - 1; i++) {
                    this.botQueue.push({
                        g,
                        x1: line.pts[i][0], y1: line.pts[i][1],
                        x2: line.pts[i + 1][0], y2: line.pts[i + 1][1],
                        color: line.color, size: line.size
                    });
                }
            }
            this.botDrawRate = Math.max(12, this.botQueue.length / 30);
            this.botDrawAcc = 0;
        }
    }

    updateBots(dt) {
        const drawer = this.players.get(this.activeDrawerId);
        if (drawer && drawer.isBot && this.botQueue.length > 0) {
            this.botDrawAcc += dt * this.botDrawRate;
            while (this.botDrawAcc >= 1 && this.botQueue.length > 0) {
                this.botDrawAcc -= 1;
                const clean = this.addStroke(this.botQueue.shift());
                if (clean) this.pendingStrokes.push(clean);
            }
        }
        const elapsed = 60 - this.timeLeft;
        for (const p of this.players.values()) {
            if (this.status !== 'DRAWING') break;
            if (p.isBot && p.id !== this.activeDrawerId && !p.hasGuessed && elapsed >= p.guessAt) {
                p.guessAt = Infinity;
                this.events.push(this.handleGuess(p.id, this.secretWord));
            }
        }
    }

    drainStrokes() {
        const out = this.pendingStrokes;
        this.pendingStrokes = [];
        return out;
    }

    drainEvents() {
        const out = this.events;
        this.events = [];
        return out;
    }

    handleGuess(playerId, rawText) {
        const p = this.players.get(playerId);
        if (!p || this.status !== 'DRAWING' || typeof rawText !== 'string') {
            return { isMatch: false, rejected: true };
        }
        rawText = rawText.slice(0, SKRIBBL_MAX_GUESS_LENGTH);

        // Active drawer cannot guess or send guesses to chat
        if (playerId === this.activeDrawerId) {
            return { isMatch: false, rejected: true };
        }

        // Players who already guessed cannot guess again or leak words
        if (p.hasGuessed) {
            return { isMatch: false, rejected: true };
        }

        const guessClean = rawText.trim().toUpperCase();
        const secretClean = this.secretWord.trim().toUpperCase();

        if (guessClean === secretClean) {
            p.hasGuessed = true;
            bumpStat(this, playerId, 'correct');
            // Scoring based on speed
            const guesserPoints = Math.max(50, Math.round(this.timeLeft * 5));
            const drawerPoints = Math.round(guesserPoints * 0.4);
            p.score += guesserPoints;

            const drawer = this.players.get(this.activeDrawerId);
            if (drawer) drawer.score += drawerPoints;

            // Check if all guessers are done
            const guessers = Array.from(this.players.values()).filter(pl => pl.id !== this.activeDrawerId);
            const allGuessed = guessers.length > 0 && guessers.every(pl => pl.hasGuessed);
            if (allGuessed) {
                this.endTurnEarly('Alle haben das Wort erraten!');
            }

            return {
                isMatch: true,
                systemMsg: `${p.name} hat das Wort erraten! 🎉 (+${guesserPoints} Pkt)`
            };
        }

        return {
            isMatch: false,
            chatMsg: { name: p.name, text: rawText }
        };
    }

    endTurnEarly(reason = '') {
        this.status = 'ROUND_OVER';
        this.timeLeft = 4; // 4 seconds showcase
    }

    updateTick(dt) {
        if (this.status === 'CHOOSING') {
            this.timeLeft -= dt;
            const drawer = this.players.get(this.activeDrawerId);
            if (this.timeLeft <= 0 || (drawer && drawer.isBot && this.timeLeft <= 13)) {
                // Ein Zeichner, der erst nach der Wortauswahl zum Bot wurde (Verbindungsabbruch), kann nur Wörter
                // zeichnen, die er kennt – sonst bliebe die Runde leer
                if (drawer && drawer.isBot && !SKRIBBL_BOT_DRAWINGS[this.wordChoices[0]]) {
                    this.wordChoices = shuffleArray(Object.keys(SKRIBBL_BOT_DRAWINGS)).slice(0, 3);
                }
                // Auto-pick first word (bots pick quickly)
                this.chooseWord(this.wordChoices[0]);
            }
        } else if (this.status === 'DRAWING') {
            this.timeLeft -= dt;
            this.updateBots(dt);

            // Reveal 1 random letter hint when half time has passed
            if (this.timeLeft < 30 && !this.revealedHint.match(/[A-ZÄÖÜß]/)) {
                const chars = this.secretWord.split('');
                const randIdx = Math.floor(Math.random() * chars.length);
                const hintArr = this.revealedHint.split('');
                hintArr[randIdx] = chars[randIdx];
                this.revealedHint = hintArr.join('');
            }

            if (this.timeLeft <= 0) {
                this.endTurnEarly('Zeit abgelaufen!');
            }
        } else if (this.status === 'ROUND_OVER') {
            this.timeLeft -= dt;
            if (this.timeLeft <= 0) {
                this.startNextTurn();
            }
        }
    }

    getSnapshot(forPlayerId) {
        const isDrawer = forPlayerId === this.activeDrawerId;
        return {
            status: this.status,
            currentRound: this.currentRound,
            totalRounds: this.totalRounds,
            activeDrawerId: this.activeDrawerId,
            activeDrawerName: this.players.get(this.activeDrawerId) ? this.players.get(this.activeDrawerId).name : '',
            wordChoices: isDrawer ? this.wordChoices : [],
            displayWord: (isDrawer || this.status === 'ROUND_OVER' || this.status === 'GAME_OVER') 
                ? this.secretWord 
                : this.revealedHint,
            timeLeft: Math.max(0, Math.ceil(this.timeLeft)),
            players: Array.from(this.players.values()).map(p => ({
                id: p.id,
                name: p.name,
                score: p.score,
                hasGuessed: p.hasGuessed,
                color: p.color,
                isBot: p.isBot
            }))
        };
    }
}

window.SkribblGame = SkribblGame;
