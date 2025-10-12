#!/usr/bin/env node
/*
  Simple helper to create an admin user. Usage:
    node src/bin/create_user.js --username alice --password secret --email alice@example.com --name "Alice" --role admin

  It uses bcrypt to hash the password and inserts into the users table.
*/
const { initPgPool } = require('../../src/config/postgres');
const bcrypt = require('bcrypt');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = args[i+1];
      out[key] = val;
      i++;
    }
  }
  return out;
}

(async function main(){
  const argv = parseArgs();
  const username = argv.username;
  const password = argv.password;
  const email = argv.email || null;
  const name = argv.name || null;
  const role = argv.role || 'admin';

  if (!username || !password) {
    console.error('username and password are required.');
    process.exit(2);
  }

  try {
    const pool = await initPgPool();
    if (!pool) throw new Error('Failed to init pg pool');
    const hash = await bcrypt.hash(String(password), 10);
    const sql = `INSERT INTO users (username, email, password_hash, name, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, name, role, created_at`;
    const res = await pool.query(sql, [String(username), email, hash, name, role]);
    console.log('Created user:', res.rows[0]);
    process.exit(0);
  } catch (err) {
    console.error('Failed to create user:', err && err.message);
    process.exit(1);
  }
})();
