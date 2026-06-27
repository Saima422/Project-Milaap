const { db, genId, insertMatch, matchExists } = require('./database');

// Age-band midpoints used during CSV import.
// A "found" person age of 63 should match a missing record stored as midpoint 65 (band 61-70).
// Tolerance of 10 covers half a typical 10-year band width.
const AGE_TOLERANCE_SAME_BAND = 10;
const AGE_TOLERANCE_ADJACENT  = 20;

function runFuzzyMatch() {
  const foundCases = db.prepare(
    "SELECT * FROM cases WHERE case_type = 'found' AND status = 'pending'"
  ).all();

  const missingCases = db.prepare(
    "SELECT * FROM cases WHERE case_type = 'missing' AND status = 'searching'"
  ).all();

  const newMatches = [];

  for (const found of foundCases) {
    for (const missing of missingCases) {
      let score = 0;

      // --- Language (strongest signal: 10 possible values, ~10% random hit) ---
      if (found.language && missing.language &&
          found.language.toLowerCase() === missing.language.toLowerCase()) {
        score += 40;
      }

      // --- Age (midpoint-aware tolerance) ---
      const ageDiff = Math.abs((found.age || 0) - (missing.age || 0));
      if (ageDiff === 0)                        score += 30;
      else if (ageDiff <= AGE_TOLERANCE_SAME_BAND) score += 20;
      else if (ageDiff <= AGE_TOLERANCE_ADJACENT)  score += 10;

      // --- Gender (only 2 values so weighted less) ---
      if (found.gender && missing.gender &&
          found.gender.toLowerCase() === missing.gender.toLowerCase()) {
        score += 15;
      }

      // --- Location / zone (bonus — person may have wandered) ---
      if (found.zone && missing.zone &&
          found.zone.toLowerCase() === missing.zone.toLowerCase()) {
        score += 15;
      }

      // Max possible score: 40 + 30 + 15 + 15 = 100
      // Threshold 60 requires at minimum: language + age-same-band (60) or language + gender + location (70)
      if (score >= 60 && !matchExists(found.case_id, missing.case_id)) {
        const match = insertMatch({
          match_id: genId('MATCH'),
          found_case_id: found.case_id,
          missing_case_id: missing.case_id,
          confidence_score: score,
          status: 'pending',
          created_at: Date.now(),
        });
        newMatches.push(match);
      }
    }
  }

  return newMatches;
}

module.exports = { runFuzzyMatch };
