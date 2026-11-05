# DataSquad Hub

> **Erstellt von Jimmy (3.8 Flash) · Reviewed von Claudia (Opus 5.5)**  
> *Real-Time Distributed Stream Synchronization & Interactive Team Velocity Tool*

Ein leichtgewichtiges, browserbasiertes Echtzeit-Minigame-Portal zur Synchronisation verteilter Datenströme und interaktiven Teambuilding-Sessions für das Data Squad – läuft **ohne eigenes Backend auf GitHub Pages**.

---

## 🎮 Enthaltene Spiele im Hub

| Spiel | Spieleranzahl | Spielprinzip | Steuerung |
| :--- | :--- | :--- | :--- |
| **🐍 Curve Arena** | 2 – 12 Spieler | Tron-Linien & Ausweichmanöver mit Mario-Kart Power-Ups & Lücken-Mechanik | `◀` / `▶` oder `A` / `D` |
| **🕵️ Codenames** | 4 – 12 Spieler | Team Rot vs. Blau – Wörter auf Deutsch erraten | Maus / Touch (Klick) |
| **🎨 Montagsmaler (Skribbl)** | 2 – 12 Spieler | Live-Zeichnen & Begriffe im Chat erraten | Maus / Touch + Tastatur |
| **💥 Tank Trouble** | 2 – 8 Spieler | 2D-Panzer im Labyrinth mit abprallenden Querschlägern | `WASD` / Pfeile + `Leertaste` |
| **🏓 Octa-Pong** | 2 – 8 Spieler | 8-Spieler-Achteck-Pong mit Diagonalen | `◀` / `▶` oder `A` / `D` |
| **🃏 UNO** | 2 – 8 Spieler | Klassisches Kartenspiel mit 108 Karten, Farbwahl & Aussetzen | Maus / Touch (Klick) |
| **🤾 Corporate Dodgeball** | 2 – 8 Spieler | Data Squad vs. ComM! Büro-Völkerball mit Steinen, Akten & Releases | `WASD` / Pfeile + `Leertaste` / `Shift` |
| **🎲 Freigabe-Roulette** | 2 – 8 Spieler | Satirisches Bürokratie-Kartenspiel: Go-Live vs. Steine im Weg & 4h-Meetings | Maus / Touch (Klick) |

---

## ⚡ Übersicht & Features

- 👤 **Erstellt von:** Jimmy (3.8 Flash)
- 🔍 **Code-Review & Security-Hardening:** Claudia (Opus 5.5)
- 🌐 **Peer-to-Peer Architektur (WebRTC):** Kein eigenes Backend erforderlich. Die Spieldaten fließen direkt und verschlüsselt zwischen den Browsern. Für den Verbindungsaufbau nutzt PeerJS allerdings den öffentlichen Vermittlungsserver `0.peerjs.com` sowie STUN-Server; diese sehen die IP-Adressen der Teilnehmer, aber keine Spielinhalte.
- 🛡️ **Host-autoritativ & abgesichert:** Der Host prüft alle Aktionen (Zugrechte, Rollen, Payload-Grenzen); Daten anderer Spieler werden vor der Anzeige maskiert (XSS-Schutz).
- 🔗 **Smartes Direkt-Routing:** 
  - Einladungs-Links führen Gäste **direkt zum richtigen Spiel** (z. B. `?game=uno&room=K8M2P`), ohne dass der Gast das Spiel manuell auswählen muss.
  - Auch bei bloßer Eingabe des Raum-Codes im Hub erkennt der Client automatisch das gehostete Spiel.
- 🤖 **Integrierte Simulations-Nodes (KI):** Für Curve, Tank, Octa-Pong und UNO können leere Slots jederzeit mit intelligenten Bots aufgefüllt werden.
- 🔒 **Firmennetz-Optimiert:** Keine externen CDNs (alle Abhängigkeiten liegen lokal im Repository), neutrale Metadaten gegen automatische Inhaltsfilter.

---

## 🚀 Lokale Ausführung & Automatisierte Tests

```powershell
# Lokalen HTTP-Server starten (z. B. mit Python):
python -m http.server 8000

# Automatisierte Physik- & Regel-Simulationstests ausführen:
npm test
```
Danach im Browser [http://localhost:8000](http://localhost:8000) öffnen.

### 🧪 Automatisiertes Testen (E2E & Simulation)
Das Repository enthält eine automatisierte Testsuite (`test/sim-tests.mjs` & `test/e2e-playwright.mjs`):
- **Tank Trouble:** Prüft Labyrinthbreite (Korridore >= 80px), Panzer-Kollisionen, Schuss-Cooldown (verhindert Bot-Spam), Whisker-Raycast (verhindert Wand-Zittern) und Querschläger-Reflexion.
- **Octa-Pong:** Simuliert hunderte Hochgeschwindigkeits-Bälle gegen alle 8 Schlägerseiten und weist kontinuierliche Kollisionserkennung (Sub-Stepping, 0% Tunneling) nach.
- **Montagsmaler:** Verifiziert, dass der aktive Maler keine Begriffe tippen oder leaken kann und Punkte für Maler & Rater korrekt vergeben werden.
- **Codenames:** Validiert 25-Karten-Verteilung (1 Attentäter, 9/8 Teamkarten), Spionchef/Ermittler-Maskierung und Rollenrechte.
- **UNO:** Prüft Standard-Deck (108 Karten), Aktionskarten (+2, Farbwahl, +4, Richtungswechsel), Bot-Entscheidungsfindung und Anti-Cheat Hand-Maskierung.
- **Corporate Dodgeball:** Validiert Team-Aufteilung (Data Squad vs. ComM), Halbfeld-Grenzschutz, Ball-Pickups, Wurf- und Flugphysik, Hechtsprung-Fangen (Catch-Mechanik) und Erzeugung von Fels-Hindernissen ("Steine im Weg").
- **Curve Arena:** Testet Linienausbau, Lückengenerierung, Raumkoordinaten sowie das Mario-Kart Power-Up System (Invert, Ghost, Turbo, Fat Lines, Bombe & Snapshot-Synchronisation).
- **Freigabe-Roulette:** Prüft 54-Karten-Deck (Fortschritt, ComM-Blocker, Aktionen), 100% Go-Live Siegbedingung, Chef-Bypass Schutzschild, Bot-KI und Anti-Cheat Hand-Maskierung.
- **Sicherheit:** Simuliert bösartige Peers – fremde Zeichen-/Lösch-/Wortwahl-Aktionen, ungültige Striche, Zugbeenden durch das falsche Team, Rollenwechsel des Spionchefs mitten im Spiel und kaputte Eingabewerte.

Die Tests laufen bei jedem Push und Pull Request automatisch per GitHub Actions (`.github/workflows/test.yml`).

---

## 📚 Abhängigkeiten

- [PeerJS](https://github.com/peers/peerjs) **1.5.4** (MIT-Lizenz), lokal eingebunden als `peerjs.min.js`.

---

## 📦 Deployment auf GitHub Pages

Live unter: **`https://stevenkuenzel.github.io/data-squad-hub/`**
