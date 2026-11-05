/**
 * DataSquad Hub: Codenames (P2P Multiplayer)
 * Vollständig auf Deutsch mit Alltags- & Spaßbegriffen (kein IT-Jargon)
 */

const CODENAMES_WORDS = [
    "Apfel", "Schloss", "Fliege", "Bank", "Drache", "Brücke", "Nagel", "Kette", "Frosch", "Koffer",
    "Taucher", "Stern", "Uhr", "Krone", "Pirat", "Zwerg", "Geist", "Feder", "Honig", "Pfeffer",
    "Wüste", "Wald", "Löwe", "König", "Ball", "Eis", "Leiter", "Zitrone", "Wolf", "Rose",
    "Planet", "Gold", "Boot", "Zug", "Zirkus", "Diamant", "Mond", "Schule", "Garten", "Zauberer",
    "Gitarre", "Wolke", "Spinne", "Adler", "Insel", "Vulkan", "Kompass", "Ritter", "Roboter", "Zaun",
    "Kerze", "Anker", "Spiegel", "Dinosaurier", "Schneemann", "Kaktus", "Schokolade", "Elefant", "Regenbogen", "Krokodil",
    "Karotte", "Schaukel", "Luftballon", "Erdbeere", "Torte", "Pinguin", "Fahrrad", "Hubschrauber", "Rakete", "Detektiv",
    "Zelt", "Lagerfeuer", "Komet", "Mumie", "Schatzkarte", "Taschenlampe", "U-Boot", "Leuchtturm", "Wikinger", "Papagei",
    "Känguru", "Schmetterling", "Eule", "Koala", "Schildkröte", "Panda", "Zebra", "Giraffe", "Tiger", "Nilpferd",
    "Kamel", "Flamingo", "Fuchs", "Waschbär", "Biber", "Igel", "Eichhörnchen", "Reh", "Hirsch", "Hamster",
    "Wal", "Delfin", "Hai", "Qualle", "Seestern", "Oktopus", "Krabbe", "Seepferdchen", "Robbe", "Eisbär",
    "Kamel", "Faultier", "Chamäleon", "Fledermaus", "Biene", "Hummel", "Ameise", "Käfer", "Schnecke", "Muschel",
    "Palme", "Eiche", "Birke", "Tanne", "Kastanie", "Sonnenblume", "Tulpe", "Nelke", "Lavendel", "Klee",
    "Pilz", "Brot", "Brezel", "Croissant", "Butter", "Käse", "Milch", "Waffel", "Kaffee", "Tee",
    "Wasser", "Tasse", "Glas", "Flasche", "Teller", "Topf", "Pfanne", "Ofen", "Messer", "Gabel",
    "Löffel", "Schere", "Schrank", "Stuhl", "Sofa", "Kissen", "Decke", "Teppich", "Lampe", "Kerze",
    "Schlüssel", "Tür", "Fenster", "Dach", "Mauer", "Pinsel", "Hammer", "Schraube", "Zange", "Säge",
    "Lineal", "Bleistift", "Buch", "Kalender", "Krawatte", "Hut", "Mütze", "Schal", "Handschuh", "Gürtel",
    "Ring", "Kette", "Brille", "Kamm", "Seife", "Handtuch", "Kino", "Theater", "Museum", "Stadion"
];

class CodenamesGame {
    constructor() {
        this.board = [];         // 25 cards: { id, word, type: 'red'|'blue'|'neutral'|'assassin', revealed: boolean }
        this.currentTurn = 'red';// 'red' or 'blue'
        this.startingTeam = 'red';
        this.scoreRed = 0;       // remaining red cards
        this.scoreBlue = 0;      // remaining blue cards
        this.totalRed = 9;
        this.totalBlue = 8;
        this.clueWord = '';
        this.clueCount = 0;
        this.guessesLeft = 0;
        this.winner = null;
        this.gameStatus = 'LOBBY'; // LOBBY, PLAYING, GAME_OVER
        this.logs = [];

        // Player assignments: id -> { id, name, team: 'red'|'blue'|'spectator', role: 'operative'|'spymaster' }
        this.players = new Map();
    }

    addPlayer(id, name) {
        if (!this.players.has(id)) {
            // Balance teams automatically
            let redCount = 0;
            let blueCount = 0;
            for (const p of this.players.values()) {
                if (p.team === 'red') redCount++;
                if (p.team === 'blue') blueCount++;
            }
            const team = redCount <= blueCount ? 'red' : 'blue';
            this.players.set(id, {
                id,
                name: String(name).slice(0, 16),
                team,
                role: 'operative'
            });
        }
        return this.players.get(id);
    }

    removePlayer(id) {
        this.players.delete(id);
    }

    setPlayerTeam(id, team) {
        const p = this.players.get(id);
        if (p && (team === 'red' || team === 'blue' || team === 'spectator')) {
            p.team = team;
        }
    }

    setPlayerRole(id, role) {
        const p = this.players.get(id);
        if (p && (role === 'spymaster' || role === 'operative')) {
            p.role = role;
        }
    }

