/**
 * DataSquad Hub UI: Curve Arena UI
 * Klassisches Script – teilt den globalen Scope mit den übrigen ui/*.js (Ladereihenfolge siehe index.html).
 */

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
    KeyA: false, KeyD: false, KeyW: false, KeyS: false, Space: false,
    ShiftLeft: false, ShiftRight: false, KeyC: false, KeyF: false
};

window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyC' || e.code === 'KeyF') {
        keys.ShiftLeft = true;
    }
    if (e.code in keys) {
        keys[e.code] = true;
        if (['game-curve', 'game-tank', 'game-pong', 'game-dodgeball'].some(id => document.getElementById(id).classList.contains('active'))) {
            e.preventDefault();
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyC' || e.code === 'KeyF') {
        keys.ShiftLeft = false;
    }
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
bindTouch('tank-touch-shoot', 'Space');
bindTouch('pong-touch-left', 'ArrowLeft');
bindTouch('pong-touch-right', 'ArrowRight');

// Virtual Analog Joystick for Tanks
const tankJoystickZone = document.getElementById('tank-joystick-zone');
const tankJoystickBase = document.getElementById('tank-joystick-base');
const tankJoystickKnob = document.getElementById('tank-joystick-knob');

if (tankJoystickZone && tankJoystickBase && tankJoystickKnob) {
    let joyActive = false;
    let joyTouchId = null;
    const maxDist = 40;

    function handleJoystickMove(clientX, clientY) {
        const rect = tankJoystickBase.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        let dx = clientX - centerX;
        let dy = clientY - centerY;
        const dist = Math.hypot(dx, dy);

        if (dist > maxDist) {
            const angle = Math.atan2(dy, dx);
            dx = Math.cos(angle) * maxDist;
            dy = Math.sin(angle) * maxDist;
        }

        tankJoystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;

        // Direction thresholds with deadzone (10px)
        const deadzone = 10;
        keys.ArrowUp = dy < -deadzone;
        keys.ArrowDown = dy > deadzone;
        keys.ArrowLeft = dx < -deadzone;
        keys.ArrowRight = dx > deadzone;
    }

    function resetJoystick() {
        joyActive = false;
        joyTouchId = null;
        tankJoystickKnob.style.transform = 'translate(0px, 0px)';
        keys.ArrowUp = false;
        keys.ArrowDown = false;
        keys.ArrowLeft = false;
        keys.ArrowRight = false;
    }

    tankJoystickZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (joyActive) return;
        const touch = e.changedTouches[0];
        joyActive = true;
        joyTouchId = touch.identifier;
        handleJoystickMove(touch.clientX, touch.clientY);
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
        if (!joyActive) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier === joyTouchId) {
                e.preventDefault();
                handleJoystickMove(touch.clientX, touch.clientY);
                break;
            }
        }
    }, { passive: false });

    window.addEventListener('touchend', (e) => {
        if (!joyActive) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === joyTouchId) {
                resetJoystick();
                break;
            }
        }
    });

    window.addEventListener('touchcancel', (e) => {
        if (!joyActive) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === joyTouchId) {
                resetJoystick();
                break;
            }
        }
    });

    // Mouse testing fallback
    tankJoystickZone.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        joyActive = true;
        handleJoystickMove(e.clientX, e.clientY);

        const onMouseMove = (ev) => {
            if (joyActive) handleJoystickMove(ev.clientX, ev.clientY);
        };
        const onMouseUp = () => {
            resetJoystick();
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    });
}
