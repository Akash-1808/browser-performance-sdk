import { Pool } from 'pg';
import * as dotenv from 'dotenv'
dotenv.config()

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required')
}


export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,                  // max 10 connection in a pool
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
})

// Test the connection on startup
db.on('error', (err) => {
  console.error('Unexpected DB error', err)
})

export async function migrate(): Promise<void> {
  const client = await db.connect()
  try {

    console.log("Running migrations...")

    await client.query('BEGIN');
    await client.query(`CREATE EXTENSION IF NOT EXISTS timescaledb;`)

    // 1. Users Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email         TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );
    `)

    // 2 project table

    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
      id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
      name     TEXT NOT NULL,
      domain   TEXT NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
      );`)

    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        time        TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
        domain      TEXT             NOT NULL,
        project_id  TEXT             NOT NULL,
        session_id  UUID             NOT NULL,
        metric      TEXT             NOT NULL,
        value       DOUBLE PRECISION,
        meta        JSONB
      );
    `)

    // Convert to hypertable — this is what makes TimescaleDB fast
    await client.query(`
      SELECT create_hypertable('events', 'time', if_not_exists => TRUE);
    `)
    // Index for per-domain dashboard queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS events_domain_time
      ON events (domain, time DESC);
    `)
    // Index for per-session replay queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS events_session
      ON events (session_id, time ASC);
    `)

    await client.query('COMMIT');

    console.log("Migration complete")
  } catch (e) {
    console.error('Error in db: ', e)
  } finally {
    await client.query('ROLLBACK').catch(() => { })
    client.release()
  }
}