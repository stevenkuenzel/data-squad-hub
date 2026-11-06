/**
 * DataSquad Hub: Hotel-Tycoon (Immobilien-Brettspiel, 2 - 6 Spieler & Bots)
 *
 * Eigene Umsetzung der Spielidee "Hotelmagnat": Grundstücke kaufen, Hotels in Stufen ausbauen,
 * Eingänge eröffnen und bei den Mitspielern kassieren. Reine Logik ohne DOM/Renderer –
 * die 3D-Ansicht (ui/hotel3d.js) und der 2D-Rückfall lesen nur den Snapshot.
 *
 * Brett: Ring aus 32 Feldern (4 Seiten à 8). Pro Seite: Eckfeld, Grundstück A (3 Felder),
 * Sonderfeld, Grundstück B (3 Felder). Das erste Feld eines Grundstücks ist das "Kauffeld"
 * und zugleich das Haupttor des Hotels, die beiden folgenden Felder können Eingänge werden.
 */

const HOTEL_FIELD_COUNT = 32;
const HOTEL_START_MONEY = 12000;
const HOTEL_BANK_BONUS = 2000;
const HOTEL_MAX_STAGE = 5;
const HOTEL_TURN_LIMIT = 60;
const HOTEL_MAX_PLAYERS = 6;
const HOTEL_DEFAULT_ROUNDS = 15;

// Ausbaustufen (Basispreis und Übernachtungspreis, jeweils × Lage-Faktor des Grundstücks)
const HOTEL_STAGES = [
    { name: 'Hauptgebäude', cost: 1000, rate: 120 },
    { name: 'Seitenflügel', cost: 1200, rate: 260 },
    { name: 'Konferenzsaal', cost: 1500, rate: 450 },
    { name: 'Wellnessbereich', cost: 1800, rate: 700 },
    { name: 'Dachterrasse & Pool', cost: 2200, rate: 1000 }
];
const HOTEL_ENTRANCE_COST = 300;

const HOTEL_LOT_NAMES = ['Seeblick', 'Hafenpromenade', 'Gartenstraße', 'Marktplatz', 'Bahnhofsallee', 'Stadtpark', 'Altstadt', 'Skyline'];
const HOTEL_LOT_MULT = [0.8, 0.9, 1.0, 1.1, 1.3, 1.4, 1.6, 1.8];

// Ecken: Parkplatz (Start), Freier Eintritt, Bank, Rathaus. Mitte: Planungserlaubnis / Freie Bauphase.
const HOTEL_CORNERS = ['start', 'freeentry', 'bank', 'townhall'];
const HOTEL_MIDS = ['permit', 'freebuild', 'permit', 'freebuild'];
// Würfel der Planungserlaubnis (rot = abgelehnt, grün = erteilt, H = kostenlos, 2 = doppelte Kosten)
const HOTEL_PERMIT_DIE = ['denied', 'denied', 'granted', 'granted', 'free', 'double'];

function roundTo(value, step) {
    return Math.round(value / step) * step;
}

const HOTEL_LOTS = [];
const HOTEL_FIELDS = [];
for (let s = 0; s < 4; s++) {
    const base = s * 8;
    HOTEL_FIELDS[base] = { i: base, type: HOTEL_CORNERS[s], side: s };
    HOTEL_FIELDS[base + 4] = { i: base + 4, type: HOTEL_MIDS[s], side: s };
    for (let half = 0; half < 2; half++) {
        const lotId = s * 2 + half;
        const first = base + 1 + half * 4;
        const mult = HOTEL_LOT_MULT[lotId];
        HOTEL_LOTS.push({
            id: lotId,
            name: HOTEL_LOT_NAMES[lotId],
            side: s,
            fields: [first, first + 1, first + 2],
            mult,
            price: roundTo(1000 * mult, 100),
            stageCost: HOTEL_STAGES.map(st => roundTo(st.cost * mult, 50)),
            stageRate: HOTEL_STAGES.map(st => roundTo(st.rate * mult, 10)),
            entranceCost: roundTo(HOTEL_ENTRANCE_COST * mult, 50)
        });
        for (let k = 0; k < 3; k++) {
            HOTEL_FIELDS[first + k] = { i: first + k, type: 'lot', side: s, lot: lotId, slot: k };
        }
    }
}

