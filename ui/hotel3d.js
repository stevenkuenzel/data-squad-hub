/**
 * DataSquad Hub UI: Hotel-Tycoon – Darstellung (3D mit three.js, 2D-Karte als Rückfall)
 * Klassisches Script. Liest ausschließlich Snapshots (siehe games/hotel.js), enthält keine Spielregeln.
 * three.min.js wird erst beim ersten Hotel-Spiel nachgeladen (loadThree()).
 */

// ==========================================
// GEOMETRIE (gemeinsam für 3D und 2D)
// Raster 9×9, die 32 Randfelder bilden den Ring, Einheit = Feld. Feldmitten liegen auf ganzen Zahlen.
// ==========================================
const HOTEL_GRID = 9;
const HOTEL_FIELD_COUNT_UI = 32;
const HOTEL_TILE_COLORS = {
    start: '#b7c2d0', freeentry: '#9fd8b3', bank: '#f2d46b', townhall: '#d6a98a',
    permit: '#e1e4ea', freebuild: '#f0c27a'
};
const HOTEL_LOT_COLORS = ['#7fc8a9', '#79c0d6', '#8aa7e0', '#b394e0', '#e08ac4', '#e6908a', '#e8b15f', '#e6d35f'];
const HOTEL_FIELD_ICONS = {
    start: ['🅿️', 'START'], freeentry: ['🎟️', 'FREI'], bank: ['🏦', 'BANK'], townhall: ['🏛️', 'RATHAUS'],
    permit: ['📋', 'PLANUNG'], freebuild: ['🏗️', 'BAUEN']
};

// Rasterposition (Feldmitte) eines Randfeldes
function hotelFieldGrid(i) {
    const s = Math.floor(i / 8);
    const k = i % 8;
    switch (s) {
        case 0: return { x: k, z: 0 };
        case 1: return { x: 8, z: k };
        case 2: return { x: 8 - k, z: 8 };
        default: return { x: 0, z: 8 - k };
    }
}

// Kantenkoordinaten (k entlang der Seite, depth nach innen) -> Raster
function hotelSideToGrid(side, k, depth) {
    switch (side) {
        case 0: return { x: k, z: depth };
        case 1: return { x: 8 - depth, z: k };
        case 2: return { x: 8 - k, z: 8 - depth };
        default: return { x: depth, z: 8 - k };
    }
}

// Lage des Bauplatzes eines Grundstücks. Die Plätze der beiden Nachbarn an einer Ecke rücken zur Seitenmitte,
// damit sie sich nicht überschneiden.
function hotelLotLayout(lotId) {
    const side = Math.floor(lotId / 2);
    const half = lotId % 2;
    const k = half === 0 ? 2.9 : 5.1;
    const c = hotelSideToGrid(side, k, 1.65);
    return { side, cx: c.x, cz: c.z, along: 1.5, depth: 1.4 };
}

// Lichte Farbe etwas aufhellen/abdunkeln
function hotelShade(hex, amount) {
    const n = parseInt(String(hex).replace('#', ''), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v + amount * 255)));
    const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

function hotelStars(n) {
    return n > 0 ? '★'.repeat(n) : '';
}

// ==========================================
// three.js nachladen (lazy)
// ==========================================
let hotelThreePromise = null;
function loadThree() {
    if (window.THREE) return Promise.resolve(window.THREE);
    if (hotelThreePromise) return hotelThreePromise;
    hotelThreePromise = new Promise((resolve, reject) => {
        const el = document.createElement('script');
        el.src = 'three.min.js';
        el.onload = () => (window.THREE ? resolve(window.THREE) : reject(new Error('THREE fehlt')));
        el.onerror = () => { hotelThreePromise = null; reject(new Error('three.min.js nicht ladbar')); };
        document.head.appendChild(el);
    });
    return hotelThreePromise;
}

