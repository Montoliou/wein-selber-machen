---
name: mockup-weinbegleiter-v2
titel: Weinbegleiter 2026 — Mockup v2 (Nutzerführung und Animationen)
erzeugt: 2026-09-02
erzeugt_von: Claude Code — Sitzung "Wein-App Bau"
gueltig: aktuell
typ: design-mockup
projekt: wein-selber-machen
status: wartet auf Abnahme durch Andi
ersetzt: mockup-weinbegleiter-v1 (bleibt gültig als Grundlage von H1)
---

Zweite Ausbaustufe. Anlass: Andi nach einem Tag Nutzung — „So gaaaanz verstehe ich die
App nämlich noch nicht." Auflage von ihm: **der kurze schnelle Überblick darf nicht leiden.**

## Leitentscheidung

Erklärung wird nicht *neben* den Status gestellt, sondern *unter* ihn. Der obere
Bildschirmbereich bleibt reine Zahlenanzeige; jede Erklärung steckt in einer
zugeklappten Schublade, die nur auf Antippen aufgeht. Damit bleibt der Zwei-Sekunden-Blick
unverändert schnell, und die Erklärung ist trotzdem genau dort, wo die Frage entsteht.

## Was neu ist

1. **Statusband** ganz oben: Chargen, schlechteste Ampel, Gärtag, offene Aufgaben.
   Vier Zahlen, eine Zeile.
2. **Gärverlaufskurve** mit gemessenen Werten durchgezogen, Erwartung gestrichelt und
   eingezeichnetem Pressfenster. Beantwortet ohne Lesen: läuft es normal?
3. **Phasen-Zeitstrahl** mit Klartextsatz, was gerade im Bottich passiert und was zu tun ist.
4. **Erklärschubladen** an Kurve, Aufgabe, Ampel und Zeitstrahl — zugeklappt.
5. **Meldungen bleiben stehen**, bis sie weggetippt werden. Anlass: Am 02.09. ist eine
   abgelehnte Vollsicherung unbemerkt geblieben, weil das Statusband nach Sekunden wegblendete.

## Animationen — Zweck vor Zierde

| Animation | Was sie erklärt |
|---|---|
| Kurve zeichnet sich | Richtung und Tempo der Gärung |
| Tresterhut hebt und senkt sich, Bläschen steigen | Was Unterstoßen bedeutet |
| Aktuelle Phase pulsiert | Wo man steht |
| Gate-Prüfungen laufen nacheinander ein | Es wird wirklich gerechnet, und woran es hängt |

Alle unter 600 ms, `prefers-reduced-motion` respektiert.

## Offen für den Handoff H2

Zusätzlich zur UI sind vier Datenmodell-Reparaturen fällig, **vor dem Pressen**:
Bedeutung von `fuellLiter`, fehlende Volumenhistorie, Entkopplung von Vorrat und Zugaben,
Chargen-Abstammung als Seitentabelle statt als Modell.
