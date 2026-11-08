// ════════════════════════════════════════════════════════════════════════════
//  Mailversand ueber Admin → Entegrasyonlar (v1.19):
//    Resend (live + API-Key + From)  >  SMTP (live + Host/User/Pass, Rueckfall .env)  >  nur Protokoll
//  Ohne Zugangsdaten wird nicht gesendet, sondern ins Log (pm2) geschrieben.
//  `logIcerik` (z. B. ein Reset-Link) erscheint dort nur ausserhalb von prod.
//  Rueckgabe: { gonderildi, kanal, hata? } — bestehende Aufrufer ignorieren sie.
// ════════════════════════════════════════════════════════════════════════════
let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch { /* optional */ }
const entegrasyon = require('../lib/entegrasyon');

let _smtp = { schluessel: '', tr: null };
function smtpTransport(a) {
  const port = parseInt(a.port, 10) || 587;
  const schluessel = [a.host, port, a.user, a.pass].join('|');
  if (_smtp.schluessel !== schluessel) {
    _smtp = { schluessel, tr: nodemailer.createTransport({ host: a.host, port, secure: port === 465, auth: { user: a.user, pass: a.pass } }) };
  }
  return _smtp.tr;
}

async function sendMail({ to, subject, html, text, logIcerik }) {
  let k;
  try { k = await entegrasyon.mailKanal(); } catch { k = { kanal: 'log', ayar: null }; }
  try {
    if (k.kanal === 'resend') {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST', signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${k.ayar.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: k.ayar.from, to: [to], subject, html: html || `<p>${text || ''}</p>`, text,
          ...(k.ayar.replyTo ? { reply_to: k.ayar.replyTo } : {}) }),
      });
      if (!r.ok) throw new Error('Resend ' + r.status + ' ' + (await r.text()).slice(0, 160));
      console.log('[MAIL] Resend an:', to);
      return { gonderildi: true, kanal: 'resend' };
    }
    if (k.kanal === 'smtp' && nodemailer) {
      await smtpTransport(k.ayar).sendMail({
        from: `"Kap Beni" <${k.ayar.from || k.ayar.user}>`, to, subject, html: html || `<p>${text || ''}</p>`, text,
      });
      console.log('[MAIL] SMTP an:', to);
      return { gonderildi: true, kanal: 'smtp' };
    }
  } catch (err) {
    console.error('[MAIL] Fehler (' + k.kanal + '):', err.message);
    return { gonderildi: false, kanal: k.kanal, hata: err.message };
  }
  const zusatz = logIcerik && entegrasyon.ORTAM !== 'prod' ? ' | ' + logIcerik : '';
  console.log('[MAIL] Versand nicht konfiguriert – nur protokolliert:', to, '|', subject + zusatz);
  return { gonderildi: false, kanal: 'log' };
}
module.exports = { sendMail };
