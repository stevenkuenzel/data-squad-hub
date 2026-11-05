/**
 * DataSquad Hub: ComN: Freigabe-Roulette
 * Satirisches Büro- & Kartenspiel (2 - 8 Spieler & Bots)
 * 
 * Wer erreicht als Erster 100% Projektfortschritt, bevor ComN mit Steinen im Weg,
 * externen Agenturen, Veto-Stempeln und 4-Stunden-Meetings das Projekt beerdigt?
 */

const ROULETTE_CARDS = [
    // --- FORTSCHRITT (Data Squad) ---
    { id: 'deploy_20', category: 'progress', title: 'Code-Deploy', icon: '🚀', value: 20, count: 8, desc: '+20% Fortschritt: Feature erfolgreich live geschaltet.' },
    { id: 'pipeline_30', category: 'progress', title: 'Automatisierte Pipeline', icon: '⚡', value: 30, count: 5, desc: '+30% Fortschritt: CI/CD läuft vollautomatisch ohne Freigabe!' },
    { id: 'hotfix_15', category: 'progress', title: 'Quick-Fix am Freitag', icon: '🔥', value: 15, count: 7, desc: '+15% Fortschritt: Schnell gemerged, bevor ComN es merkt.' },
    { id: 'kaffee_10', category: 'progress', title: 'Kaffee-Sprint', icon: '☕', value: 10, count: 6, drawExtra: true, desc: '+10% Fortschritt & ziehe 1 extra Handkarte.' },
    { id: 'night_shift_25', category: 'progress', title: 'Nachtschicht-Hack', icon: '🌙', value: 25, count: 5, desc: '+25% Fortschritt: Gearbeitet, während ComN schläft.' },
    { id: 'ai_dashboard_20', category: 'progress', title: 'KI ins Dashboard gebaut', icon: '🤖', value: 20, count: 5, desc: '+20% Fortschritt: Stakeholder klatschen begeistert.' },
    { id: 'feature_flag_25', category: 'progress', title: 'Stiller Feature-Flag', icon: '🚩', value: 25, count: 5, desc: '+25% Fortschritt: Live geschaltet, ohne ComN zu fragen.' },
    { id: 'espresso_double', category: 'progress', title: 'Doppelter Espresso', icon: '🥤', value: 15, count: 4, drawCount: 2, desc: '+15% Fortschritt & ziehe 2 Handkarten!' },

    // --- COMN BLOCKER (Troll & Steine im Weg) ---
    { id: 'stein_weg', category: 'blocker', title: 'Stein im Weg', icon: '🪨', target: 'enemy', penalty: 15, count: 8, desc: 'Gegner verliert 15% („Müssen erst Stakeholder abholen“).' },
    { id: 'agentur', category: 'blocker', title: 'Externe Agentur', icon: '💸', target: 'enemy', penalty: 20, count: 7, desc: 'ComN lagert aus: Gegner verliert 20% durch endlose Mockups.' },
    { id: 'ci_2018', category: 'blocker', title: 'CI-Handbuch 2018', icon: '📐', target: 'all_enemies', penalty: 10, count: 5, desc: 'Alle Gegner verlieren 10% („Schriftart ist 1px zu schmal“).' },
    { id: 'meeting_4h', category: 'blocker', title: '4-Stunden-Alignment', icon: '🗣️', target: 'enemy', skipTurn: true, count: 5, desc: 'Zwingt einen Gegner, seinen nächsten Zug im Meeting abzusitzen.' },
    { id: 'datenschutz_gate', category: 'blocker', title: 'Datenschutz-Bedenken', icon: '🔒', target: 'enemy', penalty: 20, count: 5, desc: 'Gegner verliert 20% („Müssen erst 40-Seiten DSFA prüfen“).' },
    { id: 'wording_police', category: 'blocker', title: 'Corporate Wording', icon: '📋', target: 'enemy', penalty: 15, count: 5, desc: 'Gegner verliert 15% („Feature darf nicht Feature heißen“).' },

    // --- REAKTIONEN & VETOS ---
    { id: 'problem_gefunden', category: 'reaction', title: 'Problem gefunden!', icon: '🛑', isCounter: true, count: 6, desc: 'Blockt Angriffe („Gute Lösung, aber hier ist ein neues Problem!“).' },
    { id: 'nicht_zustaendig', category: 'reaction', title: 'Nicht zuständig', icon: '😴', isRedirect: true, count: 5, desc: 'Leitet einen ComN-Angriff einfach an den nächsten Spieler weiter.' },
    { id: 'chef_genehmigung', category: 'action', title: 'Chef-Bypass', icon: '👔', count: 5, desc: 'Schützt dich 1 Runde vor allen ComN-Einwänden.' },
    { id: 'vorstand_demo', category: 'action', title: 'Vorstandspräsentation', icon: '👑', value: 35, count: 3, desc: 'Direkter Segen vom Vorstand: +35% Fortschritt!' }
];

