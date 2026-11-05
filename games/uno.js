/**
 * DataSquad Hub: UNO (P2P WebRTC Multiplayer)
 * 2 - 8 Spieler & Bots
 * 
 * Enthält:
 * - 4 Neon-Farben: Rot, Blau, Grün, Gelb + Schwarze Aktionskarten (Wild & Wild +4)
 * - Standard-Regeln: 0-9, Aussetzen, Richtungswechsel, +2, Farbwahl, Farbwahl +4
 * - "UNO!"-Ausruf
 * - Host-Authoritative State & Datensicherheit (Gegner-Karten bleiben geheim)
 */

const UNO_COLORS = ['red', 'blue', 'green', 'yellow'];
const UNO_VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2'];

class UnoGame {
    constructor() {
        this.players = new Map(); // id -> { id, name, color, isBot, hand: Card[], calledUno: boolean }
        this.playerOrder = [];    // array of playerIds
        this.turnIndex = 0;
        this.direction = 1;       // 1 = im Uhrzeigersinn, -1 = gegen Uhrzeigersinn
        this.drawPile = [];
        this.discardPile = [];
        this.activeColor = 'red'; // current valid color (especially after wild)
        this.status = 'LOBBY';    // LOBBY, PLAYING, GAME_OVER
        this.winner = null;
        this.awaitingColorChoice = false;
        this.colorChooserPlayerId = null;
        this.botActionTimer = 0;
        this.logs = [];
        this.nextCardId = 1;
    }

