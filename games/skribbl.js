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
    }

    addPlayer(id, name, color) {
        if (!this.players.has(id)) {
            this.players.set(id, {
                id,
                name: String(name).slice(0, 16),
                score: 0,
                hasGuessed: false,
                color: color || '#00f3ff'
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
        for (const p of this.players.values()) {
            p.score = 0;
            p.hasGuessed = false;
        }
        this.buildTurnQueue();
        this.startNextTurn();
    }

    buildTurnQueue() {
        this.turnQueue = Array.from(this.players.keys()).sort(() => Math.random() - 0.5);
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

        // Pick 3 random distinct words
        const shuffled = [...SKRIBBL_WORDS].sort(() => Math.random() - 0.5);
        this.wordChoices = [shuffled[0], shuffled[1], shuffled[2]];
        this.secretWord = '';
        this.strokes = [];
        this.status = 'CHOOSING';
        this.timeLeft = 15; // 15 seconds to pick word
    }

    chooseWord(word) {
        if (!this.wordChoices.includes(word)) return;
        this.secretWord = word.trim().toUpperCase();
        this.revealedHint = this.secretWord.replace(/[A-ZÄÖÜß]/g, '_');
        this.status = 'DRAWING';
        this.timeLeft = 60; // 60 seconds drawing round
        this.strokes = [];
    }

    addStroke(stroke) {
        if (this.status !== 'DRAWING') return;
        this.strokes.push(stroke);
    }

    clearCanvas() {
        this.strokes = [];
    }

    handleGuess(playerId, rawText) {
        const p = this.players.get(playerId);
        if (!p || p.hasGuessed || playerId === this.activeDrawerId || this.status !== 'DRAWING') {
            return { isMatch: false, chatMsg: { name: p ? p.name : '', text: rawText } };
        }

        const guessClean = rawText.trim().toUpperCase();
        const secretClean = this.secretWord.trim().toUpperCase();

        if (guessClean === secretClean) {
            p.hasGuessed = true;
            // Scoring based on speed
            const guesserPoints = Math.max(50, Math.round(this.timeLeft * 5));
            const drawerPoints = Math.round(guesserPoints * 0.4);
            p.score += guesserPoints;

            const drawer = this.players.get(this.activeDrawerId);
            if (drawer) drawer.score += drawerPoints;

            // Check if all guessers are done
            const guessers = Array.from(this.players.values()).filter(pl => pl.id !== this.activeDrawerId);
            const allGuessed = guessers.every(pl => pl.hasGuessed);
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
            if (this.timeLeft <= 0) {
                // Auto-pick first word
                this.chooseWord(this.wordChoices[0]);
            }
        } else if (this.status === 'DRAWING') {
            this.timeLeft -= dt;

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
                color: p.color
            }))
        };
    }
}

window.SkribblGame = SkribblGame;
