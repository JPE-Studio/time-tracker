#!/bin/bash

# Build Script für TimeTracker PWA

echo "🚀 Baue TimeTracker PWA..."

# Dependencies prüfen
if [ ! -d "node_modules" ]; then
    echo "📦 Installiere Abhängigkeiten..."
    npm install
fi

# Icons generieren (falls nicht vorhanden)
if [ ! -f "public/icon-192x192.png" ]; then
    echo "🎨 Generiere Icons..."
    node generate-icons.cjs
fi

# Build
echo "🔨 Erstelle Produktionsbuild..."
npm run build

# Ergebnis
echo ""
echo "✅ Build erfolgreich!"
echo ""
echo "📁 Build-Dateien im 'dist/' Ordner:"
ls -lh dist/ | grep -E "\.(js|css|html|png|json)$"
echo ""
echo "🌐 Zum Testen: npx serve dist"
echo "📤 Zum Deployen: dist/ Ordner auf deinen Host hochladen"
