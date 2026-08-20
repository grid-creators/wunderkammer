# Wunderkammer Gotha

**Webseite: [https://gotha.friedenstein.de/](https://gotha.friedenstein.de/)**

Eine zweisprachige (DE/EN) interaktive Karte und ein POI-Explorer für Bau- und
Kulturdenkmale in Gotha. Die Anwendung verbindet Inhalte aus **Wikipedia**,
**Wikidata**, **FactGrid** und **Wikimedia Commons** zu einem gemeinsamen
Stadtrundgang.

---

## Inhalt

- [Funktionen](#funktionen)
- [Schnellstart](#schnellstart)
- [Befehle](#befehle)
- [Projektstruktur](#projektstruktur)
- [Datenfluss](#datenfluss)
- [Admin-Dashboard](#admin-dashboard)
- [Konfiguration](#konfiguration)
- [Datenerhebung (Python-Skripte)](#datenerhebung-python-skripte)
- [Corporate Design](#corporate-design)
- [Lizenz und Datenquellen](#lizenz-und-datenquellen)

---

## Funktionen

- **Kartenansicht** auf Basis von Leaflet (`react-leaflet`) mit Markern für alle POIs
- **Listenansicht** als alternative Navigation über dieselben Orte
- **Detailansicht** je POI mit Wikipedia-Zusammenfassung, Wikidata- und
  FactGrid-Aussagen, Commons-Bildergalerie und Abrufstatistik (Pageviews)
- **Zweisprachigkeit DE/EN** über `react-i18next` (Standardsprache: Deutsch)
- **Admin-Dashboard** zur redaktionellen Pflege der Anzeige ohne Code-Änderung
- **Prebuild-Schritt**, der externe Daten vorab abruft und statisch ausliefert

Aktuell enthalten sind unter anderem Bahnhof Gotha, Orangerie, Altes Theater,
Bauhaus-Kaufhaus, Neumarkt und Margarethenkirche, Innungshalle/Handelsschule,
Jüdenstraße und Schwarzes Viertel, Rathaus, Wasserkunst, Schloss Friedenstein
und das Herzogliche Museum.

---

## Schnellstart

Voraussetzungen: **Node.js 20+** und npm.

```bash
git clone https://github.com/grid-creators/wunderkammer.git
cd wunderkammer/app
npm install
npm run dev
```

Die Anwendung läuft anschließend unter <http://localhost:3000>.

Für den Produktivbetrieb:

```bash
cd app
npm run build     # Daten vorbereiten, Typprüfung, Vite-Build nach dist/
npm run start     # Express-Server im Produktionsmodus
```

---

## Befehle

Alle Befehle werden im Verzeichnis `app/` ausgeführt:

| Befehl | Beschreibung |
| --- | --- |
| `npm run dev` | Startet Express inklusive Vite-Middleware (Port 3000) |
| `npm run build` | Prebuild der Daten, TypeScript-Prüfung und Vite-Produktionsbuild |
| `npm run start` | Produktionsserver: liefert `dist/` und die API aus |
| `npm run prebuild` | Holt externe Daten nach `public/data/pois-prebuilt.json` |
| `npm run lint` | ESLint über das Projekt |

---

## Projektstruktur

```
.
├── app/                       # React-/TypeScript-Anwendung mit Express-Backend
│   ├── server.ts              # Express-Server: API, Auth, Auslieferung
│   ├── scripts/prebuild.ts    # Vorabruf externer Daten zur Buildzeit
│   ├── public/data/           # Erzeugte Daten (pois-prebuilt.json)
│   └── src/
│       ├── data/pois.ts       # Kanonische POI-Liste
│       ├── api/               # Clients für Wikipedia, Wikidata, FactGrid, Commons
│       ├── hooks/             # React-Hooks um die API-Module
│       ├── components/        # Karte, Liste, Detailansicht, Galerie, Diagramme
│       ├── admin/             # Admin-Dashboard und Authentifizierung
│       ├── i18n.ts            # Übersetzungen DE/EN
│       └── theme.ts           # Farben und Typografie des Corporate Designs
├── cooperate_design/          # Vorlagen, Logos und Schriften (Raleway)
├── friedenstein_data/         # Ergebnisse der Datenerhebung zum Mediaguide
└── *.py                       # Einmalige Scraper-Skripte (siehe unten)
```

---

## Datenfluss

1. **Statische POI-Definitionen** in `app/src/data/pois.ts` — Koordinaten sowie
   Bezeichner für Wikipedia, Wikidata, FactGrid und Commons.
2. **Prebuild** (`app/scripts/prebuild.ts`, ausgeführt über `npx tsx`) ruft
   Zusammenfassungen, Vorschaubilder und Bildlisten ab und schreibt sie nach
   `app/public/data/pois-prebuilt.json`.
3. **Laufzeitabfragen** in `app/src/api/` ergänzen die Detailansicht direkt im
   Browser um Aussagen, Bilder und Abrufzahlen.

Die Navigation erfolgt über den URL-Hash, zum Beispiel `#/poi/rathaus`,
`#/list` oder `#/admin`.

---

## Admin-Dashboard

Erreichbar unter `#/admin`. Der Bereich ist bewusst nicht in der Navigation
verlinkt und per Passwort geschützt.

- **Anmeldung:** `POST /api/auth/login`, `GET /api/auth/check`,
  `POST /api/auth/logout`, Passwortwechsel über `PUT /api/auth/password`
- **Konfiguration:** `GET /api/config` (öffentlich lesbar) und `PUT /api/config`
  (Anmeldung erforderlich)
- **Speicherort:** `data/admin-config.json`, Benutzerkonten in
  `data/admin-users.json` (bcrypt-Hashes, beide Dateien sind nicht versioniert)

Einstellbar sind je POI unter anderem: Sichtbarkeit, Länge des
Wikipedia-Vorschautexts, Auswahl der angezeigten Wikidata- und
FactGrid-Eigenschaften sowie der Commons-Bilder. Die Einstellungen gelten für
alle Besucherinnen und Besucher.

> **Wichtig:** Beim ersten Start wird das Konto `admin` mit dem Passwort `admin`
> angelegt. Dieses Passwort im Produktivbetrieb unbedingt sofort ändern.

---

## Konfiguration

| Variable | Standard | Bedeutung |
| --- | --- | --- |
| `PORT` | `3000` | Port des Express-Servers |
| `NODE_ENV` | – | `production` liefert `dist/` statisch aus (setzt `npm run start`) |

---

## Datenerhebung (Python-Skripte)

Die Skripte im Wurzelverzeichnis dienten der erstmaligen Datensammlung aus dem
Mediaguide der Stiftung Schloss Friedenstein Gotha. Sie sind **nicht** Teil des
Anwendungsbuilds:

- `scrape_friedenstein.py`, `scrape_friedenstein_full.py` — Abruf der Inhalte
- `build_friedenstein_index.py` — Aufbau des Index
- `download_friedenstein_media.py` — Download der Medien

Die Ergebnisse liegen unter `friedenstein_data/`.

---

## Corporate Design

Farben und Typografie folgen dem Corporate Design der Stiftung Schloss
Friedenstein Gotha (`cooperate_design/`). Die Farbwerte sind in
`app/src/theme.ts` hinterlegt und als CSS-Custom-Properties verfügbar, unter
anderem `--color-trollingerblau`, `--color-gerberarot` und
`--color-seidengruen`. Als Schrift wird Raleway verwendet.

---

## Lizenz und Datenquellen

Die Anwendung greift auf offene Datenquellen zu:

- [Wikipedia](https://de.wikipedia.org) und
  [Wikidata](https://www.wikidata.org) (CC BY-SA bzw. CC0)
- [FactGrid](https://database.factgrid.de) (CC0)
- [Wikimedia Commons](https://commons.wikimedia.org) — Lizenz je Bild

Bitte die jeweiligen Lizenzbedingungen und Urhebernennungen beachten.

---

Repository: <https://github.com/grid-creators/wunderkammer> ·
Webseite: <https://gotha.friedenstein.de/>
