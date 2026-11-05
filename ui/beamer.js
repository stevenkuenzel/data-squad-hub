/**
 * DataSquad Hub UI: Beamer-Modus & QR-Einladung
 * Klassisches Script – teilt den globalen Scope mit den übrigen ui/*.js (Ladereihenfolge siehe index.html).
 *
 * Beamer-Host: reine Anzeige, belegt keinen Spieler-Platz. Mitspieler scannen den QR-Code und
 * steuern per Handy (siehe ui/pad.js). Die Host-Logik bleibt auf dem Beamer-Rechner.
 */

const optBeamer = document.getElementById('opt-beamer');
const optPad = document.getElementById('opt-pad');
const lobbyQrPanel = document.getElementById('lobby-qr-panel');
const lobbyQr = document.getElementById('lobby-qr');
const lobbyQrLink = document.getElementById('lobby-qr-link');
const beamerJoinBadge = document.getElementById('beamer-join-badge');
const beamerJoinQr = document.getElementById('beamer-join-qr');
const beamerJoinCode = document.getElementById('beamer-join-code');

// URL-Parameter (?beamer=1 / ?pad=1) setzen nur die Voreinstellung der Häkchen
{
    const params = new URLSearchParams(window.location.search);
    if (optBeamer && params.get('beamer') === '1') optBeamer.checked = true;
    if (optPad && params.get('pad') === '1') optPad.checked = true;
}

function isBeamerRequested() {
    return !!(optBeamer && optBeamer.checked);
}

function isPadRequested() {
    return !!(optPad && optPad.checked);
}

// Zuletzt gezeichneter Link, damit die SVG-Erzeugung nicht bei jedem Lobby-Update läuft
let renderedInviteLink = '';
let renderedInviteSvg = '';

function currentInviteLink() {
    if (!networkManager.isHost || !networkManager.roomCode) return '';
    return getShareableLink(activeGameType, networkManager.roomCode, true);
}

function inviteQrSvg(link) {
    if (link !== renderedInviteLink) {
        try {
            renderedInviteSvg = qrToSvg(qrEncode(link), 2, '#0a0e1a', '#ffffff');
        } catch {
            renderedInviteSvg = '';
        }
        renderedInviteLink = link;
    }
    return renderedInviteSvg;
}

// Host: QR-Code in der Lobby (groß im Beamer-Modus)
function refreshInvite() {
    if (!lobbyQrPanel) return;
    const link = currentInviteLink();
    lobbyQrPanel.style.display = link ? 'flex' : 'none';
    if (!link) return;
    lobbyQr.innerHTML = inviteQrSvg(link); // SVG stammt aus dem eigenen Generator, keine Fremdeingaben
    lobbyQrLink.textContent = link;
    if (beamerJoinQr) {
        beamerJoinQr.innerHTML = inviteQrSvg(link);
        beamerJoinCode.textContent = networkManager.roomCode;
    }
}

// Beamer: kleiner Beitritts-Hinweis über dem laufenden Spiel (für Nachzügler)
function updateBeamerBadge(screenEl) {
    if (!beamerJoinBadge) return;
    const inGame = !!screenEl && Object.values(gameViews).includes(screenEl);
    const show = beamerMode && networkManager.isHost && inGame;
    if (show) refreshInvite();
    beamerJoinBadge.style.display = show ? 'flex' : 'none';
}
