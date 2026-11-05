# Allgemein
- [x] warum sind nicht alle games im games ordner? -> Erledigt: `game.js` wurde nach `games/curve.js` verschoben. Alle 8 Spiele liegen nun einheitlich und modular in `games/`.

# Tanks:
- [x] steuerkreuz bei tanks ist erst durch scrollen sichtbar. besser so ein virtueller analog stick? -> Erledigt: Steuerkreuz durch einen ergonomischen virtuellen Analog-Joystick mit Touch-/Maus-Erkennung ersetzt. Viewport auf `100dvh` fixiert (kein Scrollen mehr nötig).

# montagsmaler:
- [x] zeit läuft nicht runter? -> Erledigt: Der Timer-Countdown wird nun jede Sekunde (`Math.ceil(timeLeft)`) und bei Buchstaben-Hinweisen autoritativ synchronisiert und im UI aktualisiert.

# curve
- [x] wirkt sich links rechts troll auch auf bots aus? -> Ja! Der Invert-Effekt betrifft auch Bots (Bot will z. B. nach links lenken, Curve dreht jedoch invertiert nach rechts in die Wand). Durch automatisierten Test in `sim-tests.mjs` verifiziert.
- [x] perks in einstellungen deaktivierbar -> Erledigt: Power-Ups / Perks lassen sich sowohl in den Lobby-Einstellungen als auch direkt im Curve-HUD über den ⚡-Button per Klick ein- und ausschalten (Orbs und Effekte werden bei Deaktivierung sofort bereinigt).
