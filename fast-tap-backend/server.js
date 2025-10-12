const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const redis = require('redis');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Postgres setup moved to config module (reads POSTGRES_URL or individual POSTGRES_* env vars)
const { initPgPool, getPgPool } = require('./src/config/postgres');
let pgPool = null;

// QR generator
const QRCode = require('qrcode');
const nodemailer = require('nodemailer');
const bwipjs = require('bwip-js');

// Try to initialize Postgres pool with retries. If Postgres is not yet ready
// at container startup, this will keep attempting so the backend can recover
// without requiring a container restart.
async function tryInitPgPool(retries = 10, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const p = await initPgPool();
      if (p) {
        pgPool = p;
        console.log('Postgres pool initialized');
        return true;
      }
      console.warn(`Postgres pool test failed (attempt ${i + 1}/${retries})`);
    } catch (e) {
      console.warn('Postgres init error (attempt):', e && e.message);
    }
    // wait before next attempt
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

// Kick off initial attempts in the background. If it fails after the
// configured retries, keep trying every 30s until successful.
(async () => {
  try {
    const ok = await tryInitPgPool(10, 2000);
    if (!ok) {
      console.warn('Initial Postgres init attempts failed; will retry in background every 30s');
      const interval = setInterval(async () => {
        if (!pgPool) {
          try {
            const p = await initPgPool();
            if (p) {
              pgPool = p;
              console.log('Postgres pool initialized on background retry');
              clearInterval(interval);
            } else {
              console.warn('Background retry: Postgres still not available');
            }
          } catch (e) {
            console.warn('Background retry error:', e && e.message);
          }
        } else {
          clearInterval(interval);
        }
      }, 30000);
    }
  } catch (err) {
    console.warn('Postgres init failed (outer):', err && err.message);
    pgPool = null;
  }
})();

// Redis Client Setup (only enabled when ENABLE_REDIS=true)
let redisClient = null;
const enableRedis = (process.env.ENABLE_REDIS || 'false').toLowerCase() === 'true';
if (enableRedis) {
  redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
    }
  });

  // Connect to Redis
  redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  redisClient.on('connect', () => {
    console.log('Connected to Redis');
  });

  // Initialize Redis connection
  (async () => {
    try {
      await redisClient.connect();
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      // If connect fails, disable redis usage to fall back to in-memory
      try { await redisClient.quit(); } catch (e) {}
      redisClient = null;
    }
  })();
} else {
  console.log('Redis disabled (ENABLE_REDIS!=true). Using in-memory storage fallback.');
}

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Socket.IO setup with CORS
const io = socketIo(server, {
  cors: corsOptions
});

// Import game logic
const GameManager = require('./src/gameManager');
const gameManager = new GameManager(redisClient);
// Split: import email and socket handler modules
const { sendVerificationEmail, registerResendEndpoint } = require('./src/email');
const registerSocketHandlers = require('./src/socketHandlers');

// Routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    redis: redisClient && redisClient.isOpen ? 'connected' : 'disabled'
  });
});

// Internal-only runtime config endpoint (safe — does NOT return secrets)
app.get('/api/config', (req, res) => {
  try {
    const cfg = {
      maxPlayersPerRoom: parseInt(process.env.MAX_PLAYERS_PER_ROOM, 10) || 10,
      enableRedis: enableRedis === true,
      redisConnected: !!(redisClient && redisClient.isOpen),
      corsOrigin: process.env.CORS_ORIGIN || null,
      nodeEnv: process.env.NODE_ENV || 'development',
      port: process.env.PORT || 5000,
      storage: gameManager && typeof gameManager.useMemory !== 'undefined' ? (gameManager.useMemory ? 'memory' : 'redis') : 'unknown'
    };
    res.json(cfg);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read config' });
  }
});