const ROULETTE_TURN_LIMIT = 60; // Sekunden pro Zug für Menschen

class FreigabeRouletteGame {
    constructor() {
        this.players = new Map(); // id -> Player
        this.playerOrder = [];    // array of ids
        this.turnIndex = 0;
        this.drawPile = [];
        this.discardPile = [];
        this.status = 'LOBBY';    // LOBBY, PLAYING, GAME_OVER
        this.winner = null;
        this.logs = [];
        this.nextCardUid = 1;
        this.cardsPlayedThisTurn = 0;
        this.maxCardsPerTurn = 2;
        this.botActionTimer = 0;
        this.turnTimer = ROULETTE_TURN_LIMIT;
        this.lastAction = null;
    }

    addPlayer(id, name, color, isBot = false) {
        if (!this.players.has(id)) {
            this.players.set(id, {
                id,
                name: String(name).slice(0, 16),
                color: color || '#00f3ff',
                isBot,
                progress: 0,
                hand: [],
                shielded: false,
                skipped: false
            });
            this.playerOrder.push(id);
        }
        return this.players.get(id);
    }

    removePlayer(id) {
        this.players.delete(id);
        this.playerOrder = this.playerOrder.filter(pid => pid !== id);
        if (this.turnIndex >= this.playerOrder.length) {
            this.turnIndex = 0;
        }
        if (this.status === 'PLAYING' && this.playerOrder.length < 2) {
            this.status = 'GAME_OVER';
            this.winner = this.players.values().next().value || null;
        }
    }

    createDeck() {
        const deck = [];
        for (const template of ROULETTE_CARDS) {
            for (let i = 0; i < template.count; i++) {
                deck.push({
                    uid: this.nextCardUid++,
                    id: template.id,
                    category: template.category,
                    title: template.title,
                    icon: template.icon,
                    value: template.value || 0,
                    penalty: template.penalty || 0,
                    target: template.target || null,
                    drawExtra: !!template.drawExtra,
                    drawCount: template.drawCount || 0,
                    skipTurn: !!template.skipTurn,
                    isCounter: !!template.isCounter,
                    isRedirect: !!template.isRedirect,
                    desc: template.desc
                });
            }
        }
        return this.shuffle(deck);
    }

