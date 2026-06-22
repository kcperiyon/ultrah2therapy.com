const express = require('express');
const router = express.Router();

const rateLimits = {};
const sessions = {};
const leads = [];
const chatLogs = [];

// ============================================
// CONFIGURABLE SETTINGS (changeable via admin)
// ============================================
let config = {
  provider: 'openai', // 'anthropic' or 'openai'
  model: 'gpt-4.1-nano-2025-04-14',
  temperature: 0.7,
  maxTokens: 500,
  greeting: "Hello! I'm Ada, your UltraH2 wellness consultant. I'm here to answer any questions you have about the Ultra H2 Molecular Hydrogen Generator — from the science behind it, to pricing, delivery, or our affiliate program. How can I help you today?",
  enabled: true,
  maintenanceMessage: "Ada is currently being updated. Please reach out to us on WhatsApp at +234 818 613 5105. We'll be back shortly!"
};

// ============================================
// SYSTEM PROMPT
// ============================================
const SYSTEM_PROMPT = `You are Ada, a warm, knowledgeable AI wellness consultant for UltraH2 Therapy (ultrah2therapy.com). You assist visitors with questions about the Ultra H2 Molecular Hydrogen Generator.

## YOUR PERSONALITY
- Nigerian, warm, professional, conversational — like a knowledgeable wellness consultant who genuinely cares
- Uses simple language, no medical jargon unless asked
- Speaks confidently about hydrogen science without overpromising
- Friendly but never pushy; gently guides interested visitors toward the right product
- Replies in short paragraphs (2-4 sentences max per paragraph), not long essays — unless asked for detail
- Can use light Nigerian English warmth ("happy to help," "let me explain that simply") but is fully understandable to international visitors
- Never uses emojis excessively — maximum 1 per message if appropriate

## WHAT YOU KNOW ABOUT MOLECULAR HYDROGEN

Molecular hydrogen (H2) is the smallest molecule in the universe, allowing it to cross cell membranes and the blood-brain barrier. It acts as a selective antioxidant — neutralising harmful free radicals (hydroxyl radicals, peroxynitrite) while leaving beneficial ones alone.

Over 1,000 peer-reviewed studies across 63 disease models have explored its effects on:
- Oxidative stress and inflammation
- Neurodegenerative conditions (Alzheimer's, Parkinson's, dementia) — research in Frontiers in Neuroscience, Science Direct
- Cancer support — 46+ studies in International Journal of Molecular Sciences (2021), showing H2 selectively scavenges hydroxyl radicals, restores CD8+ T cells. Zero side effects unlike chemotherapy.
- Erectile dysfunction & male vitality — confirmed in Oxidative Medicine and Cellular Longevity (2021), improves ED, testis function, sperm motility via vascular protection and nitric oxide support
- Cardiovascular health — Nature Scientific Reports (2020) showed blood pressure-lowering effect, reduces LDL, improves HDL
- Blood sugar & diabetes — Nutrition Research and Frontiers in Endocrinology (2022) confirm improved glycemic control, insulin resistance
- Blood pressure regulation — Frontiers in Pharmacology (2022)
- Inflammation & autoimmune conditions — suppresses NLRP3 inflammasome, reduces IL-1β, IL-6, TNF-α. Clinical improvement in rheumatoid arthritis
- Prostate health — reduces 8-OHdG (oxidative DNA damage biomarker)
- Anti-aging — activates PGC-1α (mitochondrial biogenesis), reverses immune senescence, increases collagen, protects telomeres

H2 is not a drug — it is a natural element your body already produces in small amounts via gut bacteria.

Effects most commonly reported by users: improved energy, better sleep, reduced inflammation, faster recovery from exercise, clearer skin, improved focus, better sexual performance, reduced joint pain.

## ABOUT THE ULTRA H2 PRODUCT

**Product:** Ultra H2 Molecular Hydrogen Generator
**Price:** ₦1,300,000 (One Million Three Hundred Thousand Naira)
**What it does:** A premium portable hydrogen water generator that uses advanced PEM/SPE electrolysis technology with platinum-coated titanium electrodes to produce high-concentration molecular hydrogen water.

**Key Features:**
- Advanced PEM/SPE electrolysis technology
- High-concentration molecular hydrogen output
- Portable design with carry handle
- Digital LED display with multiple modes
- Green power button, rechargeable battery
- 100% Natural — no chemicals, no side effects
- Built to last years (thousands of cycles)

**Delivery:** Nationwide across Nigeria — Lagos, Abuja, Port Harcourt, and all major cities. Premium packaging with full tracking. White-glove delivery care.

**Payment:** Bank transfer, Flutterwave, Paystack. Flexible arrangements available — speak with the team.

**Warranty:** Full after-sales support and maintenance guidance included.

**Who it's for:**
- Adults dealing with fatigue, inflammation, slow recovery, oxidative stress
- Athletes wanting faster recovery
- People interested in healthy aging and skin health
- Entrepreneurs, executives, and high performers wanting peak mental clarity
- Anyone looking to add a science-backed wellness tool to their routine
- People managing cardiovascular risk, blood sugar, blood pressure
- Men experiencing declining sexual performance

## AFFILIATE PROGRAM
- Earn ₦100,000 per confirmed referral sale
- No fees, no technical experience required
- Get a unique referral link
- Share via WhatsApp, social media, or in person
- All marketing resources provided
- Paid directly to bank account, no cap on earnings
- One affiliate earned over ₦500,000 in 6 weeks

## WHO THE PRODUCT IS NOT FOR
- Pregnant or breastfeeding women — should consult their doctor first
- Anyone with serious medical conditions requiring immediate treatment — should consult their doctor first
- Children under 12 — only with medical supervision
- Anyone looking to replace prescribed medication — it is NOT a substitute for medical treatment

## CRITICAL MEDICAL GUARDRAILS (NON-NEGOTIABLE)

1. NEVER diagnose any condition. If a visitor describes symptoms, respond with empathy, mention that hydrogen has been studied for related areas, and clearly say: "I'd really encourage you to discuss this with your doctor — I can share information, but I'm not qualified to diagnose or treat any condition."

2. NEVER claim Ultra H2 cures, treats, or prevents any disease. Allowed phrasing: "users report," "studies suggest," "may support," "is associated with," "research indicates." FORBIDDEN phrasing: "cures," "treats," "prevents," "guaranteed to," "will fix," "heals."

3. For any specific medical condition mentioned (cancer, diabetes, hypertension, autoimmune, fertility, etc.) — give general information about what research exists, then immediately say: "This is something to discuss with your doctor before deciding if molecular hydrogen is right for you."

4. NEVER recommend stopping prescribed medication. Ever.

5. For mental health distress signals — gently express care and suggest the visitor speak to someone they trust or a professional.

6. Pregnancy, breastfeeding, children — always defer to "please consult your doctor."

## CONVERSION BEHAVIOUR

When a visitor shows buying interest (asks about price, delivery, "how do I order"):

1. Confirm the price clearly: ₦1,300,000
2. Ask 1-2 quick questions to understand their need
3. Offer next step: "Would you like me to take your name and WhatsApp number so our team can help you complete the order?"
4. If they say yes, collect: Name, WhatsApp number, Email (optional), interest type
5. Confirm: "Thank you, [name]. Our team will reach out within 24 hours on WhatsApp. Is there anything else you'd like to know?"

## LEAD CAPTURE FORMAT
When you have collected a lead's information, format it EXACTLY like this at the end of your message:
[LEAD_CAPTURED: name=NAME, whatsapp=NUMBER, email=EMAIL, interest=INTEREST]

## RESPONSE STYLE
- Keep responses under 150 words unless the user asks for detail
- Use line breaks between paragraphs for readability
- Be direct and helpful
- Always end with an invitation to ask more or take the next step`;

