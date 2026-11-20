// PokéSklad → web Volt Impact Cards
// ------------------------------------------------------------
// Přijme produkt sestavený v PokéSkladu (Product Builder) a uloží ho na web:
// fotky do img/ a záznam do products.json — vše jako JEDEN commit do GitHubu.
// Netlify pak web sám přestaví (cca 1–2 min) a produkt je živě v prodeji.
//
// Adresa:  POST /.netlify/functions/pridat-produkt   (vytvoření produktu)
//          GET  /.netlify/functions/pridat-produkt   (test připojení)
// Hlavička: x-api-key: <POKESKLAD_API_KEY>
//
// Proměnné prostředí na Netlify (Project configuration → Environment variables):
//   POKESKLAD_API_KEY  – tajný klíč, který zadáš i v PokéSkladu (povinné)
//   GITHUB_TOKEN       – fine-grained token jen pro tento repozitář,
//                        oprávnění „Contents: Read and write“ (povinné)
//   GITHUB_REPO        – volitelné, výchozí "VoltImpactCards/volt-impact-cards"
//   GITHUB_BRANCH      – volitelné, výchozí "main"

import { timingSafeEqual } from "node:crypto";

const REPO = process.env.GITHUB_REPO || "VoltImpactCards/volt-impact-cards";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const GROUPS = ["bulks", "decks", "singles"];
const MAX_IMGS = 8;
const MAX_IMG_BYTES = 2.5 * 1024 * 1024; // jedna fotka po dekódování

// Edice (TCGdex id nebo název) → klíč série na webu + popisek + éra
const SERIE = [
  { ids: ["sv03.5"], names: ["151"], series: "sv151", label: "Scarlet & Violet 151", era: "sv" },
  { ids: ["sv03"], names: ["obsidian flames"], series: "obsidian", label: "Obsidian Flames", era: "sv" },
  { ids: ["sv05"], names: ["temporal forces"], series: "temporal", label: "Temporal Forces", era: "sv" },
  { ids: ["sv06.5"], names: ["shrouded fable"], series: "sfa", label: "Shrouded Fable", era: "sv" },
  { ids: ["sv08"], names: ["surging sparks"], series: "surging", label: "Surging Sparks", era: "sv" },
  { ids: ["sv08.5"], names: ["prismatic evolutions"], series: "prismatic", label: "Prismatic Evolutions", era: "sv" },
  { ids: ["sv09"], names: ["journey together"], series: "jt", label: "Journey Together", era: "sv" },
  { ids: ["me01"], names: ["mega evolution"], series: "mega", label: "Mega Evolutions", era: "mega" },
  { ids: ["me02"], names: ["phantasmal flames"], series: "flames", label: "Phantasmal Flames", era: "mega" },
  { ids: ["swsh10.5"], names: ["pokemon go", "pokémon go"], series: "pokemongo", label: "Pokémon GO", era: "swsh" },
  { ids: ["swsh11"], names: ["lost origin"], series: "lost", label: "Lost Origin", era: "swsh" },
  { ids: ["swsh10"], names: ["astral radiance"], series: "astral", label: "Astral Radiance", era: "swsh" },
  { ids: ["swsh1"], names: ["sword & shield", "sword and shield"], series: "swshbase", label: "Sword & Shield", era: "swsh" },
];

function eraFromSetId(id = "") {
  const s = String(id).toLowerCase();
  if (s.startsWith("me")) return "mega";
  if (s.startsWith("sv")) return "sv";
  if (s.startsWith("swsh")) return "swsh";
  if (s.startsWith("sm")) return "sm";
  if (s.startsWith("xy")) return "xy";
  if (s.startsWith("bw")) return "bw";
  if (s.startsWith("hgss")) return "hgss";
  if (s.startsWith("pl")) return "platinum";
  if (s.startsWith("dp")) return "dp";
  if (s.startsWith("ex")) return "ex";
  if (s.startsWith("neo")) return "neo";
  if (s.startsWith("base")) return "original";
  return null;
}

function findSerie(set) {
  const id = String(set?.id || "").toLowerCase();
  const name = String(set?.name || "").toLowerCase().trim();
  return SERIE.find((s) => s.ids.includes(id) || (name && s.names.includes(name))) || null;
}

// Odvodí series / seriesLabel / era z edic, ze kterých jsou karty v produktu
function deriveSeries(sets = [], groupDefault) {
  const uniq = [];
  for (const s of sets) {
    const key = String(s?.id || s?.name || "").toLowerCase();
    if (key && !uniq.some((u) => String(u?.id || u?.name || "").toLowerCase() === key)) uniq.push(s);
  }
  if (uniq.length === 1) {
    const hit = findSerie(uniq[0]);
    if (hit) return { series: hit.series, seriesLabel: hit.label, era: hit.era };
    const era = eraFromSetId(uniq[0]?.id) || "mix";
    const label = uniq[0]?.name || "Mix";
    return { series: slugify(label) || "mix", seriesLabel: label, era };
  }
  const eras = [...new Set(uniq.map((s) => findSerie(s)?.era || eraFromSetId(s?.id)).filter(Boolean))];
  if (groupDefault === "decks") return { series: "decks", seriesLabel: "Deck", era: eras.length === 1 ? eras[0] : "mix" };
  return { series: "mix", seriesLabel: "Mix", era: eras.length === 1 ? eras[0] : "mix" };
}