class HotelGame {
    constructor() {
        this.players = new Map();
        this.playerOrder = [];
        this.maxRounds = HOTEL_DEFAULT_ROUNDS;
        this.stats = {};
        this.moveSeq = 0; // läuft über Partien hinweg weiter, damit Clients Animationen nicht verwechseln
        this.dice = { value: 0, seq: 0, who: null };
        this.resetState();
    }

    resetState() {
        this.status = 'LOBBY';
        this.phase = 'ROLL';          // ROLL, BUY, BUILD, PERMIT, DEBT
        this.pending = null;
        this.turnIndex = 0;
        this.round = 1;
        this.turnCounter = 0;
        this.bonusRolls = 0;
        this.lastRoll = 0;
        this.dice = { value: 0, seq: this.dice.seq, who: null };
        this.lastMove = null;
        this.lots = HOTEL_LOTS.map(l => ({ id: l.id, owner: null, stage: 0, ent: [false, false, false], boughtTurn: -1 }));
        this.logs = [];
        this.events = [];
        this.eventSeq = 0;
        this.winner = null;
        this.turnTimer = HOTEL_TURN_LIMIT;
        this.botTimer = 1.5;
        this.version = 0;
    }

    // ---------- Spieler ----------
    addPlayer(id, name, color, isBot = false) {
        if (!this.players.has(id)) {
            if (this.players.size >= HOTEL_MAX_PLAYERS) return null;
            this.players.set(id, {
                id,
                name: String(name).slice(0, 16),
                color: color || '#00f3ff',
                isBot,
                money: HOTEL_START_MONEY,
                pos: 0,
                alive: true,
                freeEntry: false
            });
            this.playerOrder.push(id);
        }
        return this.players.get(id);
    }

    removePlayer(id) {
        const wasCurrent = this.status === 'PLAYING' && this.getCurrentPlayer() && this.getCurrentPlayer().id === id;
        for (const lot of this.lots) if (lot.owner === id) this.resetLot(lot);
        this.players.delete(id);
        this.playerOrder = this.playerOrder.filter(pid => pid !== id);
        if (this.turnIndex >= this.playerOrder.length) this.turnIndex = 0;
        if (this.status === 'PLAYING') {
            if (this.aliveCount() < 2) this.endGame();
            else if (wasCurrent) this.beginTurn();
        }
        this.version++;
    }

    getCurrentPlayer() {
        return this.players.get(this.playerOrder[this.turnIndex]) || null;
    }

    alivePlayers() {
        return this.playerOrder.map(id => this.players.get(id)).filter(p => p && p.alive);
    }

    aliveCount() {
        return this.alivePlayers().length;
    }

    // ---------- Hilfen ----------
    lotOf(id) {
        return HOTEL_LOTS[id];
    }

    stageOf(lotId) {
        return this.lots[lotId].stage;
    }

    nightlyRate(lotId) {
        const st = this.stageOf(lotId);
        return st > 0 ? HOTEL_LOTS[lotId].stageRate[st - 1] : 0;
    }

    // Was in Grundstück + Gebäude investiert wurde
    invested(lotId) {
        const lot = HOTEL_LOTS[lotId];
        const state = this.lots[lotId];
        let sum = lot.price;
        for (let i = 0; i < state.stage; i++) sum += lot.stageCost[i];
        sum += state.ent.filter((e, slot) => e && slot > 0).length * lot.entranceCost;
        return sum;
    }

    sellValue(lotId) {
        return roundTo(this.invested(lotId) * 0.5, 50);
    }

    netWorth(playerId) {
        const p = this.players.get(playerId);
        if (!p) return 0;
        let sum = p.money;
        for (const lot of this.lots) if (lot.owner === playerId) sum += this.invested(lot.id);
        return sum;
    }

    ownedLots(playerId) {
        return this.lots.filter(l => l.owner === playerId);
    }

    log(msg) {
        this.logs.unshift(msg);
        if (this.logs.length > 14) this.logs.length = 14;
        this.version++;
    }

    addEvent(type, pid, amount, field) {
        this.events.push({ seq: ++this.eventSeq, type, pid, amount, field });
        if (this.events.length > 8) this.events.shift();
    }