app.get('/api/rooms', async (req, res) => {
  try {
    const rooms = await gameManager.getAllRooms();
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// Registrants admin endpoints
// Note: these endpoints do not implement authentication. Run in a trusted network or add auth.
app.get('/api/admin/registrants', async (req, res) => {
  if (!pgPool) return res.status(503).json({ error: 'Postgres not configured' });
  try {
    const sql = `
      SELECT r.id, r.name, r.gacha_code, r.email, r.is_win, r.is_verified, r.is_send_email, r.bureau, r.created_at,
        COALESCE(gwagg.gifts, '[]') AS gifts
      FROM registrants r
      LEFT JOIN (
        SELECT gw.registrant_id, json_agg(json_build_object('gift_id', g.id, 'name', g.name) ORDER BY gw.date_awarded) AS gifts
        FROM gift_winners gw
        JOIN gift g ON g.id = gw.gift_id
        GROUP BY gw.registrant_id
      ) gwagg ON gwagg.registrant_id = r.id
      ORDER BY r.id DESC
      LIMIT 1000
    `;
    const result = await pgPool.query(sql);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching registrants', err && err.message);
    res.status(500).json({ error: 'Failed to fetch registrants' });
  }
});

// Helper to generate gacha code (alphanumeric, 12 chars)
function generateGachaCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < 12; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

// Generate a random verification code (URL-safe)
function generateVerificationCode(len = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// Build gacha code when registrant is verified.
// Format: <BUREAU_FIRST4><YEAR>-<10_DIGIT_RANDOM>
function buildGachaCode(bureau) {
  const year = new Date().getFullYear();
  const normalized = String(bureau || '').replace(/\s+/g, '').toUpperCase();
  const prefix = (normalized.substring(0,4) || 'GENR').padEnd(4, 'X');
  const rand = Math.floor(Math.random() * 1e10).toString().padStart(10, '0');
  return `${prefix}${year}-${rand}`;
}

// Create a verification code for a registrant. Returns { code }
app.post('/api/admin/registrants/:id/generate-code', async (req, res) => {
  if (!pgPool) return res.status(503).json({ error: 'Postgres not configured' });
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    // ensure registrant exists
    const r = await pgPool.query('SELECT id, is_verified FROM registrants WHERE id = $1', [id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Registrant not found' });

    // generate a code and insert
    const code = generateVerificationCode(32);
    const insertSql = 'INSERT INTO verification_codes (code, registrant_id) VALUES ($1, $2) RETURNING code, date_created';
    const result = await pgPool.query(insertSql, [code, id]);
    const created = result.rows[0];

    // Return a relative path that can be turned into a QR redirect on the frontend
    return res.json({ code: created.code, verifyPath: `/registrations/verify/${created.code}` });
  } catch (err) {
    console.error('Error generating verification code', err && err.message);
    res.status(500).json({ error: 'Failed to generate verification code' });
  }
});

  // Public generator endpoint: create an unassigned verification code (no registrant_id).
  // Scanners can point to a QR that hits this generator, which redirects users to
  // `/registrations/verify/{code}` where they pick their name and enter email.
  app.post('/api/registrations/generate', async (req, res) => {
    if (!pgPool) return res.status(503).json({ error: 'Postgres not configured' });
    try {
      const code = generateVerificationCode(32);
      const insertSql = 'INSERT INTO verification_codes (code) VALUES ($1) RETURNING code, date_created';
      const result = await pgPool.query(insertSql, [code]);
      const created = result.rows[0];
      return res.json({ code: created.code, verifyPath: `/registrations/verify/${created.code}` });
    } catch (err) {
      console.error('Error generating public verification code', err && err.message);
      res.status(500).json({ error: 'Failed to generate verification code' });
    }
  });

  // Public endpoint: list unverified registrants (basic fields) so scanners can pick their name
  app.get('/api/registrants/unverified', async (req, res) => {
    if (!pgPool) return res.status(503).json({ error: 'Postgres not configured' });
    try {
      const result = await pgPool.query('SELECT id, name, bureau, gacha_code FROM registrants WHERE is_verified = $1 ORDER BY name ASC LIMIT 1000', ['N']);
      res.json(result.rows);
    } catch (err) {
      console.error('Error fetching unverified registrants', err && err.message);
      res.status(500).json({ error: 'Failed to fetch registrants' });
    }
  });

// Verify a code (single-use, 15-minute TTL). Expects { email } in body to set registrant email.
app.post('/api/registrations/verify', async (req, res) => {
  if (!pgPool) return res.status(503).json({ error: 'Postgres not configured' });
  try {
    const { code, email, registrant_id } = req.body || {};
    if (!code) return res.status(400).json({ error: 'Code required' });

    // Transactional check + mark used + set registrant email + set is_verified
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      const q = 'SELECT id, registrant_id, date_created, is_used FROM verification_codes WHERE code = $1 FOR UPDATE';
      const qr = await client.query(q, [code]);
      if (qr.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Code not found' });
      }
      const row = qr.rows[0];
      if (row.is_used === 'Y') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Code already used' });
      }

      const createdAt = new Date(row.date_created);
      const ageMs = Date.now() - createdAt.getTime();
      if (ageMs > 15 * 60 * 1000) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Code expired' });
      }

      // Determine the target registrant. If the code is unassigned (registrant_id NULL),
      // require registrant_id provided in the body.
      let targetRegistrantId = row.registrant_id;
      if (!targetRegistrantId) {
        if (!registrant_id) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Registrant id required for this code' });
        }
        // validate registrant exists and is not already verified
        const rcheck = await client.query('SELECT id, is_verified FROM registrants WHERE id = $1 FOR UPDATE', [registrant_id]);
        if (rcheck.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Registrant not found' });
        }
        if (rcheck.rows[0].is_verified === 'Y') {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Registrant already verified' });
        }
        targetRegistrantId = registrant_id;
      }

      // mark code as used
      await client.query('UPDATE verification_codes SET is_used = $1 WHERE id = $2', ['Y', row.id]);

      // set registrant email if provided and set is_verified to 'Y'
      // Also generate a gacha_code on verification if not already present.
      // Try to generate a unique gacha_code up to a few attempts.
      const rinfo = await client.query('SELECT id, bureau, gacha_code FROM registrants WHERE id = $1 FOR UPDATE', [targetRegistrantId]);
      const registrant = rinfo.rows[0];
      let attempts = 0;
      if (!registrant.gacha_code) {
        while (attempts < 5) {
          const code = buildGachaCode(registrant.bureau || 'GENR');
          try {
            await client.query('UPDATE registrants SET gacha_code = $1, email = COALESCE($2, email), is_verified = $3 WHERE id = $4', [code, email, 'Y', targetRegistrantId]);
            break;
          } catch (err) {
            // Unique constraint conflict, retry
            if (err && err.code === '23505') {
              attempts++;
              continue;
            }
            throw err;
          }
        }
        if (attempts >= 5) {
          await client.query('ROLLBACK');
          return res.status(500).json({ error: 'Failed to generate unique gacha_code' });
        }
      } else {
        // already has code; just update email and verified flag
        if (email) {
          await client.query('UPDATE registrants SET email = $1, is_verified = $2 WHERE id = $3', [email, 'Y', targetRegistrantId]);
        } else {
          await client.query('UPDATE registrants SET is_verified = $1 WHERE id = $2', ['Y', targetRegistrantId]);
        }
      }

      await client.query('COMMIT');
      res.json({ success: true, registrant_id: targetRegistrantId });

      // Send verification email asynchronously (don't block response)
      (async () => {
        try {
          await sendVerificationEmail(() => pgPool, targetRegistrantId);
        } catch (err) {
          console.error('Failed to send verification email:', err && err.message);
        }
      })();
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error verifying code', err && err.message);
    res.status(500).json({ error: 'Failed to verify code' });
  }
});

app.post('/api/admin/registrants', async (req, res) => {
  if (!pgPool) return res.status(503).json({ error: 'Postgres not configured' });
  try {
    const { name, email = null, bureau = null } = req.body || {};
    if (!name || String(name).trim().length === 0) return res.status(400).json({ error: 'Name required' });

    // Insert registrant without a gacha_code. The gacha_code will be generated
    // later during verification to ensure codes are only created after a
    // successful verification.
    const insertSql = `
      INSERT INTO registrants (name, gacha_code, email, bureau)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, gacha_code, email, is_win, is_verified, is_send_email, bureau, created_at
    `;
    const vals = [String(name).trim(), null, email, bureau];
    const result = await pgPool.query(insertSql, vals);
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating registrant', err && err.message);
    res.status(500).json({ error: 'Failed to create registrant' });
  }
});

app.patch('/api/admin/registrants/:id', async (req, res) => {
  if (!pgPool) return res.status(503).json({ error: 'Postgres not configured' });
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    // Admin is not allowed to change is_win or is_verified via this endpoint.
    // These fields are managed by the raffle/winner workflow and must not
    // be updated manually through the admin UI.
    if (Object.prototype.hasOwnProperty.call(req.body, 'is_win') || Object.prototype.hasOwnProperty.call(req.body, 'is_verified')) {
      return res.status(403).json({ error: 'Updating is_win or is_verified is not allowed' });
    }
    const allowed = ['name', 'email', 'is_send_email', 'bureau'];
    const updates = [];
    const values = [];
    let idx = 1;
      for (const k of allowed) {
        if (Object.prototype.hasOwnProperty.call(req.body, k)) {
          updates.push(`${k} = $${idx}`);
          values.push(req.body[k]);
          idx++;
        }
      }

      values.push(id);
      const sql = `UPDATE registrants SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, name, gacha_code, email, is_win, is_verified, is_send_email, bureau, created_at`;
      const result = await pgPool.query(sql, values);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Registrant not found' });
      res.json(result.rows[0]);
    } catch (err) {
      console.error('Error updating registrant', err && err.message);
      res.status(500).json({ error: 'Failed to update registrant' });
    }
  });

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  try {
    if (redisClient && redisClient.isOpen) await redisClient.quit();
  } catch (err) {
    console.warn('Error quitting Redis client on SIGTERM:', err && err.message);
  }
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  try {
    if (redisClient && redisClient.isOpen) await redisClient.quit();
  } catch (err) {
    console.warn('Error quitting Redis client on SIGINT:', err && err.message);
  }
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

// Gifts CRUD for admin
app.get('/api/admin/gifts', async (req, res) => {
  if (!pgPool) return res.status(503).json({ error: 'Postgres not configured' });
  try {
    const result = await pgPool.query('SELECT id, name, description, quantity, gift_category_id, created_at FROM gift ORDER BY id DESC LIMIT 1000');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching gifts', err && err.message);
    res.status(500).json({ error: 'Failed to fetch gifts' });
  }
});

app.post('/api/admin/gifts', async (req, res) => {
  if (!pgPool) return res.status(503).json({ error: 'Postgres not configured' });
  try {
    const { name, description = null, quantity = 0, gift_category_id = null } = req.body || {};
    if (!name || String(name).trim().length === 0) return res.status(400).json({ error: 'Name required' });
    const insertSql = `INSERT INTO gift (name, description, quantity, gift_category_id) VALUES ($1, $2, $3, $4) RETURNING id, name, description, quantity, gift_category_id, created_at`;
    const result = await pgPool.query(insertSql, [String(name).trim(), description, Number(quantity) || 0, gift_category_id]);
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating gift', err && err.message);
    res.status(500).json({ error: 'Failed to create gift' });
  }
});

app.patch('/api/admin/gifts/:id', async (req, res) => {
  if (!pgPool) return res.status(503).json({ error: 'Postgres not configured' });
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const allowed = ['name', 'description', 'quantity', 'gift_category_id'];
    const updates = [];
    const values = [];
    let idx = 1;
    for (const k of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, k)) {
        updates.push(`${k} = $${idx}`);
        values.push(req.body[k]);
        idx++;
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(id);
    const sql = `UPDATE gift SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, name, description, quantity, gift_category_id, created_at`;
    const result = await pgPool.query(sql, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Gift not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating gift', err && err.message);
    res.status(500).json({ error: 'Failed to update gift' });
  }
});

app.delete('/api/admin/gifts/:id', async (req, res) => {
  if (!pgPool) return res.status(503).json({ error: 'Postgres not configured' });
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const result = await pgPool.query('DELETE FROM gift WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Gift not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting gift', err && err.message);
    res.status(500).json({ error: 'Failed to delete gift' });
  }
});

