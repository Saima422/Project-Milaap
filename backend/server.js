const express = require('express');
const cors = require('cors');
const path = require('path');

const {
  genId,
  insertCase,
  getCaseByWristband,
  getCaseById,
  getAllCases,
  updateCaseStatus,
  upsertCase,
  getAllMatches,
  getPendingMatches,
  updateMatchStatus,
  db,
} = require('./database');
const { runFuzzyMatch } = require('./matcher');

const PORT = process.env.PORT || 3001;
const BOOTH_ID = process.env.BOOTH_ID || 'Booth-A';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

// POST /case/found
app.post('/case/found', (req, res) => {
  const { name, age, gender, language, zone, photo_base64, contact_number, wristband_id } = req.body;
  const now = Date.now();
  const case_id = genId('KM');
  const wb_id = wristband_id || genId('WB');

  const newCase = insertCase({
    case_id,
    case_type: 'found',
    wristband_id: wb_id,
    name,
    age,
    gender,
    language,
    zone,
    photo_base64: photo_base64 || '',
    contact_number,
    status: 'pending',
    booth_id: BOOTH_ID,
    last_updated: now,
    created_at: now,
  });

  res.json({ success: true, case_id: newCase.case_id, wristband_id: newCase.wristband_id });
});

// POST /case/missing
app.post('/case/missing', (req, res) => {
  const { name, age, gender, language, zone, photo_base64, contact_number } = req.body;
  const now = Date.now();
  const case_id = genId('KM');

  const newCase = insertCase({
    case_id,
    case_type: 'missing',
    wristband_id: null,
    name,
    age,
    gender,
    language,
    zone,
    photo_base64: photo_base64 || '',
    contact_number,
    status: 'searching',
    booth_id: BOOTH_ID,
    last_updated: now,
    created_at: now,
  });

  res.json({ success: true, case_id: newCase.case_id });
});

// GET /cases
app.get('/cases', (req, res) => {
  const cases = getAllCases();
  const matches = getPendingMatches();
  res.json({ cases, matches });
});

// GET /lookup/:id  (tries wristband_id first, then case_id)
app.get('/lookup/:wristband_id', (req, res) => {
  const id = req.params.wristband_id;
  const record = getCaseByWristband(id) || getCaseById(id);
  if (!record) return res.status(404).json({ error: 'Not found' });
  res.json(record);
});

// GET /export
app.get('/export', (req, res) => {
  const cases = getAllCases();
  res.json({ booth_id: BOOTH_ID, exported_at: Date.now(), cases });
});

// POST /sync
app.post('/sync', (req, res) => {
  const { cases = [] } = req.body;
  for (const c of cases) {
    upsertCase(c);
  }
  const newMatches = runFuzzyMatch();
  res.json({ success: true, synced_count: cases.length, new_matches_count: newMatches.length });
});

// POST /match/run
app.post('/match/run', (req, res) => {
  const newMatches = runFuzzyMatch();
  res.json({ success: true, new_matches: newMatches });
});

// POST /match/confirm
app.post('/match/confirm', (req, res) => {
  const { match_id } = req.body;
  const match = db.prepare('SELECT * FROM matches WHERE match_id = ?').get(match_id);
  if (!match) return res.status(404).json({ error: 'Match not found' });

  const now = Date.now();
  updateCaseStatus(match.found_case_id, 'reunified');
  updateCaseStatus(match.missing_case_id, 'reunified');
  updateMatchStatus(match_id, 'confirmed');

  res.json({ success: true });
});

// POST /match/reject
app.post('/match/reject', (req, res) => {
  const { match_id } = req.body;
  updateMatchStatus(match_id, 'rejected');
  res.json({ success: true });
});

// POST /register
app.post('/register', (req, res) => {
  const { family_name, contact_number, zone, name, age, gender, language, relationship, photo_base64 } = req.body;
  const now = Date.now();
  const registration_id = genId('KMP');
  const wristband_id = genId('WB');

  insertCase({
    case_id: registration_id,
    case_type: 'pre-registered',
    wristband_id,
    name,
    age,
    gender,
    language,
    zone,
    photo_base64: photo_base64 || '',
    contact_number,
    status: 'registered',
    booth_id: 'PRE-REGISTRATION',
    last_updated: now,
    created_at: now,
  });

  res.json({ success: true, registration_id, wristband_id, name, age, gender, zone, language });
});

app.listen(PORT, () => {
  console.log(`Booth: ${BOOTH_ID} running on port ${PORT}`);
});
