# App-Anforderungen – Weinbegleiter 2026

## Ziel
Mobile App für einen kompletten Wein-Jahrgang.

## Kernfunktionen
- Jahrgang anlegen
- Chargen anlegen/splitten
- Messungen erfassen
- Behälter, Füllvolumen und Kopfraum erfassen
- Ereignisse/Zugaben protokollieren
- Fotos je Ereignis
- nächste Aktion anzeigen
- Audit-Ampel
- Stop-Gates
- Erinnerungen
- Export als Markdown/JSON/CSV/ZIP

## Zustandsmaschine
ERNTE -> SORTIEREN -> ENTRAPPEN -> MOSTANALYSE -> KALTMAZERATION -> ANSTELLEN ->
AKTIVE_GAERUNG -> PRESS_GATE -> NACHGAERUNG -> GAERENDE_GATE -> ERSTER_ABSTICH ->
AUSBAU -> STABILITAETS_GATE -> SUESSE_GATE -> ABFUELL_GATE -> FLASCHE

## Messwerte
- Temperatur
- °Oe
- SG
- Brix
- pH
- Gesamtsäure
- freier SO₂
- Gesamt-SO₂
- YAN
- Volumen
- Kopfraum
- Geruch
- Geschmack
- Oberfläche
- Gäraktivität

## Ampel
GREEN: normal
YELLOW: Abweichung
ORANGE: Charge isolieren
RED: keine Vermischung / Abfüllung
