---
name: pridej-produkty
description: >
  Adds new products to the Volt Impact Cards website from a folder the user has
  dropped into their Claude/ workspace. Use this skill whenever the user says
  something like "přibyla složka", "nová složka", "přidej produkt",
  "nový produkt z fotek", or any time they mention a new folder appearing in their
  workspace with Pokémon card photos. Also trigger when the user asks to update
  the website with new inventory or new card sets. The folder name gives the
  series/set, subfolders give individual products with quantities, and photos
  inside each subfolder become the product images.
---

# Přidej produkty — Volt Impact Cards

Tento skill přidává nové produkty na web Volt Impact Cards.

**Datový soubor:** `/Users/gravitus/Downloads/Claude/products.json`  
**HTML:** `/Users/gravitus/Downloads/Claude/index.html` (jen pro filter pills nové série)  
**Obrázky:** `/Users/gravitus/Downloads/Claude/img/`

Po každé změně uživatel udělá **Commit + Push v GitHub Desktop** → web je živý za ~30 sekund.

## Struktura složky

```
Claude/
└── <Series Name>/          ← název série (e.g. "Scarlet&Violet 151")
    ├── <Product (71ks)>/   ← název produktu + počet kusů
    │   ├── IMG_xxxx.JPG
    │   └── IMG_yyyy.JPG
    └── <Product (34ks)>/
        └── IMG_xxxx.JPG
```

- **Název top-level složky** → série/set. Překlep a zkratky v názvu oprav na správnou angličtinu.
- **Název podsložky** → titul produktu. Číslo v závorce = počet karet (stock).
- **Fotky v podsložce** → galerie produktu, seřazené podle názvu souboru.

## Krok 1 — Prozkoumat složku

```bash
ls -R "/sessions/busy-practical-newton/mnt/Claude/<FolderName>/"
```

Zjisti: název série, seznam produktů, fotky každého produktu.

## Krok 2 — Zpracovat fotky

Napiš Python skript do `outputs/process_<series_key>.py` (nikdy neinlinuj Python v bash — shell
rozbíjí `!=` a podobné operátory). Pak ho spusť.

```python
from PIL import Image, ImageOps
import os

BASE = '/sessions/busy-practical-newton/mnt/Claude'
OUT  = BASE + '/img'
MAX_W = 1200
Q = 88

mapping = [
    (BASE + '/<FolderName>/<Subfolder>/IMG_xxxx.JPG', OUT + '/<series_key>_<qty>_1.jpg'),
    # ... jedna položka na fotku
]

for src, dst in mapping:
    img = Image.open(src)
    img = ImageOps.exif_transpose(img)   # VŽDY aplikuj — iPhone ukládá rotaci do EXIF
    if img.mode != 'RGB':
        img = img.convert('RGB')
    w, h = img.size
    if w > MAX_W:
        img = img.resize((MAX_W, int(h * MAX_W / w)), Image.LANCZOS)
    elif h > MAX_W:
        img = img.resize((int(w * MAX_W / h), MAX_W), Image.LANCZOS)
    img.save(dst, 'JPEG', quality=Q, optimize=True)
    print('OK:', os.path.basename(dst), img.size)
```

**Konvence názvů obrázků:** `<series_key>_<qty>_<n>.jpg`
- `series_key`: lowercase, bez mezer (např. `flames`, `sv151`, `sfa`, `mega`)
- `qty`: číslo z názvu složky (např. `71`, `118`)
- `n`: pořadí fotky v galerii (1, 2, 3…)

**Kritické:** `ImageOps.exif_transpose()` musí být voláno na každém obrázku před resizem.
Bez toho budou fotky na webu otočené.

## Krok 3 — Zjistit cenu

Pokud uživatel neurčil cenu, zeptej se. Výchozí placeholder je `0`. Cena je v Kč.

## Krok 4 — Přidat do products.json

Načti aktuální `products.json` a přidej nové záznamy do správného pole (`bulks` nebo `singles`).

### Šablona pro bulk produkt

```json
{
  "imgs": ["img/KEY_QTY_1.jpg", "img/KEY_QTY_2.jpg"],
  "title": "DISPLAY_TITLE",
  "price": PRICE,
  "stock": 1,
  "set": "SERIES_DISPLAY_NAME",
  "series": "SERIES_KEY",
  "seriesLabel": "SERIES_LABEL",
  "type": "Bulk",
  "desc": "QTY karet z kolekce SERIES_DISPLAY_NAME bez duplicit.",
  "features": ["QTY karet bez duplicit", "Kolekce SERIES_DISPLAY_NAME", "Near Mint (NM) stav", "Originální neporušené karty"]
}
```

### Šablona pro single kartu

```json
{
  "imgs": ["img/SERIES_KEY_s_POKEMON.jpg"],
  "title": "Jméno karty",
  "price": PRICE,
  "stock": 1,
  "set": "SERIES_DISPLAY_NAME",
  "series": "SERIES_KEY",
  "type": "Single",
  "desc": "Jméno karty single karta.",
  "features": ["Single karta", "Near Mint (NM) stav", "Originální neporušená karta"]
}
```

Vyplň:
- `PRICE` — celé číslo v Kč
- `SERIES_KEY` — lowercase klíč pro filtrování (musí odpovídat filter pillu)
- `SERIES_LABEL` — krátký zobrazovací název pro odznak na kartě (např. `"SV: 151"`)
- `DISPLAY_TITLE` — čitelný název, např. `"SV: 151 Bulk (118 ks)"`
- `stock` — počet kusů (celé číslo)

## Krok 5 — Filter pill (pouze nová série)

Pokud je série zcela nová (ještě neexistuje filter pill v index.html), přidej ho.
Filter pills jsou v `index.html` v sekci `<div class="filter-pills" id="filter-series">`:

```html
<div class="pill" data-filter="series" data-value="SERIES_KEY">SERIES_LABEL</div>
```

Pokud série již existuje (např. přidáváš druhý produkt do sv151), filter pill nepřidávej.

## Krok 6 — Ověřit

1. Zkontroluj že obrázky existují: `ls /sessions/busy-practical-newton/mnt/Claude/img/ | grep <series_key>`
2. Ověř JSON syntaxi: `python3 -c "import json; json.load(open('/sessions/busy-practical-newton/mnt/Claude/products.json')); print('OK')"`
3. Informuj uživatele ať udělá **Commit + Push v GitHub Desktop**

## Poznámky

- **Path mapping:** File tools → `/Users/gravitus/Downloads/Claude/…`; bash → `/sessions/busy-practical-newton/mnt/Claude/…`. Stejný fyzický adresář.
- **Python skripty:** Vždy piš do `outputs/`, pak spusť přes `python3`. Nikdy neinlinuj Python v bash heredoc.
- **EXIF:** iPhone fotky téměř vždy potřebují `ImageOps.exif_transpose()`. Nikdy nepřeskakuj.
- **Singles vs Bulk:** Pokud podsložky obsahují jednotlivé pojmenované karty, přidej je do pole `singles` v products.json místo `bulks`.
- **Stávající série:** Pokud produkt patří do již existující série, použij stejný `series` klíč a nepřidávej duplicitní filter pill.
