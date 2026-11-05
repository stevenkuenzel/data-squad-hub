/**
 * DataSquad Hub UI: Spielspezifisches Netzwerk-Routing
 * Klassisches Script – teilt den globalen Scope mit den übrigen ui/*.js (Ladereihenfolge siehe index.html).
 */

// ==========================================
// ROUTE GAME-SPECIFIC NETWORKING
// ==========================================
function handleHostGameEvent(type, payload, senderId) {
    // Only peers that joined the lobby may act in a game
    if (!getActiveGameInstance().players.has(senderId)) return;

    if (type === 'INPUT') {
        if (activeGameType === 'curve') {
            curveGame.setPlayerInput(senderId, payload.left, payload.right);
        } else if (activeGameType === 'tank') {
            tankGame.setInput(senderId, payload.fwd, payload.back, payload.left, payload.right, payload.shoot);
        } else if (activeGameType === 'pong') {
            octaPongGame.setInput(senderId, payload.left, payload.right);
        }
    } else if (type === 'CN_CLUE') {
        codenamesGame.giveClue(payload.clue, payload.count, senderId);
        broadcastCodenamesState();
    } else if (type === 'CN_REVEAL') {
        codenamesGame.revealCard(payload.cardId, senderId);
        broadcastCodenamesState();
    } else if (type === 'CN_END_TURN') {
        if (codenamesGame.endTurn(senderId)) broadcastCodenamesState();
    } else if (type === 'CN_ASSIGN') {
        if (codenamesGame.assignTeamAndRole(senderId, payload.team, payload.role)) broadcastCodenamesState();
    } else if (type === 'SK_STROKE') {
        // addStroke checks the sender is the drawer and returns a cleaned copy
        const stroke = skribblGame.addStroke(payload, senderId);
        if (!stroke) return;
        applySkStroke(stroke);
        networkManager.broadcast('SK_STROKE', stroke);
    } else if (type === 'SK_CLEAR') {
        if (!skribblGame.clearCanvas(senderId)) return;
        clearSkCanvas();
        networkManager.broadcast('SK_CLEAR', {});
    } else if (type === 'SK_UNDO') {
        if (!skribblGame.undoLast(senderId)) return;
        undoSkLocal();
        networkManager.broadcast('SK_UNDO', {});
    } else if (type === 'SK_CHOOSE_WORD') {
        if (skribblGame.chooseWord(payload.word, senderId)) broadcastSkribblState();
    } else if (type === 'SK_GUESS') {
        const res = skribblGame.handleGuess(senderId, payload.text);
        handleSkribblGuessResult(res);
    } else if (type === 'UNO_PLAY') {
        unoGame.playCard(senderId, payload.cardId, payload.color);
        broadcastUnoState();
    } else if (type === 'UNO_DRAW') {
        unoGame.playerDrawCard(senderId);
        broadcastUnoState();
    } else if (type === 'UNO_CALL') {
        unoGame.callUno(senderId);
        broadcastUnoState();
    } else if (type === 'UNO_SWAP') {
        unoGame.chooseSwapTarget(senderId, payload.targetId);
        broadcastUnoState();
    } else if (type === 'UNO_COLOR') {
        unoGame.chooseWildColor(senderId, payload.color);
        broadcastUnoState();
    } else if (type === 'DB_INPUT') {
        dodgeballGame.setInput(
            senderId,
            payload.fwd,
            payload.back,
            payload.left,
            payload.right,
            payload.throwBall,
            payload.dash,
            payload.aimAngle
        );
    } else if (type === 'ROULETTE_PLAY') {
        rouletteGame.playCard(senderId, payload.cardUid, payload.targetId);
        broadcastRouletteState();
    } else if (type === 'ROULETTE_END_TURN') {
        const curr = rouletteGame.getCurrentPlayer();
        if (curr && curr.id === senderId) {
            rouletteGame.endTurn();
            broadcastRouletteState();
        }
    }
}

function handleClientGameEvent(type, payload) {
    if (type === 'STATE') {
        if (activeGameType === 'curve') curveGame.applySnapshot(payload);
        else if (activeGameType === 'tank') tankGame.applySnapshot(payload);
        else if (activeGameType === 'pong') octaPongGame.applySnapshot(payload);
    } else if (type === 'CN_STATE') {
        codenamesGame.board = payload.cards;
        codenamesGame.scoreRed = payload.scoreRed;
        codenamesGame.scoreBlue = payload.scoreBlue;
        codenamesGame.currentTurn = payload.currentTurn;
        codenamesGame.clueWord = payload.clueWord;
        codenamesGame.clueCount = payload.clueCount;
        codenamesGame.guessesLeft = payload.guessesLeft;
        codenamesGame.logs = payload.logs;
        renderCodenamesBoard(payload);
    } else if (type === 'SK_STATE') {
        renderSkribblSnapshot(payload);
    } else if (type === 'SK_STROKE') {
        applySkStroke(payload);
    } else if (type === 'SK_CLEAR') {
        clearSkCanvas();
    } else if (type === 'SK_UNDO') {
        undoSkLocal();
    } else if (type === 'SK_SYNC') {
        // Full drawing history for someone who joined or reconnected mid-turn
        clearSkCanvas();
        if (Array.isArray(payload.strokes)) payload.strokes.forEach(applySkStroke);
    } else if (type === 'SK_CHAT') {
        if (payload.isMatch) {
            addSkChatMsg('', payload.systemMsg, true);
            if (window.soundFX) window.soundFX.playWin();
        } else if (payload.chatMsg) {
            addSkChatMsg(payload.chatMsg.name, payload.chatMsg.text, false);
        }
    } else if (type === 'UNO_STATE') {
        renderUnoSnapshot(payload);
    } else if (type === 'DB_STATE') {
        dodgeballGame.applySnapshot(payload);
    } else if (type === 'ROULETTE_STATE') {
        renderRouletteSnapshot(payload);
    }
}
