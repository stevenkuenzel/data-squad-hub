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
        pong: document.getElementById('game-pong'),
        uno: document.getElementById('game-uno'),
        dodgeball: document.getElementById('game-dodgeball')
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
    const unoGame = new UnoGame();
    const dodgeballGame = new DodgeballGame();

    function getActiveGameInstance() {
        switch (activeGameType) {
            case 'curve': return curveGame;
            case 'codenames': return codenamesGame;
            case 'skribbl': return skribblGame;
            case 'tank': return tankGame;
            case 'pong': return octaPongGame;
            case 'uno': return unoGame;
            case 'dodgeball': return dodgeballGame;
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
            pong: 'Octa-Pong',
            uno: 'UNO',
            dodgeball: 'Corporate Dodgeball (Data Squad vs. ComM)'
        };
        lobbyGameTitle.textContent = titles[gameType] || 'Lobby';
        curveSettings.style.display = gameType === 'curve' ? 'block' : 'none';
        btnAddBot.style.display = (gameType === 'codenames' || gameType === 'skribbl') ? 'none' : 'block';
        lobbyMaxPlayers.textContent = (gameType === 'tank' || gameType === 'pong' || gameType === 'uno' || gameType === 'dodgeball') ? '8' : '12';
        updateLobbyInstructions(gameType);
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

    // Ergonomic Multi-Touch Controls (Pointer & Touch Events)
    const bindTouch = (elId, code) => {
        const el = document.getElementById(elId);
        if (!el) return;
        const press = (e) => {
            e.preventDefault();
            keys[code] = true;
            el.classList.add('active');
        };
        const release = (e) => {
            e.preventDefault();
            keys[code] = false;
            el.classList.remove('active');
        };
        el.addEventListener('pointerdown', press, { passive: false });
        el.addEventListener('pointerup', release, { passive: false });
        el.addEventListener('pointercancel', release, { passive: false });
        el.addEventListener('pointerleave', release, { passive: false });
        el.addEventListener('touchstart', press, { passive: false });
        el.addEventListener('touchend', release, { passive: false });
    };

    bindTouch('curve-touch-left', 'ArrowLeft');
    bindTouch('curve-touch-right', 'ArrowRight');
    bindTouch('tank-touch-left', 'ArrowLeft');
    bindTouch('tank-touch-right', 'ArrowRight');
    bindTouch('tank-touch-fwd', 'ArrowUp');
    bindTouch('tank-touch-back', 'ArrowDown');
    bindTouch('tank-touch-shoot', 'Space');
    bindTouch('pong-touch-left', 'ArrowLeft');
    bindTouch('pong-touch-right', 'ArrowRight');

    // ==========================================
    // GAME INSTRUCTIONS & HELP MODAL SYSTEM
    // ==========================================
    const GAME_INSTRUCTIONS = {
        curve: {
            title: '🐍 Curve Arena (Achtung die Kurve / Tron)',
            goal: 'Überlebe als Letzter im Spielfeld! Schneide deinen Gegnern den Weg ab und berühre weder den Rand noch gezogene Linien.',
            controls: [
                '💻 <strong>Desktop-Tastatur:</strong> <code>◀</code> / <code>▶</code> oder <code>A</code> / <code>D</code> zum Lenken.',
                '📱 <strong>Mobile Touch:</strong> <code>◀</code> und <code>▶</code> Touch-Buttons am unteren Bildschirmrand antippen.'
            ],
            tip: '⚡ <strong>Mario-Kart Power-Ups:</strong> Sammle leuchtende Orbs auf dem Feld! 🔀 Invertiert die Steuerung aller Gegner, 🚀 schickt sie in den Hyper-Turbo, 🐘 zwingt sie zu dicken Barrieren, 👻 macht dich unverwundbar gegen Wände, 🐢 verleiht dir Slow-Mo-Präzision und 💣 detoniert eine Schockwelle, die Linien löscht!'
        },
        codenames: {
            title: '🕵️ Codenames (Team-Worträtsel)',
            goal: 'Finde als erstes Team alle geheimen Wörter eurer Farbe (Rot oder Blau) auf dem 5x5-Feld, ohne den Attentäter aufzudecken!',
            roles: [
                '🕵️ <strong>Spionchef:</strong> Sieht alle Farben (Rot, Blau, Zivilist, Attentäter). Gibt pro Runde 1 Hinweis-Wort + Anzahl (z. B. <em>"WASSER 2"</em>). Darf selbst keine Karten anklicken!',
                '👥 <strong>Ermittler:</strong> Beraten sich im Team und tippen auf die Karten, die zum Hinweis passen.'
            ],
            controls: [
                'Ermittler am Zug tippen auf die vermuteten Wortkarten.',
                'Spionchefs tragen Wort & Anzahl in die Hinweis-Leiste ein und klicken "Hinweis geben".',
                'Klicke "Zug beenden", wenn ihr keine weiteren Versuche wagen möchtet.'
            ],
            tip: '⚠️ <strong>Attentäter-Warnung:</strong> Wer die schwarze Karte aufdeckt, verliert das gesamte Spiel auf der Stelle!'
        },
        skribbl: {
            title: '🎨 Montagsmaler (Skribbl)',
            goal: 'Sammle Punkte durch schnelles Raten und verständliches Zeichnen im ständigen Wechsel.',
            roles: [
                '🎨 <strong>Der Maler:</strong> Wählt zu Beginn 1 von 3 Begriffen und zeichnet ihn auf der Leinwand. (Maler ist im Chat gesperrt, um kein Wort zu leaken).',
                '💡 <strong>Die Rater:</strong> Tippen Vermutungen in das Chatfeld ein.'
            ],
            controls: [
                '🎨 <strong>Maler:</strong> Mit Maus oder Finger auf der Leinwand zeichnen. Farbpalette und Pinselgröße wählbar.',
                '💡 <strong>Rater:</strong> Textfeld nutzen & Absenden / Enter drücken.'
            ],
            tip: '⚡ <strong>Punktevergabe:</strong> Je schneller das Wort erraten wird, desto mehr Punkte erhalten Rater und Maler!'
        },
        tank: {
            title: '💥 Tank Trouble (2D Panzer-Schlacht)',
            goal: 'Zerstöre gegnerische Panzer mit abprallenden Querschlägern und sei der letzte Überlebende der Runde!',
            controls: [
                '💻 <strong>Desktop:</strong> <code>W</code> / <code>S</code> oder <code>▲</code> / <code>▼</code> (Fahren), <code>A</code> / <code>D</code> oder <code>◀</code> / <code>▶</code> (Drehen), <code>Leertaste</code> (Feuer).',
                '📱 <strong>Mobile:</strong> Virtuelles Steuerkreuz links (Vor, Zurück, Drehen) & 💥 Feuer-Knopf rechts.'
            ],
            tip: '💥 <strong>Querschläger:</strong> Schüsse prallen bis zu 5-mal an Wänden ab. Pass auf, dass du dich nicht selbst abschießt! Maximal 5 Kugeln gleichzeitig aktiv.'
        },
        pong: {
            title: '🏓 Octa-Pong (8-Spieler Achteck-Pong)',
            goal: 'Verteidige deine Kante des regelmäßigen Achtecks! Wer 4 Bälle kassiert, scheidet aus. Wer als Letzter noch Leben hat, gewinnt.',
            controls: [
                '💻 <strong>Desktop:</strong> <code>◀</code> / <code>▶</code> oder <code>A</code> / <code>D</code> zum Verschieben deines Schlägers.',
                '📱 <strong>Mobile:</strong> <code>◀</code> und <code>▶</code> Touch-Buttons links und rechts.'
            ],
            tip: '🌀 <strong>Schnitt & Speed:</strong> Triffst du den Ball mit der Ecke deines Schlägers, wird er mit extra Schnitt und höherem Tempo abgelenkt!'
        },
        uno: {
            title: '🎴 UNO (Kult-Kartenspiel)',
            goal: 'Werde als Erster alle deine Handkarten los! Passe Farbe oder Zahl an und spiele taktische Aktionskarten.',
            roles: [
                '🎴 <strong>Zahlenkarten (0-9):</strong> Passen auf gleiche Zahl oder gleiche Farbe.',
                '🚫 <strong>Aussetzen:</strong> Überspringt den nächsten Spieler.',
                '🔄 <strong>Richtungswechsel:</strong> Dreht die Spielreihenfolge um.',
                '➕2 <strong>Zieh 2:</strong> Nächster Spieler zieht 2 Karten und setzt aus.',
                '🌈 <strong>Farbwahl & Farbwahl +4:</strong> Jederzeit spielbar; wähle die nächste Spielfarbe!'
            ],
            controls: [
                'Tippe auf eine leuchtende Karte in deiner Hand, um sie auszuspielen.',
                'Tippe auf den Nachziehstapel ("ZIEHEN"), falls du keine passende Karte hast.',
                'Klicke rechtzeitig auf "🔔 UNO!", wenn du nur noch 1 oder 2 Karten hast!'
            ],
            tip: '💡 <strong>Taktik:</strong> Hebe dir Farbwahl- und +4-Karten für den perfekten Moment auf, um das Spielgeschehen abrupt zu drehen!'
        },
        dodgeball: {
            title: '🤾 Corporate Dodgeball: Data Squad vs. ComM',
            goal: 'Büro-Völkerball! Wirf das gegnerische Team ab. Data Squad (Links) wirft Code-Releases & Live-Dashboards, ComM (Rechts) wirft bürokratische Steine, Aktenordner & teure Agentur-Rechnungen!',
            controls: [
                '💻 <strong>Desktop:</strong> <code>WASD</code> / Pfeiltasten = Bewegen | <code>Leertaste</code> / Klick = Werfen | <code>Shift</code> = Dash (Hechtsprung).',
                '📱 <strong>Mobile:</strong> Virtuelles D-Pad links + <code>WURF</code> & <code>DASH</code> Knöpfe rechts.'
            ],
            tip: '🎯 <strong>Catch-Mechanik:</strong> Wenn du im Dash / Hechtsprung in einen gegnerischen Wurf rollst, fängst du den Ball direkt aus der Luft! Vorsicht: 🪨 Steine im Weg bleiben nach dem Aufprall als echte Hindernisse auf dem Boden liegen!'
        }
    };

    const modalInstructions = document.getElementById('modal-instructions');
    const instructionsBody = document.getElementById('instructions-body');
    const btnCloseInstructions = document.getElementById('btn-close-instructions');
    const instTabs = document.querySelectorAll('.inst-tab');
    const lobbyRulesText = document.getElementById('lobby-rules-text');

    function renderInstructionPanel(gameType) {
        const info = GAME_INSTRUCTIONS[gameType] || GAME_INSTRUCTIONS.curve;
        let html = `<div class="inst-panel">
            <h4>${info.title}</h4>
            <div class="inst-block">
                <div class="inst-label">🎯 Spielziel</div>
                <div>${info.goal}</div>
            </div>`;

        if (info.roles) {
            html += `<div class="inst-block">
                <div class="inst-label">👥 Rollen & Aufgaben</div>
                ${info.roles.map(r => `<div style="margin-bottom: 4px;">${r}</div>`).join('')}
            </div>`;
        }

        if (info.controls) {
            html += `<div class="inst-block">
                <div class="inst-label">🎮 Steuerung</div>
                ${info.controls.map(c => `<div style="margin-bottom: 4px;">${c}</div>`).join('')}
            </div>`;
        }

        if (info.tip) {
            html += `<div class="inst-block" style="border-color: rgba(0, 243, 255, 0.3); background: rgba(0, 243, 255, 0.05);">
                <div class="inst-label" style="color: var(--cyan);">💡 Tipp & Besonderheit</div>
                <div>${info.tip}</div>
            </div>`;
        }

        html += `</div>`;
        if (instructionsBody) instructionsBody.innerHTML = html;

        instTabs.forEach(t => {
            t.classList.toggle('active', t.getAttribute('data-game') === gameType);
        });
    }

    function openInstructionsModal(gameType) {
        if (!modalInstructions) return;
        renderInstructionPanel(gameType || activeGameType || 'curve');
        modalInstructions.style.display = 'flex';
        if (window.soundFX) window.soundFX.playClick();
    }

    function closeInstructionsModal() {
        if (!modalInstructions) return;
        modalInstructions.style.display = 'none';
        if (window.soundFX) window.soundFX.playClick();
    }

    function updateLobbyInstructions(gameType) {
        if (!lobbyRulesText) return;
        const info = GAME_INSTRUCTIONS[gameType] || GAME_INSTRUCTIONS.curve;
        lobbyRulesText.innerHTML = `<strong>${info.title}:</strong> ${info.goal} <span style="color: var(--cyan); margin-left: 4px;">${info.tip || ''}</span>`;
    }

    if (btnCloseInstructions) btnCloseInstructions.addEventListener('click', closeInstructionsModal);
    if (modalInstructions) {
        modalInstructions.addEventListener('click', (e) => {
            if (e.target === modalInstructions) closeInstructionsModal();
        });
    }
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalInstructions && modalInstructions.style.display === 'flex') {
            closeInstructionsModal();
        }
    });

    instTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const g = tab.getAttribute('data-game');
            renderInstructionPanel(g);
        });
    });

    document.querySelectorAll('.btn-instructions-toggle').forEach(b => {
        b.addEventListener('click', () => {
            const g = b.getAttribute('data-game') || activeGameType;
            openInstructionsModal(g);
        });
    });

    document.querySelectorAll('.btn-card-help').forEach(b => {
        b.addEventListener('click', (e) => {
            e.stopPropagation();
            const g = b.getAttribute('data-game');
            openInstructionsModal(g);
        });
    });

    const btnLobbyHelp = document.getElementById('btn-lobby-help');
    if (btnLobbyHelp) {
        btnLobbyHelp.addEventListener('click', () => openInstructionsModal(activeGameType));
    }

    // Curve settings
    if (btnToggleGaps) {
        btnToggleGaps.addEventListener('click', () => {
            curveGame.enableGaps = !curveGame.enableGaps;
            btnToggleGaps.textContent = curveGame.enableGaps ? 'AN' : 'AUS';
        });
    }

    const btnTogglePowerups = document.getElementById('btn-toggle-powerups');
    if (btnTogglePowerups) {
        btnTogglePowerups.addEventListener('click', () => {
            curveGame.powerUpsEnabled = !curveGame.powerUpsEnabled;
            btnTogglePowerups.textContent = curveGame.powerUpsEnabled ? 'AN' : 'AUS';
            btnTogglePowerups.className = `btn btn-sm ${curveGame.powerUpsEnabled ? 'btn-primary' : 'btn-secondary'}`;
            if (window.soundFX) window.soundFX.playClick();
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
        for (const seg of curveGame.segments) {
            curveCtx.lineWidth = seg.lineWidth || (LINE_RADIUS * 2);
            curveCtx.strokeStyle = seg.color;
            curveCtx.beginPath();
            curveCtx.moveTo(seg.x1, seg.y1);
            curveCtx.lineTo(seg.x2, seg.y2);
            curveCtx.stroke();
        }

        // Draw Power-Up Orbs
        if (curveGame.powerUps && curveGame.powerUps.length > 0) {
            const timeNow = performance.now();
            for (const pu of curveGame.powerUps) {
                const pulse = Math.sin(timeNow * 0.006 + pu.id) * 2.2;
                const r = (pu.radius || 18) + pulse;

                curveCtx.save();
                curveCtx.shadowColor = pu.color || '#00f3ff';
                curveCtx.shadowBlur = 18;
                curveCtx.fillStyle = pu.color || '#00f3ff';
                curveCtx.beginPath();
                curveCtx.arc(pu.x, pu.y, r, 0, Math.PI * 2);
                curveCtx.fill();

                // Inner white badge
                curveCtx.shadowBlur = 0;
                curveCtx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                curveCtx.beginPath();
                curveCtx.arc(pu.x, pu.y, r * 0.72, 0, Math.PI * 2);
                curveCtx.fill();

                // Icon
                curveCtx.font = '16px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
                curveCtx.textAlign = 'center';
                curveCtx.textBaseline = 'middle';
                curveCtx.fillText(pu.icon || '⚡', pu.x, pu.y + 1);
                curveCtx.restore();
            }
        }

        // Heads
        for (const p of curveGame.players.values()) {
            if (!p.alive) continue;
            const pEffects = (curveGame.activeEffects || []).filter(e => e.targetPlayerId === p.id);
            const isGhost = pEffects.some(e => e.type === 'ghost');
            const isInverted = pEffects.some(e => e.type === 'invert');
            const isTurbo = pEffects.some(e => e.type === 'turbo');

            curveCtx.save();
            if (isGhost) {
                // Ghostly pulsing aura
                curveCtx.globalAlpha = 0.55;
                curveCtx.shadowColor = '#00f3ff';
                curveCtx.shadowBlur = 24;
            } else if (!p.isDrawing) {
                curveCtx.globalAlpha = 0.5;
                curveCtx.shadowColor = '#ffffff';
                curveCtx.shadowBlur = 18;
            } else {
                curveCtx.shadowColor = p.color;
                curveCtx.shadowBlur = isTurbo ? 22 : 12;
            }
            curveCtx.fillStyle = isGhost ? '#00f3ff' : '#ffffff';
            curveCtx.beginPath();
            curveCtx.arc(p.x, p.y, LINE_RADIUS + (isGhost ? 2 : 1), 0, Math.PI * 2);
            curveCtx.fill();

            const tipX = p.x + Math.cos(p.angle) * (LINE_RADIUS + 4);
            const tipY = p.y + Math.sin(p.angle) * (LINE_RADIUS + 4);
            curveCtx.strokeStyle = p.color;
            curveCtx.lineWidth = 2.5;
            curveCtx.beginPath();
            curveCtx.moveTo(p.x, p.y);
            curveCtx.lineTo(tipX, tipY);
            curveCtx.stroke();

            // Status icon indicator above head
            if (isInverted) {
                curveCtx.font = '14px sans-serif';
                curveCtx.textAlign = 'center';
                curveCtx.fillText('🔀', p.x, p.y - 12);
            } else if (isTurbo) {
                curveCtx.font = '14px sans-serif';
                curveCtx.textAlign = 'center';
                curveCtx.fillText('🚀', p.x, p.y - 12);
            } else if (isGhost) {
                curveCtx.font = '14px sans-serif';
                curveCtx.textAlign = 'center';
                curveCtx.fillText('👻', p.x, p.y - 12);
            }

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

        // Power-Up Banner
        const bannerEl = document.getElementById('curve-powerup-banner');
        if (bannerEl) {
            if (curveGame.banner && curveGame.banner.timer > 0) {
                bannerEl.style.display = 'block';
                bannerEl.textContent = curveGame.banner.text;
                bannerEl.style.borderColor = curveGame.banner.color || 'var(--cyan)';
                bannerEl.style.boxShadow = `0 0 25px ${curveGame.banner.color || 'rgba(0, 243, 255, 0.45)'}`;
            } else {
                bannerEl.style.display = 'none';
            }
        }

        // Active Effects Bar
        const effectsBar = document.getElementById('curve-effects-bar');
        if (effectsBar) {
            effectsBar.innerHTML = '';
            if (curveGame.activeEffects) {
                const myEffects = curveGame.activeEffects.filter(e => e.targetPlayerId === myPlayerId);
                for (const eff of myEffects) {
                    const pill = document.createElement('div');
                    pill.className = `curve-effect-pill ${eff.type}`;
                    pill.innerHTML = `<span>${eff.icon}</span> <span>${eff.label}: ${eff.remaining.toFixed(1)}s</span>`;
                    effectsBar.appendChild(pill);
                }
            }
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
    // GAME 6: UNO
    // ==========================================
    const unoTurnIndicator = document.getElementById('uno-turn-indicator');
    const unoActiveColorBadge = document.getElementById('uno-active-color-badge');
    const unoOpponentsBar = document.getElementById('uno-opponents-bar');
    const btnUnoDraw = document.getElementById('btn-uno-draw');
    const unoDeckCount = document.getElementById('uno-deck-count');
    const unoTopCardContainer = document.getElementById('uno-top-card-container');
    const unoHandCards = document.getElementById('uno-hand-cards');
    const btnCallUno = document.getElementById('btn-call-uno');
    const unoColorModal = document.getElementById('uno-color-modal');
    const unoWinnerOverlay = document.getElementById('uno-winner-overlay');
    const unoWinnerText = document.getElementById('uno-winner-text');

    let pendingWildCardId = null;

    function renderUnoCardElement(card, isPlayable = false) {
        const div = document.createElement('div');
        div.className = `uno-card color-${card.color}` + (isPlayable ? ' playable' : ' unplayable');
        div.setAttribute('data-card-id', card.id);

        const valMap = {
            skip: '🚫',
            reverse: '🔄',
            draw2: '+2',
            wild: '🌈',
            wild4: '+4'
        };
        const displayVal = valMap[card.value] || card.value;

        div.innerHTML = `
            <span class="card-corner top">${displayVal}</span>
            <div class="uno-card-center"><span>${displayVal}</span></div>
            <span class="card-corner bottom">${displayVal}</span>
        `;
        return div;
    }

    function renderUnoSnapshot(snap) {
        if (!snap) return;

        const isMyTurn = snap.currentTurnPlayerId === myPlayerId;
        if (unoTurnIndicator) {
            unoTurnIndicator.textContent = isMyTurn ? 'AM ZUG: DU' : `AM ZUG: ${snap.currentTurnName}`;
            unoTurnIndicator.style.color = isMyTurn ? 'var(--cyan)' : '#f59e0b';
        }

        // Active color badge
        if (unoActiveColorBadge) {
            const colorLabels = {
                red: '🔴 Rot',
                blue: '🔵 Blau',
                green: '🟢 Grün',
                yellow: '🟡 Gelb'
            };
            unoActiveColorBadge.textContent = `Farbe: ${colorLabels[snap.activeColor] || snap.activeColor}`;
            const colorStyleMap = {
                red: '#ef4444',
                blue: '#3b82f6',
                green: '#10b981',
                yellow: '#f59e0b'
            };
            unoActiveColorBadge.style.color = colorStyleMap[snap.activeColor] || '#fff';
        }

        // Deck count
        if (unoDeckCount) unoDeckCount.textContent = snap.drawPileCount;

        // Top discard card
        if (unoTopCardContainer) {
            unoTopCardContainer.innerHTML = '';
            if (snap.topCard) {
                const topEl = renderUnoCardElement(snap.topCard, false);
                unoTopCardContainer.appendChild(topEl);
            }
        }

        // Opponents roster
        if (unoOpponentsBar) {
            unoOpponentsBar.innerHTML = '';
            (snap.players || []).forEach(p => {
                if (p.id === myPlayerId) return; // Don't show self in opponents row
                const b = document.createElement('div');
                b.className = 'uno-opponent-badge' + (p.isCurrentTurn ? ' active-turn' : '');
                b.innerHTML = `
                    <span style="color: ${p.color}; font-weight: bold;">${p.name}${p.isBot ? ' 🤖' : ''}</span>
                    <span class="cards-tag">${p.cardCount} 🎴</span>
                    ${p.calledUno ? '<span style="color: #f59e0b; font-weight: bold;">UNO!</span>' : ''}
                `;
                unoOpponentsBar.appendChild(b);
            });
        }

        // My hand cards
        if (unoHandCards) {
            unoHandCards.innerHTML = '';
            (snap.myHand || []).forEach(card => {
                const canPlay = isMyTurn && !snap.awaitingColorChoice && (
                    card.color === 'wild' ||
                    card.color === snap.activeColor ||
                    (snap.topCard && card.value === snap.topCard.value)
                );

                const cardEl = renderUnoCardElement(card, canPlay);
                if (canPlay) {
                    cardEl.addEventListener('click', () => {
                        if (card.color === 'wild') {
                            pendingWildCardId = card.id;
                            if (unoColorModal) unoColorModal.style.display = 'flex';
                        } else {
                            if (networkManager.isHost) {
                                unoGame.playCard(myPlayerId, card.id);
                                broadcastUnoState();
                            } else {
                                networkManager.sendToHost('UNO_PLAY', { cardId: card.id });
                            }
                        }
                    });
                }
                unoHandCards.appendChild(cardEl);
            });
        }

        // Winner overlay
        if (snap.status === 'GAME_OVER' && snap.winner) {
            if (unoWinnerOverlay) unoWinnerOverlay.style.display = 'flex';
            if (unoWinnerText) unoWinnerText.textContent = `🏆 ${snap.winner} GEWINNT UNO!`;
        } else {
            if (unoWinnerOverlay) unoWinnerOverlay.style.display = 'none';
        }
    }

    function broadcastUnoState() {
        for (const conn of networkManager.connections.values()) {
            if (conn.open) {
                conn.send({
                    type: 'UNO_STATE',
                    payload: unoGame.getSnapshot(conn.peer)
                });
            }
        }
        renderUnoSnapshot(unoGame.getSnapshot(myPlayerId));
    }

    // Deck Draw button click
    if (btnUnoDraw) {
        btnUnoDraw.addEventListener('click', () => {
            if (unoGame.status === 'PLAYING') {
                const curr = unoGame.getCurrentPlayer();
                if (curr && curr.id === myPlayerId) {
                    if (networkManager.isHost) {
                        unoGame.playerDrawCard(myPlayerId);
                        broadcastUnoState();
                    } else {
                        networkManager.sendToHost('UNO_DRAW', {});
                    }
                }
            }
        });
    }

    // UNO call button
    if (btnCallUno) {
        btnCallUno.addEventListener('click', () => {
            if (networkManager.isHost) {
                unoGame.callUno(myPlayerId);
                broadcastUnoState();
            } else {
                networkManager.sendToHost('UNO_CALL', {});
            }
        });
    }

    // Color picker buttons
    document.querySelectorAll('.color-pick-btn').forEach(b => {
        b.addEventListener('click', () => {
            const chosenCol = b.getAttribute('data-color');
            if (unoColorModal) unoColorModal.style.display = 'none';
            if (pendingWildCardId) {
                if (networkManager.isHost) {
                    unoGame.playCard(myPlayerId, pendingWildCardId, chosenCol);
                    broadcastUnoState();
                } else {
                    networkManager.sendToHost('UNO_PLAY', { cardId: pendingWildCardId, color: chosenCol });
                }
                pendingWildCardId = null;
            }
        });
    });

    // Play again button
    const btnPlayAgainUno = document.querySelector('.btn-play-again-uno');
    if (btnPlayAgainUno) {
        btnPlayAgainUno.addEventListener('click', () => {
            if (unoWinnerOverlay) unoWinnerOverlay.style.display = 'none';
            if (networkManager.isHost) {
                unoGame.startMatch();
                broadcastUnoState();
            }
        });
    }

    // ==========================================
    // GAME 7: CORPORATE DODGEBALL (Data Squad vs. ComM)
    // ==========================================
    const dbCanvas = document.getElementById('dodgeballCanvas');
    const dbCtx = dbCanvas ? dbCanvas.getContext('2d') : null;
    let dbMouseX = DB_CENTER_X;
    let dbMouseY = DB_ARENA_H / 2;
    let dbAimAngle = 0;
    let dbMouseThrow = false;

    if (dbCanvas) {
        dbCanvas.addEventListener('mousemove', (e) => {
            const rect = dbCanvas.getBoundingClientRect();
            dbMouseX = (e.clientX - rect.left) * (DB_ARENA_W / rect.width);
            dbMouseY = (e.clientY - rect.top) * (DB_ARENA_H / rect.height);
            const me = dodgeballGame.players.get(myPlayerId);
            if (me) {
                dbAimAngle = Math.atan2(dbMouseY - me.y, dbMouseX - me.x);
            }
        });

        dbCanvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) dbMouseThrow = true;
        });

        window.addEventListener('mouseup', () => {
            dbMouseThrow = false;
        });
    }

    const btnPlayAgainDb = document.querySelector('.btn-play-again-db');
    if (btnPlayAgainDb) {
        btnPlayAgainDb.addEventListener('click', () => {
            const overlay = document.getElementById('db-winner-overlay');
            if (overlay) overlay.style.display = 'none';
            if (networkManager.isHost) {
                dodgeballGame.startMatch(3);
            }
        });
    }

    // Touch controls for Dodgeball
    bindTouch('db-touch-up', 'KeyW');
    bindTouch('db-touch-down', 'KeyS');
    bindTouch('db-touch-left', 'KeyA');
    bindTouch('db-touch-right', 'KeyD');
    bindTouch('db-touch-throw', 'Space');
    bindTouch('db-touch-dash', 'ShiftLeft');

    function renderDodgeball() {
        if (!dbCtx) return;

        // Background
        dbCtx.fillStyle = '#060814';
        dbCtx.fillRect(0, 0, DB_ARENA_W, DB_ARENA_H);

        // Team floor highlights
        // Data Squad half (Left)
        dbCtx.fillStyle = 'rgba(0, 243, 255, 0.04)';
        dbCtx.fillRect(30, 30, DB_CENTER_X - 30, DB_ARENA_H - 60);

        // ComM half (Right)
        dbCtx.fillStyle = 'rgba(255, 0, 85, 0.04)';
        dbCtx.fillRect(DB_CENTER_X, 30, DB_CENTER_X - 30, DB_ARENA_H - 60);

        // Big Court Lettering
        dbCtx.save();
        dbCtx.font = '900 46px sans-serif';
        dbCtx.textAlign = 'center';
        dbCtx.textBaseline = 'middle';
        dbCtx.fillStyle = 'rgba(0, 243, 255, 0.06)';
        dbCtx.fillText('DATA SQUAD', 315, DB_ARENA_H / 2);

        dbCtx.fillStyle = 'rgba(255, 0, 85, 0.06)';
        dbCtx.fillText('COMMUNICATION', 885, DB_ARENA_H / 2);
        dbCtx.restore();

        // Outer Arena Border
        dbCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        dbCtx.lineWidth = 3;
        dbCtx.strokeRect(30, 30, DB_ARENA_W - 60, DB_ARENA_H - 60);

        // Center Dividing Line (The Office Wall / Demarcation)
        dbCtx.save();
        dbCtx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
        dbCtx.lineWidth = 4;
        dbCtx.setLineDash([16, 12]);
        dbCtx.beginPath();
        dbCtx.moveTo(DB_CENTER_X, 30);
        dbCtx.lineTo(DB_CENTER_X, DB_ARENA_H - 30);
        dbCtx.stroke();
        dbCtx.restore();

        // Draw Obstacle Rocks (Steine im Weg)
        for (const r of dodgeballGame.rocks) {
            dbCtx.save();
            dbCtx.shadowColor = '#ff0055';
            dbCtx.shadowBlur = 14;
            dbCtx.fillStyle = '#374151';
            dbCtx.beginPath();
            dbCtx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            dbCtx.fill();
            dbCtx.strokeStyle = '#ff0055';
            dbCtx.lineWidth = 2.5;
            dbCtx.stroke();

            dbCtx.font = '18px sans-serif';
            dbCtx.textAlign = 'center';
            dbCtx.textBaseline = 'middle';
            dbCtx.fillText('🪨', r.x, r.y + 1);
            dbCtx.restore();
        }

        // Draw Balls on Floor
        for (const b of dodgeballGame.balls) {
            if (b.state === 'FLOOR') {
                dbCtx.save();
                dbCtx.shadowColor = b.color || '#00f3ff';
                dbCtx.shadowBlur = 10;
                dbCtx.fillStyle = 'rgba(255, 255, 255, 0.15)';
                dbCtx.beginPath();
                dbCtx.arc(b.x, b.y, DB_BALL_RADIUS + 4, 0, Math.PI * 2);
                dbCtx.fill();

                dbCtx.font = '16px "Segoe UI Emoji", sans-serif';
                dbCtx.textAlign = 'center';
                dbCtx.textBaseline = 'middle';
                dbCtx.fillText(b.icon || '📦', b.x, b.y + 1);
                dbCtx.restore();
            }
        }

        // Draw Flying Balls (With Speed Trail)
        for (const b of dodgeballGame.balls) {
            if (b.state === 'FLYING') {
                dbCtx.save();
                dbCtx.shadowColor = b.color || '#fff';
                dbCtx.shadowBlur = 18;

                // Glowing core
                dbCtx.fillStyle = b.color || '#00f3ff';
                dbCtx.beginPath();
                dbCtx.arc(b.x, b.y, DB_BALL_RADIUS + 3, 0, Math.PI * 2);
                dbCtx.fill();

                dbCtx.font = '18px "Segoe UI Emoji", sans-serif';
                dbCtx.textAlign = 'center';
                dbCtx.textBaseline = 'middle';
                dbCtx.fillText(b.icon || '📦', b.x, b.y + 1);
                dbCtx.restore();
            }
        }

        // Draw Players
        for (const p of dodgeballGame.players.values()) {
            if (!p.alive) {
                // Ghostly elimination cross
                dbCtx.save();
                dbCtx.font = '24px sans-serif';
                dbCtx.textAlign = 'center';
                dbCtx.textBaseline = 'middle';
                dbCtx.fillText('💀', p.x, p.y);
                dbCtx.restore();
                continue;
            }

            dbCtx.save();
            const isSquad = p.team === 'squad';

            // Dashing glow
            if (p.dashTimer > 0) {
                dbCtx.shadowColor = p.color;
                dbCtx.shadowBlur = 24;
                dbCtx.globalAlpha = 0.85;
            } else {
                dbCtx.shadowColor = p.color;
                dbCtx.shadowBlur = 12;
            }

            // Player body
            dbCtx.fillStyle = isSquad ? '#0f172a' : '#1f0d18';
            dbCtx.beginPath();
            dbCtx.arc(p.x, p.y, DB_PLAYER_RADIUS, 0, Math.PI * 2);
            dbCtx.fill();

            // Team outline
            dbCtx.strokeStyle = p.color;
            dbCtx.lineWidth = 3.5;
            dbCtx.stroke();

            // Direction pointer / Aim laser
            const aim = typeof p.aimAngle === 'number' ? p.aimAngle : (isSquad ? 0 : Math.PI);
            dbCtx.strokeStyle = p.color;
            dbCtx.lineWidth = 2;
            dbCtx.beginPath();
            dbCtx.moveTo(p.x, p.y);
            dbCtx.lineTo(p.x + Math.cos(aim) * (DB_PLAYER_RADIUS + 12), p.y + Math.sin(aim) * (DB_PLAYER_RADIUS + 12));
            dbCtx.stroke();

            // Held Ball Icon
            if (p.hasBall) {
                dbCtx.font = '16px "Segoe UI Emoji", sans-serif';
                dbCtx.textAlign = 'center';
                dbCtx.textBaseline = 'middle';
                dbCtx.fillText(p.hasBall.icon || '📦', p.x, p.y - DB_PLAYER_RADIUS - 12);
            }

            // Player Name & HP Pips
            dbCtx.font = 'bold 12px sans-serif';
            dbCtx.fillStyle = '#ffffff';
            dbCtx.textAlign = 'center';
            dbCtx.fillText(p.name, p.x, p.y + DB_PLAYER_RADIUS + 15);

            // HP pips
            const maxPips = p.maxHp || 3;
            const currentHp = p.hp || 0;
            const pipWidth = 8;
            const pipGap = 4;
            const totalPipW = maxPips * pipWidth + (maxPips - 1) * pipGap;
            const startPipX = p.x - totalPipW / 2;

            for (let i = 0; i < maxPips; i++) {
                dbCtx.fillStyle = i < currentHp ? (isSquad ? '#00f3ff' : '#ff0055') : '#475569';
                dbCtx.fillRect(startPipX + i * (pipWidth + pipGap), p.y + DB_PLAYER_RADIUS + 20, pipWidth, 4);
            }

            dbCtx.restore();
        }

        // Particles
        for (const pt of dodgeballGame.particles) {
            dbCtx.save();
            dbCtx.globalAlpha = Math.max(0, pt.life);
            dbCtx.fillStyle = pt.color;
            dbCtx.beginPath();
            dbCtx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
            dbCtx.fill();
            dbCtx.restore();
        }

        // HUD Updates
        const roundDisp = document.getElementById('db-round-display');
        if (roundDisp) roundDisp.textContent = `${dodgeballGame.round} / ${dodgeballGame.maxRounds}`;

        const scoreSquadEl = document.getElementById('db-score-squad');
        if (scoreSquadEl) scoreSquadEl.textContent = String(dodgeballGame.scoreSquad);

        const scoreComMEl = document.getElementById('db-score-comm');
        if (scoreComMEl) scoreComMEl.textContent = String(dodgeballGame.scoreComM);

        // Banner Popup
        const bannerEl = document.getElementById('db-banner');
        if (bannerEl) {
            if (dodgeballGame.banner && dodgeballGame.banner.timer > 0) {
                bannerEl.style.display = 'block';
                bannerEl.textContent = dodgeballGame.banner.text;
                bannerEl.style.borderColor = dodgeballGame.banner.color || '#ffaa00';
            } else {
                bannerEl.style.display = 'none';
            }
        }

        // Overlays
        const countdownOverlay = document.getElementById('db-countdown-overlay');
        const countdownNum = document.getElementById('db-countdown-num');
        const winnerOverlay = document.getElementById('db-winner-overlay');
        const winnerText = document.getElementById('db-winner-text');

        if (dodgeballGame.status === 'COUNTDOWN') {
            if (countdownOverlay) countdownOverlay.style.display = 'block';
            if (countdownNum) countdownNum.textContent = dodgeballGame.countdownTimer > 0 ? Math.ceil(dodgeballGame.countdownTimer) : 'LOS!';
            if (winnerOverlay) winnerOverlay.style.display = 'none';
        } else if (dodgeballGame.status === 'ROUND_OVER' || dodgeballGame.status === 'MATCH_OVER') {
            if (countdownOverlay) countdownOverlay.style.display = 'none';
            if (winnerOverlay) winnerOverlay.style.display = 'block';
            if (winnerText) {
                winnerText.textContent = dodgeballGame.winner
                    ? `🏆 ${dodgeballGame.winner.toUpperCase()} GEWINNT DAS MATCH!`
                    : (dodgeballGame.banner ? dodgeballGame.banner.text : 'RUNDE VORBEI!');
            }
        } else {
            if (countdownOverlay) countdownOverlay.style.display = 'none';
            if (winnerOverlay) winnerOverlay.style.display = 'none';
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
        } else if (type === 'UNO_PLAY') {
            unoGame.playCard(senderId, payload.cardId, payload.color);
            broadcastUnoState();
        } else if (type === 'UNO_DRAW') {
            unoGame.playerDrawCard(senderId);
            broadcastUnoState();
        } else if (type === 'UNO_CALL') {
            unoGame.callUno(senderId);
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
        } else if (type === 'UNO_STATE') {
            renderUnoSnapshot(payload);
        } else if (type === 'DB_STATE') {
            dodgeballGame.applySnapshot(payload);
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
            } else if (activeGameType === 'uno') {
                const prevTurn = unoGame.turnIndex;
                const prevStatus = unoGame.status;
                unoGame.update(dt);
                if (unoGame.turnIndex !== prevTurn || unoGame.status !== prevStatus) {
                    broadcastUnoState();
                }
            } else if (activeGameType === 'dodgeball') {
                dodgeballGame.update(dt);
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

        // 2. Render active game
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
