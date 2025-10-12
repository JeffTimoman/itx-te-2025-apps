const nodemailer = require("nodemailer");
const bwipjs = require("bwip-js");
const log = require("./log");

// Simple HTML escape to prevent broken markup if names/bureau contain <>&
function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// sendVerificationEmail(getPgPool, registrantId)
async function sendVerificationEmail(getPgPool, registrantId) {
  const pgPool = typeof getPgPool === "function" ? getPgPool() : getPgPool;
  if (!pgPool) return { ok: false, error: "Postgres not configured" };
  try {
    const r = await pgPool.query(
      "SELECT id, name, email, bureau, gacha_code FROM registrants WHERE id = $1",
      [registrantId]
    );
    if (r.rows.length === 0) throw new Error("Registrant not found");
    const registrant = r.rows[0];
    if (!registrant.email) {
      console.log(
        "Registrant has no email, skipping send for id",
        registrantId
      );
      try {
        await pgPool.query(
          "INSERT INTO email_logs (registrant_id, to_email, subject, body, success, error) VALUES ($1,$2,$3,$4,$5,$6)",
          [
            registrantId,
            "",
            "verification email",
            "",
            "N",
            "no email on registrant",
          ]
        );
      } catch (e) {
        console.warn(
          "Failed to write email_logs for missing email",
          e && e.message
        );
      }
      return { ok: false, error: "no email" };
    }

    const smtpHost = process.env.SMTP_HOST || "smtp-send-only";
    const smtpPort = parseInt(process.env.SMTP_PORT || "25", 10);
    const smtpUser = process.env.SMTP_USER || "";
    const smtpPass = process.env.SMTP_PASS || "";
    const smtpFrom =
      process.env.SMTP_FROM ||
      `no-reply@${process.env.POSTFIX_MYDOMAIN || "te-itx-2025.site"}`;

    let barcodePng = null;
    try {
      barcodePng = await bwipjs.toBuffer({
        bcid: "code128",
        text: registrant.gacha_code || "",
        scale: 3,
        height: 10,
        includetext: false,
        backgroundcolor: "FFFFFF",
      });
    } catch (err) {
      log.warn("Failed to generate barcode image:", err && err.message);
      barcodePng = null;
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth:
        smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
      tls: { rejectUnauthorized: false },
    });

    const to = registrant.email;
    const subject = "By Owl Post: Your Verification & Gacha Code";

    // Plain-text fallback (kept concise)
    const text = [
      `Dear ${registrant.name}${
        registrant.bureau ? ` — ${registrant.bureau}` : ""
      },`,
      "",
      "Your registration has been verified.",
      `Your gacha code: ${registrant.gacha_code || "(not found)"}`,
      "",
      "Present this code at the event to claim or verify prizes.",
      "Good luck!",
    ].join("\n");

    // -------------------- LETTER HTML (Harry Potter themed, safe for email) --------------------
    const nameEsc = escapeHtml(registrant.name || "");
    const bureauEsc = registrant.bureau
      ? ` — ${escapeHtml(registrant.bureau)}`
      : "";
    const codeEsc = escapeHtml(registrant.gacha_code || "");
    const hasBarcode = Boolean(barcodePng);

    const html = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background:#1b1410;color:#2b211d;">
    <!-- Preheader (hidden preview in inbox) -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Your registration is verified. This owl post includes your gacha code.
    </div>

    <table role="presentation" width="100%" border="0" cellPadding="0" cellSpacing="0" style="background:#1b1410;">
      <tr>
        <td align="center" style="padding:24px;">
          <table role="presentation" width="100%" style="max-width:600px;" border="0" cellPadding="0" cellSpacing="0">
            <!-- Letter "parchment" frame -->
            <tr>
              <td
                style="
                  background:#f4e4b1;
                  background-image: radial-gradient(circle at 30% 10%, rgba(212,175,55,0.12), transparent 60%);
                  border: 3px solid #7c1e1e;
                  border-radius: 18px;
                  padding: 28px;
                  box-shadow: 0 6px 24px rgba(0,0,0,0.35);
                  font-family: Georgia, 'Times New Roman', Times, serif;
                  color:#2b211d;
                "
              >
                <!-- Header / seal -->
                <table role="presentation" width="100%" cellPadding="0" cellSpacing="0">
                  <tr>
                    <td align="center" style="padding-bottom:8px;">
                      <div
                        style="
                          display:inline-block;
                          width:56px;height:56px;
                          border-radius:50%;
                          background:radial-gradient(circle at 40% 35%, #8b2323, #5c1414 60%, #2d0a0a 100%);
                          box-shadow:0 0 8px rgba(124,30,30,0.5) inset, 0 2px 4px rgba(0,0,0,0.35);
                          line-height:56px;
                          text-align:center;
                          color:#f8e9c6;
                          font-weight:bold;
                          font-size:22px;
                        "
                        aria-hidden="true"
                      >HP</div>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-bottom:14px;">
                      <div style="font-size:20px;letter-spacing:0.5px;color:#7c1e1e;font-weight:bold;">
                        By Order of the Hogwarts Registry
                      </div>
                    </td>
                  </tr>
                </table>

                <!-- Salutation -->
                <p style="margin:0 0 12px 0;font-size:16px;line-height:1.5;">
                  Dear <strong>${nameEsc}${bureauEsc}</strong>,
                </p>

                <!-- Body text -->
                <p style="margin:0 0 12px 0;font-size:16px;line-height:1.6;">
                  We are pleased to inform you that your registration has been <strong style="color:#276749;">verified</strong>.
                </p>

                <!-- Code block -->
                <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="margin:16px 0;">
                  <tr>
                    <td
                      style="
                        background:#fffdf3;
                        border:2px solid rgba(124,30,30,0.45);
                        border-radius:14px;
                        padding:14px;
                        text-align:center;
                      "
                    >
                      <div style="font-size:14px;color:#5b4636;margin:0 0 6px 0;">Your Gacha Code</div>
                      <div
                        style="
                          display:inline-block;
                          padding:10px 16px;
                          font-family: 'Courier New', Courier, monospace;
                          font-size:22px;
                          letter-spacing:2px;
                          color:#1e1a17;
                          background:#fdf8e6;
                          border:1px dashed rgba(124,30,30,0.35);
                          border-radius:10px;
                        "
                      >${codeEsc || "&mdash;"}</div>
                    </td>
                  </tr>
                </table>

                ${
                  hasBarcode
                    ? `
                <!-- Barcode -->
                <div style="text-align:center;margin:8px 0 2px;">
                  <img src="cid:gcodeimg" width="320" height="60" alt="Your code in barcode form" style="display:inline-block;border:0;outline:none;text-decoration:none;" />
                </div>
                <div style="text-align:center;color:#6e5846;font-size:12px;margin-top:2px;">
                  Present this code (or the barcode) at the event desk.
                </div>
                `
                    : `
                <div style="text-align:center;color:#6e5846;font-size:12px;margin:4px 0;">
                  (Barcode unavailable — the code above is sufficient.)
                </div>
                `
                }

                <!-- Closing -->
                <p style="margin:16px 0 6px 0;font-size:16px;line-height:1.6;">
                  May fortune favor you in the prize drawings!
                </p>
                <p style="margin:0;font-size:15px;line-height:1.6;">
                  <em>Signed,</em><br/>
                  <strong style="color:#7c1e1e;">The Hogwarts Games Committee</strong>
                </p>

                <!-- Footer note -->
                <hr style="border:none;border-top:1px solid rgba(124,30,30,0.25);margin:18px 0;" />
                <p style="margin:0;font-size:12px;color:#6e5846;line-height:1.5;">
                  If you did not request this, you may safely ignore this owl post.
                </p>
              </td>
            </tr>
            <tr><td style="height:24px;"></td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
    `;

    const mailOptions = {
      from: smtpFrom,
      to,
      subject,
      text,
      html,
      attachments: [],
    };
    if (barcodePng) {
      mailOptions.attachments.push({
        filename: "gcode.png",
        content: barcodePng,
        cid: "gcodeimg",
        contentType: "image/png",
      });
    }

    const info = await transporter.sendMail(mailOptions);
    log.info("Sent verification email to", to);

    try {
      await pgPool.query(
        "INSERT INTO email_logs (registrant_id, to_email, subject, body, success) VALUES ($1,$2,$3,$4,$5)",
        [registrantId, to, subject, html, "Y"]
      );
      await pgPool.query(
        "UPDATE registrants SET is_send_email = $1 WHERE id = $2",
        ["Y", registrantId]
      );
    } catch (e) {
      log.warn(
        "Failed to write email_logs or update registrant after send",
        e && e.message
      );
    }

    return { ok: true, info };
  } catch (err) {
    log.error("sendVerificationEmail error:", err && err.message);
    try {
      const pool = typeof getPgPool === "function" ? getPgPool() : getPgPool;
      const r2 = await pool.query(
        "SELECT email FROM registrants WHERE id = $1",
        [registrantId]
      );
      const toEmail = (r2.rows[0] && r2.rows[0].email) || "";
      await pool.query(
        "INSERT INTO email_logs (registrant_id, to_email, subject, body, success, error) VALUES ($1,$2,$3,$4,$5,$6)",
        [
          registrantId,
          toEmail,
          "verification email",
          "",
          "N",
          String(err && err.message ? err.message : err),
        ]
      );
    } catch (e) {
      log.warn("Failed to write email_logs after send error", e && e.message);
    }
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
}

function registerResendEndpoint(app, getPgPool) {
  app.post("/api/admin/registrants/:id/resend-email", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id))
      return res.status(400).json({ error: "Invalid registrant id" });
    try {
      const result = await sendVerificationEmail(getPgPool, id);
      if (result && result.ok) return res.json({ ok: true });
      return res
        .status(500)
        .json({
          ok: false,
          error: result && result.error ? result.error : "failed to send",
        });
    } catch (err) {
      console.error("resend-email endpoint error", err && err.message);
      res.status(500).json({ error: "Failed to resend email" });
    }
  });
}

module.exports = { sendVerificationEmail, registerResendEndpoint };
