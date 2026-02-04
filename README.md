# TimeTracker - Freelancer Zeiterfassung

Eine Progressive Web App (PWA) für einfache Zeiterfassung, speziell für Freelancer entwickelt.

## Features

- **Kundenverwaltung**: Kunden anlegen, bearbeiten, löschen mit Kontaktdaten
- **Projektmanagement**: Projekte pro Kunde verwalten
- **Zeiterfassung**: 
  - Live-Timer starten/stoppen
  - Manuelle Zeiteinträge
  - Übersicht aller erfassten Zeiten
- **CSV Export**: Exportiere alle Zeiteinträge als CSV

## Tech Stack

- React + TypeScript + Vite
- PWA mit Service Worker (Offline-Funktionalität)
- LocalStorage für Datenpersistenz
- Mobile-First Design

## Installation & Entwicklung

```bash
# Abhängigkeiten installieren
npm install

# Entwicklungsserver starten
npm run dev

# Produktionsbuild erstellen
npm run build

# Build lokal testen
npx serve dist
```

## Deployment

Der `dist` Ordner enthält alle statischen Dateien für das Deployment:

```bash
# Build erstellen
npm run build

# Option 1: Mit npx serve testen
npx serve dist

# Option 2: Auf Netlify/Vercel deployen
# Drag & Drop des dist-Ordners
```

## PWA Installation

Die App kann als native App auf dem Smartphone/Desktop installiert werden:

1. Chrome/Edge/Safari öffnen
2. App im Browser laden
3. "Zum Home-Bildschirm hinzufügen" / "Installieren" auswählen

## Daten

Alle Daten werden lokal im Browser (LocalStorage) gespeichert.
Backup über CSV-Export empfohlen.

## Lizenz

MIT
