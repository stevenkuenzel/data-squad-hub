# Allgemein
- [x] warum sind nicht alle games im games ordner? -> Erledigt: `game.js` wurde nach `games/curve.js` verschoben. Alle 8 Spiele liegen nun einheitlich und modular in `games/`.

# Tanks:
- [x] steuerkreuz bei tanks ist erst durch scrollen sichtbar. besser so ein virtueller analog stick? -> Erledigt: Steuerkreuz durch einen ergonomischen virtuellen Analog-Joystick mit Touch-/Maus-Erkennung ersetzt. Viewport auf `100dvh` fixiert (kein Scrollen mehr nötig).
- [x] ⭐ **Tank-Steuerung mit zwei Analog-Sticks (Handy-Controller):** Linker Stick fährt, rechter Stick zielt, voll auslenken = Feuer. -> Erledigt: `TankGame.setTwinStick` (freie Fahrtrichtung, Zielen getrennt, Wandgleiten, Peer-Werte werden geprüft) plus zwei Sticks in `ui/pad.js`; Tastatur und Bots bleiben unverändert.

# montagsmaler:
- [x] zeit läuft nicht runter? -> Erledigt: Der Timer-Countdown wird nun jede Sekunde (`Math.ceil(timeLeft)`) und bei Buchstaben-Hinweisen autoritativ synchronisiert und im UI aktualisiert.

# curve
- [x] wirkt sich links rechts troll auch auf bots aus? -> Ja! Der Invert-Effekt betrifft auch Bots (Bot will z. B. nach links lenken, Curve dreht jedoch invertiert nach rechts in die Wand). Durch automatisierten Test in `sim-tests.mjs` verifiziert.
- [x] perks in einstellungen deaktivierbar -> Erledigt: Power-Ups / Perks lassen sich sowohl in den Lobby-Einstellungen als auch direkt im Curve-HUD über den ⚡-Button per Klick ein- und ausschalten (Orbs und Effekte werden bei Deaktivierung sofort bereinigt).
- [x] Wenn ich zu einem remote server verbinde, sehe ich bei spielstart nur die links-rechts-buttons maximiert über den ganzen bildschirm -> Erledigt: `currentInviteLink()` in `ui/beamer.js` hing bisher auch ohne Beamer-Modus immer `&pad=1` an den Lobby-QR-Code/Link an, wodurch beitretende Spieler automatisch im Vollbild-Controller (`#pad-screen`) landeten und das Häkchen `#opt-pad` auch nach Rückkehr in den Hub aktiv blieb. Jetzt wird `&pad=1` nur noch im echten Beamer-Modus gesetzt, beim Verlassen zurückgesetzt und im Controller-Header gibt es zusätzlich einen `🖥️ Spielfeld`-Button zum direkten Umschalten auf die Spielansicht.

# comn dodgeball
- [x] wie kann man fangen? -> Erledigt: Fangen ist nun über `Shift`, `Rechtsklick`, `C`, `F` oder auf Mobile über den prominenten `FANGEN / DASH 🧤` Button möglich! Catch-Radius wurde vergrößert, Partikeleffekt & "🎯 GEFANGEN!"-Banner hinzugefügt und Steuerungs-Pill direkt im HUD eingebunden.
- [x] Spezialangriff: "Das große ComN-Paket" -> Erledigt: Goldenes Riesen-Paket (📦) spawnt periodisch. Bei Einschlag explodiert es in einen Cluster-Schwall aus 1x Stein im Weg, 1x Agentur-Rechnung & 1x Aktenordner!
- [x] Icons auf Bälle schwer zu erkennen -> Erledigt: Bälle vergrößert, mit kontraststarkem dunklem Kreis-Kern, leuchtendem Neon-Ring und vergrößerten 22-30px Emojis + Namens-Tag unter Bodenbällen versehen.

# uno
- [x] **UNO auf dem Handy: eigene Karten nicht sichtbar, kein Scrollen.** -> Erledigt: Ursache war u. a. `94vh` (höher als der sichtbare Bereich mobiler Browser) – jetzt `dvh`; eigenes Querformat-Layout (Tisch links, Hand rechts, scrollbar), Reaktionen auch im Querformat eingeklappt.

