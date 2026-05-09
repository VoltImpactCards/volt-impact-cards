#!/bin/bash
SRC="$HOME/Downloads/Claude"
DST="$HOME/Documents/volt-impact-cards"

echo "📦 Kopíruji soubory..."
cp "$SRC/index.html" "$DST/index.html"
cp "$SRC/products.json" "$DST/products.json"
cp "$SRC"/img/deck_*.jpg "$DST/img/" 2>/dev/null

echo "📤 Odesílám na GitHub..."
cd "$DST"
git add .
git commit -m "Aktualizace webu"
git push

echo ""
echo "✅ Hotovo! Web se nasazuje na voltimpactcards.com (~30 sekund)"
echo ""
read -p "Stiskni Enter pro zavření..."
