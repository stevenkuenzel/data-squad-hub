/**
 * DataSquad Hub UI: Hauptschleife & URL-Direktbeitritt
 * Klassisches Script – teilt den globalen Scope mit den übrigen ui/*.js (Ladereihenfolge siehe index.html).
 */

// ==========================================
// MAIN LOOP (Simulation entkoppelt von rAF für Hintergrund-Tab-Stabilität)
// ==========================================
let lastSimTime = performance.now();
let netBroadcastTimer = 0;
let clientInputTimer = 0;

function simulationStep(now = performance.now()) {
    const elapsed = (now - lastSimTime) / 1000;
    if (elapsed < 0.004) return; // Doppel-Ticks zwischen rAF und setInterval vermeiden
    const dt = Math.min(elapsed, 0.1);
    lastSimTime = now;

    // 1. Host authoritative simulation
    if (networkManager.isHost) {
        eveningTick(dt);
        if (activeGameType === 'curve') {
            curveGame.update(dt);
        } else if (activeGameType === 'skribbl') {
            const prevStatus = skribblGame.status;
            const prevSec = Math.ceil(skribblGame.timeLeft);
            const prevHint = skribblGame.revealedHint;
            skribblGame.updateTick(dt);
            // Bot drawers/guessers produce strokes and guesses that must be shown and synced
            for (const stroke of skribblGame.drainStrokes()) {
                applySkStroke(stroke);
                networkManager.broadcast('SK_STROKE', stroke);
            }
            for (const res of skribblGame.drainEvents()) handleSkribblGuessResult(res);
            if (skribblGame.status !== prevStatus || Math.ceil(skribblGame.timeLeft) !== prevSec || skribblGame.revealedHint !== prevHint) {
                broadcastSkribblState();
            }
        } else if (activeGameType === 'codenames') {
            if (codenamesGame.update(dt)) broadcastCodenamesState();
        } else if (activeGameType === 'tank') {
            tankGame.update(dt);
        } else if (activeGameType === 'pong') {
            octaPongGame.update(dt);
        } else if (activeGameType === 'uno') {
            const prevTurn = unoGame.turnIndex;
            const prevStatus = unoGame.status;
            unoGame.update(dt);
            if (unoGame.turnIndex !== prevTurn || unoGame.status !== prevStatus) {
                broadcastUnoState();
            }
        } else if (activeGameType === 'dodgeball') {
            dodgeballGame.update(dt);
        } else if (activeGameType === 'roulette') {
            const prevTurn = rouletteGame.turnIndex;
            const prevStatus = rouletteGame.status;
            const prevCards = rouletteGame.cardsPlayedThisTurn;
            rouletteGame.update(dt);
            if (rouletteGame.turnIndex !== prevTurn || rouletteGame.status !== prevStatus || rouletteGame.cardsPlayedThisTurn !== prevCards) {
                broadcastRouletteState();
            }
        } else if (activeGameType === 'hotel') {
            const prevVersion = hotelGame.version;
            hotelGame.update(dt);
            if (hotelGame.version !== prevVersion) broadcastHotelState();
        }

        // Broadcast states at ~35Hz
        netBroadcastTimer += dt;
        if (netBroadcastTimer >= 0.028) {
            netBroadcastTimer = 0;
            if (activeGameType === 'curve') {
                networkManager.broadcast('STATE', curveGame.getSnapshot());
            } else if (activeGameType === 'tank') {
                networkManager.broadcast('STATE', tankGame.getSnapshot());
            } else if (activeGameType === 'pong') {
                networkManager.broadcast('STATE', octaPongGame.getSnapshot());
            } else if (activeGameType === 'dodgeball') {
                networkManager.broadcast('DB_STATE', dodgeballGame.getSnapshot());
            }
        }
    } else {
        // Client inputs streaming
        clientInputTimer += dt;
        if (clientInputTimer >= 0.025) {
            clientInputTimer = 0;
            sendClientInputs();
        }
    }
}

function masterLoop(now) {
    requestAnimationFrame(masterLoop);
    simulationStep(now);

    // 2. Render active game (am Handy-Controller gibt es kein Spielfeld)
    if (padActive) return;
    if (gameViews.curve.classList.contains('active')) renderCurve();
    else if (gameViews.tank.classList.contains('active')) renderTank();
    else if (gameViews.pong.classList.contains('active')) renderPong();
    else if (gameViews.dodgeball.classList.contains('active')) renderDodgeball();
}