    startNewGame() {
        // Pick 25 random unique words
        const shuffledWords = [...CODENAMES_WORDS].sort(() => Math.random() - 0.5).slice(0, 25);

        // Decide starting team randomly
        this.startingTeam = Math.random() < 0.5 ? 'red' : 'blue';
        this.currentTurn = this.startingTeam;

        this.totalRed = this.startingTeam === 'red' ? 9 : 8;
        this.totalBlue = this.startingTeam === 'blue' ? 9 : 8;
        this.scoreRed = this.totalRed;
        this.scoreBlue = this.totalBlue;

        // Card types: 1 Assassin, starting team 9, other 8, 7 neutral
        const types = [
            'assassin',
            ...Array(this.totalRed).fill('red'),
            ...Array(this.totalBlue).fill('blue'),
            ...Array(7).fill('neutral')
        ].sort(() => Math.random() - 0.5);

        this.board = shuffledWords.map((word, idx) => ({
            id: idx,
            word,
            type: types[idx],
            revealed: false
        }));

        this.clueWord = '';
        this.clueCount = 0;
        this.guessesLeft = 0;
        this.winner = null;
        this.gameStatus = 'PLAYING';
        this.logs = [`Das Spiel beginnt! Team ${this.startingTeam === 'red' ? 'Rot' : 'Blau'} fängt an.`];
    }

    giveClue(clue, count) {
        if (this.gameStatus !== 'PLAYING') return false;
        this.clueWord = String(clue).trim().toUpperCase();
        this.clueCount = parseInt(count, 10) || 1;
        this.guessesLeft = this.clueCount + 1; // standard rules: count + 1 bonus guess
        const teamName = this.currentTurn === 'red' ? 'Team Rot' : 'Team Blau';
        this.logs.unshift(`${teamName} Spionchef gibt Hinweis: "${this.clueWord} ${this.clueCount}"`);
        return true;
    }

    revealCard(cardId) {
        if (this.gameStatus !== 'PLAYING') return null;
        const card = this.board.find(c => c.id === cardId);
        if (!card || card.revealed) return null;

        card.revealed = true;
        const currentTeam = this.currentTurn;

        if (card.type === 'red') {
            this.scoreRed--;
            this.logs.unshift(`Karte aufgedeckt: "${card.word}" (ROT)`);
        } else if (card.type === 'blue') {
            this.scoreBlue--;
            this.logs.unshift(`Karte aufgedeckt: "${card.word}" (BLAU)`);
        } else if (card.type === 'neutral') {
            this.logs.unshift(`Karte aufgedeckt: "${card.word}" (ZIVILIST / Neutral)`);
        } else if (card.type === 'assassin') {
            this.logs.unshift(`ATTENTÄTER GETROFFEN! ("${card.word}")`);
            this.winner = currentTeam === 'red' ? 'blue' : 'red';
            this.gameStatus = 'GAME_OVER';
            return card;
        }

        // Check victory
        if (this.scoreRed === 0) {
            this.winner = 'red';
            this.gameStatus = 'GAME_OVER';
            this.logs.unshift(`TEAM ROT HAT GEWONNEN! Alle Agenten gefunden!`);
            return card;
        }
        if (this.scoreBlue === 0) {
            this.winner = 'blue';
            this.gameStatus = 'GAME_OVER';
            this.logs.unshift(`TEAM BLAU HAT GEWONNEN! Alle Agenten gefunden!`);
            return card;
        }

        // Check if guess belonged to active team
        if (card.type === currentTeam) {
            this.guessesLeft--;
            if (this.guessesLeft <= 0) {
                this.endTurn();
            }
        } else {
            // Incorrect guess ends turn immediately
            this.endTurn();
        }

        return card;
    }

    endTurn() {
        this.currentTurn = this.currentTurn === 'red' ? 'blue' : 'red';
        this.clueWord = '';
        this.clueCount = 0;
        this.guessesLeft = 0;
        const nextTeam = this.currentTurn === 'red' ? 'Team Rot' : 'Team Blau';
        this.logs.unshift(`Zugwechsel! ${nextTeam} ist an der Reihe.`);
    }

    /**
     * Snapshot for client sync
     * isSpymaster: boolean (if false, hidden card types are masked!)
     */
    getSnapshot(forPlayerId = null) {
        const player = forPlayerId ? this.players.get(forPlayerId) : null;
        const isSpymaster = player ? player.role === 'spymaster' : false;

        // Mask unrevealed card types for regular operatives
        const cards = this.board.map(c => ({
            id: c.id,
            word: c.word,
            revealed: c.revealed,
            type: (c.revealed || isSpymaster || this.gameStatus === 'GAME_OVER') ? c.type : 'hidden'
        }));

        const playersList = Array.from(this.players.values()).map(p => ({
            id: p.id,
            name: p.name,
            team: p.team,
            role: p.role
        }));

        return {
            gameStatus: this.gameStatus,
            currentTurn: this.currentTurn,
            scoreRed: this.scoreRed,
            scoreBlue: this.scoreBlue,
            totalRed: this.totalRed,
            totalBlue: this.totalBlue,
            clueWord: this.clueWord,
            clueCount: this.clueCount,
            guessesLeft: this.guessesLeft,
            winner: this.winner,
            logs: this.logs.slice(0, 10),
            cards,
            players: playersList
        };
    }
}

window.CodenamesGame = CodenamesGame;
