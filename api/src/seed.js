import bcrypt from 'bcryptjs';
import { pool } from './db.js';

// Idempotent: the .env values are the source of truth for the seeded user.
export async function seed() {
  const username = process.env.SEED_USERNAME;
  const password = process.env.SEED_PASSWORD;
  if (!username || !password) {
    console.warn('[seed] SEED_USERNAME/SEED_PASSWORD not set, skipping');
    return;
  }
  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users (username, password_hash) VALUES ($1, $2)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [username, hash]
  );
  console.log(`[seed] user ready: ${username}`);
}
