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
const UNO_TURN_LIMIT = 45; // Sekunden, die ein Mensch für seinen Zug hat
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
        this.turnTimer = UNO_TURN_LIMIT;
        this.drewThisTurn = false;
        this.logs = [];
        this.nextCardId = 1;

        // Hausregeln (Einstellung des Hosts in der Lobby)
        this.rules = { stack: false, sevenZero: false };
        this.pendingDraw = 0;          // Strafkarten-Stapel (nur mit Stapel-Regel)
        this.pendingType = null;       // 'draw2' | 'wild4'
        this.awaitingSwap = false;     // 7-0-Regel: Spieler wählt Tauschpartner
        this.swapChooserId = null;
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
        this.stats = {};
        this.drawPile = this.createDeck();
        this.discardPile = [];
        this.direction = 1;
        this.winner = null;
        this.awaitingColorChoice = false;
        this.colorChooserPlayerId = null;
        this.pendingDraw = 0;
        this.pendingType = null;
        this.awaitingSwap = false;
        this.swapChooserId = null;
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
        this.turnTimer = UNO_TURN_LIMIT;
        this.drewThisTurn = false;

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
        if (this.awaitingColorChoice || this.awaitingSwap) return false;

        // Stapel-Regel: auf eine offene Strafe darf nur mit +2/+4 geantwortet werden
        if (this.pendingDraw > 0) {
            if (this.pendingType === 'wild4') return card.value === 'wild4';
            return card.value === 'draw2' || card.value === 'wild4';
        }

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
        if (this.awaitingSwap) return { success: false, msg: 'Warte auf Tauschpartner' };

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
                this.advanceTurn();
            } else {
                // Must choose color
                this.awaitingColorChoice = true;
                this.colorChooserPlayerId = playerId;
                return { success: true, awaitColor: true };
            }
        } else {
            this.activeColor = card.color;
            // 7-0-Regel: die 7 verlangt eine Spielerwahl, die 0 dreht alle Hände
            if (this.rules.sevenZero && card.value === '7') {
                if (this.playerOrder.length === 2) {
                    this.swapHands(playerId, this.getNextPlayer(1).id);
                    this.advanceTurn();
                } else {
                    this.awaitingSwap = true;
                    this.swapChooserId = playerId;
                    return { success: true, awaitSwap: true };
                }
            } else {
                if (this.rules.sevenZero && card.value === '0') this.rotateHands();
                this.handleActionCardEffects(card);
                this.advanceTurn();
            }
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

    // 7-0-Regel: Hände mit einem anderen Spieler tauschen
    chooseSwapTarget(playerId, targetId) {
        if (!this.awaitingSwap || playerId !== this.swapChooserId) return false;
        if (targetId === playerId || !this.players.has(targetId)) return false;
        this.awaitingSwap = false;
        this.swapChooserId = null;
        this.swapHands(playerId, targetId);
        this.advanceTurn();
        return true;
    }

    swapHands(aId, bId) {
        const a = this.players.get(aId);
        const b = this.players.get(bId);
        if (!a || !b) return;
        [a.hand, b.hand] = [b.hand, a.hand];
        a.calledUno = false;
        b.calledUno = false;
        this.logs.unshift(`🔁 ${a.name} tauscht die Hand mit ${b.name}!`);
    }

    // 7-0-Regel: alle geben ihre Hand in Spielrichtung weiter
    rotateHands() {
        const ids = this.playerOrder;
        if (ids.length < 2) return;
        const hands = ids.map(id => this.players.get(id).hand);
        ids.forEach((id, i) => {
            const from = (i - this.direction + ids.length) % ids.length;
            const p = this.players.get(id);
            p.hand = hands[from];
            p.calledUno = false;
        });
        this.logs.unshift('🔄 Alle Hände wandern weiter!');
    }

    finishWildPlay(card) {
        if (card.value === 'wild4' && this.rules.stack) {
            this.pendingDraw += 4;
            this.pendingType = 'wild4';
            const nextP = this.getNextPlayer(1);
            this.logs.unshift(`➕4 gestapelt! ${nextP ? nextP.name : 'Der Nächste'} muss kontern oder ${this.pendingDraw} Karten ziehen.`);
        } else if (card.value === 'wild4') {
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
        } else if (card.value === 'draw2' && this.rules.stack) {
            this.pendingDraw += 2;
            this.pendingType = 'draw2';
            const nextP = this.getNextPlayer(1);
            this.logs.unshift(`➕2 gestapelt! ${nextP ? nextP.name : 'Der Nächste'} muss kontern oder ${this.pendingDraw} Karten ziehen.`);
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
        if (this.awaitingColorChoice || this.awaitingSwap) return null;

        // Offene Strafe: alle gestapelten Karten ziehen und aussetzen
        if (this.pendingDraw > 0) {
            const n = this.pendingDraw;
            this.pendingDraw = 0;
            this.pendingType = null;
            this.drawCardsForPlayer(curr, n);
            bumpStat(this, curr.id, 'draws', n);
            this.logs.unshift(`${curr.name} zieht ${n} Strafkarten!`);
            this.advanceTurn();
            if (window.soundFX) window.soundFX.playClick();
            return null;
        }

        // Ohne offene Strafe: nur einmal pro Zug ziehen, danach spielen oder passen
        if (this.drewThisTurn) return null;
        this.drewThisTurn = true;

        const drawn = this.drawCardFromPile();
        curr.hand.push(drawn);
        bumpStat(this, curr.id, 'draws');
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

    // Nach dem Ziehen einer spielbaren Karte darf man passen, statt sie zu spielen
    passTurn(playerId) {
        if (this.status !== 'PLAYING' || !this.drewThisTurn) return false;
        const curr = this.getCurrentPlayer();
        if (!curr || curr.id !== playerId) return false;
        if (this.awaitingColorChoice || this.awaitingSwap || this.pendingDraw > 0) return false;
        this.logs.unshift(`${curr.name} passt`);
        this.advanceTurn();
        return true;
    }

    advanceTurn() {
        this.drewThisTurn = false;
        this.turnTimer = UNO_TURN_LIMIT;
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
        } else if (curr) {
            // Zug-Timer: ein untätiger Mensch blockiert sonst das ganze Spiel
            this.turnTimer -= dt;
            if (this.turnTimer <= 0) {
                this.logs.unshift(`⏰ ${curr.name} war zu langsam – automatischer Zug.`);
                this.runBotTurn(curr);
                // Offene Farb-/Tauschwahl gleich im nächsten Schritt erledigen
                this.turnTimer = (this.awaitingColorChoice || this.awaitingSwap) ? 1 : UNO_TURN_LIMIT;
            }
        }
    }

    runBotTurn(bot) {
        if (this.awaitingSwap && this.swapChooserId === bot.id) {
            // Swap with the player holding the fewest cards (but never a winner-in-waiting trick)
            const others = this.playerOrder.filter(id => id !== bot.id).map(id => this.players.get(id));
            others.sort((a, b) => a.hand.length - b.hand.length);
            this.chooseSwapTarget(bot.id, others[0].id);
            return;
        }
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
            awaitingSwap: this.awaitingSwap,
            swapChooserId: this.swapChooserId,
            pendingDraw: this.pendingDraw,
            pendingType: this.pendingType,
            drewThisTurn: this.drewThisTurn,
            rules: this.rules,
            winner: this.winner ? this.winner.name : null,
            players: playersList,
            myHand: myPlayer ? myPlayer.hand : [],
            logs: this.logs.slice(0, 10)
        };
    }
}

window.UnoGame = UnoGame;
