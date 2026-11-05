/**
 * App Controller: UI, Input Handling, Network Coordination & Canvas Renderer
 */

(function () {
    // DOM Elements
    const homeScreen = document.getElementById('home-screen');
    const lobbyScreen = document.getElementById('lobby-screen');
    const gameScreen = document.getElementById('game-screen');

    const playerNameInput = document.getElementById('player-name');
    const colorPickerContainer = document.getElementById('color-picker');
    const joinCodeInput = document.getElementById('join-code-input');
    const btnHostRoom = document.getElementById('btn-host-room');
    const btnJoinRoom = document.getElementById('btn-join-room');
    const btnVsBot = document.getElementById('btn-vs-bot');
    const btnLocal2p = document.getElementById('btn-local-2p');

    // Lobby Elements
    const displayRoomCode = document.getElementById('display-room-code');
    const lobbyRoleText = document.getElementById('lobby-role-text');
    const lobbyPlayerList = document.getElementById('lobby-player-list');
    const playerCount = document.getElementById('player-count');
    const btnCopyLink = document.getElementById('btn-copy-link');
    const btnAddBot = document.getElementById('btn-add-bot');
    const btnStartGame = document.getElementById('btn-start-game');
    const btnLeaveLobby = document.getElementById('btn-leave-lobby');
    const hostLobbyControls = document.getElementById('host-lobby-controls');
    const clientLobbyNotice = document.getElementById('client-lobby-notice');
    const btnToggleGaps = document.getElementById('btn-toggle-gaps');
    const hostSettings = document.getElementById('host-settings');

    // Game Elements
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const hudRoundDisplay = document.getElementById('hud-round-display');
    const hudRoomCode = document.getElementById('hud-room-code');
    const hudRoomPill = document.getElementById('hud-room-pill');
    const hudScoresContainer = document.getElementById('hud-scores-container');
    const hudPingPill = document.getElementById('hud-ping-pill');
    const hudPingText = document.getElementById('hud-ping-text');
    const btnMute = document.getElementById('btn-mute');
    const btnFullscreen = document.getElementById('btn-fullscreen');
    const btnQuit = document.getElementById('btn-quit');

    // Overlays
    const countdownOverlay = document.getElementById('countdown-overlay');
    const countdownNumber = document.getElementById('countdown-number');
    const roundOverOverlay = document.getElementById('round-over-overlay');
    const roundWinnerText = document.getElementById('round-winner-text');
    const matchOverOverlay = document.getElementById('match-over-overlay');
    const matchWinnerText = document.getElementById('match-winner-text');
    const btnPlayAgain = document.getElementById('btn-play-again');

    // Touch controls
    const touchLeft = document.getElementById('touch-left');
    const touchRight = document.getElementById('touch-right');

    // App State
    const game = new CurveGame();
    let myPlayerId = 'p-local-' + Math.floor(Math.random() * 10000);

    function shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function getUnusedColor() {
        const usedHexes = new Set();
        for (const p of game.players.values()) {
            if (p.color) usedHexes.add(p.color.toLowerCase());
        }
        const available = PLAYER_COLORS.filter(c => !usedHexes.has(c.hex.toLowerCase()));
        if (available.length > 0) {
            return available[Math.floor(Math.random() * available.length)].hex;
        }
        return PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)].hex;
    }

    const randomInitialColorIdx = Math.floor(Math.random() * PLAYER_COLORS.length);
    let selectedColor = PLAYER_COLORS[randomInitialColorIdx].hex;
    let isLocalMultiplayer = false;
    let localPlayer2Id = 'p-local-2';

    // Local Key State
    const keysPressed = {
        ArrowLeft: false,
        ArrowRight: false,
        KeyA: false,
        KeyD: false
    };

    // Initialize Saved Name
    const savedName = localStorage.getItem('curve_player_name');
    if (savedName) playerNameInput.value = savedName;

    // Build Color Picker (Defaulting to a random vibrant color)
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

    // Check URL parameters for direct join: ?room=XYZ
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
        joinCodeInput.value = roomParam.trim().toUpperCase();
    }

    function switchScreen(screen) {
        homeScreen.classList.remove('active');
        lobbyScreen.classList.remove('active');
        gameScreen.classList.remove('active');
        screen.classList.add('active');
    }

    function getPlayerName() {
        const val = playerNameInput.value.trim() || 'Player 1';
        localStorage.setItem('curve_player_name', val);
        return val;
    }

    function getShareableLink(code) {
        const url = new URL(window.location.href);
        url.searchParams.set('room', code);
        return url.toString();
    }

    // ==========================================
    // LOBBY UPDATES
    // ==========================================
    function updateLobbyUI() {
        lobbyPlayerList.innerHTML = '';
        let count = 0;

        for (const p of game.players.values()) {
            count++;
            const li = document.createElement('li');
            li.className = 'player-item';

            const leftDiv = document.createElement('div');
            leftDiv.className = 'player-item-info';

            const dot = document.createElement('span');
            dot.className = 'player-dot';
            dot.style.backgroundColor = p.color;
            dot.style.boxShadow = `0 0 8px ${p.color}`;

            const name = document.createElement('span');
            name.textContent = p.name + (p.id === myPlayerId ? ' (Du)' : '');
            name.style.fontWeight = p.id === myPlayerId ? 'bold' : 'normal';

            leftDiv.appendChild(dot);
            leftDiv.appendChild(name);

            const badge = document.createElement('span');
            badge.className = 'badge';
            if (p.isBot) {
                badge.textContent = 'BOT';
            } else if (p.id === myPlayerId && networkManager.isHost) {
                badge.textContent = 'HOST';
                badge.style.color = 'var(--cyan)';
            } else {
                badge.textContent = 'SPIELER';
            }

            li.appendChild(leftDiv);
            li.appendChild(badge);
            lobbyPlayerList.appendChild(li);
        }

        playerCount.textContent = count;
        btnAddBot.disabled = count >= 8;
    }

    // ==========================================
    // NETWORK EVENT HANDLER
    // ==========================================
    networkManager.onEvent = (type, payload, senderId) => {
        // HOST HANDLING
        if (networkManager.isHost) {
            if (type === 'JOIN') {
                const assignedColor = getUnusedColor();
                game.addPlayer(senderId, payload.name, assignedColor, false);
                broadcastLobbyUpdate();
                updateLobbyUI();
            } else if (type === 'INPUT') {
                game.setPlayerInput(senderId, payload.left, payload.right);
            } else if (type === 'PEER_DISCONNECTED') {
                game.removePlayer(senderId);
                broadcastLobbyUpdate();
                updateLobbyUI();
            }
        }
        // CLIENT HANDLING
        else {
            if (type === 'LOBBY_UPDATE') {
                game.players.clear();
                for (const p of payload.players) {
                    game.addPlayer(p.id, p.name, p.color, p.isBot);
                }
                updateLobbyUI();
            } else if (type === 'START_GAME') {
                game.players.clear();
                for (const p of payload.players) {
                    game.addPlayer(p.id, p.name, p.color, p.isBot);
                }
                game.segments = [];
                game.particles = [];
                game.maxRounds = payload.maxRounds;
                if (payload.enableGaps !== undefined) {
                    game.enableGaps = payload.enableGaps;
                }
                if (payload.botDifficulty !== undefined) {
                    game.botDifficulty = payload.botDifficulty;
                }
                switchScreen(gameScreen);
            } else if (type === 'STATE') {
                game.applySnapshot(payload);
            } else if (type === 'HOST_DISCONNECTED') {
                alert('Der Host hat das Spiel verlassen.');
                location.reload();
            }
        }
    };

    function broadcastLobbyUpdate() {
        const playersList = Array.from(game.players.values()).map(p => ({
            id: p.id,
            name: p.name,
            color: p.color,
            isBot: p.isBot
        }));
        networkManager.broadcast('LOBBY_UPDATE', { players: playersList });
    }

    // ==========================================
    // HOME SCREEN ACTIONS
    // ==========================================

    // Gap Toggle button (Host setting)
    if (btnToggleGaps) {
        btnToggleGaps.addEventListener('click', () => {
            if (window.soundFX) window.soundFX.playClick();
            game.enableGaps = !game.enableGaps;
            btnToggleGaps.textContent = game.enableGaps ? 'AN' : 'AUS';
            btnToggleGaps.style.color = game.enableGaps ? 'var(--cyan)' : 'var(--text-muted)';
            btnToggleGaps.style.borderColor = game.enableGaps ? 'var(--cyan)' : 'var(--border-color)';
        });
    }

    // Bot Difficulty Selector (Host setting)
    document.querySelectorAll('#diff-selector .diff-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#diff-selector .diff-btn').forEach(b => {
                b.classList.remove('active');
                b.style.borderColor = 'var(--border-color)';
                b.style.color = 'var(--text-muted)';
            });
            btn.classList.add('active');
            btn.style.borderColor = 'var(--cyan)';
            btn.style.color = 'var(--cyan)';
            game.botDifficulty = btn.getAttribute('data-diff');
            if (window.soundFX) window.soundFX.playClick();
        });
    });

    // 1. Host Game
    btnHostRoom.addEventListener('click', async () => {
        if (window.soundFX) window.soundFX.playClick();
        btnHostRoom.disabled = true;
        btnHostRoom.textContent = 'Erstelle Raum...';

        try {
            const code = await networkManager.hostRoom();
            myPlayerId = networkManager.myPeerId;
            displayRoomCode.textContent = code;
            hudRoomCode.textContent = code;
            hudPingPill.style.display = 'none';

            hostLobbyControls.style.display = 'flex';
            if (hostSettings) hostSettings.style.display = 'flex';
            clientLobbyNotice.style.display = 'none';
            lobbyRoleText.textContent = 'Du bist der Host. Lade Freunde ein!';

            game.players.clear();
            const hostColor = selectedColor || getUnusedColor();
            game.addPlayer(myPlayerId, getPlayerName(), hostColor, false);

            updateLobbyUI();
            switchScreen(lobbyScreen);
        } catch (err) {
            alert('Fehler beim Erstellen des Raumes: ' + err.message);
        } finally {
            btnHostRoom.disabled = false;
            btnHostRoom.textContent = 'Raum erstellen (Host)';
        }
    });

    // 2. Join Game
    btnJoinRoom.addEventListener('click', async () => {
        const code = joinCodeInput.value.trim().toUpperCase();
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
            hudRoomCode.textContent = code;
            hudPingPill.style.display = 'flex';

            hostLobbyControls.style.display = 'none';
            if (hostSettings) hostSettings.style.display = 'none';
            clientLobbyNotice.style.display = 'block';
            lobbyRoleText.textContent = 'Verbunden mit Raum ' + code;

            // Send Join handshake to host
            networkManager.sendToHost('JOIN', {
                name: getPlayerName(),
                color: selectedColor
            });

            switchScreen(lobbyScreen);
        } catch (err) {
            alert('Konnte dem Raum nicht beitreten. Überprüfe den Code!');
        } finally {
            btnJoinRoom.disabled = false;
            btnJoinRoom.textContent = 'Beitreten';
        }
    });

    // 3. Solo vs Bots
    btnVsBot.addEventListener('click', () => {
        if (window.soundFX) window.soundFX.playClick();
        isLocalMultiplayer = false;
        networkManager.isHost = true;
        myPlayerId = 'p-human';

        game.players.clear();
        const shuffled = shuffleArray([...PLAYER_COLORS]);
        game.addPlayer('p-human', getPlayerName(), selectedColor || shuffled[0].hex, false);

        const botNames = ['Bot Viper', 'Bot Nova', 'Bot Ghost', 'Bot Apex', 'Bot Cyber'];
        for (let i = 0; i < 3; i++) {
            const bColor = shuffled[i + 1] ? shuffled[i + 1].hex : PLAYER_COLORS[i].hex;
            game.addPlayer(`bot-${i + 1}`, botNames[i], bColor, true);
        }

        hudRoomCode.textContent = 'SOLO';
        hudPingPill.style.display = 'none';

        switchScreen(gameScreen);
        game.resetMatch();
        game.startCountdown();
    });

    // 4. Local 2-Player (1 Keyboard)
    btnLocal2p.addEventListener('click', () => {
        if (window.soundFX) window.soundFX.playClick();
        isLocalMultiplayer = true;
        networkManager.isHost = true;
        myPlayerId = 'p1-arrows';
        localPlayer2Id = 'p2-wasd';

        game.players.clear();
        const shuffled = shuffleArray([...PLAYER_COLORS]);
        const p1Color = selectedColor || shuffled[0].hex;
        const p2Color = shuffled.find(c => c.hex !== p1Color).hex;

        game.addPlayer(myPlayerId, `${getPlayerName()} (Pfeile)`, p1Color, false);
        game.addPlayer(localPlayer2Id, 'Spieler 2 (A / D)', p2Color, false);

        hudRoomCode.textContent = 'LOCAL 2P';
        hudPingPill.style.display = 'none';

        switchScreen(gameScreen);
        game.resetMatch();
        game.startCountdown();
    });

    // ==========================================
    // LOBBY ACTIONS
    // ==========================================
    btnCopyLink.addEventListener('click', () => {
        if (!networkManager.roomCode) return;
        const link = getShareableLink(networkManager.roomCode);
        navigator.clipboard.writeText(link).then(() => {
            btnCopyLink.textContent = 'Kopiert! ✓';
            setTimeout(() => { btnCopyLink.textContent = 'Link kopieren'; }, 2000);
        });
    });

    hudRoomPill.addEventListener('click', () => {
        if (networkManager.roomCode) {
            navigator.clipboard.writeText(networkManager.roomCode);
            alert(`Raum-Code ${networkManager.roomCode} in die Zwischenablage kopiert!`);
        }
    });

    btnAddBot.addEventListener('click', () => {
        if (window.soundFX) window.soundFX.playClick();
        const botIndex = game.players.size;
        const botId = `bot-${botIndex}`;
        const botColor = getUnusedColor();
        const botNames = ['Cyber', 'Pulse', 'Shadow', 'Apex', 'Matrix', 'Volt', 'Specter', 'Titan', 'Viper'];
        const botName = 'Bot ' + botNames[(botIndex - 1) % botNames.length];

        game.addPlayer(botId, botName, botColor, true);
        broadcastLobbyUpdate();
        updateLobbyUI();
    });

    btnStartGame.addEventListener('click', () => {
        if (game.players.size < 1) return;
        if (window.soundFX) window.soundFX.playClick();

        const playersList = Array.from(game.players.values()).map(p => ({
            id: p.id,
            name: p.name,
            color: p.color,
            isBot: p.isBot
        }));

        networkManager.broadcast('START_GAME', {
            players: playersList,
            maxRounds: game.maxRounds,
            enableGaps: game.enableGaps,
            botDifficulty: game.botDifficulty
        });

        switchScreen(gameScreen);
        game.resetMatch();
        game.startCountdown();
    });

    btnLeaveLobby.addEventListener('click', () => {
        if (window.soundFX) window.soundFX.playClick();
        networkManager.disconnect();
        switchScreen(homeScreen);
    });

    btnQuit.addEventListener('click', () => {
        if (confirm('Möchtest du das aktuelle Spiel wirklich verlassen?')) {
            networkManager.disconnect();
            location.reload();
        }
    });

    btnPlayAgain.addEventListener('click', () => {
        matchOverOverlay.style.display = 'none';
        if (networkManager.isHost) {
            const playersList = Array.from(game.players.values()).map(p => ({
                id: p.id,
                name: p.name,
                color: p.color,
                isBot: p.isBot
            }));

            networkManager.broadcast('START_GAME', {
                players: playersList,
                maxRounds: game.maxRounds,
                enableGaps: game.enableGaps,
                botDifficulty: game.botDifficulty
            });

            game.resetMatch();
            game.startCountdown();
        }
    });

    // Audio & Fullscreen
    btnMute.addEventListener('click', () => {
        const isMuted = window.soundFX.toggleMute();
        btnMute.textContent = isMuted ? '🔇' : '🔊';
    });

    btnFullscreen.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    });

    // ==========================================
    // KEYBOARD & TOUCH INPUTS
    // ==========================================
    function getPlayer1Input() {
        if (isLocalMultiplayer) {
            return {
                left: !!keysPressed.ArrowLeft,
                right: !!keysPressed.ArrowRight
            };
        }
        // In online/singleplayer, allow BOTH Arrow keys and A/D keys
        return {
            left: !!(keysPressed.ArrowLeft || keysPressed.KeyA),
            right: !!(keysPressed.ArrowRight || keysPressed.KeyD)
        };
    }

    function sendMyInput() {
        const p1 = getPlayer1Input();

        if (networkManager.isHost) {
            game.setPlayerInput(myPlayerId, p1.left, p1.right);
            if (isLocalMultiplayer) {
                game.setPlayerInput(localPlayer2Id, !!keysPressed.KeyA, !!keysPressed.KeyD);
            }
        } else {
            networkManager.sendToHost('INPUT', { left: p1.left, right: p1.right });
        }
    }

    window.addEventListener('keydown', (e) => {
        let changed = false;
        const code = e.code;
        const key = e.key;

        if (code === 'ArrowLeft' || key === 'ArrowLeft') {
            if (!keysPressed.ArrowLeft) { keysPressed.ArrowLeft = true; changed = true; }
        } else if (code === 'ArrowRight' || key === 'ArrowRight') {
            if (!keysPressed.ArrowRight) { keysPressed.ArrowRight = true; changed = true; }
        } else if (code === 'KeyA' || key === 'a' || key === 'A') {
            if (!keysPressed.KeyA) { keysPressed.KeyA = true; changed = true; }
        } else if (code === 'KeyD' || key === 'd' || key === 'D') {
            if (!keysPressed.KeyD) { keysPressed.KeyD = true; changed = true; }
        }

        if (gameScreen.classList.contains('active') && (code === 'ArrowLeft' || code === 'ArrowRight')) {
            e.preventDefault();
        }

        if (changed) sendMyInput();
    });

    window.addEventListener('keyup', (e) => {
        let changed = false;
        const code = e.code;
        const key = e.key;

        if (code === 'ArrowLeft' || key === 'ArrowLeft') {
            if (keysPressed.ArrowLeft) { keysPressed.ArrowLeft = false; changed = true; }
        } else if (code === 'ArrowRight' || key === 'ArrowRight') {
            if (keysPressed.ArrowRight) { keysPressed.ArrowRight = false; changed = true; }
        } else if (code === 'KeyA' || key === 'a' || key === 'A') {
            if (keysPressed.KeyA) { keysPressed.KeyA = false; changed = true; }
        } else if (code === 'KeyD' || key === 'd' || key === 'D') {
            if (keysPressed.KeyD) { keysPressed.KeyD = false; changed = true; }
        }

        if (changed) sendMyInput();
    });

    // Touch controls
    const bindTouch = (el, key) => {
        el.addEventListener('touchstart', (e) => {
            e.preventDefault();
            keysPressed[key] = true;
            sendMyInput();
        }, { passive: false });

        el.addEventListener('touchend', (e) => {
            e.preventDefault();
            keysPressed[key] = false;
            sendMyInput();
        }, { passive: false });
    };

    bindTouch(touchLeft, 'ArrowLeft');
    bindTouch(touchRight, 'ArrowRight');

    // ==========================================
    // MAIN LOOP & RENDERING
    // ==========================================
    let lastTime = performance.now();
    let netBroadcastTimer = 0;
    let clientInputTimer = 0;

    function gameLoop(now) {
        requestAnimationFrame(gameLoop);

        const dt = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;

        // Authoritative Host simulation
        if (networkManager.isHost) {
            game.update(dt);

            // Broadcast state at ~35Hz to save bandwidth
            netBroadcastTimer += dt;
            if (netBroadcastTimer >= 0.028) {
                netBroadcastTimer = 0;
                const snapshot = game.getSnapshot();
                networkManager.broadcast('STATE', snapshot);
            }
        } else {
            // Client continuously streams input at 40Hz during active play
            clientInputTimer += dt;
            if (clientInputTimer >= 0.025) {
                clientInputTimer = 0;
                sendMyInput();
            }
        }

        // Only render if game screen is visible
        if (gameScreen.classList.contains('active')) {
            renderGame();
            updateHUD();
        }
    }

    function updateHUD() {
        hudRoundDisplay.textContent = `${game.roundNumber} / ${game.maxRounds}`;

        if (!networkManager.isHost && networkManager.ping > 0) {
            hudPingText.textContent = `${networkManager.ping} ms`;
        }

        // Scores
        hudScoresContainer.innerHTML = '';
        for (const p of game.players.values()) {
            const badge = document.createElement('div');
            badge.className = 'score-badge' + (!p.alive ? ' dead' : '');
            badge.style.borderLeft = `3px solid ${p.color}`;
            badge.innerHTML = `
                <span style="color: ${p.color};">${p.name}</span>
                <span>${p.score}</span>
            `;
            hudScoresContainer.appendChild(badge);
        }

        // Overlays
        if (game.state === 'COUNTDOWN') {
            countdownOverlay.style.display = 'block';
            countdownNumber.textContent = game.countdownTimer > 0 ? Math.ceil(game.countdownTimer) : 'LOS!';
            roundOverOverlay.style.display = 'none';
            matchOverOverlay.style.display = 'none';
        } else if (game.state === 'ROUND_OVER') {
            countdownOverlay.style.display = 'none';
            roundOverOverlay.style.display = 'block';
            roundWinnerText.textContent = game.roundWinner ? `${game.roundWinner.name} gewinnt die Runde!` : 'Unentschieden!';
            matchOverOverlay.style.display = 'none';
        } else if (game.state === 'MATCH_OVER') {
            countdownOverlay.style.display = 'none';
            roundOverOverlay.style.display = 'none';
            matchOverOverlay.style.display = 'block';
            matchWinnerText.textContent = `🏆 ${game.matchWinner ? game.matchWinner.name : 'Match Ende'}`;
            btnPlayAgain.style.display = networkManager.isHost ? 'block' : 'none';
        } else {
            countdownOverlay.style.display = 'none';
            roundOverOverlay.style.display = 'none';
            matchOverOverlay.style.display = 'none';
        }
    }

    function renderGame() {
        // Clear background
        ctx.fillStyle = '#05070d';
        ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

        // Cyber Grid Lines
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.05)';
        ctx.lineWidth = 1;
        const gridStep = 50;
        ctx.beginPath();
        for (let x = 0; x < ARENA_WIDTH; x += gridStep) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, ARENA_HEIGHT);
        }
        for (let y = 0; y < ARENA_HEIGHT; y += gridStep) {
            ctx.moveTo(0, y);
            ctx.lineTo(ARENA_WIDTH, y);
        }
        ctx.stroke();

        // Arena Border Glow
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.4)';
        ctx.lineWidth = 3;
        ctx.strokeRect(1.5, 1.5, ARENA_WIDTH - 3, ARENA_HEIGHT - 3);

        // Draw Trails
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = LINE_RADIUS * 2;

        for (const seg of game.segments) {
            ctx.strokeStyle = seg.color;
            ctx.beginPath();
            ctx.moveTo(seg.x1, seg.y1);
            ctx.lineTo(seg.x2, seg.y2);
            ctx.stroke();
        }

        // Draw Player Heads
        for (const p of game.players.values()) {
            if (!p.alive) continue;

            ctx.save();
            if (!p.isDrawing) {
                // Gap / Ghost Mode: transparent & white pulse
                ctx.globalAlpha = 0.5;
                ctx.shadowColor = '#ffffff';
                ctx.shadowBlur = 18;
            } else {
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 12;
            }

            // Head Circle
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(p.x, p.y, LINE_RADIUS + 1, 0, Math.PI * 2);
            ctx.fill();

            // Head Direction Arrow / Dot
            const tipX = p.x + Math.cos(p.angle) * (LINE_RADIUS + 4);
            const tipY = p.y + Math.sin(p.angle) * (LINE_RADIUS + 4);
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(tipX, tipY);
            ctx.stroke();

            // If in gap, draw a subtle ghost aura
            if (!p.isDrawing) {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(p.x, p.y, LINE_RADIUS + 5, 0, Math.PI * 2);
                ctx.stroke();
            }

            ctx.restore();
        }

        // Draw Explosion Particles
        for (const pt of game.particles) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, pt.life);
            ctx.fillStyle = pt.color;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // Start Loop
    requestAnimationFrame(gameLoop);
})();