# comn kartenspiel
- [x] Text auf Karten ragt unten hinaus -> Erledigt: Kartengröße auf `124px x 176px` erweitert, `overflow: hidden`, Textgrößen und Abstände optimiert, sodass alle Beschreibungen sauber und vollständig hineinpassen.
- [x] Irgendwie zu wenige Karten -> Erledigt: Deck von 54 auf 99 Karten und von 12 auf 18 einzigartige satirische Kartentypen erweitert (neu: KI ins Dashboard gebaut, Stiller Feature-Flag, Doppelter Espresso, Datenschutz-Bedenken, Corporate Wording, Vorstandspräsentation).

---

# Code-Review-Funde (offen)
- [x] **Zug-Timer bei UNO und Roulette:** -> Erledigt: UNO 45 s (automatischer Zug, der Spieler bleibt ein Mensch), Roulette 60 s (Zug verfällt); jede Aktion setzt den Timer zurück. Codenames hat bereits einen einstellbaren Rundentimer.
- [x] **UNO: einmal ziehen und Passen:** -> Erledigt: pro Zug nur noch einmal ziehen (außer bei offener Strafe), danach spielen oder „Passen ➔“. „UNO!“-Pflicht/+4-Anfechtung bleiben bewusst weg.
- [x] **Curve: Frontalcrash unabhängig von der Spielerreihenfolge:** -> Erledigt: Kollisionen werden gegen den Stand vor dem Tick geprüft, neue Segmente danach eingetragen, Punkte nur an Überlebende des Ticks; Rundensieger wird sofort (nicht einen Tick später) ermittelt.

# 💡 Feature-Ideen für mehr Teambuilding-Spaß

Legende: ⭐ = großer Spaß-Effekt bei wenig Aufwand · 🧱 = größerer Umbau

## Spieleabend als Ganzes
- [x] ⭐ **Spieleabend-Modus mit Gesamtwertung:** Der Host stellt eine Playlist aus mehreren Spielen zusammen (z. B. Curve → Codenames → Dodgeball). Punkte werden über alle Spiele hinweg gesammelt, am Ende gibt es ein Gesamt-Podium. -> Erledigt: Karte „Spieleabend“ im Hub, Playlist (Haken + ▲▼) in der Lobby, Punkte pro Platz (Teamspiele: 8/3), Zwischenstand nach jedem Spiel, Podium am Ende. Einstellungen aller Spiele gelten für den ganzen Abend.
- [x] ⭐ **Award-Zeremonie am Ende:** Lustige Titel statt nur „Gewinner“, z. B. „Bürokratie-Bezwinger“, „Friendly-Fire-Champion“, „Meister des Fangens“, „Längste Überlebenszeit“, „Hat am meisten Steine in den Weg gelegt“. Werte kommen aus den Spielstatistiken. -> Erledigt: 10 Awards (u. a. Bürokratie-Bezwinger, Friendly-Fire-Champion, Meister des Fangens, Längste Überlebenszeit, Steine-Leger), animiert eingeblendet.
- [x] ⭐ **Emoji-Reaktionen in allen Spielen:** Kurze Reaktionen (👏 😂 🔥 😱 🪨), die kurz über dem Spielfeld aufsteigen. Bringt Stimmung, auch wenn man gerade raus ist. -> Erledigt: Reaktionsleiste links unten in Lobby und allen Spielen, Host prüft (Whitelist, Rate-Limit) und verteilt.
- [x] **Zuschauer-Modus & Nachzügler:** Wer zu spät kommt, kann laufende Runden zuschauen und reagieren und steigt in der nächsten Runde ein (heute bleibt man in der Lobby hängen). -> Erledigt: Wer während eines Spiels beitritt, schaut zu (Banner) und wird bei der nächsten Partie bzw. beim nächsten Spiel des Abends automatisch Mitspieler. Hinweis: Einstieg erfolgt zur nächsten Partie, nicht mitten in der Runde.
- [x] **Wiederverbinden:** Nach Verbindungsabbruch mit gleichem Namen und Punktestand zurück ins Spiel. -> Erledigt: Der Browser verbindet automatisch neu (Overlay mit Fortschritt), erkennt sich über einen Sitzungsschlüssel wieder und erhält Platz, Hand, Team und Abendpunkte zurück. Solange er fehlt, spielt ein Bot.
- [x] **Team-Mixer:** Teams per Knopfdruck zufällig mischen, gezielt „quer durch die Abteilungen“ oder nach Wunsch fest einteilen – gilt für alle Teamspiele. -> Erledigt (Codenames, Dodgeball): „Mischen“-Knopf, Team-Chip in der Spielerliste per Klick wechselbar; beim Spieleabend werden Teams vor jedem Teamspiel neu gemischt. „Quer durch die Abteilungen“ gibt es nicht, da Abteilungen nicht erfasst werden.
- [x] **Avatare:** Emoji-Avatar bzw. Hut/Accessoire neben Name und Farbe, sichtbar in Lobby, Scoreboards und Spielfiguren. -> Erledigt: 12 Emojis + 6 Hüte im Hub wählbar (Klick wechselt), sichtbar in Lobby, Wertung, Scoreboards (Curve, Tank, Pong, Codenames, UNO, Montagsmaler) und auf den Dodgeball-Figuren.
- [x] **Achievements:** Kleine Erfolge pro Spiel („3 Bälle in einer Runde gefangen“, „UNO ohne Ziehen gewonnen“), werden in der Award-Zeremonie gezeigt. -> Erledigt: 10 Erfolge (z. B. Fang-Profi, Saubere Hände, Scharfschütze, Meisterdetektiv), als Toast und in der Wertung.
- [x] **Aufholmechanik (optional):** Führende bekommen leichte Handicaps, Hintere kleine Boni – hält Abende für alle Erfahrungsstufen spannend. Per Einstellung abschaltbar. -> Erledigt für Curve (Aufholhilfe: 3 s Geist), Tank (Letzte starten bewaffnet, Führende laden langsamer) und Dodgeball (Letzte +1 Leben, Führende längerer Dash-Cooldown); Schalter in der Spieleabend-Lobby.

