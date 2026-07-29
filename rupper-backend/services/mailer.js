const nodemailer = require("nodemailer");

/**
 * Email delivery for password resets.
 *
 * SMTP is optional. When it isn't configured the reset token is written to the server log
 * instead, which is fine for local development but is NOT a delivery mechanism in
 * production - so `isConfigured` is exported and the route refuses to pretend a reset email
 * was sent when it can't send one. The alternative, quietly dropping the mail, would leave
 * people waiting for something that is never coming.
 */

const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT || 587);
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASSWORD;
const from = process.env.SMTP_FROM || user;

const isConfigured = Boolean(host && user && pass);

let transporter = null;
if (isConfigured) {
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    // Without these a blocked outbound port doesn't fail - it just hangs, and every send
    // sits there forever. Hosts commonly filter SMTP, so fail in seconds and say why.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

/** Proves the SMTP settings actually work, surfacing the real error instead of a hang. */
async function verifyMailer() {
  if (!isConfigured) return { ok: false, reason: "SMTP is not configured (SMTP_HOST, SMTP_USER and SMTP_PASSWORD)." };
  try {
    await transporter.verify();
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error.message, code: error.code };
  }
}

async function sendPasswordResetEmail({ to, name, resetUrl, expiresInMinutes }) {
  const subject = "Reset your RUPPER Connect password";
  const text = [
    `Hi ${name || "there"},`,
    "",
    "Use the link below to choose a new password:",
    resetUrl,
    "",
    `The link stops working in ${expiresInMinutes} minutes and can only be used once.`,
    "If you didn't ask for this, you can ignore this email - your password stays as it is.",
  ].join("\n");

  if (!isConfigured) {
    // Development only. Never treated as "sent" by the caller.
    console.log("\n--- password reset (SMTP not configured, printing instead) ---");
    console.log(`to: ${to}`);
    console.log(resetUrl);
    console.log("--- end ---\n");
    return { delivered: false, reason: "smtp-not-configured" };
  }

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html: `<p>Hi ${name || "there"},</p>
<p>Use the link below to choose a new password:</p>
<p><a href="${resetUrl}">Reset your password</a></p>
<p>The link stops working in ${expiresInMinutes} minutes and can only be used once.</p>
<p>If you didn't ask for this, you can ignore this email - your password stays as it is.</p>`,
  });

  // getTestMessageUrl only returns anything for throwaway test inboxes, which is handy when
  // checking the template renders without mailing a real person.
  return { delivered: true, messageId: info.messageId, previewUrl: nodemailer.getTestMessageUrl(info) || undefined };
}

module.exports = { sendPasswordResetEmail, verifyMailer, isMailerConfigured: isConfigured, mailerFrom: from };
