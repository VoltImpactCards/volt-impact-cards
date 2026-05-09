---
name: aktualizuj-produkty
description: >
  Aktualizuje existující produkty na Volt Impact Cards webu — odstraňuje produkty,
  přejmenovává je, mění ceny nebo stock. Použij tento skill kdykoli uživatel řekne
  "smaž produkt", "odstraň", "aktualizuj cenu", "přejmenuj kartu", "vyprodáno",
  "změn stock", nebo zmíní že odstranil/přidal soubory ve složce Singles či jiné
  existující složce. Také použij když uživatel říká "aktualizuj produkty" nebo
  "upravuj web".
---

# Aktualizuj produkty — Volt Impact Cards

Tento skill upravuje existující produkty webu editací **`products.json`**.
Nepoužívej ho pro přidávání zcela nových sérií — na to je skill `pridej-produkty`.

**Datový soubor:** `/Users/gravitus/Downloads/Claude/products.json`  
**HTML:** `/Users/gravitus/Downloads/Claude/index.html` (jen pro filter pills — při mazání celé série)

Po každé změně uživatel udělá **Commit + Push v GitHub Desktop** → web je živý za ~30 sekund.

## Struktura products.json

```json
{
  "bulks": [
    {
      "imgs": ["img/...jpg"],
      "title": "Název produktu",
      "price": 250,
      "stock": 1,
      "set": "Název série",
      "series": "series_key",
      "seriesLabel": "Štítek série",
      "type": "Bulk",
      "desc": "Popis.",
      "features": ["..."]
    }
  ],
  "singles": [
    {
      "imgs": ["img/...jpg"],
      "title": "Název karty",
      "price": 30,
      "stock": 1,
      "set": "Série",
      "series": "series_key",
      "type": "Single",
      "desc": "Popis.",
      "features": ["..."]
    }
  ]
}
```

Produkt identifikuj podle pole `"title"`. Bulk produkty jsou v poli `bulks`, single karty v `singles`.

## Typické scénáře

### A) Změna ceny

Najdi produkt podle `"title"` a změň hodnotu `"price"` (celé číslo, bez symbolu Kč):

```json
"price": 250  →  "price": 300
```

### B) Změna stock / vyprodáno

Změň hodnotu `"stock"` (celé číslo):

```json
"stock": 1  →  "stock": 0
```

`stock: 0` = vyprodáno (produkt zůstane na webu, zobrazí se "0 ks").
Pokud má produkt zmizet úplně, smaž celý objekt z pole (scénář C).

### C) Odstranění produktu

Odstraň celý JSON objekt produktu z příslušného pole (`bulks` nebo `singles`).

Pokud sérii po odstranění nezbyde žádný produkt, smaž i filter pill z `index.html`:
```html
<div class="pill" data-filter="series" data-value="SERIES_KEY">...</div>
```

Ověř stav fotek ve složce:
```bash
ls "/sessions/busy-practical-newton/mnt/Claude/<FolderName>/"
```
Zpracované jpg soubory z `img/` nemaž — mohou být potřeba jindy.

### D) Přejmenování produktu / karty

Změň pole `"title"` a případně `"desc"`. Hodnoty `"series"` a `"imgs"` neměň (odkazují na soubory).

### E) Přidání/odebrání fotky z galerie

V poli `"imgs"` přidej nebo odstraň cestu k obrázku. První obrázek je thumbnail na kartě:

```json
"imgs": ["img/sv151_118_1.jpg", "img/sv151_118_2.jpg", "img/sv151_118_3.jpg"]
```

### F) Synchronizace se složkou (přidání/odebrání fotek)

Když uživatel mluví o změnách ve složce, nejdřív zkontroluj aktuální stav:

```bash
ls "/sessions/busy-practical-newton/mnt/Claude/<FolderName>/"
```

Porovnej se současnými produkty v `products.json`. Přidej co chybí, smaž co bylo odebráno.
Nové fotky zpracuj přes PIL (viz skill `volt-impact-product`, Krok 2).

## Ověření po změně

Zkontroluj syntaxi JSON:
```bash
python3 -c "import json; json.load(open('/sessions/busy-practical-newton/mnt/Claude/products.json')); print('OK')"
```

Pak informuj uživatele ať udělá **Commit + Push v GitHub Desktop**.

## Poznámky

- Path mapping: `/Users/gravitus/Downloads/Claude/` ↔ `/sessions/busy-practical-newton/mnt/Claude/`
- `index.html` se upravuje pouze při mazání celé série (filter pill) — samotná data produktů jsou jen v `products.json`.
- Počet produktů (`count-num`, `count-total`) se aktualizuje automaticky při načtení stránky — nemusíš ho ručně počítat.