## Präsenz-Events
- [x] ⭐🧱 **Beamer-Modus mit Handy-Controllern:** Ein Rechner zeigt das Spiel groß auf dem Beamer, alle anderen steuern per Smartphone (QR-Code scannen → beitreten). Ideal für Offsites und Weihnachtsfeiern. -> Erledigt: Häkchen „Beamer-Modus“ im Hub (oder `?beamer=1`): Der Host ist reine Anzeige ohne Spieler-Slot, mit großer Lobby, QR-Code und bildschirmfüllendem Spiel. Handys im Controller-Modus (`pad=1`, steckt im QR-Link) bekommen für Curve, Pong, Tank und Dodgeball einen Touch-Controller. UNO, Codenames, Montagsmaler und Roulette sind für Hochformat-Handys optimiert (kompaktes Layout, Hand umbrochen/scrollbar, einklappbare Reaktionen).
- [x] ⭐ **QR-Code für den Einladungslink** in der Lobby, damit Handys ohne Abtippen beitreten. -> Erledigt: Lokaler QR-Generator (`games/qr.js`, keine externen Requests), der Host sieht den QR-Code in jeder Lobby.

## Eigene Inhalte des Teams
- [ ] ⭐ **Eigene Wortlisten für Codenames & Montagsmaler:** Host fügt Insider-Begriffe ein (Projektnamen, Tools, Running Gags). Optional mit den Standardwörtern mischen.
- [ ] **Eigene Karten für Freigabe-Roulette:** Team-spezifische Blocker und Boosts per einfachem Editor in der Lobby.

