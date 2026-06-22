const express = require('express');
const { transporter, sendMail, FROM, TO } = require('./mailer');
const router = express.Router();

// Configure email transporter
// Mail transport (Brevo SMTP) provided by ./mailer

// Fallback: save to file if email fails
const fs = require('fs');
const path = require('path');
const CONTACTS_FILE = path.join(__dirname, '..', 'contacts.json');

function loadContacts() {
  try { if (fs.existsSync(CONTACTS_FILE)) return JSON.parse(fs.readFileSync(CONTACTS_FILE, 'utf8')); } catch(e) {}
  return [];
}
function saveContacts(data) { fs.writeFileSync(CONTACTS_FILE, JSON.stringify(data, null, 2)); }

// Contact form submission
router.post('/submit', async (req, res) => {
  const { name, email, phone, message, type } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'Name and phone required' });

  const contact = {
    id: Date.now().toString(),
    name,
    email: email || '',
    phone,
    message: message || '',
    type: type || 'general', // general, consultation, purchase, affiliate
    status: 'new',
    createdAt: new Date().toISOString()
  };

  // Save to file always
  const contacts = loadContacts();
  contacts.push(contact);
  saveContacts(contacts);

  // Try to send email
  try {
    const mailOptions = {
      from: `"UltraH2 Website" <${FROM}>`,
      to: TO,
      replyTo: email || undefined,
      subject: `🔔 New ${type || 'Contact'} Inquiry — ${name}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e2e8f0;border-radius:12px;">
          <div style="background:linear-gradient(135deg,#059669,#047857);padding:20px;border-radius:8px 8px 0 0;color:white;text-align:center;">
            <h2 style="margin:0;">New ${type || 'Contact'} Inquiry</h2>
          </div>
          <div style="padding:24px;background:#f8fafc;border-radius:0 0 8px 8px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:8px 0;font-weight:bold;color:#065f46;">Name:</td><td style="padding:8px 0;">${name}</td></tr>
              <tr><td style="padding:8px 0;font-weight:bold;color:#065f46;">Phone:</td><td style="padding:8px 0;"><a href="https://wa.me/${phone.replace(/[^0-9]/g,'')}">${phone}</a></td></tr>
              ${email ? `<tr><td style="padding:8px 0;font-weight:bold;color:#065f46;">Email:</td><td style="padding:8px 0;">${email}</td></tr>` : ''}
              ${message ? `<tr><td style="padding:8px 0;font-weight:bold;color:#065f46;">Message:</td><td style="padding:8px 0;">${message}</td></tr>` : ''}
              <tr><td style="padding:8px 0;font-weight:bold;color:#065f46;">Type:</td><td style="padding:8px 0;">${type || 'General'}</td></tr>
              <tr><td style="padding:8px 0;font-weight:bold;color:#065f46;">Time:</td><td style="padding:8px 0;">${new Date().toLocaleString('en-NG', {timeZone:'Africa/Lagos'})}</td></tr>
            </table>
            <div style="margin-top:20px;text-align:center;">
              <a href="https://wa.me/${phone.replace(/[^0-9]/g,'')}" style="display:inline-block;padding:12px 24px;background:#25D366;color:white;text-decoration:none;border-radius:8px;font-weight:bold;">Reply on WhatsApp</a>
            </div>
          </div>
        </div>
      `
    };

    await sendMail(mailOptions);
    contact.emailSent = true;
  } catch (err) {
    console.error('Email send error:', err.message);
    contact.emailSent = false;
    contact.emailError = err.message;
  }

  // Update contact with email status
  const updatedContacts = loadContacts();
  const idx = updatedContacts.findIndex(c => c.id === contact.id);
  if (idx >= 0) updatedContacts[idx] = contact;
  saveContacts(updatedContacts);

  res.json({ success: true, emailSent: contact.emailSent || false });
});

// ADMIN: Get all contacts
router.get('/all', (req, res) => {
  const contacts = loadContacts();
  res.json({ contacts, total: contacts.length });
});

// ADMIN: Update contact status
router.post('/status', (req, res) => {
  const { contactId, status } = req.body;
  const contacts = loadContacts();
  const contact = contacts.find(c => c.id === contactId);
  if (!contact) return res.status(404).json({ error: 'Not found' });
  contact.status = status; // new, contacted, converted, closed
  saveContacts(contacts);
  res.json({ success: true });
});

// ADMIN: Delete contact
router.delete('/:id', (req, res) => {
  let contacts = loadContacts();
  contacts = contacts.filter(c => c.id !== req.params.id);
  saveContacts(contacts);
  res.json({ success: true });
});

module.exports = router;
