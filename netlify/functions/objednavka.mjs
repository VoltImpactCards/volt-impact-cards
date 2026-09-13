/* Odešle potvrzení objednávky zákazníkovi a kopii prodávajícímu.
   Přihlašovací údaje se berou z proměnných prostředí v Netlify:
     GMAIL_USER          – např. voltimpactcards@gmail.com
     GMAIL_APP_PASSWORD  – heslo aplikace vygenerované v Google účtu
   Bez nich funkce jen vrátí 501 a web zobrazí platební údaje na obrazovce. */

import { mailConfig, kopieProProdejce, transporter, esc } from '../lib/mail.mjs';
import { fakturaHtml } from './faktura.mjs';

const UCET = '3429264010/3030';
const IBAN = 'CZ0430300000003429264010';
const SELLER_NAME = 'David Vaněček';
const SELLER_ICO = '10895060';
const SELLER_ADRESA = 'Nemojany 155, 683 03 Nemojany';
const WEB = 'https://voltimpactcards.com';


export function zpravaProZakaznika(o) {
  const radky = (o.polozky || '').split('\n').filter(Boolean);
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;max-width:560px">
  <h2 style="margin:0 0 4px">Děkujeme za objednávku</h2>
  <p style="color:#666;margin:0 0 18px">Objednávka č. <b>${esc(o.cislo)}</b></p>

  <table style="width:100%;border-collapse:collapse;margin-bottom:18px">
    ${radky.map(r => `<tr><td style="padding:6px 0;border-bottom:1px solid #eee;font-size:14px">${esc(r)}</td></tr>`).join('')}
    <tr><td style="padding:8px 0;font-size:14px">Doprava — ${esc(o.doprava)}: <b>${esc(o.dopravaCena)}</b></td></tr>
    <tr><td style="padding:8px 0;border-top:2px solid #1a1a1a;font-size:16px"><b>Celkem k úhradě: ${esc(o.celkem)}</b></td></tr>
  </table>

  <div style="background:#f6f6f2;border-radius:10px;padding:16px;margin-bottom:18px">
    <h3 style="margin:0 0 10px;font-size:15px">Údaje k platbě</h3>
    <p style="margin:4px 0;font-size:14px">Číslo účtu: <b>${UCET}</b></p>
    <p style="margin:4px 0;font-size:14px">IBAN: <b>${IBAN}</b></p>
    <p style="margin:4px 0;font-size:14px">Částka: <b>${esc(o.celkem)}</b></p>
    <p style="margin:4px 0;font-size:14px">Variabilní symbol: <b>${esc(o.cislo)}</b></p>
    <p style="margin:10px 0 0;font-size:13px;color:#666">Prosíme o úhradu do 7 dnů. Zboží odešleme, jakmile platba dorazí.</p>
  </div>

  <p style="font-size:14px">Doručení: ${esc(o.doprava)}${o.vydejniMisto ? ' — ' + esc(o.vydejniMisto) : ''}${o.adresa ? ' — ' + esc(o.adresa) : ''}</p>
  ${o.poznamka ? `<p style="font-size:14px">Poznámka: ${esc(o.poznamka)}</p>` : ''}

  <p style="font-size:13px;color:#666;margin-top:24px">
    Prodávající: ${SELLER_NAME} · <a href="${WEB}">voltimpactcards.com</a><br/>
    Máte dotaz? Stačí odpovědět na tento e-mail.<br/>
    <a href="${WEB}/obchodni-podminky/">Obchodní podmínky</a> ·
    <a href="${WEB}/odstoupeni-od-smlouvy/">Odstoupení od smlouvy</a>
  </p>
</div>`;
}

export function zpravaProProdejce(o) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
  <h2>Nová objednávka ${esc(o.cislo)} — ${esc(o.celkem)}</h2>
  <p><b>${esc(o.jmeno)}</b><br/>${esc(o.email)}<br/>${esc(o.telefon)}</p>
  <p>Doprava: ${esc(o.doprava)} (${esc(o.dopravaCena)})<br/>
  ${o.vydejniMisto ? 'Výdejní místo: ' + esc(o.vydejniMisto) + '<br/>' : ''}
  ${o.adresa ? 'Adresa: ' + esc(o.adresa) + '<br/>' : ''}</p>
  <pre style="background:#f6f6f2;padding:12px;border-radius:8px;font-size:13px">${esc(o.polozky)}</pre>
  <p>Zboží: ${esc(o.zboziCelkem)} · Doprava: ${esc(o.dopravaCena)} · <b>Celkem: ${esc(o.celkem)}</b><br/>
  Variabilní symbol: <b>${esc(o.cislo)}</b></p>
  ${o.casSetkani ? `<p><b>Preferovaný čas předání: ${esc(o.casSetkani)}</b></p>` : ''}
  ${o.poznamka ? `<p>Poznámka: ${esc(o.poznamka)}</p>` : ''}
</div>`;
}

