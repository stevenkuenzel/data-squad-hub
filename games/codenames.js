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

// Themenwelten für die Bots: ein Bot-Spionchef gibt den Namen einer Kategorie als Hinweis,
// Bot-Ermittler raten Karten aus der genannten Kategorie. (Keine Kategorie heißt wie ein Brettwort.)
const CODENAMES_CATEGORIES = [
    { clue: 'TIERE', words: ['Fliege', 'Frosch', 'Löwe', 'Wolf', 'Spinne', 'Adler', 'Elefant', 'Krokodil', 'Pinguin', 'Papagei', 'Känguru', 'Schmetterling', 'Eule', 'Koala', 'Schildkröte', 'Panda', 'Zebra', 'Giraffe', 'Tiger', 'Nilpferd', 'Kamel', 'Flamingo', 'Fuchs', 'Waschbär', 'Biber', 'Igel', 'Eichhörnchen', 'Reh', 'Hirsch', 'Hamster', 'Wal', 'Delfin', 'Hai', 'Qualle', 'Seestern', 'Oktopus', 'Krabbe', 'Seepferdchen', 'Robbe', 'Eisbär', 'Faultier', 'Chamäleon', 'Fledermaus', 'Biene', 'Hummel', 'Ameise', 'Käfer', 'Schnecke', 'Dinosaurier'] },
    { clue: 'MEER', words: ['Wal', 'Delfin', 'Hai', 'Qualle', 'Seestern', 'Oktopus', 'Krabbe', 'Seepferdchen', 'Robbe', 'Muschel', 'Insel', 'U-Boot', 'Leuchtturm', 'Anker', 'Boot', 'Pirat', 'Taucher'] },
    { clue: 'INSEKTEN', words: ['Fliege', 'Spinne', 'Biene', 'Hummel', 'Ameise', 'Käfer', 'Schmetterling', 'Schnecke'] },
    { clue: 'VÖGEL', words: ['Adler', 'Eule', 'Pinguin', 'Papagei', 'Flamingo', 'Feder'] },
    { clue: 'ESSEN', words: ['Apfel', 'Honig', 'Pfeffer', 'Eis', 'Zitrone', 'Schokolade', 'Karotte', 'Erdbeere', 'Torte', 'Pilz', 'Brot', 'Brezel', 'Croissant', 'Butter', 'Käse', 'Milch', 'Waffel'] },
    { clue: 'GETRÄNKE', words: ['Kaffee', 'Tee', 'Wasser', 'Milch', 'Tasse', 'Glas', 'Flasche'] },
    { clue: 'KÜCHE', words: ['Tasse', 'Glas', 'Flasche', 'Teller', 'Topf', 'Pfanne', 'Ofen', 'Messer', 'Gabel', 'Löffel'] },
    { clue: 'MÖBEL', words: ['Schrank', 'Stuhl', 'Sofa', 'Kissen', 'Decke', 'Teppich', 'Lampe', 'Bank', 'Spiegel', 'Leiter'] },
    { clue: 'HAUS', words: ['Tür', 'Fenster', 'Dach', 'Mauer', 'Zaun', 'Schlüssel', 'Schloss', 'Garten', 'Kerze', 'Lampe'] },
    { clue: 'WERKZEUG', words: ['Nagel', 'Pinsel', 'Hammer', 'Schraube', 'Zange', 'Säge', 'Schere', 'Lineal', 'Bleistift', 'Leiter'] },
    { clue: 'KLEIDUNG', words: ['Krawatte', 'Hut', 'Mütze', 'Schal', 'Handschuh', 'Gürtel', 'Brille', 'Krone', 'Ring'] },
    { clue: 'GLITZER', words: ['Ring', 'Kette', 'Krone', 'Diamant', 'Gold', 'Spiegel', 'Stern'] },
    { clue: 'FAHRZEUG', words: ['Boot', 'Zug', 'Fahrrad', 'Hubschrauber', 'Rakete', 'U-Boot'] },
    { clue: 'PFLANZEN', words: ['Rose', 'Kaktus', 'Palme', 'Eiche', 'Birke', 'Tanne', 'Kastanie', 'Sonnenblume', 'Tulpe', 'Nelke', 'Lavendel', 'Klee', 'Pilz'] },
    { clue: 'WILDNIS', words: ['Wald', 'Eiche', 'Birke', 'Tanne', 'Pilz', 'Wolf', 'Fuchs', 'Reh', 'Hirsch', 'Igel', 'Eichhörnchen', 'Lagerfeuer', 'Zelt', 'Biber'] },
    { clue: 'WELTALL', words: ['Stern', 'Mond', 'Planet', 'Komet', 'Rakete', 'Roboter'] },
    { clue: 'FANTASIE', words: ['Drache', 'Zwerg', 'Geist', 'Zauberer', 'Ritter', 'Mumie', 'Wikinger', 'Pirat', 'König', 'Krone', 'Schloss', 'Roboter'] },
    { clue: 'ORTE', words: ['Wüste', 'Wald', 'Insel', 'Vulkan', 'Schule', 'Garten', 'Kino', 'Theater', 'Museum', 'Stadion', 'Zirkus', 'Leuchtturm', 'Brücke'] },
    { clue: 'CAMPING', words: ['Zelt', 'Lagerfeuer', 'Taschenlampe', 'Kompass', 'Schatzkarte', 'Wald'] },
    { clue: 'BÜRO', words: ['Bleistift', 'Lineal', 'Buch', 'Kalender', 'Schere', 'Schule'] },
    { clue: 'KÄLTE', words: ['Eis', 'Eisbär', 'Schneemann', 'Pinguin', 'Robbe', 'Schal', 'Handschuh', 'Mütze'] }
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
        this.timerSeconds = 0;   // 0 = kein Rundentimer (Einstellung des Hosts)
        this.timeLeft = 0;
        this.botTimer = 1.5;

        // Player assignments: id -> { id, name, team: 'red'|'blue'|'spectator', role: 'operative'|'spymaster' }
        this.players = new Map();
    }

    addPlayer(id, name, color = null, isBot = false) {
        if (!this.players.has(id)) {
            // Balance teams automatically
            let redCount = 0;
            let blueCount = 0;
            for (const p of this.players.values()) {
                if (p.team === 'red') redCount++;
                if (p.team === 'blue') blueCount++;
            }
            const team = redCount <= blueCount ? 'red' : 'blue';
            // A bot takes the spymaster seat if its team has none yet
            const teamHasSpymaster = Array.from(this.players.values())
                .some(o => o.team === team && o.role === 'spymaster');
            this.players.set(id, {
                id,
                name: String(name).slice(0, 16),
                color: color || '#00f3ff',
                isBot: !!isBot,
                team,
                role: (isBot && !teamHasSpymaster) ? 'spymaster' : 'operative'
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
        const shuffledWords = shuffleArray([...new Set(CODENAMES_WORDS)]).slice(0, 25);

        // Decide starting team randomly
        this.startingTeam = Math.random() < 0.5 ? 'red' : 'blue';
        this.currentTurn = this.startingTeam;

        this.totalRed = this.startingTeam === 'red' ? 9 : 8;
        this.totalBlue = this.startingTeam === 'blue' ? 9 : 8;
        this.scoreRed = this.totalRed;
        this.scoreBlue = this.totalBlue;

        // Card types: 1 Assassin, starting team 9, other 8, 7 neutral
        const types = shuffleArray([
            'assassin',
            ...Array(this.totalRed).fill('red'),
            ...Array(this.totalBlue).fill('blue'),
            ...Array(7).fill('neutral')
        ]);

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
        this.timeLeft = this.timerSeconds;
        this.botTimer = 1.5;
        this.logs = [`Das Spiel beginnt! Team ${this.startingTeam === 'red' ? 'Rot' : 'Blau'} fängt an.`];
    }

    assignTeamAndRole(id, team, role) {
        const p = this.players.get(id);
        if (p) {
            const newTeam = ['red', 'blue', 'spectator'].includes(team) ? team : p.team;
            const newRole = ['spymaster', 'operative'].includes(role) ? role : p.role;

            if (this.gameStatus === 'PLAYING') {
                // A spymaster has seen the key card: no switching team or role mid-game
                if (p.role === 'spymaster' && (newRole !== 'spymaster' || newTeam !== p.team)) return false;
                // Only one spymaster per team
                if (newRole === 'spymaster' && p.role !== 'spymaster') {
                    const taken = Array.from(this.players.values())
                        .some(o => o.id !== id && o.team === newTeam && o.role === 'spymaster');
                    if (taken) return false;
                }
            }

            p.team = newTeam;
            p.role = newRole;
            const teamLabel = p.team === 'red' ? 'Team Rot' : (p.team === 'blue' ? 'Team Blau' : 'Zuschauer');
            const roleLabel = p.role === 'spymaster' ? 'Spionchef 🕵️' : 'Ermittler 👥';
            this.logs.unshift(`${p.name} ist jetzt ${teamLabel} (${roleLabel})`);
            return true;
        }
        return false;
    }

    giveClue(clue, count, playerId = null) {
        if (this.gameStatus !== 'PLAYING') return false;
        if (playerId) {
            const p = this.players.get(playerId);
            if (!p || p.team !== this.currentTurn || p.role !== 'spymaster') return false;
        }
        const clueWord = String(clue ?? '').trim().toUpperCase().slice(0, 30);
        if (!clueWord) return false;
        this.clueWord = clueWord;
        this.clueCount = Math.min(9, Math.max(1, parseInt(count, 10) || 1));
        this.guessesLeft = this.clueCount + 1; // standard rules: count + 1 bonus guess
        this.timeLeft = this.timerSeconds;     // guessing phase gets a fresh timer
        const teamName = this.currentTurn === 'red' ? 'Team Rot' : 'Team Blau';
        this.logs.unshift(`${teamName} Spionchef gibt Hinweis: "${this.clueWord} ${this.clueCount}"`);
        return true;
    }

    revealCard(cardId, playerId = null) {
        if (this.gameStatus !== 'PLAYING') return null;
        if (playerId) {
            const p = this.players.get(playerId);
            // Only operatives of the active team can guess cards, after a clue is given
            if (!p || p.team !== this.currentTurn || p.role !== 'operative' || this.guessesLeft <= 0) {
                return null;
            }
        }
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

    endTurn(playerId = null) {
        if (playerId) {
            // Only members of the active team may end their own turn
            const p = this.players.get(playerId);
            if (this.gameStatus !== 'PLAYING' || !p || p.team !== this.currentTurn) return false;
        }
        this.currentTurn = this.currentTurn === 'red' ? 'blue' : 'red';
        this.timeLeft = this.timerSeconds;
        this.clueWord = '';
        this.clueCount = 0;
        this.guessesLeft = 0;
        const nextTeam = this.currentTurn === 'red' ? 'Team Rot' : 'Team Blau';
        this.logs.unshift(`Zugwechsel! ${nextTeam} ist an der Reihe.`);
        return true;
    }

    /**
     * Host tick: round timer + bot actions. Returns true when the visible state changed.
     */
    update(dt) {
        if (this.gameStatus !== 'PLAYING') return false;
        let changed = false;

        if (this.timerSeconds > 0) {
            const before = Math.ceil(this.timeLeft);
            this.timeLeft -= dt;
            if (this.timeLeft <= 0) {
                this.logs.unshift('⏰ Zeit abgelaufen!');
                this.endTurn();
                return true;
            }
            if (Math.ceil(this.timeLeft) !== before) changed = true;
        }

        this.botTimer -= dt;
        if (this.botTimer <= 0) {
            this.botTimer = 1.4 + Math.random() * 1.2;
            if (this.runBot()) changed = true;
        }
        return changed;
    }

    runBot() {
        const bots = Array.from(this.players.values()).filter(p => p.isBot && p.team === this.currentTurn);
        if (!this.clueWord) {
            const spy = bots.find(p => p.role === 'spymaster');
            if (!spy) return false;
            const { clue, count } = this.botPickClue(this.currentTurn);
            return this.giveClue(clue, count, spy.id);
        }
        if (this.guessesLeft > 0) {
            const op = bots.find(p => p.role === 'operative');
            if (!op) return false;
            const card = this.botPickCard();
            if (!card) return this.endTurn(op.id);
            this.revealCard(card.id, op.id);
            return true;
        }
        return false;
    }

    botPickClue(team) {
        const enemy = team === 'red' ? 'blue' : 'red';
        const open = this.board.filter(c => !c.revealed);
        let best = null;
        for (const cat of CODENAMES_CATEGORIES) {
            let own = 0;
            let penalty = 0;
            for (const c of open) {
                if (!cat.words.includes(c.word)) continue;
                if (c.type === team) own++;
                else if (c.type === enemy) penalty += 3;
                else if (c.type === 'assassin') penalty += 20;
            }
            const score = own * 2 - penalty;
            if (own > 0 && score > 0 && (!best || score > best.score)) {
                best = { clue: cat.clue, count: Math.min(own, 4), score };
            }
        }
        return best || { clue: 'IRGENDWAS', count: 1 };
    }

    botPickCard() {
        const open = this.board.filter(c => !c.revealed);
        if (open.length === 0) return null;
        const pick = list => list[Math.floor(Math.random() * list.length)];
        const cat = CODENAMES_CATEGORIES.find(c => c.clue === this.clueWord);
        const guessesMade = this.clueCount + 1 - this.guessesLeft;
        if (cat) {
            const matches = open.filter(c => cat.words.includes(c.word));
            if (matches.length > 0) return pick(matches);
        }
        // Clue not understood: gamble on the first guess only, then stop
        return guessesMade === 0 ? pick(open) : null;
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
            role: p.role,
            isBot: p.isBot
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
            timerSeconds: this.timerSeconds,
            timeLeft: Math.max(0, Math.ceil(this.timeLeft)),
            winner: this.winner,
            logs: this.logs.slice(0, 10),
            cards,
            players: playersList
        };
    }
}

window.CodenamesGame = CodenamesGame;