function hotelWebGLAvailable() {
    try {
        const c = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch {
        return false;
    }
}

function hotelReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

// ==========================================
// 3D-SZENE
// ==========================================
class HotelScene {
    constructor(host, opts = {}) {
        const THREE = window.THREE;
        this.T = THREE;
        this.host = host;
        this.onSlow = opts.onSlow || (() => {});
        this.TILE = 3;
        this.follow = opts.follow !== false;
        this.reduced = hotelReducedMotion();
        this.coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

        this.renderer = new THREE.WebGLRenderer({ antialias: !this.coarse, alpha: false, powerPreference: 'high-performance' });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.shadowMap.enabled = !this.coarse;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.canvas = this.renderer.domElement;
        this.canvas.className = 'hotel-canvas-3d';
        this.canvas.style.touchAction = 'none';
        host.appendChild(this.canvas);

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x9fd4f5);
        this.scene.fog = new THREE.Fog(0x9fd4f5, 55, 120);

        this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 300);
        this.cam = { az: 0.62, polar: 0.95, radius: 46, target: new THREE.Vector3(), goal: new THREE.Vector3() };

        this.lots = [];
        this.pawns = new Map();
        this.pendingSeq = { move: 0, dice: 0 };
        this.snap = null;
        this.running = false;
        this.frameTimes = [];
        this.slowChecked = false;
        this.clock = new THREE.Clock();
        this.disposed = false;

        this.buildLights();
        this.buildGround();
        this.buildBoard();
        this.buildLots();
        this.buildDice();
        this.bindControls();
        this.resize();
        this._onResize = () => this.resize();
        window.addEventListener('resize', this._onResize);
        if (typeof ResizeObserver !== 'undefined') {
            this._ro = new ResizeObserver(() => this.resize());
            this._ro.observe(host);
        }
        this._onVisibility = () => { if (document.hidden) this.stop(); else this.start(); };
        document.addEventListener('visibilitychange', this._onVisibility);
    }

    // ---------- Aufbau ----------
    mesh(geo, color, x = 0, y = 0, z = 0, opts = {}) {
        const THREE = this.T;
        const mat = opts.mat || new THREE.MeshLambertMaterial({ color });
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x, y, z);
        m.castShadow = opts.cast !== false && !opts.flat;
        m.receiveShadow = opts.receive !== false;
        return m;
    }

    box(w, h, d, color, x, y, z, opts) {
        return this.mesh(new this.T.BoxGeometry(w, h, d), color, x, y, z, opts);
    }

    buildLights() {
        const THREE = this.T;
        this.scene.add(new THREE.HemisphereLight(0xffffff, 0x6f9b62, 0.85));
        const sun = new THREE.DirectionalLight(0xfff2d6, 0.75);
        sun.position.set(-18, 34, 14);
        if (this.renderer.shadowMap.enabled) {
            sun.castShadow = true;
            sun.shadow.mapSize.set(1024, 1024);
            const c = sun.shadow.camera;
            c.left = -26; c.right = 26; c.top = 26; c.bottom = -26; c.near = 5; c.far = 90;
            sun.shadow.bias = -0.0008;
        }
        this.scene.add(sun);
    }

    buildGround() {
        const THREE = this.T;
        const T = this.TILE;
        const ground = this.mesh(new THREE.CircleGeometry(120, 48), 0x7fbf6a, 0, -0.35, 0, { cast: false });
        ground.rotation.x = -Math.PI / 2;
        this.scene.add(ground);
        // Sockel unter dem Brett
        const span = HOTEL_GRID * T + 1.2;
        this.scene.add(this.box(span, 0.5, span, 0xd8dde6, 0, -0.1, 0, { cast: false }));
        // Innenhof (Rasen) + Mittelplatz
        const yard = this.box(span - 2 * T - 0.4, 0.12, span - 2 * T - 0.4, 0x8fd07a, 0, 0.2, 0, { cast: false });
        this.scene.add(yard);
        const plaza = this.mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.16, 40), 0xe9e4d6, 0, 0.3, 0, { cast: false });
        this.scene.add(plaza);

        // Bäume und Büsche außerhalb des Rings (deterministisch)
        let seed = 7;
        const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
        const trunkGeo = new THREE.CylinderGeometry(0.18, 0.26, 1.2, 6);
        const crownGeo = new THREE.ConeGeometry(1, 2.6, 7);
        const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
        const crownMats = [0x2f7d3a, 0x3b9147, 0x2a6f35].map(c => new THREE.MeshLambertMaterial({ color: c }));
        for (let i = 0; i < 46; i++) {
            const ang = rnd() * Math.PI * 2;
            const r = 20 + rnd() * 22;
            const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
            if (Math.abs(x) < 19 && Math.abs(z) < 19) continue;
            const s = 0.8 + rnd() * 0.9;
            const g = new THREE.Group();
            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            trunk.position.y = 0.45;
            const crown = new THREE.Mesh(crownGeo, crownMats[i % 3]);
            crown.position.y = 2.1;
            crown.castShadow = true;
            g.add(trunk, crown);
            g.scale.setScalar(s);
            g.position.set(x, -0.3, z);
            this.scene.add(g);
        }
        // Ein paar Hügel
        for (let i = 0; i < 6; i++) {
            const ang = i * 1.1 + 0.4;
            const hill = this.mesh(new THREE.SphereGeometry(7 + (i % 3) * 2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0x6aae5a, Math.cos(ang) * 58, -0.35, Math.sin(ang) * 58, { cast: false });
            this.scene.add(hill);
        }
    }

    textTexture(lines, opts = {}) {
        const THREE = this.T;
        const w = opts.w || 256, h = opts.h || 256;
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const tex = new THREE.CanvasTexture(c);
        tex.anisotropy = 4;
        tex._canvas = c;
        return tex;
    }

    paintFieldDecal(tex, bg, icon, label) {
        const c = tex._canvas;
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 8;
        ctx.strokeRect(4, 4, c.width - 8, c.height - 8);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#1b2233';
        ctx.font = '110px sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon, c.width / 2, c.height * 0.42);
        ctx.font = 'bold 40px sans-serif';
        ctx.fillText(label, c.width / 2, c.height * 0.8);
        tex.needsUpdate = true;
    }

    buildBoard() {
        const THREE = this.T;
        const T = this.TILE;
        this.tileGroup = new THREE.Group();
        this.fieldPos = [];
        for (let i = 0; i < HOTEL_FIELD_COUNT_UI; i++) {
            const f = HOTEL_FIELDS[i];
            const g = hotelFieldGrid(i);
            const x = (g.x - 4) * T, z = (g.z - 4) * T;
            this.fieldPos.push(new THREE.Vector3(x, 0.45, z));
            const isLot = f.type === 'lot';
            const color = isLot ? HOTEL_LOT_COLORS[f.lot] : HOTEL_TILE_COLORS[f.type];
            const tile = this.box(T * 0.96, 0.26, T * 0.96, color, x, 0.2, z, { cast: false });
            this.tileGroup.add(tile);
            if (!isLot) {
                const [icon, label] = HOTEL_FIELD_ICONS[f.type];
                const tex = this.textTexture([], { w: 192, h: 192 });
                this.paintFieldDecal(tex, color, icon, label);
                const decal = new THREE.Mesh(new THREE.PlaneGeometry(T * 0.9, T * 0.9), new THREE.MeshBasicMaterial({ map: tex }));
                decal.rotation.x = -Math.PI / 2;
                decal.position.set(x, 0.34, z);
                this.tileGroup.add(decal);
            }
        }
        this.scene.add(this.tileGroup);
    }

    makeLabel(w, h) {
        const THREE = this.T;
        const c = document.createElement('canvas');
        c.width = 256; c.height = 96;
        const tex = new THREE.CanvasTexture(c);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
        sprite.scale.set(w, h, 1);
        sprite._canvas = c;
        sprite._tex = tex;
        sprite._key = '';
        return sprite;
    }

    paintLabel(sprite, key, title, sub, accent) {
        if (sprite._key === key) return;
        sprite._key = key;
        const c = sprite._canvas;
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, c.width, c.height);
        const r = 18;
        ctx.fillStyle = 'rgba(12,16,28,0.88)';
        ctx.strokeStyle = accent;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(r, 4); ctx.lineTo(c.width - r, 4); ctx.quadraticCurveTo(c.width - 4, 4, c.width - 4, r);
        ctx.lineTo(c.width - 4, c.height - r); ctx.quadraticCurveTo(c.width - 4, c.height - 4, c.width - r, c.height - 4);
        ctx.lineTo(r, c.height - 4); ctx.quadraticCurveTo(4, c.height - 4, 4, c.height - r);
        ctx.lineTo(4, r); ctx.quadraticCurveTo(4, 4, r, 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        let size = 34;
        ctx.font = `bold ${size}px sans-serif`;
        while (ctx.measureText(title).width > c.width - 24 && size > 18) {
            size -= 2;
            ctx.font = `bold ${size}px sans-serif`;
        }
        ctx.fillText(title, c.width / 2, 34);
        ctx.fillStyle = '#ffd94a';
        ctx.font = 'bold 32px sans-serif';
        ctx.fillText(sub, c.width / 2, 68);
        sprite._tex.needsUpdate = true;
    }

    buildLots() {
        const THREE = this.T;
        const T = this.TILE;
        for (let id = 0; id < HOTEL_LOTS.length; id++) {
            const lay = hotelLotLayout(id);
            const group = new THREE.Group();
            const wx = (lay.cx - 4) * T, wz = (lay.cz - 4) * T;
            group.position.set(wx, 0.28, wz);
            group.rotation.y = -lay.side * Math.PI / 2;
            const w = lay.along * T, d = lay.depth * T;
            const pad = this.box(w, 0.2, d, 0xcfd6c4, 0, 0.1, 0, { cast: false });
            group.add(pad);
            const building = new THREE.Group();
            group.add(building);
            const label = this.makeLabel(5.2, 1.95);
            label.position.set(0, 5.6, 0);
            group.add(label);
            this.scene.add(group);

            // Tore: ein Bogen pro Feld des Grundstücks (nur bei Eingang sichtbar)
            const gates = [];
            for (let slot = 0; slot < 3; slot++) {
                const fg = hotelFieldGrid(HOTEL_LOTS[id].fields[slot]);
                const inward = hotelSideToGrid(lay.side, 0, 1);
                const origin = hotelSideToGrid(lay.side, 0, 0);
                const dirX = inward.x - origin.x, dirZ = inward.z - origin.z;
                const gate = new THREE.Group();
                gate.position.set((fg.x - 4) * T + dirX * T * 0.36, 0.33, (fg.z - 4) * T + dirZ * T * 0.36);
                gate.rotation.y = -lay.side * Math.PI / 2;
                gate.visible = false;
                this.scene.add(gate);
                gates.push(gate);
            }
            this.lots.push({ id, group, building, label, gates, pad, lay, key: '', w, d });
        }
    }

    // Gebäude je Ausbaustufe (lokal: x entlang der Kante, z Richtung Hof, y nach oben)
    rebuildBuilding(lot, owner, stage, ownerColor) {
        const THREE = this.T;
        const b = lot.building;
        while (b.children.length) {
            const ch = b.children.pop();
            b.remove(ch);
            if (ch.geometry) ch.geometry.dispose();
        }
        if (stage <= 0) return;
        const tint = hotelShade(ownerColor || '#cccccc', 0.05);
        const wall = 0xf3ead8;
        const base = 0.2;
        const add = (m) => { b.add(m); return m; };
        // Hauptgebäude (Stufe 1)
        const mainH = 2.6 + (stage >= 5 ? 1.2 : 0);
        add(this.box(1.9, mainH, 1.9, wall, -0.9, base + mainH / 2, 0.1));
        add(this.box(2.1, 0.3, 2.1, tint, -0.9, base + mainH + 0.15, 0.1));
        this.addWindows(b, -0.9, base, 0.1, 1.9, mainH, 1.9);
        if (stage >= 2) { // Seitenflügel
            add(this.box(1.5, 1.8, 1.9, wall, 0.95, base + 0.9, 0.1));
            add(this.box(1.7, 0.25, 2.1, tint, 0.95, base + 1.92, 0.1));
            this.addWindows(b, 0.95, base, 0.1, 1.5, 1.8, 1.9);
        }
        if (stage >= 3) { // Konferenzsaal / Lobby zur Straße
            add(this.box(3.6, 0.8, 0.8, 0xdfe6ee, 0, base + 0.4, -1.45));
            add(this.box(3.8, 0.15, 1.0, tint, 0, base + 0.88, -1.45));
        }
        if (stage >= 4) { // Wellnessbereich (Kuppel)
            add(this.mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.6, 20), 0xdff3f7, 1.35, base + 0.3, 1.35));
            add(this.mesh(new THREE.SphereGeometry(0.75, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0x9fd8e8, 1.35, base + 0.6, 1.35));
        }
        if (stage >= 5) { // Dachterrasse + Pool, goldene Krone
            add(this.box(1.5, 0.08, 1.0, 0x3aa7e8, -1.3, base + 0.06, 1.35, { cast: false }));
            add(this.box(1.6, 0.14, 1.1, 0xffffff, -1.3, base + 0.02, 1.35, { cast: false }));
            add(this.box(1.0, 0.7, 1.0, 0xffd34a, -0.9, base + mainH + 0.65, 0.1));
        }
    }

    addWindows(group, cx, base, cz, w, h, d) {
        const mat = new this.T.MeshLambertMaterial({ color: 0x4a6a8f });
        const rows = Math.max(1, Math.floor((h - 0.5) / 0.75));
        for (let r = 0; r < rows; r++) {
            for (let c = -1; c <= 1; c += 2) {
                for (const face of [1, -1]) {
                    const win = new this.T.Mesh(new this.T.BoxGeometry(0.34, 0.38, 0.04), mat);
                    win.position.set(cx + c * (w * 0.22), base + 0.7 + r * 0.75, cz + face * (d / 2 + 0.02));
                    group.add(win);
                }
            }
        }
    }

    rebuildGate(gate, color) {
        const THREE = this.T;
        while (gate.children.length) {
            const ch = gate.children.pop();
            gate.remove(ch);
            if (ch.geometry) ch.geometry.dispose();
        }
        const mat = new THREE.MeshLambertMaterial({ color });
        const pillarGeo = new THREE.BoxGeometry(0.22, 1.5, 0.22);
        const l = new THREE.Mesh(pillarGeo, mat), r = new THREE.Mesh(pillarGeo, mat);
        l.position.set(-0.8, 0.75, 0); r.position.set(0.8, 0.75, 0);
        const top = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.28, 0.3), mat);
        top.position.set(0, 1.55, 0);
        l.castShadow = r.castShadow = top.castShadow = true;
        gate.add(l, r, top);
    }

    updateLots(snap) {
        const byId = new Map(snap.players.map(p => [p.id, p]));
        for (const l of snap.lots) {
            const lot = this.lots[l.id];
            const owner = l.owner ? byId.get(l.owner) : null;
            const key = [l.owner, l.stage, l.ent.join(''), owner ? owner.color : ''].join('|');
            if (lot.key === key) continue;
            lot.key = key;
            const color = owner ? owner.color : null;
            lot.pad.material.color.set(color ? hotelShade(color, 0.28) : '#cfd6c4');
            this.rebuildBuilding(lot, owner, l.stage, color);
            const def = HOTEL_LOTS[l.id];
            if (owner) {
                this.paintLabel(lot.label, 'o' + key, def.name, l.stage > 0 ? hotelStars(l.stage) : 'Grundstück', color);
                lot.label.position.y = 1.9 + (l.stage > 0 ? 2.8 + (l.stage >= 5 ? 1.2 : 0) : 0);
            } else {
                this.paintLabel(lot.label, 'f' + key, def.name, def.price.toLocaleString('de-DE') + ' €', '#8b9bb4');
                lot.label.position.y = 2.2;
            }
            lot.gates.forEach((gate, slot) => {
                const show = !!owner && l.stage >= 1 && l.ent[slot];
                gate.visible = show;
                if (show) this.rebuildGate(gate, color);
            });
        }
    }

    // ---------- Würfel ----------
    buildDice() {
        const THREE = this.T;
        // Materialindex -> Augenzahl (BoxGeometry: +x, -x, +y, -y, +z, -z; gegenüber summiert 7)
        const order = [3, 4, 1, 6, 2, 5];
        const mats = order.map(v => {
            const c = document.createElement('canvas');
            c.width = c.height = 128;
            const ctx = c.getContext('2d');
            ctx.fillStyle = '#fbfbf5';
            ctx.fillRect(0, 0, 128, 128);
            ctx.strokeStyle = '#c9c9bd';
            ctx.lineWidth = 6;
            ctx.strokeRect(3, 3, 122, 122);
            ctx.fillStyle = v === 1 ? '#d6212d' : '#161a24';
            const P = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]] }[v];
            for (const [px, py] of P) {
                ctx.beginPath();
                ctx.arc(30 + px * 34, 30 + py * 34, v === 1 ? 17 : 11, 0, Math.PI * 2);
                ctx.fill();
            }
            const tex = new THREE.CanvasTexture(c);
            return new THREE.MeshLambertMaterial({ map: tex });
        });
        const die = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), mats);
        die.castShadow = true;
        die.position.set(0, 1.1, 0);
        this.scene.add(die);
        this.dice = { mesh: die, t: 99, dur: 1.5, value: 1, axis: new THREE.Vector3(1, 0, 0), spin: 0, target: new THREE.Quaternion(), startQ: null };
        this.dice.target = this.diceTarget(1, 0);
        die.quaternion.copy(this.dice.target);
    }

    diceTarget(value, yaw) {
        const THREE = this.T;
        const normals = { 1: [0, 1, 0], 6: [0, -1, 0], 2: [0, 0, 1], 5: [0, 0, -1], 3: [1, 0, 0], 4: [-1, 0, 0] };
        const n = new THREE.Vector3(...normals[value]);
        const q = new THREE.Quaternion().setFromUnitVectors(n, new THREE.Vector3(0, 1, 0));
        const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        return qy.multiply(q);
    }

    throwDice(value, animate) {
        const THREE = this.T;
        const d = this.dice;
        d.value = value;
        d.target = this.diceTarget(value, Math.random() * Math.PI * 2);
        if (!animate || this.reduced) {
            d.t = 99;
            d.mesh.position.set(0, 1.1, 0);
            d.mesh.quaternion.copy(d.target);
            return;
        }
        d.t = 0;
        d.dur = 1.45;
        d.axis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        d.spin = Math.PI * (7 + Math.random() * 3);
        d.startPos = new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3);
    }

    updateDice(dt) {
        const THREE = this.T;
        const d = this.dice;
        if (d.t > d.dur) return;
        d.t += dt;
        const u = Math.min(1, d.t / d.dur);
        const rest = 1.1;
        const bounce = Math.abs(Math.cos(u * Math.PI * 3.5)) * 5.2 * Math.pow(1 - u, 2);
        d.mesh.position.set(d.startPos.x * (1 - u), rest + bounce, d.startPos.z * (1 - u));
        const angle = Math.pow(1 - u, 2) * d.spin;
        const qs = new THREE.Quaternion().setFromAxisAngle(d.axis, angle);
        d.mesh.quaternion.copy(d.target).premultiply(qs);
    }

    // ---------- Autos ----------
    makeCar(color) {
        const THREE = this.T;
        const g = new THREE.Group();
        const body = this.box(1.9, 0.5, 1.0, color, 0, 0.5, 0);
        const cabin = this.box(1.0, 0.45, 0.86, hotelShade(color, 0.18), -0.1, 0.97, 0);
        const glass = this.box(1.02, 0.28, 0.9, 0x233248, -0.1, 1.0, 0, { cast: false });
        g.add(body, cabin, glass);
        const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.2, 12);
        const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1b1b1f });
        for (const sx of [-0.62, 0.62]) {
            for (const sz of [-0.5, 0.5]) {
                const w = new THREE.Mesh(wheelGeo, wheelMat);
                w.rotation.x = Math.PI / 2;
                w.position.set(sx, 0.28, sz);
                g.add(w);
            }
        }
        g.add(this.box(0.12, 0.16, 0.3, 0xfff3b0, 0.96, 0.52, -0.3, { cast: false }), this.box(0.12, 0.16, 0.3, 0xfff3b0, 0.96, 0.52, 0.3, { cast: false }));
        g.scale.setScalar(0.62);
        return g;
    }

    pawnOffset(index) {
        const T = this.TILE;
        // 3 × 2 Stellplätze pro Feld, damit auch alle Autos auf dem Start nebeneinander passen
        return new this.T.Vector3(((index % 3) - 1) * T * 0.34, 0, (Math.floor(index / 3) - 0.5) * T * 0.4);
    }

    tilePoint(i, index) {
        return this.fieldPos[i].clone().add(this.pawnOffset(index));
    }

    syncPawns(snap) {
        const ids = new Set(snap.players.map(p => p.id));
        for (const [id, pawn] of this.pawns) {
            if (!ids.has(id)) { this.scene.remove(pawn.obj); this.pawns.delete(id); }
        }
        snap.players.forEach((p, idx) => {
            let pawn = this.pawns.get(p.id);
            if (!pawn) {
                const obj = this.makeCar(p.color);
                const pos = this.tilePoint(p.pos, idx);
                obj.position.copy(pos);
                this.faceAlong(obj, p.pos);
                this.scene.add(obj);
                pawn = { obj, index: idx, path: [], seg: 0, segT: 0, cell: p.pos, color: p.color };
                this.pawns.set(p.id, pawn);
            }
            pawn.index = idx;
            pawn.obj.visible = p.alive;
            if (pawn.color !== p.color) {
                pawn.color = p.color;
                this.scene.remove(pawn.obj);
                const pos = pawn.obj.position.clone();
                pawn.obj = this.makeCar(p.color);
                pawn.obj.position.copy(pos);
                this.scene.add(pawn.obj);
            }
            // Stand ohne Animation (Rejoin, neue Figur): direkt hinsetzen
            if (pawn.path.length === 0 && pawn.cell !== p.pos) {
                pawn.cell = p.pos;
                pawn.obj.position.copy(this.tilePoint(p.pos, idx));
                this.faceAlong(pawn.obj, p.pos);
            }
        });
        // Fahrt animieren, wenn eine neue Bewegung dazukam
        const lm = snap.lastMove;
        if (lm && lm.seq > this.pendingSeq.move) {
            const first = this.pendingSeq.move === 0 && !this.snap;
            this.pendingSeq.move = lm.seq;
            const pawn = this.pawns.get(lm.id);
            const pl = snap.players.find(p => p.id === lm.id);
            if (pawn && pl && !first) {
                if (pawn.path.length) pawn.path = []; // laufende Fahrt abbrechen, neue beginnt am Ausgangsfeld
                const path = [];
                let c = lm.from;
                while (c !== lm.to && path.length < 40) {
                    c = (c + 1) % HOTEL_FIELD_COUNT_UI;
                    path.push(c);
                }
                // Würfel-Animation abwarten, dann losfahren
                pawn.obj.position.copy(this.tilePoint(lm.from, pawn.index));
                pawn.cell = lm.from;
                pawn.path = path;
                pawn.seg = 0;
                pawn.segT = this.reduced ? 0 : -1.5;
            } else if (pawn && pl) {
                pawn.cell = pl.pos;
                pawn.obj.position.copy(this.tilePoint(pl.pos, pawn.index));
                this.faceAlong(pawn.obj, pl.pos);
            }
        }
    }

    faceAlong(obj, cell) {
        const a = this.fieldPos[cell];
        const b = this.fieldPos[(cell + 1) % HOTEL_FIELD_COUNT_UI];
        obj.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x);
    }

    updatePawns(dt) {
        for (const pawn of this.pawns.values()) {
            if (pawn.path.length === 0) continue;
            const SEG = this.reduced ? 0.001 : 0.22;
            pawn.segT += dt;
            if (pawn.segT < 0) continue;
            while (pawn.segT >= SEG && pawn.path.length > 0) {
                pawn.segT -= SEG;
                pawn.cell = pawn.path.shift();
                pawn.obj.position.copy(this.tilePoint(pawn.cell, pawn.index));
            }
            if (pawn.path.length === 0) {
                this.faceAlong(pawn.obj, pawn.cell);
                continue;
            }
            const from = this.tilePoint(pawn.cell, pawn.index);
            const to = this.tilePoint(pawn.path[0], pawn.index);
            const u = Math.max(0, pawn.segT / SEG);
            pawn.obj.position.lerpVectors(from, to, u);
            pawn.obj.position.y += Math.sin(u * Math.PI) * 0.45;
            const target = Math.atan2(-(to.z - from.z), to.x - from.x);
            let diff = target - pawn.obj.rotation.y;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            pawn.obj.rotation.y += diff * Math.min(1, dt * 14);
        }
    }

    // ---------- Zustand ----------
    setState(snap) {
        if (this.disposed) return;
        const first = !this.snap;
        this.updateLots(snap);
        this.syncPawns(snap);
        if (snap.dice && snap.dice.seq > this.pendingSeq.dice) {
            this.pendingSeq.dice = snap.dice.seq;
            this.throwDice(snap.dice.value, !first);
        } else if (first && snap.dice && snap.dice.value) {
            this.throwDice(snap.dice.value, false);
        }
        this.snap = snap;
        const cur = snap.players.find(p => p.id === snap.turnId);
        this.curPlayerId = cur ? cur.id : null;
        this.start();
    }

    setFollow(on) {
        this.follow = !!on;
    }

    // Weltposition eines Feldes als Bildschirmkoordinate im Host-Element
    fieldToScreen(i, lift = 2) {
        const v = this.fieldPos[i].clone();
        v.y += lift;
        v.project(this.camera);
        const w = this.host.clientWidth, h = this.host.clientHeight;
        return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, visible: v.z < 1 };
    }

    // ---------- Kamera ----------
    bindControls() {
        const el = this.canvas;
        const pointers = new Map();
        let lastPinch = 0;
        el.addEventListener('pointerdown', (e) => {
            el.setPointerCapture(e.pointerId);
            pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pointers.size === 2) {
                const [a, b] = Array.from(pointers.values());
                lastPinch = Math.hypot(a.x - b.x, a.y - b.y);
            }
        });
        el.addEventListener('pointermove', (e) => {
            const p = pointers.get(e.pointerId);
            if (!p) return;
            const dx = e.clientX - p.x, dy = e.clientY - p.y;
            p.x = e.clientX; p.y = e.clientY;
            if (pointers.size === 1) {
                this.cam.az -= dx * 0.0065;
                this.cam.polar = Math.max(0.3, Math.min(1.38, this.cam.polar - dy * 0.005));
            } else if (pointers.size === 2) {
                const [a, b] = Array.from(pointers.values());
                const dist = Math.hypot(a.x - b.x, a.y - b.y);
                if (lastPinch > 0) this.zoom(lastPinch / dist);
                lastPinch = dist;
            }
        });
        const end = (e) => { pointers.delete(e.pointerId); lastPinch = 0; };
        el.addEventListener('pointerup', end);
        el.addEventListener('pointercancel', end);
        el.addEventListener('pointerleave', end);
        el.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.zoom(e.deltaY > 0 ? 1.1 : 0.91);
        }, { passive: false });
    }

    zoom(factor) {
        this.cam.radius = Math.max(14, Math.min(70, this.cam.radius * factor));
    }

    updateCamera(dt) {
        const cam = this.cam;
        if (this.follow && this.curPlayerId && this.pawns.has(this.curPlayerId)) {
            const p = this.pawns.get(this.curPlayerId).obj.position;
            cam.goal.set(p.x * 0.7, 0, p.z * 0.7);
        } else {
            cam.goal.set(0, 0, 0);
        }
        const k = this.reduced ? 1 : Math.min(1, dt * 2.5);
        cam.target.lerp(cam.goal, k);
        const sp = Math.sin(cam.polar), cp = Math.cos(cam.polar);
        this.camera.position.set(
            cam.target.x + cam.radius * sp * Math.sin(cam.az),
            cam.target.y + cam.radius * cp,
            cam.target.z + cam.radius * sp * Math.cos(cam.az)
        );
        this.camera.lookAt(cam.target);
    }

    resize() {
        if (this.disposed) return;
        const w = Math.max(200, this.host.clientWidth);
        const h = Math.max(200, this.host.clientHeight);
        this.renderer.setSize(w, h, false);
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.camera.aspect = w / h;
        // schmale Hochkant-Ansichten: weiter rauszoomen
        this.camera.fov = w / h < 0.9 ? 54 : (w / h < 1.3 ? 46 : 40);
        this.camera.updateProjectionMatrix();
    }

    // ---------- Schleife ----------
    start() {
        if (this.running || this.disposed || document.hidden) return;
        this.running = true;
        this.clock.getDelta();
        const loop = () => {
            if (!this.running) return;
            requestAnimationFrame(loop);
            const view = this.host.closest('.game-view');
            if (view && !view.classList.contains('active')) {
                this.stop();
                return;
            }
            const dt = Math.min(0.05, this.clock.getDelta());
            this.updateDice(dt);
            this.updatePawns(dt);
            this.updateCamera(dt);
            this.renderer.render(this.scene, this.camera);
            this.checkPerformance(dt);
        };
        requestAnimationFrame(loop);
    }

    stop() {
        this.running = false;
    }

    checkPerformance(dt) {
        if (this.slowChecked) return;
        this.frameTimes.push(dt);
        if (this.frameTimes.length >= 90) {
            this.slowChecked = true;
            const sorted = this.frameTimes.slice(10).sort((a, b) => a - b);
            const median = sorted[Math.floor(sorted.length / 2)];
            // dt ist auf 50 ms begrenzt – ein Median über 45 ms heißt: unter ~22 fps
            if (median > 0.045) this.onSlow(median);
        }
    }

    destroy() {
        this.disposed = true;
        this.stop();
        window.removeEventListener('resize', this._onResize);
        document.removeEventListener('visibilitychange', this._onVisibility);
        if (this._ro) this._ro.disconnect();
        this.renderer.dispose();
        if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    }
}

