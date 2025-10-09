'use strict';

const { Pool } = require('pg');
let pool = null;

function initPgPool() {
  if (pool) return pool;
  const pgUrl = process.env.POSTGRES_URL || null;
  if (pgUrl) {
    pool = new Pool({ connectionString: pgUrl });
  } else {
    const user = process.env.POSTGRES_USER || 'ftuser';
    const password = process.env.POSTGRES_PASSWORD || 'ftpassword';
    const host = process.env.POSTGRES_HOST || 'postgres';
    const port = process.env.POSTGRES_PORT || 5432;
    const db = process.env.POSTGRES_DB || 'fasttap';
    const conn = `postgresql://${user}:${password}@${host}:${port}/${db}`;
    pool = new Pool({ connectionString: conn });
  }

  // test connection
  (async () => {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      console.log('Postgres pool connected');
    } catch (err) {
      console.warn('Postgres pool test failed:', err && err.message);
      try { await pool.end(); } catch (e) {}
      pool = null;
    }
  })();

  return pool;
}

function getPgPool() {
  return pool;
}

module.exports = { initPgPool, getPgPool };