// Stejný algoritmus jako build.mjs (aby sedělo /karta/<slug>/)
function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cors(req) {
  const origin = req.headers.get("origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-api-key",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(req, status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors(req) },
  });
}

function keyOk(req) {
  const expected = process.env.POKESKLAD_API_KEY || "";
  const got = req.headers.get("x-api-key") || "";
  if (!expected || expected.length < 16) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function gh(path, init = {}) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "pokesklad-import",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    const err = new Error(`GitHub ${res.status}: ${data?.message || text}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function decodeImage(img, i) {
  let b64 = String(img?.dataBase64 || img?.data || "");
  let mime = String(img?.mime || "");
  const m = b64.match(/^data:([^;]+);base64,(.*)$/s);
  if (m) { mime = m[1]; b64 = m[2]; }
  const buf = Buffer.from(b64, "base64");
  if (!buf.length) throw new Error(`Fotka ${i + 1} je prázdná.`);
  if (buf.length > MAX_IMG_BYTES) throw new Error(`Fotka ${i + 1} je moc velká (max 2,5 MB, zmenši ji na 1600 px).`);
  const isJpg = buf[0] === 0xff && buf[1] === 0xd8;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50;
  const isWebp = buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP";
  if (!isJpg && !isPng && !isWebp) throw new Error(`Fotka ${i + 1} není JPG/PNG/WebP (${mime || "neznámý typ"}).`);
  return { b64: buf.toString("base64"), ext: isJpg ? "jpg" : isPng ? "png" : "webp" };
}

function cleanText(v, max) {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

// Sestaví záznam produktu ve stejném tvaru, jaký používá admin.html
function buildProduct(input, imgPaths) {
  const group = GROUPS.includes(input.group) ? input.group
    : input.type === "Deck" ? "decks" : input.type === "Single" ? "singles" : "bulks";
  const type = group === "decks" ? "Deck" : group === "singles" ? "Single" : "Bulk";
  const derived = deriveSeries(input.sets || [], group);

  const title = cleanText(input.title, 120);
  const price = Math.round(Number(input.price));
  const stock = Math.max(0, Math.round(Number(input.stock ?? 1)));
  const features = (Array.isArray(input.features) ? input.features : [])
    .map((f) => cleanText(f, 160)).filter(Boolean).slice(0, 12);
  if (!features.some((f) => /near mint|\(nm\)/i.test(f))) features.unshift("Near Mint (NM) stav");

  return {
    group,
    product: {
      imgs: imgPaths,
      title,
      price,
      stock,
      series: cleanText(input.series, 40) || derived.series,
      era: cleanText(input.era, 20) || derived.era,
      seriesLabel: cleanText(input.seriesLabel, 60) || derived.seriesLabel,
      type,
      desc: cleanText(input.desc, 1500),
      features,
      featured: input.featured === true,
      addedAt: new Date().toISOString().slice(0, 10),
      source: "pokesklad",
      pokeskladId: cleanText(input.pokeskladId, 80),
    },
  };
}

function validate(input) {
  const errs = [];
  if (!cleanText(input?.title, 120)) errs.push("Chybí název produktu.");
  if (!slugify(input?.title)) errs.push("Název musí obsahovat aspoň jedno písmeno nebo číslo bez diakritiky.");
  const price = Number(input?.price);
  if (!Number.isFinite(price) || price <= 0) errs.push("Cena musí být kladné číslo v Kč.");
  const imgs = Array.isArray(input?.images) ? input.images : [];
  if (!imgs.length) errs.push("Produkt musí mít aspoň jednu fotku.");
  if (imgs.length > MAX_IMGS) errs.push(`Maximálně ${MAX_IMGS} fotek.`);
  if (!cleanText(input?.pokeskladId, 80)) errs.push("Chybí pokeskladId (ID návrhu z PokéSkladu).");
  return errs;
}

async function commitProduct(input, attempt = 1) {
  // 1) aktuální stav větve
  const ref = await gh(`git/ref/heads/${BRANCH}`);
  const headSha = ref.object.sha;
  const headCommit = await gh(`git/commits/${headSha}`);

  // 2) aktuální products.json
  const file = await gh(`contents/products.json?ref=${headSha}`);
  const raw = Buffer.from(file.content, "base64").toString("utf8");
  const data = JSON.parse(raw);
  for (const g of GROUPS) if (!Array.isArray(data[g])) data[g] = [];

  // Ochrana proti dvojímu nahrání (např. opakované odeslání po výpadku sítě)
  const pid = cleanText(input.pokeskladId, 80);
  for (const g of GROUPS) {
    const existing = data[g].find((p) => p.pokeskladId === pid);
    if (existing) return { duplicate: true, group: g, product: existing, commit: headSha };
  }

  // 3) fotky → blobs
  const decoded = input.images.map(decodeImage);
  const base = slugify(input.title).slice(0, 40) || "produkt";
  const stamp = Date.now().toString(36);
  const imgPaths = decoded.map((d, i) => `img/pks-${base}-${stamp}-${i + 1}.${d.ext}`);
  const imgBlobs = await Promise.all(
    decoded.map((d) => gh("git/blobs", { method: "POST", body: JSON.stringify({ content: d.b64, encoding: "base64" }) }))
  );

  // 4) nový záznam produktu – na konec skupiny (jako admin.html), aby se
  //    existujícím produktům se stejným názvem nezměnila adresa /karta/<slug>/
  const { group, product } = buildProduct(input, imgPaths);
  data[group].push(product);
  const indent = /\n {4}"/.test(raw.slice(0, 200)) ? 4 : /\n {2}"/.test(raw.slice(0, 200)) ? 2 : (raw.includes("\n") ? 2 : 0);
  const newJson = JSON.stringify(data, null, indent) + (raw.endsWith("\n") ? "\n" : "");
  const jsonBlob = await gh("git/blobs", {
    method: "POST",
    body: JSON.stringify({ content: Buffer.from(newJson, "utf8").toString("base64"), encoding: "base64" }),
  });

  // 5) strom + commit
  const tree = await gh("git/trees", {
    method: "POST",
    body: JSON.stringify({
      base_tree: headCommit.tree.sha,
      tree: [
        ...imgPaths.map((path, i) => ({ path, mode: "100644", type: "blob", sha: imgBlobs[i].sha })),
        { path: "products.json", mode: "100644", type: "blob", sha: jsonBlob.sha },
      ],
    }),
  });
  const commit = await gh("git/commits", {
    method: "POST",
    body: JSON.stringify({
      message: `PokéSklad: nový produkt „${product.title}“`,
      tree: tree.sha,
      parents: [headSha],
    }),
  });

  // 6) posun větve (bez force) – když mezitím někdo uložil admin, zkusíme znovu
  try {
    await gh(`git/refs/heads/${BRANCH}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false }) });
  } catch (e) {
    if (e.status === 422 && attempt < 4) return commitProduct(input, attempt + 1);
    throw e;
  }
  return { duplicate: false, group, product, commit: commit.sha, slug: slugFor(data, product) };
}

