# Projekt-Info: Bewerbungs-Portfolio-Website

Übersicht aller wichtigen Eckdaten, Entscheidungen und Erkenntnisse aus der Projektentwicklung.

---

## Projektziel

Bewerbungs-/Portfolio-Website für **Praktikum Fachinformatiker Systemintegration** (Umschulung).

**Fokus:** Recruiter in 30–60 Sekunden überzeugen (Kompetenz, Struktur, Reliability) – nicht „Frontend-Spielerei“.

---

## Von ChatGPT

### Was wir zusammen gebaut haben

#### Architektur & Hosting

- [x] **GitHub Pages** als stabiles, statisches Hosting (Bewerbungsseite muss immer erreichbar sein)
- [x] Eigene Domain via **Porkbun** registriert und per DNS auf GitHub Pages gelegt:
  - `www` per CNAME → `fy269.github.io`
  - Root `@` per A-Records (GitHub Pages IPs)
- [x] GitHub Pages Custom Domain + HTTPS/Checks eingerichtet

#### Tech-Stack & Deployment

- [x] Website mit **Hugo** (Static Site Generator) aufgebaut (ohne Theme)
- [x] GitHub Actions Workflow erstellt/fixed:
  - Push auf `main` → Hugo build → Deploy zu GitHub Pages
- [x] Git-Probleme gelöst (Git Identität gesetzt, Commits/Pushes sauber gemacht)

#### Website-Struktur