function sendClientInputs() {
    if (!networkManager.hostConn || !networkManager.hostConn.open) return;

    if (activeGameType === 'curve') {
        const left = !!(keys.ArrowLeft || keys.KeyA);
        const right = !!(keys.ArrowRight || keys.KeyD);
        networkManager.sendToHost('INPUT', { left, right });
    } else if (activeGameType === 'tank') {
        if (tankTwin.on) {
            // Handy-Controller mit zwei Sticks
            networkManager.sendToHost('INPUT', { twin: { mx: tankTwin.mx, my: tankTwin.my, aim: tankTwin.aim, fire: tankTwin.fire } });
            return;
        }
        const fwd = !!(keys.ArrowUp || keys.KeyW);
        const back = !!(keys.ArrowDown || keys.KeyS);
        const left = !!(keys.ArrowLeft || keys.KeyA);
        const right = !!(keys.ArrowRight || keys.KeyD);
        const shoot = !!keys.Space;
        networkManager.sendToHost('INPUT', { fwd, back, left, right, shoot });
    } else if (activeGameType === 'pong') {
        const left = !!(keys.ArrowLeft || keys.KeyA);
        const right = !!(keys.ArrowRight || keys.KeyD);
        networkManager.sendToHost('INPUT', { left, right });
    } else if (activeGameType === 'dodgeball') {
        const fwd = !!(keys.ArrowUp || keys.KeyW);
        const back = !!(keys.ArrowDown || keys.KeyS);
        const left = !!(keys.ArrowLeft || keys.KeyA);
        const right = !!(keys.ArrowRight || keys.KeyD);
        const throwBall = !!(keys.Space || dbMouseThrow);
        const dash = !!(keys.ShiftLeft || keys.ShiftRight);
        networkManager.sendToHost('DB_INPUT', {
            fwd,
            back,
            left,
            right,
            throwBall,
            dash,
            aimAngle: dbAimAngle
        });
    }
}

// Host local input update for games
function updateHostLocalInputs() {
    if (!networkManager.isHost || beamerMode) return;
    if (activeGameType === 'curve') {
        curveGame.setPlayerInput(myPlayerId, !!(keys.ArrowLeft || keys.KeyA), !!(keys.ArrowRight || keys.KeyD));
    } else if (activeGameType === 'tank') {
        tankGame.setInput(
            myPlayerId,
            !!(keys.ArrowUp || keys.KeyW),
            !!(keys.ArrowDown || keys.KeyS),
            !!(keys.ArrowLeft || keys.KeyA),
            !!(keys.ArrowRight || keys.KeyD),
            !!keys.Space
        );
    } else if (activeGameType === 'pong') {
        octaPongGame.setInput(myPlayerId, !!(keys.ArrowLeft || keys.KeyA), !!(keys.ArrowRight || keys.KeyD));
    } else if (activeGameType === 'dodgeball') {
        const fwd = !!(keys.ArrowUp || keys.KeyW);
        const back = !!(keys.ArrowDown || keys.KeyS);
        const left = !!(keys.ArrowLeft || keys.KeyA);
        const right = !!(keys.ArrowRight || keys.KeyD);
        const throwBall = !!(keys.Space || dbMouseThrow);
        const dash = !!(keys.ShiftLeft || keys.ShiftRight);
        dodgeballGame.setInput(myPlayerId, fwd, back, left, right, throwBall, dash, dbAimAngle);
    }
}

setInterval(updateHostLocalInputs, 20);
// Fallback-Timer hält Host-Simulation & Broadcasts aktiv, wenn der Browser-Tab im Hintergrund ist
setInterval(() => simulationStep(performance.now()), 25);
requestAnimationFrame(masterLoop);

// ==========================================
// URL DIRECT JOIN ROUTING
// ==========================================
const urlParams = new URLSearchParams(window.location.search);
const roomParam = urlParams.get('room');
const gameParam = urlParams.get('game');

if (roomParam) {
    joinCodeInput.value = roomParam.trim().toUpperCase();
    if (gameParam && gameViews[gameParam]) {
        setupLobbyForGame(gameParam);
    }
    joinRoomWithCode(joinCodeInput.value, gameParam);
}
