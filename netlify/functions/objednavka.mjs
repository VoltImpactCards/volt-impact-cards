/* Odešle potvrzení objednávky zákazníkovi a kopii prodávajícímu.
   Přihlašovací údaje se berou z proměnných prostředí v Netlify:
     GMAIL_USER          – např. voltimpactcards@gmail.com
     GMAIL_APP_PASSWORD  – heslo aplikace vygenerované v Google účtu
   Bez nich funkce jen vrátí 501 a web zobrazí platební údaje na obrazovce. */

import nodemailer from 'nodemailer';

const UCET = '3429264010/3030';
const IBAN = 'CZ0430300000003429264010';
const SELLER_NAME = 'David Vaněček';
const WEB = 'https://voltimpactcards.com';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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
    Máš dotaz? Stačí odpovědět na tento e-mail.<br/>
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
  ${o.poznamka ? `<p>Poznámka: ${esc(o.poznamka)}</p>` : ''}
</div>`;
}

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    return Response.json({ ok: false, duvod: 'chybi-nastaveni' }, { status: 501 });
  }

  let o;
  try { o = await req.json(); } catch { return Response.json({ ok: false }, { status: 400 }); }
  if (!o || !o.cislo || !o.email || !o.polozky) return Response.json({ ok: false }, { status: 400 });

  try {
    const transport = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
    await transport.sendMail({
      from: `"Volt Impact Cards" <${user}>`,
      to: o.email,
      replyTo: user,
      subject: `Objednávka ${o.cislo} — údaje k platbě`,
      html: zpravaProZakaznika(o)
    });
    await transport.sendMail({
      from: `"Volt Impact Cards" <${user}>`,
      to: user,
      replyTo: o.email,
      subject: `Nová objednávka ${o.cislo} — ${o.celkem}`,
      html: zpravaProProdejce(o)
    });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, duvod: String(e.message || e) }, { status: 502 });
  }
};
