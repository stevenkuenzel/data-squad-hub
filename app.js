/**
 * DataSquad Hub Controller: Universal Multi-Game Router & Network Coordinator
 * Games: Curve Arena, Codenames, Montagsmaler (Skribbl), Tank Trouble, Octa-Pong
 */

(function () {
    // DOM Elements - Hub & Navigation
    const homeScreen = document.getElementById('home-screen');
    const lobbyScreen = document.getElementById('lobby-screen');
    const playerNameInput = document.getElementById('player-name');
    const colorPickerContainer = document.getElementById('color-picker');
    const joinCodeInput = document.getElementById('join-code-input');
    const btnJoinRoom = document.getElementById('btn-join-room');

    // Universal Lobby Elements
    const lobbyGameTitle = document.getElementById('lobby-game-title');
    const lobbyRoleText = document.getElementById('lobby-role-text');
    const displayRoomCode = document.getElementById('display-room-code');
    const btnCopyLink = document.getElementById('btn-copy-link');
    const lobbyPlayerList = document.getElementById('lobby-player-list');
    const playerCount = document.getElementById('player-count');
    const lobbyMaxPlayers = document.getElementById('lobby-max-players');
    const btnAddBot = document.getElementById('btn-add-bot');
    const btnStartGame = document.getElementById('btn-start-game');
    const btnLeaveLobby = document.getElementById('btn-leave-lobby');
    const hostLobbyControls = document.getElementById('host-lobby-controls');
    const clientLobbyNotice = document.getElementById('client-lobby-notice');
    const curveSettings = document.getElementById('curve-settings');
    const btnToggleGaps = document.getElementById('btn-toggle-gaps');

    // Game Views
    const gameViews = {
        curve: document.getElementById('game-curve'),
        codenames: document.getElementById('game-codenames'),
        skribbl: document.getElementById('game-skribbl'),
        tank: document.getElementById('game-tank'),
        pong: document.getElementById('game-pong')
    };

    // State
    let activeGameType = 'curve';
    let myPlayerId = 'p-' + Math.floor(Math.random() * 100000);
    const MAX_HUB_PLAYERS = 12;

    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // Color Setup
    const randomInitialColorIdx = Math.floor(Math.random() * PLAYER_COLORS.length);
    let selectedColor = PLAYER_COLORS[randomInitialColorIdx].hex;

    PLAYER_COLORS.forEach((c, idx) => {
        const swatch = document.createElement('div');
        swatch.className = 'color-option' + (idx === randomInitialColorIdx ? ' selected' : '');
        swatch.style.backgroundColor = c.hex;
        swatch.title = c.name;
        swatch.addEventListener('click', () => {
            document.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
            swatch.classList.add('selected');
            selectedColor = c.hex;
            if (window.soundFX) window.soundFX.playClick();
        });
        colorPickerContainer.appendChild(swatch);
    });

    const savedName = localStorage.getItem('dsg_player_name');
    if (savedName) playerNameInput.value = savedName;

    function getPlayerName() {
        const val = playerNameInput.value.trim() || 'Player 1';
        localStorage.setItem('dsg_player_name', val);
        return val;
    }

    function getShareableLink(gameType, code) {
        const url = new URL(window.location.href);
        url.searchParams.set('game', gameType);
        url.searchParams.set('room', code);
        return url.toString();
    }

    // ==========================================
    // VIEW ROUTING
    // ==========================================
    function showScreen(screenEl) {
        homeScreen.classList.remove('active');
        lobbyScreen.classList.remove('active');
        Object.values(gameViews).forEach(v => v.classList.remove('active'));
        if (screenEl) screenEl.classList.add('active');
    }

    function openHub() {
        if (networkManager.peer) networkManager.disconnect();
        showScreen(homeScreen);
        const url = new URL(window.location.href);
        url.search = '';
        window.history.replaceState({}, '', url.toString());
    }

    document.querySelectorAll('.btn-hub-back').forEach(btn => {
        btn.addEventListener('click', () => {
            if (confirm('Möchtest du das aktuelle Spiel verlassen und zum Hub zurückkehren?')) {
                openHub();
            }
        });
    });

    // Mute & Fullscreen buttons
    document.querySelectorAll('.btn-mute-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const isMuted = window.soundFX.toggleMute();
            document.querySelectorAll('.btn-mute-toggle').forEach(b => b.textContent = isMuted ? '🔇' : '🔊');
        });
    });

    document.querySelectorAll('.btn-fullscreen-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
            } else {
                document.exitFullscreen().catch(() => {});
            }
        });
    });

    // ==========================================
    // GAME INSTANCES
    // ==========================================
    const curveGame = new CurveGame();
    const codenamesGame = new CodenamesGame();
    const skribblGame = new SkribblGame();
    const tankGame = new TankGame();
    const octaPongGame = new OctaPongGame();

    function getActiveGameInstance() {
        switch (activeGameType) {
            case 'curve': return curveGame;
            case 'codenames': return codenamesGame;
            case 'skribbl': return skribblGame;
            case 'tank': return tankGame;
            case 'pong': return octaPongGame;
            default: return curveGame;
        }
    }

    function getUnusedColor() {
        const g = getActiveGameInstance();
        const used = new Set();
        for (const p of g.players.values()) {
            if (p.color) used.add(p.color.toLowerCase());
        }
        const avail = PLAYER_COLORS.filter(c => !used.has(c.hex.toLowerCase()));
        if (avail.length > 0) return avail[Math.floor(Math.random() * avail.length)].hex;
        return PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)].hex;
    }

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
            leftDiv.appendChild(name);

            const badge = document.createElement('span');
            badge.className = 'badge';
            if (p.isBot) badge.textContent = 'BOT';
            else if (p.id === myPlayerId && networkManager.isHost) {
                badge.textContent = 'HOST';
                badge.style.color = 'var(--cyan)';
            } else badge.textContent = 'SPIELER';

            li.appendChild(leftDiv);
            li.appendChild(badge);
            lobbyPlayerList.appendChild(li);
        }

        playerCount.textContent = count;
        btnAddBot.disabled = count >= MAX_HUB_PLAYERS;
    }

    function setupLobbyForGame(gameType) {
        activeGameType = gameType;
        const titles = {
            curve: 'Curve Arena',
            codenames: 'Codenames',
            skribbl: 'Montagsmaler',
            tank: 'Tank Trouble',
            pong: 'Octa-Pong'
        };
        lobbyGameTitle.textContent = titles[gameType] || 'Lobby';
        curveSettings.style.display = gameType === 'curve' ? 'block' : 'none';
        btnAddBot.style.display = (gameType === 'codenames' || gameType === 'skribbl') ? 'none' : 'block';
    }

    // Host Game from Card
    document.querySelectorAll('.btn-host-game').forEach(btn => {
        btn.addEventListener('click', async () => {
            const gameType = btn.getAttribute('data-game');
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
                g.players.clear();
                g.addPlayer(myPlayerId, getPlayerName(), selectedColor, false);

                updateLobbyUI();
                showScreen(lobbyScreen);
            } catch (err) {
                alert('Fehler beim Hosten: ' + err.message);
            }
        });
    });

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

            networkManager.sendToHost('JOIN', {
                name: getPlayerName(),
                color: selectedColor,
                expectedGame
            });

            showScreen(lobbyScreen);
        } catch (err) {
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
            isBot: p.isBot
        }));
        networkManager.broadcast('LOBBY_UPDATE', {
            gameType: activeGameType,
            players: playersList
        });
    }

    // ==========================================
    // NETWORK EVENT HANDLER
    // ==========================================
    networkManager.onEvent = (type, payload, senderId) => {
        const g = getActiveGameInstance();

        // HOST
        if (networkManager.isHost) {
            if (type === 'JOIN') {
                if (g.players.size >= MAX_HUB_PLAYERS) {
                    networkManager.sendTo(senderId, { type: 'ROOM_FULL', payload: { msg: 'Raum voll.' } });
                    return;
                }
                const assignedColor = getUnusedColor();
                g.addPlayer(senderId, payload.name, assignedColor, false);
                // Inform client which game is running!
                networkManager.sendTo(senderId, {
                    type: 'ROOM_INFO',
                    payload: { gameType: activeGameType }
                });
                broadcastLobby();
                updateLobbyUI();
            } else if (type === 'PEER_DISCONNECTED') {
                g.removePlayer(senderId);
                broadcastLobby();
                updateLobbyUI();
            } else {
                // Route game-specific host events
                handleHostGameEvent(type, payload, senderId);
            }
        }
        // CLIENT
        else {
            if (type === 'ROOM_INFO') {
                setupLobbyForGame(payload.gameType);
                updateLobbyUI();
            } else if (type === 'LOBBY_UPDATE') {
                setupLobbyForGame(payload.gameType);
                g.players.clear();
                for (const p of payload.players) {
                    g.addPlayer(p.id, p.name, p.color, p.isBot);
                }
                updateLobbyUI();
            } else if (type === 'START_GAME') {
                setupLobbyForGame(payload.gameType);
                launchGameView(payload.gameType, false);
                if (payload.snapshot && g.applySnapshot) {
                    g.applySnapshot(payload.snapshot);
                }
            } else {
                // Route game-specific client events
                handleClientGameEvent(type, payload);
            }
        }
    };

    // ==========================================
    // LAUNCH GAME ARENAS
    // ==========================================
    function launchGameView(gameType, isHost) {
        showScreen(gameViews[gameType]);

        if (gameType === 'curve') {
            document.getElementById('curve-room-code').textContent = networkManager.roomCode || 'SOLO';
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
        }
    }

    // ==========================================
    // GAME 1: CURVE ARENA
    // ==========================================
    const curveCanvas = document.getElementById('curveCanvas');
    const curveCtx = curveCanvas.getContext('2d');
    const curveScoresContainer = document.getElementById('curve-scores-container');
    const curveRoundDisplay = document.getElementById('curve-round-display');
    const curveCountdownOverlay = document.getElementById('curve-countdown-overlay');
    const curveCountdownNum = document.getElementById('curve-countdown-num');
    const curveWinnerOverlay = document.getElementById('curve-winner-overlay');
    const curveWinnerText = document.getElementById('curve-winner-text');

    // Local Keys
    const keys = {
        ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false,
        KeyA: false, KeyD: false, KeyW: false, KeyS: false, Space: false
    };

    window.addEventListener('keydown', (e) => {
        if (e.code in keys) {
            keys[e.code] = true;
            if (['game-curve', 'game-tank', 'game-pong'].some(id => document.getElementById(id).classList.contains('active'))) {
                e.preventDefault();
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.code in keys) keys[e.code] = false;
    });

    // Touch controls
    const bindTouch = (elId, code) => {
        const el = document.getElementById(elId);
        if (!el) return;
        el.addEventListener('touchstart', (e) => { e.preventDefault(); keys[code] = true; }, { passive: false });
        el.addEventListener('touchend', (e) => { e.preventDefault(); keys[code] = false; }, { passive: false });
    };

    bindTouch('curve-touch-left', 'ArrowLeft');
    bindTouch('curve-touch-right', 'ArrowRight');
    bindTouch('tank-touch-left', 'ArrowLeft');
    bindTouch('tank-touch-right', 'ArrowRight');
    bindTouch('tank-touch-fwd', 'ArrowUp');
    bindTouch('tank-touch-shoot', 'Space');
    bindTouch('pong-touch-left', 'ArrowLeft');
    bindTouch('pong-touch-right', 'ArrowRight');

    // Curve settings
    if (btnToggleGaps) {
        btnToggleGaps.addEventListener('click', () => {
            curveGame.enableGaps = !curveGame.enableGaps;
            btnToggleGaps.textContent = curveGame.enableGaps ? 'AN' : 'AUS';
        });
    }

    document.querySelectorAll('#diff-selector .diff-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#diff-selector .diff-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            curveGame.botDifficulty = btn.getAttribute('data-diff');
        });
    });

    document.querySelector('.btn-play-again-curve').addEventListener('click', () => {
        curveWinnerOverlay.style.display = 'none';
        if (networkManager.isHost) {
            curveGame.resetMatch();
            curveGame.startCountdown();
        }
    });

    function renderCurve() {
        curveCtx.fillStyle = '#05070d';
        curveCtx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

        // Border
        curveCtx.strokeStyle = 'rgba(0, 243, 255, 0.4)';
        curveCtx.lineWidth = 3;
        curveCtx.strokeRect(1.5, 1.5, ARENA_WIDTH - 3, ARENA_HEIGHT - 3);

        // Trails
        curveCtx.lineCap = 'round';
        curveCtx.lineJoin = 'round';
        curveCtx.lineWidth = LINE_RADIUS * 2;
        for (const seg of curveGame.segments) {
            curveCtx.strokeStyle = seg.color;
            curveCtx.beginPath();
            curveCtx.moveTo(seg.x1, seg.y1);
            curveCtx.lineTo(seg.x2, seg.y2);
            curveCtx.stroke();
        }

        // Heads
        for (const p of curveGame.players.values()) {
            if (!p.alive) continue;
            curveCtx.save();
            if (!p.isDrawing) {
                curveCtx.globalAlpha = 0.5;
                curveCtx.shadowColor = '#ffffff';
                curveCtx.shadowBlur = 18;
            } else {
                curveCtx.shadowColor = p.color;
                curveCtx.shadowBlur = 12;
            }
            curveCtx.fillStyle = '#ffffff';
            curveCtx.beginPath();
            curveCtx.arc(p.x, p.y, LINE_RADIUS + 1, 0, Math.PI * 2);
            curveCtx.fill();

            const tipX = p.x + Math.cos(p.angle) * (LINE_RADIUS + 4);
            const tipY = p.y + Math.sin(p.angle) * (LINE_RADIUS + 4);
            curveCtx.strokeStyle = p.color;
            curveCtx.lineWidth = 2.5;
            curveCtx.beginPath();
            curveCtx.moveTo(p.x, p.y);
            curveCtx.lineTo(tipX, tipY);
            curveCtx.stroke();
            curveCtx.restore();
        }

        // Particles
        for (const pt of curveGame.particles) {
            curveCtx.save();
            curveCtx.globalAlpha = Math.max(0, pt.life);
            curveCtx.fillStyle = pt.color;
            curveCtx.beginPath();
            curveCtx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
            curveCtx.fill();
            curveCtx.restore();
        }

        // HUD & Overlays
        curveRoundDisplay.textContent = `${curveGame.roundNumber} / ${curveGame.maxRounds}`;
        curveScoresContainer.innerHTML = '';
        for (const p of curveGame.players.values()) {
            const badge = document.createElement('div');
            badge.className = 'score-badge' + (!p.alive ? ' dead' : '');
            badge.style.borderLeft = `3px solid ${p.color}`;
            const sName = document.createElement('span');
            sName.style.color = p.color;
            sName.textContent = p.name;
            const sScore = document.createElement('span');
            sScore.textContent = String(p.score);
            badge.appendChild(sName);
            badge.appendChild(sScore);
            curveScoresContainer.appendChild(badge);
        }

        if (curveGame.state === 'COUNTDOWN') {
            curveCountdownOverlay.style.display = 'block';
            curveCountdownNum.textContent = curveGame.countdownTimer > 0 ? Math.ceil(curveGame.countdownTimer) : 'LOS!';
            curveWinnerOverlay.style.display = 'none';
        } else if (curveGame.state === 'ROUND_OVER' || curveGame.state === 'MATCH_OVER') {
            curveCountdownOverlay.style.display = 'none';
            curveWinnerOverlay.style.display = 'block';
            curveWinnerText.textContent = curveGame.matchWinner 
                ? `🏆 ${curveGame.matchWinner.name} GEWINNT DAS MATCH!` 
                : (curveGame.roundWinner ? `${curveGame.roundWinner.name} gewinnt die Runde!` : 'Unentschieden!');
        } else {
            curveCountdownOverlay.style.display = 'none';
            curveWinnerOverlay.style.display = 'none';
        }
    }

    // ==========================================
    // GAME 2: CODENAMES
    // ==========================================
    const codenamesBoard = document.getElementById('codenames-board');
    const cnScoreRed = document.getElementById('cn-score-red');
    const cnScoreBlue = document.getElementById('cn-score-blue');
    const cnTurnIndicator = document.getElementById('cn-turn-indicator');
    const cnMyRoleBadge = document.getElementById('cn-my-role-badge');
    const cnRosterRed = document.getElementById('cn-roster-red');
    const cnRosterBlue = document.getElementById('cn-roster-blue');
    const btnJoinRedOp = document.getElementById('btn-join-red-op');
    const btnJoinRedSpy = document.getElementById('btn-join-red-spy');
    const btnJoinBlueOp = document.getElementById('btn-join-blue-op');
    const btnJoinBlueSpy = document.getElementById('btn-join-blue-spy');
    const cnSpymasterBar = document.getElementById('cn-spymaster-bar');
    const cnOperativeBar = document.getElementById('cn-operative-bar');
    const cnClueWordInput = document.getElementById('cn-clue-word');
    const cnClueCountSelect = document.getElementById('cn-clue-count');
    const btnGiveClue = document.getElementById('btn-give-clue');
    const btnEndTurn = document.getElementById('btn-end-turn');
    const cnCurrentClueDisplay = document.getElementById('cn-current-clue-display');
    const codenamesLog = document.getElementById('codenames-log');

    let latestCodenamesSnap = null;

    function setCodenamesTeamAndRole(team, role) {
        if (networkManager.isHost) {
            codenamesGame.assignTeamAndRole(myPlayerId, team, role);
            broadcastCodenamesState();
        } else {
            networkManager.sendToHost('CN_ASSIGN', { team, role });
        }
    }

    if (btnJoinRedOp) btnJoinRedOp.addEventListener('click', () => setCodenamesTeamAndRole('red', 'operative'));
    if (btnJoinRedSpy) btnJoinRedSpy.addEventListener('click', () => setCodenamesTeamAndRole('red', 'spymaster'));
    if (btnJoinBlueOp) btnJoinBlueOp.addEventListener('click', () => setCodenamesTeamAndRole('blue', 'operative'));
    if (btnJoinBlueSpy) btnJoinBlueSpy.addEventListener('click', () => setCodenamesTeamAndRole('blue', 'spymaster'));

    btnGiveClue.addEventListener('click', () => {
        const clue = cnClueWordInput.value.trim();
        const count = cnClueCountSelect.value;
        if (!clue) return;
        if (networkManager.isHost) {
            codenamesGame.giveClue(clue, count, myPlayerId);
            broadcastCodenamesState();
        } else {
            networkManager.sendToHost('CN_CLUE', { clue, count });
        }
        cnClueWordInput.value = '';
    });

    btnEndTurn.addEventListener('click', () => {
        if (networkManager.isHost) {
            codenamesGame.endTurn();
            broadcastCodenamesState();
        } else {
            networkManager.sendToHost('CN_END_TURN', {});
        }
    });

    function renderCodenamesBoard(remoteSnap = null) {
        const snap = remoteSnap || codenamesGame.getSnapshot(myPlayerId);
        latestCodenamesSnap = snap;

        cnScoreRed.textContent = snap.scoreRed;
        cnScoreBlue.textContent = snap.scoreBlue;

        cnTurnIndicator.textContent = snap.currentTurn === 'red' ? 'TEAM ROT AM ZUG' : 'TEAM BLAU AM ZUG';
        cnTurnIndicator.style.color = snap.currentTurn === 'red' ? '#ff3333' : '#0099ff';

        // Identify local player team and role
        const playersList = snap.players || [];
        const myPlayer = playersList.find(p => p.id === myPlayerId) || { team: 'red', role: 'operative' };
        const myTeam = myPlayer.team;
        const myRole = myPlayer.role;

        if (cnMyRoleBadge) {
            cnMyRoleBadge.textContent = `Du: ${myTeam === 'red' ? 'Team Rot' : (myTeam === 'blue' ? 'Team Blau' : 'Zuschauer')} (${myRole === 'spymaster' ? 'Spionchef 🕵️' : 'Ermittler 👥'})`;
            cnMyRoleBadge.style.color = myTeam === 'red' ? '#ff6666' : (myTeam === 'blue' ? '#66b3ff' : '#aaa');
        }

        // Render Roster Lists
        if (cnRosterRed) {
            cnRosterRed.innerHTML = '';
            playersList.filter(p => p.team === 'red').forEach(p => {
                const pill = document.createElement('span');
                pill.className = `cn-player-pill ${p.role}`;
                pill.textContent = `${p.role === 'spymaster' ? '🕵️' : '👥'} ${p.name}`;
                cnRosterRed.appendChild(pill);
            });
        }
        if (cnRosterBlue) {
            cnRosterBlue.innerHTML = '';
            playersList.filter(p => p.team === 'blue').forEach(p => {
                const pill = document.createElement('span');
                pill.className = `cn-player-pill ${p.role}`;
                pill.textContent = `${p.role === 'spymaster' ? '🕵️' : '👥'} ${p.name}`;
                cnRosterBlue.appendChild(pill);
            });
        }

        if (snap.clueWord) {
            cnCurrentClueDisplay.textContent = `Hinweis: "${snap.clueWord}" (${snap.clueCount} Wörter, ${snap.guessesLeft} Versuche)`;
        } else {
            cnCurrentClueDisplay.textContent = 'Warte auf Spionchef-Hinweis...';
        }

        // Spymaster controls vs Operative controls
        const isMyTurn = snap.currentTurn === myTeam;
        const isSpymaster = myRole === 'spymaster';
        const hasActiveClue = snap.guessesLeft > 0;

        cnSpymasterBar.style.display = (isSpymaster && isMyTurn && !hasActiveClue) ? 'flex' : 'none';
        cnOperativeBar.style.display = (!isSpymaster || hasActiveClue || !isMyTurn) ? 'flex' : 'none';
        btnEndTurn.disabled = !(isMyTurn && !isSpymaster && hasActiveClue);

        codenamesBoard.classList.toggle('spymaster-mode', isSpymaster);

        codenamesBoard.innerHTML = '';
        snap.cards.forEach(card => {
            const el = document.createElement('div');
            el.className = `cn-card type-${card.type}` + (card.revealed ? ' revealed' : '');
            el.textContent = card.word;

            // Only operatives on their team's turn with active guesses can click cards
            const canClick = !isSpymaster && isMyTurn && hasActiveClue && !card.revealed;
            if (!canClick) {
                el.style.cursor = 'default';
            }

            el.addEventListener('click', () => {
                if (card.revealed) return;
                if (!canClick) return;

                if (networkManager.isHost) {
                    codenamesGame.revealCard(card.id, myPlayerId);
                    broadcastCodenamesState();
                } else {
                    networkManager.sendToHost('CN_REVEAL', { cardId: card.id });
                }
            });
            codenamesBoard.appendChild(el);
        });

        codenamesLog.innerHTML = (snap.logs || []).map(l => `<div>• ${l}</div>`).join('');
    }

    function broadcastCodenamesState() {
        for (const conn of networkManager.connections.values()) {
            if (conn.open) {
                conn.send({
                    type: 'CN_STATE',
                    payload: codenamesGame.getSnapshot(conn.peer)
                });
            }
        }
        renderCodenamesBoard();
    }

    // ==========================================
    // GAME 3: SKRIBBL (MONTAGSMALER)
    // ==========================================
    const skribblCanvas = document.getElementById('skribblCanvas');
    const skCtx = skribblCanvas.getContext('2d');
    const skTimeLeft = document.getElementById('sk-time-left');
    const skWordHint = document.getElementById('sk-word-hint');
    const skRoundNum = document.getElementById('sk-round-num');
    const skPlayersList = document.getElementById('sk-players-list');
    const skChatLog = document.getElementById('sk-chat-log');
    const skChatForm = document.getElementById('sk-chat-form');
    const skGuessInput = document.getElementById('sk-guess-input');
    const skDrawTools = document.getElementById('sk-draw-tools');
    const skColorPalette = document.getElementById('sk-color-palette');
    const btnSkClear = document.getElementById('btn-sk-clear');
    const skWordChoiceOverlay = document.getElementById('sk-word-choice-overlay');
    const skWordChoiceContainer = document.getElementById('sk-word-choice-container');

    let skCurrentColor = '#000000';
    let skCurrentSize = 4;
    let isDrawingSk = false;
    let lastDrawX = 0, lastDrawY = 0;

    const SK_PALETTE = ['#000000', '#ffffff', '#ff0000', '#0099ff', '#00cc44', '#ffaa00', '#9900ff', '#8b5a2b'];
    SK_PALETTE.forEach((hex, idx) => {
        const btn = document.createElement('div');
        btn.className = 'sk-color-btn' + (idx === 0 ? ' selected' : '');
        btn.style.backgroundColor = hex;
        btn.addEventListener('click', () => {
            document.querySelectorAll('.sk-color-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            skCurrentColor = hex;
        });
        skColorPalette.appendChild(btn);
    });

    document.querySelectorAll('.size-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            skCurrentSize = parseInt(btn.getAttribute('data-size'), 10);
        });
    });

    btnSkClear.addEventListener('click', () => {
        skCtx.fillStyle = '#ffffff';
        skCtx.fillRect(0, 0, skribblCanvas.width, skribblCanvas.height);
        if (networkManager.isHost) {
            skribblGame.clearCanvas();
            networkManager.broadcast('SK_CLEAR', {});
        } else {
            networkManager.sendToHost('SK_CLEAR', {});
        }
    });

    function getCanvasCoords(e) {
        const rect = skribblCanvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const scaleX = skribblCanvas.width / rect.width;
        const scaleY = skribblCanvas.height / rect.height;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    function startSkDraw(e) {
        if (skribblGame.activeDrawerId !== myPlayerId || skribblGame.status !== 'DRAWING') return;
        isDrawingSk = true;
        const coords = getCanvasCoords(e);
        lastDrawX = coords.x;
        lastDrawY = coords.y;
    }

    function moveSkDraw(e) {
        if (!isDrawingSk || skribblGame.activeDrawerId !== myPlayerId || skribblGame.status !== 'DRAWING') return;
        const coords = getCanvasCoords(e);
        const stroke = {
            x1: Math.round(lastDrawX),
            y1: Math.round(lastDrawY),
            x2: Math.round(coords.x),
            y2: Math.round(coords.y),
            color: skCurrentColor,
            size: skCurrentSize
        };
        drawSkStroke(stroke);

        if (networkManager.isHost) {
            skribblGame.addStroke(stroke);
            networkManager.broadcast('SK_STROKE', stroke);
        } else {
            networkManager.sendToHost('SK_STROKE', stroke);
        }
        lastDrawX = coords.x;
        lastDrawY = coords.y;
    }

    function stopSkDraw() { isDrawingSk = false; }

    skribblCanvas.addEventListener('mousedown', startSkDraw);
    skribblCanvas.addEventListener('mousemove', moveSkDraw);
    window.addEventListener('mouseup', stopSkDraw);

    skribblCanvas.addEventListener('touchstart', (e) => { e.preventDefault(); startSkDraw(e); }, { passive: false });
    skribblCanvas.addEventListener('touchmove', (e) => { e.preventDefault(); moveSkDraw(e); }, { passive: false });
    window.addEventListener('touchend', stopSkDraw);

    function drawSkStroke(s) {
        skCtx.lineCap = 'round';
        skCtx.lineJoin = 'round';
        skCtx.strokeStyle = s.color;
        skCtx.lineWidth = s.size;
        skCtx.beginPath();
        skCtx.moveTo(s.x1, s.y1);
        skCtx.lineTo(s.x2, s.y2);
        skCtx.stroke();
    }

    skChatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (skGuessInput.disabled) return;
        const text = skGuessInput.value.trim();
        if (!text) return;
        skGuessInput.value = '';

        if (networkManager.isHost) {
            const res = skribblGame.handleGuess(myPlayerId, text);
            handleSkribblGuessResult(res);
        } else {
            networkManager.sendToHost('SK_GUESS', { text });
        }
    });

    function addSkChatMsg(name, text, isCorrect = false) {
        const div = document.createElement('div');
        div.className = 'chat-msg' + (isCorrect ? ' correct' : '');
        div.textContent = isCorrect ? text : `${name}: ${text}`;
        skChatLog.appendChild(div);
        skChatLog.scrollTop = skChatLog.scrollHeight;
    }

    function setupSkribblUI() {
        skCtx.fillStyle = '#ffffff';
        skCtx.fillRect(0, 0, skribblCanvas.width, skribblCanvas.height);
        renderSkribblSnapshot(skribblGame.getSnapshot(myPlayerId));
    }

    function renderSkribblSnapshot(snap) {
        skTimeLeft.textContent = `${snap.timeLeft}s`;
        skRoundNum.textContent = `${snap.currentRound} / ${snap.totalRounds}`;
        skWordHint.textContent = snap.displayWord;

        const isDrawer = snap.activeDrawerId === myPlayerId;
        skDrawTools.style.display = isDrawer ? 'flex' : 'none';

        // Manage Guess Input: Drawer cannot guess, players who already guessed cannot guess again
        const myPlayer = snap.players.find(p => p.id === myPlayerId);
        const hasGuessed = myPlayer ? myPlayer.hasGuessed : false;
        const skSubmitBtn = skChatForm.querySelector('button[type="submit"]');

        if (isDrawer) {
            skGuessInput.disabled = true;
            skGuessInput.placeholder = "Du zeichnest gerade! (Kein Raten möglich)";
            if (skSubmitBtn) skSubmitBtn.disabled = true;
        } else if (hasGuessed) {
            skGuessInput.disabled = true;
            skGuessInput.placeholder = "Richtig erraten! Warte auf die nächste Runde...";
            if (skSubmitBtn) skSubmitBtn.disabled = true;
        } else if (snap.status === 'CHOOSING') {
            skGuessInput.disabled = true;
            skGuessInput.placeholder = `${snap.activeDrawerName || 'Der Zeichner'} wählt ein Wort...`;
            if (skSubmitBtn) skSubmitBtn.disabled = true;
        } else {
            skGuessInput.disabled = false;
            skGuessInput.placeholder = "Begriff eingeben & Enter...";
            if (skSubmitBtn) skSubmitBtn.disabled = false;
        }

        // Word choices modal
        if (isDrawer && snap.status === 'CHOOSING' && snap.wordChoices.length > 0) {
            skWordChoiceOverlay.style.display = 'block';
            skWordChoiceContainer.innerHTML = '';
            snap.wordChoices.forEach(w => {
                const b = document.createElement('button');
                b.className = 'btn btn-primary';
                b.textContent = w;
                b.addEventListener('click', () => {
                    skWordChoiceOverlay.style.display = 'none';
                    if (networkManager.isHost) {
                        skribblGame.chooseWord(w);
                        broadcastSkribblState();
                    } else {
                        networkManager.sendToHost('SK_CHOOSE_WORD', { word: w });
                    }
                });
                skWordChoiceContainer.appendChild(b);
            });
        } else {
            skWordChoiceOverlay.style.display = 'none';
        }

        // Players Panel
        skPlayersList.innerHTML = '';
        snap.players.sort((a, b) => b.score - a.score).forEach(p => {
            const div = document.createElement('div');
            div.style.padding = '6px';
            div.style.marginBottom = '4px';
            div.style.borderRadius = '4px';
            div.style.background = p.hasGuessed ? 'rgba(57, 255, 20, 0.15)' : 'rgba(255,255,255,0.03)';
            div.innerHTML = `<strong>${p.name}</strong><br><span style="color: var(--cyan);">${p.score} Pkt</span>`;
            skPlayersList.appendChild(div);
        });
    }

    function broadcastSkribblState() {
        for (const conn of networkManager.connections.values()) {
            if (conn.open) {
                conn.send({
                    type: 'SK_STATE',
                    payload: skribblGame.getSnapshot(conn.peer)
                });
            }
        }
        renderSkribblSnapshot(skribblGame.getSnapshot(myPlayerId));
    }

    function handleSkribblGuessResult(res) {
        if (res.isMatch) {
            addSkChatMsg('', res.systemMsg, true);
            if (window.soundFX) window.soundFX.playWin();
            broadcastSkribblState();
            networkManager.broadcast('SK_CHAT', { systemMsg: res.systemMsg, isMatch: true });
        } else if (res.chatMsg && res.chatMsg.name) {
            addSkChatMsg(res.chatMsg.name, res.chatMsg.text, false);
            networkManager.broadcast('SK_CHAT', { chatMsg: res.chatMsg });
        }
    }

    // ==========================================
    // GAME 4: TANK TROUBLE
    // ==========================================
    const tankCanvas = document.getElementById('tankCanvas');
    const tankCtx = tankCanvas.getContext('2d');
    const tankRoundDisplay = document.getElementById('tank-round-display');
    const tankScoresContainer = document.getElementById('tank-scores-container');
    const tankWinnerOverlay = document.getElementById('tank-winner-overlay');
    const tankWinnerText = document.getElementById('tank-winner-text');

    function renderTank() {
        tankCtx.fillStyle = '#060810';
        tankCtx.fillRect(0, 0, TANK_ARENA_W, TANK_ARENA_H);

        // Draw Maze Walls
        tankCtx.strokeStyle = 'rgba(0, 243, 255, 0.5)';
        tankCtx.lineWidth = 4;
        tankCtx.lineCap = 'round';
        for (const w of tankGame.walls) {
            tankCtx.beginPath();
            tankCtx.moveTo(w.x1, w.y1);
            tankCtx.lineTo(w.x2, w.y2);
            tankCtx.stroke();
        }

        // Draw Bouncing Bullets
        for (const b of tankGame.bullets) {
            tankCtx.fillStyle = b.color || '#ff007f';
            tankCtx.beginPath();
            tankCtx.arc(b.x, b.y, BULLET_RADIUS, 0, Math.PI * 2);
            tankCtx.fill();
        }

        // Draw Tanks
        for (const p of tankGame.players.values()) {
            if (!p.alive) continue;
            tankCtx.save();
            tankCtx.translate(p.x, p.y);
            tankCtx.rotate(p.angle);

            // Tank Body
            tankCtx.fillStyle = p.color;
            tankCtx.shadowColor = p.color;
            tankCtx.shadowBlur = 10;
            tankCtx.fillRect(-TANK_RADIUS, -TANK_RADIUS * 0.75, TANK_RADIUS * 2, TANK_RADIUS * 1.5);

            // Turret Cannon
            tankCtx.fillStyle = '#ffffff';
            tankCtx.fillRect(0, -2.5, TANK_RADIUS + 8, 5);

            tankCtx.restore();
        }

        // Particles
        for (const pt of tankGame.particles) {
            tankCtx.save();
            tankCtx.globalAlpha = Math.max(0, pt.life);
            tankCtx.fillStyle = pt.color;
            tankCtx.beginPath();
            tankCtx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
            tankCtx.fill();
            tankCtx.restore();
        }

        // Tank HUD
        tankRoundDisplay.textContent = `${tankGame.round} / ${tankGame.maxRounds}`;
        tankScoresContainer.innerHTML = '';
        for (const p of tankGame.players.values()) {
            const badge = document.createElement('div');
            badge.className = 'score-badge' + (!p.alive ? ' dead' : '');
            badge.style.borderLeft = `3px solid ${p.color}`;
            badge.innerHTML = `<span style="color: ${p.color};">${p.name}</span><span>${p.score}</span>`;
            tankScoresContainer.appendChild(badge);
        }

        if (tankGame.status === 'ROUND_OVER' || tankGame.status === 'MATCH_OVER') {
            tankWinnerOverlay.style.display = 'block';
            tankWinnerText.textContent = tankGame.matchWinner 
                ? `🏆 ${tankGame.matchWinner.name} HAT GEWONNEN!` 
                : (tankGame.roundWinner ? `${tankGame.roundWinner.name} gewinnt die Runde!` : 'Unentschieden!');
        } else {
            tankWinnerOverlay.style.display = 'none';
        }
    }

    // ==========================================
    // GAME 5: OCTA-PONG (8-SPIELER PONG)
    // ==========================================
    const pongCanvas = document.getElementById('pongCanvas');
    const pongCtx = pongCanvas.getContext('2d');
    const pongScoresContainer = document.getElementById('pong-scores-container');
    const pongCountdownOverlay = document.getElementById('pong-countdown-overlay');
    const pongCountdownNum = document.getElementById('pong-countdown-num');
    const pongWinnerOverlay = document.getElementById('pong-winner-overlay');
    const pongWinnerText = document.getElementById('pong-winner-text');

    document.querySelector('.btn-play-again-pong').addEventListener('click', () => {
        pongWinnerOverlay.style.display = 'none';
        if (networkManager.isHost) {
            octaPongGame.startMatch();
        }
    });

    function renderPong() {
        pongCtx.fillStyle = '#05070d';
        pongCtx.fillRect(0, 0, 1200, 800);

        // Draw Octagon Perimeter & Paddles
        for (let s = 0; s < 8; s++) {
            const { p1, p2 } = octaPongGame.getSideSegment(s);
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;

            // Find active player on this side
            let player = null;
            for (const pl of octaPongGame.players.values()) {
                if (pl.sideIdx === s && pl.alive) {
                    player = pl;
                    break;
                }
            }

            if (player) {
                // Goal perimeter line (dimmed)
                pongCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                pongCtx.lineWidth = 2;
                pongCtx.beginPath();
                pongCtx.moveTo(p1.x, p1.y);
                pongCtx.lineTo(p2.x, p2.y);
                pongCtx.stroke();

                // Draw Sliding Paddle
                const halfW = PADDLE_WIDTH_RATIO / 2;
                const padStartT = Math.max(0, player.paddlePos - halfW);
                const padEndT = Math.min(1, player.paddlePos + halfW);

                const padX1 = p1.x + dx * padStartT;
                const padY1 = p1.y + dy * padStartT;
                const padX2 = p1.x + dx * padEndT;
                const padY2 = p1.y + dy * padEndT;

                pongCtx.save();
                pongCtx.strokeStyle = player.color;
                pongCtx.shadowColor = player.color;
                pongCtx.shadowBlur = 12;
                pongCtx.lineWidth = 7;
                pongCtx.lineCap = 'round';
                pongCtx.beginPath();
                pongCtx.moveTo(padX1, padY1);
                pongCtx.lineTo(padX2, padY2);
                pongCtx.stroke();
                pongCtx.restore();
            } else {
                // Solid Bounce Wall
                pongCtx.strokeStyle = 'rgba(0, 243, 255, 0.45)';
                pongCtx.lineWidth = 4;
                pongCtx.beginPath();
                pongCtx.moveTo(p1.x, p1.y);
                pongCtx.lineTo(p2.x, p2.y);
                pongCtx.stroke();
            }
        }

        // Draw Balls
        for (const b of octaPongGame.balls) {
            pongCtx.save();
            pongCtx.fillStyle = '#ffffff';
            pongCtx.shadowColor = 'var(--cyan)';
            pongCtx.shadowBlur = 14;
            pongCtx.beginPath();
            pongCtx.arc(b.x, b.y, BALL_RADIUS, 0, Math.PI * 2);
            pongCtx.fill();
            pongCtx.restore();
        }

        // Particles
        for (const pt of octaPongGame.particles) {
            pongCtx.save();
            pongCtx.globalAlpha = Math.max(0, pt.life);
            pongCtx.fillStyle = pt.color;
            pongCtx.beginPath();
            pongCtx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
            pongCtx.fill();
            pongCtx.restore();
        }

        // Pong Scores / Lives
        pongScoresContainer.innerHTML = '';
        for (const p of octaPongGame.players.values()) {
            const badge = document.createElement('div');
            badge.className = 'score-badge' + (!p.alive ? ' dead' : '');
            badge.style.borderLeft = `3px solid ${p.color}`;
            const hearts = '❤️'.repeat(Math.max(0, p.lives));
            badge.innerHTML = `<span style="color: ${p.color};">${p.name}</span><span>${hearts || '💀'}</span>`;
            pongScoresContainer.appendChild(badge);
        }

        if (octaPongGame.status === 'COUNTDOWN') {
            pongCountdownOverlay.style.display = 'block';
            pongCountdownNum.textContent = octaPongGame.countdownTimer > 0 ? Math.ceil(octaPongGame.countdownTimer) : 'LOS!';
            pongWinnerOverlay.style.display = 'none';
        } else if (octaPongGame.status === 'GAME_OVER') {
            pongCountdownOverlay.style.display = 'none';
            pongWinnerOverlay.style.display = 'block';
            pongWinnerText.textContent = octaPongGame.winner ? `🏆 ${octaPongGame.winner.name} GEWINNT!` : 'SPIEL ENDE';
        } else {
            pongCountdownOverlay.style.display = 'none';
            pongWinnerOverlay.style.display = 'none';
        }
    }

    // ==========================================
    // ROUTE GAME-SPECIFIC NETWORKING
    // ==========================================
    function handleHostGameEvent(type, payload, senderId) {
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
            codenamesGame.endTurn();
            broadcastCodenamesState();
        } else if (type === 'CN_ASSIGN') {
            codenamesGame.assignTeamAndRole(senderId, payload.team, payload.role);
            broadcastCodenamesState();
        } else if (type === 'SK_STROKE') {
            skribblGame.addStroke(payload);
            drawSkStroke(payload);
            networkManager.broadcast('SK_STROKE', payload);
        } else if (type === 'SK_CLEAR') {
            skribblGame.clearCanvas();
            skCtx.fillStyle = '#ffffff';
            skCtx.fillRect(0, 0, skribblCanvas.width, skribblCanvas.height);
            networkManager.broadcast('SK_CLEAR', {});
        } else if (type === 'SK_CHOOSE_WORD') {
            skribblGame.chooseWord(payload.word);
            broadcastSkribblState();
        } else if (type === 'SK_GUESS') {
            const res = skribblGame.handleGuess(senderId, payload.text);
            handleSkribblGuessResult(res);
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
            drawSkStroke(payload);
        } else if (type === 'SK_CLEAR') {
            skCtx.fillStyle = '#ffffff';
            skCtx.fillRect(0, 0, skribblCanvas.width, skribblCanvas.height);
        } else if (type === 'SK_CHAT') {
            if (payload.isMatch) {
                addSkChatMsg('', payload.systemMsg, true);
                if (window.soundFX) window.soundFX.playWin();
            } else if (payload.chatMsg) {
                addSkChatMsg(payload.chatMsg.name, payload.chatMsg.text, false);
            }
        }
    }

    // ==========================================
    // MAIN LOOP
    // ==========================================
    let lastTime = performance.now();
    let netBroadcastTimer = 0;
    let clientInputTimer = 0;

    function masterLoop(now) {
        requestAnimationFrame(masterLoop);
        const dt = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;

        // 1. Host authoritative simulation
        if (networkManager.isHost) {
            if (activeGameType === 'curve') {
                curveGame.update(dt);
            } else if (activeGameType === 'skribbl') {
                const prevStatus = skribblGame.status;
                skribblGame.updateTick(dt);
                if (skribblGame.status !== prevStatus) broadcastSkribblState();
            } else if (activeGameType === 'tank') {
                tankGame.update(dt);
            } else if (activeGameType === 'pong') {
                octaPongGame.update(dt);
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

        // 2. Render active game
        if (gameViews.curve.classList.contains('active')) renderCurve();
        else if (gameViews.tank.classList.contains('active')) renderTank();
        else if (gameViews.pong.classList.contains('active')) renderPong();
    }

    function sendClientInputs() {
        if (!networkManager.hostConn || !networkManager.hostConn.open) return;

        if (activeGameType === 'curve') {
            const left = !!(keys.ArrowLeft || keys.KeyA);
            const right = !!(keys.ArrowRight || keys.KeyD);
            networkManager.sendToHost('INPUT', { left, right });
        } else if (activeGameType === 'tank') {
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
        }
    }

    // Host local input update for games
    function updateHostLocalInputs() {
        if (!networkManager.isHost) return;
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
        }
    }

    setInterval(updateHostLocalInputs, 20);
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
})();
