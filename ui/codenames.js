/**
 * DataSquad Hub UI: Codenames UI
 * Klassisches Script – teilt den globalen Scope mit den übrigen ui/*.js (Ladereihenfolge siehe index.html).
 */

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

// Enter in the clue field submits the clue
cnClueWordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        btnGiveClue.click();
    }
});

btnEndTurn.addEventListener('click', () => {
    if (networkManager.isHost) {
        if (codenamesGame.endTurn(myPlayerId)) broadcastCodenamesState();
    } else {
        networkManager.sendToHost('CN_END_TURN', {});
    }
});

function renderCodenamesBoard(remoteSnap = null) {
    const snap = remoteSnap || codenamesGame.getSnapshot(myPlayerId);

    cnScoreRed.textContent = snap.scoreRed;
    cnScoreBlue.textContent = snap.scoreBlue;

    const cnTimerText = (snap.timerSeconds > 0 && snap.gameStatus === 'PLAYING') ? ` · ⏱ ${snap.timeLeft}s` : '';
    cnTurnIndicator.textContent = (snap.currentTurn === 'red' ? 'TEAM ROT AM ZUG' : 'TEAM BLAU AM ZUG') + cnTimerText;
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
            pill.textContent = `${p.role === 'spymaster' ? '🕵️' : '👥'} ${p.name}${p.isBot ? ' 🤖' : ''}`;
            cnRosterRed.appendChild(pill);
        });
    }
    if (cnRosterBlue) {
        cnRosterBlue.innerHTML = '';
        playersList.filter(p => p.team === 'blue').forEach(p => {
            const pill = document.createElement('span');
            pill.className = `cn-player-pill ${p.role}`;
            pill.textContent = `${p.role === 'spymaster' ? '🕵️' : '👥'} ${p.name}${p.isBot ? ' 🤖' : ''}`;
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

    codenamesLog.innerHTML = (snap.logs || []).map(l => `<div>• ${esc(l)}</div>`).join('');
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
