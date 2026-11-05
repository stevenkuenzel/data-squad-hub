/**
 * DataSquad Hub UI: Spielanleitungen & Hilfe-Modal
 * Klassisches Script – teilt den globalen Scope mit den übrigen ui/*.js (Ladereihenfolge siehe index.html).
 */

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
            'Klicke "Zug beenden", wenn ihr keine weiteren Versuche wagen möchtet.',
            '⏱ Mit aktiviertem Rundentimer (Host-Einstellung) endet der Zug automatisch, wenn die Zeit abläuft. Bots 🤖 geben Hinweise wie "TIERE 3" und raten mit.'
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
        tip: '⚡ <strong>Punktevergabe:</strong> Je schneller das Wort erraten wird, desto mehr Punkte erhalten Rater und Maler! Werkzeuge: ✏️ Stift, 🧽 Radierer, 🪣 Füllen und ↶ Zurück für den letzten Strich.'
    },
    tank: {
        title: '💥 Tank Trouble (2D Panzer-Schlacht)',
        goal: 'Zerstöre gegnerische Panzer mit abprallenden Querschlägern und sei der letzte Überlebende der Runde!',
        controls: [
            '💻 <strong>Desktop:</strong> <code>W</code> / <code>S</code> oder <code>▲</code> / <code>▼</code> (Fahren), <code>A</code> / <code>D</code> oder <code>◀</code> / <code>▶</code> (Drehen), <code>Leertaste</code> (Feuer).',
            '📱 <strong>Mobile:</strong> Virtuelles Steuerkreuz links (Vor, Zurück, Drehen) & 💥 Feuer-Knopf rechts.'
        ],
        tip: '💥 <strong>Querschläger:</strong> Schüsse prallen bis zu 5-mal an Wänden ab. Pass auf, dass du dich nicht selbst abschießt! Maximal 5 Kugeln gleichzeitig aktiv. Eingesammelte Pickups ersetzen deinen nächsten Schuss: 🔦 Laser (prallt 2-mal ab, trifft sofort) oder 💣 Mine (nach 1,5 s scharf).'
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
        tip: '💡 <strong>Taktik:</strong> Hebe dir Farbwahl- und +4-Karten für den perfekten Moment auf, um das Spielgeschehen abrupt zu drehen! Hausregeln (Host-Einstellung): ➕ Strafen stapeln (+2 auf +2, +4 auf +4) und 🔁 7-0-Tauschen (7 = Hand tauschen, 0 = alle Hände wandern weiter).'
    },
    dodgeball: {
        title: '🤾 Corporate Dodgeball: Data Squad vs. ComN',
        goal: 'Büro-Völkerball! Wirf das gegnerische Team ab. Data Squad (Links) wirft Code-Releases & Live-Dashboards, ComN (Rechts) wirft bürokratische Steine, Aktenordner, teure Rechnungen und "Das große ComN-Paket"!',
        controls: [
            '💻 <strong>Desktop:</strong> <code>WASD</code> / Pfeile = Bewegen | <code>Leertaste</code> / Linksklick = Werfen | <code>Shift</code> / <code>Rechtsklick</code> / <code>C</code> = Hechtsprung & Fangen.',
            '📱 <strong>Mobile:</strong> Virtuelles D-Pad links + <code>WURF</code> & <code>FANGEN / DASH</code> Knöpfe rechts.'
        ],
        tip: '🎯 <strong>Catch-Mechanik:</strong> Drücke <code>Shift</code>, <code>Rechtsklick</code>, <code>C</code> oder den <code>FANGEN</code>-Knopf, wenn ein gegnerischer Ball auf dich zufliegt, um ihn direkt aus der Luft zu schnappen! Vorsicht vor dem <strong>"Großen ComN-Paket"</strong> (📦), das bei Einschlag in 3 neue Blocker explodiert! Power-Ups: 🛡️ Schild (6 s unverwundbar) und ✌️ Doppelwurf. Mit Rundentimer gewinnt bei Zeitablauf das Team mit mehr Lebenspunkten.'
    },
    roulette: {
        title: '🎲 ComN: Freigabe-Roulette',
        goal: 'Bürokratie-Survival! Erreiche als Erster 100% Projektfortschritt mit Code-Deploys und CI/CD, während ComN versucht, das Projekt mit Steinen im Weg, externen Agenturen und 4-Stunden-Meetings zu sabotieren.',
        roles: [
            '🚀 <strong>Fortschritt (Data Squad):</strong> Deploys (+20%), Automatisierte Pipelines (+30%), Quick-Fixes (+15%), Nachtschichten (+25%).',
            '🪨 <strong>ComN-Blocker:</strong> Stein im Weg (-15%), Externe Agentur (-20%), CI-Handbuch 2018 (-10% für alle), 4-Stunden-Alignment (Aussetzen).',
            '👔 <strong>Reaktionen & Schutz:</strong> Chef-Bypass (Schützt vor Angriffen).'
        ],
        controls: [
            'Pro Zug kannst du bis zu 2 Karten ausspielen.',
            'Klicke auf eine Handkarte, um sie zu spielen.',
            'Verlangt eine Blocker-Karte ein Ziel, wähle einen gegnerischen Spieler im Popup.',
            'Klicke auf "Zug beenden ➔", wenn du fertig bist.'
        ],
        tip: '💡 <strong>Taktik:</strong> Spiele Blocker gezielt gegen Spieler, die kurz vor 100% Go-Live stehen, und spare dir den Chef-Bypass für kritische Momente auf!'
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
const btnCurveHudPerks = document.getElementById('btn-curve-hud-perks');

function syncCurvePerksUI() {
    const isEnabled = curveGame.powerUpsEnabled;
    if (btnTogglePowerups) {
        btnTogglePowerups.textContent = isEnabled ? 'AN' : 'AUS';
        btnTogglePowerups.className = `btn btn-sm ${isEnabled ? 'btn-primary' : 'btn-secondary'}`;
    }
    if (btnCurveHudPerks) {
        btnCurveHudPerks.style.opacity = isEnabled ? '1.0' : '0.35';
        btnCurveHudPerks.style.borderColor = isEnabled ? 'var(--cyan)' : 'rgba(255,255,255,0.2)';
        btnCurveHudPerks.title = isEnabled ? 'Power-Ups: AN (Klicken zum Ausschalten)' : 'Power-Ups: AUS (Klicken zum Einschalten)';
    }
}

function toggleCurvePerks() {
    curveGame.setPowerUpsEnabled(!curveGame.powerUpsEnabled);
    syncCurvePerksUI();
    if (window.soundFX) window.soundFX.playClick();
    if (networkManager.isHost) {
        networkManager.broadcast('STATE', curveGame.getSnapshot());
    }
}

if (btnTogglePowerups) {
    btnTogglePowerups.addEventListener('click', toggleCurvePerks);
}
if (btnCurveHudPerks) {
    btnCurveHudPerks.addEventListener('click', toggleCurvePerks);
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
        sName.style.color = safeColor(p.color);
        sName.innerHTML = `${avatarHtml(p.id, p.isBot)}${esc(p.name)}`;
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
                pill.innerHTML = `<span>${esc(eff.icon)}</span> <span>${esc(eff.label)}: ${(Number(eff.remaining) || 0).toFixed(1)}s</span>`;
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
