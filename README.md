# Puffer-Simulator

Pufferwirkung im Vergleich: ein Acetatpuffer, reine Essigsäure und verdünnte Salzsäure erhalten gleiche Stoffmengen Natronlauge oder Salzsäure. Die Seite zeigt die Reaktionen auf Teilchenebene, den pH-Wert jeder Lösung und den pH-Verlauf, dazu eine schrittweise Erklärung in 16 Schritten für die Vorlesung.

**Live:** https://michelebonus.github.io/puffer-simulator/

## Verwendung

Die Seite ist eine einzelne HTML-Datei ohne Build-Schritt. `index.html` im Browser öffnen oder den Link oben aufrufen. Sie ist für die Projektion im Hörsaal (16:9, 1080p) ausgelegt und funktioniert ebenso auf Laptop und Handy, in hellem und dunklem Modus.

- Säure-Base-Paar und Stoffmengenanteil von A⁻ in Lösung A sind oben rechts einstellbar.
- Jede Lösung lässt sich einzeln oder gemeinsam mit OH⁻ oder H₃O⁺ versetzen; eine Kugel entspricht 0,0025 mol/L.
- Die Lösungen sind gefärbt wie mit Universalindikator; die Färbung folgt dem pH-Wert.
- „Erklärung starten“ in der Leiste am unteren Rand führt durch die drei Lösungen.

pH-Werte werden aus der vollständigen Ladungsbilanz mit K<sub>W</sub> = 10⁻¹⁴ berechnet; die Verdünnung durch die Zugabe ist vernachlässigt.

## Tests

Browser-Tests mit headless Chrome liegen in `tests/` (siehe dortige README).

    cd tests
    npm install
    npm test
