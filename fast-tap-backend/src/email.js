const nodemailer = require('nodemailer');
const bwipjs = require('bwip-js');
const log = require('./log');

// sendVerificationEmail(getPgPool, registrantId)
// getPgPool: function that returns the current pgPool (may be null during startup)
async function sendVerificationEmail(getPgPool, registrantId) {
  const pgPool = typeof getPgPool === 'function' ? getPgPool() : getPgPool;
  if (!pgPool) return { ok: false, error: 'Postgres not configured' };
  try {
    const r = await pgPool.query('SELECT id, name, email, bureau, gacha_code FROM registrants WHERE id = $1', [registrantId]);
    if (r.rows.length === 0) throw new Error('Registrant not found');
    const registrant = r.rows[0];
    if (!registrant.email) {
      console.log('Registrant has no email, skipping send for id', registrantId);
      try {
        await pgPool.query('INSERT INTO email_logs (registrant_id, to_email, subject, body, success, error) VALUES ($1,$2,$3,$4,$5,$6)', [registrantId, '', 'verification email', '', 'N', 'no email on registrant']);
      } catch (e) {
        console.warn('Failed to write email_logs for missing email', e && e.message);
      }
      return { ok: false, error: 'no email' };
    }

    const smtpHost = process.env.SMTP_HOST || 'smtp-send-only';
    const smtpPort = parseInt(process.env.SMTP_PORT || '25', 10);
    const smtpUser = process.env.SMTP_USER || '';
    const smtpPass = process.env.SMTP_PASS || '';
    const smtpFrom = process.env.SMTP_FROM || `no-reply@${process.env.POSTFIX_MYDOMAIN || 'te-itx-2025.site'}`;

    let barcodePng = null;
    try {
      barcodePng = await bwipjs.toBuffer({
        bcid: 'code128',
        text: registrant.gacha_code || '',
        scale: 3,
        height: 10,
        includetext: false,
        backgroundcolor: 'FFFFFF',
      });
    } catch (err) {
      log.warn('Failed to generate barcode image:', err && err.message);
      barcodePng = null;
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
      tls: { rejectUnauthorized: false },
    });

    const to = registrant.email;
    const subject = 'Verification successful — your gacha code';
    const text = `Thank you for verifying, ${registrant.name} - ${registrant.bureau || ''}\n\nYour gacha code: ${registrant.gacha_code || ''}\n\nGood luck!`;
    const html = `
      <p>Thank you for verifying, <strong>${registrant.name} - ${registrant.bureau || ''}</strong>.</p>
      <p>Your gacha code: <strong style="font-family:monospace">${registrant.gacha_code || ''}</strong></p>
      ${barcodePng ? '<p><img src="cid:gcodeimg" alt="gacha barcode" /></p>' : ''}
      <p>Good luck on winning!</p>
    `;

    const mailOptions = {
      from: smtpFrom,
      to,
      subject,
      text,
      html,
      attachments: [],
    };
    if (barcodePng) mailOptions.attachments.push({ filename: 'gcode.png', content: barcodePng, cid: 'gcodeimg' });

  const info = await transporter.sendMail(mailOptions);
  log.info('Sent verification email to', to);

    try {
      await pgPool.query('INSERT INTO email_logs (registrant_id, to_email, subject, body, success) VALUES ($1,$2,$3,$4,$5)', [registrantId, to, subject, html, 'Y']);
      await pgPool.query('UPDATE registrants SET is_send_email = $1 WHERE id = $2', ['Y', registrantId]);
    } catch (e) {
      log.warn('Failed to write email_logs or update registrant after send', e && e.message);
    }

    return { ok: true, info };
    } catch (err) {
    log.error('sendVerificationEmail error:', err && err.message);
    try {
      const r2 = await (typeof getPgPool === 'function' ? getPgPool() : getPgPool).query('SELECT email FROM registrants WHERE id = $1', [registrantId]);
      const toEmail = (r2.rows[0] && r2.rows[0].email) || '';
      await (typeof getPgPool === 'function' ? getPgPool() : getPgPool).query('INSERT INTO email_logs (registrant_id, to_email, subject, body, success, error) VALUES ($1,$2,$3,$4,$5,$6)', [registrantId, toEmail, 'verification email', '', 'N', String(err && err.message ? err.message : err)]);
    } catch (e) {
      log.warn('Failed to write email_logs after send error', e && e.message);
    }
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
}

function registerResendEndpoint(app, getPgPool) {
  app.post('/api/admin/registrants/:id/resend-email', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid registrant id' });
    try {
      const result = await sendVerificationEmail(getPgPool, id);
      if (result && result.ok) return res.json({ ok: true });
      return res.status(500).json({ ok: false, error: result && result.error ? result.error : 'failed to send' });
    } catch (err) {
      console.error('resend-email endpoint error', err && err.message);
      res.status(500).json({ error: 'Failed to resend email' });
    }
  });
}

module.exports = { sendVerificationEmail, registerResendEndpoint };
