---
name: mockup-erfassen-v3
titel: Weinbegleiter — Erfassungsbildschirm mit zwei Modi
erzeugt: 2026-09-03
erzeugt_von: Claude Code — Sitzung "Wein-App Bau"
gueltig: aktuell
typ: design-mockup
projekt: wein-selber-machen
status: Design-Soll fuer Handoff H3
---

Anlass: Andis erste Messrunde am iPad am Morgen des 03.09.2026. Zwei Befunde.

**Fehler:** Beim Wechsel der Messgröße springt die Chargenauswahl auf Bottich 1 zurück.
Das Formular wird neu gezeichnet und verliert die Auswahl.

**Konzeptfehler in meiner Spezifikation zu H1:** Das Formular ist messgrößen-zentriert —
eine Größe, viele Chargen. Andis Arbeitsablauf ist umgekehrt: Er geht zweimal täglich die
Bottiche ab, stößt den Tresterhut unter und hat an jedem Bottich Temperatur, Mostgewicht,
Geruch und Gäraktivität gleichzeitig vor sich. Für ihn ist die Charge die Konstante.

Deshalb künftig zwei Modi, umschaltbar in Klartext beschriftet:
**„Ein Bottich / viele Werte"** und **„Ein Wert / alle Bottiche"**.

Zwei Zutaten, die nicht verlangt waren und aus dem Befund folgen:

- **Phasengerechte Felder.** Die App kennt die Phase und zeigt die Messgrößen, die jetzt
  zählen; der Rest bleibt unter einer Schublade vollständig erreichbar. Derselbe Gedanke
  wie bei den Erklärschubladen aus H2 — nicht weniger können, sondern weniger gleichzeitig zeigen.
- **Die Runde.** Nach dem Speichern ein Knopf „Weiter zu Bottich N", damit der Rundgang
  ohne Umweg über das Menü läuft. Andi macht diese Runde zweimal täglich über Wochen;
  jeder Umweg ist ein Grund, es irgendwann sein zu lassen.
