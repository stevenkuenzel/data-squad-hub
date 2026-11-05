# Allgemein
- [x] warum sind nicht alle games im games ordner? -> Erledigt: `game.js` wurde nach `games/curve.js` verschoben. Alle 8 Spiele liegen nun einheitlich und modular in `games/`.

# Tanks:
- [x] steuerkreuz bei tanks ist erst durch scrollen sichtbar. besser so ein virtueller analog stick? -> Erledigt: Steuerkreuz durch einen ergonomischen virtuellen Analog-Joystick mit Touch-/Maus-Erkennung ersetzt. Viewport auf `100dvh` fixiert (kein Scrollen mehr nötig).

# montagsmaler:
- [x] zeit läuft nicht runter? -> Erledigt: Der Timer-Countdown wird nun jede Sekunde (`Math.ceil(timeLeft)`) und bei Buchstaben-Hinweisen autoritativ synchronisiert und im UI aktualisiert.

# curve
- [x] wirkt sich links rechts troll auch auf bots aus? -> Ja! Der Invert-Effekt betrifft auch Bots (Bot will z. B. nach links lenken, Curve dreht jedoch invertiert nach rechts in die Wand). Durch automatisierten Test in `sim-tests.mjs` verifiziert.
- [x] perks in einstellungen deaktivierbar -> Erledigt: Power-Ups / Perks lassen sich sowohl in den Lobby-Einstellungen als auch direkt im Curve-HUD über den ⚡-Button per Klick ein- und ausschalten (Orbs und Effekte werden bei Deaktivierung sofort bereinigt).

# comn dodgeball
- [x] wie kann man fangen? -> Erledigt: Fangen ist nun über `Shift`, `Rechtsklick`, `C`, `F` oder auf Mobile über den prominenten `FANGEN / DASH 🧤` Button möglich! Catch-Radius wurde vergrößert, Partikeleffekt & "🎯 GEFANGEN!"-Banner hinzugefügt und Steuerungs-Pill direkt im HUD eingebunden.
- [x] Spezialangriff: "Das große ComN-Paket" -> Erledigt: Goldenes Riesen-Paket (📦) spawnt periodisch. Bei Einschlag explodiert es in einen Cluster-Schwall aus 1x Stein im Weg, 1x Agentur-Rechnung & 1x Aktenordner!
- [x] Icons auf Bälle schwer zu erkennen -> Erledigt: Bälle vergrößert, mit kontraststarkem dunklem Kreis-Kern, leuchtendem Neon-Ring und vergrößerten 22-30px Emojis + Namens-Tag unter Bodenbällen versehen.

# comn kartenspiel
- [x] Text auf Karten ragt unten hinaus -> Erledigt: Kartengröße auf `124px x 176px` erweitert, `overflow: hidden`, Textgrößen und Abstände optimiert, sodass alle Beschreibungen sauber und vollständig hineinpassen.
- [x] Irgendwie zu wenige Karten -> Erledigt: Deck von 54 auf 99 Karten und von 12 auf 18 einzigartige satirische Kartentypen erweitert (neu: KI ins Dashboard gebaut, Stiller Feature-Flag, Doppelter Espresso, Datenschutz-Bedenken, Corporate Wording, Vorstandspräsentation).

---

# 💡 Feature-Ideen für mehr Teambuilding-Spaß

Legende: ⭐ = großer Spaß-Effekt bei wenig Aufwand · 🧱 = größerer Umbau

## Spieleabend als Ganzes
- [ ] ⭐ **Spieleabend-Modus mit Gesamtwertung:** Der Host stellt eine Playlist aus mehreren Spielen zusammen (z. B. Curve → Codenames → Dodgeball). Punkte werden über alle Spiele hinweg gesammelt, am Ende gibt es ein Gesamt-Podium.
- [ ] ⭐ **Award-Zeremonie am Ende:** Lustige Titel statt nur „Gewinner“, z. B. „Bürokratie-Bezwinger“, „Friendly-Fire-Champion“, „Meister des Fangens“, „Längste Überlebenszeit“, „Hat am meisten Steine in den Weg gelegt“. Werte kommen aus den Spielstatistiken.
- [ ] ⭐ **Emoji-Reaktionen in allen Spielen:** Kurze Reaktionen (👏 😂 🔥 😱 🪨), die kurz über dem Spielfeld aufsteigen. Bringt Stimmung, auch wenn man gerade raus ist.
- [ ] **Zuschauer-Modus & Nachzügler:** Wer zu spät kommt, kann laufende Runden zuschauen und reagieren und steigt in der nächsten Runde ein (heute bleibt man in der Lobby hängen).
- [ ] **Wiederverbinden:** Nach Verbindungsabbruch mit gleichem Namen und Punktestand zurück ins Spiel.
- [ ] **Team-Mixer:** Teams per Knopfdruck zufällig mischen, gezielt „quer durch die Abteilungen“ oder nach Wunsch fest einteilen – gilt für alle Teamspiele.
- [ ] **Avatare:** Emoji-Avatar bzw. Hut/Accessoire neben Name und Farbe, sichtbar in Lobby, Scoreboards und Spielfiguren.
- [ ] **Achievements:** Kleine Erfolge pro Spiel („3 Bälle in einer Runde gefangen“, „UNO ohne Ziehen gewonnen“), werden in der Award-Zeremonie gezeigt.
- [ ] **Aufholmechanik (optional):** Führende bekommen leichte Handicaps, Hintere kleine Boni – hält Abende für alle Erfahrungsstufen spannend. Per Einstellung abschaltbar.