## Neue Spielideen
- [ ] ⭐ **Meeting-Bingo:** Buzzword-Bingo-Karten für echte Meetings, live synchronisiert. Wer zuerst eine Reihe hat, darf (stumm) jubeln.
- [ ] ⭐ **Zwei Wahrheiten, eine Lüge:** Jede Person gibt vorab drei Aussagen ein, das Team stimmt ab. Klassischer Eisbrecher, besonders für neue Kolleg:innen.
- [ ] **Bild-Stille-Post:** Zeichnen → Raten → Zeichnen im Kreis, am Ende werden die Ketten gemeinsam aufgedeckt. Nutzt den Montagsmaler-Canvas.
- [ ] **Story-Point-Schätzshow:** Absurde Schätzfragen („Wie viele Excel-Dateien liegen auf dem Teamlaufwerk?“), wer am nächsten liegt, punktet. Persiflage auf Planning Poker.
- [ ] 🧱 **Deadline-Dash (kooperativ):** Alle gegen die Uhr statt gegeneinander – das Team muss gemeinsam Aufgaben erledigen, bevor der Go-Live platzt. Stärkt Zusammenarbeit statt Konkurrenz.
- [ ] ⭐🧱 **Spiel des Lebens – „Karriere-Leiter“ (Brettspiel, 2–6 Spieler):** Konzeptnotizen:
  - **Idee:** Rundenbasiertes Lebens-Brettspiel im Büro-Humor des Hubs. Jede Person zieht per Glücksrad (1–10) über einen Pfad von Ausbildung bis Ruhestand und sammelt Geld, Karriere und „Lebensglück“. Wer am Ende das meiste Vermögen hat, gewinnt.
  - **Ablauf:** Start mit Weichenstellung (Studium = Schulden, aber bessere Jobs / direkt Ausbildung). Das Brett hat Gabelungen (Karriere ↔ Familie, Risiko ↔ Sicherheit, Startup ↔ Konzern). Felder: Gehalt (Zahltag), Ereignis (Ereigniskarte), Haus kaufen, Kind/Haustier, Aktie/Wette, Pech (Steuernachzahlung, Reparatur). Ziel: Ruhestand, danach Endabrechnung (Geld + Häuser + Glückspunkte + Bonus für Reihenfolge im Ziel).
  - **Zwei Themen-Modi (wichtig, beide von Anfang an):** Host wählt in der Lobby **„Original“** (klassisches Lebensspiel: Ausbildung/Studium, Beruf, Heirat, Kinder, Haus, Ruhestand, klassische Ereignisse) oder **„IT-Firma“** (Büro-Variante unten). Gleiche Spielmechanik und gleiches Brett-Datenmodell; nur das Theme ist Daten: Feldtexte, Berufe, Ereignis-/Karrierekarten, Icons, Farben und Endabrechnung kommen aus je einem Theme-Set (`themes/original`, `themes/itfirma`), damit weitere Themen (z. B. Team-eigene) später ohne Logikänderung möglich sind. Sim-Tests und Bot-Balancing laufen für beide Themes.
  - **Büro-Twist („IT-Firma“-Modus):** Berufe wie Scrum Master, Praktikant:in, Vertrieb, CTO; Ereignisse wie „Reorg“, „Bonus gestrichen“, „Firmenfeier-Peinlichkeit“, „Tool-Migration“; Spielerinteraktion über Duell-Felder (Würfelvergleich), „Gehaltsverhandlung“ und Tausch-Karten.
  - **Technik (passt zur Architektur):** `games/life.js` als host-autoritatives Zustandsmodell (Brett als Datenstruktur: Felder mit `next[]` für Gabelungen, Ereignis-/Karrierekarten als Daten), RNG über seedbaren PRNG (testbar wie die anderen Sim-Tests). `ui/life.js` rendert das Brett als SVG/Canvas-Pfad mit Figuren (Avatare aus dem Hub) und Glücksrad-Animation. Clients senden nur Aktionen (`spin`, `chooseBranch`, `buy`, `confirm`), der Host validiert.
  - **Wiederverwendung:** Zug-Timer (wie UNO, 45 s → Auto-Zug), Bots (einfache Heuristik: Weiche nach Risikoprofil, Haus kaufen wenn Geld reicht), Reaktionsleiste, Wiederverbinden/Zuschauer, Spieleabend-Wertung (Punkte pro Platz), Achievements/Awards („Schuldenkönig“, „Haus-Magnat“, „Pechvogel“). Kein Echtgeld, nur Spielgeld.
  - **Umfang / Dauer:** Rundenzahl einstellbar (Kurz ≈ 15 min, Normal ≈ 30 min); ein vollständiges Brett mit ~60 Feldern reicht für v1. Hochformat-Handy: Brett scrollt/zoomt auf die eigene Figur, Aktion als große Buttons; Beamer-Modus zeigt das ganze Brett.
  - **Zwischenspeichern / Fortsetzen (Spiele dauern lange):** Da der Host der einzige Ort des Spielstands ist, speichert er ihn.
    - *Zustand:* Das gesamte Spiel ist ein serialisierbares JSON (Theme-ID, Brett-Position und Kontostand je Person, Kartenstapel inkl. Reihenfolge, PRNG-Seed + Zähler, aktiver Zug, Rundenzähler, Einstellungen). Keine Funktionen/Timer im State, UI wird daraus nur gerendert – dann ist Speichern trivial und ein Bonus für Tests.
    - *Wann:* Automatisch nach jedem abgeschlossenen Zug (1 Slot pro Raum, überschreibend) in `localStorage` des Host-Browsers; zusätzlich Knopf „Speichern & Pause“, der alle informiert („Spiel pausiert, bis der Host fortsetzt“).
    - *Fortsetzen:* Hub zeigt beim Host „Gespeichertes Spiel fortsetzen (Karriere-Leiter, Zug 23, 4 Personen, gestern)“. Host öffnet die Lobby mit dem alten Raumcode (falls frei, sonst neuer Code + neuer QR/Link); alle Spieler treten wieder bei. Zuordnung der Plätze über den bestehenden Sitzungsschlüssel (Wiederverbinden) bzw. per Namen/Avatar; fehlende Plätze kann der Host mit Bots besetzen oder Personen manuell zuordnen. Spiel startet erst, wenn alle Plätze belegt/bestätigt sind.
    - *Fallback:* Export/Import als `.json`-Datei (Browserdaten gelöscht, anderer Rechner, Beamer-PC wechselt). Version im Save (`schema: 1`) für spätere Migration; unbekannte/neuere Version wird abgelehnt.
    - *Grenzen:* Bei Browser-Absturz geht höchstens der laufende Zug verloren. Der Spieleabend-Modus speichert die Gesamtwertung mit (später, optional für alle Spiele nutzbar – Roulette/UNO/Codenames wären ähnlich langlebig).
    - *Datenschutz:* Nur Namen/Avatare/Spielstand lokal, nichts geht an einen Server.
  - **3D-Ansicht (gilt für „Karriere-Leiter“ und „Hotel“):** Prototyp mit three.js liegt vor und kam gut an (Szene mit Landschaft, Autos aus Grundformen, Würfel mit Landung auf der gewürfelten Zahl, Kamera per Ziehen/Pinch/Mausrad, „Kamera folgt der aktiven Figur“).
    - *Architektur:* Spiellogik (`games/*.js`) bleibt renderer-unabhängig; zwei Ansichten pro Spiel: 3D (Standard) und 2D/SVG als Rückfall. Umschalter in den Einstellungen, automatische Wahl der 2D-Ansicht, wenn WebGL fehlt oder das Gerät langsam ist (kurzer Frame-Zeit-Check beim Start).
    - *Einbindung:* three.js als lokale Datei (z. B. `three.min.js`, ~600 KB, wie `peerjs.min.js`), keine externen Requests, Version fest; nur beim Start eines 3D-fähigen Spiels laden (lazy), damit Hub und andere Spiele nicht langsamer werden.
    - *Gemeinsame 3D-Bausteine* (`ui/3d.js`): Szene/Kamera-Steuerung (Orbit per Pointer-Events, Pinch, Follow-Cam), Würfel (Physik-light, Zielzahl vorab vom Host bestimmt, damit alle Clients dasselbe sehen), Auto/Figur mit Avatar-Farbe/Hut, Gebäude- und Baum-Generatoren aus Grundformen, Floating-Text für Geld, Partikel für Ereignisse. Beide Spiele nutzen sie.
    - *Hotel in 3D:* Grundstücke als Parzellen, Hauptgebäude und Anbauten wachsen sichtbar in Stufen, Eingänge als Tore, Sterne-Schilder am Hotel; Auktions-Overlay (2D-HTML über der Szene).
    - *Themen:* Original (Wiese, Hügel, Bäume) und IT-Firma (Stadt, Hochhäuser, Serverräume) als Szene-Sets; gleiche Logik.
    - *Performance/Handy:* Schatten und Nebel abschaltbar, Pixel-Ratio begrenzen (max. 2), Objekte instanziieren, Render-Schleife pausieren, wenn der Tab im Hintergrund ist; im Beamer-Modus volle Qualität, auf Handys Controller-Ansicht schlank (Würfeln, Wählen, Eigene Karten) mit optionaler Mini-3D-Ansicht.
    - *Barrierefreiheit:* Alle Infos zusätzlich als Text (Chips, Ereigniskarte), nicht nur in der 3D-Szene; Bewegungsreduzierung (`prefers-reduced-motion`) schaltet Kamerafahrten und Würfelwirbel ab.
    - *Aufwand:* 🧱🧱 (größer als die 2D-Variante); Reihenfolge: erst Logik + 2D, dann 3D-Renderer als zweite Ansicht.
  - **Offene Fragen:** ~~Gleichzeitige oder abwechselnde Züge?~~ **Entschieden: nacheinander**, mit klarer visueller Info an alle: Spieler:in am Zug hervorgehoben (Rahmen/Pulsieren der Figur, Banner „X ist dran“), Kamera/Brett folgt der aktiven Figur, Glücksrad-Ergebnis und Ereigniskarte werden für alle groß eingeblendet (Wartende sehen, was passiert und warum), Geld-/Glücks-Änderungen als aufsteigende Zahlen, Zugreihenfolge-Leiste am Rand mit Timer. Wartezeit bei 6 Personen durch Kurzzüge (Auto-Weiter bei Feldern ohne Entscheidung) und Reaktionsleiste überbrücken. Offen bleibt: Eigene Ereignistexte vom Team (Verknüpfung mit „Eigene Inhalte“)? Kollisionsfrei (mehrere Figuren pro Feld) – ja, vereinfacht Logik.
  - **MVP-Schritte:** 1) Datenmodell + Sim-Tests (Brett, Karten, Endabrechnung) → 2) Host-Logik mit Bots → 3) UI Brett + Glücksrad → 4) Hub-Karte, Hilfe-Text, Spieleabend-Anbindung → 5) Balancing über Bot-Simulationen (Gewinnverteilung, Spieldauer).
