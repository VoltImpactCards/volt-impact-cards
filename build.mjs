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
  <p>Volt Impact Cards — Pokémon TCG, Brno &amp; celá ČR</p>
  <p style="margin-top:6px">Prodávající: ${SELLER.jmeno}${SELLER.ico ? ', IČO ' + SELLER.ico : ''}${SELLER.adresa ? ', ' + SELLER.adresa : ''}${SELLER.dph ? '' : ' · Neplátce DPH'}</p>
  <p style="margin-top:6px"><a href="mailto:${MAIL}">${MAIL}</a> · <a href="https://wa.me/${WA}">WhatsApp</a> · <a href="${SITE}/">Zpět na nabídku</a></p>
  <p style="margin-top:6px"><a href="${SITE}/obchodni-podminky/">Obchodní podmínky</a> · <a href="${SITE}/ochrana-osobnich-udaju/">Ochrana osobních údajů</a> · <a href="${SITE}/odstoupeni-od-smlouvy/">Odstoupení od smlouvy</a></p>
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
    'Osobní předání v Brně, zaslání po celé ČR.'
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
      ${so ? '' : `<a class="p" href="${SITE}/#p=${p.slug}">Koupit — do košíku</a>`}
      <a class="s" href="${SITE}/">Zpět do nabídky</a>
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

<h2>Cookies</h2>
<p>Web nepoužívá analytické ani reklamní cookies. Obsah košíku se ukládá pouze do místního úložiště Vašeho prohlížeče (localStorage) a neodesílá se nikam, dokud objednávku sami neodešlete.</p>
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

console.log(`Vygenerováno ${all.length} stránek produktů + katalog + 3 právní dokumenty + sitemap.`);
