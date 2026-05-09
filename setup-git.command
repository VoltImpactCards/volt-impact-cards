#!/bin/bash
SRC="$HOME/Documents/GitHub/volt-impact-cards"
DST="$HOME/Downloads/Claude"

echo "🔧 Nastavuji git v Downloads/Claude..."

if [ -d "$DST/.git" ]; then
  echo "✅ Git je již nastaven"
else
  cp -r "$SRC/.git" "$DST/.git"
  cd "$DST"
  git remote set-url origin https://github.com/VoltImpactCards/volt-impact-cards.git
  echo "✅ Git nastaven!"
fi

echo ""
echo "Nyní v GitHub Desktop:"
echo "  File → Add Local Repository → vyber Downloads/Claude"
echo ""
read -p "Stiskni Enter pro zavření..."
