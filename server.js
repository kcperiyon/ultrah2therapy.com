require("dotenv").config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// API Routes
app.use('/api/ada', require('./api/ada'));
app.use('/api/ada/training', require('./api/training'));
app.use('/api/affiliate', require('./api/affiliate'));
app.use('/api/contact', require('./api/contact'));

// Super Admin
app.get('/super-admin', (req, res) => res.sendFile(path.join(__dirname, 'super-admin.html')));

// Affiliate registration page
app.get('/affiliate', (req, res) => res.sendFile(path.join(__dirname, 'affiliate.html')));
app.get('/affiliate-portal', (req, res) => res.sendFile(path.join(__dirname, 'affiliate-portal.html')));
app.get('/checkout', (req, res) => res.sendFile(path.join(__dirname, 'checkout.html')));

// Catch-all: serve index.html
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 36315;
app.listen(PORT, () => {
  console.log('');
  console.log('=============================================');
  console.log('  ULTRAH2 FULL SYSTEM RUNNING');
  console.log('=============================================');
  console.log(`  Website:     http://localhost:${PORT}`);
  console.log(`  Ada Chat:    http://localhost:${PORT}/api/ada/chat`);
  console.log(`  Affiliate:   http://localhost:${PORT}/api/affiliate`);
  console.log(`  Contact:     http://localhost:${PORT}/api/contact`);
  console.log(`  Super Admin: http://localhost:${PORT}/super-admin`);
  console.log('=============================================');
  console.log('');
});
