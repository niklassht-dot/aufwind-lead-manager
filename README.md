# Aufwind Lead Manager

Interne Anruf- und Follow-up-Liste von Aufwind Studio.
Alle Änderungen werden zentral bei Netlify gespeichert. Jeder, der die Seite mit PIN öffnet, sieht dieselbe Liste. Änderungen anderer erscheinen nach spätestens etwa 8 Sekunden, beim Zurückwechseln in den Tab sofort.

## Aufbau

```
public/                 Website (index.html, assets/css, assets/js)
netlify/functions/      API: /api/leads (Speicherung in Netlify Blobs)
netlify.toml            Netlify-Konfiguration
package.json            Abhängigkeit @netlify/blobs
```

## Einmalig: auf Netlify veröffentlichen

Die Seite braucht jetzt eine kleine Server-Funktion. **Drag & Drop reicht dafür nicht mehr**, es geht über die Netlify CLI:

```bash
cd ~/Downloads/aufwind-lead-manager
npm install
npx netlify-cli login                # öffnet den Browser → bei Netlify anmelden
npx netlify-cli link                 # bestehende Seite „leadsaufwind“ auswählen
npx netlify-cli deploy --prod        # veröffentlicht Seite + Funktion
```

Danach ist alles unter https://leadsaufwind.netlify.app/ erreichbar.
Für spätere Updates reicht `npx netlify-cli deploy --prod`.

**Wichtig beim ersten Öffnen:** Öffne die neue Version zuerst in dem Browser, in dem deine bisherige Liste liegt. Das erste Gerät, das die leere gemeinsame Liste vorfindet, lädt seine lokalen Daten hoch. Hat das Gerät keine lokalen Daten, werden die Startdaten verwendet (Stand: Export vom 15.10.2026).

## PIN

- Standard-PIN: **2109**. Er wird auf dem Server geprüft. Ohne PIN liefert die API keine Daten.
- PIN ändern (4 Ziffern): Netlify → Site configuration → Environment variables → `LEADS_PIN` anlegen, dann neu deployen.
- Mit „Auf diesem Gerät angemeldet bleiben“ wird der PIN auf dem Gerät gemerkt, praktisch fürs Handy und die Push-Nachrichten. Der Button „Sperren“ meldet das Gerät wieder ab.

## Anrufe nach dem Entwurf und Tages-To-do-Liste

Im Lead trägst du nur **„Entwurf verschickt am“** ein. Die App plant daraus den **Anruf 5 Tage später**.
Fällt der Tag auf Samstag, Sonntag oder einen gesetzlichen Feiertag, rutscht der Anruf auf den nächsten Werktag. Berücksichtigt werden die bundesweiten Feiertage und die in Mecklenburg-Vorpommern (8. März und 31. Oktober).

Oben auf der Seite steht **„Heute zu tun“**:

- **Nachholen:** Anrufe und Follow-ups von früheren Tagen, die noch nicht abgehakt sind
- **Heute:** alles, was heute fällig ist
- **Heute erledigt:** abgehakte Aufgaben. Ein Klick auf das Häkchen macht eine Aufgabe wieder offen.

Abhaken geht direkt in der Liste oder im Lead über „Anruf erledigt“ bzw. „Follow-up erledigt“.
Änderst du das Entwurfs- oder Follow-up-Datum, wird die Aufgabe automatisch wieder offen.

## Push-Benachrichtigungen

Jeden Tag ab 8 Uhr kommt pro offener Aufgabe eine Nachricht, zum Beispiel „Firma xy anrufen“ oder „Firma xy: Follow-up fällig“.
Wird eine Aufgabe nicht abgehakt, kommt sie an jedem folgenden Werktag erneut, etwa als „Firma xy anrufen – nachholen (seit 20.10.)“. Das geht so weiter, bis sie abgehakt ist.
Antippen öffnet den Lead mit allen Notizen. Für Leads mit dem Status Kunde oder Abgelehnt kommen keine Erinnerungen.

Einrichten pro Handy:

- **iPhone (ab iOS 16.4):** Seite in Safari öffnen → „Teilen“ → „Zum Home-Bildschirm“. Danach die App „Anrufliste“ vom Home-Bildschirm öffnen, PIN eingeben, „🔔 Push aktivieren“ tippen und erlauben.
- **Android:** Seite in Chrome öffnen, PIN eingeben, „🔔 Push aktivieren“ tippen und erlauben. Optional über das Chrome-Menü zum Startbildschirm hinzufügen.

Nach dem Aktivieren kommt sofort eine Test-Nachricht. Die Schlüssel für den Versand werden automatisch erzeugt, dafür ist keine Einrichtung nötig.

## Lead aus Bild

Mit „📷 Lead aus Bild“ oder im Lead mit „Aus Bild ausfüllen“ lädst du einen Screenshot hoch, zum Beispiel von Google Maps, einer Website oder Instagram, oder ein Foto einer Visitenkarte. Claude liest daraus Firma, Ansprechpartner, Telefon, Website und kurze Notizen aus. Felder, die schon ausgefüllt sind, werden nicht überschrieben. Am Rechner kannst du ein Bild auch mit Strg/Cmd + V einfügen.

**Kostenlos (Standard):** Die Texterkennung läuft direkt im Browser (Tesseract, liegt unter `public/vendor/tesseract`). Du musst nichts einrichten, und die Bilder verlassen das Gerät nicht. Beim ersten Mal werden etwa 5 MB geladen. Ansprechpartner erkennt diese Variante nicht, und bei unruhigen Screenshots muss man öfter nachbessern.

**Genauer (optional, kostet pro Bild etwas):** Mit einem Claude-API-Schlüssel liest Claude das Bild aus. Ist der Schlüssel gesetzt, wird automatisch diese Variante genutzt.
```bash
npx netlify-cli env:set ANTHROPIC_API_KEY sk-ant-...
npx netlify-cli deploy --prod
```

## Lokal testen

```bash
npm install
npx netlify-cli dev
```

Danach http://localhost:8888 öffnen.
Lokal nutzt Netlify einen eigenen Test-Speicher, nicht die echten Daten. `python3 -m http.server` funktioniert nicht mehr, weil dort die API fehlt.

## Sicherung

Im Menü **Daten → Als JSON exportieren** sicherst du die gemeinsame Liste.
**JSON importieren** ersetzt die gemeinsame Liste für alle.
