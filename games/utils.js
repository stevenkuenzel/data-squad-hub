/**
 * Shared helpers for all game modules. Must be loaded before the games.
 */

// Unbiased in-place Fisher-Yates shuffle. Returns the same array.
// (sort(() => Math.random() - 0.5) is biased and must not be used.)
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Per-match statistics for the Spieleabend awards/achievements: game.stats[playerId][key].
// max=true keeps the highest value instead of summing.
function bumpStat(game, playerId, key, amount = 1, max = false) {
    if (!playerId) return;
    if (!game.stats) game.stats = {};
    const s = game.stats[playerId] || (game.stats[playerId] = {});
    s[key] = max ? Math.max(s[key] || 0, amount) : (s[key] || 0) + amount;
}

window.shuffleArray = shuffleArray;
window.bumpStat = bumpStat;
