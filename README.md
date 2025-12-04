# Veterinary DICOM API

A Node.js/TypeScript API for fetching and structuring veterinary patient case bundles with DICOM imaging data from Orthanc.

## ✅ Requirements Completed

- ✅ `GET /api/case-bundle/:studyInstanceUid` - Returns structured case bundle
- ✅ `GET /api/orthanc/series/:studyInstanceUid` - Fetches DICOM series metadata
- ✅ TypeScript with strict mode and comprehensive type definitions
- ✅ Clean separation of concerns (routes → services → data layer)
- ✅ Robust error handling with DICOM UID validation
- ✅ Docker-based Orthanc server for reliable testing
- ✅ Veterinary-specific data model (species, breed, weight, sedation)

**Documentation:** [DECISIONS.md](docs/DECISIONS.md) - Technical decisions and architecture rationale

## Quick Start

**Note:** This implementation uses a local Docker-based Orthanc server for reliability. If you prefer, the code gracefully falls back to mock data when Orthanc is unavailable.

```bash
# 1. Start local Orthanc server (requires Docker)
cd orthanc && docker compose up -d && cd ..

# 2. Upload sample DICOM data (optional but recommended)
./orthanc/upload-sample-data.sh

# 3. Install dependencies
npm install

# 4. Run development server
npm run dev
```

**Quick test:**

```bash
# Case bundle with real DICOM series from local Orthanc
curl http://localhost:3000/api/case-bundle/1.3.6.1.4.1.14519.5.2.1.2193.7172.847236098565581057121195872945
```

The API server will start on `http://localhost:3000`
Orthanc web interface available at `http://localhost:8042`

## Troubleshooting

**Port already in use:**

```bash
cd orthanc && docker compose down && cd ..
```

**Check Orthanc status:**

```bash
docker compose -f orthanc/docker-compose.yml logs -f
curl http://localhost:8042/system | python3 -m json.tool
```

## API Endpoints

### 1. Get Case Bundle

```
GET /api/case-bundle/:studyInstanceUid
```

Returns a structured JSON case bundle for a veterinary patient.

**Example:**

```bash
curl http://localhost:3000/api/case-bundle/1.2.826.0.1.3680043.8.1055.1.20111103111148288.98361414.79379639
```

**Response:**

```json
{
  "studyInstanceUid": "1.2.826.0.1.3680043.8.1055.1.20111103111148288.98361414.79379639",
  "patient": {
    "id": "P001",
    "name": "Fluffy",
    "species": "Feline",
    "ageYears": 10,
    "sex": "FS"
  },
  "history": "Straining to urinate, suspected UTI.",
  "labResults": {
    "urinalysis": {
      "culture": "E. coli",
      "result": "Positive"
    }
  },
  "imaging": {
    "studyInstanceUid": "1.2.826.0.1.3680043.8.1055.1.20111103111148288.98361414.79379639",
    "series": ["1.2.826.0.1.3680043.8.1055.1.20111103111150227.96361414.92928232", ...]
  }
}
```

### 2. Fetch Orthanc Series

```
GET /api/orthanc/series/:studyInstanceUid
```

Fetches raw DICOMweb JSON from Orthanc server. Implements automatic fallback between multiple public DICOM servers for reliability.

**Example:**

```bash
curl http://localhost:3000/api/orthanc/series/1.2.826.0.1.3680043.8.1055.1.20111103111148288.98361414.79379639
```

**Response:**
Returns raw DICOMweb JSON array or:

```json
{
  "error": "Unable to fetch from Orthanc"
}
```

## Project Structure

```
├── src/
│   ├── routes/              # HTTP request handlers
│   │   ├── caseBundle.ts    # Case bundle endpoint
│   │   └── orthanc.ts       # Orthanc proxy endpoint
│   ├── services/            # Business logic layer
│   │   └── orthancService.ts # Orthanc integration
│   ├── mock-db/             # Data layer (simulates Postgres)
│   │   └── cases.ts         # Veterinary patient data
│   ├── utils/               # Shared utilities
│   │   └── dicom.ts         # DICOM UID validation
│   ├── types/               # TypeScript definitions
│   │   └── index.ts         # All interfaces
│   └── index.ts             # Express app setup
├── docs/
│   └── DECISIONS.md         # Architecture decisions
├── orthanc/                 # Orthanc server setup
│   ├── docker-compose.yml   # Docker configuration
│   ├── orthanc.json         # Server config
│   └── upload-sample-data.sh # DICOM upload helper
├── package.json
├── tsconfig.json
└── README.md
```

## Design Notes

Structured with clean separation of concerns: **routes** handle HTTP requests/responses and validation, **services** encapsulate external API calls to Orthanc, **mock-db** simulates what would be Postgres/Prisma models in production, and **types** provide strict TypeScript contracts. The `/api/case-bundle` endpoint combines local patient data with real-time DICOM series from Orthanc, while `/api/orthanc/series` proxies DICOMweb with automatic failover for reliability. Key decisions include 5-second timeouts per server, graceful degradation to mock data when servers are unavailable, and consistent error handling following the spec format.

## Test Data

Four sample cases are available:

1. **Luna** (local Orthanc with real DICOM): `1.3.6.1.4.1.14519.5.2.1.2193.7172.847236098565581057121195872945`
2. **Fluffy** (from task spec): `1.2.826.0.1.3680043.8.1055.1.20111103111148288.98361414.79379639`
3. **Max** (mock data): `123`
4. **Buddy** (with mock series UIDs): `2.16.840.1.113669.632.20.1211.10000357775`

To test with real DICOM data fetched from local Orthanc, use Luna's study UID.

## Configuration

The API connects to a local Orthanc server by default (`http://localhost:8042`).

You can override the server URL via environment variable:

```bash
export ORTHANC_URL=http://your-orthanc-server:8042
npm run dev
```

### Using the Local Orthanc Server

The `orthanc/docker-compose.yml` file sets up a local Orthanc server with:

- REST API on port `8042`
- DICOM receiver on port `4242`
- No authentication (for testing purposes only, see `orthanc/orthanc.json`)
- Persistent storage using Docker volumes

To upload DICOM files for testing:

```bash
curl -X POST http://localhost:8042/instances \
  -H "Content-Type: application/dicom" \
  --data-binary @your-file.dcm
```

## Error Handling

The implementation includes comprehensive error handling:

- **5-second timeout** per server to fail fast
- **Automatic fallback** to secondary server if primary fails
- **Detailed logging** of server availability
- **Graceful degradation** - returns `{ "error": "Unable to fetch from Orthanc" }` if all servers fail
- **Empty array handling** - distinguishes between server errors and "study not found"

## Scripts

```bash
npm run dev         # Development mode with hot reload
npm run build       # Compile TypeScript to dist/
npm run start       # Run compiled JavaScript
npm run type-check  # Check types without building
```

---

**Developer:** Alexander Kim
[Portfolio](https://alexanderkim.dev) | [AK Labs](https://www.aklabs.dev/) | [Speech Coach (microservices example)](https://github.com/aksovius/speech-coach)
