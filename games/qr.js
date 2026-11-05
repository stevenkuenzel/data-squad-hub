/**
 * Minimaler QR-Code-Generator (Byte-Modus, Fehlerkorrektur M, Fallback L, Versionen 1-10).
 * Läuft komplett lokal – keine externen Dienste. Reicht für Einladungslinks bis ca. 270 Zeichen.
 * Algorithmus nach ISO/IEC 18004 (Reed-Solomon über GF(256), 8 Masken mit Strafpunkten).
 */

const QR_MAX_VERSION = 10;
const QR_LEVELS = [
    // [Format-Bits, EC-Codewörter je Block, Anzahl Blöcke] – indexiert nach Version
    { fmt: 0, ecc: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26], blocks: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5] }, // M
    { fmt: 1, ecc: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18], blocks: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4] }  // L
];

function qrUtf8Bytes(text) {
    const out = [];
    const enc = encodeURIComponent(String(text));
    for (let i = 0; i < enc.length; i++) {
        if (enc[i] === '%') {
            out.push(parseInt(enc.substr(i + 1, 2), 16));
            i += 2;
        } else {
            out.push(enc.charCodeAt(i));
        }
    }
    return out;
}

function qrRawModules(ver) {
    let result = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
        const align = Math.floor(ver / 7) + 2;
        result -= (25 * align - 10) * align - 55;
        if (ver >= 7) result -= 36;
    }
    return result;
}

function qrDataCodewords(ver, level) {
    return Math.floor(qrRawModules(ver) / 8) - level.ecc[ver] * level.blocks[ver];
}

function qrGfMul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
        z = (z << 1) ^ ((z >>> 7) * 0x11D);
        z ^= ((y >>> i) & 1) * x;
    }
    return z;
}

function qrRsDivisor(degree) {
    const result = new Array(degree).fill(0);
    result[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
        for (let j = 0; j < degree; j++) {
            result[j] = qrGfMul(result[j], root);
            if (j + 1 < degree) result[j] ^= result[j + 1];
        }
        root = qrGfMul(root, 0x02);
    }
    return result;
}

function qrRsRemainder(data, divisor) {
    const result = new Array(divisor.length).fill(0);
    for (const b of data) {
        const factor = b ^ result.shift();
        result.push(0);
        divisor.forEach((coef, i) => { result[i] ^= qrGfMul(coef, factor); });
    }
    return result;
}

function qrAlignPositions(ver) {
    if (ver === 1) return [];
    const count = Math.floor(ver / 7) + 2;
    const size = ver * 4 + 17;
    const step = Math.ceil((ver * 4 + 4) / (count * 2 - 2)) * 2;
    const result = [6];
    for (let pos = size - 7; result.length < count; pos -= step) result.splice(1, 0, pos);
    return result;
}

function qrBit(value, i) {
    return ((value >>> i) & 1) !== 0;
}

/** Daten + Fehlerkorrektur zu den endgültigen Codewörtern verschränken. */
function qrInterleave(data, ver, level) {
    const numBlocks = level.blocks[ver];
    const eccLen = level.ecc[ver];
    const raw = Math.floor(qrRawModules(ver) / 8);
    const numShort = numBlocks - (raw % numBlocks);
    const shortLen = Math.floor(raw / numBlocks);
    const divisor = qrRsDivisor(eccLen);
    const blocks = [];
    for (let i = 0, k = 0; i < numBlocks; i++) {
        const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1));
        k += dat.length;
        const ecc = qrRsRemainder(dat, divisor);
        if (i < numShort) dat.push(0);
        blocks.push(dat.concat(ecc));
    }
    const result = [];
    for (let i = 0; i < blocks[0].length; i++) {
        blocks.forEach((block, j) => {
            if (i !== shortLen - eccLen || j >= numShort) result.push(block[i]);
        });
    }
    return result;
}

