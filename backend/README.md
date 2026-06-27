# Kumbh Mela — Lost and Found POC

## Project Structure

```
Claude Impact Lab/
├── backend/      — Node.js/Express API + SQLite database
└── frontend/     — Plain HTML/CSS/JS PWA (served by backend)
```

## Setup

**Step 1 — Install backend dependencies**
```bash
cd backend
npm install
```

**Step 2 — Install frontend dependencies**
```bash
cd frontend
npm install
```

**Step 3 — Generate PWA icons** _(one-time, creates icon-192.png and icon-512.png)_
```bash
cd frontend
npm run generate-icons
```

## Running Both Booths

Open two terminals:

**Terminal 1 — Booth A**
```bash
# From backend/
npm run booth-a

# Or from frontend/
npm run booth-a

# → Booth: Booth-A running on port 3001
# → Open http://localhost:3001/intake.html
```

**Terminal 2 — Booth B**
```bash
# From backend/
npm run booth-b

# Or from frontend/
npm run booth-b

# → Booth: Booth-B running on port 3002
# → Open http://localhost:3002/intake.html
```

Each booth writes to its own SQLite file (`kumbh-Booth-A.db` / `kumbh-Booth-B.db`).

## Pages

| URL | Page | Purpose |
|-----|------|---------|
| `/intake.html` | Intake | Register found or missing pilgrims |
| `/scanner.html` | Scanner | Scan wristband QR to look up a pilgrim |
| `/operator.html` | Operator | Review and confirm/reject fuzzy matches |
| `/dashboard.html` | Dashboard | Sync booths and view all cases |

---

## API Endpoints

### POST /case/found
Register a found person.

**Request body:**
```json
{
  "name": "Ravi Kumar",
  "age": 45,
  "gender": "male",
  "language": "Hindi",
  "zone": "Zone-3",
  "photo_base64": "<base64 string or empty string>",
  "contact_number": "9876543210",
  "wristband_id": "WB-optional"
}
```

**Response:**
```json
{ "success": true, "case_id": "KM-1234567890-4321", "wristband_id": "WB-1234567890-1234" }
```

---

### POST /case/missing
Register a missing person.

**Request body:**
```json
{
  "name": "Priya Sharma",
  "age": 32,
  "gender": "female",
  "language": "Hindi",
  "zone": "Zone-1",
  "photo_base64": "<base64 string or empty string>",
  "contact_number": "9876543211"
}
```

**Response:**
```json
{ "success": true, "case_id": "KM-1234567890-5678" }
```

---

### GET /cases
Returns all cases and all pending matches.

**Response:**
```json
{
  "cases": [ { "case_id": "...", "case_type": "found", "name": "...", ... } ],
  "matches": [
    {
      "match_id": "MATCH-...", "confidence_score": 80, "status": "pending",
      "found_case": { "case_id": "...", "name": "...", ... },
      "missing_case": { "case_id": "...", "name": "...", ... }
    }
  ]
}
```

---

### GET /lookup/:wristband_id
Look up a case by wristband ID.

**Example:** `GET /lookup/WB-1234567890-1234`

**Response (200):** Full case object  
**Response (404):** `{ "error": "Not found" }`

---

### GET /export
Export all cases from this booth as JSON.

**Response:**
```json
{
  "booth_id": "Booth-A",
  "exported_at": 1700000000000,
  "cases": [ { ... }, { ... } ]
}
```

---

### POST /sync
Receive cases from another booth and run fuzzy matching.

**Request body:**
```json
{ "cases": [ { "case_id": "KM-...", "case_type": "missing", ... } ] }
```

**Response:**
```json
{ "success": true, "synced_count": 5, "new_matches_count": 2 }
```

**Typical usage:** Export from Booth A, POST the `cases` array to Booth B's `/sync`.

---

### POST /match/run
Manually trigger fuzzy matching on this booth's local data.

**Request body:** (none)

**Response:**
```json
{ "success": true, "new_matches": [ { "match_id": "MATCH-...", ... } ] }
```

---

### POST /match/confirm
Confirm a match — marks both cases as `reunified`.

**Request body:**
```json
{ "match_id": "MATCH-1234567890-9999" }
```

**Response:**
```json
{ "success": true }
```

---

### POST /match/reject
Reject a match — both cases stay active for future matching.

**Request body:**
```json
{ "match_id": "MATCH-1234567890-9999" }
```

**Response:**
```json
{ "success": true }
```

---

## Scoring Logic

| Attribute     | Exact match | Near match       |
|---------------|-------------|-----------------|
| Age           | 30 pts      | 15 pts (±2 yrs) |
| Gender        | 25 pts      | —               |
| Language      | 25 pts      | —               |
| Zone          | 20 pts      | —               |
| **Max total** | **100 pts** |                 |

Matches are created automatically when score ≥ 60.
