const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'settings.json');

const DEFAULTS = {
  productName: 'UltraH2',
  price: 1300000,
  currency: 'NGN',
  paystackLink: 'https://paystack.shop/pay/ultrah2',
  supportEmail: 'support@ultrah2therapy.com',
  whatsapp: '2348186135105',
  social: { instagram: '', youtube: '', tiktok: '', facebook: '' },
  hero: { headline: '', subheadline: '' }
};

function load() {
  try {
    const saved = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Object.assign({}, DEFAULTS, saved, {
      social: Object.assign({}, DEFAULTS.social, saved.social || {}),
      hero: Object.assign({}, DEFAULTS.hero, saved.hero || {})
    });
  } catch (e) {
    return Object.assign({}, DEFAULTS);
  }
}
function save(data) { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); }

// PUBLIC: read settings (used by the site to render price, links, etc.)
router.get('/', (req, res) => res.json(load()));

// ADMIN: update settings (POST /api/settings/admin is token-guarded in server.js)
router.post('/admin', (req, res) => {
  const cur = load();
  const b = req.body || {};
  const next = Object.assign({}, cur, {
    productName: b.productName !== undefined ? b.productName : cur.productName,
    price: b.price !== undefined ? (Number(b.price) || cur.price) : cur.price,
    currency: b.currency !== undefined ? b.currency : cur.currency,
    paystackLink: b.paystackLink !== undefined ? b.paystackLink : cur.paystackLink,
    supportEmail: b.supportEmail !== undefined ? b.supportEmail : cur.supportEmail,
    whatsapp: b.whatsapp !== undefined ? b.whatsapp : cur.whatsapp,
    social: Object.assign({}, cur.social, b.social || {}),
    hero: Object.assign({}, cur.hero, b.hero || {})
  });
  save(next);
  res.json({ success: true, settings: next });
});

module.exports = router;
