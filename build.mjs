/* Generátor samostatných stránek produktů pro Volt Impact Cards.
   Spouští se automaticky při každém nasazení na Netlify (viz netlify.toml).
   Čte products.json a vytváří /karta/<slug>/index.html + /karta/index.html + sitemap.xml */

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const SITE = 'https://voltimpactcards.com';
const MAIL = 'voltimpactcards@gmail.com';
const WA = '420605886256';
const OUT = 'karta';

const ERA_LABELS = { original:'Original', neo:'Neo', ecard:'e-Card', ex:'EX', dp:'Diamond & Pearl',
  platinum:'Platinum', hgss:'HeartGold & SoulSilver', bw:'Black & White', xy:'XY', sm:'Sun & Moon',
  swsh:'Sword & Shield', sv:'Scarlet & Violet', mega:'Mega Evolution', mix:'Mix' };

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const slugify = s => norm(s).replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');

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

const head = ({ title, desc, url, img, extraLd }) => `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
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
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&display=swap" rel="stylesheet">
<style>${CSS}</style>
${extraLd || ''}
</head>
<body>
<div class="wrap">
<a class="top" href="${SITE}/" style="text-decoration:none">
  <img src="${SITE}/img/logo_nav.png" alt="Volt Impact Cards"/>
  <span>Volt Impact <i>Cards</i></span>
</a>`;

const foot = `<footer>
  <p>Volt Impact Cards — Pokémon TCG, Brno / Vyškov &amp; celá ČR</p>
  <p style="margin-top:6px"><a href="mailto:${MAIL}">${MAIL}</a> · <a href="https://wa.me/${WA}">WhatsApp</a> · <a href="${SITE}/">Zpět na nabídku</a></p>
  <p style="margin-top:10px;opacity:.7">Nejsme partnerem ani sponzorem The Pokémon Company.</p>
</footer>
</div>
</body>
</html>`;

