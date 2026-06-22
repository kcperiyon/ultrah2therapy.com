const nodemailer = require("nodemailer");

const FROM = process.env.MAIL_FROM || "support@ultrah2therapy.com";
const FROM_NAME = process.env.MAIL_FROM_NAME || "UltraH2";
const TO = process.env.MAIL_TO || "support@ultrah2therapy.com";
const BREVO_API_KEY = process.env.BREVO_API_KEY || "";

// SMTP relay (fallback, used only when no Brevo API key is configured)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: { user: process.env.SMTP_USER || "", pass: process.env.SMTP_KEY || "" }
});

// Accepts a plain email or a "Name <email>" string and splits it
function parseAddr(a) {
  const m = /^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/.exec(a || "");
  if (m) return { name: (m[1] || "").trim() || undefined, email: m[2].trim() };
  return { email: (a || "").trim() };
}

// Brevo transactional Email HTTP API
async function sendViaApi(opts) {
  const toAddr = parseAddr(opts.to || TO);
  const body = {
    sender: { email: FROM, name: FROM_NAME },
    to: [{ email: toAddr.email, name: toAddr.name }],
    subject: opts.subject,
    htmlContent: opts.html
  };
  if (opts.replyTo) body.replyTo = parseAddr(opts.replyTo);

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "api-key": BREVO_API_KEY
    },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) throw new Error("Brevo API " + res.status + ": " + text);
  return JSON.parse(text || "{}");
}

// SMTP relay send
function sendViaSmtp(opts) {
  return transporter.sendMail({
    from: opts.from || ("\"" + FROM_NAME + "\" <" + FROM + ">"),
    to: opts.to || TO,
    subject: opts.subject,
    html: opts.html,
    replyTo: opts.replyTo || undefined
  });
}

// Unified send: prefer Brevo API when a key is set, else SMTP relay
function sendMail(opts) {
  return BREVO_API_KEY ? sendViaApi(opts) : sendViaSmtp(opts);
}

module.exports = { transporter, sendMail, FROM, TO };