One-Pager im Stil von [benscott.dev](https://benscott.dev):

- [x] **Hero** (Headline, Subline, CTA)
- [x] **About / Skills / Projects / Contact** (Anchor-Navigation)
- [x] Styling über eigene Files:
  - `layouts/_default/baseof.html`
  - `layouts/index.html`
  - `static/css/style.css`
  - optional `static/js/particles.js` (Canvas „Neuronales Netz“ im Hero)
- [x] CV als Download via `static/assets/cv.pdf`

#### Inhalt & Bedienbarkeit

- [x] Mailto-Link korrekt gesetzt (`mailto` im href + sichtbarer Text)
- [x] Footer: Impressum/Datenschutz links/rechts sauber (statt „hässlicher“ Inline-Links)

#### Rechtliches

- [x] Impressum + Datenschutz als eigene Hugo-Seiten (`content/impressum.md`, `content/datenschutz.md`)
- [x] Minimalistisch-seriös („Konzernstil“), mit Platzhaltern für Anschrift/E-Mail, plus Hinweis auf GitHub Pages Hosting

---

### Recherche & Erkenntnisse (ChatGPT)

#### Psychologie/Recruiter-Logik (FISI)

- **Scanbarkeit:** Klare Überschriften, kurze Absätze, Bulletpoints, wenig visuelles Chaos
- **Above the fold** muss sofort liefern:
  - Rolle/Ziel (Praktikum FISI)
  - 2–3 harte Proofs (Home-Lab/Proxmox, Linux/SSH, Doku/Prozess)
  - CTA: Kontakt + CV
- Für FISI zählt **Trust/Reliability** mehr als CSS-Animationen:
  - Stabile Bereitstellung, HTTPS
  - Saubere Doku/README, reproduzierbare Schritte (Gate-Denke)
  - Projekte als Beweis statt Behauptungen

#### Design-Entscheidungen

- Clean, minimal, dark wirkt techig und seriös, wenn Kontrast passt
- Eine Haupt-Akzentfarbe genügt (Blau als „Trust/Tech“), zweite Akzentfarbe sparsam
- Performance: statisch + wenig Ballast, Animation optional

#### Farbpalette (in `style.css`)

| Variable   | Wert                    |
|-----------|--------------------------|
| `--bg`    | `#0b0f14`               |
| `--fg`    | `#e6edf3`               |
| `--muted` | `#9aa7b3`               |
| `--border`| `rgba(255,255,255,.08)` |
| `--accent`| `#51a2e9` (Blau)        |
| `--accent2`| `#ff4d5a` (Pink/Rot)   |

- Leichte Radial-Glows im Hintergrund

#### Hybrid-Strategie (Plan für später)

- Bewerbungsseite bleibt auf GitHub Pages (stabil)
- VPS kommt später als optionales „Ops-Proof“-Projekt (Subdomain wie `ops.*`):
  - Reverse proxy/TLS, Hardening, Monitoring, Backups, Doku
- Recruiter können es optional ansehen, Bewerbung hängt nicht am Server

---

## Von Claude

### Recherche

- [x] Ben Scott's Site ([benscott.dev](https://benscott.dev)) analysiert als Referenz
- [x] Ben's GitHub-Repo (`bscottnz/portfolio-site`) gefunden – Source-Code jedoch nicht direkt lesbar (Netzwerk geblockt)
- [x] Durch Screenshot-Vergleich und Code-Analyse das Verhalten seiner Animation rekonstruiert

### Technischer Stack

- **Hugo** als Static Site Generator
- **GitHub Pages** als Hosting → Custom Domain (z.B. dikmenugur.com)

> **Wichtige Erkenntnis:** `static/js/` = Quelldatei (editierbar), `public/js/` = Hugo-Output (gitignored, nicht pushen)

### particles.js – Iterationen

Die Animation wurde in 6 Schritten verbessert:

1. **Batched Rendering** – `stroke()` nicht mehr pro Linie, sondern alle Linien gleicher Alpha in einem einzigen Path → kein Flimmern
2. **Farb-Cache** – `rgba()`-Strings vorberechnet statt im Hot Loop erzeugt
3. **FPS-Timer Fix** – `last += minFrame` statt `last = ts` für gleichmäßigen Rhythmus
4. **Max-Speed Clamping** – Partikel fliegen nicht mehr weg
5. **Konzept-Fix** *(wichtigster)* – Maus zieht keine Partikel mehr physisch an (→ Kollaps-Problem). Stattdessen ist die Maus eine virtuelle Node: Partikel bewegen sich unabhängig, Linien werden nur zur Maus gezeichnet
6. **Proximity-System** – Partikel–Partikel-Linien nur sichtbar, wenn mindestens ein Partikel nahe der Maus ist → erzeugt den Cluster-Effekt wie bei Ben

### Mobile Fixes

- **Safari:** `touchmove`-Listener entfernt → kein Kollabieren beim Scrollen
- **Chrome Mobile:** `mousemove` durch `pointermove` mit `e.pointerType !== "mouse"` Check ersetzt → Chrome feuert sonst `mousemove` bei Touch-Events
- **Drift-Cursor:** Automatisch wandernder virtueller Cursor (Lissajous-Kurve) für Mobile, da kein Mauszeiger vorhanden → Cluster immer sichtbar

### Design-Redesign (Terminal-Ästhetik)

Neues Theme mit Terminal-Look:

- [x] **JetBrains Mono** als Monospace-Font
- [x] 4 Terminal-Container:
  - `whoami` (About)
  - `cat skills.conf` mit Skill-Bars (Skills)
  - `ls -la` (Projekte)
  - `cat contact.txt` (Kontakt)
- [x] Projekt-Cards mit Terminal-Chrome (Ampel-Punkte)
- [x] Pulsierender „available for Praktikum“ Status im Footer
- [x] Blinkender Cursor-Effekt im Hero als Shell-Prompt
- [x] Standalone `vorschau.html` zum lokalen Testen per Doppelklick

### Erstellte/Bearbeitete Dateien

| Datei                 | Zweck                                      |
|-----------------------|---------------------------------------------|
| `static/js/particles.js` | Animation (6× iteriert)                  |
| `static/css/style.css`   | Redesign mit Terminal-Theme             |
| `layouts/index.html`     | Hugo-Template mit Terminal-Containern   |
| `vorschau.html`          | Standalone-Preview (lokal öffnen)        |

---

## Schnellübersicht

| Aspekt        | Status / Technologie        |
|---------------|-----------------------------|
| Hosting       | GitHub Pages + Custom Domain|
| Generator     | Hugo (ohne Theme)           |
| Deployment    | GitHub Actions              |
| Design        | Dark, minimal, Terminal-Look|
| Animation     | particles.js (Canvas)       |
| Rechtliches   | Impressum, Datenschutz      |
