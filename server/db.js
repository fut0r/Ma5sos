import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

export const db = new DatabaseSync(config.dbFile);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

const MIGRATIONS = [
  `CREATE TABLE users (
     id            INTEGER PRIMARY KEY,
     name          TEXT NOT NULL,
     phone         TEXT NOT NULL UNIQUE,          -- +9665XXXXXXXX
     password_hash TEXT NOT NULL,
     created_at    TEXT NOT NULL DEFAULT (datetime('now'))
   );

   CREATE TABLE sessions (
     id         TEXT PRIMARY KEY,                  -- SHA-256 of the cookie value
     user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     created_at TEXT NOT NULL DEFAULT (datetime('now')),
     expires_at TEXT NOT NULL
   );
   CREATE INDEX sessions_user ON sessions(user_id);

   CREATE TABLE orders (
     id             INTEGER PRIMARY KEY,
     order_number   TEXT NOT NULL UNIQUE,
     user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     plan_id        TEXT NOT NULL,
     amount         REAL NOT NULL,
     status         TEXT NOT NULL,
     transaction_no TEXT,
     payment_url    TEXT,
     payment_method TEXT,
     created_at     TEXT NOT NULL DEFAULT (datetime('now')),
     paid_at        TEXT
   );
   CREATE INDEX orders_user ON orders(user_id);`,

  `CREATE TABLE IF NOT EXISTS events (
     id              INTEGER PRIMARY KEY AUTOINCREMENT,
     title           TEXT NOT NULL,
     occasion_type   TEXT NOT NULL DEFAULT 'wedding',
     host_name       TEXT NOT NULL,
     honoree_name    TEXT,
     event_date      TEXT NOT NULL,
     event_time      TEXT DEFAULT '8:30 مساءً',
     venue_name      TEXT NOT NULL,
     venue_address   TEXT,
     location_url    TEXT,
     description     TEXT,
     notes           TEXT,
     template_id     TEXT NOT NULL DEFAULT 'andalusian',
     share_code      TEXT NOT NULL UNIQUE,
     is_public       INTEGER DEFAULT 1,
     max_guests      INTEGER DEFAULT 100,
     created_at      TEXT NOT NULL DEFAULT (datetime('now')),
     updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
   );

   CREATE TABLE IF NOT EXISTS rsvps (
     id              INTEGER PRIMARY KEY AUTOINCREMENT,
     event_id        INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
     guest_name      TEXT NOT NULL,
     phone           TEXT,
     status          TEXT NOT NULL DEFAULT 'pending',
     companion_count INTEGER DEFAULT 0,
     notes           TEXT,
     qr_token        TEXT,
     invite_token    TEXT,
     checked_in      INTEGER DEFAULT 0,
     checked_in_at   TEXT,
     created_at      TEXT NOT NULL DEFAULT (datetime('now')),
     updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
   );
   CREATE INDEX IF NOT EXISTS idx_events_share_code ON events(share_code);
   CREATE INDEX IF NOT EXISTS idx_rsvps_event_id ON rsvps(event_id);`,

  `ALTER TABLE events ADD COLUMN user_id INTEGER REFERENCES users(id);
   CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);`,
];

db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)');
const current = db.prepare('SELECT version FROM schema_version').get()?.version ?? 0;
if (current === 0) db.exec('INSERT INTO schema_version (version) VALUES (0)');

for (let step = current; step < MIGRATIONS.length; step++) {
  db.exec('BEGIN');
  try {
    db.exec(MIGRATIONS[step]);
    db.prepare('UPDATE schema_version SET version = ?').run(step + 1);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

try {
  db.exec('ALTER TABLE rsvps ADD COLUMN invite_token TEXT');
} catch {
  /* column already exists */
}

// Seed default demo event if not present
try {
  const eventCount = db.prepare('SELECT COUNT(*) AS count FROM events').get()?.count ?? 0;
  if (eventCount === 0) {
    const demoDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const result = db.prepare(`
      INSERT INTO events (title, occasion_type, host_name, honoree_name, event_date, event_time, venue_name, venue_address, location_url, description, notes, template_id, share_code, is_public, max_guests)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'حفل زفاف فيصل بن عبدالله',
      'wedding',
      'عبدالله بن عبدالعزيز القحطاني',
      'فيصل',
      demoDate,
      '8:30 مساءً',
      'قاعة ليلتي للاحتفالات، الرياض',
      'حي النرجس، طريق الملك سلمان',
      'https://maps.google.com/?q=24.8456,46.6853',
      'يتشرف عبدالله بن عبدالعزيز القحطاني بدعوتكم لحضور حفل زفاف ابنه فيصل، وبحضوركم تكتمل بهجتنا وفرحتنا.',
      'جنة الأطفال منازلهم · نرجو إبراز رمز QR عند المدخل',
      'andalusian',
      'MK-DEMO-2026',
      1,
      150,
    );
    const eventId = Number(result.lastInsertRowid);
    const inviteToken = randomBytes(18).toString('base64url');
    db.prepare(`
      INSERT INTO rsvps (event_id, guest_name, phone, status, companion_count, notes, qr_token, invite_token, checked_in)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(eventId, 'سلطان الحربي', '+966501112233', 'confirmed', 1, 'ألف مبروك وبالرفاه والبنين', 'QR-DEMO-SULTAN', inviteToken, 0);
  }
} catch (e) {
  console.warn('[Ma5sos SQLite Seed Warning]:', e.message);
}