// Gift categories list
app.get('/api/admin/gift-categories', async (req, res) => {
  if (!pgPool) return res.status(503).json({ error: 'Postgres not configured' });
  try {
    const result = await pgPool.query('SELECT id, name, created_at FROM gift_categories ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching gift categories', err && err.message);
    res.status(500).json({ error: 'Failed to fetch gift categories' });
  }
});

// List winners per gift. Returns gifts that have winners with a comma-separated
// list of winners including their gacha_code.
app.get('/api/admin/winners', async (req, res) => {
  if (!pgPool) return res.status(503).json({ error: 'Postgres not configured' });
  try {
    const sql = `
      SELECT g.id AS gift_id,
             g.name AS gift_name,
             gc.name AS category_name,
             json_agg(
               json_build_object(
                 'name', r.name,
                 -- only reveal the gacha_code when the winner came from the gacha (is_assigned = 'N')
                 'gacha_code', CASE WHEN gw.is_assigned = 'N' THEN r.gacha_code ELSE NULL END,
                 'is_assigned', gw.is_assigned
               ) ORDER BY gw.date_awarded
             ) AS winners
      FROM gift_winners gw
      JOIN gift g ON gw.gift_id = g.id
      LEFT JOIN gift_categories gc ON g.gift_category_id = gc.id
      JOIN registrants r ON gw.registrant_id = r.id
      GROUP BY g.id, g.name, gc.name
      ORDER BY g.id
    `;
    const result = await pgPool.query(sql);
    res.json(result.rows.map(row => ({
      gift_id: row.gift_id,
      gift_name: row.gift_name,
      category_name: row.category_name,
      winners: row.winners || []
    })));
  } catch (err) {
    console.error('Error fetching winners', err && err.message);
    res.status(500).json({ error: 'Failed to fetch winners' });
  }
});

