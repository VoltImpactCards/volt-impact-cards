/* Generátor samostatných stránek produktů pro Volt Impact Cards.
   Spouští se automaticky při každém nasazení na Netlify (viz netlify.toml).
   Čte products.json a vytváří /karta/<slug>/index.html + /karta/index.html + sitemap.xml */

import { readFile, writeFile, mkdir, rm, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const SITE = 'https://voltimpactcards.com';
const MAIL = 'voltimpactcards@gmail.com';
const WA = '420605886256';
const OUT = 'karta';

/* ── Údaje prodávajícího ──
   Doplň IČO (a případně adresu sídla) — promítne se do zápatí i do všech právních dokumentů. */
const SELLER = {
  jmeno: 'David Vaněček',
  ico: '10895060',
  adresa: 'Nemojany 155, 683 03 Nemojany',
  ucet: '3429264010/3030',
  dph: false               // false = neplátce DPH
};
const seller = (k, fallback = '—') => SELLER[k] ? SELLER[k] : fallback;

const ERA_LABELS = { original:'Original', neo:'Neo', ecard:'e-Card', ex:'EX', dp:'Diamond & Pearl',
  platinum:'Platinum', hgss:'HeartGold & SoulSilver', bw:'Black & White', xy:'XY', sm:'Sun & Moon',
  swsh:'Sword & Shield', sv:'Scarlet & Violet', mega:'Mega Evolution', mix:'Mix' };

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const slugify = s => norm(s).replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');

/* ── Zmenšené fotky ve WebP ──
   Z každé fotky v img/ se při nasazení vyrobí 3 menší verze: img/s/ (400 px, karty v nabídce),
   img/m/ (800 px, karty na velkých displejích) a img/l/ (1200 px, detail produktu).
   Kdyby verze chyběla, obrázek si sám načte originál (onerror). */
const VARIANTY = { s: 400, m: 800, l: 1200 };
const lzeZmensit = src => /^img\/[^/]+\.(jpe?g|png)$/i.test(src || '');
const vimg = (src, v) => lzeZmensit(src) ? `img/${v}/${src.slice(4)}.webp` : src;
const FALLBACK = `onerror="this.onerror=null;this.removeAttribute('srcset');this.src=this.dataset.orig"`;
// obrázek karty v mřížce (nabídka, série, podobné produkty)
function kartaImg(src, alt, pre = '', extra = ' loading="lazy"') {
  if (!lzeZmensit(src)) return `<img src="${pre}${src}" alt="${esc(alt)}" decoding="async"${extra}/>`;
  return `<img src="${pre}${vimg(src, 's')}" srcset="${pre}${vimg(src, 's')} 400w, ${pre}${vimg(src, 'm')} 800w" sizes="(max-width: 600px) 100vw, 320px" data-orig="${pre}${src}" ${FALLBACK} alt="${esc(alt)}" width="400" height="400" decoding="async"${extra}/>`;
}
// velký obrázek (detail produktu)
function velkyImg(src, alt, pre = '', extra = '') {
  if (!lzeZmensit(src)) return `<img src="${pre}${src}" alt="${esc(alt)}"${extra}/>`;
  return `<img src="${pre}${vimg(src, 'l')}" data-orig="${pre}${src}" ${FALLBACK} alt="${esc(alt)}"${extra}/>`;
}
// malý náhled (miniatury)
function malyImg(src, alt, pre = '', extra = ' loading="lazy"') {
  if (!lzeZmensit(src)) return `<img src="${pre}${src}" alt="${esc(alt)}"${extra}/>`;
  return `<img src="${pre}${vimg(src, 's')}" data-orig="${pre}${src}" ${FALLBACK} alt="${esc(alt)}" width="64" height="64" decoding="async"${extra}/>`;
}

/* Písmo Inter hostujeme sami (rychlejší než Google Fonts a bez předávání IP adres Googlu) */
const FONTS = `<link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/inter-latin-ext.woff2" as="font" type="font/woff2" crossorigin>`;
const FONT_FACE = `@font-face{font-family:'Inter';font-style:normal;font-weight:100 900;font-display:swap;src:url(/fonts/inter-latin.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:'Inter';font-style:normal;font-weight:100 900;font-display:swap;src:url(/fonts/inter-latin-ext.woff2) format('woff2');unicode-range:U+0100-017F}
`;

const CSS = `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#080810;--bg2:#0e0e1a;--surface:rgba(255,255,255,.04);--border:rgba(255,255,255,.08);--yellow:#f5c518;--blue:#4fc3f7;--grey:#8a8a9a}
body{font-family:'Inter','Segoe UI',Arial,sans-serif;background:var(--bg);color:#fff;line-height:1.6}
a{color:inherit}
.wrap{max-width:1000px;margin:0 auto;padding:24px 20px 60px}
.top{display:flex;align-items:center;gap:10px;padding:14px 0;border-bottom:1px solid var(--border);margin-bottom:28px}
.top img{height:34px}
.top span{font-weight:800;letter-spacing:1.4px;text-transform:uppercase;font-size:.9rem}
.top span i{color:var(--yellow);font-style:normal}
.crumbs{font-size:.78rem;color:var(--grey);margin-bottom:18px}
.crumbs a{color:var(--grey);text-decoration:none}.crumbs a:hover{color:#fff}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:32px}
@media(max-width:760px){.grid{grid-template-columns:1fr;gap:22px}}
.ph{background:#0c0c18;border:1px solid var(--border);border-radius:16px;overflow:hidden}
.ph img{width:100%;height:100%;object-fit:contain;display:block;max-height:460px}
.thumbs{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
.thumbs img{width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid var(--border)}
h1{font-size:1.7rem;line-height:1.25;margin-bottom:10px;letter-spacing:-.5px}
.badges{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
.badge{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:4px 12px;border-radius:20px;background:rgba(255,255,255,.06);border:1px solid var(--border);color:#ccc}
.badge.y{background:rgba(245,197,24,.12);border-color:rgba(245,197,24,.3);color:var(--yellow)}
.badge.r{background:rgba(226,75,74,.18);border-color:rgba(226,75,74,.4);color:#ff7b7a}
.price{font-size:2rem;font-weight:800;color:var(--yellow);margin-bottom:6px}
.desc{color:#c9c9d4;margin:14px 0}
.feat{list-style:none;margin:14px 0}
.feat li{color:#c9c9d4;font-size:.9rem;padding:3px 0}
.feat li::before{content:'✓';color:var(--yellow);margin-right:8px;font-weight:700}
.cta{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}
.cta a{text-decoration:none;border-radius:10px;padding:12px 20px;font-size:.88rem;font-weight:700;display:inline-flex;align-items:center;gap:8px}
.cta .p{background:linear-gradient(135deg,var(--yellow),#ffd740);color:#1a1400}
.cta .s{background:var(--surface);border:1px solid var(--border);color:#fff}
.cta button{font-family:inherit;cursor:pointer;border:none;text-decoration:none;border-radius:10px;padding:12px 20px;font-size:.88rem;font-weight:700;display:inline-flex;align-items:center;gap:8px}
.mp{position:fixed;inset:0;z-index:50;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(4,4,10,.75)}
.mp.open{display:flex}
.mp-box{background:var(--bg2);border:1px solid rgba(255,255,255,.14);border-radius:18px;width:100%;max-width:380px;padding:22px}
.mp-box h3{font-size:1.05rem;margin-bottom:4px}
.mp-box .n{color:var(--grey);font-size:.82rem;margin-bottom:16px}
.mp-opt{display:block;width:100%;text-align:left;background:rgba(255,255,255,.07);border:1px solid var(--border);border-radius:10px;color:#fff;padding:12px 14px;margin-bottom:8px;cursor:pointer;font-family:inherit;font-size:.88rem;text-decoration:none}
.mp-opt:hover{border-color:rgba(245,197,24,.45);background:rgba(255,255,255,.11)}
.mp-opt small{display:block;color:var(--grey);font-size:.74rem}
.mp-close{background:none;border:none;color:var(--grey);cursor:pointer;font-family:inherit;font-size:.82rem;padding:8px 0 0;width:100%}
.more{margin-top:56px}
.more h2{font-size:1.1rem;margin-bottom:16px}
.mgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px}
.mcard{background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden;text-decoration:none;display:block;transition:border-color .2s}
.mcard:hover{border-color:rgba(245,197,24,.35)}
.mcard .im{aspect-ratio:5/7;background:#0c0c18}
.mcard img{width:100%;height:100%;object-fit:contain}
.mcard .t{padding:9px 11px;font-size:.82rem}
.mcard .pr{color:var(--yellow);font-weight:700;font-size:.9rem;padding:0 11px 10px}
footer{border-top:1px solid var(--border);margin-top:60px;padding-top:20px;color:var(--grey);font-size:.8rem}
.catlist{columns:2;column-gap:28px}
@media(max-width:640px){.catlist{columns:1}}
.catlist a{display:block;padding:6px 0;color:#c9c9d4;text-decoration:none;font-size:.9rem;border-bottom:1px solid var(--border)}
.catlist a:hover{color:var(--yellow)}`;

/* Google tag (gtag.js) — vkládá se do hlavičky všech generovaných stránek */
const GTAG = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18418072866"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500
  });
  gtag('config', 'AW-18418072866');
