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

window.shuffleArray = shuffleArray;
