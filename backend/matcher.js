const { db, genId, insertMatch, matchExists } = require('./database');

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

      const ageDiff = Math.abs((found.age || 0) - (missing.age || 0));
      if (ageDiff === 0) score += 30;
      else if (ageDiff <= 2) score += 15;

      if (found.gender && found.gender === missing.gender) score += 25;
      if (found.language && found.language === missing.language) score += 25;
      if (found.zone && found.zone === missing.zone) score += 20;

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
