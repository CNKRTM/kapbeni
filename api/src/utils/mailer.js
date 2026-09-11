let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch { /* optional */ }

const transporter = nodemailer && process.env.SMTP_USER ? nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
}) : null;

async function sendMail({ to, subject, html, text }) {
  if (!transporter) { console.log('[MAIL] SMTP not configured – skip:', to, '|', subject); return; }
  try {
    await transporter.sendMail({
      from: `"Kap Beni" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to, subject, html: html || `<p>${text || ''}</p>`, text,
    });
    console.log('[MAIL] Sent to:', to);
  } catch (err) { console.error('[MAIL] Error:', err.message); }
}
module.exports = { sendMail };
