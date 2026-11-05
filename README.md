# DataSquad Hub

> **Erstellt von Jimmy**  
> *Real-Time Distributed Stream Synchronization & Interactive Team Velocity Tool*

Ein leichtgewichtiges, browserbasiertes Echtzeit-Tool zur Synchronisation verteilter Datenströme und interaktiven Teambuilding-Sessions für das Data Squad – läuft **100% serverlos auf GitHub Pages**.

---

## ⚡ Übersicht & Features

- 👤 **Erstellt von:** Jimmy
- 🌐 **Peer-to-Peer Architektur (WebRTC):** Keine externen Server oder Backends erforderlich. Die Browser der Teilnehmer verbinden sich direkt und Ende-zu-Ende verschlüsselt miteinander.
- 👥 **Bis zu 12 gleichzeitige Teilnehmer:** Automatische, kollisionsfreie Zuweisung einzigartiger Farbkennungen für jeden Datenstrom.
- 🔗 **Raum-Codes & Einladungs-Links:** Host generiert einen 5-stelligen Sitzungs-Code (z. B. `K8M2P`) oder teilt den Direktlink (`?room=K8M2P`).
- 🤖 **Integrierte Simulations-Nodes (KI):** 4 konfigurierbare Stufen (*Leicht*, *Mittel*, *Schwer*, *Profi*) mit vorausschauendem Raycasting-Algorithmus zur Freiflächenanalyse.
- ⌨️ **Steuerung:** Pfeiltasten (`◀` / `▶`) oder `A` / `D` sowie Touch-Steuerung für mobile Geräte.
- 🔒 **Firmennetz-Optimiert:** Keine externen CDNs (alle Abhängigkeiten liegen lokal im Repository), neutrale Metadaten gegen automatische Inhaltsfilter.

---

## 🕹️ Steuerung

| Teilnehmer | Linkskurve | Rechtskurve |
| :--- | :--- | :--- |
| **Primäre Steuerung** | `◀` Pfeil links | `▶` Pfeil rechts |
| **Alternative Steuerung** | `A` | `D` |
| **Touch / Mobile** | Linker Button | Rechter Button |

---

## 🚀 Lokale Ausführung

```powershell
# Lokalen HTTP-Server starten (z. B. mit Python):
python -m http.server 8000
```
Danach im Browser [http://localhost:8000](http://localhost:8000) öffnen.

---

## 📦 Deployment auf GitHub Pages

1. **Repository pushen:**
   ```powershell
   git add .
   git commit -m "Update documentation and credits"
   git push origin master
   ```

2. **GitHub Pages aktivieren:**
   - Auf GitHub im Repository: **Settings** ➔ **Pages**
   - **Branch:** `master` / Folder: `/(root)`
   - Klick auf **Save**.

Die Anwendung ist anschließend unter `https://<NUTZERNAME>.github.io/<REPO-NAME>/` weltweit erreichbar.