// List available gifts (those with remaining quantity > awarded count)
app.get('/api/admin/gifts/available', async (req, res) => {
  if (!pgPool) return res.status(503).json({ error: 'Postgres not configured' });
  try {
    const sql = `
      SELECT g.id, g.name, g.description, g.quantity, g.gift_category_id,
        COALESCE((SELECT COUNT(*) FROM gift_winners gw WHERE gw.gift_id = g.id), 0) AS awarded
      FROM gift g
      WHERE COALESCE((SELECT COUNT(*) FROM gift_winners gw WHERE gw.gift_id = g.id), 0) < g.quantity
      ORDER BY g.id
    `;
    const result = await pgPool.query(sql);
    res.json(result.rows.map(r => ({ id: r.id, name: r.name, description: r.description, quantity: r.quantity, awarded: Number(r.awarded), gift_category_id: r.gift_category_id })));
  } catch (err) {
    console.error('Error fetching available gifts', err && err.message);
    res.status(500).json({ error: 'Failed to fetch available gifts' });
  }
});

// Preview a random eligible registrant for a gift (does not persist)
app.post('/api/admin/gifts/:id/random-winner', async (req, res) => {
  if (!pgPool) return res.status(503).json({ error: 'Postgres not configured' });
  try {
    const giftId = parseInt(req.params.id, 10);
    if (Number.isNaN(giftId)) return res.status(400).json({ error: 'Invalid gift id' });

    // choose a random registrant who is verified and has not won yet
    const q = `SELECT id, name, gacha_code FROM registrants WHERE is_verified = $1 AND is_win = $2 AND gacha_code IS NOT NULL ORDER BY random() LIMIT 1`;
    const r = await pgPool.query(q, ['Y', 'N']);
    if (r.rows.length === 0) return res.status(404).json({ error: 'No eligible registrants found' });
    return res.json(r.rows[0]);
  } catch (err) {
    console.error('Error selecting random winner', err && err.message);
    res.status(500).json({ error: 'Failed to select random winner' });
  }
});

