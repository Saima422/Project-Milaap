# Kumbh Mela — Lost and Found POC

## Project Structure

```
Claude Impact Lab/
├── backend/      — Node.js/Express API + SQLite database
└── frontend/     — Plain HTML/CSS/JS PWA (served statically by backend)
```

The backend serves the frontend as static files. No separate frontend server is needed.

---

## Setup

**Step 1 — Install backend dependencies**
```bash
cd backend
npm install
```

**Step 2 — Generate PWA icons** _(one-time only — creates icon-192.png and icon-512.png)_
```bash
cd frontend
npm install
npm run generate-icons
```

---

## Running the Booths

Open two terminals. The backend serves both the API and the frontend HTML files.

**Terminal 1 — Booth A (port 3001)**
```bash
cd backend
npm run booth-a
# → Booth: Booth-A running on port 3001
```

**Terminal 2 — Booth B (port 3002)**
```bash
cd backend
npm run booth-b
# → Booth: Booth-B running on port 3002
```

Each booth writes to its own SQLite file (`kumbh-Booth-A.db` / `kumbh-Booth-B.db`).

---

## Pages

| URL | Page | Purpose |
|-----|------|---------|
| `http://localhost:3001/intake.html` | Intake | Register found or missing pilgrims at Booth A |
| `http://localhost:3001/scanner.html` | Scanner | Scan or upload a wristband/pre-reg QR code |
| `http://localhost:3001/operator.html` | Operator | Review and confirm/reject fuzzy matches |
| `http://localhost:3001/dashboard.html` | Dashboard | Sync booths, view and filter all cases |
| `http://localhost:3001/register.html` | Register | Pre-register families and generate QR codes |

---

## Pre-Registration Flow

Families can register before arriving at the mela:

1. Open `register.html` on any device
2. Fill in family details (name, contact, zone) and add each member (name, age, gender, language, photo)
3. Click **Register Family & Generate QR Codes**
4. Each member gets a unique QR code — screenshot or print it
5. At the entry booth, the volunteer scans/uploads the QR in `scanner.html` — the person's details appear instantly (no network lookup required; data is embedded in the QR)
6. A wristband is printed for the member

**ID format:** `KMP-{timestamp}-{rand}` for registration, `WB-{timestamp}-{rand}` for wristband

---

## Scanner — QR Modes

The scanner page supports two input methods:

| Method | How |
|--------|-----|
| **Camera scan** | Click **Start Scanning**, point at QR code |
| **Upload image** | Click **Upload QR Image**, pick a photo from device |

**Pre-registered QR codes** encode person data as JSON — the scanner parses this and shows the profile card immediately without a server call, so it works even offline.

**Legacy wristband IDs** (plain `WB-...` string) still trigger the normal `/lookup` API call against Booth B.

---

## Dashboard — Case Filters

| Filter | Shows |
|--------|-------|
| All | Every case |
| Found | `case_type = found` |
| Missing | `case_type = missing` |
| Reunified | `status = reunified` |
| Pre-reg | `case_type = pre-registered` (blue badge) |

---

## API Endpoints

### POST /register
Pre-register a person before arriving at the mela.

**Request body:**
```json
{
  "family_name": "Sharma Family",
  "contact_number": "9876543210",
  "zone": "Zone-1",
  "name": "Ravi Sharma",
  "age": 45,
  "gender": "Male",
  "language": "Hindi",
  "relationship": "Self",
  "photo_base64": ""
}
```

**Response:**
```json
{
  "success": true,
  "registration_id": "KMP-1234567890-4321",
  "wristband_id": "WB-1234567890-1234",
  "name": "Ravi Sharma",
  "age": 45,
  "gender": "Male",
  "zone": "Zone-1",
  "language": "Hindi"
}
```

---

### POST /case/found
Register a found person at a booth.

**Request body:**
```json
{
  "name": "Ravi Kumar",
  "age": 45,
  "gender": "Male",
  "language": "Hindi",
  "zone": "Zone-3",
  "photo_base64": "",
  "contact_number": "",
  "wristband_id": "WB-optional"
}
```

**Response:**
```json
{ "success": true, "case_id": "KM-1234567890-4321", "wristband_id": "WB-1234567890-1234" }
```

---

### POST /case/missing
Register a missing person report.

**Request body:**
```json
{
  "name": "Priya Sharma",
  "age": 32,
  "gender": "Female",
  "language": "Hindi",
  "zone": "Zone-1",
  "photo_base64": "",
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
  "cases": [ { "case_id": "...", "case_type": "found", "name": "...", "status": "pending" } ],
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

### GET /lookup/:id
Look up a case by wristband ID (falls back to case ID).

**Example:** `GET /lookup/WB-1234567890-1234`

**Response (200):** Full case object  
**Response (404):** `{ "error": "Not found" }`

---

### GET /export
Export all cases from this booth.

**Response:**
```json
{ "booth_id": "Booth-A", "exported_at": 1700000000000, "cases": [ ... ] }
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

**Typical flow:** Export from Booth A (`GET /export`), POST the `cases` array to Booth B's `/sync`.

---

### POST /match/run
Manually trigger fuzzy matching on local data.

**Response:**
```json
{ "success": true, "new_matches": [ { "match_id": "MATCH-...", ... } ] }
```

---

### POST /match/confirm
Confirm a match — marks both cases as `reunified`.

**Request body:** `{ "match_id": "MATCH-..." }`  
**Response:** `{ "success": true }`

---

### POST /match/reject
Reject a match — both cases stay active for future matching.

**Request body:** `{ "match_id": "MATCH-..." }`  
**Response:** `{ "success": true }`

---

## Fuzzy Matching Score

| Attribute | Exact match | Near match |
|-----------|-------------|------------|
| Age | 30 pts | 15 pts (±2 yrs) |
| Gender | 25 pts | — |
| Language | 25 pts | — |
| Zone | 20 pts | — |
| **Max total** | **100 pts** | |

A match is created automatically when score ≥ 60.
