const nodemailer = require("nodemailer");

/**
 * Email delivery for password resets.
 *
 * Three ways to send, tried in this order:
 *
 *   1. Brevo   - set BREVO_API_KEY
 *   2. Resend  - set RESEND_API_KEY
 *   3. SMTP    - set SMTP_HOST / SMTP_USER / SMTP_PASSWORD
 *
 * The HTTP providers are listed first on purpose. Hosting platforms very commonly block
 * outbound SMTP to stop their address ranges being used for spam, and a blocked port does
 * not announce itself - the connection simply hangs. Both providers post over HTTPS, which
 * nothing blocks, so they work where SMTP silently does not.
 *
 * With none of them configured the reset link is written to the server log. That is fine
 * locally but is not delivery, so `isMailerConfigured` is exported and the UI says plainly
 * that email isn't set up rather than implying a message is on its way.
 */

const RESET_SUBJECT = "Reset your RUPPER Connect password";

const brevoKey = (process.env.BREVO_API_KEY || "").trim();
const resendKey = (process.env.RESEND_API_KEY || "").trim();

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASSWORD;
const smtpConfigured = Boolean(smtpHost && smtpUser && smtpPass);

// Whichever transport is active, this is the address recipients see. MAIL_FROM covers the
// HTTP providers; SMTP_FROM is kept so existing deployments don't break.
const from = (process.env.MAIL_FROM || process.env.SMTP_FROM || smtpUser || "").trim();
const fromName = process.env.MAIL_FROM_NAME || "RUPPER Connect";

const provider = brevoKey ? "brevo" : resendKey ? "resend" : smtpConfigured ? "smtp" : "none";
const isConfigured = provider !== "none";

let transporter = null;
if (provider === "smtp") {
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
    // Without these a blocked outbound port doesn't fail, it hangs, and every send sits
    // there forever. Give up in seconds and report why instead.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

/** Strips any display name, so "RUPPER Connect <a@b.c>" yields "a@b.c". */
const bareAddress = (value) => {
  const match = String(value || "").match(/<([^>]+)>/);
  return (match ? match[1] : value || "").trim();
};

const buildBody = ({ name, resetUrl, expiresInMinutes }) => ({
  text: [
    `Hi ${name || "there"},`,
    "",
    "Use the link below to choose a new password:",
    resetUrl,
    "",
    `The link stops working in ${expiresInMinutes} minutes and can only be used once.`,
    "If you didn't ask for this, you can ignore this email - your password stays as it is.",
  ].join("\n"),
  html: `<p>Hi ${name || "there"},</p>
<p>Use the link below to choose a new password:</p>
<p><a href="${resetUrl}">Reset your password</a></p>
<p>The link stops working in ${expiresInMinutes} minutes and can only be used once.</p>
<p>If you didn't ask for this, you can ignore this email - your password stays as it is.</p>`,
});

/** Fetch with a deadline, so a stalled provider can't hold a request open indefinitely. */
const fetchWithTimeout = async (url, options, ms = 15_000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const sendViaBrevo = async ({ to, name, body }) => {
  const response = await fetchWithTimeout("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": brevoKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: bareAddress(from), name: fromName },
      to: [{ email: to, name: name || undefined }],
      subject: RESET_SUBJECT,
      textContent: body.text,
      htmlContent: body.html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Brevo rejected the message (${response.status}): ${detail.slice(0, 300)}`);
  }
  const data = await response.json().catch(() => ({}));
  return { delivered: true, messageId: data.messageId };
};

const sendViaResend = async ({ to, body }) => {
  const response = await fetchWithTimeout("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${resendKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: from.includes("<") ? from : `${fromName} <${bareAddress(from)}>`,
      to: [to],
      subject: RESET_SUBJECT,
      text: body.text,
      html: body.html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend rejected the message (${response.status}): ${detail.slice(0, 300)}`);
  }
  const data = await response.json().catch(() => ({}));
  return { delivered: true, messageId: data.id };
};

const sendViaSmtp = async ({ to, body }) => {
  const info = await transporter.sendMail({
    from: from.includes("<") ? from : `${fromName} <${bareAddress(from)}>`,
    to,
    subject: RESET_SUBJECT,
    text: body.text,
    html: body.html,
  });
  return {
    delivered: true,
    messageId: info.messageId,
    // Only ever set for throwaway test inboxes; handy for checking the template renders.
    previewUrl: nodemailer.getTestMessageUrl(info) || undefined,
  };
};

async function sendPasswordResetEmail({ to, name, resetUrl, expiresInMinutes }) {
  const body = buildBody({ name, resetUrl, expiresInMinutes });

  if (provider === "none") {
    // Development only. The caller never treats this as delivered.
    console.log("\n--- password reset (no email provider configured, printing instead) ---");
    console.log(`to: ${to}`);
    console.log(resetUrl);
    console.log("--- end ---\n");
    return { delivered: false, reason: "no-provider" };
  }

  if (provider === "brevo") return sendViaBrevo({ to, name, body });
  if (provider === "resend") return sendViaResend({ to, body });
  return sendViaSmtp({ to, body });
}

/** Checks the active provider really works, surfacing the actual error rather than a hang. */
async function verifyMailer() {
  if (provider === "none") {
    return {
      ok: false,
      reason:
        "No email provider is configured. Set BREVO_API_KEY or RESEND_API_KEY (recommended), or SMTP_HOST/SMTP_USER/SMTP_PASSWORD.",
    };
  }

  if (!bareAddress(from)) {
    return { ok: false, reason: "No sender address. Set MAIL_FROM to the address you have verified with your provider." };
  }

  try {
    if (provider === "brevo") {
      const res = await fetchWithTimeout("https://api.brevo.com/v3/account", { headers: { "api-key": brevoKey } });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return { ok: false, reason: `Brevo API key rejected (${res.status}): ${detail.slice(0, 200)}`, code: `HTTP_${res.status}` };
      }
      return { ok: true };
    }

    if (provider === "resend") {
      const res = await fetchWithTimeout("https://api.resend.com/domains", {
        headers: { authorization: `Bearer ${resendKey}` },
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return { ok: false, reason: `Resend API key rejected (${res.status}): ${detail.slice(0, 200)}`, code: `HTTP_${res.status}` };
      }
      return { ok: true };
    }

    await transporter.verify();
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error.message, code: error.code };
  }
}

module.exports = {
  sendPasswordResetEmail,
  verifyMailer,
  isMailerConfigured: isConfigured,
  mailerFrom: from,
  mailerProvider: provider,
};