- [ ] 🧱 **Hotel (MB-Klassiker, Idee):** Hotelmagnat-Brettspiel für 2–4 Personen (Original 1974, MB-Ausgaben 1986–1996, Neuauflage 2024 von Ooba Games/Asmodee, ca. 40 min): Hotels bauen und ausbauen, bei den Mitspielern kassieren. **Kernregeln** (nach dem inoffiziellen Regel-PDF https://hotelboardgame.com/images/PDF/Hotel-Rules-DE-www.hotelboardgame.com.pdf, maschinell übersetzt; Editionen können abweichen):
  - *Start:* 12.000 Spielgeld je Person, Autos auf „Parkplatz“, Reihenfolge im Uhrzeigersinn, Würfel (1–6), bei einer 6 nochmal dran. Autos teilen keine Felder (besetztes Feld → weiter zum nächsten freien).
  - *Hotel entwickeln:* Land kaufen (Kauffeld, nur eine Urkunde pro Zug, Bau erst im nächsten Zug) → Baugenehmigung → Hauptgebäude → Anbauten (feste Reihenfolge laut Urkunde) → Eingänge → Freizeiteinrichtungen. Fremdes Land ohne Gebäude: Pflichtkauf zum halben Preis.
  - *Baugenehmigung (Feld „Planungserlaubnis“, Würfel mit Farben):* rot = abgelehnt, grün = erteilt (zahlen und bauen), Doppel-H = kostenlos, doppelte 2 = doppelte Kosten; wer genehmigt wird, muss bauen.
  - *Einnahmen:* Landet jemand auf einem Feld mit Eingang eines fremden Hotels, würfelt er die Übernachtungen und zahlt Nächte × Preis laut Sterne-Bewertung (Hauptgebäude + Anbauten). Eingänge dürfen nicht gegenüber anderen Eingängen liegen; ein Eingang gegenüber einem fremden Hotel „stiehlt“ es.
  - *Felder:* Bank (beim Vorbeifahren +2.000, entfällt bei nur noch 2 Personen), Rathaus (beim Vorbeifahren Eingang pro Hotel), kostenloser Eintritt, kostenlose Bauphase.
  - *Pleite & Ende:* Wer nicht zahlen kann, versteigert ganze Hotels (kein Mindestpreis, alle bieten); findet sich kein Gebot, wird abgerissen. Ohne Geld, Hotels und Land ist man raus; die letzte Person im Spiel gewinnt.
  - *Darstellung:* Ebenfalls mit 3D-Ansicht (three.js), gemeinsame Bausteine mit „Karriere-Leiter“, Details siehe dort unter „3D-Ansicht“.
  - *Für Online-Umsetzung:* Das Vergessen-Kassieren der Tischversion („Augen offen halten“) entfällt, der Host rechnet automatisch; Auktion braucht eine Gebots-UI mit Timer; Spieldauer begrenzen (Rundenlimit oder Vermögen nach X Zügen), da „letzter Überlebender“ lang dauert. Technisch wiederverwendbar aus „Karriere-Leiter“: Brett-Datenmodell, Zugreihenfolge, Zug-Timer, Bots, Zwischenspeichern, Theme-Sets (z. B. Büro-Variante „Firmenkomplex“). Rechtlich: Name/Grafik nicht übernehmen, eigene Umsetzung mit eigenem Namen.
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
