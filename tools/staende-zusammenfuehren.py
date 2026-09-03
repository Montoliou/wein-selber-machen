#!/usr/bin/env python3
"""
Führt mehrere Weinbegleiter-Vollsicherungen zu einer zusammen.

Übergangslösung, bis Handoff H5 den Geräteabgleich in der App erledigt.
Anlass: Am 03.09.2026 lagen Messungen auf dem iPad und weitere auf dem MacBook,
und ein Import hätte jeweils den anderen Stand überschrieben.

Warum das sicher geht: Neue Datensätze erhalten ihre Kennung über
crypto.randomUUID() und sind damit geräteübergreifend eindeutig. Nur die
Startdatensätze tragen fortlaufende Nummern (m-1, e-1 …) — die sind auf allen
Geräten identisch, dort ist Vereinigen genau richtig.

Aufruf:
    python3 tools/staende-zusammenfuehren.py a.json b.json [c.json …] -o zusammen.json

Bei gleicher Kennung mit unterschiedlichem Inhalt gewinnt der Datensatz mit dem
jüngeren Zeitstempel. Jeder solche Fall wird gemeldet — stillschweigend
entschieden wird nichts.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

# Sammlungen mit einer id-Eigenschaft, die vereinigt werden.
SAMMLUNGEN_MIT_ID = [
    "chargen", "behaelter", "messungen", "ereignisse",
    "reminder", "wiki", "vorrat",
]

# Feld, aus dem bei einem Konflikt das Alter abgeleitet wird — erstes vorhandenes zählt.
ZEITFELDER = ["zuletztGeaendert", "zeit", "aktualisiert", "faellig", "startdatum"]


def zeitstempel(datensatz: dict[str, Any]) -> str:
    for feld in ZEITFELDER:
        wert = datensatz.get(feld)
        if isinstance(wert, str) and wert:
            return wert
    return ""


def lade(pfad: Path) -> dict[str, Any]:
    daten = json.loads(pfad.read_text(encoding="utf-8"))
    if daten.get("schema") != "weinbegleiter-v1":
        sys.exit(f"FEHLER {pfad.name}: keine Weinbegleiter-Vollsicherung "
                 f"(schema = {daten.get('schema')!r}).")
    if not isinstance(daten.get("datenstand"), dict):
        sys.exit(f"FEHLER {pfad.name}: Feld 'datenstand' fehlt oder ist kein Objekt.")
    return daten


def main() -> None:
    p = argparse.ArgumentParser(description="Weinbegleiter-Vollsicherungen zusammenführen.")
    p.add_argument("dateien", nargs="+", type=Path)
    p.add_argument("-o", "--ausgabe", required=True, type=Path)
    args = p.parse_args()

    sicherungen = [(pfad, lade(pfad)) for pfad in args.dateien]

    print(f"Führe {len(sicherungen)} Stände zusammen.\n")
    for pfad, s in sicherungen:
        d = s["datenstand"]
        print(f"  {pfad.name}")
        print(f"    exportiert: {s.get('exportiert', '?')}")
        for sammlung in SAMMLUNGEN_MIT_ID + ["klima"]:
            print(f"    {sammlung}: {len(d.get(sammlung, []))}", end="  ")
        print(f"\n    fotos: {len(s.get('fotos', []))}\n")

    basis = sicherungen[0][1]
    ergebnis: dict[str, Any] = json.loads(json.dumps(basis))
    ziel = ergebnis["datenstand"]
    konflikte: list[str] = []

    for sammlung in SAMMLUNGEN_MIT_ID:
        nach_id: dict[str, dict[str, Any]] = {}
        herkunft: dict[str, str] = {}
        for pfad, s in sicherungen:
            for datensatz in s["datenstand"].get(sammlung, []):
                kennung = datensatz.get("id")
                if not kennung:
                    continue
                vorhanden = nach_id.get(kennung)
                if vorhanden is None:
                    nach_id[kennung] = datensatz
                    herkunft[kennung] = pfad.name
                elif vorhanden != datensatz:
                    alt, neu = zeitstempel(vorhanden), zeitstempel(datensatz)
                    if neu > alt:
                        nach_id[kennung] = datensatz
                        gewinner, verlierer = pfad.name, herkunft[kennung]
                        herkunft[kennung] = pfad.name
                    else:
                        gewinner, verlierer = herkunft[kennung], pfad.name
                    konflikte.append(
                        f"{sammlung}/{kennung}: in {gewinner} und {verlierer} verschieden "
                        f"— genommen aus {gewinner}"
                    )
        ziel[sammlung] = list(nach_id.values())

    # Klimapunkte haben keine id. Entdoppeln über Zeitpunkt und Quelle.
    klima: dict[tuple[str, str], dict[str, Any]] = {}
    for _, s in sicherungen:
        for punkt in s["datenstand"].get("klima", []):
            klima[(punkt.get("zeit", ""), punkt.get("quelle", ""))] = punkt
    ziel["klima"] = sorted(klima.values(), key=lambda x: x.get("zeit", ""))

    # Sensor: die eingerichtete Konfiguration gewinnt.
    for _, s in sicherungen:
        sensor = s["datenstand"].get("sensor") or {}
        if str(sensor.get("url", "")).strip():
            ziel["sensor"] = sensor
            break

    # Fotos vereinigen.
    fotos: dict[str, Any] = {}
    for _, s in sicherungen:
        for foto in s.get("fotos", []):
            if foto.get("id"):
                fotos[foto["id"]] = foto
    ergebnis["fotos"] = list(fotos.values())

    ziel["version"] = max(int(s["datenstand"].get("version", 1)) for _, s in sicherungen)

    args.ausgabe.write_text(
        json.dumps(ergebnis, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print("Ergebnis:")
    for sammlung in SAMMLUNGEN_MIT_ID + ["klima"]:
        print(f"  {sammlung}: {len(ziel.get(sammlung, []))}", end="  ")
    print(f"\n  fotos: {len(ergebnis['fotos'])}")
    print(f"\nGeschrieben nach {args.ausgabe}")

    if konflikte:
        print(f"\n{len(konflikte)} Konflikt(e) — bitte ansehen:")
        for zeile in konflikte:
            print(f"  · {zeile}")
    else:
        print("\nKeine Konflikte: keine Kennung kam mit unterschiedlichem Inhalt doppelt vor.")

    print("\nHinweis: Gelöschte Datensätze können mit diesem Werkzeug nicht erkannt werden. "
          "Wurde auf einem Gerät etwas gelöscht, taucht es hier wieder auf. "
          "Das behebt erst H5 mit Grabsteinen.")


if __name__ == "__main__":
    main()