## Präsenz-Events
- [ ] ⭐🧱 **Beamer-Modus mit Handy-Controllern:** Ein Rechner zeigt das Spiel groß auf dem Beamer, alle anderen steuern per Smartphone (QR-Code scannen → beitreten). Ideal für Offsites und Weihnachtsfeiern.
- [ ] ⭐ **QR-Code für den Einladungslink** in der Lobby, damit Handys ohne Abtippen beitreten.

## Eigene Inhalte des Teams
- [ ] ⭐ **Eigene Wortlisten für Codenames & Montagsmaler:** Host fügt Insider-Begriffe ein (Projektnamen, Tools, Running Gags). Optional mit den Standardwörtern mischen.
- [ ] **Eigene Karten für Freigabe-Roulette:** Team-spezifische Blocker und Boosts per einfachem Editor in der Lobby.

## Neue Spielideen
- [ ] ⭐ **Meeting-Bingo:** Buzzword-Bingo-Karten für echte Meetings, live synchronisiert. Wer zuerst eine Reihe hat, darf (stumm) jubeln.
- [ ] ⭐ **Zwei Wahrheiten, eine Lüge:** Jede Person gibt vorab drei Aussagen ein, das Team stimmt ab. Klassischer Eisbrecher, besonders für neue Kolleg:innen.
- [ ] **Bild-Stille-Post:** Zeichnen → Raten → Zeichnen im Kreis, am Ende werden die Ketten gemeinsam aufgedeckt. Nutzt den Montagsmaler-Canvas.
- [ ] **Story-Point-Schätzshow:** Absurde Schätzfragen („Wie viele Excel-Dateien liegen auf dem Teamlaufwerk?“), wer am nächsten liegt, punktet. Persiflage auf Planning Poker.
- [ ] 🧱 **Deadline-Dash (kooperativ):** Alle gegen die Uhr statt gegeneinander – das Team muss gemeinsam Aufgaben erledigen, bevor der Go-Live platzt. Stärkt Zusammenarbeit statt Konkurrenz.
- [ ] 🧱 **Der Maulwurf im Projekt:** Social-Deduction-Spiel – eine Person sabotiert heimlich, die anderen müssen sie entlarven.

## Verbesserungen an bestehenden Spielen
- [x] **Codenames:** Optionaler Rundentimer; Spionchef-Hinweis per Enter abschicken. -> Erledigt: Timer (60/90/120 s pro Phase, Zeitablauf beendet den Zug) in den Lobby-Einstellungen, Enter im Hinweisfeld schickt den Hinweis ab.
- [x] **Montagsmaler:** Radiergummi, Rückgängig-Knopf und Füllwerkzeug. -> Erledigt: Stift/Radierer/Füllen und ↶ Zurück (Strich-Gruppen, auf allen Clients synchron). Außerdem wird die Zeichenfläche nun bei jeder neuen Runde geleert.
- [x] **UNO:** Hausregeln als Schalter (+2/+4 stapeln, 7-0-Tauschen). -> Erledigt: zwei Schalter in der Lobby, Bots beherrschen beide Regeln. Nebenbei behoben: Clients konnten per Ziehen-Button keine Karten ziehen.
- [x] **Dodgeball:** Power-Ups (Schild, Doppelwurf) und ein Rundentimer gegen ewige 1-gegen-1-Duelle. -> Erledigt: Pickups 🛡️/✌️, optionaler Rundentimer (bei Zeitablauf gewinnt das Team mit mehr Lebenspunkten).
- [x] **Tank Trouble:** Weitere Labyrinth-Layouts und Power-Ups (Laser, Minen). -> Erledigt: 5 feste Layouts (Kreuz, Pfeiler, Kammern, Zickzack, Arena) plus „Gemischt“, Pickups 🔦 Laser (abprallend) und 💣 Minen; Bots sammeln Pickups ein.
- [x] **Bots** auch für Codenames, Montagsmaler und Dodgeball-Lücken, damit kleine Runden funktionieren. -> Erledigt: Codenames-Bots (Themenwelten als Hinweise), Montagsmaler-Bots (zeichnen 8 Motive, raten mit), Dodgeball füllt ungleiche Teams beim Start mit Bots auf (abschaltbar).

## Barrierefreiheit
- [ ] Farbenblind-freundliche Farbpalette als Option (Rot/Grün-Unterscheidung bei Teams und Karten).
- [ ] Tastenbelegung anpassbar; alle Spiele vollständig per Touch spielbar.

---

# 🛠️ Technische Schulden (aus dem Code-Review)
- [x] `app.js` (~2.700 Zeilen) in ein UI-Modul pro Spiel aufteilen. -> Erledigt: 13 Dateien in `ui/` (core, lobby, help, routing, main + je ein Modul pro Spiel), geladen als klassische Scripts mit gemeinsamem Scope.
- [ ] Branch-Schutz für `master` in den GitHub-Einstellungen: Merge nur mit grüner Pipeline.
- [x] E2E-Test (`test/e2e-playwright.mjs`) als manuell startbaren Workflow einrichten; Playwright als Dev-Abhängigkeit eintragen. -> Erledigt: `.github/workflows/e2e.yml` (manuell startbar), `playwright` in devDependencies.
- [x] Zufallsabhängige Tests mit festem Zufalls-Seed deterministisch machen (Testanzahl schwankt aktuell zwischen 142 und 146). -> Erledigt: Seedbarer PRNG, `TEST_SEED` überschreibbar (Standard 1337).
- [x] README nennt beim Freigabe-Roulette noch 54 Karten, das Deck hat inzwischen 99.
- [x] Raumcodes mit `crypto.getRandomValues` statt `Math.random` erzeugen.
