const nodemailer = require("nodemailer");

const FROM = process.env.MAIL_FROM || "support@ultrah2therapy.com";
const TO = process.env.MAIL_TO || "support@ultrah2therapy.com";

// Brevo (Sendinblue) SMTP relay
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_KEY || ""
  }
});

function sendMail(opts) {
  return transporter.sendMail({
    from: opts.from || `"UltraH2" <${FROM}>`,
    to: opts.to || TO,
    subject: opts.subject,
    html: opts.html,
    replyTo: opts.replyTo || undefined
  });
}

module.exports = { transporter, sendMail, FROM, TO };
