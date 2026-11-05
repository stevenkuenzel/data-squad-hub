/**
 * DataSquad Hub UI: Lobby, Netzwerk-Events, Spielstart
 * Klassisches Script – teilt den globalen Scope mit den übrigen ui/*.js (Ladereihenfolge siehe index.html).
 */

// ==========================================
// UNIVERSAL LOBBY LOGIC
// ==========================================
function updateLobbyUI() {
    lobbyPlayerList.innerHTML = '';
    const g = getActiveGameInstance();
    let count = 0;

    for (const p of g.players.values()) {
        count++;
        const li = document.createElement('li');
        li.className = 'player-item';

        const leftDiv = document.createElement('div');
        leftDiv.className = 'player-item-info';

        const dot = document.createElement('span');
        dot.className = 'player-dot';
        dot.style.backgroundColor = p.color || '#00f3ff';
        dot.style.boxShadow = `0 0 8px ${p.color || '#00f3ff'}`;

        const name = document.createElement('span');
        name.textContent = p.name + (p.id === myPlayerId ? ' (Du)' : '');
        name.style.fontWeight = p.id === myPlayerId ? 'bold' : 'normal';

        leftDiv.appendChild(dot);
        const av = avatarHtml(p.id, p.isBot);
        if (av) {
            const avEl = document.createElement('span');
            avEl.innerHTML = av;
            leftDiv.appendChild(avEl);
        }
        leftDiv.appendChild(name);

        const badge = document.createElement('span');
        badge.className = 'badge';
        if (p.isBot) badge.textContent = 'BOT';
        else if (p.id === myPlayerId && networkManager.isHost) {
            badge.textContent = 'HOST';
            badge.style.color = 'var(--cyan)';
        } else badge.textContent = 'SPIELER';

        li.appendChild(leftDiv);

        // Team games: show the team and let the host move players around
        const teamInfo = lobbyTeamInfo(p);
        if (teamInfo) {
            const chip = document.createElement('button');
            chip.className = 'team-chip ' + teamInfo.cls;
            chip.textContent = teamInfo.label;
            chip.title = networkManager.isHost ? 'Klicken, um das Team zu wechseln' : '';
            chip.disabled = !networkManager.isHost;
            chip.addEventListener('click', () => toggleLobbyTeam(p.id));
            li.appendChild(chip);
        }
        li.appendChild(badge);
        lobbyPlayerList.appendChild(li);
    }

    playerCount.textContent = count;
    btnAddBot.disabled = count >= MAX_HUB_PLAYERS;
}

// Team assignment as the lobby shows it (host: game state, guests: last LOBBY_UPDATE)
const lobbyTeams = new Map();
const TEAM_LABELS = {
    red: { label: '🔴 Rot', cls: 'team-a' }, blue: { label: '🔵 Blau', cls: 'team-b' },
    squad: { label: '🔷 Data Squad', cls: 'team-a' }, comn: { label: '🟥 ComN', cls: 'team-b' }
};

function lobbyTeamInfo(p) {
    if (eveningMode || (activeGameType !== 'codenames' && activeGameType !== 'dodgeball')) return null;
    const team = networkManager.isHost ? p.team : lobbyTeams.get(p.id);
    return TEAM_LABELS[team] || null;
}

function toggleLobbyTeam(playerId) {
    if (!networkManager.isHost) return;
    const g = getActiveGameInstance();
    const p = g.players.get(playerId);
    if (!p) return;
    if (activeGameType === 'codenames') g.setPlayerTeam(playerId, p.team === 'red' ? 'blue' : 'red');
    else if (activeGameType === 'dodgeball') g.setTeam(playerId, p.team === 'squad' ? 'comn' : 'squad');
    broadcastLobby();
    updateLobbyUI();
}

function setupLobbyForGame(gameType) {
    activeGameType = gameType;
    const titles = {
        curve: 'Curve Arena',
        codenames: 'Codenames',
        skribbl: 'Montagsmaler',
        tank: 'Tank Trouble',
        pong: 'Octa-Pong',
        uno: 'UNO',
        dodgeball: 'Corporate Dodgeball (Data Squad vs. ComN)',
        roulette: 'ComN: Freigabe-Roulette'
    };
    lobbyGameTitle.textContent = eveningMode ? '🎉 Spieleabend' : (titles[gameType] || 'Lobby');
    curveSettings.style.display = (gameType === 'curve' && !eveningMode) ? 'block' : 'none';
    btnAddBot.style.display = 'block';
    updateGameSettingsVisibility();
    lobbyMaxPlayers.textContent = (gameType === 'tank' || gameType === 'pong' || gameType === 'uno' || gameType === 'dodgeball' || gameType === 'roulette') ? '8' : '12';
    updateLobbyInstructions(gameType);
}