    addPlayer(id, name, color, isBot = false) {
        if (!this.players.has(id)) {
            this.players.set(id, {
                id,
                name: String(name).slice(0, 16),
                color: color || '#00f3ff',
                isBot,
                hand: [],
                calledUno: false
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
        // Numbered & Action cards
        for (const col of UNO_COLORS) {
            // One '0' per color
            deck.push({ id: this.nextCardId++, color: col, value: '0' });
            // Two of each 1-9, skip, reverse, draw2
            for (let i = 1; i <= 9; i++) {
                deck.push({ id: this.nextCardId++, color: col, value: String(i) });
                deck.push({ id: this.nextCardId++, color: col, value: String(i) });
            }
            deck.push({ id: this.nextCardId++, color: col, value: 'skip' });
            deck.push({ id: this.nextCardId++, color: col, value: 'skip' });
            deck.push({ id: this.nextCardId++, color: col, value: 'reverse' });
            deck.push({ id: this.nextCardId++, color: col, value: 'reverse' });
            deck.push({ id: this.nextCardId++, color: col, value: 'draw2' });
            deck.push({ id: this.nextCardId++, color: col, value: 'draw2' });
        }
        // Wild cards (4x Wild, 4x Wild Draw 4)
        for (let i = 0; i < 4; i++) {
            deck.push({ id: this.nextCardId++, color: 'wild', value: 'wild' });
            deck.push({ id: this.nextCardId++, color: 'wild', value: 'wild4' });
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
        this.direction = 1;
        this.winner = null;
        this.awaitingColorChoice = false;
        this.colorChooserPlayerId = null;
        this.logs = ['Das UNO-Match beginnt!'];

        // Deal 7 cards to each player
        for (const p of this.players.values()) {
            p.hand = [];
            p.calledUno = false;
            for (let i = 0; i < 7; i++) {
                p.hand.push(this.drawCardFromPile());
            }
        }

        // Top card from draw pile (must not be wild4 to start)
        let firstCard = this.drawCardFromPile();
        while (firstCard.value === 'wild4') {
            this.drawPile.unshift(firstCard);
            this.drawPile = this.shuffle(this.drawPile);
            firstCard = this.drawCardFromPile();
        }

        this.discardPile.push(firstCard);
        this.activeColor = firstCard.color === 'wild' ? UNO_COLORS[Math.floor(Math.random() * 4)] : firstCard.color;
        this.turnIndex = 0;
        this.status = 'PLAYING';
        this.botActionTimer = 1.0;

        this.logs.unshift(`Startkarte: ${this.formatCardName(firstCard)}`);
        return true;
    }

    drawCardFromPile() {
        if (this.drawPile.length === 0) {
            // Reshuffle discard pile except top card
            if (this.discardPile.length <= 1) {
                // Failsafe fallback: generate fresh deck
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

    getTopCard() {
        return this.discardPile[this.discardPile.length - 1] || null;
    }

    isCardPlayable(card) {
        if (this.awaitingColorChoice) return false;
        const top = this.getTopCard();
        if (!top) return true;

        // Wild cards are always playable
        if (card.color === 'wild') return true;

        // Matches active color
        if (card.color === this.activeColor) return true;

        // Matches top card value
        if (card.value === top.value) return true;

        return false;
    }

    playCard(playerId, cardId, chosenColor = null) {
        if (this.status !== 'PLAYING') return { success: false, msg: 'Spiel läuft nicht' };
        if (this.awaitingColorChoice && playerId !== this.colorChooserPlayerId) {
            return { success: false, msg: 'Warte auf Farbwahl' };
        }

        const player = this.players.get(playerId);
        const curr = this.getCurrentPlayer();
        if (!player || !curr || curr.id !== playerId) {
            return { success: false, msg: 'Nicht an der Reihe' };
        }

        const cardIdx = player.hand.findIndex(c => c.id === cardId);
        if (cardIdx === -1) return { success: false, msg: 'Karte nicht auf der Hand' };

        const card = player.hand[cardIdx];
        if (!this.isCardPlayable(card)) {
            return { success: false, msg: 'Diese Karte kann nicht gelegt werden' };
        }

        // Remove from hand and push to discard pile
        player.hand.splice(cardIdx, 1);
        this.discardPile.push(card);

        // Check if Uno was called when down to 1 card
        if (player.hand.length === 1 && !player.calledUno) {
            // In casual play, auto-call or allow a grace period
            player.calledUno = true;
            this.logs.unshift(`🔔 ${player.name} ruft "UNO!" (1 Karte übrig!)`);
            if (window.soundFX) window.soundFX.playClick();
        }

        this.logs.unshift(`${player.name} legt ${this.formatCardName(card)}`);

        // Check win condition
        if (player.hand.length === 0) {
            this.status = 'GAME_OVER';
            this.winner = player;
            this.logs.unshift(`🎉 ${player.name} hat alle Karten abgelegt und gewinnt das UNO-Spiel!`);
            if (window.soundFX) window.soundFX.playWin();
            return { success: true, won: true };
        }

        // Apply card effects
        if (card.color === 'wild') {
            if (chosenColor && UNO_COLORS.includes(chosenColor)) {
                this.activeColor = chosenColor;
                this.finishWildPlay(card);
            } else {
                // Must choose color
                this.awaitingColorChoice = true;
                this.colorChooserPlayerId = playerId;
                return { success: true, awaitColor: true };
            }
        } else {
            this.activeColor = card.color;
            this.handleActionCardEffects(card);
            this.advanceTurn();
        }

        if (window.soundFX) window.soundFX.playClick();
        return { success: true };
    }

    chooseWildColor(playerId, color) {
        if (!this.awaitingColorChoice || playerId !== this.colorChooserPlayerId) return false;
        if (!UNO_COLORS.includes(color)) return false;

        this.activeColor = color;
        this.awaitingColorChoice = false;
        this.colorChooserPlayerId = null;

        const card = this.getTopCard();
        this.logs.unshift(`Farbwahl: ${this.getColorLabel(color)}`);
        this.finishWildPlay(card);
        this.advanceTurn();
        return true;
    }

    finishWildPlay(card) {
        if (card.value === 'wild4') {
            const nextP = this.getNextPlayer(1);
            if (nextP) {
                this.drawCardsForPlayer(nextP, 4);
                this.logs.unshift(`➕4 für ${nextP.name}! (+4 Karten & aussetzen)`);
                // Skip next player
                this.advanceTurn();
            }
        }
    }

    handleActionCardEffects(card) {
        if (card.value === 'skip') {
            const nextP = this.getNextPlayer(1);
            this.logs.unshift(`🚫 ${nextP ? nextP.name : 'Nächster'} setzt aus!`);
            this.advanceTurn();
        } else if (card.value === 'reverse') {
            if (this.playerOrder.length === 2) {
                // In 2-player game, reverse acts as a skip
                this.logs.unshift(`🔄 Richtungswechsel (Aussetzen im Duell)!`);
                this.advanceTurn();
            } else {
                this.direction = -this.direction;
                this.logs.unshift(`🔄 Richtungswechsel!`);
            }
        } else if (card.value === 'draw2') {
            const nextP = this.getNextPlayer(1);
            if (nextP) {
                this.drawCardsForPlayer(nextP, 2);
                this.logs.unshift(`➕2 für ${nextP.name}! (+2 Karten & aussetzen)`);
                this.advanceTurn();
            }
        }
    }

    playerDrawCard(playerId) {
        if (this.status !== 'PLAYING') return null;
        const curr = this.getCurrentPlayer();
        if (!curr || curr.id !== playerId) return null;

        const drawn = this.drawCardFromPile();
        curr.hand.push(drawn);
        curr.calledUno = false;
        this.logs.unshift(`${curr.name} zieht 1 Karte`);

        // If drawn card is not playable, pass turn immediately
        if (!this.isCardPlayable(drawn)) {
            this.advanceTurn();
        }
        if (window.soundFX) window.soundFX.playClick();
        return drawn;
    }

    drawCardsForPlayer(player, count) {
        for (let i = 0; i < count; i++) {
            player.hand.push(this.drawCardFromPile());
        }
        player.calledUno = false;
    }

    callUno(playerId) {
        const player = this.players.get(playerId);
        if (player && player.hand.length <= 2) {
            player.calledUno = true;
            this.logs.unshift(`🔔 ${player.name} ruft "UNO!"`);
            if (window.soundFX) window.soundFX.playGap();
            return true;
        }
        return false;
    }

    getNextPlayer(offset = 1) {
        if (this.playerOrder.length === 0) return null;
        let nextIdx = (this.turnIndex + this.direction * offset) % this.playerOrder.length;
        if (nextIdx < 0) nextIdx += this.playerOrder.length;
        return this.players.get(this.playerOrder[nextIdx]);
    }

    advanceTurn() {
        this.turnIndex = (this.turnIndex + this.direction) % this.playerOrder.length;
        if (this.turnIndex < 0) this.turnIndex += this.playerOrder.length;
        this.botActionTimer = 0.9 + Math.random() * 0.5; // Bot reaction delay
    }

    update(dt) {
        if (this.status !== 'PLAYING') return;

        const curr = this.getCurrentPlayer();
        if (curr && curr.isBot) {
            this.botActionTimer -= dt;
            if (this.botActionTimer <= 0) {
                this.runBotTurn(curr);
            }
        }
    }

    runBotTurn(bot) {
        if (this.awaitingColorChoice && this.colorChooserPlayerId === bot.id) {
            // Pick most frequent color in bot's hand
            const colorCounts = { red: 0, blue: 0, green: 0, yellow: 0 };
            for (const c of bot.hand) {
                if (c.color !== 'wild') colorCounts[c.color]++;
            }
            let bestCol = 'red';
            let maxCount = -1;
            for (const [col, count] of Object.entries(colorCounts)) {
                if (count > maxCount) {
                    maxCount = count;
                    bestCol = col;
                }
            }
            this.chooseWildColor(bot.id, bestCol);
            return;
        }

        // Call UNO if 2 cards before playing
        if (bot.hand.length === 2 && Math.random() < 0.95) {
            this.callUno(bot.id);
        }

        // Find playable cards
        const playable = bot.hand.filter(c => this.isCardPlayable(c));

        if (playable.length > 0) {
            // Prefer colored cards over wild cards to save wilds
            const nonWilds = playable.filter(c => c.color !== 'wild');
            const chosen = nonWilds.length > 0
                ? nonWilds[Math.floor(Math.random() * nonWilds.length)]
                : playable[0];

            let pickColor = null;
            if (chosen.color === 'wild') {
                const colorCounts = { red: 0, blue: 0, green: 0, yellow: 0 };
                for (const c of bot.hand) {
                    if (c.color !== 'wild') colorCounts[c.color]++;
                }
                pickColor = Object.keys(colorCounts).reduce((a, b) => colorCounts[a] > colorCounts[b] ? a : b);
            }

            this.playCard(bot.id, chosen.id, pickColor);
        } else {
            // No playable card: draw
            const drawn = this.playerDrawCard(bot.id);
            if (drawn && this.isCardPlayable(drawn)) {
                let pickColor = null;
                if (drawn.color === 'wild') pickColor = 'blue';
                this.playCard(bot.id, drawn.id, pickColor);
            }
        }
    }

    formatCardName(card) {
        if (!card) return 'Keine';
        const colMap = { red: 'Rot', blue: 'Blau', green: 'Grün', yellow: 'Gelb', wild: '🌈' };
        const valMap = {
            skip: '🚫 Aussetzen',
            reverse: '🔄 Richtungswechsel',
            draw2: '➕2',
            wild: 'Farbwahl',
            wild4: 'Farbwahl ➕4'
        };
        const valStr = valMap[card.value] || card.value;
        const colStr = colMap[card.color] || card.color;
        return `${colStr} ${valStr}`;
    }

    getColorLabel(c) {
        const colMap = { red: '🔴 Rot', blue: '🔵 Blau', green: '🟢 Grün', yellow: '🟡 Gelb' };
        return colMap[c] || c;
    }

    getSnapshot(forPlayerId = null) {
        const curr = this.getCurrentPlayer();
        const myPlayer = forPlayerId ? this.players.get(forPlayerId) : null;

        // Player roster: only include opponent card COUNTS, never their actual cards (Security & Anti-Cheat)
        const playersList = this.playerOrder.map(pid => {
            const p = this.players.get(pid);
            return {
                id: p.id,
                name: p.name,
                color: p.color,
                isBot: p.isBot,
                cardCount: p.hand.length,
                calledUno: p.calledUno,
                isCurrentTurn: curr ? curr.id === p.id : false
            };
        });

        return {
            status: this.status,
            activeColor: this.activeColor,
            direction: this.direction,
            topCard: this.getTopCard(),
            currentTurnPlayerId: curr ? curr.id : null,
            currentTurnName: curr ? curr.name : '',
            drawPileCount: this.drawPile.length,
            awaitingColorChoice: this.awaitingColorChoice,
            colorChooserPlayerId: this.colorChooserPlayerId,
            winner: this.winner ? this.winner.name : null,
            players: playersList,
            myHand: myPlayer ? myPlayer.hand : [],
            logs: this.logs.slice(0, 10)
        };
    }
}

window.UnoGame = UnoGame;