    rand(n) {
        return Math.floor(Math.random() * n) + 1;
    }

    resetLot(lot) {
        lot.owner = null;
        lot.stage = 0;
        lot.ent = [false, false, false];
        lot.boughtTurn = -1;
    }

    // ---------- Spielstart / Zugfolge ----------
    startMatch(maxRounds = this.maxRounds) {
        if (this.players.size < 2) return false;
        const keep = this.maxRounds;
        this.resetState();
        this.maxRounds = Math.max(1, maxRounds || keep);
        this.stats = {};
        // zufällige Startreihenfolge
        this.playerOrder = shuffleArray(Array.from(this.players.keys()));
        for (const p of this.players.values()) {
            p.money = HOTEL_START_MONEY;
            p.pos = 0;
            p.alive = true;
            p.freeEntry = false;
        }
        this.status = 'PLAYING';
        this.turnIndex = 0;
        this.log(`🏨 Los geht's! ${this.maxRounds} Runden – wer am Ende das größte Vermögen hat, gewinnt.`);
        this.beginTurn(false);
        return true;
    }

    beginTurn(counted = true) {
        if (counted) this.turnCounter++;
        this.phase = 'ROLL';
        this.pending = null;
        this.bonusRolls = 0;
        this.turnTimer = HOTEL_TURN_LIMIT;
        this.botTimer = 1.3;
        const cur = this.getCurrentPlayer();
        if (cur) this.log(`🎲 ${cur.name} ist dran.`);
        this.version++;
    }

    endTurn() {
        if (this.status !== 'PLAYING') return;
        this.pending = null;
        const prev = this.turnIndex;
        let guard = 0;
        do {
            this.turnIndex = (this.turnIndex + 1) % this.playerOrder.length;
            guard++;
        } while (guard <= this.playerOrder.length && !this.getCurrentPlayer().alive);
        if (this.turnIndex <= prev) {
            this.round++;
            if (this.round > this.maxRounds) {
                this.endGame();
                return;
            }
            this.log(`🔔 Runde ${this.round} von ${this.maxRounds}`);
        }
        this.beginTurn();
    }

    endGame() {
        this.status = 'GAME_OVER';
        this.phase = 'ROLL';
        this.pending = null;
        const alive = this.alivePlayers();
        let best = null;
        for (const p of alive) {
            bumpStat(this, p.id, 'wealth', this.netWorth(p.id), true);
            if (!best || this.netWorth(p.id) > this.netWorth(best.id)) best = p;
        }
        this.winner = best ? { id: best.id, name: best.name } : null;
        if (best) this.log(`🏆 ${best.name} gewinnt mit ${this.netWorth(best.id)} Vermögen!`);
        this.version++;
    }

    // ---------- Aktionen (Host-autoritativ) ----------
    isTurnOf(playerId) {
        const cur = this.getCurrentPlayer();
        return this.status === 'PLAYING' && !!cur && cur.id === playerId && cur.alive;
    }

    act(playerId, action, arg) {
        if (!this.isTurnOf(playerId)) return false;
        switch (action) {
            case 'roll': return this.roll(playerId);
            case 'buy': return this.buy(playerId);
            case 'decline': return this.decline(playerId);
            case 'build': return this.build(playerId, arg);
            case 'skip': return this.skipBuild(playerId);
            case 'permit': return this.chooseBuilding(playerId, arg);
            case 'sell': return this.sell(playerId, arg);
            case 'giveup': return this.giveUp(playerId);
            default: return false;
        }
    }

    roll(playerId) {
        if (!this.isTurnOf(playerId) || this.phase !== 'ROLL') return false;
        const p = this.players.get(playerId);
        const value = this.rand(6);
        this.dice = { value, seq: this.dice.seq + 1, who: playerId };
        this.lastRoll = value;
        this.log(`🎲 ${p.name} würfelt eine ${value}.`);
        this.moveBy(p, value);
        this.botTimer = 3.6; // Würfel- und Fahranimation abwarten
        this.resolveLanding(p);
        return true;
    }

