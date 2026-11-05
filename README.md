# DataSquad Hub

> **Erstellt von Jimmy**  
> *Real-Time Distributed Stream Synchronization & Interactive Team Velocity Tool*

Ein leichtgewichtiges, browserbasiertes Echtzeit-Minigame-Portal zur Synchronisation verteilter Datenströme und interaktiven Teambuilding-Sessions für das Data Squad – läuft **100% serverlos auf GitHub Pages**.

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

---

## ⚡ Übersicht & Features

- 👤 **Erstellt von:** Jimmy
- 🌐 **Peer-to-Peer Architektur (WebRTC):** Keine externen Server oder Backends erforderlich. Die Browser der Teilnehmer verbinden sich direkt und Ende-zu-Ende verschlüsselt miteinander.
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

---

## 📦 Deployment auf GitHub Pages

Live unter: **`https://stevenkuenzel.github.io/data-squad-hub/`**
