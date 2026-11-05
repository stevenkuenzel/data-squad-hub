# 🛠️ DataSquad Hub: Leitfaden zur Implementierung neuer Spiele

> **Entwickler-Handbuch & Architektur-Checkliste**  
> Basierend auf den Erkenntnissen und der P2P-WebRTC-Architektur von *DataSquad Hub* (erstellt von Jimmy).

---

## 📑 Inhaltsverzeichnis
1. [Architektur-Übersicht](#1-architektur-übersicht)
2. [Checkliste: Neues Spiel in 8 Schritten](#2-checkliste-neues-spiel-in-8-schritten)
3. [Kritische Fallstricke & Best Practices (Lessons Learned)](#3-kritische-fallstricke--best-practices-lessons-learned)
   - [WebRTC & Host-Authoritative State](#a-webrtc--host-authoritative-state)
   - [Physik & Tunneling-Vermeidung (Sub-Stepping)](#b-physik--tunneling-vermeidung-sub-stepping)
   - [Bot-KI & Rate-Limiting](#c-bot-ki--rate-limiting)
   - [Rollen-Isolation & Datensicherheit](#d-rollen-isolation--datensicherheit)
   - [Mobile Touch-Steuerung & Responsive Skalierung](#e-mobile-touch-steuerung--responsive-skalierung)
   - [Audio-Synthese ohne externe Assets](#f-audio-synthese-ohne-externe-assets)
   - [Automatisierte Tests](#g-automatisierte-tests)
4. [Deployment & GitHub Pages Richtlinien](#4-deployment--github-pages-richtlinien)

---

## 1. Architektur-Übersicht

DataSquad Hub läuft **vollständig serverlos auf GitHub Pages**. Es gibt kein Node.js- oder WebSocket-Backend im Live-Betrieb.

```
                  ┌─────────────────────────────────────────┐
                  │          HOST (Erster Spieler)          │
                  │  - Führt Spiel-Engine autoritativ aus   │
                  │  - Berechnet Physik, Kollisionen, Bots  │
                  │  - Verteilt State-Snapshots (20-30 Hz)  │
                  └───────────────▲─────────────────────────┘
                                  │
                 WebRTC DataChannels (P2P Mesh / Star)
                                  │
            ┌─────────────────────┴─────────────────────┐
            │                                           │
 ┌──────────▼──────────┐                     ┌──────────▼──────────┐
 │  CLIENT 1 (Gast)    │                     │  CLIENT 2 (Gast)    │
 │ - Sendet Inputs     │                     │ - Sendet Inputs     │
 │ - Rendert Snapshots │                     │ - Rendert Snapshots │
 └─────────────────────┘                     └─────────────────────┘
```

* **Signaling:** Erfolgt über PeerJS (`peerjs.min.js` liegt lokal im Repo, keine externen CDNs!).
* **Routing:** URL-Parameter `?game=<gameType>&room=<codeShort>` führen Gäste direkt in das richtige Spiel, ohne manuelle Auswahl.
* **Corporate Safe:** Keine externen Video-/Audio-/CDN-Domains, neutrale Bezeichnungen, um Firmen-Webfilter (Zscaler, Fortinet) nicht zu triggern.

---

## 2. Checkliste: Neues Spiel in 8 Schritten

### Schritt 1: Game Engine Datei anlegen (`games/<meinspiel>.js`)
Erstelle eine eigenständige Klasse mit klar getrenntem State:
```javascript
class MeinNeuesSpiel {
    constructor() {
        this.players = new Map();
        this.status = 'LOBBY'; // LOBBY, PLAYING, ROUND_OVER, GAME_OVER
    }

    addPlayer(id, name, color, isBot = false) { /* ... */ }
    removePlayer(id) { /* ... */ }
    setInput(playerId, inputData) { /* ... */ }
    
    // Autoritatives Update (nur Host führt dies aus!)
    update(dt) { /* ... */ }

    // Snapshot für Netzwerk-Sync generieren
    getSnapshot(forPlayerId = null) {
        return {
            status: this.status,
            players: Array.from(this.players.values()).map(p => ({ ... }))
        };
    }

    // Client-seitiges Anwenden des Snapshots
    applySnapshot(snap) { /* ... */ }
}

window.MeinNeuesSpiel = MeinNeuesSpiel;
```

### Schritt 2: DOM-Struktur in `index.html` einfügen
1. **Game Card im Hub:**
   Füge im `#home-screen` unter `.games-grid` eine neue `.game-card` mit `data-game="meinspiel"` ein.
2. **Game View Container:**
   ```html
   <div id="game-meinspiel" class="game-view">
       <div class="hud-bar">
           <div class="hud-left">
               <button class="btn-hub-back icon-btn" title="Zurück zum Hub">◂</button>
               <div class="hud-pill"><span>MEIN SPIEL</span><strong id="meinspiel-status">Runde 1</strong></div>
               <div class="hud-pill" id="meinspiel-room-pill"><span>RAUM:</span><strong id="meinspiel-room-code">-----</strong></div>
           </div>
           <div class="hud-scores" id="meinspiel-scores"></div>
           <div class="hud-right">
               <button class="icon-btn btn-instructions-toggle" title="Kurzanleitung">❓</button>
               <button class="icon-btn btn-mute-toggle" title="Sound">🔊</button>
               <button class="icon-btn btn-fullscreen-toggle" title="Vollbild">⛶</button>
           </div>
       </div>
       <div class="canvas-wrapper">
           <canvas id="meinspielCanvas" width="1200" height="800"></canvas>
       </div>
       <!-- Mobile Touch Controls -->
       <div class="touch-controls meinspiel-touch">
           <button class="touch-btn" id="meinspiel-touch-left">◀</button>
           <button class="touch-btn" id="meinspiel-touch-right">▶</button>
       </div>
   </div>
   ```

### Schritt 3: CSS & Responsive Styling in `style.css`
* Stelle sicher, dass die Leinwand flüssig skaliert (`max-width: 100%; height: auto; touch-action: none;`).
* Touch-Controls bei Touch-Geräten oder schmalen Bildschirmen aktivieren:
  ```css
  @media (pointer: coarse), (max-width: 900px) {
      .meinspiel-touch { display: flex !important; }
  }
  ```

### Schritt 4: Registrierung in `app.js`
1. Instanz anlegen: `const meinSpiel = new MeinNeuesSpiel();`
2. In `getActiveGameInstance()` integrieren.
3. In `gameScreens` eintragen: `meinspiel: document.getElementById('game-meinspiel')`.
4. In `hostGame(gameType)` und `startGameSession(gameType)` Start-Hooks setzen.
5. In `handleHostGameEvent` und `handleClientGameEvent` Netzwerk-Events verdrahten (`MS_INPUT`, `MS_ACTION`, etc.).
6. In `gameLoop(dt)` Update ausführen (nur wenn `isHost`).
7. In `render()` Canvas-Zeichenmethode einbinden.

### Schritt 5: Touch-Controls anbinden (`app.js`)
* Nutze die `bindTouch()` Hilfsfunktion für zuverlässiges Multi-Touch auf Mobilgeräten:
  ```javascript
  bindTouch('meinspiel-touch-left', 'ArrowLeft');
  bindTouch('meinspiel-touch-right', 'ArrowRight');
  ```

### Schritt 6: Soundeffekte anbinden (`audio.js`)
* Nutze bestehende synthetische Sounds (`window.soundFX.playClick()`, `playDie()`, `playWin()`, `playCountdown()`).
* Erzeuge keine externen `.mp3` oder `.wav` Abhängigkeiten!

### Schritt 7: Kurzanleitung hinterlegen
1. In `index.html` im `#modal-instructions` einen Tab und Inhalt anlegen.
2. In `app.js` im `GAME_INSTRUCTIONS` Dictionary Ziel, Steuerung und Profi-Tipps hinterlegen.

### Schritt 8: Automatisierte Tests ergänzen (`test/sim-tests.mjs`)
* Füge eine Testsuite hinzu, die Rundenfortschritt, Kollisionen, Bot-Verhalten und Snapshot-Maskierung prüft.
* Ausführen und verifizieren mit: `npm test`.

---

## 3. Kritische Fallstricke & Best Practices (Lessons Learned)

### a) WebRTC & Host-Authoritative State
* **Problem:** Wenn Clients ihre eigenen Positionen berechnen, driften Latenzen auseinander (Desynchronisation).
* **Lösung:** Immer **Host-Authoritative** arbeiten:
  * Clients senden ausschließlich Tastenanschläge / Intentionen (`left: true`, `shoot: true`).
  * Nur der Host berechnet Physik, Zufallswerte und Treffer.
  * Der Host sendet kompakte Snapshots (gerundete Koordinaten `Math.round(x * 10) / 10`, um Bandbreite zu sparen).

### b) Physik & Tunneling-Vermeidung (Sub-Stepping)
* **Problem (Octa-Pong Erfahrung):** Bei hohen Geschwindigkeiten (z. B. $540\,\text{px/s}$) bewegt sich ein Ball bei $60\,\text{FPS}$ bis zu $15\,\text{px}$ pro Frame. Schläger oder Wände mit $7\,\text{px}$ Dicke werden in einem einzigen Zeitschritt komplett übersprungen ("Tunneling").
* **Lösung:** **Sub-Stepping implementieren!**
  ```javascript
  const SUB_STEPS = 4;
  const subDt = dt / SUB_STEPS;
  for (let step = 0; step < SUB_STEPS; step++) {
      ball.x += ball.vx * subDt;
      ball.y += ball.vy * subDt;
      checkCollisions();
  }
  ```
* **Kollisionswinkel:** Im Screen-Koordinatensystem (wo die Y-Achse nach unten zeigt) muss die reflektierte Normale mit $\operatorname{atan2}(n_y, n_x)$ berechnet werden, sonst fliegt der Ball nach außen statt nach innen!
* **Position-Clamping:** Nach einer Kollision das Objekt immer sofort um $(r + 2)\,\text{px}$ entlang der Normalen ins Spielfeldinnere zurücksetzen, um Mehrfachtreffer im selben Frame zu verhindern.

### c) Bot-KI & Rate-Limiting
* **Problem (Tank Trouble Erfahrung):** Bots rufen die Update-Funktion 50-mal pro Sekunde auf. Ohne explizite Zeitverzögerung schießen Bots wie Maschinengewehre im Dauerfeuer.
* **Lösung:**
  1. **Schuss-Cooldown:** `bot.shootCooldown = 1.2 + Math.random() * 1.0;`
  2. **Raycasting Line-of-Sight:** Bevor der Bot feuert, prüfen, ob eine Wand zwischen Bot und Ziel liegt:
     ```javascript
     if (this.hasLineOfSight(bot.x, bot.y, target.x, target.y) && Math.abs(angleDiff) < 0.22) {
         bot.inputShoot = true;
     }
     ```
  3. **Munitionslimit:** Maximal 5 Projektile pro Spieler gleichzeitig zulassen.

### d) Rollen-Isolation & Datensicherheit
* **Problem (Montagsmaler & Codenames Erfahrung):**
  * Montagsmaler: Wenn der aktive Zeichner Begriffe im Chat tippen kann, leakt er versehentlich das geheime Wort.
  * Codenames: Wenn unaufgedeckte Kartenfarben an Ermittler übertragen werden, können Spieler diese im Browser-DevTool (F12) auslesen.
* **Lösung:**
  * **Eingabeschnittstellen physikalisch sperren:** Chat-Feld und Senden-Button für den Zeichner bzw. bereits erfolgreiche Rater mit `disabled = true` versehen.
  * **Targeted Snapshots:** In `getSnapshot(forPlayerId)` verdeckte Kartentypen für Ermittler mit `type: 'hidden'` maskieren. Nur der Spionchef erhält das unmaskierte Farbraster.

### e) Mobile Touch-Steuerung & Responsive Skalierung
* **Canvas-Skalierung:** Das Spielfeld hat immer feste interne Koordinaten (z. B. $1200 \times 800$), wird im CSS jedoch fluid mit `width: 100%; height: auto; max-height: calc(100vh - 160px);` skaliert.
* **Multi-Touch & Gesten:**
  * Am Canvas und an Touch-Buttons immer `touch-action: none;` und `user-select: none;` setzen, um versehentliches Scrollen, Zoomen oder Markieren zu verhindern.
  * Events: Immer `pointerdown`, `pointerup`, `pointercancel` und `pointerleave` abfangen, damit Knöpfe beim Loslassen außerhalb des Buttons nicht "hängenbleiben".
  * Virtuelle D-Pads links und Aktions-Knöpfe rechts anordnen (Thumb-Zone).

### f) Audio-Synthese ohne externe Assets
* Niemals externe Sounddateien einbinden (Gefahr von CORS, 404 auf Pages oder Werbeblockern).
* Nutze immer die integrierte Web Audio API (`audio.js`), die saubere Töne, Clicks, Fanfaren und Explosionen via Oszillator (`sine`, `triangle`, `sawtooth`) und Noise-Buffer in Echtzeit synthetisiert.

### g) Automatisierte Tests
* Vor jedem Commit muss `npm test` fehlerfrei durchlaufen.
* Die Tests laufen headless in Node.js über eine VM-Sandbox und prüfen Physik, Geometrie und Spielregeln in Millisekunden deterministisch durch.

---

## 4. Deployment & GitHub Pages Richtlinien

1. **`.nojekyll` im Repository-Root:**  
   Muss stets vorhanden sein, damit GitHub Pages den internen Jekyll-Compiler umgeht und statische Assets unverändert ausliefert.
2. **Relative Pfade & Forward Slashes:**  
   Verwende in HTML/JS immer relative Pfade (`games/pong.js`, nicht `/games/pong.js` oder Backslashes `\`), da die GitHub Pages URL einen Unterpfad besitzt (`/data-squad-hub/`).
3. **Vendored Dependencies:**  
   `peerjs.min.js` liegt direkt im Projektstammverzeichnis und wird nicht von CDNs nachgeladen.

---

*Erstellt für das DataSquad-Projekt • Dokumentiert von Jimmy*