</script>`;

const head = ({ title, desc, url, img, extraLd }) => `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
${GTAG}
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}"/>
<link rel="canonical" href="${url}"/>
<meta name="robots" content="index, follow"/>
<meta name="theme-color" content="#080810"/>
<link rel="icon" type="image/png" href="${SITE}/img/logo_nav.png"/>
<meta property="og:type" content="${extraLd ? 'product' : 'website'}"/>
<meta property="og:site_name" content="Volt Impact Cards"/>
<meta property="og:title" content="${esc(title)}"/>
<meta property="og:description" content="${esc(desc)}"/>
<meta property="og:url" content="${url}"/>
<meta property="og:image" content="${img}"/>
<meta property="og:locale" content="cs_CZ"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${esc(title)}"/>
<meta name="twitter:description" content="${esc(desc)}"/>
<meta name="twitter:image" content="${img}"/>
${FONTS}
<style>${FONT_FACE}${CSS}</style>
${extraLd || ''}
</head>
<body>
<div class="wrap">
<a class="top" href="${SITE}/" style="text-decoration:none">
  <img src="${SITE}/img/logo_nav.png" alt="Volt Impact Cards" width="24" height="34"/>
  <span>Volt Impact <i>Cards</i></span>
</a>`;

const CONSENT_BANNER = `<!-- Lišta souhlasu s cookies -->
<style>
  .cc-lista {
    position: fixed; left: 50%; bottom: 18px; transform: translate(-50%, 160%);
    z-index: 500; width: calc(100% - 32px); max-width: 640px;
    background: rgba(14,14,26,0.96); backdrop-filter: blur(18px) saturate(160%);
    border: 1px solid rgba(255,255,255,0.14); border-radius: 16px;
    padding: 18px 20px; box-shadow: 0 18px 50px rgba(0,0,0,0.6);
    transition: transform .35s cubic-bezier(.2,.8,.3,1);
    font-family: 'Inter', 'Segoe UI', Arial, sans-serif; color: #fff;
  }
  .cc-lista.cc-show { transform: translate(-50%, 0); }
  .cc-lista p { font-size: 0.86rem; line-height: 1.6; color: #c9c9d4; margin: 0 0 14px; }
  .cc-lista a { color: #f5c518; }
  .cc-akce { display: flex; gap: 10px; flex-wrap: wrap; }
  .cc-akce button {
    flex: 1 1 140px; border-radius: 999px; cursor: pointer; font-family: inherit;
    font-size: 0.85rem; font-weight: 700; padding: 11px 20px; border: 1px solid rgba(255,255,255,0.18);
    background: none; color: #fff; transition: background .2s, border-color .2s;
  }
  .cc-akce button:hover { background: rgba(255,255,255,0.08); }
  .cc-akce .cc-ano { background: linear-gradient(135deg, #f5c518, #ffd740); color: #1a1400; border: none; }
  @media (max-width: 520px) { .cc-lista { padding: 16px; } .cc-lista p { font-size: 0.82rem; } }
</style>
<div class="cc-lista" id="cc-lista" role="dialog" aria-label="Souhlas s cookies">
  <p>Pro měření účinnosti reklamy používáme soubory cookie společnosti Google. Bez Vašeho souhlasu je nespouštíme. Více v <a href="/ochrana-osobnich-udaju/">ochraně osobních údajů</a>.</p>
  <div class="cc-akce">
    <button type="button" class="cc-ano" onclick="ccSouhlas(true)">Přijmout</button>
    <button type="button" onclick="ccSouhlas(false)">Odmítnout</button>
  </div>
</div>
<script>
  (function () {
    var KLIC = 'vic_cookies';
    var stav = null;
    try { stav = localStorage.getItem(KLIC); } catch (e) {}

    function udel(granted) {
      if (typeof gtag !== 'function') return;
      gtag('consent', 'update', {
        ad_storage: granted ? 'granted' : 'denied',
        ad_user_data: granted ? 'granted' : 'denied',
        ad_personalization: granted ? 'granted' : 'denied',
        analytics_storage: granted ? 'granted' : 'denied'
      });
    }

    window.ccSouhlas = function (granted) {
      try { localStorage.setItem(KLIC, granted ? 'granted' : 'denied'); } catch (e) {}
      udel(granted);
      var el = document.getElementById('cc-lista');
      if (el) el.classList.remove('cc-show');
    };

    if (stav === 'granted') { udel(true); }
    else if (stav !== 'denied') {
      window.addEventListener('load', function () {
        var el = document.getElementById('cc-lista');
        if (el) setTimeout(function () { el.classList.add('cc-show'); }, 800);
      });
    }
  })();
</script>
`;

const foot = `<footer>
  <p>Volt Impact Cards — Pokémon TCG, Brno &amp; celá ČR</p>
  <p style="margin-top:6px">Prodávající: ${SELLER.jmeno}${SELLER.ico ? ', IČO ' + SELLER.ico : ''}${SELLER.adresa ? ', ' + SELLER.adresa : ''}${SELLER.dph ? '' : ' · Neplátce DPH'}</p>
  <p style="margin-top:6px"><a href="mailto:${MAIL}">${MAIL}</a> · <a href="https://wa.me/${WA}">WhatsApp</a> · <a href="${SITE}/">Zpět na nabídku</a> · <a href="${SITE}/serie/">Karty podle sérií</a> · <a href="${SITE}/${OUT}/">Všechny karty</a></p>
  <p style="margin-top:6px"><a href="${SITE}/obchodni-podminky/">Obchodní podmínky</a> · <a href="${SITE}/ochrana-osobnich-udaju/">Ochrana osobních údajů</a> · <a href="${SITE}/odstoupeni-od-smlouvy/">Odstoupení od smlouvy</a></p>
  <p style="margin-top:10px;opacity:.7">Nejsme partnerem ani sponzorem The Pokémon Company.</p>
</footer>
</div>
${CONSENT_BANNER}
</body>
</html>`;

/* ── Strukturovaná data: doprava a vrácení (Google je doporučuje u produktů) ── */
const ROK_DOPREDU = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
const dodani = (min, max) => ({
  '@type': 'ShippingDeliveryTime',
  handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 3, unitCode: 'DAY' },
  transitTime: { '@type': 'QuantitativeValue', minValue: min, maxValue: max, unitCode: 'DAY' }
});
const SHIPPING_LD = [
  { '@type': 'OfferShippingDetails', name: 'Zásilkovna — výdejní místo / Z-BOX',
    shippingRate: { '@type': 'MonetaryAmount', value: 79, currency: 'CZK' },
    shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'CZ' }, deliveryTime: dodani(1, 2) },
  { '@type': 'OfferShippingDetails', name: 'Zásilkovna — doručení na adresu',
    shippingRate: { '@type': 'MonetaryAmount', value: 109, currency: 'CZK' },
    shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'CZ' }, deliveryTime: dodani(1, 2) }
];
const RETURN_LD = {
  '@type': 'MerchantReturnPolicy', applicableCountry: 'CZ',
  returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
  merchantReturnDays: 14,
  returnMethod: 'https://schema.org/ReturnByMail',
  returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility'
};

/* ── Popisy sérií a ér pro jejich stránky ── */
const SERIE_POPIS = {
  sv151: 'Scarlet & Violet — 151 je speciální rozšíření z roku 2023 věnované původním 151 Pokémonům z regionu Kanto. Patří k nejoblíbenějším sériím posledních let mezi sběrateli.',
  obsidian: 'Obsidian Flames je rozšíření éry Scarlet & Violet z roku 2023. Proslavila ho karta Charizard ex v podobě Tera Pokémona temného typu.',
  temporal: 'Temporal Forces je rozšíření éry Scarlet & Violet z roku 2024, které přineslo Ancient a Future Pokémony a návrat karet ACE SPEC.',
  sfa: 'Shrouded Fable je speciální rozšíření éry Scarlet & Violet z roku 2024 zaměřené na Pokémony z oblasti Kitakami.',
  surging: 'Surging Sparks je rozšíření éry Scarlet & Violet z roku 2024, na jehož obalech se objevuje Pikachu ex.',
  prismatic: 'Prismatic Evolutions je speciální rozšíření z roku 2025 věnované Eevee a všem jeho vývojovým formám.',
  jt: 'Journey Together je rozšíření éry Scarlet & Violet z roku 2025, které vrátilo do hry Pokémony trenérů.',
  mega: 'Mega Evolution je série z roku 2025, která do Pokémon TCG vrátila Mega evoluce v podobě karet Mega Pokémon ex.',
  flames: 'Phantasmal Flames je rozšíření série Mega Evolution z roku 2025.',
  pokemongo: 'Pokémon GO je speciální rozšíření éry Sword & Shield z roku 2022 inspirované stejnojmennou mobilní hrou.',
  lost: 'Lost Origin je rozšíření éry Sword & Shield z roku 2022, které přineslo mechaniku Lost Zone a karty Pokémon VSTAR.',
  astral: 'Astral Radiance je rozšíření éry Sword & Shield z roku 2022 inspirované hrou Pokémon Legends: Arceus.',
  swshbase: 'Sword & Shield je základní rozšíření stejnojmenné éry z roku 2020, které uvedlo karty Pokémon V a VMAX.'
};
const ERA_POPIS = {
  sv: 'Scarlet & Violet je éra Pokémon TCG z let 2023–2025 navazující na hry Pokémon Scarlet a Violet. Přinesla karty Pokémon ex a Tera Pokémony.',
  mega: 'Éra Mega Evolution začala v roce 2025 a vrátila do Pokémon TCG Mega evoluce.',
  swsh: 'Sword & Shield je éra z let 2020–2023 inspirovaná hrami Pokémon Sword a Shield. Proslavily ji karty Pokémon V, VMAX a VSTAR.',
  sm: 'Sun & Moon je éra z let 2017–2019 navazující na hry Pokémon Sun a Moon, známá kartami Pokémon GX.',
  bw: 'Black & White je éra z let 2011–2013 navazující na hry Pokémon Black a White.'
};
// stránku dostanou jen skutečné série/éry s alespoň 2 produkty (žádné prázdné stránky)
let SERIE_PAGES = new Set();
let ERA_PAGES = new Set();

function productPage(p, similar) {
  const url = `${SITE}/${OUT}/${p.slug}/`;
  const img = `${SITE}/${p.imgs[0]}`;
  const era = ERA_LABELS[p.era] || '';
  const so = p.stock === 0 || p.soldout === true;
  const kind = p.type === 'Single' ? 'Singl karta' : p.type === 'Deck' ? 'Deck' : 'Bulk set';
  // Češi hledají „pokemon karta glaceon", ne jen „glaceon 038/189" — proto typ v titulku
  const titleKind = p.type === 'Single' ? 'Pokémon karta' : p.type === 'Deck' ? 'Pokémon deck' : (/bulk/i.test(p.title) ? 'Pokémon karty' : 'Pokémon karty bulk');
  const descKind = p.type === 'Single' ? 'Pokémon karta' : p.type === 'Deck' ? 'Hotový Pokémon deck' : 'Bulk Pokémon karet';
  const seriesInTitle = p.type === 'Single' && p.seriesLabel && !p.title.includes(p.seriesLabel) ? ' ' + p.seriesLabel : '';
  const title = `${p.title}${seriesInTitle} — ${titleKind} | Volt Impact Cards`;
  const seriesUrl = SERIE_PAGES.has(p.series) ? `${SITE}/serie/${p.series}/` : '';
  const desc = [
    `${descKind} ${p.title}`,
    p.seriesLabel ? `ze série ${p.seriesLabel}` : '',
    era ? `(${era})` : '',
    `za ${p.price} Kč.`,
    so ? 'Momentálně vyprodáno.' : `Skladem ${p.stock} ks.`,
    'Osobní předání v Brně, zaslání po celé ČR.'
  ].filter(Boolean).join(' ');

  const ld = {
    '@context': 'https://schema.org', '@type': 'Product',
    name: p.title, description: p.desc || desc,
    image: p.imgs.map(i => `${SITE}/${i}`),
    category: kind,
    brand: { '@type': 'Brand', name: 'Pokémon' },
    sku: p.slug,
    offers: {
      '@type': 'Offer', url, price: p.price, priceCurrency: 'CZK',
      priceValidUntil: ROK_DOPREDU,
      availability: so ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/UsedCondition',
      seller: { '@type': 'Organization', name: 'Volt Impact Cards' },
      shippingDetails: SHIPPING_LD,
      hasMerchantReturnPolicy: RETURN_LD
    }
  };
  const crumbs = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Nabídka', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Karty', item: `${SITE}/${OUT}/` },
      { '@type': 'ListItem', position: 3, name: p.title, item: url }
    ]
  };
  const extraLd = `<script type="application/ld+json">${JSON.stringify(ld)}</script>
<script type="application/ld+json">${JSON.stringify(crumbs)}</script>`;

  return head({ title, desc, url, img, extraLd }) + `
<div class="crumbs"><a href="${SITE}/">Nabídka</a> › <a href="${SITE}/${OUT}/">Karty</a> › ${esc(p.title)}</div>
<div class="grid">
  <div>
    <div class="ph">${velkyImg(p.imgs[0], p.title, SITE + '/', ' fetchpriority="high"' + (so ? ' style="filter:grayscale(1);opacity:.8"' : ''))}</div>
    ${p.imgs.length > 1 ? `<div class="thumbs">${p.imgs.slice(1).map(i => malyImg(i, p.title, SITE + '/')).join('')}</div>` : ''}
  </div>
  <div>
    <h1>${esc(p.title)}</h1>
    <div class="badges">
      ${p.seriesLabel ? (seriesUrl ? `<a class="badge y" href="${seriesUrl}" style="text-decoration:none">${esc(p.seriesLabel)}</a>` : `<span class="badge y">${esc(p.seriesLabel)}</span>`) : ''}
      ${era ? `<span class="badge">${esc(era)}</span>` : ''}
      <span class="badge">${kind}</span>
      <span class="badge ${so ? 'r' : ''}">${so ? 'Vyprodáno' : 'Skladem: ' + p.stock + ' ks'}</span>
    </div>
    <div class="price">${p.price} Kč</div>
    ${p.desc ? `<p class="desc">${esc(p.desc)}</p>` : ''}
    ${(p.features || []).length ? `<ul class="feat">${p.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
    <div class="cta">
      ${so ? '' : `<a class="p" href="${SITE}/#p=${p.slug}">Koupit — do košíku</a>`}
      <a class="s" href="${SITE}/">Zpět do nabídky</a>
    </div>
  </div>
</div>
${similar.length ? `<div class="more">
  <h2>Další z ${esc(p.seriesLabel || 'nabídky')}</h2>
  <div class="mgrid">${similar.map(s => `<a class="mcard" href="${SITE}/${OUT}/${s.slug}/">
    <div class="im">${kartaImg(s.imgs[0], s.title, SITE + '/')}</div>
    <div class="t">${esc(s.title)}</div><div class="pr">${s.price} Kč</div></a>`).join('')}</div>
</div>` : ''}
` + foot;
}

function catalogPage(all) {
  const url = `${SITE}/${OUT}/`;
  const title = 'Všechny karty a bulky | Volt Impact Cards';
  const desc = `Kompletní seznam ${all.length} produktů — Pokémon TCG bulk sety, singl karty a decky skladem. Brno a celá ČR.`;
  return head({ title, desc, url, img: `${SITE}/img/logo.png` }) + `
<div class="crumbs"><a href="${SITE}/">Nabídka</a> › Karty</div>
<h1 style="margin-bottom:18px">Všechny produkty</h1>
<div class="catlist">
${all.map(p => `<a href="${SITE}/${OUT}/${p.slug}/">${esc(p.title)} — ${p.price} Kč${p.stock === 0 ? ' (vyprodáno)' : ''}</a>`).join('\n')}
</div>
` + foot;
}

/* ── Optimalizace fotek ──
   Fotky nahrané přes administraci jdou z telefonu v původní velikosti (často 5–7 MB)
   a v Apple formátu MPO/HDR, který některé prohlížeče (Chrome) nezobrazí.
   Při každém nasazení je tady zmenšíme a převedeme na čistý JPEG.
   Originály zůstávají v gitu — mění se jen to, co se nasazuje. */
const MAX_PX = 1600;
const MAX_KB = 500;

async function optimizeImages() {
  if (process.env.SKIP_OPTIMIZE) return; // při lokálním sestavení neměnit originály v gitu
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.warn('sharp není k dispozici — přeskakuji optimalizaci fotek.');
    return;
  }
  let files = [];
  try { files = await readdir('img'); } catch { return; }
  let done = 0, savedKb = 0;
  for (const f of files) {
    if (!/\.(jpe?g|png)$/i.test(f)) continue;
    const p = `img/${f}`;
    try {
      const st = await stat(p);
      const meta = await sharp(p).metadata();
      const tooBig = st.size > MAX_KB * 1024;
      const tooWide = Math.max(meta.width || 0, meta.height || 0) > MAX_PX;
      const weirdFormat = meta.format !== 'jpeg' && meta.format !== 'png';
      if (!tooBig && !tooWide && !weirdFormat) continue;
      const buf = await sharp(p)
        .rotate()
        .resize({ width: MAX_PX, height: MAX_PX, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 84, mozjpeg: true, progressive: true })
        .toBuffer();
      if (buf.length < st.size) {
        await writeFile(p, buf);
        done++; savedKb += (st.size - buf.length) / 1024;
      }
    } catch (e) {
      console.warn(`Fotku ${f} se nepodařilo zpracovat: ${e.message}`);
    }
  }
  if (done) console.log(`Optimalizováno ${done} fotek, úspora ${Math.round(savedKb / 1024)} MB.`);
}

await optimizeImages();

async function vyrobVarianty() {
  let sharp;
  try { sharp = (await import('sharp')).default; }
  catch { console.warn('sharp není k dispozici — zmenšené fotky se nevyrobí (web použije originály).'); return; }
  let files = [];
  try { files = (await readdir('img')).filter(f => /\.(jpe?g|png)$/i.test(f)); } catch { return; }
  for (const v of Object.keys(VARIANTY)) await mkdir(`img/${v}`, { recursive: true });
  const ukoly = [];
  for (const f of files) for (const [v, px] of Object.entries(VARIANTY)) ukoly.push({ f, v, px });
  let hotovo = 0, chyby = 0;
  const zpracuj = async ({ f, v, px }) => {
    const src = `img/${f}`, out = `img/${v}/${f}.webp`;
    try {
      if (existsSync(out) && (await stat(out)).mtimeMs >= (await stat(src)).mtimeMs) return;
      await sharp(src).rotate()
        .resize({ width: px, height: px, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: v === 'l' ? 76 : 74, effort: 4 })
        .toFile(out);
      hotovo++;
    } catch (e) { chyby++; console.warn(`WebP ${out}: ${e.message}`); }
  };
  // 4 fotky současně — rychlé a nezahltí paměť
  for (let i = 0; i < ukoly.length; i += 4) await Promise.all(ukoly.slice(i, i + 4).map(zpracuj));
  console.log(`Zmenšené fotky: vyrobeno ${hotovo}, chyb ${chyby}.`);
}
await vyrobVarianty();

const raw = JSON.parse(await readFile('products.json', 'utf8'));
const all = [];
const seen = new Set();
for (const [group, items] of Object.entries(raw)) {
  for (const p of items) {
    if (!p || !p.title || !Array.isArray(p.imgs) || !p.imgs.length) continue;
    let slug = slugify(p.title);
    if (!slug) continue;
    let s = slug, n = 2;
    while (seen.has(s)) s = `${slug}-${n++}`;
    seen.add(s);
    all.push({ ...p, slug: s, group });
  }
}

if (existsSync(OUT)) await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

{
  const pocty = {};
  for (const p of all) if (p.series && SERIE_POPIS[p.series]) pocty[p.series] = (pocty[p.series] || 0) + 1;
  SERIE_PAGES = new Set(Object.keys(pocty).filter(k => pocty[k] >= 2));
}

for (const p of all) {
  const similar = all.filter(x => x.slug !== p.slug && x.series === p.series && x.stock !== 0).slice(0, 4);
  await mkdir(`${OUT}/${p.slug}`, { recursive: true });
  await writeFile(`${OUT}/${p.slug}/index.html`, productPage(p, similar), 'utf8');
}
/* ── Stránky sérií a ér ── */
function produktyGrid(items) {
  return `<div class="mgrid">${items.map(s => `<a class="mcard" href="${SITE}/${OUT}/${s.slug}/">
    <div class="im">${kartaImg(s.imgs[0], s.title, SITE + '/', ' loading="lazy"' + ((s.stock === 0 || s.soldout === true) ? ' style="filter:grayscale(1);opacity:.75"' : ''))}</div>
    <div class="t">${esc(s.title)}</div><div class="pr">${s.price} Kč${(s.stock === 0 || s.soldout === true) ? ' · vyprodáno' : ''}</div></a>`).join('')}</div>`;
}

function skupinaPage(kind, key, label, popis, items) {
  const base = kind === 'era' ? 'era' : 'serie';
  const url = `${SITE}/${base}/${key}/`;
  const skladem = items.filter(p => !(p.stock === 0 || p.soldout === true));
  const ceny = skladem.map(p => p.price);
  const od = ceny.length ? Math.min(...ceny) : null;
  const nadpis = kind === 'era' ? `Pokémon karty z éry ${label}` : `${label} — Pokémon karty`;
  const title = kind === 'era'
    ? `Éra ${label} — Pokémon karty skladem | Volt Impact Cards`
    : `${label} karty — Pokémon singly a bulky | Volt Impact Cards`;
  const desc = `${nadpis}: ${items.length} produktů${od !== null ? ' od ' + od + ' Kč' : ''}. Originální karty, osobní předání v Brně, Zásilkovnou po celé ČR.`;
  const crumbs = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Nabídka', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Série a éry', item: `${SITE}/serie/` },
      { '@type': 'ListItem', position: 3, name: label, item: url }
    ]
  };
  const list = {
    '@context': 'https://schema.org', '@type': 'ItemList', name: nadpis,
    itemListElement: items.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/${OUT}/${p.slug}/`, name: p.title }))
  };
  const extraLd = `<script type="application/ld+json">${JSON.stringify(crumbs)}</script>
<script type="application/ld+json">${JSON.stringify(list)}</script>`;
  return head({ title, desc, url, img: `${SITE}/${items[0].imgs[0]}`, extraLd }) + `
<div class="crumbs"><a href="${SITE}/">Nabídka</a> › <a href="${SITE}/serie/">Série a éry</a> › ${esc(label)}</div>
<h1 style="margin-bottom:12px">${esc(nadpis)}</h1>
<p class="desc" style="max-width:720px">${esc(popis)} Skladem máme ${skladem.length} ${skladem.length === 1 ? 'produkt' : (skladem.length < 5 ? 'produkty' : 'produktů')}${od !== null ? ' od ' + od + ' Kč' : ''}.</p>
<div class="more" style="margin-top:28px">${produktyGrid(items)}</div>
` + foot;
}

function serieIndexPage(serie, ery) {
  const url = `${SITE}/serie/`;
  const title = 'Pokémon karty podle sérií a ér | Volt Impact Cards';
  const desc = 'Pokémon karty rozdělené podle sérií a ér — Scarlet & Violet, Mega Evolution, Sword & Shield a další. Originální karty skladem.';
  const radek = (base, key, label, n) => `<a href="${SITE}/${base}/${key}/">${esc(label)} — ${n} ${n === 1 ? 'produkt' : (n < 5 ? 'produkty' : 'produktů')}</a>`;
  return head({ title, desc, url, img: `${SITE}/img/logo.png` }) + `
<div class="crumbs"><a href="${SITE}/">Nabídka</a> › Série a éry</div>
<h1 style="margin-bottom:18px">Pokémon karty podle sérií a ér</h1>
<h2 style="font-size:1.05rem;margin:18px 0 10px;color:var(--yellow)">Éry</h2>
<div class="catlist">${ery.map(e => radek('era', e.key, e.label, e.items.length)).join('\n')}</div>
<h2 style="font-size:1.05rem;margin:26px 0 10px;color:var(--yellow)">Série</h2>
<div class="catlist">${serie.map(s => radek('serie', s.key, s.label, s.items.length)).join('\n')}</div>
` + foot;
}

await writeFile(`${OUT}/index.html`, catalogPage(all), 'utf8');

// série
const serieMap = new Map();
for (const p of all) {
  if (!p.series || !SERIE_POPIS[p.series]) continue;
  if (!serieMap.has(p.series)) serieMap.set(p.series, { key: p.series, label: p.seriesLabel || p.series, items: [] });
  serieMap.get(p.series).items.push(p);
}
const serieList = [...serieMap.values()].filter(s => s.items.length >= 2).sort((a, b) => b.items.length - a.items.length);
// éry
const eraMap = new Map();
for (const p of all) {
  if (!p.era || !ERA_POPIS[p.era]) continue;
  if (!eraMap.has(p.era)) eraMap.set(p.era, { key: p.era, label: ERA_LABELS[p.era] || p.era, items: [] });
  eraMap.get(p.era).items.push(p);
}
const eraList = [...eraMap.values()].filter(e => e.items.length >= 2).sort((a, b) => b.items.length - a.items.length);

for (const dir of ['serie', 'era']) if (existsSync(dir)) await rm(dir, { recursive: true, force: true });
await mkdir('serie', { recursive: true });
await mkdir('era', { recursive: true });
const seradit = items => [...items].sort((a, b) => (a.stock === 0) - (b.stock === 0));
for (const s of serieList) {
  await mkdir(`serie/${s.key}`, { recursive: true });
  await writeFile(`serie/${s.key}/index.html`, skupinaPage('serie', s.key, s.label, SERIE_POPIS[s.key], seradit(s.items)), 'utf8');
}
for (const e of eraList) {
  await mkdir(`era/${e.key}`, { recursive: true });
  await writeFile(`era/${e.key}/index.html`, skupinaPage('era', e.key, e.label, ERA_POPIS[e.key], seradit(e.items)), 'utf8');
}
await writeFile('serie/index.html', serieIndexPage(serieList, eraList), 'utf8');

/* ── Předvykreslení produktů do index.html ──
   Produkty se na domovské stránce vykreslují JavaScriptem. Sem je vložíme i přímo do HTML,
   aby je viděly vyhledávače (hlavně Seznam) a vedly z nich odkazy na stránky produktů.
   JavaScript je po načtení nahradí plnohodnotnými kartami. */
function prerenderKarta(p, i = 99) {
  const so = p.stock === 0 || p.soldout === true;
  const ft = p.featured === true && !so;
  const odkaz = `<a class="card-link" href="/${OUT}/${p.slug}/">${esc(p.title)}</a>`;
  // první řada nabídky se načítá hned (je vidět bez posunutí), ostatní až při posunu
  const img = kartaImg(p.imgs[0], p.title, '', i < 4 ? '' : ' loading="lazy"');
  const soldout = so ? '<div class="soldout-overlay"><span>Vyprodáno</span></div>' : '';
  const featured = ft ? '<span class="featured-badge">\u2b50 Doporučujeme</span>' : '';
  const sklad = so ? 'Vyprodáno' : p.stock + ' ks';
  if (p.group === 'singles') return `<div class="single-card prerendered${so ? ' soldout' : ''}${ft ? ' featured' : ''}">
    <div class="single-img-wrap">${img}${featured}${soldout}<span class="stock-badge${so ? ' soldout-badge' : ''}">${sklad}</span></div>
    <div class="single-info"><h3>${odkaz}</h3><div class="single-price">${p.price} Kč</div></div>
  </div>`;
  if (p.group === 'decks') return `<div class="deck-card prerendered${so ? ' soldout' : ''}${ft ? ' featured' : ''}">
    <div class="deck-img-wrap">${img}${soldout}${featured}<span class="deck-stock-badge${so ? ' soldout-badge' : ''}">${sklad}</span><span class="deck-type-badge">${esc(p.seriesLabel || 'Deck')}</span></div>
    <div class="deck-info"><h3>${odkaz}</h3><div class="deck-price">${p.price} <small>Kč</small></div></div>
  </div>`;
  return `<div class="product-card prerendered${so ? ' soldout' : ''}${ft ? ' featured' : ''}">
    <div class="product-img-wrap">${img}${soldout}${featured}<span class="stock-badge${so ? ' soldout-badge' : ''}">${sklad}</span><span class="product-type-badge">${esc(p.seriesLabel || '')}</span></div>
    <div class="product-info"><h3>${odkaz}</h3><div class="product-price">${p.price} <small>Kč</small></div></div>
  </div>`;
}

function poradi(items) {
  const so = p => p.stock === 0 || p.soldout === true;
  return [...items.filter(p => p.featured === true && !so(p)), ...items.filter(p => p.featured !== true && !so(p)), ...items.filter(so)];
}

if (existsSync('index.html')) {
  let idx = await readFile('index.html', 'utf8');
  for (const [skupina, prazdne] of [['bulks', ''], ['decks', '<p style="color:var(--grey);font-size:0.9rem;">Zatím žádné decky — brzy naskladníme!</p>'], ['singles', '']]) {
    const items = poradi(all.filter(p => p.group === skupina));
    const html = items.length ? '\n' + items.map((p, i) => prerenderKarta(p, skupina === 'bulks' ? i : 99)).join('\n') + '\n' : prazdne;
    const re = new RegExp(`<!--PRERENDER:${skupina}-->[\\s\\S]*?<!--/PRERENDER:${skupina}-->`);
    if (re.test(idx)) idx = idx.replace(re, `<!--PRERENDER:${skupina}-->${html}<!--/PRERENDER:${skupina}-->`);
  }
  await writeFile('index.html', idx, 'utf8');
}


/* ── Právní dokumenty ── */
const LEGAL_CSS = `
.doc h1{font-size:1.6rem;margin:10px 0 6px}
.doc h2{font-size:1.05rem;margin:26px 0 8px;color:var(--yellow)}
.doc p,.doc li{color:#c9c9d4;font-size:.92rem;margin-bottom:8px}
.doc ul,.doc ol{padding-left:20px;margin-bottom:10px}
.doc table{width:100%;border-collapse:collapse;margin:10px 0 16px}
.doc td,.doc th{border:1px solid var(--border);padding:8px 10px;font-size:.88rem;text-align:left;color:#c9c9d4}
.doc th{color:#fff;font-weight:700}
.doc .upd{color:var(--grey);font-size:.8rem}
.doc .box{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;margin:14px 0}
.doc a{color:var(--yellow)}
`;

function legalPage(slug, title, desc, body) {
  const url = `${SITE}/${slug}/`;
  return head({ title: `${title} | Volt Impact Cards`, desc, url, img: `${SITE}/img/logo.png` })
    .replace('</style>', LEGAL_CSS + '</style>') + `
<div class="crumbs"><a href="${SITE}/">Nabídka</a> › ${esc(title)}</div>
<div class="doc">
${body}
<p class="upd">Účinné od ${DNES}.</p>
</div>
` + foot;
}

const DNES = new Date().toLocaleDateString('cs-CZ');
const PRODEJCE_BLOK = `<div class="box">
  <p><b>${SELLER.jmeno}</b>${SELLER.adresa ? '<br/>' + esc(SELLER.adresa) : ''}<br/>
  IČO: ${seller('ico')}<br/>
  E-mail: <a href="mailto:${MAIL}">${MAIL}</a><br/>
  Telefon: +420 605 886 256<br/>
  ${SELLER.dph ? '' : 'Neplátce DPH.'}</p>
  <p style="margin:0">Prodávající není zapsán v obchodním rejstříku; je zapsán v živnostenském rejstříku vedeném příslušným živnostenským úřadem.</p>
</div>`;

const OP = `
<h1>Obchodní podmínky</h1>
<p>Tyto obchodní podmínky upravují prodej sběratelských karet Pokémon TCG prostřednictvím webu <a href="${SITE}/">voltimpactcards.com</a> (dále jen „web“).</p>

<h2>1. Prodávající</h2>
${PRODEJCE_BLOK}

<h2>2. Objednávka a uzavření kupní smlouvy</h2>
<p>Zboží vložíte do košíku a objednávku odešlete přes formulář na webu. Odesláním objednávky potvrzujete, že jste se seznámil(a) s těmito podmínkami. Kupní smlouva je uzavřena okamžikem, kdy Vám prodávající potvrdí přijetí objednávky na uvedený e-mail.</p>
<p>Nabídka zboží je informativní; každá karta je zpravidla skladem v jednom kuse. Pokud zboží nebude dostupné, prodávající Vás bez zbytečného odkladu kontaktuje a případně přijatou platbu vrátí v plné výši.</p>

<h2>3. Ceny a platba</h2>
<p>Ceny na webu jsou konečné, v korunách českých. Prodávající ${SELLER.dph ? 'je' : 'není'} plátcem DPH.</p>
<p>Jediným způsobem platby je <b>bankovní převod</b> na účet <b>${SELLER.ucet}</b>. Variabilním symbolem je číslo objednávky, které se zobrazí po jejím odeslání a přijde Vám i e-mailem.</p>
<p>Splatnost je <b>7 kalendářních dnů</b> od potvrzení objednávky. Nebude-li platba do té doby připsána, objednávka bez dalšího zaniká a zboží se vrací do nabídky.</p>

<h2>4. Dodání zboží</h2>
<table>
  <tr><th>Způsob</th><th>Cena</th><th>Doba dodání</th></tr>
  <tr><td>Zásilkovna — výdejní místo / Z-BOX</td><td>79 Kč</td><td>zpravidla 1–2 pracovní dny od podání</td></tr>
  <tr><td>Zásilkovna — doručení na adresu</td><td>109 Kč</td><td>zpravidla 1–2 pracovní dny od podání</td></tr>
  <tr><td>Osobní předání — Brno, Hlavní nádraží</td><td>zdarma</td><td>dle domluvy, po připsání platby</td></tr>
</table>
<p>Zásilku prodávající podá do 3 pracovních dnů od připsání platby. Zásilky jsou standardní, do hmotnosti 5 kg. Zboží je baleno tak, aby nedošlo k poškození karet při přepravě.</p>
<p>Nebezpečí škody na zboží přechází na kupujícího převzetím zboží.</p>

<h2>5. Odstoupení od smlouvy do 14 dnů</h2>
<p>Jste-li spotřebitel, máte právo odstoupit od smlouvy bez udání důvodu do <b>14 dnů</b> ode dne převzetí zboží. Podrobnosti a vzorový formulář najdete na stránce <a href="${SITE}/odstoupeni-od-smlouvy/">Odstoupení od smlouvy</a>.</p>

<h2>6. Práva z vadného plnění a reklamace</h2>
<p>Prodávající odpovídá za to, že zboží při převzetí nemá vady a odpovídá popisu, zejména uvedenému stavu karty (Near Mint, Lightly Played, Moderately Played). U spotřebitele lze právo z vadného plnění uplatnit do 24 měsíců od převzetí; u zboží prodávaného jako použité se nevztahuje na opotřebení odpovídající uvedenému stavu a na vady, kvůli kterým byla sjednána nižší cena.</p>
<p>Reklamaci uplatněte e-mailem na <a href="mailto:${MAIL}">${MAIL}</a>. Uveďte číslo objednávky, popis vady a fotografie. Reklamaci prodávající vyřídí do 30 dnů.</p>

<h2>7. Mimosoudní řešení sporů</h2>
<p>K mimosoudnímu řešení spotřebitelských sporů je příslušná <b>Česká obchodní inspekce</b>, Štěpánská 796/44, 110 00 Praha 1, <a href="https://www.coi.cz" target="_blank" rel="noopener">www.coi.cz</a>, formulář na <a href="https://adr.coi.cz" target="_blank" rel="noopener">adr.coi.cz</a>. Dozor nad dodržováním povinností podle zákona o ochraně spotřebitele vykonává rovněž Česká obchodní inspekce.</p>

<h2>8. Osobní údaje</h2>
<p>Zpracování osobních údajů popisuje samostatný dokument <a href="${SITE}/ochrana-osobnich-udaju/">Ochrana osobních údajů</a>.</p>

<h2>9. Závěrečná ustanovení</h2>
<p>Vztahy neupravené těmito podmínkami se řídí právním řádem České republiky, zejména zákonem č. 89/2012 Sb., občanský zákoník, a zákonem č. 634/1992 Sb., o ochraně spotřebitele.</p>
`;

const GDPR = `
<h1>Ochrana osobních údajů</h1>
<p>Tento dokument popisuje, jak jsou zpracovávány osobní údaje zákazníků webu voltimpactcards.com podle nařízení (EU) 2016/679 (GDPR).</p>

<h2>Správce údajů</h2>
${PRODEJCE_BLOK}

<h2>Jaké údaje zpracováváme a proč</h2>
<table>
  <tr><th>Údaje</th><th>Účel</th><th>Právní základ</th><th>Doba uchování</th></tr>
  <tr><td>Jméno a příjmení, e-mail, telefon, doručovací adresa nebo výdejní místo</td><td>Vyřízení objednávky, doručení zboží, komunikace</td><td>Plnění smlouvy</td><td>Po dobu vyřízení objednávky</td></tr>
  <tr><td>Údaje o objednávce a platbě</td><td>Vedení evidence a plnění daňových povinností</td><td>Právní povinnost</td><td>Dle zákona, zpravidla 10 let</td></tr>
</table>

<h2>Komu údaje předáváme</h2>
<ul>
  <li><b>Zásilkovna s.r.o.</b> — doručení zásilky (jméno, adresa nebo výdejní místo, telefon, e-mail)</li>
  <li><b>Netlify, Inc.</b> — provoz webu a doručení formuláře s objednávkou</li>
  <li><b>Google Ireland Limited</b> — měření účinnosti reklamy, pouze po udělení souhlasu s cookies</li>
  <li>Případně účetní nebo daňový poradce v rozsahu nutném pro vedení evidence</li>
</ul>
<p>Údaje neprodáváme ani nepředáváme třetím stranám pro marketingové účely.</p>

<h2>Tvá práva</h2>
<ul>
  <li>na přístup ke svým údajům a na jejich kopii</li>
  <li>na opravu nepřesných údajů</li>
  <li>na výmaz, pokud už údaje nejsou potřebné a netrvá zákonná povinnost je uchovat</li>
  <li>na omezení zpracování a na přenositelnost údajů</li>
  <li>vznést námitku proti zpracování</li>
  <li>podat stížnost u <a href="https://www.uoou.cz" target="_blank" rel="noopener">Úřadu pro ochranu osobních údajů</a></li>
</ul>
<p>Kdykoli nás můžete kontaktovat na <a href="mailto:${MAIL}">${MAIL}</a>.</p>

<h2>Cookies a měření reklamy</h2>
<p>Web používá měřicí kód <b>Google Ads (gtag.js)</b> společnosti Google Ireland Limited, který nám ukazuje, kolik návštěv a objednávek přinesla reklama. Může při tom ukládat soubory cookie do Vašeho prohlížeče.</p>
<p>Tyto cookies <b>nespouštíme bez Vašeho souhlasu</b>. Při první návštěvě se zobrazí lišta, kde volbu potvrdíte nebo odmítnete; do té doby je měření nastaveno jako zakázané (tzv. Consent Mode). Volbu si web uloží do místního úložiště prohlížeče a kdykoli ji změníte smazáním dat webu v prohlížeči.</p>
<p>Odmítnutí nijak neomezuje nákup — objednávku lze dokončit v plném rozsahu.</p>
<p>Obsah košíku se ukládá pouze do místního úložiště Vašeho prohlížeče (localStorage) a neodesílá se nikam, dokud objednávku sami neodešlete. Nejde o cookies a neslouží k měření.
`;

const ODSTOUPENI = `
<h1>Odstoupení od smlouvy</h1>
<p>Jste-li spotřebitel, máte právo odstoupit od kupní smlouvy bez udání důvodu ve lhůtě <b>14 dnů</b> ode dne, kdy jste Vy nebo Vámi určená třetí osoba převzali zboží.</p>

<h2>Jak odstoupit</h2>
<ol>
  <li>Ve lhůtě 14 dnů pošlete jednoznačné oznámení na <a href="mailto:${MAIL}">${MAIL}</a> — můžete použít vzorový formulář níže.</li>
  <li>Zboží odešlete nebo předejte nejpozději do 14 dnů od odstoupení. Náklady na vrácení zboží hradí kupující.</li>
  <li>Peníze (včetně nákladů na dodání ve výši nejlevnějšího nabízeného způsobu) vrátíme do 14 dnů od odstoupení, nejdříve však po obdržení vráceného zboží nebo prokázání jeho odeslání. Vracíme je na účet, ze kterého platba přišla.</li>
</ol>
<p>Zboží vraťte nepoškozené a v původním stavu. Odpovídáte za snížení hodnoty zboží, které vzniklo nakládáním s ním jinak, než je nutné k seznámení se s jeho povahou a vlastnostmi.</p>

<h2>Vzorový formulář pro odstoupení</h2>
<div class="box">
<p style="white-space:pre-line">Adresát: ${SELLER.jmeno}, ${MAIL}

Oznamuji, že tímto odstupuji od smlouvy o nákupu tohoto zboží:

Číslo objednávky: ……………………………
Datum objednání / převzetí: ……………………………
Jméno a příjmení spotřebitele: ……………………………
Adresa spotřebitele: ……………………………
Číslo účtu pro vrácení peněz: ……………………………

Datum: ……………………………
Podpis (pouze pokud je formulář zasílán v listinné podobě): ……………………………</p>
</div>
`;

for (const [slug, title, desc, body] of [
  ['obchodni-podminky', 'Obchodní podmínky', 'Obchodní podmínky prodeje sběratelských karet Pokémon TCG — objednávka, platba převodem, doprava Zásilkovnou, odstoupení do 14 dnů a reklamace.', OP],
  ['ochrana-osobnich-udaju', 'Ochrana osobních údajů', 'Jak zpracováváme osobní údaje zákazníků podle GDPR — jaké údaje, proč, komu je předáváme a jaká máte práva.', GDPR],
  ['odstoupeni-od-smlouvy', 'Odstoupení od smlouvy', 'Poučení o právu spotřebitele odstoupit od smlouvy do 14 dnů včetně vzorového formuláře.', ODSTOUPENI]
]) {
  await mkdir(slug, { recursive: true });
  await writeFile(`${slug}/index.html`, legalPage(slug, title, desc, body), 'utf8');
}
const LEGAL_SLUGS = ['obchodni-podminky', 'ochrana-osobnich-udaju', 'odstoupeni-od-smlouvy'];

const today = new Date().toISOString().slice(0, 10);
const urls = [
  { loc: `${SITE}/`, pri: '1.0', freq: 'weekly' },
  { loc: `${SITE}/${OUT}/`, pri: '0.8', freq: 'weekly' },
  ...all.map(p => ({ loc: `${SITE}/${OUT}/${p.slug}/`, pri: '0.7', freq: 'monthly' })),
  { loc: `${SITE}/serie/`, pri: '0.7', freq: 'weekly' },
  ...serieList.map(s => ({ loc: `${SITE}/serie/${s.key}/`, pri: '0.8', freq: 'weekly' })),
  ...eraList.map(e => ({ loc: `${SITE}/era/${e.key}/`, pri: '0.8', freq: 'weekly' })),
  ...LEGAL_SLUGS.map(s => ({ loc: `${SITE}/${s}/`, pri: '0.3', freq: 'yearly' }))
];
await writeFile('sitemap.xml',
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.freq}</changefreq>
    <priority>${u.pri}</priority>
  </url>`).join('\n')}
</urlset>
`, 'utf8');

console.log(`Vygenerováno ${all.length} stránek produktů + katalog + ${serieList.length} sérií + ${eraList.length} ér + 3 právní dokumenty + sitemap.`);
