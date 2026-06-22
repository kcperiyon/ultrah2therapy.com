const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const TRAINING_FILE = path.join(__dirname, '..', 'ada-training.json');

const defaultTraining = {
  customInstructions: '',
  qaEntries: [],
  objectionHandlers: [],
  productUpdates: [],
  toneNotes: '',
  updatedAt: null
};

function loadTraining() {
  try {
    if (fs.existsSync(TRAINING_FILE)) {
      return JSON.parse(fs.readFileSync(TRAINING_FILE, 'utf8'));
    }
  } catch (e) { console.error('Training load error:', e.message); }
  return { ...defaultTraining };
}

function saveTraining(data) {
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(TRAINING_FILE, JSON.stringify(data, null, 2));
}

function buildTrainingPrompt() {
  const data = loadTraining();
  let additions = '';
  if (data.customInstructions) additions += '\n\n=== ADMIN CUSTOM INSTRUCTIONS ===\n' + data.customInstructions;
  if (data.toneNotes) additions += '\n\n=== TONE & STYLE NOTES ===\n' + data.toneNotes;
  if (data.qaEntries.length > 0) {
    additions += '\n\n=== TRAINED Q&A RESPONSES ===';
    data.qaEntries.forEach(qa => { additions += '\n\nQ: ' + qa.question + '\nA: ' + qa.answer; });
  }
  if (data.objectionHandlers.length > 0) {
    additions += '\n\n=== OBJECTION HANDLING ===';
    data.objectionHandlers.forEach(oh => { additions += '\n\nObjection: "' + oh.objection + '"\nResponse: ' + oh.response; });
  }
  if (data.productUpdates.length > 0) {
    additions += '\n\n=== PRODUCT UPDATES ===';
    data.productUpdates.forEach(pu => { additions += '\n\n' + pu.title + ': ' + pu.details; });
  }
  return additions;
}

router.get('/', (req, res) => res.json(loadTraining()));

router.post('/', (req, res) => {
  const { customInstructions, qaEntries, objectionHandlers, productUpdates, toneNotes } = req.body;
  const data = loadTraining();
  if (customInstructions !== undefined) data.customInstructions = customInstructions;
  if (qaEntries !== undefined) data.qaEntries = qaEntries;
  if (objectionHandlers !== undefined) data.objectionHandlers = objectionHandlers;
  if (productUpdates !== undefined) data.productUpdates = productUpdates;
  if (toneNotes !== undefined) data.toneNotes = toneNotes;
  saveTraining(data);
  res.json({ success: true, data });
});

router.post('/qa', (req, res) => {
  const { question, answer, category } = req.body;
  if (!question || !answer) return res.status(400).json({ error: 'Question and answer required' });
  const data = loadTraining();
  data.qaEntries.push({ id: Date.now().toString(), question, answer, category: category || 'general', createdAt: new Date().toISOString() });
  saveTraining(data);
  res.json({ success: true, total: data.qaEntries.length });
});

router.delete('/qa/:id', (req, res) => {
  const data = loadTraining();
  data.qaEntries = data.qaEntries.filter(q => q.id !== req.params.id);
  saveTraining(data);
  res.json({ success: true });
});

router.post('/objection', (req, res) => {
  const { objection, response } = req.body;
  if (!objection || !response) return res.status(400).json({ error: 'Both fields required' });
  const data = loadTraining();
  data.objectionHandlers.push({ id: Date.now().toString(), objection, response, createdAt: new Date().toISOString() });
  saveTraining(data);
  res.json({ success: true, total: data.objectionHandlers.length });
});

router.delete('/objection/:id', (req, res) => {
  const data = loadTraining();
  data.objectionHandlers = data.objectionHandlers.filter(o => o.id !== req.params.id);
  saveTraining(data);
  res.json({ success: true });
});

router.post('/product', (req, res) => {
  const { title, details } = req.body;
  if (!title || !details) return res.status(400).json({ error: 'Both fields required' });
  const data = loadTraining();
  data.productUpdates.push({ id: Date.now().toString(), title, details, createdAt: new Date().toISOString() });
  saveTraining(data);
  res.json({ success: true, total: data.productUpdates.length });
});

router.delete('/product/:id', (req, res) => {
  const data = loadTraining();
  data.productUpdates = data.productUpdates.filter(p => p.id !== req.params.id);
  saveTraining(data);
  res.json({ success: true });
});

module.exports = router;
module.exports.buildTrainingPrompt = buildTrainingPrompt;
