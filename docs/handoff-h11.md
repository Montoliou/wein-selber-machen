---
id: wein-h11-wiki-startseiten-nachtragen
repo: wein-selber-machen
host: mac
base_branch: main
priority: hoch
scope: Neue Wiki-Startseiten erreichen bestehende Datenstände nie. START_WIKI_SEITEN wird nur in erzeugeStartdaten() verwendet, also beim allerersten Start eines Geräts ohne Server. Am 26.09.2026 kamen fünf Playbook-Artikel hinzu; Andis Datenstand kommt vom Server und würde sie nie erhalten. Neu - migriereDatenstand() ergänzt fehlende Startseiten, respektiert Grabsteine und überschreibt nichts.
allowed_paths: ["app/src/speicher/**", "app/README.md"]
forbidden_paths: ["app/src/domain/**", "app/src/ui/**", "app/src/sync.ts", "app/src/sensor.ts", "app/src/startdaten.ts", "app/src/wiki-inhalte.ts", "proxy/**", "docs/**", "inputs/**", "outputs/**", "journal/**", "CLAUDE.md", "AGENTS.md", ".ftp-credentials"]
tests: ["cd app && npm ci && npx tsc --noEmit && npx vitest run && npm run build"]
review_required: true
done_criteria:
  - "ALLE 74 bestehenden Tests bleiben gruen. domain/, ui/, sync.ts, startdaten.ts und wiki-inhalte.ts werden NICHT angefasst."
  - "W1 NACHTRAGEN: migriereDatenstand() in app/src/speicher/modell.ts ergänzt jede Seite aus START_WIKI_SEITEN (Import aus '../wiki-inhalte'), deren id weder in stand.wiki vorkommt noch als Grabstein mit sammlung 'wiki' in stand.geloescht steht."
  - "W2 NICHTS UEBERSCHREIBEN: Eine Seite, deren id schon im Datenstand steht, bleibt unverändert — auch wenn ihr Inhalt von der Startfassung abweicht. Andi kann Wiki-Seiten bearbeiten; seine Fassung gewinnt."
  - "W3 GRABSTEINE RESPEKTIEREN: Hat Andi eine Startseite gelöscht, kommt sie nicht zurück."
  - "W4 ABGLEICHSFAEHIG: Ergänzte Seiten tragen zuletztGeaendert = ihr aktualisiert-Feld, damit sie über sync.php auf alle Geräte wandern."
  - "W5 IDEMPOTENT: Mehrfaches Ausführen erzeugt keine Dubletten. migriereDatenstand läuft beim Laden, beim Abgleich auf beiden Seiten und beim Import — die Ergänzung muss das vertragen. Kein Eintrag in appMeta.migrationen nötig, die id-Prüfung genügt."
  - "T1 TESTS in app/src/speicher/modell.test.ts: (a) Stand mit den sieben alten Seiten erhält die fünf neuen (wiki-abziehen, wiki-schwefeln, wiki-messgeraete, wiki-vorlauf-pressen, wiki-weisswein); (b) Stand mit Grabstein für wiki-abziehen erhält diese Seite nicht; (c) Stand mit geänderter Seite wiki-kopfraum behält den geänderten Inhalt; (d) zweimaliges Migrieren ergibt dieselbe Seitenzahl; (e) ergänzte Seiten haben ein gültiges zuletztGeaendert."
  - "npm run build erzeugt weiterhin EINE app/dist/index.html plus sw.js, manifest.webmanifest und Icons. Keine neue Abhaengigkeit. Der PR enthaelt zwingend einen Abschnitt '## Offene Punkte'."
---

# Auftrag H11 — Neue Wiki-Seiten müssen auch bei bestehenden Nutzern ankommen

## Der Befund

Am 26.09.2026 wurden fünf Playbook-Artikel in `app/src/wiki-inhalte.ts` ergänzt: Abziehen,
Schwefeln mit Stammlösung, Messgeräte, Vorlauf und Pressen, Weißwein. Sie sind die
Handlungsanleitungen, die Andi im Oktober für die eigenen Reben und 2027 wieder braucht.

`START_WIKI_SEITEN` wird aber **nur** in `erzeugeStartdaten()` gelesen. Das passiert beim
allerersten Start eines Geräts, das keinen Serverstand findet. Andis Datenstand kommt vom
Server und enthält die sieben Seiten vom 30.08. **Die neuen Artikel würden deployt und nie
gesehen.**

Das ist dieselbe Bruchklasse wie die Seed-Kennungen vom 04.09.2026: Der Startdatensatz wird
als einmalige Aussaat behandelt, obwohl sich sein Inhalt weiterentwickelt.

## Warum in migriereDatenstand

Die Funktion läuft an jeder Stelle, an der ein Datenstand in die App kommt: beim Laden aus
IndexedDB, beim Abgleich auf beiden Seiten und beim Import. Ergänzt sie fehlende Seiten, sind
sie nach dem nächsten Öffnen da und wandern über den Abgleich auf alle Geräte.

## Warum die Grabstein-Prüfung zählt

Ohne sie käme jede Startseite, die Andi löscht, beim nächsten Laden zurück. Eine gelöschte
Seite bleibt gelöscht.

## Nach dem Bau

Im PR zeigen: die Testausgabe für T1 (a) bis (e). Keine Screenshots nötig, die Oberfläche
ändert sich nicht.