/* Z objednávky sestaví fakturu. Číslo faktury = číslo objednávky,
   takže je jednoznačné a řada roste s datem. Splatnost 7 dní. */
export function fakturaZObjednavky(o) {
  const polozky = String(o.polozky || '').split('\n').filter(Boolean).map(r => {
    const m = r.match(/^(.*?)\s*—\s*(\d+)×\s*(?:à\s*)?(\d+)\s*Kč/);
    return m ? { nazev: m[1].trim(), pocet: +m[2], cena: +m[3] } : { nazev: r.trim(), pocet: 1, cena: 0 };
  });
  const dopravaKc = parseInt(String(o.dopravaCena || '').replace(/\s/g, ''), 10);
  if (dopravaKc > 0) polozky.push({ nazev: o.doprava || 'Doprava', pocet: 1, cena: dopravaKc });

  const dnes = new Date();
  const splatnost = new Date(dnes.getTime() + 7 * 86400000);
  const celkem = polozky.reduce((s, p) => s + p.pocet * p.cena, 0);
  const spd = `SPD*1.0*ACC:${IBAN}*AM:${celkem}.00*CC:CZK*X-VS:${o.cislo}*MSG:FAKTURA ${o.cislo}`;

  return {
    cislo: o.cislo,
    vs: o.cislo,
    vystaveni: dnes.toISOString().slice(0, 10),
    splatnost: splatnost.toISOString().slice(0, 10),
    dodavatel: { jmeno: SELLER_NAME, ico: SELLER_ICO, adresa: SELLER_ADRESA, ucet: UCET },
    odberatel: {
      jmeno: o.jmeno,
      adresa: o.adresa || o.vydejniMisto || '',
      email: o.email,
      telefon: o.telefon
    },
    polozky,
    celkem,
    iban: IBAN,
    qr: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=0&data=' + encodeURIComponent(spd),
    poznamka: (o.doprava || '') + (o.casSetkani ? ' · Preferovaný čas: ' + o.casSetkani : '') + (o.poznamka ? ' · Poznámka: ' + o.poznamka : '')
  };
}

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const cfg = mailConfig();
  if (!cfg) {
    return Response.json({ ok: false, duvod: 'chybi-nastaveni' }, { status: 501 });
  }

  let o;
  try { o = await req.json(); } catch { return Response.json({ ok: false }, { status: 400 }); }
  if (!o || !o.cislo || !o.email || !o.polozky) return Response.json({ ok: false }, { status: 400 });

  try {
    const t = transporter(cfg);
    const faktura = fakturaZObjednavky(o);
    await t.sendMail({
      from: `"Volt Impact Cards" <${cfg.from}>`,
      to: o.email,
      replyTo: cfg.from,
      subject: `Faktura ${faktura.cislo} — objednávka ${o.cislo}`,
      html: fakturaHtml(faktura)
    });
    await t.sendMail({
      from: `"Volt Impact Cards" <${cfg.from}>`,
      to: kopieProProdejce(cfg),
      replyTo: o.email,
      subject: `Nová objednávka ${o.cislo} — ${o.celkem}`,
      html: zpravaProProdejce(o)
    });
    return Response.json({ ok: true, kanal: cfg.kanal });
  } catch (e) {
    return Response.json({ ok: false, duvod: String(e.message || e) }, { status: 502 });
  }
};
