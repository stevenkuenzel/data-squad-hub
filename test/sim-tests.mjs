/**
 * DataSquad Hub: Automated Game Engine & Physics Simulation Test Suite
 * Executes deterministic physics, collision, state, and rule tests for all 5 games.
 */

import { readFileSync } from 'fs';
import { createContext, runInContext } from 'vm';

// Deterministic randomness: seedable PRNG (mulberry32) replaces Math.random for the whole run.
// Override with TEST_SEED=<int> to explore other seeds.
const TEST_SEED = Number.parseInt(process.env.TEST_SEED ?? '1337', 10);
{
    let a = TEST_SEED >>> 0;
    Math.random = () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
console.log(`Using TEST_SEED=${TEST_SEED}`);

// Create a browser-like sandbox
const sandbox = {
    window: {},
    console: console,
    Math: Math,
    Date: Date,
    Array: Array,
    Map: Map,
    Set: Set,
    String: String,
    parseInt: parseInt,
    URL: URL,
    encodeURIComponent: encodeURIComponent,
    Infinity: Infinity,
    performance: { now: () => Date.now() },
    soundFX: {
        playClick: () => {},
        playDie: () => {},
        playWin: () => {},
        playGap: () => {},
        playCountdown: () => {}
    }
};
sandbox.window = sandbox;
createContext(sandbox);

// Load game files into sandbox (shared helpers first)
runInContext(readFileSync('./games/utils.js', 'utf-8'), sandbox);
const tankSrc = readFileSync('./games/tank.js', 'utf-8');
const pongSrc = readFileSync('./games/pong.js', 'utf-8');
const skribblSrc = readFileSync('./games/skribbl.js', 'utf-8');
const codenamesSrc = readFileSync('./games/codenames.js', 'utf-8');
const curveSrc = readFileSync('./games/curve.js', 'utf-8');
const unoSrc = readFileSync('./games/uno.js', 'utf-8');
const dodgeballSrc = readFileSync('./games/dodgeball.js', 'utf-8');
const rouletteSrc = readFileSync('./games/roulette.js', 'utf-8');
const eveningSrc = readFileSync('./games/evening.js', 'utf-8');
const qrSrc = readFileSync('./games/qr.js', 'utf-8');
const padSrc = readFileSync('./games/pad.js', 'utf-8');

runInContext(tankSrc, sandbox);
runInContext(pongSrc, sandbox);
runInContext(skribblSrc, sandbox);
runInContext(codenamesSrc, sandbox);
runInContext(curveSrc, sandbox);
runInContext(unoSrc, sandbox);
runInContext(dodgeballSrc, sandbox);
runInContext(rouletteSrc, sandbox);
runInContext(eveningSrc, sandbox);
runInContext(qrSrc, sandbox);
runInContext(padSrc, sandbox);

let passed = 0;
let failed = 0;

function assert(condition, testName) {
    if (condition) {
        console.log(`  ✅ PASS: ${testName}`);
        passed++;
    } else {
        console.error(`  ❌ FAIL: ${testName}`);
        failed++;
    }
}

console.log('\n========================================');
console.log('🤖 RUNNING DATASQUAD HUB SIMULATION TESTS');
console.log('========================================\n');

// ----------------------------------------------------
// TEST SUITE 1: TANK TROUBLE
// ----------------------------------------------------
console.log('--- TEST 1: TANK TROUBLE ---');
const tank = new sandbox.TankGame();
tank.addPlayer('p1', 'Player 1', '#00f3ff', false);
const bot = tank.addPlayer('bot1', 'RoboTank', '#ff0055', true);

tank.startMatch(3);

assert(tank.walls.length > 4, 'Maze generates outer boundary and internal walls');

// Verify corridor gaps of internal procedural walls (skip first 4 outer boundary walls)
for (let i = 4; i < tank.walls.length; i++) {
    const w = tank.walls[i];
    if (w.x1 === w.x2) {
        // Vertical wall length
        const len = Math.abs(w.y2 - w.y1);
        assert(len < 220, `Internal vertical wall length (${len}px) leaves wide gap in cell`);
    }
    if (w.y1 === w.y2) {
        // Horizontal wall length
        const len = Math.abs(w.x2 - w.x1);
        assert(len < 220, `Internal horizontal wall length (${len}px) leaves wide gap in cell`);
    }
}

// Test bot shooting rate over 300 simulation ticks (6 seconds)
let botShots = 0;
let prevBulletCount = 0;
for (let frame = 0; frame < 300; frame++) {
    tank.update(0.02);
    if (tank.bullets.length > prevBulletCount) {
        const lastBullet = tank.bullets[tank.bullets.length - 1];
        if (lastBullet.ownerId === 'bot1') botShots++;
    }
    prevBulletCount = tank.bullets.length;
}

// Bot should shoot thoughtfully (e.g. 1 to 6 times in 6 seconds), NEVER 50-100 times!
assert(botShots >= 0 && botShots <= 6, `Bot shooting is throttled by cooldown (bot fired ${botShots} times in 6s, expected <= 6)`);

// Test bullet bouncing
tank.status = 'PLAYING';
tank.bullets = [];
tank.bullets.push({
    id: 999,
    ownerId: 'p1',
    color: '#fff',
    x: 40,
    y: 100,
    vx: -300, // heading straight into left outer boundary at x=28
    vy: 0,
    bounces: 0,
    life: 5.0,
    timeAlive: 0.5
});
tank.update(0.05);
const bouncedBullet = tank.bullets.find(b => b.id === 999);
assert(bouncedBullet && bouncedBullet.vx > 0, 'Bullet reflects off wall with inverted velocity');
assert(bouncedBullet && bouncedBullet.bounces === 1, 'Bullet bounce counter increments correctly');

// Test Bot wall avoidance & anti-jitter behavior
// Place bot 30px in front of left wall facing left (angle = PI)
bot.x = 60;
bot.y = 150;
bot.angle = Math.PI;
bot.avoidTimer = 0;
bot.avoidDir = 0;
// Update bot AI
tank.updateTankBot(bot, 0.05);
assert(bot.avoidTimer > 0, 'Bot detects obstacle ahead and commits to avoidance maneuver');
assert(bot.avoidDir !== 0, 'Bot chooses clear steering direction away from wall');
assert(bot.inputBack === false, 'Bot does not jitter backwards into oscillation cycle');


// ----------------------------------------------------
// TEST SUITE 2: OCTA-PONG (CONTINUOUS COLLISION & TUNNELING)
// ----------------------------------------------------
console.log('\n--- TEST 2: OCTA-PONG ---');
const pong = new sandbox.OctaPongGame();
const pSide0 = pong.addPlayer('pong1', 'PlayerSide0', '#00f3ff');
pSide0.sideIdx = 0; // Right side (angle around 0)
pSide0.paddlePos = 0.5;
pong.startMatch();
pong.status = 'PLAYING';

// Test 1: Inward normal vectors for all 8 sides
for (let s = 0; s < 8; s++) {
    const { p1, p2 } = pong.getSideSegment(s);
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    const nx = -(p2.y - p1.y) / len;
    const ny = (p2.x - p1.x) / len;

    // Center is (600, 400). Vector from midpoint to center:
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const toCenterX = 600 - midX;
    const toCenterY = 400 - midY;
    const inwardDot = nx * toCenterX + ny * toCenterY;
    assert(inwardDot > 0, `Side ${s} normal vector points strictly inward toward arena center`);
}

// Test 2: TUNNELING STRESS TEST
// Simulate 500 high-speed balls traveling directly at side 0 paddle at MAX SPEED (540 px/s)
let tunneledCount = 0;
let successfulBounces = 0;

for (let trial = 0; trial < 200; trial++) {
    pong.balls = [{
        id: trial + 1,
        x: 850 + (Math.random() - 0.5) * 20, // close to wall at ~914
        y: 400 + (Math.random() - 0.5) * 40,
        vx: 540,                             // max speed straight at paddle
        vy: (Math.random() - 0.5) * 100,
        speed: 540
    }];

    // Run 10 ticks
    for (let t = 0; t < 10; t++) {
        pong.update(0.02);
    }

    const b = pong.balls[0];
    if (b) {
        // If ball is now moving inwards (vx < 0) or was reset, it did not tunnel
        if (b.vx < 0 || b.x <= 850) {
            successfulBounces++;
        } else if (b.x > 930) {
            tunneledCount++;
        }
    }
}

assert(tunneledCount === 0, `Continuous collision test: 0 out of 200 high-speed balls tunneled through paddle`);
assert(successfulBounces > 180, `Paddle bounce detection triggered reliably (${successfulBounces}/200 successfully deflected)`);


// ----------------------------------------------------
// TEST SUITE 3: MONTAGSMALER / SKRIBBL
// ----------------------------------------------------
console.log('\n--- TEST 3: MONTAGSMALER (SKRIBBL) ---');
const skribbl = new sandbox.SkribblGame();
skribbl.addPlayer('drawer1', 'Kuenstler', '#00f3ff');
skribbl.addPlayer('guess1', 'Rater 1', '#ff00ff');
skribbl.addPlayer('guess2', 'Rater 2', '#39ff14');

skribbl.startMatch(3);
assert(skribbl.status === 'CHOOSING', 'Game starts in CHOOSING state');
assert(skribbl.wordChoices.length === 3, 'Presents 3 German word choices');

// Drawer chooses word
const chosen = skribbl.wordChoices[0];
skribbl.chooseWord(chosen);
assert(skribbl.status === 'DRAWING', 'Transitions to DRAWING state');
assert(skribbl.secretWord === chosen.toUpperCase(), 'Secret word set correctly');

// CRITICAL TEST: Active drawer must NOT be able to type or guess their own word!
const activeDrawer = skribbl.players.get(skribbl.activeDrawerId);
const activeGuessers = Array.from(skribbl.players.values()).filter(p => p.id !== skribbl.activeDrawerId);
const testGuesser = activeGuessers[0];

const drawerGuess = skribbl.handleGuess(activeDrawer.id, chosen);
assert(drawerGuess.rejected === true && drawerGuess.isMatch === false, 'Drawer CANNOT guess or submit words in chat');

// Guesser guesses wrong word
const wrongGuess = skribbl.handleGuess(testGuesser.id, 'FALSCHESWORT123');
assert(wrongGuess.isMatch === false && !testGuesser.hasGuessed, 'Incorrect guess does not award points');

// Guesser guesses correct word
const correctGuess = skribbl.handleGuess(testGuesser.id, chosen);
assert(correctGuess.isMatch === true && testGuesser.hasGuessed, 'Correct guess recognized and marked');
assert(testGuesser.score > 0, 'Points awarded to guesser');
assert(activeDrawer.score > 0, 'Points awarded to drawer on correct guess');

// Guesser cannot guess again after already guessing
const repeatGuess = skribbl.handleGuess(testGuesser.id, chosen);
assert(repeatGuess.rejected === true, 'Player who already guessed is rejected from guessing again');

// Timer countdown & letter hint reveal
skribbl.timeLeft = 35;
skribbl.updateTick(6.0); // 35 -> 29 (passes under 30s mark)
assert(skribbl.timeLeft <= 29, `Timer counts down correctly (now ${skribbl.timeLeft.toFixed(1)}s)`);
assert(skribbl.revealedHint.match(/[A-ZÄÖÜß]/), 'Timer crossing 30s reveals random letter hint');
const snapTime = skribbl.getSnapshot(testGuesser.id).timeLeft;
assert(snapTime === Math.ceil(skribbl.timeLeft), 'Snapshot correctly serializes rounded countdown seconds for UI');


// ----------------------------------------------------
// TEST SUITE 4: CODENAMES
// ----------------------------------------------------
console.log('\n--- TEST 4: CODENAMES ---');
const codenames = new sandbox.CodenamesGame();
const pRed1 = codenames.addPlayer('cn_red_spy', 'RedSpy');
const pRed2 = codenames.addPlayer('cn_red_op', 'RedOperative');
const pBlue1 = codenames.addPlayer('cn_blue_spy', 'BlueSpy');
const pBlue2 = codenames.addPlayer('cn_blue_op', 'BlueOperative');

codenames.assignTeamAndRole(pRed1.id, 'red', 'spymaster');
codenames.assignTeamAndRole(pRed2.id, 'red', 'operative');
codenames.assignTeamAndRole(pBlue1.id, 'blue', 'spymaster');
codenames.assignTeamAndRole(pBlue2.id, 'blue', 'operative');

assert(pRed1.team === 'red' && pRed1.role === 'spymaster', 'Red Spymaster assigned');
assert(pRed2.team === 'red' && pRed2.role === 'operative', 'Red Operative assigned');

codenames.startNewGame();
assert(codenames.board.length === 25, 'Board has exactly 25 cards');

const assassinCount = codenames.board.filter(c => c.type === 'assassin').length;
assert(assassinCount === 1, 'Board has exactly 1 assassin card');

// Test Snapshot masking: Operatives must NOT see card types for unrevealed cards
const opSnap = codenames.getSnapshot(pRed2.id);
const unrevealedCards = opSnap.cards.filter(c => !c.revealed);
const allMasked = unrevealedCards.every(c => c.type === 'hidden');
assert(allMasked, 'Operative snapshot masks all unrevealed card types as hidden');

// Spymaster snapshot MUST see all card types
const spySnap = codenames.getSnapshot(pRed1.id);
const spySeesTypes = spySnap.cards.every(c => c.type !== 'hidden');
assert(spySeesTypes, 'Spymaster snapshot reveals all card types for clues');

// Test clue giving and turn progression
const activeTeam = codenames.currentTurn;
const activeSpy = activeTeam === 'red' ? pRed1 : pBlue1;
const activeOp = activeTeam === 'red' ? pRed2 : pBlue2;

// Inactive operative cannot give clue
const invalidClue = codenames.giveClue('HINWEIS', 2, activeOp.id);
assert(invalidClue === false, 'Operatives CANNOT give clues');

// Active spymaster gives clue
const validClue = codenames.giveClue('TIERE', 2, activeSpy.id);
assert(validClue === true, 'Spymaster can give valid clue');
assert(codenames.guessesLeft === 3, 'Guesses left is clue count + 1 bonus guess');

// Spymaster CANNOT reveal cards
const firstCard = codenames.board[0];
const spyClick = codenames.revealCard(firstCard.id, activeSpy.id);
assert(spyClick === null, 'Spymaster CANNOT click and reveal cards');

// Operative reveals card
const opClick = codenames.revealCard(firstCard.id, activeOp.id);
assert(opClick !== null && firstCard.revealed === true, 'Operative can successfully reveal cards');


// ----------------------------------------------------
// TEST SUITE 5: CURVE ARENA
// ----------------------------------------------------
console.log('\n--- TEST 5: CURVE ARENA ---');
const curve = new sandbox.CurveGame();
curve.addPlayer('c1', 'Curver1', '#00f3ff');
curve.addPlayer('c2', 'Curver2', '#ff0055');
curve.resetMatch();
curve.startCountdown();
assert(curve.state === 'COUNTDOWN', 'Curve arena enters COUNTDOWN state');
curve.state = 'PLAYING';
curve.update(0.1);
assert(curve.players.get('c1').alive, 'Players remain alive on initial movement');

// --- Power-Ups & Troll-Items Tests ---
// 1. Spawning
curve.powerUps = [];
curve.spawnPowerUp();
assert(curve.powerUps.length === 1, 'Power-up orb spawned in arena');
const spawnedPU = curve.powerUps[0];
assert(spawnedPU.radius === 18 && typeof spawnedPU.x === 'number', 'Power-up has valid dimensions and coordinates');

// 2. Invert Controls (Troll Item)
const p1 = curve.players.get('c1');
const p2 = curve.players.get('c2');
p1.alive = true;
p2.alive = true;
p2.angle = 0;
p2.inputLeft = true;
p2.inputRight = false;

// Trigger invert effect from p1 (targets others -> p2)
curve.activatePowerUp(p1, { type: 'invert', name: 'Invert Controls', icon: '🔀', color: '#ff0055', target: 'others', duration: 4.0 });
const p2Inverted = curve.activeEffects.some(e => e.targetPlayerId === p2.id && e.type === 'invert');
assert(p2Inverted, 'Invert effect applied to opponent (p2)');

// When p2 presses left under invert, angle should INCREASE (turn right instead of left)
const angleBefore = p2.angle;
curve.update(0.1);
assert(p2.angle > angleBefore, 'Inverted controls: pressing Left turns Curve to the Right');

// 3. Ghost / Phasing Mode (Self-Buff)
// Create a solid wall segment directly ahead of p1
p1.x = 200;
p1.y = 200;
p1.angle = 0; // heading right along x
p1.inputLeft = false;
p1.inputRight = false;
curve.segments.push({ id: 9999, playerId: 'other', color: '#fff', x1: 205, y1: 150, x2: 205, y2: 250 });
curve.grid.addSegment(curve.segments[curve.segments.length - 1]);

// Activate ghost effect on p1
curve.activatePowerUp(p1, { type: 'ghost', name: 'Geist-Modus', icon: '👻', color: '#00f3ff', target: 'self', duration: 3.0 });
curve.update(0.1);
assert(p1.alive === true, 'Ghost Mode: Player phases directly through crossing lines without crashing');

// 4. Bomb / Cleanse detonation
const segCountBefore = curve.segments.length;
curve.activatePowerUp(p1, { type: 'bomb', name: 'Bombe', icon: '💣', color: '#ffe600', target: 'global', x: 205, y: 200 });
const segCountAfter = curve.segments.length;
assert(segCountAfter < segCountBefore, 'Bomb detonation successfully cleared line segments in blast radius');

// 5. Snapshot sync of Power-Ups & Effects
const curveSnap = curve.getSnapshot();
assert(Array.isArray(curveSnap.powerUps), 'Snapshot contains active power-ups array');
assert(Array.isArray(curveSnap.activeEffects), 'Snapshot contains active effects array');
assert(curveSnap.banner !== null, 'Snapshot includes active power-up announcement banner');

// 6. Invert Troll Effect directly affects Bots
const cBot = curve.addPlayer('cBot', 'Bot Curve', '#ffe600', true);
cBot.alive = true;
cBot.x = 600;
cBot.y = 400;
cBot.angle = 0;
p1.x = 500;
p1.y = 500;
p1.alive = true;
curve.state = 'PLAYING';

// Place an obstacle ahead/right of the bot
for (let y = 350; y <= 500; y += 10) {
    curve.segments.push({ id: 1000 + y, playerId: 'other', color: '#fff', x1: 650, y1: y, x2: 660, y2: y });
    curve.grid.addSegment(curve.segments[curve.segments.length - 1]);
}

// Activate invert effect targeting opponents (including cBot)
curve.activatePowerUp(p1, { type: 'invert', name: 'Invert Controls', icon: '🔀', color: '#ff0055', target: 'others', duration: 4.0 });
const botAngleBefore = cBot.angle;
curve.update(0.1);
assert(cBot.inputLeft === true && cBot.angle > botAngleBefore, 'Invert Troll effect inverts Bot controls (Bot decides Left, but turns Right)');

// 7. Power-Ups disable toggle
curve.setPowerUpsEnabled(false);
assert(curve.powerUpsEnabled === false, 'Power-ups can be cleanly toggled off in settings');
assert(curve.powerUps.length === 0, 'Disabling power-ups immediately clears field orbs');
assert(curve.activeEffects.length === 0, 'Disabling power-ups immediately cleanses all active effects');
curve.update(5.0);
assert(curve.powerUps.length === 0, 'No power-ups spawn when disabled in settings');

// ----------------------------------------------------
// TEST SUITE 6: UNO (CARD GAME & ANTI-CHEAT ENGINE)
// ----------------------------------------------------
console.log('\n--- TEST 6: UNO CARD ENGINE ---');
const uno = new sandbox.UnoGame();
const u1 = uno.addPlayer('u1', 'Player 1', '#00f3ff', false);
const u2 = uno.addPlayer('u2', 'Player 2', '#ff0055', false);
const uBot = uno.addPlayer('uBot', 'Bot Uno', '#39ff14', true);

// 1. Deck generation
const testDeck = uno.createDeck();
assert(testDeck.length === 108, `Standard Uno deck contains exactly 108 cards (got ${testDeck.length})`);
const wildCount = testDeck.filter(c => c.color === 'wild').length;
assert(wildCount === 8, `Deck has 8 wild cards (4 Wild + 4 Wild Draw 4)`);

// 2. Match start & initial deal
uno.startMatch();
assert(uno.status === 'PLAYING', 'UNO match enters PLAYING status');
assert(u1.hand.length === 7, 'Player 1 dealt exactly 7 cards');
assert(u2.hand.length === 7, 'Player 2 dealt exactly 7 cards');
assert(uBot.hand.length === 7, 'Bot dealt exactly 7 cards');
assert(uno.discardPile.length === 1, 'Discard pile initialized with 1 top card');
assert(uno.activeColor !== 'wild', 'Active color is resolved to one of the 4 colors');

// 3. Card play legality
const topCard = uno.getTopCard();
const matchingColorCard = { id: 9001, color: uno.activeColor, value: '5' };
const matchingValueCard = { id: 9002, color: 'unmatchedColor', value: topCard.value };
const wildCard = { id: 9003, color: 'wild', value: 'wild' };
const illegalCard = { id: 9004, color: 'differentColor', value: 'differentValue999' };

assert(uno.isCardPlayable(matchingColorCard) === true, 'Card with matching color is playable');
assert(uno.isCardPlayable(matchingValueCard) === true, 'Card with matching value is playable');
assert(uno.isCardPlayable(wildCard) === true, 'Wild card is always playable');
assert(uno.isCardPlayable(illegalCard) === false, 'Card without color or value match is rejected');

// 4. Anti-Cheat Snapshot: Masking opponent hands
const u1Snap = uno.getSnapshot('u1');
assert(u1Snap.myHand.length === u1.hand.length, 'Player snapshot contains full hand for self');
const opp2Data = u1Snap.players.find(p => p.id === 'u2');
assert(opp2Data && typeof opp2Data.cardCount === 'number' && opp2Data.hand === undefined,
    'Opponent cards are strictly masked: snapshot only reveals card count, preventing DevTools cheating');

// 5. Action card mechanics: Draw 2
const activeBefore = uno.getCurrentPlayer();
const nextPlayerBefore = uno.getNextPlayer(1);
const nextHandCountBefore = nextPlayerBefore.hand.length;

// Inject Draw 2 card into active player's hand and top pile
uno.discardPile = [{ id: 8888, color: 'red', value: '0' }];
uno.activeColor = 'red';
activeBefore.hand.push({ id: 8889, color: 'red', value: 'draw2' });
const playRes = uno.playCard(activeBefore.id, 8889);
assert(playRes.success === true, 'Successfully played Draw 2 card');
assert(nextPlayerBefore.hand.length === nextHandCountBefore + 2, 'Next player drew exactly 2 cards');
assert(uno.getCurrentPlayer().id !== nextPlayerBefore.id, 'Next player was skipped after drawing 2');

// 6. Action card mechanics: Reverse in 3-player game
const prevDir = uno.direction;
const revActive = uno.getCurrentPlayer();
uno.discardPile = [{ id: 7777, color: 'blue', value: '0' }];
uno.activeColor = 'blue';
revActive.hand.push({ id: 7778, color: 'blue', value: 'reverse' });
uno.playCard(revActive.id, 7778);
assert(uno.direction === -prevDir, 'Reverse card inverted play direction in 3-player game');

// 7. Wild card & Color Choice
const wildActive = uno.getCurrentPlayer();
wildActive.hand.push({ id: 6666, color: 'wild', value: 'wild' });
const wildRes = uno.playCard(wildActive.id, 6666);
assert(wildRes.awaitColor === true && uno.awaitingColorChoice === true, 'Playing wild card requires color selection');
uno.chooseWildColor(wildActive.id, 'green');
assert(uno.activeColor === 'green', 'Chosen wild color set to green');
assert(uno.awaitingColorChoice === false, 'Color choice resolved and play resumes');

// 8. Bot AI turn execution
uno.turnIndex = uno.playerOrder.indexOf('uBot');
assert(uno.getCurrentPlayer().isBot === true, 'Turn advanced to Bot');
// Update with enough time for botActionTimer
uno.botActionTimer = 0.05;
uno.update(0.1);
assert(uno.turnIndex !== uno.playerOrder.indexOf('uBot'), 'Bot executed turn and passed turn index');

// ----------------------------------------------------
// TEST SUITE 7: CORPORATE DODGEBALL (DATA SQUAD VS. COMN)
// ----------------------------------------------------
console.log('\n--- TEST 7: CORPORATE DODGEBALL ---');
const db = new sandbox.DodgeballGame();
const dev = db.addPlayer('dev1', 'DataLead', '#00f3ff', false, 'squad');
const comn = db.addPlayer('comn1', 'ComN-Lead', '#ff0055', false, 'comn');
const comnBot = db.addPlayer('botComN', 'Bot Berater', '#ff00aa', true, 'comn');

assert(dev.team === 'squad', 'Data Squad player assigned to Squad team');
assert(comn.team === 'comn', 'ComN player assigned to ComN team');

// 1. Match Start & Ball Rushes
db.startMatch(3);
assert(db.status === 'COUNTDOWN', 'Dodgeball starts in COUNTDOWN state');
assert(db.balls.length >= 3, 'Floor balls spawned along center dividing line');
db.status = 'PLAYING';

// 2. Center Dividing Line boundary check
dev.x = sandbox.DB_CENTER_X - 10;
dev.inputRight = true;
db.update(0.1);
assert(dev.x < sandbox.DB_CENTER_X, 'Data Squad player cannot cross center dividing line into ComN court');

comn.x = sandbox.DB_CENTER_X + 10;
comn.inputLeft = true;
db.update(0.1);
assert(comn.x > sandbox.DB_CENTER_X, 'ComN player cannot cross center dividing line into Squad court');
comn.inputLeft = false;
dev.inputRight = false;

// 3. Ball Pickup
dev.x = 200;
dev.y = 200;
dev.hasBall = null;
db.balls.push({
    id: 8001,
    type: 'release',
    name: 'Code-Release',
    icon: '📦',
    color: '#00f3ff',
    x: 205,
    y: 200,
    state: 'FLOOR'
});
db.update(0.05);
assert(dev.hasBall !== null && dev.hasBall.type === 'release', 'Player picks up floor ball when stepping over it');

// 4. Ball Throw
dev.inputThrow = true;
dev.aimAngle = 0; // aim right towards ComN
db.update(0.05);
assert(dev.hasBall === null, 'Player released held ball upon throw');
const thrownBall = db.balls.find(b => b.state === 'FLYING' && b.thrownBy === 'dev1');
assert(thrownBall !== undefined && thrownBall.vx > 0, 'Flying projectile launched with velocity towards enemy court');

// 5. Direct Hit & HP Reduction
comn.x = 800;
comn.y = 400;
comn.hp = 3;
comn.dashTimer = 0;
// Place flying ball directly on comn
db.balls.push({
    id: 8002,
    type: 'release',
    name: 'Code-Release',
    icon: '📦',
    color: '#00f3ff',
    x: 802,
    y: 400,
    vx: 400,
    vy: 0,
    state: 'FLYING',
    thrownBy: 'dev1',
    thrownTeam: 'squad'
});
db.update(0.05);
assert(comn.hp === 2, 'Direct hit reduces enemy player HP from 3 to 2');

// 6. Catch Mechanic (Dodgeball Catch)
comn.hasBall = null;
comn.dashTimer = 0.2; // Dashing!
db.balls.push({
    id: 8003,
    type: 'coffee',
    name: 'Kaffee-Becher',
    icon: '☕',
    color: '#ffaa00',
    x: 802,
    y: 400,
    vx: -400,
    vy: 0,
    state: 'FLYING',
    thrownBy: 'dev1',
    thrownTeam: 'squad'
});
db.update(0.05);
assert(comn.hasBall !== null && comn.hasBall.type === 'coffee', 'Dashing into incoming ball catches the ball mid-air');
assert(comn.hp === 2, 'Catching ball negates all incoming damage');

// 7. Stein im Weg (Stone creates obstacle rock)
const rockCountBefore = db.rocks.length;
comn.x = 800;
comn.y = 400;
comn.vx = 0;
comn.vy = 0;
comn.inputLeft = false;
comn.inputRight = false;
comn.inputFwd = false;
comn.inputBack = false;
comn.dashTimer = 0; // Not dashing, direct hit!
comn.hasBall = null;
db.balls.push({
    id: 8004,
    type: 'stone',
    name: 'Stein im Weg',
    icon: '🪨',
    color: '#ff0055',
    x: 802,
    y: 400,
    vx: 400,
    vy: 0,
    state: 'FLYING',
    thrownBy: 'dev1',
    thrownTeam: 'squad',
    leavesRock: true
});
db.update(0.05);
assert(db.rocks.length > rockCountBefore, 'Stein im Weg leaves physical rock obstacle on the floor upon impact');

// 8. Special Attack: Das große ComN-Paket cluster detonation
const rockCountBeforePkg = db.rocks.length;
const ballCountBeforePkg = db.balls.length;
db.balls.push({
    id: 8888,
    type: 'comn_package',
    name: 'Das große ComN-Paket',
    icon: '📦',
    color: '#ffd700',
    x: 800,
    y: 400,
    vx: 400,
    vy: 0,
    state: 'FLYING',
    thrownBy: 'dev1',
    thrownTeam: 'squad',
    isCluster: true
});
db.update(0.05);
assert(db.rocks.length > rockCountBeforePkg, 'ComN-Paket explosion places massive obstacle rock on impact');
assert(db.balls.length > ballCountBeforePkg, 'ComN-Paket cluster detonates into multiple sub-projectiles (Rechnung, Ordner, Stein)');

// 9. Bot AI Dodge & Aim
comnBot.alive = true;
comnBot.x = 900;
comnBot.y = 400;
// Send incoming threat straight at bot
db.balls.push({
    id: 8005,
    type: 'release',
    name: 'Code-Release',
    icon: '📦',
    color: '#00f3ff',
    x: 750,
    y: 400,
    vx: 500,
    vy: 0,
    state: 'FLYING',
    thrownBy: 'dev1',
    thrownTeam: 'squad'
});
db.update(0.05);
assert(comnBot.inputFwd || comnBot.inputBack || comnBot.inputDash, 'Bot reacts dynamically to incoming threat by dodging');

// 9. Snapshot Serialization
const dbSnap = db.getSnapshot();
assert(Array.isArray(dbSnap.players) && dbSnap.players.length === 3, 'Snapshot serializes full team roster');
assert(Array.isArray(dbSnap.balls), 'Snapshot serializes arena balls');
assert(Array.isArray(dbSnap.rocks), 'Snapshot serializes floor rocks');


// ----------------------------------------------------
// TEST SUITE 8: COMN: FREIGABE-ROULETTE
// ----------------------------------------------------
console.log('\n--- TEST 8: FREIGABE-ROULETTE ENGINE ---');
const rGame = new sandbox.FreigabeRouletteGame();
const rP1 = rGame.addPlayer('r1', 'Alice', '#00f3ff', false);
const rP2 = rGame.addPlayer('r2', 'Bob', '#ff0055', false);
const rBot = rGame.addPlayer('rBot', 'Bot ComN', '#f59e0b', true);

// 1. Deck generation & card structure
const rDeck = rGame.createDeck();
const expectedCards = sandbox.ROULETTE_CARDS.reduce((sum, t) => sum + t.count, 0);
assert(rDeck.length === expectedCards, `Roulette deck contains all ${expectedCards} cards across categories`);
assert(expectedCards >= 80, `Roulette deck expanded to ${expectedCards} cards (at least 80) for rich multi-player sessions`);
assert(rDeck.every(c => c.uid && c.id && c.category && c.title), 'Every card has valid UID, category, title, and metadata');

// 2. Match start & initial hand deal
rGame.startMatch();
assert(rGame.status === 'PLAYING', 'Freigabe-Roulette match enters PLAYING status');
assert(rP1.progress === 0 && rP2.progress === 0 && rBot.progress === 0, 'All players start with 0% progress');
assert(rP1.hand.length === 6, 'First player dealt 5 initial cards + 1 turn opening card');
assert(rP2.hand.length === 5, 'Second player dealt 5 initial cards');
assert(rBot.hand.length === 5, 'Bot dealt 5 initial cards');

// 3. Progress card play
const firstP = rGame.getCurrentPlayer();
const deployCard = {
    uid: 9901,
    id: 'deploy_20',
    category: 'progress',
    title: 'Code-Deploy',
    icon: '🚀',
    value: 20
};
firstP.hand.unshift(deployCard);
const playRes1 = rGame.playCard(firstP.id, deployCard.uid);
assert(playRes1.success === true, 'Player can legally play progress card');
assert(firstP.progress === 20, 'Progress card increases player progress by +20% (now 20%)');
assert(rGame.discardPile[rGame.discardPile.length - 1].uid === deployCard.uid, 'Played card moved to discard pile');

// 4. Blocker card play & Stein im Weg
const blockerCard = {
    uid: 9902,
    id: 'stein_weg',
    category: 'blocker',
    title: 'Stein im Weg',
    icon: '🪨',
    target: 'enemy',
    penalty: 15
};
firstP.hand.unshift(blockerCard);
rP2.progress = 30;
const playRes2 = rGame.playCard(firstP.id, blockerCard.uid, rP2.id);
assert(playRes2.success === true, 'Player can throw Blocker card at opponent');
assert(rP2.progress === 15, 'Stein im Weg reduces target opponent progress by -15%');

// 5. Chef-Bypass protection shield
const nextActive = rGame.getCurrentPlayer();
nextActive.shielded = true;
const attackCard = {
    uid: 9903,
    id: 'agentur',
    category: 'blocker',
    title: 'Externe Agentur beauftragen',
    icon: '💸',
    target: 'enemy',
    penalty: 20
};
// Try attacking shielded player
const progBefore = nextActive.progress;
const dummyAttacker = { id: 'dummy', name: 'Saboteur', hand: [attackCard] };
rGame.players.set('dummy', dummyAttacker);
rGame.turnIndex = rGame.playerOrder.indexOf('dummy');
rGame.cardsPlayedThisTurn = 0;
rGame.playCard('dummy', attackCard.uid, nextActive.id);
assert(nextActive.progress === progBefore, 'Chef-Bypass shield successfully deflects ComN blocker attack without progress loss');
rGame.players.delete('dummy');

// 6. Bot AI Turn execution
rGame.turnIndex = rGame.playerOrder.indexOf('rBot');
rGame.cardsPlayedThisTurn = 0;
rBot.hand = [
    { uid: 9904, id: 'pipeline_30', category: 'progress', title: 'Automatisierte Pipeline', icon: '⚡', value: 30 }
];
rGame.botActionTimer = 0.05;
rGame.update(0.1);
assert(rBot.progress === 30, 'Bot AI automatically identifies and plays best progress card in its turn');

// 7. Win Condition (100% Go-Live)
rP1.progress = 85;
rGame.turnIndex = rGame.playerOrder.indexOf(rP1.id);
rGame.cardsPlayedThisTurn = 0;
rP1.hand = [
    { uid: 9905, id: 'deploy_20', category: 'progress', title: 'Code-Deploy', icon: '🚀', value: 20 }
];
rGame.playCard(rP1.id, 9905);
assert(rGame.status === 'GAME_OVER', 'Reaching 100% progress triggers GAME_OVER status');
assert(rGame.winner && rGame.winner.id === rP1.id, 'Player reaching 100% progress is crowned match winner');

// 8. Anti-cheat snapshot validation
const p1Snap = rGame.getSnapshot(rP1.id);
assert(Array.isArray(p1Snap.players), 'Snapshot contains player list');
assert(Array.isArray(p1Snap.myHand), 'Snapshot contains recipient player hand');
assert(p1Snap.players.every(p => !p.hand), 'Snapshot hides opponent hand cards (anti-cheat)');
assert(typeof p1Snap.drawPileCount === 'number', 'Snapshot contains draw pile count');


// ==========================================
// TEST SUITE 9: SECURITY / MALICIOUS PEER INPUT
// ==========================================
console.log('\n--- TEST 9: SECURITY (MALICIOUS PEER INPUT) ---');
{

// Skribbl: only the drawer may draw, clear or choose a word
const secSk = new sandbox.SkribblGame();
secSk.addPlayer('sd1', 'Drawer', '#00f3ff');
secSk.addPlayer('sd2', 'Guesser', '#ff00ff');
secSk.startMatch(1);
const skDrawer = secSk.activeDrawerId;
const skOther = skDrawer === 'sd1' ? 'sd2' : 'sd1';
assert(secSk.chooseWord(secSk.wordChoices[0], skOther) === false, 'Skribbl: non-drawer cannot choose the word');
assert(secSk.chooseWord(secSk.wordChoices[0], skDrawer) === true, 'Skribbl: drawer can choose the word');

const okStroke = { x1: 10, y1: 10, x2: 20, y2: 20, color: '#ff0000', size: 4 };
assert(secSk.addStroke(okStroke, skOther) === null, 'Skribbl: non-drawer strokes are rejected');
assert(secSk.addStroke(okStroke, skDrawer) !== null, 'Skribbl: valid drawer stroke is accepted');
assert(secSk.addStroke({ ...okStroke, color: 'red;background:url(x)' }, skDrawer) === null, 'Skribbl: stroke with invalid color is rejected');
assert(secSk.addStroke({ ...okStroke, x1: 'abc' }, skDrawer) === null, 'Skribbl: stroke with non-numeric coords is rejected');
const bigStroke = secSk.addStroke({ ...okStroke, size: 99999, x2: 1e9 }, skDrawer);
assert(bigStroke && bigStroke.size <= 32 && bigStroke.x2 <= 4000, 'Skribbl: stroke size and coords are clamped');
assert(secSk.clearCanvas(skOther) === false, 'Skribbl: non-drawer cannot clear the canvas');
assert(secSk.handleGuess(skOther, { evil: true }).rejected === true, 'Skribbl: non-string guess is rejected without crashing');

// Codenames: turn and role rules
const secCn = new sandbox.CodenamesGame();
secCn.addPlayer('r_spy', 'RedSpy');
secCn.addPlayer('b_spy', 'BlueSpy');
secCn.addPlayer('r_op', 'RedOp');
secCn.addPlayer('b_op', 'BlueOp');
secCn.assignTeamAndRole('r_spy', 'red', 'spymaster');
secCn.assignTeamAndRole('b_spy', 'blue', 'spymaster');
secCn.assignTeamAndRole('r_op', 'red', 'operative');
secCn.assignTeamAndRole('b_op', 'blue', 'operative');
secCn.startNewGame();
const activeOp = secCn.currentTurn === 'red' ? 'r_op' : 'b_op';
const idleOp = secCn.currentTurn === 'red' ? 'b_op' : 'r_op';
const turnBefore = secCn.currentTurn;
assert(secCn.endTurn(idleOp) === false && secCn.currentTurn === turnBefore, 'Codenames: other team cannot end the active turn');
assert(secCn.assignTeamAndRole('r_spy', 'red', 'operative') === false, 'Codenames: spymaster cannot switch back to operative mid-game');
assert(secCn.assignTeamAndRole(idleOp, null, 'spymaster') === false, 'Codenames: second spymaster per team is rejected mid-game');
assert(secCn.endTurn(activeOp) === true && secCn.currentTurn !== turnBefore, 'Codenames: active team can end its own turn');
const spyId = secCn.currentTurn === 'red' ? 'r_spy' : 'b_spy';
secCn.giveClue('x'.repeat(500), 999, spyId);
assert(secCn.clueWord.length <= 30 && secCn.clueCount <= 9, 'Codenames: clue length and count are limited');

// Dodgeball: non-finite aim angle is ignored
const secDb = new sandbox.DodgeballGame();
const secDbP = secDb.addPlayer('dbx', 'Aimer', '#00f3ff');
const aimBefore = secDbP.aimAngle;
secDb.setInput('dbx', false, false, false, false, false, false, NaN);
assert(secDbP.aimAngle === aimBefore, 'Dodgeball: NaN aim angle is ignored');
}

// ----------------------------------------------------
// TEST SUITE: GAME IMPROVEMENTS (timers, bots, house rules, power-ups, layouts)
// ----------------------------------------------------
console.log('\n--- TEST: CODENAMES TIMER & BOTS ---');
{
    const categories = runInContext('CODENAMES_CATEGORIES', sandbox);
    const allWords = new Set(runInContext('CODENAMES_WORDS', sandbox));
    const allKnown = categories.every(c => c.words.every(w => allWords.has(w)));
    assert(allKnown, 'Codenames: every bot category word exists in the word list');
    assert(categories.every(c => !allWords.has(c.clue[0] + c.clue.slice(1).toLowerCase())), 'Codenames: no category clue equals a board word');

    const dedupe = new sandbox.CodenamesGame();
    dedupe.startNewGame();
    assert(new Set(dedupe.board.map(c => c.word)).size === 25, 'Codenames: board never contains duplicate words');

    const timed = new sandbox.CodenamesGame();
    timed.addPlayer('a', 'A');
    timed.addPlayer('b', 'B');
    timed.timerSeconds = 10;
    timed.startNewGame();
    const firstTurn = timed.currentTurn;
    timed.update(5);
    assert(timed.currentTurn === firstTurn && timed.getSnapshot('a').timeLeft === 5, 'Codenames: timer counts down within the turn');
    timed.update(6);
    assert(timed.currentTurn !== firstTurn, 'Codenames: turn passes when the timer runs out');
    assert(timed.timeLeft === 10, 'Codenames: timer restarts for the next turn');

    // Four bots (spymaster + operative per team) play a full game on their own
    const botGame = new sandbox.CodenamesGame();
    ['b1', 'b2', 'b3', 'b4'].forEach(id => botGame.addPlayer(id, id, '#fff', true));
    const spies = Array.from(botGame.players.values()).filter(p => p.role === 'spymaster');
    assert(spies.length === 2 && spies[0].team !== spies[1].team, 'Codenames: bots take one spymaster seat per team');
    botGame.startNewGame();
    let ticks = 0;
    let assassinClue = false;
    while (botGame.gameStatus === 'PLAYING' && ticks < 6000) {
        const before = botGame.clueWord;
        botGame.update(1);
        if (!before && botGame.clueWord) {
            const cat = categories.find(c => c.clue === botGame.clueWord);
            const assassin = botGame.board.find(c => c.type === 'assassin' && !c.revealed);
            if (cat && assassin && cat.words.includes(assassin.word)) assassinClue = true;
        }
        ticks++;
    }
    assert(botGame.gameStatus === 'GAME_OVER' && botGame.winner, 'Codenames: bot-only game reaches a winner');
    assert(!assassinClue, 'Codenames: bot spymasters never give a clue that covers the assassin');
}

console.log('\n--- TEST: SKRIBBL TOOLS & BOTS ---');
{
    const sk = new sandbox.SkribblGame();
    sk.addPlayer('h', 'Human', '#fff');
    sk.addPlayer('x', 'Guesser', '#fff');
    sk.startMatch(1);
    sk.activeDrawerId = 'h';
    sk.status = 'CHOOSING';
    sk.wordChoices = ['Haus', 'Baum', 'Sonne'];
    sk.chooseWord('Haus', 'h');
    sk.addStroke({ g: 1, x1: 1, y1: 1, x2: 5, y2: 5, color: '#000000', size: 4 }, 'h');
    sk.addStroke({ g: 1, x1: 5, y1: 5, x2: 9, y2: 9, color: '#000000', size: 4 }, 'h');
    sk.addStroke({ g: 2, fill: true, x1: 50, y1: 50, x2: 50, y2: 50, color: '#ff0000', size: 1 }, 'h');
    assert(sk.strokes.length === 3 && sk.strokes[2].fill === true, 'Skribbl: fill stroke is accepted and flagged');
    assert(sk.undoLast('x') === false, 'Skribbl: only the drawer can undo');
    sk.undoLast('h');
    assert(sk.strokes.length === 2, 'Skribbl: undo removes the whole last stroke group (the fill)');
    sk.undoLast('h');
    assert(sk.strokes.length === 0, 'Skribbl: undo removes a multi-segment stroke as one');

    // Bot guesser finds the word after its delay
    const g2 = new sandbox.SkribblGame();
    g2.addPlayer('h', 'Human', '#fff');
    g2.addPlayer('bg', 'Bot', '#fff', true);
    g2.startMatch(1);
    g2.activeDrawerId = 'h';
    g2.status = 'CHOOSING';
    g2.wordChoices = ['Haus', 'Baum', 'Sonne'];
    g2.chooseWord('Haus', 'h');
    g2.players.get('bg').guessAt = 10;
    for (let i = 0; i < 12; i++) g2.updateTick(1);
    assert(g2.players.get('bg').hasGuessed, 'Skribbl: bot guesser solves the word');
    assert(g2.drainEvents().some(e => e.isMatch), 'Skribbl: bot guess is reported to the host loop');

    // Bot drawer paints a prepared drawing
    const g3 = new sandbox.SkribblGame();
    g3.addPlayer('bd', 'Bot', '#fff', true);
    g3.addPlayer('h', 'Human', '#fff');
    g3.startMatch(1);
    g3.activeDrawerId = 'bd';
    g3.status = 'CHOOSING';
    g3.wordChoices = ['Haus', 'Baum', 'Sonne'];
    g3.timeLeft = 15;
    g3.updateTick(2.5); // bots choose quickly
    assert(g3.status === 'DRAWING', 'Skribbl: bot drawer picks a word quickly');
    let drawn = 0;
    for (let i = 0; i < 40; i++) {
        g3.updateTick(1);
        drawn += g3.drainStrokes().length;
    }
    assert(drawn > 10 && g3.strokes.length === drawn, 'Skribbl: bot drawer produces strokes for the host to sync');
    const botWords = Object.keys(runInContext('SKRIBBL_BOT_DRAWINGS', sandbox));
    const skWords = runInContext('SKRIBBL_WORDS', sandbox);
    assert(botWords.every(w => skWords.includes(w)), 'Skribbl: every bot drawing is a real word');
}

console.log('\n--- TEST: UNO HOUSE RULES ---');
{
    const mkUno = (rules) => {
        const u = new sandbox.UnoGame();
        ['a', 'b', 'c'].forEach(id => u.addPlayer(id, id, '#fff'));
        Object.assign(u.rules, rules);
        u.startMatch();
        u.turnIndex = 0;
        u.direction = 1;
        u.discardPile = [{ id: 800, color: 'red', value: '5' }];
        u.activeColor = 'red';
        return u;
    };
    const card = (id, color, value) => ({ id, color, value });

    const plain = mkUno({});
    plain.players.get('a').hand = [card(900, 'red', 'draw2'), card(901, 'blue', '1')];
    const bBefore = plain.players.get('b').hand.length;
    plain.playCard('a', 900);
    assert(plain.players.get('b').hand.length === bBefore + 2 && plain.getCurrentPlayer().id === 'c', 'UNO: without stacking +2 hits and skips the next player');

    const st = mkUno({ stack: true });
    st.players.get('a').hand = [card(900, 'red', 'draw2'), card(901, 'blue', '1')];
    st.players.get('b').hand = [card(902, 'green', 'draw2'), card(903, 'blue', '2')];
    st.players.get('c').hand = [card(904, 'red', '3'), card(905, 'blue', '4')];
    st.playCard('a', 900);
    assert(st.pendingDraw === 2 && st.getCurrentPlayer().id === 'b', 'UNO: stacking passes the +2 on without drawing');
    assert(!st.isCardPlayable(card(903, 'blue', '2')), 'UNO: ordinary cards cannot answer an open penalty');
    st.playCard('b', 902);
    assert(st.pendingDraw === 4 && st.getCurrentPlayer().id === 'c', 'UNO: +2 stacks on +2');
    const cBefore = st.players.get('c').hand.length;
    st.playerDrawCard('c');
    assert(st.players.get('c').hand.length === cBefore + 4 && st.pendingDraw === 0 && st.getCurrentPlayer().id === 'a', 'UNO: player without a counter draws the whole stack and is skipped');

    const sz = mkUno({ sevenZero: true });
    sz.players.get('a').hand = [card(910, 'red', '0'), card(911, 'blue', '1')];
    sz.players.get('b').hand = [card(912, 'blue', '2'), card(913, 'blue', '3'), card(914, 'blue', '4')];
    sz.players.get('c').hand = [card(915, 'green', '5')];
    sz.playCard('a', 910);
    assert(sz.players.get('a').hand.length === 1 && sz.players.get('b').hand.length === 1 && sz.players.get('c').hand.length === 3,
        'UNO: playing a 0 passes every hand along');

    const sv = mkUno({ sevenZero: true });
    sv.players.get('a').hand = [card(920, 'red', '7'), card(921, 'blue', '1'), card(922, 'blue', '2')];
    sv.players.get('b').hand = [card(923, 'blue', '3')];
    sv.players.get('c').hand = [card(924, 'green', '5'), card(925, 'green', '6')];
    const res = sv.playCard('a', 920);
    assert(res.awaitSwap && sv.awaitingSwap, 'UNO: playing a 7 asks for a swap partner');
    assert(sv.playCard('b', 923).success === false, 'UNO: nobody can play while the swap is pending');
    assert(sv.chooseSwapTarget('b', 'c') === false, 'UNO: only the 7-player chooses the partner');
    sv.chooseSwapTarget('a', 'b');
    assert(sv.players.get('a').hand.length === 1 && sv.players.get('b').hand.length === 2 && sv.getCurrentPlayer().id === 'b',
        'UNO: swap exchanges hands and passes the turn');

    // Bots can resolve a 7 and a stacked penalty on their own
    const bots = new sandbox.UnoGame();
    bots.rules.stack = true;
    bots.rules.sevenZero = true;
    ['x', 'y', 'z'].forEach(id => bots.addPlayer(id, id, '#fff', true));
    bots.startMatch();
    let uTicks = 0;
    while (bots.status === 'PLAYING' && uTicks < 20000) {
        bots.update(0.5);
        uTicks++;
    }
    assert(bots.status === 'GAME_OVER', 'UNO: bot-only game with all house rules finishes');
}

console.log('\n--- TEST: DODGEBALL TIMER & POWER-UPS ---');
{
    const mkDb = () => {
        const d = new sandbox.DodgeballGame();
        d.addPlayer('s1', 'Squad', '#00f3ff', false, 'squad');
        d.addPlayer('c1', 'ComN', '#ff0055', false, 'comn');
        d.powerupsEnabled = false;
        d.startMatch(3);
        d.update(3.5); // countdown
        return d;
    };

    const timed = mkDb();
    timed.roundTimeLimit = 5;
    timed.roundTimeLeft = 5;
    timed.players.get('c1').hp = 1;
    timed.update(2);
    assert(timed.status === 'PLAYING', 'Dodgeball: round keeps running before the timer expires');
    timed.update(4);
    assert(timed.status === 'ROUND_OVER' && timed.scoreSquad === 1, 'Dodgeball: time-out awards the round to the team with more HP');
    const tie = mkDb();
    tie.roundTimeLimit = 1;
    tie.roundTimeLeft = 1;
    tie.update(2);
    assert(tie.status === 'ROUND_OVER' && tie.scoreSquad === 0 && tie.scoreComN === 0, 'Dodgeball: time-out on equal HP is a draw');

    const shield = mkDb();
    const target = shield.players.get('c1');
    target.shieldTimer = 5;
    shield.balls.push({
        id: 999, type: 'release', name: 'Test', icon: '📦', color: '#fff', x: target.x, y: target.y, vx: 0, vy: 0,
        state: 'FLYING', thrownBy: 's1', thrownTeam: 'squad', bouncesLeft: 0
    });
    shield.update(0.016);
    assert(target.hp === target.maxHp && !shield.balls.some(b => b.id === 999), 'Dodgeball: shield absorbs the hit and the ball is consumed');

    const dbl = mkDb();
    const thrower = dbl.players.get('s1');
    dbl.balls = [];
    thrower.hasBall = { type: 'release', name: 'T', icon: '📦', color: '#fff' };
    thrower.doubleThrow = true;
    thrower.inputThrow = true;
    thrower.aimAngle = 0;
    dbl.update(0.016);
    assert(dbl.balls.filter(b => b.state === 'FLYING').length === 2 && thrower.doubleThrow === false, 'Dodgeball: double throw releases two balls and is used up');

    const pu = mkDb();
    pu.powerupsEnabled = true;
    pu.powerupSpawnTimer = 0;
    pu.update(0.016);
    assert(pu.powerups.length === 1, 'Dodgeball: power-up pickups spawn');
    const picker = pu.players.get('s1');
    pu.powerups[0].type = 'shield';
    pu.powerups[0].x = picker.x;
    pu.powerups[0].y = picker.y;
    pu.update(0.016);
    assert(picker.shieldTimer > 0 && pu.powerups.length === 0, 'Dodgeball: walking over a shield pickup activates it');
    const snap = pu.getSnapshot();
    assert(pu.getSnapshot().balls.every(b => typeof b.name === 'string'), 'Dodgeball: snapshot balls carry their name (clients render the label)');
    assert(snap.players.find(p => p.id === 's1').shield === true, 'Dodgeball: snapshot exposes the shield state');
}

console.log('\n--- TEST: TANK LAYOUTS, LASER & MINES ---');
{
    const layoutKeys = runInContext('Object.keys(TANK_LAYOUTS)', sandbox);
    const spawns = [[100, 100], [1100, 100], [100, 700], [1100, 700], [600, 100], [600, 700], [100, 400], [1100, 400]];
    for (const key of layoutKeys) {
        const t = new sandbox.TankGame();
        t.layout = key;
        t.generateMaze();
        const inBounds = t.walls.every(w => [w.x1, w.x2].every(x => x >= 28 && x <= 1172) && [w.y1, w.y2].every(y => y >= 28 && y <= 772));
        assert(t.walls.length > 4 && inBounds, `Tank layout "${key}" has walls inside the arena`);
        assert(spawns.every(([x, y]) => !t.checkTankWallCollision(x, y)), `Tank layout "${key}" leaves every spawn point free`);
    }
    const mix = new sandbox.TankGame();
    mix.layout = 'mix';
    mix.generateMaze();
    assert(mix.walls.length > 4, 'Tank: mixed layout mode builds a maze');

    const mkTank = () => {
        const t = new sandbox.TankGame();
        t.addPlayer('A', 'A', '#00f3ff');
        t.addPlayer('B', 'B', '#ff0055');
        t.pickupsEnabled = false;
        t.startMatch(3);
        t.walls = [];
        const a = t.players.get('A');
        const b = t.players.get('B');
        a.x = 200; a.y = 400; a.angle = 0;
        b.x = 800; b.y = 400; b.angle = Math.PI;
        return { t, a, b };
    };

    const laser = mkTank();
    laser.a.weapon = 'laser';
    laser.a.inputShoot = true;
    laser.t.update(0.016);
    assert(!laser.b.alive && laser.a.score === 1 && laser.a.weapon === null, 'Tank: laser kills a tank in its path and is used up');
    assert(laser.t.getSnapshot().lasers.length === 1, 'Tank: laser beam is part of the snapshot for rendering');

    const wallLaser = mkTank();
    wallLaser.t.walls = [{ x1: 500, y1: 100, x2: 500, y2: 700 }];
    wallLaser.a.weapon = 'laser';
    wallLaser.a.inputShoot = true;
    wallLaser.t.update(0.016);
    assert(wallLaser.b.alive, 'Tank: laser is stopped (reflected) by a wall');

    const mine = mkTank();
    mine.a.weapon = 'mine';
    mine.a.inputShoot = true;
    mine.t.update(0.016);
    mine.a.inputShoot = false;
    assert(mine.t.mines.length === 1, 'Tank: mine is laid at the tank position');
    const m = mine.t.mines[0];
    mine.a.x = 100; mine.a.y = 100;
    mine.b.x = m.x; mine.b.y = m.y;
    mine.t.update(0.5);
    assert(mine.b.alive, 'Tank: a fresh mine is not armed yet');
    mine.t.update(1.5);
    assert(!mine.b.alive && mine.a.score === 1 && mine.t.mines.length === 0, 'Tank: armed mine kills the victim for its owner');

    const pick = mkTank();
    pick.t.pickupsEnabled = true;
    pick.t.pickupTimer = 0;
    pick.t.update(0.016);
    assert(pick.t.pickups.length === 1, 'Tank: weapon pickups spawn');
    pick.t.pickups[0].type = 'laser';
    pick.t.pickups[0].x = pick.a.x;
    pick.t.pickups[0].y = pick.a.y;
    pick.t.update(0.016);
    assert(pick.a.weapon === 'laser' && pick.t.pickups.length === 0, 'Tank: driving over a pickup arms the tank');
}

// ----------------------------------------------------
// TEST SUITE: SPIELEABEND (scoring, awards, achievements, catch-up, stats, team mixer)
// ----------------------------------------------------
console.log('\n--- TEST: SPIELEABEND ENGINE ---');
{
    const mkPlayers = ids => ids.map(id => ({ id, name: id.toUpperCase(), color: '#fff', isBot: false, avatar: '😎', hat: '' }));
    const ev = new sandbox.EveningSession();
    ev.start(['tank', 'uno', 'dodgeball'], mkPlayers(['a', 'b', 'c']));
    assert(ev.phase === 'PLAYING' && ev.currentGame === 'tank' && !ev.isLastGame, 'Evening: starts on the first game of the playlist');

    // Ties share a place and the points of that place
    let res = ev.recordResult('tank', { ranking: [['a', 'b'], ['c']], teams: false, stats: { a: { kills: 5 }, b: { selfKills: 2 }, c: {} } });
    assert(res.points.a === 10 && res.points.b === 10 && res.points.c === 7, 'Evening: tied players share the points of their place');
    assert(ev.phase === 'STANDINGS' && ev.totals.a.wins === 1 && ev.totals.c.wins === 0, 'Evening: standings phase after a game, wins counted for place 1');
    assert(res.unlocked.some(u => u.playerId === 'a' && u.id === 'sharp'), 'Evening: achievement "Scharfschütze" unlocked from stats');
    assert(res.unlocked.some(u => u.playerId === 'b' && u.id === 'friendlyfire'), 'Evening: achievement for repeated self-kills unlocked');
    assert(ev.next() === 'uno' && ev.phase === 'PLAYING', 'Evening: next() moves on to the following game');

    res = ev.recordResult('uno', { ranking: [['c'], ['a'], ['b']], teams: false, stats: { c: { draws: 0 }, a: { draws: 14 }, b: {} } });
    assert(res.unlocked.some(u => u.playerId === 'c' && u.id === 'cleanwin'), 'Evening: "UNO without drawing" needs a win and zero draws');
    assert(res.unlocked.some(u => u.playerId === 'a' && u.id === 'collector'), 'Evening: heavy drawer gets the collector badge');
    ev.next();
    res = ev.recordResult('dodgeball', { ranking: [['a', 'c'], ['b']], teams: true, stats: { a: { catches: 3, rocks: 4 }, c: { catches: 1 } } });
    assert(res.points.a === 8 && res.points.c === 8 && res.points.b === 3, 'Evening: team games award winner/loser team points');
    assert(ev.phase === 'FINISHED' && ev.isLastGame, 'Evening: last game finishes the evening');

    const standings = ev.standings();
    assert(standings[0].id === 'a' && standings[0].points === 10 + 7 + 8, 'Evening: totals add up across games');
    assert(standings[0].rank === 1 && standings.every((t, i) => i === 0 || t.rank >= standings[i - 1].rank), 'Evening: ranks are ordered');

    const awards = ev.computeAwards();
    const award = id => awards.find(a => a.id === id);
    assert(award('catches') && award('catches').playerId === 'a' && award('catches').value === 3, 'Evening: "Meister des Fangens" sums catches over the evening');
    assert(award('rocks') && award('rocks').playerId === 'a', 'Evening: rock award goes to the rock layer');
    assert(award('selfKills') && award('selfKills').playerId === 'b', 'Evening: Friendly-Fire-Champion is the one with the most self-kills');
    assert(award('wins') && award('wins').playerId === 'a', 'Evening: most game wins is awarded');
    assert(!award('survival'), 'Evening: awards without any data are not handed out');

    const snap = ev.getSnapshot();
    assert(snap.phase === 'FINISHED' && snap.awards.length === awards.length && snap.standings.length === 3, 'Evening: snapshot carries standings and awards at the end');

    // Survival keeps the best single value instead of summing
    const ev2 = new sandbox.EveningSession();
    ev2.start(['curve', 'curve'], mkPlayers(['x', 'y']));
    ev2.recordResult('curve', { ranking: [['x'], ['y']], teams: false, stats: { x: { survival: 30 } } });
    ev2.next();
    ev2.recordResult('curve', { ranking: [['x'], ['y']], teams: false, stats: { x: { survival: 20 } } });
    assert(ev2.totals.x.stats.survival === 30, 'Evening: survival keeps the best round, not the sum');
}

console.log('\n--- TEST: SPIELEABEND CATCH-UP & RESULT EXTRACTION ---');
{
    const mkPlayers = ids => ids.map(id => ({ id, name: id, color: '#fff' }));
    const ev = new sandbox.EveningSession();
    ev.start(['tank', 'tank'], mkPlayers(['a', 'b', 'c', 'd']));
    ev.catchUpEnabled = true;
    assert(Object.keys(ev.catchUpMap()).length === 0, 'Catch-up: nothing before the first game');
    ev.recordResult('tank', { ranking: [['a'], ['b'], ['c'], ['d']], teams: false, stats: {} });
    const map = ev.catchUpMap();
    assert(map.a === 'leader' && map.d === 'trailer' && !map.b && !map.c, 'Catch-up: leader and last place are marked, the middle field is left alone');
    ev.catchUpEnabled = false;
    assert(Object.keys(ev.catchUpMap()).length === 0, 'Catch-up: switched off means no handicaps');

    const flat = new sandbox.EveningSession();
    flat.start(['tank', 'tank'], mkPlayers(['a', 'b']));
    flat.catchUpEnabled = true;
    flat.recordResult('tank', { ranking: [['a', 'b']], teams: false, stats: {} });
    assert(Object.keys(flat.catchUpMap()).length === 0, 'Catch-up: a tie at the top gives nobody a handicap');

    // extractGameResult reads finished games and ignores running ones
    const t = new sandbox.TankGame();
    t.addPlayer('p1', 'P1', '#fff');
    t.addPlayer('p2', 'P2', '#fff');
    t.startMatch(3);
    assert(sandbox.extractGameResult('tank', t) === null, 'Result: running game gives no result');
    t.status = 'MATCH_OVER';
    t.players.get('p1').score = 2;
    t.players.get('p2').score = 4;
    const tr = sandbox.extractGameResult('tank', t);
    assert(tr.ranking[0][0] === 'p2' && tr.ranking[1][0] === 'p1' && !tr.teams, 'Result: tank ranking follows the score');

    const d = new sandbox.DodgeballGame();
    d.addPlayer('s', 'S', '#fff', false, 'squad');
    d.addPlayer('c', 'C', '#fff', false, 'comn');
    d.status = 'MATCH_OVER';
    d.winner = 'ComN';
    const dr = sandbox.extractGameResult('dodgeball', d);
    assert(dr.teams && dr.ranking[0][0] === 'c' && dr.ranking[1][0] === 's', 'Result: dodgeball winner team ranks first');

    const cn = new sandbox.CodenamesGame();
    cn.addPlayer('r', 'R');
    cn.addPlayer('b', 'B');
    cn.setPlayerTeam('r', 'red');
    cn.setPlayerTeam('b', 'blue');
    cn.gameStatus = 'GAME_OVER';
    cn.winner = 'blue';
    const cr = sandbox.extractGameResult('codenames', cn);
    assert(cr.teams && cr.ranking[0][0] === 'b' && cr.ranking[1][0] === 'r', 'Result: codenames winner team ranks first');

    const u = new sandbox.UnoGame();
    ['u1', 'u2', 'u3'].forEach(id => u.addPlayer(id, id, '#fff'));
    u.startMatch();
    u.players.get('u2').hand = [];
    u.players.get('u1').hand = u.players.get('u1').hand.slice(0, 2);
    u.winner = u.players.get('u2');
    u.status = 'GAME_OVER';
    const ur = sandbox.extractGameResult('uno', u);
    assert(ur.ranking[0][0] === 'u2' && ur.ranking[1][0] === 'u1' && ur.ranking[2][0] === 'u3', 'Result: UNO ranks the winner first, then by fewest cards');
}

console.log('\n--- TEST: GAME STATS, HANDICAPS & TEAM MIXER ---');
{
    const g = {};
    sandbox.bumpStat(g, 'p', 'k');
    sandbox.bumpStat(g, 'p', 'k', 2);
    sandbox.bumpStat(g, 'p', 'best', 5, true);
    sandbox.bumpStat(g, 'p', 'best', 3, true);
    assert(g.stats.p.k === 3 && g.stats.p.best === 5, 'Stats: bumpStat adds, or keeps the maximum');

    const mkTank = () => {
        const t = new sandbox.TankGame();
        t.addPlayer('A', 'A', '#00f3ff');
        t.addPlayer('B', 'B', '#ff0055');
        t.pickupsEnabled = false;
        t.startMatch(3);
        t.walls = [];
        const a = t.players.get('A');
        const b = t.players.get('B');
        a.x = 200; a.y = 400; a.angle = 0;
        b.x = 800; b.y = 400; b.angle = Math.PI;
        return { t, a, b };
    };
    const kill = mkTank();
    kill.a.weapon = 'laser';
    kill.a.inputShoot = true;
    kill.t.update(0.016);
    assert(kill.t.stats.A && kill.t.stats.A.kills === 1, 'Stats: tank kills are counted');
    const own = mkTank();
    own.a.weapon = 'mine';
    own.a.inputShoot = true;
    own.t.update(0.016);
    own.a.inputShoot = false;
    own.b.x = 900; own.b.y = 700;
    own.t.update(2); // mine is armed and the owner stands on it
    assert(own.t.stats.A && own.t.stats.A.selfKills === 1, 'Stats: stepping on your own mine counts as a self-kill');

    const hc = new sandbox.TankGame();
    hc.addPlayer('A', 'A', '#fff');
    hc.addPlayer('B', 'B', '#fff');
    hc.handicaps = { A: 'trailer' };
    hc.startMatch(3);
    assert(hc.players.get('A').weapon !== null && hc.players.get('B').weapon === null, 'Catch-up: tank trailer starts the round armed');
    hc.handicaps = { B: 'leader' };
    const lead = hc.players.get('B');
    lead.weapon = null;
    lead.inputShoot = true;
    lead.cooldown = 0;
    hc.update(0.016);
    assert(Math.abs(lead.cooldown - 0.45 * 1.4) < 0.05, 'Catch-up: tank leader reloads slower');

    const db = new sandbox.DodgeballGame();
    db.addPlayer('s', 'S', '#fff', false, 'squad');
    db.addPlayer('c', 'C', '#fff', false, 'comn');
    db.handicaps = { s: 'trailer' };
    db.startMatch(3);
    assert(db.players.get('s').hp === 4 && db.players.get('c').hp === 3, 'Catch-up: dodgeball trailer gets an extra life');

    // Team mixer
    const mixDb = new sandbox.DodgeballGame();
    for (let i = 0; i < 6; i++) mixDb.addPlayer('p' + i, 'P' + i, '#fff', false, 'squad');
    mixDb.shuffleTeams();
    const squad = Array.from(mixDb.players.values()).filter(p => p.team === 'squad').length;
    assert(squad === 3, 'Team mixer: dodgeball teams are split evenly');
    mixDb.setTeam('p0', 'comn');
    assert(mixDb.players.get('p0').team === 'comn', 'Team mixer: a player can be moved by hand');

    const mixCn = new sandbox.CodenamesGame();
    for (let i = 0; i < 5; i++) mixCn.addPlayer('c' + i, 'C' + i);
    mixCn.addPlayer('bot', 'Bot', '#fff', true);
    mixCn.shuffleTeams();
    const red = Array.from(mixCn.players.values()).filter(p => p.team === 'red').length;
    const blue = Array.from(mixCn.players.values()).filter(p => p.team === 'blue').length;
    assert(red === 3 && blue === 3, 'Team mixer: codenames teams are split evenly');
    const botP = mixCn.players.get('bot');
    assert(botP.role === 'spymaster', 'Team mixer: the bot keeps a spymaster seat');
}

// ----------------------------------------------------
// TEST SUITE: QR-CODE & HANDY-CONTROLLER
// ----------------------------------------------------
{
    console.log('--- QR-Code & Controller ---');
    const link = sandbox.padBuildLink('https://example.github.io/data_squad_games/index.html?beamer=1#x', 'curve', 'ABCDE');
    assert(link === 'https://example.github.io/data_squad_games/index.html?game=curve&room=ABCDE&pad=1', 'Pad: share link drops beamer params and sets pad=1');
    assert(!sandbox.padBuildLink('https://x.de/', 'tank', 'ABCDE', false).includes('pad='), 'Pad: link without controller flag');

    const qr1 = sandbox.qrEncode('A');
    assert(qr1.version === 1 && qr1.size === 21 && qr1.modules.length === 21, 'QR: tiny text fits version 1 (21x21)');
    const qr = sandbox.qrEncode(link);
    assert(qr.version >= 3 && qr.version <= 6 && qr.size === qr.version * 4 + 17, `QR: share link fits a small version (v${qr.version})`);
    const finderOk = [[0, 0], [qr.size - 7, 0], [0, qr.size - 7]].every(([ox, oy]) => {
        for (let y = 0; y < 7; y++) {
            for (let x = 0; x < 7; x++) {
                const ring = Math.max(Math.abs(x - 3), Math.abs(y - 3));
                if (qr.modules[oy + y][ox + x] !== (ring !== 2)) return false;
            }
        }
        return true;
    });
    assert(finderOk, 'QR: all three finder patterns are drawn');
    let timingOk = true;
    for (let i = 8; i < qr.size - 8; i++) {
        if (qr.modules[6][i] !== (i % 2 === 0) || qr.modules[i][6] !== (i % 2 === 0)) timingOk = false;
    }
    assert(timingOk, 'QR: timing patterns alternate');
    assert(qr.modules[qr.size - 8][8] === true, 'QR: dark module is set');
    assert(JSON.stringify(sandbox.qrEncode(link).modules) === JSON.stringify(qr.modules), 'QR: encoding is deterministic');
    const longVer = sandbox.qrEncode('x'.repeat(200)).version;
    assert(longVer >= 9 && longVer <= 10, 'QR: long text switches to a higher version');
    let tooLong = false;
    try { sandbox.qrEncode('x'.repeat(400)); } catch { tooLong = true; }
    assert(tooLong, 'QR: over-long text is rejected');
    const svg = sandbox.qrToSvg(qr, 4, 'red; fill:url(x)', '#fff');
    assert(svg.startsWith('<svg') && !svg.includes('url('), 'QR: SVG output ignores unsafe colors');

    const dirs = sandbox.padStickToDirs(30, -35, 40, 10);
    assert(dirs.fwd && dirs.right && !dirs.back && !dirs.left, 'Stick: diagonal deflection sets two directions');
    const idle = sandbox.padStickToDirs(3, -4, 40, 10);
    assert(!idle.active && !idle.fwd && !idle.left, 'Stick: deadzone is ignored');
    const far = sandbox.padStickToDirs(400, 0, 40, 10);
    assert(Math.abs(far.x - 40) < 1e-9 && far.right, 'Stick: deflection is clamped to the radius');
    assert(Math.abs(sandbox.padStickToDirs(20, 0, 40, 10).mag - 0.5) < 1e-9 && sandbox.padStickToDirs(400, 0, 40, 10).mag === 1, 'Stick: magnitude is relative to the radius (0..1)');
    assert(sandbox.padHasController('dodgeball') && !sandbox.padHasController('uno'), 'Pad: controllers exist for realtime games only');
}

// ----------------------------------------------------
// TEST SUITE: TANK ZWEI-STICK-STEUERUNG
// ----------------------------------------------------
{
    console.log('--- Tank: Zwei-Stick-Steuerung ---');
    const tg = new sandbox.TankGame();
    tg.addPlayer('t1', 'T1', '#fff', false);
    tg.startMatch(3);
    tg.walls = []; // freies Feld
    tg.pickupsEnabled = false;
    tg.status = 'PLAYING';
    const t1 = tg.players.get('t1');
    t1.x = 600; t1.y = 400; t1.angle = 0; t1.cooldown = 0;

    tg.setTwinStick('t1', 0, -1, null, false);
    for (let i = 0; i < 25; i++) tg.update(0.02);
    assert(t1.y < 400 - 40 && Math.abs(t1.x - 600) < 1, 'Twin: left stick drives in any direction (straight up)');
    assert(Math.abs(Math.atan2(Math.sin(t1.angle), Math.cos(t1.angle)) - (-Math.PI / 2)) < 0.2, 'Twin: without aim the tank faces its driving direction');

    t1.x = 600; t1.y = 400; t1.angle = 0;
    tg.setTwinStick('t1', 1, 0, Math.PI / 2, false);
    for (let i = 0; i < 40; i++) tg.update(0.02);
    assert(t1.x > 600 + 40 && Math.abs(t1.angle - Math.PI / 2) < 0.05, 'Twin: aim stick turns the barrel independently of the driving direction');

    const bulletsBefore = tg.bullets.length;
    tg.setTwinStick('t1', 0, 0, Math.PI / 2, true);
    tg.update(0.02);
    assert(tg.bullets.length === bulletsBefore + 1, 'Twin: pulling the aim stick fully fires a bullet');
    tg.setTwinStick('t1', 0, 0, null, true);
    assert(t1.inputShoot === false, 'Twin: no aim direction means no shot');

    tg.setTwinStick('t1', NaN, 'x', Infinity, true);
    assert(t1.moveX === 0 && t1.moveY === 0 && t1.aimAngle === null && !t1.inputShoot, 'Twin: invalid values from peers are ignored');
    tg.setTwinStick('t1', 50, 0, 0, false);
    assert(Math.abs(Math.hypot(t1.moveX, t1.moveY) - 1) < 1e-9, 'Twin: stick vector is clamped to length 1');

    tg.walls = [{ x1: 700, y1: 0, x2: 700, y2: 800 }];
    t1.x = 670; t1.y = 400;
    tg.setTwinStick('t1', 1, 1, null, false);
    const y0 = t1.y;
    for (let i = 0; i < 20; i++) tg.update(0.02);
    assert(t1.x < 700 && t1.y > y0 + 20, 'Twin: tank slides along a wall instead of sticking');

    tg.setInput('t1', true, false, false, false, false);
    assert(t1.twin === false, 'Twin: keyboard input switches back to classic controls');
}

// ----------------------------------------------------
// TEST SUITE: BUGFIXES (Roulette, Codenames, Skribbl, Spieleabend)
// ----------------------------------------------------
{
    console.log('--- Bugfixes ---');
    const ROULETTE_CARDS_T = runInContext('ROULETTE_CARDS', sandbox);
    const SK_DRAW_T = runInContext('SKRIBBL_BOT_DRAWINGS', sandbox);
    const mkRoulette = () => {
        const g = new sandbox.FreigabeRouletteGame();
        ['a', 'b', 'c'].forEach(id => g.addPlayer(id, id, '#fff', false));
        g.startMatch();
        g.turnIndex = 0;
        g.status = 'PLAYING';
        return g;
    };
    const card = (id) => ({ ...ROULETTE_CARDS_T.find(c => c.id === id), uid: id + '-uid' });

    // Chef-Bypass hält über das Zugende hinaus
    let rg = mkRoulette();
    const a = rg.players.get('a');
    a.hand = [card('chef_genehmigung')];
    rg.playCard('a', 'chef_genehmigung-uid');
    rg.endTurn();
    assert(a.shielded === true, 'Roulette: Chef-Bypass bleibt nach dem eigenen Zugende aktiv');
    const b = rg.players.get('b');
    b.hand = [card('stein_weg')];
    const before = a.progress;
    rg.playCard('b', 'stein_weg-uid', 'a');
    assert(a.progress === before, 'Roulette: Chef-Bypass schützt vor einem Blocker im nächsten Zug');
    rg.endTurn(); rg.endTurn();
    assert(rg.getCurrentPlayer().id === 'a' && a.shielded === false, 'Roulette: Chef-Bypass endet beim eigenen nächsten Zug');

    // Reaktionskarten
    rg = mkRoulette();
    rg.players.get('a').hand = [card('stein_weg')];
    rg.players.get('b').hand = [card('problem_gefunden')];
    rg.players.get('b').progress = 40;
    rg.playCard('a', 'stein_weg-uid', 'b');
    assert(rg.players.get('b').progress === 40 && rg.players.get('b').hand.length === 0, 'Roulette: "Problem gefunden!" blockt den Angriff und wird verbraucht');

    rg = mkRoulette();
    rg.players.get('a').hand = [card('stein_weg')];
    rg.players.get('b').hand = [card('nicht_zustaendig')];
    rg.players.get('b').progress = 40; rg.players.get('c').progress = 40;
    rg.playCard('a', 'stein_weg-uid', 'b');
    assert(rg.players.get('b').progress === 40 && rg.players.get('c').progress === 25, 'Roulette: "Nicht zuständig" leitet den Angriff an den nächsten Spieler um');

    rg = mkRoulette();
    rg.players.get('a').hand = [card('problem_gefunden')];
    const played = rg.playCard('a', 'problem_gefunden-uid');
    assert(played.success === false && rg.players.get('a').hand.length === 1 && rg.cardsPlayedThisTurn === 0, 'Roulette: Reaktionskarten lassen sich nicht aktiv ausspielen');

    // Codenames: nur ein Hinweis pro Zug
    const cnG = new sandbox.CodenamesGame();
    cnG.addPlayer('s1', 'S1');
    cnG.addPlayer('s2', 'S2');
    cnG.startNewGame();
    const spy = Array.from(cnG.players.values()).find(p => p.role === 'spymaster' && p.team === cnG.currentTurn);
    if (spy) {
        const ok1 = cnG.giveClue('TEST', 1, spy.id);
        const left = cnG.guessesLeft;
        const ok2 = cnG.giveClue('MEHR', 9, spy.id);
        assert(ok1 && !ok2 && cnG.guessesLeft === left && cnG.clueWord === 'TEST', 'Codenames: ein zweiter Hinweis im selben Zug wird abgelehnt');
    }

    // Skribbl: Zeichner wird nach der Wortwahl zum Bot
    const skB = new sandbox.SkribblGame();
    skB.addPlayer('h', 'H', '#fff', false);
    skB.addPlayer('x', 'X', '#fff', false);
    skB.startMatch(1);
    const drawerB = skB.players.get(skB.activeDrawerId);
    drawerB.isBot = true;
    skB.wordChoices = ['ZZZ-unbekannt', 'a', 'b'];
    skB.updateTick(15);
    assert(Object.keys(SK_DRAW_T).some(k => k.toUpperCase() === skB.secretWord), 'Skribbl: Bot-Zeichner bekommt nur Wörter, die er zeichnen kann');

    // Spieleabend: Siegerteam ohne Spieler
    const dbE = new sandbox.DodgeballGame();
    dbE.addPlayer('s', 'S', '#fff', false, 'squad');
    dbE.addPlayer('c', 'C', '#fff', false, 'squad');
    dbE.status = 'MATCH_OVER';
    dbE.winner = 'ComN';
    const res = sandbox.extractGameResult('dodgeball', dbE);
    assert(res && res.ranking[0].length === 0 && res.ranking[1].length === 2, 'Evening: leeres Siegerteam rückt das Verliererteam nicht auf Platz 1');
    const evS = new sandbox.EveningSession();
    evS.start(['dodgeball'], [{ id: 's', name: 'S', color: '#fff' }, { id: 'c', name: 'C', color: '#fff' }]);
    evS.recordResult('dodgeball', res);
    assert(evS.totals.s.wins === 0 && evS.totals.c.wins === 0, 'Evening: niemand bekommt einen Sieg, wenn das Siegerteam leer ist');
}

console.log('\n========================================');
console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('========================================\n');

if (failed > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