// Save a winner transactionally: insert into gift_winners and mark registrant is_win = 'Y'
app.post('/api/admin/gifts/:id/save-winner', async (req, res) => {
  if (!pgPool) return res.status(503).json({ error: 'Postgres not configured' });
  const giftId = parseInt(req.params.id, 10);
  const { registrant_id } = req.body || {};
  if (Number.isNaN(giftId)) return res.status(400).json({ error: 'Invalid gift id' });
  if (!registrant_id) return res.status(400).json({ error: 'registrant_id is required' });

  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');

    // Ensure gift has remaining quantity
    const giftRes = await client.query('SELECT id, quantity, (SELECT COUNT(*) FROM gift_winners gw WHERE gw.gift_id = $1) AS awarded FROM gift WHERE id = $1 FOR UPDATE', [giftId]);
    if (giftRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Gift not found' });
    }
    const gift = giftRes.rows[0];
    if (Number(gift.awarded) >= Number(gift.quantity)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Gift already fully awarded' });
    }

    // Ensure registrant exists and hasn't won
    const regRes = await client.query('SELECT id, is_win FROM registrants WHERE id = $1 FOR UPDATE', [registrant_id]);
    if (regRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Registrant not found' });
    }
    if (regRes.rows[0].is_win === 'Y') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Registrant already marked as winner' });
    }

    // Insert winner and mark registrant
    await client.query('INSERT INTO gift_winners (registrant_id, gift_id) VALUES ($1, $2)', [registrant_id, giftId]);
    await client.query("UPDATE registrants SET is_win = 'Y' WHERE id = $1", [registrant_id]);

    await client.query('COMMIT');
    return res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error saving winner', err && err.message);
    return res.status(500).json({ error: 'Failed to save winner' });
  } finally {
    client.release();
  }
});