    moveBy(p, steps) {
        const from = p.pos;
        let pos = p.pos;
        let remaining = steps;
        const occupied = new Set(this.alivePlayers().filter(o => o.id !== p.id).map(o => o.pos));
        while (remaining > 0 || occupied.has(pos)) {
            pos = (pos + 1) % HOTEL_FIELD_COUNT;
            remaining--;
            const type = HOTEL_FIELDS[pos].type;
            if (type === 'bank' && this.aliveCount() > 2) {
                p.money += HOTEL_BANK_BONUS;
                this.addEvent('money', p.id, HOTEL_BANK_BONUS, pos);
                this.log(`🏦 ${p.name} kommt an der Bank vorbei: +${HOTEL_BANK_BONUS}.`);
            } else if (type === 'townhall') {
                this.townhallEntrances(p);
            }
        }
        p.pos = pos;
        this.lastMove = { id: p.id, from, to: pos, seq: ++this.moveSeq };
        this.version++;
    }

    townhallEntrances(p) {
        let placed = 0;
        for (const lot of this.ownedLots(p.id)) {
            if (lot.stage < 1) continue;
            const slot = [1, 2].find(s => !lot.ent[s]);
            if (slot) {
                lot.ent[slot] = true;
                placed++;
            }
        }
        if (placed > 0) this.log(`🏛️ Rathaus: ${p.name} bekommt ${placed} neuen Eingang (kostenlos).`);
    }

    resolveLanding(p) {
        const field = HOTEL_FIELDS[p.pos];
        switch (field.type) {
            case 'lot': this.landOnLot(p, field); return;
            case 'permit': this.landOnPermit(p); return;
            case 'freebuild':
                this.log(`🏗️ ${p.name}: Freie Bauphase!`);
                this.offerBuilding(p, 'free');
                return;
            case 'freeentry':
                p.freeEntry = true;
                this.log(`🎟️ ${p.name} hat Freien Eintritt: die nächste Übernachtung ist gratis.`);
                break;
            default: break;
        }
        this.afterAction();
    }

    landOnLot(p, field) {
        const lot = this.lots[field.lot];
        const def = HOTEL_LOTS[field.lot];
        if (lot.owner === null) {
            if (field.slot === 0 && p.money >= def.price) {
                this.setPending('BUY', { type: 'buy', lot: lot.id, price: def.price, forced: false });
                return;
            }
        } else if (lot.owner === p.id) {
            const options = this.landingBuildOptions(p, field);
            if (options.length > 0) {
                this.setPending('BUILD', { type: 'build', options });
                return;
            }
        } else if (field.slot === 0 && lot.stage === 0) {
            // Fremdes Land ohne Gebäude: Pflichtkauf zum halben Preis
            const price = roundTo(def.price / 2, 50);
            if (p.money >= price) {
                this.setPending('BUY', { type: 'buy', lot: lot.id, price, forced: true });
                return;
            }
        } else if (lot.stage >= 1 && (field.slot === 0 || lot.ent[field.slot])) {
            this.collectRent(p, lot, def);
            return;
        }
        this.afterAction();
    }

    collectRent(p, lot, def) {
        const owner = this.players.get(lot.owner);
        const nights = this.rand(6);
        const rate = def.stageRate[lot.stage - 1];
        let amount = nights * rate;
        if (p.freeEntry) {
            p.freeEntry = false;
            this.log(`🎟️ ${p.name} übernachtet gratis in ${def.name} (${nights} Nächte × ${rate}).`);
            this.afterAction();
            return;
        }
        this.log(`🛏️ ${p.name} bleibt ${nights} Nächte im ${lot.stage}-Sterne-Hotel "${def.name}": ${amount} an ${owner.name}.`);
        bumpStat(this, owner.id, 'rent', amount);
        amount = Math.round(amount);
        this.charge(p, amount, owner);
    }

    // Zahlung an Spieler (creditor) oder Bank (creditor = null). Zu wenig Geld -> Schuldenphase.
    charge(p, amount, creditor) {
        if (p.money >= amount) {
            this.transfer(p, amount, creditor);
            this.afterAction();
            return;
        }
        this.setPending('DEBT', { type: 'debt', amount, creditor: creditor ? creditor.id : null });
        this.log(`💸 ${p.name} kann ${amount} nicht zahlen und muss Hotels verkaufen!`);
        this.checkDebt(p);
    }

