/**
 * Handy-Controller & Beamer: kleine, UI-unabhängige Helfer (in Node testbar).
 */

/**
 * Virtueller Joystick: Auslenkung (dx, dy in Pixeln) -> Richtungstasten, Winkel und Stärke.
 * radius = maximale Auslenkung des Knopfes, deadzone = Totzone in Pixeln.
 */
function padStickToDirs(dx, dy, radius = 40, deadzone = 10) {
    const dist = Math.hypot(dx, dy);
    const clamped = dist > radius ? radius / dist : 1;
    const x = dx * clamped;
    const y = dy * clamped;
    return {
        x, y,
        fwd: y < -deadzone,
        back: y > deadzone,
        left: x < -deadzone,
        right: x > deadzone,
        active: Math.hypot(x, y) > deadzone,
        mag: radius > 0 ? Math.min(1, Math.hypot(x, y) / radius) : 0, // 0..1 relativ zum Radius
        angle: Math.atan2(y, x)
    };
}

/**
 * Einladungslink für Handys. Entfernt Beamer-/Controller-Parameter einer eventuellen
 * Beamer-URL und setzt game, room (und optional pad=1 für den Controller-Modus).
 */
function padBuildLink(href, gameType, code, controller = true) {
    const url = new URL(href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('game', gameType);
    url.searchParams.set('room', code);
    if (controller) url.searchParams.set('pad', '1');
    return url.toString();
}

/** Welche Spiele haben einen eigenen Handy-Controller? */
const PAD_GAMES = ['curve', 'tank', 'pong', 'dodgeball'];
function padHasController(gameType) {
    return PAD_GAMES.includes(gameType);
}
