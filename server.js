const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Database setup
const db = new Database(path.join(__dirname, 'pronostics.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS pronostics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prenom TEXT NOT NULL,
    contact TEXT NOT NULL,
    contact_type TEXT NOT NULL CHECK(contact_type IN ('phone', 'email')),
    score_hbpc INTEGER NOT NULL CHECK(score_hbpc >= 0 AND score_hbpc <= 50),
    score_metz INTEGER NOT NULL CHECK(score_metz >= 0 AND score_metz <= 50),
    meilleure_joueuse TEXT,
    accepted_rules INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    device_id TEXT
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_contact ON pronostics(contact);
`);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API: Submit pronostic
app.post('/api/pronostic', (req, res) => {
  const { prenom, contact, contact_type, score_hbpc, score_metz, meilleure_joueuse, device_id } = req.body;

  // Validation
  if (!prenom || !prenom.trim()) {
    return res.status(400).json({ error: 'Le prénom est obligatoire.' });
  }
  if (!contact || !contact.trim()) {
    return res.status(400).json({ error: 'Un numéro de téléphone ou email est obligatoire.' });
  }
  if (!contact_type || !['phone', 'email'].includes(contact_type)) {
    return res.status(400).json({ error: 'Type de contact invalide.' });
  }

  // Validate contact format
  const trimmedContact = contact.trim();
  if (contact_type === 'email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedContact)) {
      return res.status(400).json({ error: 'Format d\'email invalide.' });
    }
  } else {
    const phoneRegex = /^[\d\s+()-]{8,20}$/;
    if (!phoneRegex.test(trimmedContact)) {
      return res.status(400).json({ error: 'Format de numéro invalide.' });
    }
  }

  const scoreHbpc = parseInt(score_hbpc);
  const scoreMetz = parseInt(score_metz);
  if (isNaN(scoreHbpc) || scoreHbpc < 0 || scoreHbpc > 50) {
    return res.status(400).json({ error: 'Score HBPC invalide (0-50).' });
  }
  if (isNaN(scoreMetz) || scoreMetz < 0 || scoreMetz > 50) {
    return res.status(400).json({ error: 'Score METZ invalide (0-50).' });
  }

  // Check if contact already used
  const existing = db.prepare('SELECT id FROM pronostics WHERE contact = ?').get(trimmedContact);
  if (existing) {
    return res.status(409).json({ error: 'Ce contact a déjà été utilisé pour un pronostic.' });
  }

  // Insert
  try {
    const stmt = db.prepare(`
      INSERT INTO pronostics (prenom, contact, contact_type, score_hbpc, score_metz, meilleure_joueuse, device_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      prenom.trim(),
      trimmedContact,
      contact_type,
      scoreHbpc,
      scoreMetz,
      meilleure_joueuse ? meilleure_joueuse.trim() : null,
      device_id || null
    );

    const count = db.prepare('SELECT COUNT(*) as total FROM pronostics').get();

    res.json({ success: true, total: count.total });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Ce contact a déjà été utilisé pour un pronostic.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// API: Get total count
app.get('/api/count', (req, res) => {
  const count = db.prepare('SELECT COUNT(*) as total FROM pronostics').get();
  res.json({ total: count.total });
});

// API: Admin - list all pronostics
app.get('/api/admin/pronostics', (req, res) => {
  const rows = db.prepare('SELECT * FROM pronostics ORDER BY created_at DESC').all();
  res.json(rows);
});

// Health check for keep-alive
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Fallback to index
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🦁 LA GRIFFE D'OR - Serveur démarré sur http://localhost:${PORT}`);

  // Keep-alive: ping self every 5 min to prevent Render free tier sleep
  const externalUrl = process.env.RENDER_EXTERNAL_URL || 'https://griffe-dor-hbpc.onrender.com';
  if (process.env.RENDER || process.env.RENDER_EXTERNAL_URL) {
    setInterval(() => {
      fetch(externalUrl + '/api/health').catch(() => {});
    }, 5 * 60 * 1000);
    console.log('🔄 Keep-alive activé — ping toutes les 5 min sur ' + externalUrl);
  }
});