function productPage(p, similar) {
  const url = `${SITE}/${OUT}/${p.slug}/`;
  const img = `${SITE}/${p.imgs[0]}`;
  const era = ERA_LABELS[p.era] || '';
  const so = p.stock === 0 || p.soldout === true;
  const kind = p.type === 'Single' ? 'Singl karta' : p.type === 'Deck' ? 'Deck' : 'Bulk set';
  const title = `${p.title} — ${p.seriesLabel || ''} | Volt Impact Cards`.replace(/\s+—\s+\|/, ' |');
  const desc = [
    `${kind} ${p.title}`,
    p.seriesLabel ? `ze série ${p.seriesLabel}` : '',
    era ? `(${era})` : '',
    `za ${p.price} Kč.`,
    so ? 'Momentálně vyprodáno.' : `Skladem ${p.stock} ks.`,
    'Osobní předání Brno / Vyškov, zaslání po celé ČR.'
  ].filter(Boolean).join(' ');

  const ld = {
    '@context': 'https://schema.org', '@type': 'Product',
    name: p.title, description: p.desc || desc,
    image: p.imgs.map(i => `${SITE}/${i}`),
    category: kind,
    brand: { '@type': 'Brand', name: 'Pokémon' },
    offers: {
      '@type': 'Offer', url, price: p.price, priceCurrency: 'CZK',
      availability: so ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/UsedCondition',
      seller: { '@type': 'Organization', name: 'Volt Impact Cards' }
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

  const waText = encodeURIComponent(`Dobrý den, mám zájem o: ${p.title} (${p.price} Kč). ${url}`);
  const mailBody = encodeURIComponent(`Dobrý den,\n\nmám zájem o: ${p.title} (${p.price} Kč)\nPočet kusů: 1\n\nOdkaz: ${url}\n\nDěkuji,\n`);

  return head({ title, desc, url, img, extraLd }) + `
<div class="crumbs"><a href="${SITE}/">Nabídka</a> › <a href="${SITE}/${OUT}/">Karty</a> › ${esc(p.title)}</div>
<div class="grid">
  <div>
    <div class="ph"><img src="${SITE}/${p.imgs[0]}" alt="${esc(p.title)}"${so ? ' style="filter:grayscale(1);opacity:.8"' : ''}/></div>
    ${p.imgs.length > 1 ? `<div class="thumbs">${p.imgs.slice(1).map(i => `<img src="${SITE}/${i}" alt="${esc(p.title)}" loading="lazy"/>`).join('')}</div>` : ''}
  </div>
  <div>
    <h1>${esc(p.title)}</h1>
    <div class="badges">
      ${p.seriesLabel ? `<span class="badge y">${esc(p.seriesLabel)}</span>` : ''}
      ${era ? `<span class="badge">${esc(era)}</span>` : ''}
      <span class="badge">${kind}</span>
      <span class="badge ${so ? 'r' : ''}">${so ? 'Vyprodáno' : 'Skladem: ' + p.stock + ' ks'}</span>
    </div>
    <div class="price">${p.price} Kč</div>
    ${p.desc ? `<p class="desc">${esc(p.desc)}</p>` : ''}
    ${(p.features || []).length ? `<ul class="feat">${p.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
    <div class="cta">
      ${so ? '' : `<a class="p" href="mailto:${MAIL}?subject=${encodeURIComponent('Zájem o: ' + p.title)}&body=${mailBody}">Mám zájem</a>
      <a class="s" href="https://wa.me/${WA}?text=${waText}" rel="noopener">WhatsApp</a>`}
      <a class="s" href="${SITE}/#p=${p.slug}">Zobrazit v nabídce</a>
    </div>
  </div>
</div>
${similar.length ? `<div class="more">
  <h2>Další z ${esc(p.seriesLabel || 'nabídky')}</h2>
  <div class="mgrid">${similar.map(s => `<a class="mcard" href="${SITE}/${OUT}/${s.slug}/">
    <div class="im"><img src="${SITE}/${s.imgs[0]}" alt="${esc(s.title)}" loading="lazy"/></div>
    <div class="t">${esc(s.title)}</div><div class="pr">${s.price} Kč</div></a>`).join('')}</div>
</div>` : ''}
` + foot;
}

function catalogPage(all) {
  const url = `${SITE}/${OUT}/`;
  const title = 'Všechny karty a bulky | Volt Impact Cards';
  const desc = `Kompletní seznam ${all.length} produktů — Pokémon TCG bulk sety, singl karty a decky skladem. Brno / Vyškov a celá ČR.`;
  return head({ title, desc, url, img: `${SITE}/img/logo.png` }) + `
<div class="crumbs"><a href="${SITE}/">Nabídka</a> › Karty</div>
<h1 style="margin-bottom:18px">Všechny produkty</h1>
<div class="catlist">
${all.map(p => `<a href="${SITE}/${OUT}/${p.slug}/">${esc(p.title)} — ${p.price} Kč${p.stock === 0 ? ' (vyprodáno)' : ''}</a>`).join('\n')}
</div>
` + foot;
}

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

for (const p of all) {
  const similar = all.filter(x => x.slug !== p.slug && x.series === p.series && x.stock !== 0).slice(0, 4);
  await mkdir(`${OUT}/${p.slug}`, { recursive: true });
  await writeFile(`${OUT}/${p.slug}/index.html`, productPage(p, similar), 'utf8');
}
await writeFile(`${OUT}/index.html`, catalogPage(all), 'utf8');

const today = new Date().toISOString().slice(0, 10);
const urls = [
  { loc: `${SITE}/`, pri: '1.0', freq: 'weekly' },
  { loc: `${SITE}/${OUT}/`, pri: '0.8', freq: 'weekly' },
  ...all.map(p => ({ loc: `${SITE}/${OUT}/${p.slug}/`, pri: '0.7', freq: 'monthly' }))
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

console.log(`Vygenerováno ${all.length} stránek produktů + katalog + sitemap.`);