    transfer(p, amount, creditor) {
        p.money -= amount;
        this.addEvent('money', p.id, -amount, p.pos);
        if (creditor) {
            creditor.money += amount;
            this.addEvent('money', creditor.id, amount, p.pos);
        }
        this.version++;
    }

    // Schuldenphase prüfen: gezahlt, weiter, oder pleite
    checkDebt(p) {
        if (!this.pending || this.pending.type !== 'debt') return;
        const debt = this.pending;
        const creditor = debt.creditor ? this.players.get(debt.creditor) : null;
        if (p.money >= debt.amount) {
            this.pending = null;
            this.transfer(p, debt.amount, creditor);
            this.afterAction();
        } else if (this.ownedLots(p.id).length === 0) {
            this.bankrupt(p, creditor);
        }
    }

    sell(playerId, lotId) {
        const p = this.players.get(playerId);
        if (this.phase !== 'DEBT' || !this.pending || !p) return false;
        const lot = this.lots[lotId];
        if (!lot || lot.owner !== playerId) return false;
        const value = this.sellValue(lotId);
        p.money += value;
        this.addEvent('money', p.id, value, p.pos);
        this.log(`🔨 ${p.name} verkauft "${HOTEL_LOTS[lotId].name}" an die Bank für ${value}.`);
        this.resetLot(lot);
        this.checkDebt(p);
        this.version++;
        return true;
    }

    giveUp(playerId) {
        const p = this.players.get(playerId);
        if (this.phase !== 'DEBT' || !this.pending || !p) return false;
        const creditor = this.pending.creditor ? this.players.get(this.pending.creditor) : null;
        this.bankrupt(p, creditor);
        return true;
    }

    bankrupt(p, creditor) {
        if (creditor) {
            creditor.money += p.money;
            this.addEvent('money', creditor.id, p.money, p.pos);
        }
        p.money = 0;
        p.alive = false;
        for (const lot of this.ownedLots(p.id)) this.resetLot(lot);
        this.log(`💥 ${p.name} ist pleite und scheidet aus!`);
        this.pending = null;
        if (this.aliveCount() < 2) {
            this.endGame();
            return;
        }
        this.endTurn();
    }

    // Auto-Verkauf (Timer-Ablauf / Bots): günstigste Hotels zuerst
    autoLiquidate(p) {
        while (this.phase === 'DEBT' && this.pending) {
            const lots = this.ownedLots(p.id).sort((a, b) => this.sellValue(a.id) - this.sellValue(b.id));
            if (lots.length === 0) {
                this.giveUp(p.id);
                return;
            }
            this.sell(p.id, lots[0].id);
        }
    }

    setPending(phase, pending) {
        this.phase = phase;
        this.pending = pending;
        this.turnTimer = HOTEL_TURN_LIMIT;
        this.version++;
    }

    buy(playerId) {
        const p = this.players.get(playerId);
        if (this.phase !== 'BUY' || !this.pending || !p || p.money < this.pending.price) return false;
        const lot = this.lots[this.pending.lot];
        const def = HOTEL_LOTS[lot.id];
        const price = this.pending.price;
        const prevOwner = lot.owner ? this.players.get(lot.owner) : null;
        this.transfer(p, price, prevOwner);
        lot.owner = p.id;
        lot.boughtTurn = this.turnCounter;
        bumpStat(this, p.id, 'lots');
        this.log(`🏷️ ${p.name} kauft "${def.name}" für ${price}${this.pending.forced ? ' (Pflichtkauf zum halben Preis)' : ''}.`);
        this.afterAction();
        return true;
    }

    decline() {
        if (this.phase !== 'BUY' || !this.pending) return false;
        if (this.pending.forced) return false; // Pflichtkauf
        this.afterAction();
        return true;
    }

    // Bauoptionen beim Landen auf eigenem Grundstück: Stufe am Haupttor, Eingang an Slot 1/2
    landingBuildOptions(p, field) {
        const lot = this.lots[field.lot];
        const def = HOTEL_LOTS[field.lot];
        const options = [];
        if (field.slot === 0) {
            if (lot.stage < HOTEL_MAX_STAGE && lot.boughtTurn !== this.turnCounter) {
                options.push({ kind: 'stage', lot: lot.id, cost: def.stageCost[lot.stage] });
            }
        } else if (lot.stage >= 1 && !lot.ent[field.slot]) {
            options.push({ kind: 'entrance', lot: lot.id, slot: field.slot, cost: def.entranceCost });
        }
        return options.filter(o => o.cost <= p.money);
    }