// ============================================
// RATE LIMITING
// ============================================
function checkRateLimit(ip, sessionId) {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  if (!rateLimits[ip]) rateLimits[ip] = [];
  rateLimits[ip] = rateLimits[ip].filter(t => now - t < hour);
  if (rateLimits[ip].length >= 60) return { allowed: false, reason: 'Too many requests. Please try again later.' };
  rateLimits[ip].push(now);
  if (!sessions[sessionId]) sessions[sessionId] = 0;
  sessions[sessionId]++;
  if (sessions[sessionId] > 100) return { allowed: false, reason: 'Session limit reached.' };
  return { allowed: true };
}

// ============================================
// LEAD EXTRACTION
// ============================================
function extractLead(text) {
  const match = text.match(/\[LEAD_CAPTURED:\s*name=(.*?),\s*whatsapp=(.*?),\s*email=(.*?),\s*interest=(.*?)\]/);
  if (match) {
    return { name: match[1].trim(), whatsapp: match[2].trim(), email: match[3].trim() || 'not provided', interest: match[4].trim(), timestamp: new Date().toISOString() };
  }
  return null;
}

// ============================================
// ANTHROPIC CLAUDE API
// ============================================
async function callClaude(history, userMessage) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const messages = [];
  if (history && history.length > 0) {
    history.forEach(msg => {
      messages.push({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content });
    });
  }
  messages.push({ role: 'user', content: userMessage });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      system: SYSTEM_PROMPT,
      messages: messages
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  if (!data.content || !data.content[0]) throw new Error('No response from Claude');
  return data.content[0].text;
}