    shuffle(cards) {
        for (let i = cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cards[i], cards[j]] = [cards[j], cards[i]];
        }
        return cards;
    }

    startMatch() {
        if (this.players.size < 2) return false;
        this.drawPile = this.createDeck();
        this.discardPile = [];
        this.turnIndex = 0;
        this.status = 'PLAYING';
        this.winner = null;
        this.logs = ['Das Freigabe-Roulette beginnt! Wer schafft den ersten Go-Live?'];
        this.cardsPlayedThisTurn = 0;
        this.botActionTimer = 1.0;
        this.turnTimer = ROULETTE_TURN_LIMIT;

        // Deal 5 cards to each player and reset progress
        for (const p of this.players.values()) {
            p.progress = 0;
            p.shielded = false;
            p.skipped = false;
            p.hand = [];
            for (let i = 0; i < 5; i++) {
                p.hand.push(this.drawCardFromPile());
            }
        }

        // Draw opening card for first player
        const first = this.getCurrentPlayer();
        if (first) {
            first.hand.push(this.drawCardFromPile());
        }

        return true;
    }

    drawCardFromPile() {
        if (this.drawPile.length === 0) {
            if (this.discardPile.length <= 1) {
                this.drawPile = this.createDeck();
            } else {
                const top = this.discardPile.pop();
                this.drawPile = this.shuffle(this.discardPile);
                this.discardPile = [top];
            }
        }
        return this.drawPile.pop();
    }

    getCurrentPlayer() {
        if (this.playerOrder.length === 0) return null;
        const pid = this.playerOrder[this.turnIndex % this.playerOrder.length];
        return this.players.get(pid) || null;
    }

    playCard(playerId, cardUid, targetPlayerId = null) {
        if (this.status !== 'PLAYING') return { success: false, msg: 'Spiel läuft nicht' };

        const curr = this.getCurrentPlayer();
        if (!curr || curr.id !== playerId) {
            return { success: false, msg: 'Nicht an der Reihe' };
        }

        if (this.cardsPlayedThisTurn >= this.maxCardsPerTurn) {
            return { success: false, msg: 'Maximal 2 Karten pro Zug!' };
        }

        const cardIdx = curr.hand.findIndex(c => c.uid === cardUid);
        if (cardIdx === -1) return { success: false, msg: 'Karte nicht auf der Hand' };

        const card = curr.hand[cardIdx];
        const target = targetPlayerId ? this.players.get(targetPlayerId) : null;

        // Reaktionskarten wirken automatisch, wenn man angegriffen wird (siehe applyBlocker)
        if (card.category === 'reaction') {
            return { success: false, msg: 'Reaktionskarten wirken automatisch, wenn du angegriffen wirst.' };
        }

        // Target validation
        if (card.target === 'enemy' && (!target || target.id === curr.id)) {
            return { success: false, msg: 'Bitte einen gegnerischen Spieler wählen!' };
        }

        // Remove from hand and add to discard
        curr.hand.splice(cardIdx, 1);
        this.discardPile.push(card);
        this.cardsPlayedThisTurn++;

        // 1. Progress Card
        if (card.category === 'progress') {
            curr.progress = Math.min(100, curr.progress + card.value);
            this.logs.unshift(`🚀 ${curr.name} spielt "${card.title}" (+${card.value}% Fortschritt ➔ ${curr.progress}%)`);

            if (card.drawCount) {
                for (let k = 0; k < card.drawCount; k++) {
                    curr.hand.push(this.drawCardFromPile());
                }
                this.logs.unshift(`🥤 ${curr.name} zieht ${card.drawCount} extra Handkarten!`);
            } else if (card.drawExtra) {
                const extra = this.drawCardFromPile();
                curr.hand.push(extra);
                this.logs.unshift(`☕ Kaffeeschub: ${curr.name} zieht 1 extra Karte!`);
            }

            if (curr.progress >= 100) {
                this.status = 'GAME_OVER';
                this.winner = curr;
                this.logs.unshift(`🎉 ${curr.name} erreicht 100% Go-Live! Data Squad triumphiert über die Bürokratie!`);
                if (window.soundFX) window.soundFX.playWin();
                return { success: true, won: true };
            }
        }
        // 2. ComN Blocker (Stein im Weg / Agentur / Meeting / DSFA / Wording)
        else if (card.category === 'blocker') {
            if (card.target === 'enemy' && target) {
                this.applyBlocker(curr, target, card);
            } else if (card.target === 'all_enemies') {
                for (const other of this.players.values()) {
                    if (other.id !== curr.id && !other.shielded) {
                        other.progress = Math.max(0, other.progress - card.penalty);
                    }
                }
                this.logs.unshift(`📐 CI-Handbuch 2018! Alle Gegner verlieren 10% Fortschritt.`);
            }
        }
        // 3. Chef-Bypass
        else if (card.id === 'chef_genehmigung') {
            curr.shielded = true;
            this.logs.unshift(`👔 ${curr.name} aktiviert Chef-Bypass! 1 Runde Schutz vor ComN-Einwänden.`);
        }
        // 4. Vorstandspräsentation (Mega-Progress Action)
        else if (card.id === 'vorstand_demo') {
            curr.progress = Math.min(100, curr.progress + card.value);
            this.logs.unshift(`👑 Vorstandspräsentation! ${curr.name} erhält C-Level Segen (+${card.value}% ➔ ${curr.progress}%)`);
            if (curr.progress >= 100) {
                this.status = 'GAME_OVER';
                this.winner = curr;
                this.logs.unshift(`🎉 ${curr.name} erreicht 100% Go-Live! Data Squad triumphiert!`);
                if (window.soundFX) window.soundFX.playWin();
                return { success: true, won: true };
            }
        }

        if (window.soundFX) window.soundFX.playClick();
        this.turnTimer = ROULETTE_TURN_LIMIT; // jede Aktion verlängert den Zug

        // Check if player exhausted turn cards
        if (this.cardsPlayedThisTurn >= this.maxCardsPerTurn) {
            this.endTurn();
        }

        return { success: true };
    }

    // Nimmt die erste Karte mit dieser id aus der Hand (null, wenn keine da ist)
    takeCard(player, cardId) {
        const idx = player.hand.findIndex(c => c.id === cardId);
        if (idx === -1) return null;
        const [card] = player.hand.splice(idx, 1);
        this.discardPile.push(card);
        return card;
    }

    // Blocker auf einen Gegner: Chef-Bypass schützt, "Problem gefunden!" blockt, "Nicht zuständig" leitet um
    applyBlocker(attacker, target, card) {
        const hit = (victim) => {
            if (victim.shielded) {
                this.logs.unshift(`🛡️ ${victim.name} ist durch den Chef-Bypass geschützt! Angriff verpufft.`);
                return;
            }
            victim.progress = Math.max(0, victim.progress - (card.penalty || 0));
            if (card.skipTurn) victim.skipped = true;
            this.logs.unshift(`🪨 ${attacker.name} wirft "${card.title}" auf ${victim.name} (-${card.penalty || 0}% ➔ ${victim.progress}%)`);
        };
        if (target.shielded) return hit(target);
        if (this.takeCard(target, 'problem_gefunden')) {
            this.logs.unshift(`🛑 ${target.name}: "Problem gefunden!" – der Angriff "${card.title}" wird geblockt.`);
            return;
        }
        if (this.takeCard(target, 'nicht_zustaendig')) {
            const idx = this.playerOrder.indexOf(target.id);
            const next = this.players.get(this.playerOrder[(idx + 1) % this.playerOrder.length]);
            if (next && next.id !== target.id) {
                this.logs.unshift(`😴 ${target.name} ist nicht zuständig – der Angriff geht an ${next.name}!`);
                return hit(next);
            }
        }
        hit(target);
    }

    endTurn() {
        if (this.status !== 'PLAYING') return;

        // Advance to next unskipped player
        this.turnIndex = (this.turnIndex + 1) % this.playerOrder.length;
        this.cardsPlayedThisTurn = 0;
        this.botActionTimer = 1.0;
        this.turnTimer = ROULETTE_TURN_LIMIT;

        const nextP = this.getCurrentPlayer();
        if (nextP) {
            nextP.shielded = false; // Chef-Bypass hält bis zum eigenen nächsten Zug
            if (nextP.skipped) {
                nextP.skipped = false;
                this.logs.unshift(`🗣️ ${nextP.name} sitzt im 4-Stunden-Alignment und setzt aus!`);
                this.endTurn(); // Skip turn
                return;
            }
            // Draw 1 card for new turn
            nextP.hand.push(this.drawCardFromPile());
        }
    }

    update(dt) {
        if (this.status !== 'PLAYING') return;

        const curr = this.getCurrentPlayer();
        if (curr && curr.isBot) {
            this.botActionTimer -= dt;
            if (this.botActionTimer <= 0) {
                this.runBotTurn(curr);
            }
        } else if (curr) {
            // Zug-Timer: ein untätiger Mensch blockiert sonst das ganze Spiel
            this.turnTimer -= dt;
            if (this.turnTimer <= 0) {
                this.logs.unshift(`⏰ ${curr.name} war zu langsam – der Zug verfällt.`);
                this.endTurn();
            }
        }
    }

    runBotTurn(bot) {
        if (this.cardsPlayedThisTurn >= this.maxCardsPerTurn) {
            this.endTurn();
            return;
        }

        // 1. Play Progress card if available
        const progressCard = bot.hand.find(c => c.category === 'progress');
        if (progressCard) {
            this.playCard(bot.id, progressCard.uid);
            this.botActionTimer = 0.8;
            return;
        }

        // 2. Play Blocker card against leader
        const blockerCard = bot.hand.find(c => c.category === 'blocker');
        if (blockerCard) {
            // Find player with highest progress
            let leader = null;
            let maxProg = -1;
            for (const other of this.players.values()) {
                if (other.id !== bot.id && other.progress > maxProg) {
                    maxProg = other.progress;
                    leader = other;
                }
            }

            if (leader) {
                this.playCard(bot.id, blockerCard.uid, leader.id);
                this.botActionTimer = 0.8;
                return;
            }
        }

        // 3. Play Chef-Bypass
        const bypassCard = bot.hand.find(c => c.id === 'chef_genehmigung');
        if (bypassCard) {
            this.playCard(bot.id, bypassCard.uid);
            this.botActionTimer = 0.8;
            return;
        }

        // If no actions: end turn
        this.endTurn();
    }

    getSnapshot(forPlayerId = null) {
        const curr = this.getCurrentPlayer();
        const myPlayer = forPlayerId ? this.players.get(forPlayerId) : null;

        const playersList = this.playerOrder.map(pid => {
            const p = this.players.get(pid);
            return {
                id: p.id,
                name: p.name,
                color: p.color,
                isBot: p.isBot,
                progress: p.progress,
                cardCount: p.hand.length,
                shielded: p.shielded,
                skipped: p.skipped,
                isCurrentTurn: curr ? curr.id === p.id : false
            };
        });

        return {
            status: this.status,
            currentTurnPlayerId: curr ? curr.id : null,
            currentTurnName: curr ? curr.name : '',
            cardsPlayedThisTurn: this.cardsPlayedThisTurn,
            maxCardsPerTurn: this.maxCardsPerTurn,
            drawPileCount: this.drawPile.length,
            discardTop: this.discardPile[this.discardPile.length - 1] || null,
            winner: this.winner ? this.winner.name : null,
            players: playersList,
            myHand: myPlayer ? myPlayer.hand : [],
            logs: this.logs.slice(0, 10)
        };
    }
}

window.FreigabeRouletteGame = FreigabeRouletteGame;
window.ROULETTE_CARDS = ROULETTE_CARDS;
