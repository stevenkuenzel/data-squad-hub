/**
 * DataSquad Hub: Automated Game Engine & Physics Simulation Test Suite
 * Executes deterministic physics, collision, state, and rule tests for all 5 games.
 */

import { readFileSync } from 'fs';
import { createContext, runInContext } from 'vm';

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

// Load game files into sandbox
const tankSrc = readFileSync('./games/tank.js', 'utf-8');
const pongSrc = readFileSync('./games/pong.js', 'utf-8');
const skribblSrc = readFileSync('./games/skribbl.js', 'utf-8');
const codenamesSrc = readFileSync('./games/codenames.js', 'utf-8');
const curveSrc = readFileSync('./game.js', 'utf-8');
const unoSrc = readFileSync('./games/uno.js', 'utf-8');

runInContext(tankSrc, sandbox);
runInContext(pongSrc, sandbox);
runInContext(skribblSrc, sandbox);
runInContext(codenamesSrc, sandbox);
runInContext(curveSrc, sandbox);
runInContext(unoSrc, sandbox);

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
const drawer = skribbl.addPlayer('drawer1', 'Kuenstler', '#00f3ff');
const guesser1 = skribbl.addPlayer('guess1', 'Rater 1', '#ff00ff');
const guesser2 = skribbl.addPlayer('guess2', 'Rater 2', '#39ff14');

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
const botHandCount = uBot.hand.length;
// Update with enough time for botActionTimer
uno.botActionTimer = 0.05;
uno.update(0.1);
assert(uno.turnIndex !== uno.playerOrder.indexOf('uBot'), 'Bot executed turn and passed turn index');


console.log('\n========================================');
console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('========================================\n');

if (failed > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