function qrPenalty(m, size) {
    let score = 0;
    // Regel 1: Läufe gleicher Farbe (Zeilen und Spalten)
    for (let dir = 0; dir < 2; dir++) {
        for (let a = 0; a < size; a++) {
            let run = 1;
            for (let b = 1; b <= size; b++) {
                const cur = b < size ? (dir ? m[b][a] : m[a][b]) : null;
                const prev = dir ? m[b - 1][a] : m[a][b - 1];
                if (cur === prev) {
                    run++;
                } else {
                    if (run >= 5) score += 3 + (run - 5);
                    run = 1;
                }
            }
        }
    }
    // Regel 2: 2x2-Blöcke
    for (let y = 0; y < size - 1; y++) {
        for (let x = 0; x < size - 1; x++) {
            const c = m[y][x];
            if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) score += 3;
        }
    }
    // Regel 3: Finder-ähnliche Muster
    const pat = [true, false, true, true, true, false, true];
    const at = (dir, a, b) => (dir ? m[b][a] : m[a][b]);
    for (let dir = 0; dir < 2; dir++) {
        for (let a = 0; a < size; a++) {
            for (let b = 0; b + 7 <= size; b++) {
                if (!pat.every((v, i) => at(dir, a, b + i) === v)) continue;
                const before = b >= 4 && [1, 2, 3, 4].every(i => !at(dir, a, b - i));
                const after = b + 11 <= size && [7, 8, 9, 10].every(i => !at(dir, a, b + i));
                if (before) score += 40;
                if (after) score += 40;
            }
        }
    }
    // Regel 4: Verhältnis dunkler Module
    let dark = 0;
    for (const row of m) for (const c of row) if (c) dark++;
    const total = size * size;
    score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return score;
}

const QR_MASKS = [
    (x, y) => (x + y) % 2 === 0,
    (x, y) => y % 2 === 0,
    (x, y) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
];

/**
 * Text -> QR-Matrix. Gibt { size, version, modules } zurück (modules[y][x] === true: dunkel).
 * Wirft einen Fehler, wenn der Text zu lang ist.
 */
