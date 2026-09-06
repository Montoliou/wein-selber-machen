---
id: wein-h9-formular-id-verdeckt
repo: wein-selber-machen
host: mac
base_branch: main
priority: hoch
scope: Drei Formulare tun beim Absenden nichts - ohne Fehlermeldung. Ursache: Ein Formularfeld mit name="id" ueberschreibt in der DOM-Spezifikation die Eigenschaft form.id. Der Submit-Verteiler vergleicht formular.id mit einer Zeichenkette, bekommt aber ein HTMLInputElement und findet nie einen Treffer. Betroffen sind behaelter-ausmustern-form, behaelter-verwalten-form und wiki-form. Der Press-Gate ist NICHT betroffen.
allowed_paths: ["app/src/ui/**", "app/README.md"]
forbidden_paths: ["app/src/domain/**", "app/src/speicher/**", "app/src/sync.ts", "app/src/sensor.ts", "app/src/startdaten.ts", "app/src/wiki-inhalte.ts", "proxy/**", "docs/**", "inputs/**", "outputs/**", "journal/**", "CLAUDE.md", "AGENTS.md", ".ftp-credentials"]
tests: ["cd app && npm ci && npx tsc --noEmit && npx vitest run && npm run build"]
review_required: true
done_criteria:
  - "ALLE 71 bestehenden Tests bleiben gruen. domain/ wird NICHT angefasst."
  - "F1 URSACHE BEHEBEN: In behandleSubmit wird die Formularkennung ueber formular.getAttribute('id') gelesen statt ueber formular.id. Das behebt alle drei Faelle auf einmal und immunisiert den Verteiler gegen kuenftige Felder, die eine Formulareigenschaft verdecken."
  - "F2 ZWEITE SICHERUNG: Die drei betroffenen versteckten Felder werden umbenannt - name='id' wird zu name='behaelterId' (behaelter-ausmustern-form, behaelter-verwalten-form) und name='wikiId' (wiki-form). Die zugehoerigen Handler lesen die neuen Namen. Beides zusammen, nicht eins davon: F1 macht den Verteiler robust, F2 nimmt die Falle aus dem Markup."
  - "F3 GLEICHE FALLE SUCHEN: Pruefen, ob weitere Felder Eigenschaften von HTMLFormElement verdecken - verboten sind als name unter anderem id, action, method, target, elements, length, name, submit, reset, checkValidity. Gefundene Faelle mitbenennen und im PR auflisten. Steht keiner mehr drin, gehoert das ausdruecklich in den PR-Text."
  - "T1 TEST, DER DEN FEHLER GEFANGEN HAETTE: Der bestehende Test 'lehnt Ausmustern ohne Grund ab' verschickt ein kuenstliches SubmitEvent direkt an das Formular und laeuft deshalb an der Ursache vorbei. Neu: Ein Test, der den Absendeknopf per click() betaetigt - also den Weg des Benutzers - und danach prueft, dass ausgemustertAm und ausgemustertGrund gesetzt sind und der Dialog geschlossen ist. Derselbe Klickweg fuer behaelter-verwalten-form und wiki-form."
  - "T2 REGRESSIONSSCHUTZ: Ein Test, der ueber ALLE gerenderten Formulare laeuft und sicherstellt, dass kein Feldname eine Eigenschaft von HTMLFormElement verdeckt. Damit faellt die naechste Wiederholung sofort auf."
  - "npm run build erzeugt weiterhin EINE app/dist/index.html plus sw.js, manifest.webmanifest und Icons. Keine neue Abhaengigkeit. Der PR enthaelt zwingend einen Abschnitt '## Offene Punkte'."
---

# Auftrag H9 — Ein Feld namens „id" legt drei Formulare lahm

## Der Befund

Andi am 06.09.2026, nach dem Abziehen des Vorlaufs:

> „Ich kann den kleinen Ballon nicht ausmustern — die app nimmt den Befehl nicht. wenn ich
> ausmustern tippe im Menü wo ich den text erfasse — passiert einfach nichts"

Im Browser nachgestellt und eingekreist. Alles sieht richtig aus: Das Submit-Ereignis
feuert, das Formular ist gültig, der Grund steht im Feld, der Knopf liegt im Formular,
`this.root` ist Vorfahr. Trotzdem passiert nichts, und es erscheint **keine Fehlermeldung.**

## Die Ursache

```
form.getAttribute('id')  →  "behaelter-ausmustern-form"
form.id                  →  [object HTMLInputElement]
```

Das Formular enthält `<input type="hidden" name="id" value="ballon-klein-2">`. Nach der
HTML-Spezifikation werden benannte Formularelemente als Eigenschaften am Formularobjekt
abgelegt — und **verdecken dabei gleichnamige eingebaute Eigenschaften.** `form.id` ist
deshalb nicht mehr die Zeichenkette, sondern das Eingabefeld.

Der Verteiler in `behandleSubmit` vergleicht:

```ts
if (formular.id === 'behaelter-ausmustern-form') return this.mustereBehaelterAus(formular)
```

Ein `HTMLInputElement` ist nie gleich einer Zeichenkette. **Kein Zweig trifft, die Methode
läuft nie, und weil am Ende kein `else` steht, gibt es auch keine Meldung.** Für den
Benutzer sieht das aus wie ein toter Knopf.

Betroffen: `behaelter-ausmustern-form`, `behaelter-verwalten-form`, `wiki-form`.
**Nicht betroffen: der Press-Gate** (`press-teilung-form`, `gate-mess-form`) und alles,
was am Presstag gebraucht wird.

## Warum der Review das nicht gefunden hat — und was daraus folgt

Der Test zu H8 sieht so aus:

```ts
root.querySelector('#behaelter-ausmustern-form').dispatchEvent(new SubmitEvent('submit', …))
```

Er verschickt das Ereignis **direkt an das Formular**. Damit ist `event.target` gesetzt,
der Verteiler bekommt sein Objekt — aber der Weg, den ein Mensch geht, nämlich **auf den
Knopf tippen**, wird nie geprüft. Der Test war grün, während die Funktion tot war.

Das ist die eigentliche Lehre: **Ein Test, der den Auslöser umgeht, prüft die Funktion
nicht.** Deshalb ist T1 hier kein Beiwerk, sondern der Kern des Auftrags.

## Constraints

- Vanilla TypeScript, keine neue Abhängigkeit.
- `domain/` ist tabu.
- Bei fachlicher Unklarheit: `## Offene Punkte` im PR.

## Nach dem Bau

Screenshot des Ausmustern-Dialogs vor und nach dem Klick, plus die Gefäßliste mit dem
ausgemusterten Eintrag.
