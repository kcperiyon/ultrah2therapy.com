const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { sendMail } = require('./mailer');

const AFFILIATES_FILE = path.join(__dirname, '..', 'affiliates.json');
const REFERRALS_FILE = path.join(__dirname, '..', 'referrals.json');
const CLICKS_FILE = path.join(__dirname, '..', 'affiliate-clicks.json');
const PAYOUTS_FILE = path.join(__dirname, '..', 'affiliate-payouts.json');
const COMMISSION = 100000; // ₦100,000

function readJSON(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch(e) { return []; } }
function writeJSON(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }

function generateCode(name) {
  const clean = name.replace(/[^a-zA-Z]/g, '').substring(0, 6).toUpperCase();
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return 'UH2' + clean + rand;
}

// PUBLIC: Register
router.post('/register', (req, res) => {
  const { name, phone, email, password, bankName, accountNumber, accountName, agreedToTerms } = req.body;
  if (!name || !phone) return res.json({ error: 'Name and phone required' });

  const affiliates = readJSON(AFFILIATES_FILE);
  const exists = affiliates.find(a => a.phone === phone);
  if (exists) return res.json({ error: 'Phone already registered', affiliate: { code: exists.code, link: exists.link } });

  const code = generateCode(name);
  const affiliate = {
    id: String(Date.now()),
    name, email: email || '', phone,
    password: password || '',
    bankName: bankName || '', accountNumber: accountNumber || '', accountName: accountName || '',
    code,
    link: `https://ultrah2therapy.com?ref=${code}`,
    paymentLink: `https://ultrah2therapy.com/checkout?ref=${code}`,
    status: 'active',
    totalEarnings: 0, totalPaid: 0, pendingPayout: 0,
    referralCount: 0, clickCount: 0,
    agreedToTerms: agreedToTerms || false,
    createdAt: new Date().toISOString()
  };

  affiliates.push(affiliate);
  writeJSON(AFFILIATES_FILE, affiliates);

  // Notify admin + welcome the new affiliate (non-blocking)
  sendMail({
    subject: `New Affiliate Signup - ${affiliate.name}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;"><h2 style="color:#065f46;">New Affiliate Registered</h2><p><strong>Name:</strong> ${affiliate.name}<br><strong>Phone:</strong> ${affiliate.phone}<br><strong>Email:</strong> ${affiliate.email || "-"}<br><strong>Code:</strong> ${affiliate.code}<br><strong>Bank:</strong> ${affiliate.bankName || "-"} ${affiliate.accountNumber || ""} ${affiliate.accountName || ""}<br><strong>Link:</strong> ${affiliate.link}</p></div>`
  }).catch(e => console.error("Affiliate admin mail error:", e.message));

  if (affiliate.email) {
    sendMail({
      to: affiliate.email,
      subject: "Welcome to the UltraH2 Affiliate Program",
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;"><div style="background:linear-gradient(135deg,#059669,#047857);padding:24px;border-radius:8px;color:#fff;text-align:center;"><h2 style="margin:0;">Welcome, ${affiliate.name}!</h2><p style="margin:8px 0 0;">You are now an UltraH2 Affiliate Partner</p></div><div style="padding:24px 4px;color:#1e293b;"><p>You earn <strong>N100,000</strong> for every confirmed sale through your link.</p><p><strong>Your referral link:</strong><br><a href="${affiliate.link}">${affiliate.link}</a></p><p><strong>Direct checkout link:</strong><br><a href="${affiliate.paymentLink}">${affiliate.paymentLink}</a></p><p>Track your clicks, referrals and earnings anytime in your <a href="https://ultrah2therapy.com/affiliate-portal">Affiliate Portal</a> (log in with your phone number and password).</p><p style="color:#64748b;font-size:0.85rem;">Share your link on WhatsApp, social media, or in person. Questions? Just reply to this email.</p></div></div>`
    }).catch(e => console.error("Affiliate welcome mail error:", e.message));
  }

  res.json({ success: true, affiliate });
});

// PUBLIC: Portal login
router.post('/portal', (req, res) => {
  const { phone, password } = req.body;
  if (!phone) return res.json({ error: 'Phone required' });

  const affiliates = readJSON(AFFILIATES_FILE);
  const aff = affiliates.find(a => a.phone === phone);
  if (!aff) return res.json({ error: 'Not found' });
  if (aff.password && password !== aff.password) return res.json({ error: 'Invalid password' });

  const referrals = readJSON(REFERRALS_FILE).filter(r => r.affiliateCode === aff.code);
  const clicks = readJSON(CLICKS_FILE).filter(c => c.code === aff.code);
  const payouts = readJSON(PAYOUTS_FILE).filter(p => p.affiliateCode === aff.code);

  const now = new Date();
  const last30 = new Date(now - 30 * 24 * 60 * 60 * 1000);

  res.json({
    affiliate: {
      name: aff.name, code: aff.code, link: aff.link, paymentLink: aff.paymentLink,
      status: aff.status, totalEarnings: aff.totalEarnings, totalPaid: aff.totalPaid,
      pendingPayout: aff.pendingPayout, referralCount: aff.referralCount, clickCount: aff.clickCount,
      createdAt: aff.createdAt
    },
    referrals: referrals.map(r => ({ date: r.createdAt, customer: r.customerName, amount: r.amount, commission: r.commission, status: r.status })),
    payouts: payouts.map(p => ({ date: p.date, amount: p.amount, method: p.method, reference: p.reference })),
    stats: {
      totalClicks: clicks.length,
      last30DaysClicks: clicks.filter(c => new Date(c.date) > last30).length,
      totalReferrals: referrals.length,
      pendingReferrals: referrals.filter(r => r.status === 'pending').length,
      confirmedReferrals: referrals.filter(r => r.status === 'confirmed').length,
      paidReferrals: referrals.filter(r => r.status === 'paid').length,
      conversionRate: clicks.length ? ((referrals.length / clicks.length) * 100).toFixed(1) + '%' : '0%'
    }
  });
});

// PUBLIC: Track click
router.post('/click', (req, res) => {
  const { code } = req.body;
  if (!code) return res.json({ error: 'No code' });

  const affiliates = readJSON(AFFILIATES_FILE);
  const aff = affiliates.find(a => a.code === code);
  if (!aff) return res.json({ error: 'Invalid code' });

  const clicks = readJSON(CLICKS_FILE);
  clicks.push({ code, date: new Date().toISOString(), ip: req.ip });
  writeJSON(CLICKS_FILE, clicks);

  aff.clickCount = (aff.clickCount || 0) + 1;
  writeJSON(AFFILIATES_FILE, affiliates);

  res.json({ success: true });
});

// PUBLIC: Record a pending referral (from website checkout, before Paystack redirect)
router.post('/referral', (req, res) => {
  const { affiliateCode, customerName, customerPhone, customerEmail, amount } = req.body;
  if (!affiliateCode) return res.json({ error: 'Affiliate code required' });

  const affiliates = readJSON(AFFILIATES_FILE);
  const aff = affiliates.find(a => a.code === affiliateCode);
  if (!aff) return res.json({ error: 'Invalid affiliate code' });

  const referrals = readJSON(REFERRALS_FILE);
  // De-dupe: same affiliate + customer phone within 24h => return existing pending referral
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const dup = referrals.find(r => r.affiliateCode === affiliateCode && r.customerPhone === (customerPhone || '') && r.status === 'pending' && new Date(r.createdAt).getTime() > dayAgo);
  if (dup) return res.json({ success: true, referral: dup, duplicate: true });

  const referral = {
    id: String(Date.now()),
    affiliateId: aff.id,
    affiliateCode: aff.code,
    affiliateName: aff.name,
    customerName: customerName || '',
    customerPhone: customerPhone || '',
    customerEmail: customerEmail || '',
    amount: amount || 1300000,
    commission: COMMISSION,
    paymentMethod: 'paystack',
    reference: '',
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  referrals.push(referral);
  writeJSON(REFERRALS_FILE, referrals);

  res.json({ success: true, referral });
});

// PUBLIC: Verify code
router.get('/verify/:code', (req, res) => {
  const affiliates = readJSON(AFFILIATES_FILE);
  const aff = affiliates.find(a => a.code === req.params.code);
  res.json({ valid: !!aff, name: aff ? aff.name : null });
});

// ADMIN: Get all data
router.get('/admin/all', (req, res) => {
  const affiliates = readJSON(AFFILIATES_FILE);
  const referrals = readJSON(REFERRALS_FILE);
  const payouts = readJSON(PAYOUTS_FILE);

  const safeAffiliates = affiliates.map(a => ({ ...a, password: '***' }));

  const stats = {
    totalAffiliates: affiliates.length,
    activeAffiliates: affiliates.filter(a => a.status === 'active').length,
    totalReferrals: referrals.length,
    pendingReferrals: referrals.filter(r => r.status === 'pending').length,
    confirmedReferrals: referrals.filter(r => r.status === 'confirmed').length,
    paidReferrals: referrals.filter(r => r.status === 'paid').length,
    totalCommissions: referrals.reduce((s, r) => s + (r.commission || 0), 0),
    totalPaid: payouts.reduce((s, p) => s + (p.amount || 0), 0),
    totalPending: affiliates.reduce((s, a) => s + (a.pendingPayout || 0), 0),
    totalClicks: affiliates.reduce((s, a) => s + (a.clickCount || 0), 0),
    totalProductSales: referrals.filter(r => r.status !== 'cancelled').length
  };

  res.json({ affiliates: safeAffiliates, referrals, payouts, stats });
});

// ADMIN: Add affiliate manually
router.post('/admin/add', (req, res) => {
  const { name, phone, email, bankName, accountNumber, accountName } = req.body;
  if (!name || !phone) return res.json({ error: 'Name and phone required' });

  const affiliates = readJSON(AFFILIATES_FILE);
  const code = generateCode(name);
  const affiliate = {
    id: String(Date.now()),
    name, email: email || '', phone,
    password: '',
    bankName: bankName || '', accountNumber: accountNumber || '', accountName: accountName || '',
    code,
    link: `https://ultrah2therapy.com?ref=${code}`,
    paymentLink: `https://ultrah2therapy.com/checkout?ref=${code}`,
    status: 'active',
    totalEarnings: 0, totalPaid: 0, pendingPayout: 0,
    referralCount: 0, clickCount: 0,
    createdAt: new Date().toISOString()
  };

  affiliates.push(affiliate);
  writeJSON(AFFILIATES_FILE, affiliates);
  res.json({ success: true, affiliate });
});

// ADMIN: Record sale manually
router.post('/admin/record-sale', (req, res) => {
  const { affiliateCode, customerName, customerPhone, amount, paymentMethod, reference } = req.body;
  if (!affiliateCode) return res.json({ error: 'Affiliate code required' });
  if (!customerName) return res.json({ error: 'Customer name required' });

  const affiliates = readJSON(AFFILIATES_FILE);
  const aff = affiliates.find(a => a.code === affiliateCode);
  if (!aff) return res.json({ error: 'Affiliate not found with code: ' + affiliateCode });

  const referrals = readJSON(REFERRALS_FILE);
  const referral = {
    id: String(Date.now()),
    affiliateId: aff.id,
    affiliateCode: aff.code,
    affiliateName: aff.name,
    customerName: customerName || '',
    customerPhone: customerPhone || '',
    amount: amount || 1300000,
    commission: COMMISSION,
    paymentMethod: paymentMethod || 'manual',
    reference: reference || '',
    status: 'confirmed',
    createdAt: new Date().toISOString()
  };

  referrals.push(referral);
  writeJSON(REFERRALS_FILE, referrals);

  // Update affiliate stats
  aff.referralCount = (aff.referralCount || 0) + 1;
  aff.totalEarnings = (aff.totalEarnings || 0) + COMMISSION;
  aff.pendingPayout = (aff.pendingPayout || 0) + COMMISSION;
  writeJSON(AFFILIATES_FILE, affiliates);

  res.json({ success: true, referral, message: `Sale recorded. ${aff.name} credited ₦${COMMISSION.toLocaleString()}` });
});

// ADMIN: Record payout
router.post('/admin/pay', (req, res) => {
  const { affiliateCode, amount, method, reference } = req.body;
  if (!affiliateCode) return res.json({ error: 'Affiliate code required' });
  if (!amount || amount <= 0) return res.json({ error: 'Valid amount required' });

  const affiliates = readJSON(AFFILIATES_FILE);
  const aff = affiliates.find(a => a.code === affiliateCode);
  if (!aff) return res.json({ error: 'Affiliate not found' });

  const payouts = readJSON(PAYOUTS_FILE);
  const payout = {
    id: String(Date.now()),
    affiliateId: aff.id,
    affiliateCode: aff.code,
    affiliateName: aff.name,
    amount: Number(amount),
    method: method || 'bank_transfer',
    reference: reference || '',
    date: new Date().toISOString()
  };

  payouts.push(payout);
  writeJSON(PAYOUTS_FILE, payouts);

  // Update affiliate
  aff.totalPaid = (aff.totalPaid || 0) + Number(amount);
  aff.pendingPayout = Math.max(0, (aff.pendingPayout || 0) - Number(amount));
  writeJSON(AFFILIATES_FILE, affiliates);

  res.json({ success: true, payout, message: `Payout of ₦${Number(amount).toLocaleString()} to ${aff.name} recorded.` });
});

// ADMIN: Confirm referral
router.post('/admin/confirm', (req, res) => {
  const { referralId } = req.body;
  const referrals = readJSON(REFERRALS_FILE);
  const ref = referrals.find(r => r.id === referralId);
  if (!ref) return res.json({ error: 'Referral not found' });

  ref.status = 'confirmed';
  writeJSON(REFERRALS_FILE, referrals);

  // Credit affiliate
  const affiliates = readJSON(AFFILIATES_FILE);
  const aff = affiliates.find(a => a.code === ref.affiliateCode);
  if (aff) {
    aff.totalEarnings = (aff.totalEarnings || 0) + (ref.commission || COMMISSION);
    aff.pendingPayout = (aff.pendingPayout || 0) + (ref.commission || COMMISSION);
    writeJSON(AFFILIATES_FILE, affiliates);
  }

  res.json({ success: true });
});

// ADMIN: Cancel referral
router.post('/admin/cancel', (req, res) => {
  const { referralId } = req.body;
  const referrals = readJSON(REFERRALS_FILE);
  const ref = referrals.find(r => r.id === referralId);
  if (!ref) return res.json({ error: 'Referral not found' });

  ref.status = 'cancelled';
  writeJSON(REFERRALS_FILE, referrals);
  res.json({ success: true });
});

// ADMIN: Mark referral paid
router.post('/admin/mark-paid', (req, res) => {
  const { referralId } = req.body;
  const referrals = readJSON(REFERRALS_FILE);
  const ref = referrals.find(r => r.id === referralId);
  if (!ref) return res.json({ error: 'Referral not found' });

  ref.status = 'paid';
  writeJSON(REFERRALS_FILE, referrals);
  res.json({ success: true });
});

// ADMIN: Delete affiliate
router.delete('/admin/delete/:id', (req, res) => {
  let affiliates = readJSON(AFFILIATES_FILE);
  affiliates = affiliates.filter(a => a.id !== req.params.id);
  writeJSON(AFFILIATES_FILE, affiliates);
  res.json({ success: true });
});

// ADMIN: Export CSV
router.get('/admin/export', (req, res) => {
  const affiliates = readJSON(AFFILIATES_FILE);
  const header = 'Name,Phone,Email,Code,Bank,Account,Earnings,Paid,Pending,Sales,Clicks,Status,Joined\n';
  const rows = affiliates.map(a => `"${a.name}","${a.phone}","${a.email}","${a.code}","${a.bankName}","${a.accountNumber}",${a.totalEarnings},${a.totalPaid},${a.pendingPayout},${a.referralCount},${a.clickCount},"${a.status}","${a.createdAt}"`).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=affiliates-export.csv');
  res.send(header + rows);
});

module.exports = router;
