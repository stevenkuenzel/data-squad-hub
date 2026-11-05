# Allgemein
- [x] warum sind nicht alle games im games ordner? -> Erledigt: `game.js` wurde nach `games/curve.js` verschoben. Alle 8 Spiele liegen nun einheitlich und modular in `games/`.

# Tanks:
- [x] steuerkreuz bei tanks ist erst durch scrollen sichtbar. besser so ein virtueller analog stick? -> Erledigt: Steuerkreuz durch einen ergonomischen virtuellen Analog-Joystick mit Touch-/Maus-Erkennung ersetzt. Viewport auf `100dvh` fixiert (kein Scrollen mehr nötig).

# montagsmaler:
- [x] zeit läuft nicht runter? -> Erledigt: Der Timer-Countdown wird nun jede Sekunde (`Math.ceil(timeLeft)`) und bei Buchstaben-Hinweisen autoritativ synchronisiert und im UI aktualisiert.

# curve
- [x] wirkt sich links rechts troll auch auf bots aus? -> Ja! Der Invert-Effekt betrifft auch Bots (Bot will z. B. nach links lenken, Curve dreht jedoch invertiert nach rechts in die Wand). Durch automatisierten Test in `sim-tests.mjs` verifiziert.
- [x] perks in einstellungen deaktivierbar -> Erledigt: Power-Ups / Perks lassen sich sowohl in den Lobby-Einstellungen als auch direkt im Curve-HUD über den ⚡-Button per Klick ein- und ausschalten (Orbs und Effekte werden bei Deaktivierung sofort bereinigt).

# comm dodgeball
- [x] wie kann man fangen? -> Erledigt: Fangen ist nun über `Shift`, `Rechtsklick`, `C`, `F` oder auf Mobile über den prominenten `FANGEN / DASH 🧤` Button möglich! Catch-Radius wurde vergrößert, Partikeleffekt & "🎯 GEFANGEN!"-Banner hinzugefügt und Steuerungs-Pill direkt im HUD eingebunden.
- [x] Spezialangriff: "Das große ComM-Paket" -> Erledigt: Goldenes Riesen-Paket (📦) spawnt periodisch. Bei Einschlag explodiert es in einen Cluster-Schwall aus 1x Stein im Weg, 1x Agentur-Rechnung & 1x Aktenordner!
- [x] Icons auf Bälle schwer zu erkennen -> Erledigt: Bälle vergrößert, mit kontraststarkem dunklem Kreis-Kern, leuchtendem Neon-Ring und vergrößerten 22-30px Emojis + Namens-Tag unter Bodenbällen versehen.

# comm kartenspiel
- [x] Text auf Karten ragt unten hinaus -> Erledigt: Kartengröße auf `124px x 176px` erweitert, `overflow: hidden`, Textgrößen und Abstände optimiert, sodass alle Beschreibungen sauber und vollständig hineinpassen.
- [x] Irgendwie zu wenige Karten -> Erledigt: Deck von 54 auf 99 Karten und von 12 auf 18 einzigartige satirische Kartentypen erweitert (neu: KI ins Dashboard gebaut, Stiller Feature-Flag, Doppelter Espresso, Datenschutz-Bedenken, Corporate Wording, Vorstandspräsentation).