// ==========================================
// 2D-RÜCKFALL (Draufsicht auf Canvas)
// ==========================================
class Hotel2D {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.cell = canvas.width / HOTEL_GRID;
        this.snap = null;
        this.pawnPos = new Map();
        this.dice = 0;
    }

    px(gx, gz) {
        return { x: (gx + 0.5) * this.cell, y: (gz + 0.5) * this.cell };
    }

    fieldToScreen(i) {
        const g = hotelFieldGrid(i);
        const p = this.px(g.x, g.z);
        const rect = this.canvas.getBoundingClientRect();
        const host = this.canvas.parentNode.getBoundingClientRect();
        return {
            x: rect.left - host.left + p.x * (rect.width / this.canvas.width),
            y: rect.top - host.top + p.y * (rect.height / this.canvas.height),
            visible: true
        };
    }

    setState(snap) {
        this.snap = snap;
        this.draw();
    }

    draw() {
        const snap = this.snap;
        const ctx = this.ctx;
        const c = this.cell;
        ctx.fillStyle = '#7fbf6a';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = '#8fd07a';
        ctx.fillRect(c * 1.1, c * 1.1, c * 6.8, c * 6.8);
        const owners = new Map();
        if (snap) snap.players.forEach(p => owners.set(p.id, p));

        for (let i = 0; i < HOTEL_FIELD_COUNT_UI; i++) {
            const f = HOTEL_FIELDS[i];
            const g = hotelFieldGrid(i);
            const color = f.type === 'lot' ? HOTEL_LOT_COLORS[f.lot] : HOTEL_TILE_COLORS[f.type];
            ctx.fillStyle = color;
            ctx.fillRect(g.x * c + 2, g.z * c + 2, c - 4, c - 4);
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.strokeRect(g.x * c + 2, g.z * c + 2, c - 4, c - 4);
            if (f.type !== 'lot') {
                const [icon, label] = HOTEL_FIELD_ICONS[f.type];
                const p = this.px(g.x, g.z);
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#1b2233';
                ctx.font = `${Math.round(c * 0.4)}px sans-serif`;
                ctx.fillText(icon, p.x, p.y - c * 0.1);
                ctx.font = `bold ${Math.round(c * 0.13)}px sans-serif`;
                ctx.fillText(label, p.x, p.y + c * 0.3);
            }
        }

        // Grundstücke
        for (let id = 0; id < HOTEL_LOTS.length; id++) {
            const lay = hotelLotLayout(id);
            const ls = snap ? snap.lots[id] : { owner: null, stage: 0, ent: [false, false, false] };
            const swap = lay.side % 2 === 1;
            const w = (swap ? lay.depth : lay.along) * c, h = (swap ? lay.along : lay.depth) * c;
            const p = this.px(lay.cx, lay.cz);
            const owner = ls.owner ? owners.get(ls.owner) : null;
            ctx.fillStyle = owner ? hotelShade(owner.color, 0.3) : '#d9dfcf';
            ctx.strokeStyle = owner ? owner.color : '#8b9bb4';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.rect(p.x - w / 2, p.y - h / 2, w, h);
            ctx.fill();
            ctx.stroke();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#10131c';
            ctx.font = `bold ${Math.round(c * 0.14)}px sans-serif`;
            ctx.fillText(HOTEL_LOTS[id].name, p.x, p.y - c * 0.18);
            ctx.font = `${Math.round(c * 0.2)}px sans-serif`;
            ctx.fillStyle = ls.stage > 0 ? '#a77400' : '#3a4256';
            ctx.fillText(ls.stage > 0 ? hotelStars(ls.stage) : String(HOTEL_LOTS[id].price), p.x, p.y + c * 0.18);
            // Eingänge als Punkte auf den Randfeldern
            HOTEL_LOTS[id].fields.forEach((fi, slot) => {
                if (!owner || ls.stage < 1 || !ls.ent[slot]) return;
                const g = hotelFieldGrid(fi);
                const q = this.px(g.x, g.z);
                ctx.fillStyle = owner.color;
                ctx.beginPath();
                ctx.arc(q.x, q.y + (g.z === 0 ? c * 0.3 : g.z === 8 ? -c * 0.3 : 0) + 0, c * 0.1, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        // Würfel in der Mitte
        const mid = this.px(4, 4);
        ctx.fillStyle = '#fbfbf5';
        ctx.strokeStyle = '#161a24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.rect(mid.x - c * 0.5, mid.y - c * 0.5, c, c);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#161a24';
        ctx.font = `bold ${Math.round(c * 0.7)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(snap && snap.dice && snap.dice.value ? String(snap.dice.value) : '·', mid.x, mid.y + 2);

        // Figuren
        if (snap) {
            snap.players.forEach((p, idx) => {
                if (!p.alive) return;
                const g = hotelFieldGrid(p.pos);
                const base = this.px(g.x, g.z);
                const ox = ((idx % 3) - 1) * c * 0.24, oy = (Math.floor(idx / 3) - 0.5) * c * 0.3;
                ctx.fillStyle = p.color;
                ctx.strokeStyle = p.id === snap.turnId ? '#ffffff' : '#10131c';
                ctx.lineWidth = p.id === snap.turnId ? 5 : 3;
                ctx.beginPath();
                ctx.arc(base.x + ox, base.y + oy, c * 0.15, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            });
        }
    }
}

window.HotelScene = HotelScene;
window.Hotel2D = Hotel2D;