// Host Game from Card
async function hostLobby(gameType, evening = false) {
    resetSessionState();
    eveningMode = evening;
    setupLobbyForGame(gameType);
    if (window.soundFX) window.soundFX.playClick();

    try {
        const code = await networkManager.hostRoom();
        myPlayerId = networkManager.myPeerId;
        displayRoomCode.textContent = code;

        hostLobbyControls.style.display = 'flex';
        clientLobbyNotice.style.display = 'none';
        lobbyRoleText.textContent = 'Du bist der Host. Lade dein Team ein!';

        const g = getActiveGameInstance();
        clearGamePlayers(g);
        g.addPlayer(myPlayerId, getPlayerName(), selectedColor, false);
        setProfile(myPlayerId, myAvatar, myHat);

        updateLobbyUI();
        updateGameSettingsVisibility();
        if (typeof renderEveningPanel === 'function') renderEveningPanel();
        showScreen(lobbyScreen);
    } catch (err) {
        alert('Fehler beim Hosten: ' + err.message);
    }
}

document.querySelectorAll('.btn-host-game').forEach(btn => {
    btn.addEventListener('click', () => hostLobby(btn.getAttribute('data-game'), false));
});

const btnHostEvening = document.getElementById('btn-host-evening');
if (btnHostEvening) btnHostEvening.addEventListener('click', () => hostLobby('curve', true));

// Join Game
async function joinRoomWithCode(code, expectedGame = null) {
    if (!code || code.length < 4) {
        alert('Bitte einen gültigen Raum-Code eingeben!');
        return;
    }

    if (window.soundFX) window.soundFX.playClick();
    btnJoinRoom.disabled = true;
    btnJoinRoom.textContent = 'Verbinde...';

    try {
        await networkManager.joinRoom(code);
        myPlayerId = networkManager.myPeerId;
        displayRoomCode.textContent = code;

        hostLobbyControls.style.display = 'none';
        clientLobbyNotice.style.display = 'block';
        lobbyRoleText.textContent = 'Verbunden mit Raum ' + code;

        networkManager.sendToHost('JOIN', joinPayload(expectedGame));

        showScreen(lobbyScreen);
    } catch {
        alert('Verbindung fehlgeschlagen. Überprüfe den Code!');
    } finally {
        btnJoinRoom.disabled = false;
        btnJoinRoom.textContent = 'Beitreten';
    }
}

btnJoinRoom.addEventListener('click', () => {
    joinRoomWithCode(joinCodeInput.value.trim().toUpperCase());
});

btnCopyLink.addEventListener('click', () => {
    if (!networkManager.roomCode) return;
    const link = getShareableLink(activeGameType, networkManager.roomCode);
    navigator.clipboard.writeText(link).then(() => {
        btnCopyLink.textContent = 'Kopiert! ✓';
        setTimeout(() => { btnCopyLink.textContent = 'Link kopieren'; }, 2000);
    });
});

btnAddBot.addEventListener('click', () => {
    const g = getActiveGameInstance();
    if (g.players.size >= MAX_HUB_PLAYERS) return;
    if (window.soundFX) window.soundFX.playClick();

    const botIdx = g.players.size;
    const botId = `bot-${botIdx}`;
    const botColor = getUnusedColor();
    const names = ['Cyber', 'Pulse', 'Shadow', 'Apex', 'Matrix', 'Volt', 'Titan', 'Viper', 'Nova', 'Echo'];
    const botName = 'Bot ' + names[(botIdx - 1) % names.length];

    g.addPlayer(botId, botName, botColor, true);
    broadcastLobby();
    updateLobbyUI();
});

btnStartGame.addEventListener('click', () => {
    if (window.soundFX) window.soundFX.playClick();
    if (eveningMode) {
        startEvening();
        return;
    }
    if (activeGameType === 'dodgeball' && dodgeballFillBots) fillDodgeballBots();
    networkManager.broadcast('START_GAME', {
        gameType: activeGameType,
        snapshot: getActiveGameInstance().getSnapshot ? getActiveGameInstance().getSnapshot() : null
    });
    launchGameView(activeGameType, true);
});

btnLeaveLobby.addEventListener('click', () => {
    openHub();
});

function broadcastLobby() {
    const g = getActiveGameInstance();
    const playersList = Array.from(g.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        isBot: p.isBot,
        team: p.team
    }));
    networkManager.broadcast('LOBBY_UPDATE', {
        gameType: activeGameType,
        evening: eveningMode,
        players: playersList
    });
}

// ==========================================
// NETWORK EVENT HANDLER
// ==========================================
networkManager.onEvent = (type, payload, senderId) => {
    if (!payload || typeof payload !== 'object') payload = {};
    try {
        handleNetworkEvent(type, payload, senderId);
    } catch (err) {
        // A malformed packet from one peer must never crash the host loop
        console.warn(`[Net] Ignored malformed '${type}' from ${senderId}:`, err);
    }
};

