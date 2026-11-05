# 🎮 Curve Arena (Multiplayer Browser Game)

Ein actiongeladenes Echtzeit-Multiplayer-Spiel im Stil von **Curve Fever / Achtung die Kurve**, das **100% serverlos und kostenlos auf GitHub Pages** läuft!

Die Spieler steuern Linien im Cyber-Neon-Design, die Spuren hinterlassen. Durch zufällige Lücken im Schweif kann man gegnerische Linien durchqueren. Wer eine Wand oder eine Linie rammt, scheidet aus!

---

## ✨ Features

- 🌐 **Echter Multiplayer via WebRTC (PeerJS)**: Keine eigenen Server nötig – die Browser der Spieler verbinden sich direkt Peer-to-Peer (P2P).
- 🔗 **Raum-Codes & Einladungs-Links**: Host erstellt einen Raum (z. B. `K8M2P`), Freunde treten per Code oder direkt per Link (`?room=K8M2P`) bei.
- 🤖 **Solo-Modus & Bots**: Trainiere alleine gegen KI-Gegner mit Raycasting-Ausweichmanövern oder fülle Lobbys mit Bots auf.
- ⌨️ **Lokaler 2-Spieler-Modus**: Zwei Spieler an einer einzigen Tastatur (Pfeiltasten vs. A/D) – ideal für unterwegs oder die Kaffeepause!
- 📱 **Mobile Touch-Steuerung**: Funktioniert auf Smartphones und Tablets dank On-Screen-Touch-Buttons.
- 🔊 **Web Audio Synthesizer**: Retro-Soundeffekte (Explosionen, Lücken, Countdown, Fanfaren) komplett ohne externe MP3s generiert.
- 🎨 **Neon / Cyberpunk Design**: Butterweiche 60 FPS Canvas-Grafik mit Kollisionsabfrage über Spatial-Hashing.

---

## 🕹️ Steuerung

| Modus | Links drehen | Rechts drehen |
| :--- | :--- | :--- |
| **Online Spieler 1** | `◀` Pfeil links | `▶` Pfeil rechts |
| **Lokaler Spieler 2** | `A` | `D` |
| **Touch / Mobile** | Linker Button | Rechter Button |

---

## 🚀 Schnellstart (Lokal testen)

Da das Spiel statisch ist, kann es mit jedem lokalen Webserver getestet werden:

```bash
# Mit Python 3:
python -m http.server 8000
```

Öffne anschließend [http://localhost:8000](http://localhost:8000) im Browser.

> **Tipp zum Multiplayer-Testen:** Öffne einfach **zwei separate Browser-Tabs** (oder einen normalen Tab und einen Inkognito-Tab), erstelle im ersten Tab einen Raum und tritt im zweiten Tab mit dem Code bei!

---

## 📦 Veröffentlichung auf GitHub Pages

1. **Git Repository initialisieren & pushen:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Curve Arena Multiplayer"
   git branch -M main
   git remote add origin https://github.com/<DEIN-NUTZERNAME>/data_squad_games.git
   git push -u origin main
   ```

2. **GitHub Pages aktivieren:**
   - Gehe auf GitHub in dein Repository: **Settings** -> **Pages**
   - Unter **Build and deployment**:
     - **Source**: `Deploy from a branch`
     - **Branch**: `main` / Folder: `/(root)`
   - Klicke auf **Save**.

In wenigen Sekunden ist dein Spiel unter `https://<DEIN-NUTZERNAME>.github.io/data_squad_games/` weltweit spielbar!

---

## 🛠️ Technische Architektur

- **Frontend:** Vanilla JavaScript (ES6+), HTML5 Canvas 2D, modernes CSS3 mit Flexbox/Grid & Backdrop-Filter.
- **P2P Networking:** [PeerJS](https://peerjs.com/) (WebRTC DataChannels) über das kostenlose PeerJS Cloud Signalling Netzwerk.
- **Kollisionserkennung:** Segment-zu-Kreis-Distanzberechnung kombiniert mit einem zweidimensionalen Spatial Grid ($O(1)$ Abfragen für 60 FPS Performance).
- **Sound:** Web Audio API (`AudioContext`, Oszillatoren, Rauschgeneratoren und Biquad-Filter).
