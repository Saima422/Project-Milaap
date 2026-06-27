const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const BOOTH_ID = process.env.BOOTH_ID || 'Booth-A';
const DB_FILE = path.join(__dirname, `kumbh-${BOOTH_ID}.db`);
const CSV_FILE = path.join(
  __dirname,
  '../../claude-impact-lab-mumbai-2026/data/Synthetic_Missing_Persons_2500.csv'
);

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

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

// Maps age_band midpoint to a representative integer age
const AGE_BAND_MID = {
  '0-12': 6,
  '13-17': 15,
  '18-40': 29,
  '41-60': 50,
  '61-70': 65,
  '71-80': 75,
  '80+': 82,
};

// Maps CSV status → DB status
const STATUS_MAP = {
  'Reunited': 'reunified',
  'Pending': 'searching',
  'Transferred to hospital': 'transferred',
  'Unresolved': 'unresolved',
};

const insert = db.prepare(`
  INSERT OR IGNORE INTO cases
    (case_id, case_type, wristband_id, name, age, gender, language, zone,
     photo_base64, contact_number, status, booth_id, last_updated, created_at)
  VALUES
    (@case_id, @case_type, @wristband_id, @name, @age, @gender, @language, @zone,
     @photo_base64, @contact_number, @status, @booth_id, @last_updated, @created_at)
`);

const content = fs.readFileSync(CSV_FILE, 'utf8');
const lines = content.split('\n').filter(l => l.trim());

// CSV columns (0-indexed):
// 0:case_id  1:reported_at  2:missing_person_name  3:gender  4:age_band
// 5:state    6:district      7:language             8:last_seen_location
// 9:reporting_center  10:reporter_mobile  11:physical_description
// 12:status  13:resolution_hours  14:is_duplicate_report  15:remarks

const importAll = db.transaction((rows) => {
  let inserted = 0;
  let skipped = 0;
  for (const row of rows) {
    const fields = parseCSVLine(row);
    if (fields.length < 13) { skipped++; continue; }

    const [
      case_id, reported_at, name, gender, age_band,
      state, district, language, last_seen_location,
      reporting_center, reporter_mobile, physical_description,
      csv_status,
    ] = fields;

    const ts = reported_at ? new Date(reported_at).getTime() : Date.now();

    insert.run({
      case_id,
      case_type: 'missing',
      wristband_id: null,
      name: name || '',
      age: AGE_BAND_MID[age_band] || null,
      gender: gender || '',
      language: language || '',
      zone: last_seen_location || '',
      photo_base64: '',
      contact_number: reporter_mobile || '',
      status: STATUS_MAP[csv_status] || 'searching',
      booth_id: reporting_center || BOOTH_ID,
      last_updated: ts,
      created_at: ts,
    });

    inserted++;
  }
  return { inserted, skipped };
});

const dataRows = lines.slice(1); // skip header
const { inserted, skipped } = importAll(dataRows);
console.log(`Done. Inserted: ${inserted}, Skipped (bad rows): ${skipped}`);