function handleNetworkEvent(type, payload, senderId) {
    const g = getActiveGameInstance();

    // HOST
    if (networkManager.isHost) {
        if (type === 'JOIN') {
            hostHandleJoin(senderId, payload);
        } else if (type === 'PEER_DISCONNECTED') {
            hostHandlePeerGone(senderId);
        } else if (type === 'REACT') {
            hostHandleReaction(networkManager.playerIdOf(senderId), payload);
        } else {
            // Route game-specific host events (by stable player id, not by connection)
            handleHostGameEvent(type, payload, networkManager.playerIdOf(senderId));
        }
    }
    // CLIENT
    else {
        if (type === 'ROOM_INFO') {
            eveningMode = !!payload.evening;
            setupLobbyForGame(payload.gameType);
            updateLobbyUI();
        } else if (type === 'REJOINED') {
            if (typeof payload.playerId === 'string') myPlayerId = payload.playerId;
        } else if (type === 'PROFILES') {
            applyProfiles(payload.list);
        } else if (type === 'REACT') {
            spawnReaction(payload.emoji, payload.name);
        } else if (type === 'PROMOTED') {
            setSpectator(false);
            showToast('Du spielst jetzt mit!');
        } else if (type === 'LOBBY_UPDATE') {
            eveningMode = !!payload.evening;
            setupLobbyForGame(payload.gameType);
            const lg = getActiveGameInstance();
            clearGamePlayers(lg);
            lobbyTeams.clear();
            for (const p of payload.players) {
                lg.addPlayer(p.id, p.name, p.color, p.isBot);
                lobbyTeams.set(p.id, p.team);
            }
            updateLobbyUI();
        } else if (type === 'START_GAME') {
            eveningMode = !!payload.evening;
            setSpectator(!!payload.spectator);
            setupLobbyForGame(payload.gameType);
            launchGameView(payload.gameType, false);
            const sg = getActiveGameInstance();
            if (payload.snapshot && sg.applySnapshot) {
                sg.applySnapshot(payload.snapshot);
            }
        } else if (type === 'HOST_DISCONNECTED') {
            clientHandleHostLost();
        } else if (type === 'EVENING_STATE') {
            handleEveningState(payload);
        } else if (type === 'BACK_TO_LOBBY') {
            handleBackToLobby();
        } else {
            // Route game-specific client events
            handleClientGameEvent(type, payload);
        }
    }
}

// ==========================================
// LAUNCH GAME ARENAS
// ==========================================
function launchGameView(gameType, isHost) {
    showScreen(gameViews[gameType]);
    if (isHost) roomStarted = true;
    document.body.classList.toggle('evening-active', eveningMode);

    if (gameType === 'curve') {
        document.getElementById('curve-room-code').textContent = networkManager.roomCode || 'SOLO';
        syncCurvePerksUI();
        if (isHost) {
            curveGame.resetMatch();
            curveGame.startCountdown();
        }
    } else if (gameType === 'codenames') {
        document.getElementById('cn-room-code').textContent = networkManager.roomCode || 'LOKAL';
        if (isHost) {
            codenamesGame.startNewGame();
            broadcastCodenamesState();
        }
        renderCodenamesBoard();
    } else if (gameType === 'skribbl') {
        if (isHost) {
            skribblGame.startMatch(3);
            broadcastSkribblState();
        }
        setupSkribblUI();
    } else if (gameType === 'tank') {
        document.getElementById('tank-room-code').textContent = networkManager.roomCode || 'SOLO';
        if (isHost) {
            tankGame.startMatch(5);
        }
    } else if (gameType === 'pong') {
        document.getElementById('pong-room-code').textContent = networkManager.roomCode || 'SOLO';
        if (isHost) {
            octaPongGame.startMatch();
        }
    } else if (gameType === 'uno') {
        document.getElementById('uno-room-code').textContent = networkManager.roomCode || 'SOLO';
        if (isHost) {
            unoGame.startMatch();
            broadcastUnoState();
        }
        renderUnoSnapshot(unoGame.getSnapshot(myPlayerId));
    } else if (gameType === 'dodgeball') {
        document.getElementById('db-room-code').textContent = networkManager.roomCode || 'SOLO';
        if (isHost) {
            dodgeballGame.startMatch(3);
        }
    } else if (gameType === 'roulette') {
        document.getElementById('roulette-room-code').textContent = networkManager.roomCode || 'SOLO';
        if (isHost) {
            rouletteGame.startMatch();
            broadcastRouletteState();
        }
        renderRouletteSnapshot(rouletteGame.getSnapshot(myPlayerId));
    }
}
