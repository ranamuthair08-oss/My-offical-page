const express = require('express');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(express.json());

const keys = new Map();

function generateToken() {
  return 'sk_live_' + crypto.randomBytes(24).toString('base64url');
}

function sanitize(key) {
  return {
    id: key.id,
    name: key.name,
    tier: key.tier,
    status: key.status,
    masked: key.masked,
    createdAt: key.createdAt,
    revokedAt: key.revokedAt,
  };
}

function createKey({ name, tier }) {
  const token = generateToken();
  const id = token.slice('sk_live_'.length, 'sk_live_'.length + 8);
  const key = {
    id,
    token,
    name: name || 'Untitled',
    tier: tier || 'free',
    status: 'active',
    masked: token.slice(0, 12) + '...' + token.slice(-4),
    createdAt: new Date().toISOString(),
    revokedAt: null,
  };
  keys.set(id, key);
  return key;
}

function seedDemoKeys() {
  if (keys.size > 0) return;
  createKey({ name: 'Production bot', tier: 'pro' });
  createKey({ name: 'Staging bot', tier: 'free' });
  createKey({ name: 'Integration test', tier: 'free' });
}
seedDemoKeys();

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/keys', (req, res) => {
  const list = [...keys.values()]
    .map(sanitize)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ keys: list });
});

app.post('/api/keys', (req, res) => {
  const { name, tier } = req.body || {};
  const key = createKey({ name, tier });
  res.status(201).json({
    key: {
      id: key.id,
      name: key.name,
      tier: key.tier,
      status: key.status,
      token: key.token,
      masked: key.masked,
      createdAt: key.createdAt,
    },
  });
});

app.delete('/api/keys/:id', (req, res) => {
  const key = keys.get(req.params.id);
  if (!key) {
    return res.status(404).json({ error: 'Key not found' });
  }
  if (key.status === 'revoked') {
    return res.status(409).json({ error: 'Key already revoked' });
  }
  key.status = 'revoked';
  key.revokedAt = new Date().toISOString();
  res.json({ key: sanitize(key) });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

module.exports = app;

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Key management dashboard running at http://localhost:${port}`);
  });
}