    build(playerId, index) {
        const p = this.players.get(playerId);
        if (this.phase !== 'BUILD' || !this.pending || !p) return false;
        const opt = this.pending.options[index];
        if (!opt || opt.cost > p.money) return false;
        this.applyBuild(p, opt, opt.cost);
        this.afterAction();
        return true;
    }

    applyBuild(p, opt, cost) {
        const lot = this.lots[opt.lot];
        const def = HOTEL_LOTS[opt.lot];
        if (cost > 0) this.transfer(p, cost, null);
        if (opt.kind === 'stage') {
            lot.stage++;
            if (lot.stage === 1) lot.ent[0] = true;
            const name = HOTEL_STAGES[lot.stage - 1].name;
            this.log(`🏗️ ${p.name} baut in "${def.name}": ${name} (${lot.stage}★)${cost === 0 ? ' – kostenlos!' : ` für ${cost}`}.`);
        } else {
            lot.ent[opt.slot] = true;
            this.log(`🚪 ${p.name} eröffnet einen Eingang bei "${def.name}"${cost === 0 ? ' – kostenlos!' : ` für ${cost}`}.`);
        }
        bumpStat(this, p.id, 'built');
        this.addEvent('build', p.id, cost, def.fields[opt.slot || 0]);
        this.version++;
    }

    skipBuild() {
        if (this.phase !== 'BUILD' || !this.pending) return false;
        this.afterAction();
        return true;
    }

    // ---------- Baugenehmigung ----------
    landOnPermit(p) {
        const result = HOTEL_PERMIT_DIE[this.rand(6) - 1];
        const label = { denied: 'abgelehnt ❌', granted: 'erteilt ✅', free: 'kostenlos erteilt 🆓', double: 'erteilt – aber doppelte Kosten ⚠️' }[result];
        this.log(`📋 ${p.name}: Baugenehmigung ${label}`);
        if (result === 'denied') {
            this.afterAction();
            return;
        }
        this.offerBuilding(p, result === 'granted' ? 'normal' : result);
    }

    // Baugenehmigung / Freie Bauphase: nächste Stufe an einem beliebigen eigenen Hotel (Pflicht, falls möglich)
    offerBuilding(p, mode) {
        const factor = mode === 'free' ? 0 : (mode === 'double' ? 2 : 1);
        const options = [];
        for (const lot of this.ownedLots(p.id)) {
            if (lot.stage >= HOTEL_MAX_STAGE) continue;
            const cost = HOTEL_LOTS[lot.id].stageCost[lot.stage] * factor;
            if (cost <= p.money) options.push({ kind: 'stage', lot: lot.id, cost });
        }
        if (options.length === 0) {
            this.log(`${p.name} hat nichts zum Bauen.`);
            this.afterAction();
            return;
        }
        this.setPending('PERMIT', { type: 'permit', mode, options });
    }

    chooseBuilding(playerId, lotId) {
        const p = this.players.get(playerId);
        if (this.phase !== 'PERMIT' || !this.pending || !p) return false;
        const opt = this.pending.options.find(o => o.lot === lotId);
        if (!opt) return false;
        this.applyBuild(p, opt, opt.cost);
        this.afterAction();
        return true;
    }

    // ---------- Zugende ----------
    afterAction() {
        this.pending = null;
        this.phase = 'ROLL';
        if (this.status !== 'PLAYING') return;
        const p = this.getCurrentPlayer();
        bumpStat(this, p.id, 'wealth', this.netWorth(p.id), true);
        if (p.alive && this.lastRoll === 6 && this.bonusRolls < 2) {
            this.bonusRolls++;
            this.lastRoll = 0;
            this.turnTimer = HOTEL_TURN_LIMIT;
            this.log(`🎉 ${p.name} hat eine 6 gewürfelt und darf nochmal!`);
            this.version++;
            return;
        }
        this.lastRoll = 0;
        this.endTurn();
    }