// Stejné řešení duplicitních slugů jako build.mjs (slug, slug-2, slug-3…)
function slugFor(data, target) {
  const seen = new Set();
  for (const g of Object.keys(data)) {
    if (!Array.isArray(data[g])) continue;
    for (const p of data[g]) {
      if (!p?.title || !Array.isArray(p.imgs) || !p.imgs.length) continue;
      const base = slugify(p.title);
      if (!base) continue;
      let s = base, n = 2;
      while (seen.has(s)) s = `${base}-${n++}`;
      seen.add(s);
      if (p === target) return s;
    }
  }
  return slugify(target.title);
}

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (!keyOk(req)) return json(req, 401, { ok: false, error: "Neplatný nebo chybějící API klíč." });
  if (!process.env.GITHUB_TOKEN) return json(req, 500, { ok: false, error: "Na Netlify chybí GITHUB_TOKEN." });

  if (req.method === "GET") {
    try {
      await gh(`git/ref/heads/${BRANCH}`);
      return json(req, 200, { ok: true, message: "Připojení k webu funguje.", repo: REPO, branch: BRANCH });
    } catch (e) {
      return json(req, 502, { ok: false, error: `Web nemá přístup do GitHubu: ${e.message}` });
    }
  }
  if (req.method !== "POST") return json(req, 405, { ok: false, error: "Použij POST." });

  let input;
  try { input = await req.json(); } catch { return json(req, 400, { ok: false, error: "Tělo požadavku není platný JSON." }); }
  const errs = validate(input);
  if (errs.length) return json(req, 400, { ok: false, error: errs.join(" ") });

  try {
    const r = await commitProduct(input);
    const slug = r.slug || slugify(r.product.title);
    return json(req, r.duplicate ? 200 : 201, {
      ok: true,
      duplicate: r.duplicate,
      message: r.duplicate
        ? "Tento produkt už na webu je (nahrán dříve) – nic se neměnilo."
        : "Produkt uložen. Web se teď přestavuje, živě bude cca za 1–2 minuty.",
      group: r.group,
      product: r.product,
      url: `https://voltimpactcards.com/karta/${slug}/`,
      commit: r.commit,
    });
  } catch (e) {
    const msg = e.message?.startsWith("Fotka") ? e.message : `Uložení se nepovedlo: ${e.message}`;
    return json(req, e.message?.startsWith("Fotka") ? 400 : 502, { ok: false, error: msg });
  }
};
