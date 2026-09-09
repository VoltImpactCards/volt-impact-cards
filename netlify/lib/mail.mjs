/* Společné odesílání pošty pro všechny funkce.
   Kanál se vybere podle proměnných prostředí v Netlify:

   A) Brevo (doporučeno)
      BREVO_SMTP_LOGIN  – přihlašovací jméno z Brevo (např. 9a1b2c001@smtp-brevo.com)
      BREVO_SMTP_KEY    – SMTP klíč z Brevo
      MAIL_FROM         – ověřená adresa odesílatele (voltimpactcards@gmail.com)

   B) Gmail
      GMAIL_USER            – voltimpactcards@gmail.com
      GMAIL_APP_PASSWORD    – heslo aplikace

   Kopie objednávek a faktur chodí na ORDER_NOTIFY_EMAIL, jinak na adresu odesílatele. */

import nodemailer from 'nodemailer';

export function mailConfig() {
  // A) libovolný SMTP server (Seznam, e-mail.cz, vlastní hosting…)
  const smtpHost = (process.env.SMTP_HOST || '').trim();
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').trim();
  if (smtpHost && smtpUser && smtpPass) {
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    return {
      kanal: 'smtp',
      from: (process.env.MAIL_FROM || smtpUser).trim(),
      transport: { host: smtpHost, port, secure: port === 465, auth: { user: smtpUser, pass: smtpPass } }
    };
  }

  const brevoLogin = (process.env.BREVO_SMTP_LOGIN || '').trim();
  const brevoKey = (process.env.BREVO_SMTP_KEY || '').trim();
  const gmailUser = (process.env.GMAIL_USER || '').trim();
  const gmailPass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

  if (brevoLogin && brevoKey) {
    return {
      kanal: 'brevo',
      from: (process.env.MAIL_FROM || gmailUser || brevoLogin).trim(),
      transport: { host: 'smtp-relay.brevo.com', port: 587, secure: false, auth: { user: brevoLogin, pass: brevoKey } }
    };
  }
  if (gmailUser && gmailPass) {
    return {
      kanal: 'gmail',
      from: gmailUser,
      transport: { service: 'gmail', auth: { user: gmailUser, pass: gmailPass } }
    };
  }
  return null;
}

export function kopieProProdejce(cfg) {
  return (process.env.ORDER_NOTIFY_EMAIL || '').trim() || cfg.from;
}

export function transporter(cfg) {
  return nodemailer.createTransport(cfg.transport);
}

export const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
