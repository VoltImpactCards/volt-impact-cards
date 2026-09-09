/* Odešle fakturu zákazníkovi e-mailem. Volá se z administrace.
   Nastavení odesílání viz netlify/lib/mail.mjs */

import { mailConfig, kopieProProdejce, transporter, esc } from '../lib/mail.mjs';

const WEB = 'https://voltimpactcards.com';

function cz(d) {
  try { return new Date(d).toLocaleDateString('cs-CZ'); } catch { return d; }
}

export function fakturaHtml(f) {
  const d = f.dodavatel || {};
  const o = f.odberatel || {};
  const radky = (f.polozky || []).map(p => `
    <tr>
      <td style="padding:8px 6px;border-bottom:1px solid #e8e8e4">${esc(p.nazev)}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #e8e8e4;text-align:right">${p.pocet}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #e8e8e4;text-align:right">${p.cena} Kč</td>
      <td style="padding:8px 6px;border-bottom:1px solid #e8e8e4;text-align:right">${p.pocet * p.cena} Kč</td>
    </tr>`).join('');

  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:620px">
  <div style="display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:18px">
    <div>
      <h2 style="margin:0 0 2px;font-size:20px">Faktura ${esc(f.cislo)}</h2>
      <div style="color:#666;font-size:13px">Neplátce DPH</div>
    </div>
    <div style="text-align:right">
      <div style="font-weight:bold">Volt Impact Cards</div>
      <div style="color:#666;font-size:13px">voltimpactcards.com</div>
    </div>
  </div>

  <table style="width:100%;margin-bottom:18px"><tr>
    <td style="vertical-align:top;font-size:13px;width:50%">
      <div style="color:#777;text-transform:uppercase;font-size:11px;letter-spacing:1px;margin-bottom:6px">Dodavatel</div>
      <b>${esc(d.jmeno || '')}</b><br/>
      ${d.adresa ? esc(d.adresa) + '<br/>' : ''}
      IČO: ${esc(d.ico || '—')}<br/>
      voltimpactcards@gmail.com
    </td>
    <td style="vertical-align:top;font-size:13px;width:50%">
      <div style="color:#777;text-transform:uppercase;font-size:11px;letter-spacing:1px;margin-bottom:6px">Odběratel</div>
      <b>${esc(o.jmeno || '')}</b><br/>
      ${o.adresa ? esc(o.adresa) + '<br/>' : ''}
      ${o.email ? esc(o.email) : ''}
    </td>
  </tr></table>

  <table style="font-size:13px;margin-bottom:14px">
    <tr><td style="color:#666;padding:2px 16px 2px 0">Datum vystavení</td><td><b>${cz(f.vystaveni)}</b></td>
        <td style="color:#666;padding:2px 16px 2px 24px">Variabilní symbol</td><td><b>${esc(f.vs)}</b></td></tr>
    <tr><td style="color:#666;padding:2px 16px 2px 0">Datum splatnosti</td><td><b>${cz(f.splatnost)}</b></td>
        <td style="color:#666;padding:2px 16px 2px 24px">Forma úhrady</td><td><b>Převodem</b></td></tr>
  </table>

  <table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr>
      <th style="text-align:left;border-bottom:1.5px solid #111;padding:7px 6px;font-size:11px;text-transform:uppercase">Položka</th>
      <th style="text-align:right;border-bottom:1.5px solid #111;padding:7px 6px;font-size:11px;text-transform:uppercase">Počet</th>
      <th style="text-align:right;border-bottom:1.5px solid #111;padding:7px 6px;font-size:11px;text-transform:uppercase">Cena / ks</th>
      <th style="text-align:right;border-bottom:1.5px solid #111;padding:7px 6px;font-size:11px;text-transform:uppercase">Celkem</th>
    </tr></thead>
    <tbody>${radky}</tbody>
  </table>

  <div style="text-align:right;margin-top:14px;font-size:15px">Celkem k úhradě <b style="font-size:19px">${f.celkem} Kč</b></div>

  <div style="background:#f6f6f2;border-radius:8px;padding:14px;margin-top:18px;font-size:13px">
    <b>Údaje k platbě</b>
    <p style="margin:6px 0 0">Číslo účtu: <b>${esc(d.ucet || '')}</b></p>
    ${f.iban ? `<p style="margin:4px 0 0">IBAN: ${esc(f.iban)}</p>` : ''}
    <p style="margin:4px 0 0">Variabilní symbol: <b>${esc(f.vs)}</b></p>
    <p style="margin:4px 0 0">Částka: <b>${f.celkem} Kč</b></p>
  </div>

  ${f.qr ? `<div style="text-align:center;margin-top:16px">
    <img src="${esc(f.qr)}" alt="QR platba" width="150" height="150" style="background:#fff;padding:8px;border-radius:8px"/>
    <div style="color:#666;font-size:11px;margin-top:4px">QR platba</div>
  </div>` : ''}

  ${f.poznamka ? `<p style="margin-top:18px;color:#444;font-size:13px">${esc(f.poznamka)}</p>` : ''}

  <p style="margin-top:24px;border-top:1px solid #ddd;padding-top:10px;color:#666;font-size:11.5px">
    Fakturu si můžeš uložit vytištěním do PDF přímo z e-mailu.<br/>
    <a href="${WEB}/obchodni-podminky/">Obchodní podmínky</a> ·
    <a href="${WEB}/odstoupeni-od-smlouvy/">Odstoupení od smlouvy</a>
  </p>
</div>`;
}

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const cfg = mailConfig();
  if (!cfg) return Response.json({ ok: false, duvod: 'chybi-nastaveni' }, { status: 501 });

  let f;
  try { f = await req.json(); } catch { return Response.json({ ok: false, duvod: 'spatna-data' }, { status: 400 }); }
  if (!f || !f.cislo || !f.odberatel || !f.odberatel.email || !Array.isArray(f.polozky) || !f.polozky.length) {
    return Response.json({ ok: false, duvod: 'chybi-udaje' }, { status: 400 });
  }

  try {
    const t = transporter(cfg);
    const html = fakturaHtml(f);
    await t.sendMail({
      from: `"Volt Impact Cards" <${cfg.from}>`,
      to: f.odberatel.email,
      replyTo: cfg.from,
      subject: `Faktura ${f.cislo} — Volt Impact Cards`,
      html
    });
    await t.sendMail({
      from: `"Volt Impact Cards" <${cfg.from}>`,
      to: kopieProProdejce(cfg),
      replyTo: f.odberatel.email,
      subject: `Kopie faktury ${f.cislo} — ${f.celkem} Kč`,
      html
    });
    return Response.json({ ok: true, kanal: cfg.kanal });
  } catch (e) {
    return Response.json({ ok: false, duvod: String(e.message || e) }, { status: 502 });
  }
};
