const Database = require('better-sqlite3');
const path = require('path');

const BOOTH_ID = process.env.BOOTH_ID || 'Booth-A';
const DB_FILE = path.join(__dirname, `kumbh-${BOOTH_ID}.db`);

const db = new Database(DB_FILE);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id TEXT UNIQUE,
    case_type TEXT,
    wristband_id TEXT,
    name TEXT,
    age INTEGER,
    gender TEXT,
    language TEXT,
    zone TEXT,
    photo_base64 TEXT,
    contact_number TEXT,
    status TEXT,
    booth_id TEXT,
    last_updated INTEGER,
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id TEXT UNIQUE,
    found_case_id TEXT,
    missing_case_id TEXT,
    confidence_score INTEGER,
    status TEXT,
    created_at INTEGER
  );
`);

function genId(prefix) {
  const ts = Date.now();
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `${prefix}-${ts}-${rand}`;
}

function insertCase(caseData) {
  const stmt = db.prepare(`
    INSERT INTO cases
      (case_id, case_type, wristband_id, name, age, gender, language, zone,
       photo_base64, contact_number, status, booth_id, last_updated, created_at)
    VALUES
      (@case_id, @case_type, @wristband_id, @name, @age, @gender, @language, @zone,
       @photo_base64, @contact_number, @status, @booth_id, @last_updated, @created_at)
  `);
  stmt.run(caseData);
  return getCaseById(caseData.case_id);
}

function getCaseByWristband(wristband_id) {
  return db.prepare('SELECT * FROM cases WHERE wristband_id = ?').get(wristband_id);
}

function getCaseById(case_id) {
  return db.prepare('SELECT * FROM cases WHERE case_id = ?').get(case_id);
}

function getAllCases() {
  return db.prepare('SELECT * FROM cases ORDER BY created_at DESC').all();
}

function updateCaseStatus(case_id, status) {
  db.prepare('UPDATE cases SET status = ?, last_updated = ? WHERE case_id = ?')
    .run(status, Date.now(), case_id);
}

function upsertCase(caseData) {
  const existing = getCaseById(caseData.case_id);
  if (!existing) {
    return insertCase(caseData);
  }
  if (caseData.last_updated > existing.last_updated) {
    db.prepare(`
      UPDATE cases SET
        case_type = @case_type, wristband_id = @wristband_id, name = @name,
        age = @age, gender = @gender, language = @language, zone = @zone,
        photo_base64 = @photo_base64, contact_number = @contact_number,
        status = @status, booth_id = @booth_id, last_updated = @last_updated
      WHERE case_id = @case_id
    `).run(caseData);
    return getCaseById(caseData.case_id);
  }
  return existing;
}

function insertMatch(matchData) {
  db.prepare(`
    INSERT INTO matches (match_id, found_case_id, missing_case_id, confidence_score, status, created_at)
    VALUES (@match_id, @found_case_id, @missing_case_id, @confidence_score, @status, @created_at)
  `).run(matchData);
  return db.prepare('SELECT * FROM matches WHERE match_id = ?').get(matchData.match_id);
}

const MATCH_JOIN_SQL = `
  SELECT
    m.*,
    fc.case_id AS fc_case_id, fc.case_type AS fc_case_type, fc.wristband_id AS fc_wristband_id,
    fc.name AS fc_name, fc.age AS fc_age, fc.gender AS fc_gender, fc.language AS fc_language,
    fc.zone AS fc_zone, fc.photo_base64 AS fc_photo_base64, fc.contact_number AS fc_contact_number,
    fc.status AS fc_status, fc.booth_id AS fc_booth_id, fc.created_at AS fc_created_at,
    mc.case_id AS mc_case_id, mc.case_type AS mc_case_type, mc.wristband_id AS mc_wristband_id,
    mc.name AS mc_name, mc.age AS mc_age, mc.gender AS mc_gender, mc.language AS mc_language,
    mc.zone AS mc_zone, mc.photo_base64 AS mc_photo_base64, mc.contact_number AS mc_contact_number,
    mc.status AS mc_status, mc.booth_id AS mc_booth_id, mc.created_at AS mc_created_at
  FROM matches m
  JOIN cases fc ON m.found_case_id = fc.case_id
  JOIN cases mc ON m.missing_case_id = mc.case_id
`;

function shapeMatch(row) {
  return {
    id: row.id,
    match_id: row.match_id,
    confidence_score: row.confidence_score,
    status: row.status,
    created_at: row.created_at,
    found_case: {
      case_id: row.fc_case_id, case_type: row.fc_case_type, wristband_id: row.fc_wristband_id,
      name: row.fc_name, age: row.fc_age, gender: row.fc_gender, language: row.fc_language,
      zone: row.fc_zone, photo_base64: row.fc_photo_base64, contact_number: row.fc_contact_number,
      status: row.fc_status, booth_id: row.fc_booth_id, created_at: row.fc_created_at,
    },
    missing_case: {
      case_id: row.mc_case_id, case_type: row.mc_case_type, wristband_id: row.mc_wristband_id,
      name: row.mc_name, age: row.mc_age, gender: row.mc_gender, language: row.mc_language,
      zone: row.mc_zone, photo_base64: row.mc_photo_base64, contact_number: row.mc_contact_number,
      status: row.mc_status, booth_id: row.mc_booth_id, created_at: row.mc_created_at,
    },
  };
}

function getAllMatches() {
  return db.prepare(MATCH_JOIN_SQL + ' ORDER BY m.created_at DESC').all().map(shapeMatch);
}

function getPendingMatches() {
  return db.prepare(MATCH_JOIN_SQL + " WHERE m.status = 'pending' ORDER BY m.created_at DESC").all().map(shapeMatch);
}

function updateMatchStatus(match_id, status) {
  db.prepare('UPDATE matches SET status = ? WHERE match_id = ?').run(status, match_id);
}

function matchExists(found_case_id, missing_case_id) {
  const row = db.prepare(
    'SELECT 1 FROM matches WHERE found_case_id = ? AND missing_case_id = ?'
  ).get(found_case_id, missing_case_id);
  return !!row;
}

module.exports = {
  db,
  genId,
  insertCase,
  getCaseByWristband,
  getCaseById,
  getAllCases,
  updateCaseStatus,
  upsertCase,
  insertMatch,
  getAllMatches,
  getPendingMatches,
  updateMatchStatus,
  matchExists,
};