function qrEncode(text) {
    const bytes = qrUtf8Bytes(text);
    let ver = 0;
    let level = null;
    search:
    for (const lv of QR_LEVELS) {
        for (let v = 1; v <= QR_MAX_VERSION; v++) {
            const ccBits = v <= 9 ? 8 : 16;
            if (4 + ccBits + bytes.length * 8 <= qrDataCodewords(v, lv) * 8) {
                ver = v;
                level = lv;
                break search;
            }
        }
    }
    if (!level) throw new Error('QR: Text zu lang');

    // Bitstrom: Modus 0100 (Byte), Länge, Daten, Terminator, Padding
    const bits = [];
    const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    push(0x4, 4);
    push(bytes.length, ver <= 9 ? 8 : 16);
    bytes.forEach(b => push(b, 8));
    const capacity = qrDataCodewords(ver, level) * 8;
    push(0, Math.min(4, capacity - bits.length));
    push(0, (8 - (bits.length % 8)) % 8);
    for (let pad = 0xEC; bits.length < capacity; pad ^= 0xEC ^ 0x11) push(pad, 8);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) {
        let v = 0;
        for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
        data.push(v);
    }
    const codewords = qrInterleave(data, ver, level);

    const size = ver * 4 + 17;
    const modules = Array.from({ length: size }, () => new Array(size).fill(false));
    const isFn = Array.from({ length: size }, () => new Array(size).fill(false));
    const setFn = (x, y, dark) => {
        if (x < 0 || y < 0 || x >= size || y >= size) return;
        modules[y][x] = dark;
        isFn[y][x] = true;
    };

    // Timing-, Finder- und Alignment-Muster
    for (let i = 0; i < size; i++) {
        setFn(6, i, i % 2 === 0);
        setFn(i, 6, i % 2 === 0);
    }
    for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
        for (let dy = -4; dy <= 4; dy++) {
            for (let dx = -4; dx <= 4; dx++) {
                const dist = Math.max(Math.abs(dx), Math.abs(dy));
                setFn(cx + dx, cy + dy, dist !== 2 && dist !== 4);
            }
        }
    }
    const align = qrAlignPositions(ver);
    align.forEach((ax, i) => {
        align.forEach((ay, j) => {
            const corner = (i === 0 && j === 0) || (i === 0 && j === align.length - 1) || (i === align.length - 1 && j === 0);
            if (corner) return;
            for (let dy = -2; dy <= 2; dy++) {
                for (let dx = -2; dx <= 2; dx++) setFn(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
            }
        });
    });

    const drawFormat = (mask) => {
        const fdata = (level.fmt << 3) | mask;
        let rem = fdata;
        for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
        const fbits = ((fdata << 10) | rem) ^ 0x5412;
        for (let i = 0; i <= 5; i++) setFn(8, i, qrBit(fbits, i));
        setFn(8, 7, qrBit(fbits, 6));
        setFn(8, 8, qrBit(fbits, 7));
        setFn(7, 8, qrBit(fbits, 8));
        for (let i = 9; i < 15; i++) setFn(14 - i, 8, qrBit(fbits, i));
        for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, qrBit(fbits, i));
        for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, qrBit(fbits, i));
        setFn(8, size - 8, true);
    };
    drawFormat(0); // reserviert die Bereiche, wird nach der Maskenwahl überschrieben

    if (ver >= 7) {
        let rem = ver;
        for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
        const vbits = (ver << 12) | rem;
        for (let i = 0; i < 18; i++) {
            const a = size - 11 + (i % 3);
            const b = Math.floor(i / 3);
            setFn(a, b, qrBit(vbits, i));
            setFn(b, a, qrBit(vbits, i));
        }
    }

    // Codewörter im Zickzack einzeichnen
    let bitIdx = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5;
        for (let vert = 0; vert < size; vert++) {
            for (let j = 0; j < 2; j++) {
                const x = right - j;
                const upward = ((right + 1) & 2) === 0;
                const y = upward ? size - 1 - vert : vert;
                if (!isFn[y][x] && bitIdx < codewords.length * 8) {
                    modules[y][x] = qrBit(codewords[bitIdx >>> 3], 7 - (bitIdx & 7));
                    bitIdx++;
                }
            }
        }
    }

    const applyMask = (mask) => {
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                if (!isFn[y][x] && QR_MASKS[mask](x, y)) modules[y][x] = !modules[y][x];
            }
        }
    };
    let bestMask = 0;
    let bestScore = Infinity;
    for (let mask = 0; mask < 8; mask++) {
        applyMask(mask);
        drawFormat(mask);
        const score = qrPenalty(modules, size);
        if (score < bestScore) { bestScore = score; bestMask = mask; }
        applyMask(mask); // XOR macht die Maske rückgängig
    }
    applyMask(bestMask);
    drawFormat(bestMask);
    return { size, version: ver, modules };
}

/** QR-Matrix als SVG-String (mit Ruhezone). Farben nur als einfache Hex-Werte. */
function qrToSvg(qr, border = 4, dark = '#000000', light = '#ffffff') {
    const safe = (c, fb) => (/^#[0-9a-fA-F]{3,8}$/.test(c) ? c : fb);
    const dim = qr.size + border * 2;
    let path = '';
    for (let y = 0; y < qr.size; y++) {
        for (let x = 0; x < qr.size; x++) {
            if (qr.modules[y][x]) path += `M${x + border},${y + border}h1v1h-1z`;
        }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges" role="img" aria-label="QR-Code">` +
        `<rect width="${dim}" height="${dim}" fill="${safe(light, '#ffffff')}"/>` +
        `<path d="${path}" fill="${safe(dark, '#000000')}"/></svg>`;
}
