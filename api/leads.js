const express = require('express');
const router = express.Router();

// In-memory storage (replace with database in production)
let leads = [];
let affiliates = [];

// Lead Capture Endpoint
router.post('/leads', (req, res) => {
    const { fullName, phone, whatsapp, email, city, occupation, interestType, source, referralCode } = req.body;
    
    // Calculate lead score
    let score = 50;
    const interestScores = { personal_wellness: 80, family_wellness: 85, business_opportunity: 70, affiliate_partnership: 60 };
    score = interestScores[interestType] || 50;
    const majorCities = ['lagos', 'abuja', 'port harcourt', 'ibadan', 'kano'];
    if (city && majorCities.includes(city.toLowerCase())) score += 10;
    
    // Determine segment
    let segment = 'general';
    let priority = 'normal';
    if (interestType === 'personal_wellness' || interestType === 'family_wellness') { segment = 'buyer_intent'; priority = 'high'; }
    else if (interestType === 'business_opportunity') { segment = 'business_partner'; priority = 'high'; }
    else if (interestType === 'affiliate_partnership') { segment = 'affiliate'; priority = 'medium'; }
    
    const lead = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
        fullName, phone, whatsapp: whatsapp || phone, email, city, occupation,
        interestType, source: source || 'website', referralCode: referralCode || null,
        status: 'new', segment, priority, score: Math.min(score, 100),
        createdAt: new Date().toISOString()
    };
    
    leads.push(lead);
    console.log('NEW LEAD:', lead);
    
    // TODO: Add email automation, SMS, WhatsApp notifications
    // TODO: Connect to Supabase database
    // TODO: Fire Facebook Pixel event
    // TODO: Notify sales team
    
    res.json({ success: true, message: 'Thank you. A wellness advisor will contact you shortly.', leadId: lead.id });
});

// Affiliate Registration
router.post('/affiliates/register', (req, res) => {
    const { fullName, email, phone, whatsapp, city, bankName, accountNumber, accountName } = req.body;
    
    const prefix = fullName.split(' ')[0].substring(0, 3).toUpperCase();
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    const referralCode = prefix + '-' + random;
    
    const affiliate = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
        fullName, email, phone, whatsapp: whatsapp || phone, city,
        referralCode, referralLink: 'https://ultrah2.ng/?ref=' + referralCode,
        bankName, accountNumber, accountName,
        status: 'active', totalClicks: 0, totalLeads: 0, totalSales: 0,
        totalEarned: 0, totalPaid: 0, createdAt: new Date().toISOString()
    };
    
    affiliates.push(affiliate);
    console.log('NEW AFFILIATE:', affiliate);
    
    res.json({ success: true, affiliate: { id: affiliate.id, referralCode, referralLink: affiliate.referralLink } });
});

// Affiliate Dashboard
router.get('/affiliates/:id/dashboard', (req, res) => {
    const affiliate = affiliates.find(a => a.id === req.params.id);
    if (!affiliate) return res.status(404).json({ error: 'Affiliate not found' });
    
    res.json({
        affiliate,
        stats: {
            totalClicks: affiliate.totalClicks,
            totalLeads: affiliate.totalLeads,
            totalSales: affiliate.totalSales,
            totalEarned: affiliate.totalEarned,
            totalPaid: affiliate.totalPaid,
            pendingBalance: affiliate.totalEarned - affiliate.totalPaid,
            conversionRate: affiliate.totalClicks > 0 ? ((affiliate.totalSales / affiliate.totalClicks) * 100).toFixed(1) : 0
        }
    });
});

// Referral Click Tracking
router.get('/ref/:code', (req, res) => {
    const code = req.params.code;
    const affiliate = affiliates.find(a => a.referralCode === code);
    if (affiliate) {
        affiliate.totalClicks++;
        console.log('REFERRAL CLICK:', code, 'Total:', affiliate.totalClicks);
    }
    res.redirect('/?ref=' + code);
});

// Get All Leads (Admin)
router.get('/admin/leads', (req, res) => {
    res.json({ total: leads.length, leads: leads.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
});

// Get All Affiliates (Admin)
router.get('/admin/affiliates', (req, res) => {
    res.json({ total: affiliates.length, affiliates: affiliates.sort((a, b) => b.totalSales - a.totalSales) });
});

// Dashboard Metrics (Admin)
router.get('/admin/metrics', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const todayLeads = leads.filter(l => l.createdAt.startsWith(today));
    const highPriority = leads.filter(l => l.priority === 'high' && l.status === 'new');
    
    res.json({
        totalLeads: leads.length,
        newLeadsToday: todayLeads.length,
        highPriorityPending: highPriority.length,
        totalAffiliates: affiliates.length,
        totalSales: affiliates.reduce((sum, a) => sum + a.totalSales, 0),
        totalRevenue: affiliates.reduce((sum, a) => sum + a.totalSales, 0) * 1300000,
        totalCommissions: affiliates.reduce((sum, a) => sum + a.totalEarned, 0),
        segments: {
            buyer_intent: leads.filter(l => l.segment === 'buyer_intent').length,
            business_partner: leads.filter(l => l.segment === 'business_partner').length,
            affiliate: leads.filter(l => l.segment === 'affiliate').length,
            general: leads.filter(l => l.segment === 'general').length
        }
    });
});

module.exports = router;