// QR generation endpoint (PNG). Query param: data (required). Optional size (px).
app.get('/api/qr', async (req, res) => {
  const data = String(req.query.data || '');
  const size = parseInt(req.query.size || '400', 10) || 400;
  if (!data) return res.status(400).json({ error: 'Missing data query param' });
  try {
    // Use toBuffer to produce a PNG image buffer
    const opts = { type: 'png', width: size, margin: 1 };
    const buffer = await QRCode.toBuffer(data, opts);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
  } catch (err) {
    console.error('QR generation failed', err && err.message);
    res.status(500).json({ error: 'Failed to generate QR' });
  }
});

// Assign a gift manually to a registrant without consuming is_win (marks is_assigned = 'Y')
app.post('/api/admin/gifts/:id/assign', async (req, res) => {
  if (!pgPool) return res.status(503).json({ error: 'Postgres not configured' });
  const giftId = parseInt(req.params.id, 10);
  const { registrant_id } = req.body || {};
  if (Number.isNaN(giftId)) return res.status(400).json({ error: 'Invalid gift id' });
  if (!registrant_id) return res.status(400).json({ error: 'registrant_id is required' });

  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    // lock gift row to avoid races
    const gRes = await client.query('SELECT id, quantity FROM gift WHERE id = $1 FOR UPDATE', [giftId]);
    if (gRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Gift not found' });
    }

    const qty = gRes.rows[0].quantity || 0;
    const awardedRes = await client.query('SELECT COUNT(*) AS cnt FROM gift_winners WHERE gift_id = $1', [giftId]);
    const awardedCount = parseInt(awardedRes.rows[0].cnt, 10) || 0;
    if (awardedCount >= qty) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No remaining quantity for this gift' });
    }

    // ensure registrant exists
    const rRes = await client.query('SELECT id FROM registrants WHERE id = $1', [registrant_id]);
    if (rRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Registrant not found' });
    }

    // allow multiple assignments of the same gift to the same registrant (no unique constraint)

    const insertSql = `INSERT INTO gift_winners (registrant_id, gift_id, is_assigned) VALUES ($1, $2, 'Y') RETURNING id, registrant_id, gift_id, date_awarded, is_assigned`;
    const ir = await client.query(insertSql, [registrant_id, giftId]);
    await client.query('COMMIT');

    return res.json(ir.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error assigning gift', err && err.message);
    res.status(500).json({ error: 'Failed to assign gift' });
  } finally {
    client.release();
  }
});

// Register resend endpoint and socket handlers from extracted modules
registerResendEndpoint(app, () => pgPool);
registerSocketHandlers(io, gameManager);