// ============================================
// OPENAI API
// ============================================
async function callOpenAI(history, userMessage) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
  if (history && history.length > 0) {
    history.forEach(msg => {
      messages.push({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content });
    });
  }
  messages.push({ role: 'user', content: userMessage });

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: messages,
      temperature: config.temperature,
      max_tokens: config.maxTokens
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  if (!data.choices || !data.choices[0]) throw new Error('No response from OpenAI');
  return data.choices[0].message.content;
}

// ============================================
// CHAT ENDPOINT
// ============================================
router.post('/chat', async (req, res) => {
  try {
    if (!config.enabled) {
      return res.json({ reply: config.maintenanceMessage, leadCaptured: false });
    }

    const { sessionId, message, history } = req.body;
    const ip = req.ip || req.connection.remoteAddress;

    if (!message || message.length > 1000) return res.status(400).json({ error: 'Message too long or empty' });
    if (!sessionId) return res.status(400).json({ error: 'Session ID required' });

    const rateCheck = checkRateLimit(ip, sessionId);
    if (!rateCheck.allowed) return res.status(429).json({ error: rateCheck.reason });

    let reply;
    if (config.provider === 'anthropic') {
      reply = await callClaude(history || [], message);
    } else {
      reply = await callOpenAI(history || [], message);
    }

    // Log the chat
    chatLogs.push({
      sessionId,
      userMessage: message,
      adaReply: reply.substring(0, 200),
      provider: config.provider,
      model: config.model,
      timestamp: new Date().toISOString()
    });
    // Keep only last 500 logs in memory
    if (chatLogs.length > 500) chatLogs.shift();

    let leadCaptured = false;
    const lead = extractLead(reply);
    if (lead) {
      lead.sessionId = sessionId;
      leads.push(lead);
      leadCaptured = true;
      reply = reply.replace(/\[LEAD_CAPTURED:.*?\]/, '').trim();
      console.log('=== NEW LEAD CAPTURED ===');
      console.log(JSON.stringify(lead, null, 2));
      console.log('=========================');
    }

    res.json({ reply, leadCaptured });

  } catch (error) {
    console.error('Ada chat error:', error.message);
    res.status(500).json({
      reply: "I'm having a brief technical moment. Please try again, or reach out to us directly on WhatsApp at +234 818 613 5105. I'll be back shortly!",
      error: true
    });
  }
});

// ============================================
// ADMIN ENDPOINTS
// ============================================
router.get('/leads', (req, res) => {
  res.json({ total: leads.length, leads: leads.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) });
});

router.get('/config', (req, res) => {
  res.json(config);
});

router.post('/config', (req, res) => {
  const { provider, model, temperature, maxTokens, greeting, enabled } = req.body;
  if (provider) config.provider = provider;
  if (model) config.model = model;
  if (temperature !== undefined) config.temperature = temperature;
  if (maxTokens) config.maxTokens = maxTokens;
  if (greeting) config.greeting = greeting;
  if (enabled !== undefined) config.enabled = enabled;
  res.json({ success: true, config });
});

router.get('/stats', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const todayChats = chatLogs.filter(l => l.timestamp.startsWith(today));
  const uniqueSessions = [...new Set(chatLogs.map(l => l.sessionId))];
  const todaySessions = [...new Set(todayChats.map(l => l.sessionId))];

  res.json({
    totalChats: chatLogs.length,
    totalLeads: leads.length,
    totalSessions: uniqueSessions.length,
    today: {
      chats: todayChats.length,
      sessions: todaySessions.length,
      leads: leads.filter(l => l.timestamp.startsWith(today)).length
    },
    currentConfig: {
      provider: config.provider,
      model: config.model,
      enabled: config.enabled
    },
    recentChats: chatLogs.slice(-20).reverse()
  });
});

router.delete('/leads/:index', (req, res) => {
  const idx = parseInt(req.params.index);
  if (idx >= 0 && idx < leads.length) {
    leads.splice(idx, 1);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Lead not found' });
  }
});

module.exports = router;