    // ---------- Update / Bots ----------
    update(dt) {
        if (this.status !== 'PLAYING') return;
        const cur = this.getCurrentPlayer();
        if (!cur) return;
        if (cur.isBot) {
            this.botTimer -= dt;
            if (this.botTimer <= 0) {
                this.botTimer = 1.2 + Math.random() * 0.6;
                this.botAct(cur);
            }
        } else {
            const before = Math.ceil(this.turnTimer);
            this.turnTimer -= dt;
            if (Math.ceil(this.turnTimer) !== before) this.version++;
            if (this.turnTimer <= 0) {
                this.log(`⏰ ${cur.name} war zu langsam – Zug wird automatisch beendet.`);
                this.autoAct(cur, false);
                this.turnTimer = HOTEL_TURN_LIMIT;
            }
        }
    }

    // smart = Bot (kauft/baut sinnvoll), sonst Timeout (überspringt freiwillige Aktionen)
    autoAct(p, smart) {
        switch (this.phase) {
            case 'ROLL': this.roll(p.id); break;
            case 'BUY': {
                const reserve = smart ? 1500 : Infinity;
                if (this.pending.forced || p.money - this.pending.price >= reserve) this.buy(p.id);
                else this.decline(p.id);
                break;
            }
            case 'BUILD': {
                const idx = this.pending.options.findIndex(o => smart && p.money - o.cost >= 1200);
                if (idx >= 0) this.build(p.id, idx);
                else this.skipBuild(p.id);
                break;
            }
            case 'PERMIT': {
                const best = this.pending.options.slice().sort((a, b) => this.stageOf(b.lot) - this.stageOf(a.lot))[0];
                this.chooseBuilding(p.id, best.lot);
                break;
            }
            case 'DEBT': this.autoLiquidate(p); break;
            default: break;
        }
    }

    botAct(bot) {
        this.autoAct(bot, true);
    }

    // ---------- Netzwerk ----------
    getSnapshot() {
        const players = this.playerOrder.map(id => this.players.get(id)).filter(Boolean).map(p => ({
            id: p.id, name: p.name, color: p.color, isBot: !!p.isBot, money: Math.round(p.money),
            pos: p.pos, alive: p.alive, freeEntry: p.freeEntry, net: Math.round(this.netWorth(p.id))
        }));
        const cur = this.getCurrentPlayer();
        return {
            status: this.status,
            phase: this.phase,
            round: this.round,
            maxRounds: this.maxRounds,
            turnId: cur ? cur.id : null,
            turnTimer: Math.max(0, Math.ceil(this.turnTimer)),
            dice: this.dice,
            lastMove: this.lastMove,
            players,
            lots: this.lots.map(l => ({ id: l.id, owner: l.owner, stage: l.stage, ent: l.ent.slice() })),
            pending: this.pending ? JSON.parse(JSON.stringify(this.pending)) : null,
            logs: this.logs.slice(0, 10),
            events: this.events.slice(),
            winner: this.winner
        };
    }

    applySnapshot(snap) {
        if (!snap) return;
        this.status = snap.status;
        this.phase = snap.phase;
        this.round = snap.round;
        this.maxRounds = snap.maxRounds;
        this.turnTimer = snap.turnTimer;
        this.dice = snap.dice;
        this.lastMove = snap.lastMove;
        this.pending = snap.pending;
        this.logs = snap.logs || [];
        this.events = snap.events || [];
        this.winner = snap.winner;
        this.lots = snap.lots.map(l => ({ ...l, boughtTurn: -1 }));

        const ids = new Set(snap.players.map(p => p.id));
        for (const id of Array.from(this.players.keys())) if (!ids.has(id)) this.players.delete(id);
        this.playerOrder = snap.players.map(p => p.id);
        for (const sp of snap.players) {
            let p = this.players.get(sp.id);
            if (!p) {
                this.players.set(sp.id, { ...sp });
            } else {
                Object.assign(p, sp);
            }
        }
        this.turnIndex = Math.max(0, this.playerOrder.indexOf(snap.turnId));
    }
}

window.HotelGame = HotelGame;
window.HOTEL_FIELDS = HOTEL_FIELDS;
window.HOTEL_LOTS = HOTEL_LOTS;
window.HOTEL_STAGES = HOTEL_STAGES;
window.HOTEL_START_MONEY = HOTEL_START_MONEY;
