# DataSquad Hub

> **Erstellt von Jimmy**  
> *Real-Time Distributed Stream Synchronization & Interactive Team Velocity Tool*

Ein leichtgewichtiges, browserbasiertes Echtzeit-Minigame-Portal zur Synchronisation verteilter Datenströme und interaktiven Teambuilding-Sessions für das Data Squad – läuft **100% serverlos auf GitHub Pages**.

---

## 🎮 Enthaltene Spiele im Hub

| Spiel | Spieleranzahl | Spielprinzip | Steuerung |
| :--- | :--- | :--- | :--- |
| **🐍 Curve Arena** | 2 – 12 Spieler | Tron-Linien & Ausweichmanöver mit Lücken-Mechanik | `◀` / `▶` oder `A` / `D` |
| **🕵️ Codenames** | 4 – 12 Spieler | Team Rot vs. Blau – Wörter auf Deutsch erraten | Maus / Touch (Klick) |
| **🎨 Montagsmaler (Skribbl)** | 2 – 12 Spieler | Live-Zeichnen & Begriffe im Chat erraten | Maus / Touch + Tastatur |
| **💥 Tank Trouble** | 2 – 8 Spieler | 2D-Panzer im Labyrinth mit abprallenden Querschlägern | `WASD` / Pfeile + `Leertaste` |
| **🏓 Octa-Pong** | 2 – 8 Spieler | 8-Spieler-Achteck-Pong mit Diagonalen | `◀` / `▶` oder `A` / `D` |

---

## ⚡ Übersicht & Features

- 👤 **Erstellt von:** Jimmy
- 🌐 **Peer-to-Peer Architektur (WebRTC):** Keine externen Server oder Backends erforderlich. Die Browser der Teilnehmer verbinden sich direkt und Ende-zu-Ende verschlüsselt miteinander.
- 🔗 **Smartes Direkt-Routing:** 
  - Einladungs-Links führen Gäste **direkt zum richtigen Spiel** (z. B. `?game=skribbl&room=K8M2P`), ohne dass der Gast das Spiel manuell auswählen muss.
  - Auch bei bloßer Eingabe des Raum-Codes im Hub erkennt der Client automatisch das gehostete Spiel.
- 🤖 **Integrierte Simulations-Nodes (KI):** Für Curve, Tank und Octa-Pong können leere Slots jederzeit mit intelligenten Bots aufgefüllt werden.
- 🔒 **Firmennetz-Optimiert:** Keine externen CDNs (alle Abhängigkeiten liegen lokal im Repository), neutrale Metadaten gegen automatische Inhaltsfilter.

---

## 🚀 Lokale Ausführung

```powershell
# Lokalen HTTP-Server starten (z. B. mit Python):
python -m http.server 8000
```
Danach im Browser [http://localhost:8000](http://localhost:8000) öffnen.

---

## 📦 Deployment auf GitHub Pages

Live unter: **`https://stevenkuenzel.github.io/data-squad-hub/`**
