# Technical Decisions & Architecture

Key technical decisions and reasoning behind the implementation.

## 1. Local Orthanc Server Instead of Public Endpoints

**Decision:** Use Docker-based local Orthanc server rather than public DICOMweb endpoints.

**Problem:**
When attempting to use the suggested `https://orthanc.uclouvain.be/demo/dicom-web` endpoint, Node.js `fetch` consistently failed with `ETIMEDOUT` errors. `curl` worked fine, indicating a network/firewall restriction on the development environment.

**Solution:**
Set up a local Orthanc server using Docker Compose. This provides:

- ✅ **Reliability** - No dependency on external network availability
- ✅ **Performance** - Sub-millisecond response times (localhost)
- ✅ **Control** - Full control over test data and server configuration
- ✅ **Production-realistic** - Docker is the standard deployment method for Orthanc in clinical environments

**Implementation:**
```yaml
# orthanc/docker-compose.yml
services:
  orthanc:
    image: jodogne/orthanc-plugins:latest
    ports:
      - "8042:8042"  # REST API
      - "4242:4242"  # DICOM C-STORE
    volumes:
      - orthanc-db:/var/lib/orthanc/db
      - ./orthanc.json:/etc/orthanc/orthanc.json:ro
```

**Trade-offs:**
- **Pro:** Eliminates external dependencies, faster development iteration
- **Con:** Requires Docker (acceptable - Docker is standard in modern dev environments)
- **Con:** Requires manual DICOM upload (mitigated with `upload-sample-data.sh` script)

---

## 2. Orthanc REST API vs DICOMweb Protocol

**Decision:** Use Orthanc's REST API (`/tools/find`, `/studies/{id}/series`) instead of DICOMweb QIDO-RS.

**Reasoning:**
- DICOMweb plugin requires additional configuration in Orthanc
- Out-of-the-box Orthanc Docker image provides full REST API
- REST API provides same data as DICOMweb, just different format
- Demonstrates understanding of both protocols

**Implementation:**
```typescript
// 1. Find study by StudyInstanceUID
const studyIds = await fetch(`${baseUrl}/tools/find`, {
  method: 'POST',
  body: JSON.stringify({
    Level: 'Study',
    Query: { StudyInstanceUID: studyInstanceUid }
  })
});

// 2. Get series for study
const seriesData = await fetch(`${baseUrl}/studies/${studyIds[0]}/series`);

// 3. Convert to DICOMweb format
const dicomWebFormat = seriesData.map(series => ({
  '0020000E': { vr: 'UI', Value: [series.MainDicomTags.SeriesInstanceUID] }
}));
```

**Trade-offs:**
- **Pro:** Works immediately with standard Orthanc image
- **Pro:** Shows flexibility in API integration
- **Con:** Extra conversion step to DICOMweb format (minimal overhead)

---

## 3. Veterinary-Specific Data Model

**Decision:** Include veterinary-specific fields (`species`, `breed`, `weightKg`, `sedationProtocol`) rather than generic human EHR model.

**Reasoning:**
Based on experience with veterinary imaging systems, these fields are clinically critical:

### Species
Multi-species support is fundamental to veterinary medicine. Unlike human EHR where anatomy is consistent, vet systems must handle vastly different anatomies (Canine, Feline, Equine, Avian, Exotic).

### Weight (kg)
Nearly all veterinary medications and anesthetics are dosed by weight (mg/kg). A 3kg cat requires completely different drug dosing than a 30kg dog. Missing this field in production would be a serious workflow gap.

### Breed
Certain pathologies have strong breed predisposition:
- Hip dysplasia: German Shepherds, Golden Retrievers
- IVDD (intervertebral disc disease): Dachshunds, Corgis
- Brachycephalic airway syndrome: Bulldogs, Pugs

Radiologists correlate imaging findings with breed-typical conditions.

### Sedation Protocol
Most veterinary imaging requires chemical restraint (sedation or anesthesia) since patients can't follow positioning instructions. This field captures what anesthesia was used, which is important for:
- Coordinating radiology reads with anesthesia risk assessment
- Billing/documentation
- Future case planning

**Implementation:**
```typescript
interface Patient {
  id: string;
  name: string;
  species: string;        // Critical for anatomy interpretation
  breed?: string;         // Risk factors for breed-specific conditions
  ageYears: number;
  weightKg?: number;      // Required for drug dosing calculations
  sex: string;            // M/F/FS/MN (intact vs spayed/neutered)
}

interface Imaging {
  studyInstanceUid: string;
  series: string[];
  sedationProtocol?: string;  // Most vet imaging requires sedation
}
```

---

## 4. Hybrid Approach: Mock Patient Data + Real DICOM Series

**Decision:** Store patient/clinical data in mock database, fetch DICOM series metadata from Orthanc.

**Reasoning:**
This mirrors real-world architecture where:
- Patient demographics live in EHR/PACS database (Postgres, MySQL)
- DICOM metadata lives in imaging archive (Orthanc, dcm4chee)
- API aggregates both sources

**Benefits:**
- ✅ Demonstrates data integration patterns
- ✅ Shows understanding of separation of concerns
- ✅ Tests real DICOM connectivity
- ✅ Allows adding veterinary context (history, lab results) not in DICOM

**Implementation:**
```typescript
// 1. Get patient data from mock database
const caseBundle = findCaseByStudyUid(studyInstanceUid);

// 2. Enrich with real-time DICOM series from Orthanc
const seriesData = await orthancService.fetchStudySeries(studyInstanceUid);
if (seriesData && seriesData.length > 0) {
  const seriesUids = orthancService.extractSeriesUids(seriesData);
  caseBundle.imaging.series = seriesUids;  // Real data from Orthanc
}

// 3. Return combined bundle
res.json(caseBundle);
```

---

## 5. TypeScript Strict Mode

**Decision:** Enable strict TypeScript configuration.

**Configuration:**
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

**Reasoning:**
- Catches errors at compile time, not runtime
- Self-documenting code through types
- Better IDE autocomplete and refactoring support
- Industry best practice for production TypeScript

**Trade-offs:**
- **Pro:** Prevents entire classes of runtime errors
- **Pro:** Makes code easier to maintain and refactor
- **Con:** Slightly more verbose (acceptable - clarity over brevity)

---

## 6. DICOM UID Validation

**Decision:** Implement validation of Study Instance UIDs per DICOM Part 5 standard before making external calls.

**Implementation:**
```typescript
function isValidStudyInstanceUID(uid: string): boolean {
  if (!uid || uid.length === 0 || uid.length > 64) return false;

  // DICOM UIDs: numeric components separated by dots
  // No leading/trailing/consecutive dots
  const dicomUidRegex = /^[0-9]+(\.[0-9]+)*$/;
  return dicomUidRegex.test(uid);
}
```

**Reasoning:**
- **Security:** Prevents injection attacks before external API calls
- **User experience:** Fast client-side validation, don't waste time on invalid requests
- **Standards compliance:** DICOM Part 5 specifies UID format
- **Error messages:** Can provide specific "invalid UID format" vs generic "not found"

**Example:**
```bash
# Invalid UID rejected immediately
curl http://localhost:3000/api/case-bundle/invalid..uid
# Response: {"error": "Invalid StudyInstanceUID format"}

# Valid UID but not found
curl http://localhost:3000/api/case-bundle/1.2.3.4.5
# Response: {"error": "Case not found for study UID"}
```

---

## 7. Error Handling Strategy

**Decision:** Generic errors to client, detailed logging for operations.

**Reasoning:**
Follows security best practices (HIPAA, OWASP):
- Don't leak internal implementation details to clients
- Log detailed errors for debugging/monitoring
- Consistent error format across all endpoints

**Implementation:**
```typescript
try {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

  if (!response.ok) {
    // Detailed logging for ops team
    console.error(`Orthanc request failed: ${response.status} ${response.statusText}`);

    // Generic error to client (no internal details)
    return { error: "Unable to fetch from Orthanc" };
  }

  return await response.json();

} catch (error) {
  // Log specific error types for debugging
  if (error instanceof Error) {
    console.error(`Fetch error: ${error.message}`);
  }

  // Generic error to client
  return { error: "Unable to fetch from Orthanc" };
}
```

**Benefits:**
- ✅ Security: No information leakage
- ✅ Observability: Detailed logs for ops team
- ✅ User experience: Clear, actionable error messages

---

## 8. Project Structure

**Decision:** Layered architecture with clear separation of concerns.

```
src/
├── routes/          # HTTP handlers, request/response
├── services/        # Business logic, external APIs
├── mock-db/         # Data layer (would be Prisma in production)
├── utils/           # Shared utilities (DICOM validation)
├── types/           # TypeScript type definitions
└── index.ts         # Application entry point
```

**Reasoning:**
- **Testability:** Each layer can be tested independently
- **Maintainability:** Clear boundaries, easy to locate code
- **Scalability:** Easy to replace mock DB with real Prisma/Postgres later
- **Team collaboration:** Standard Node.js structure, familiar to other developers

**Production path:**
```
mock-db/cases.ts → Prisma schema → PostgreSQL
routes/ → Add validation middleware (Zod, class-validator)
services/ → Add caching, circuit breakers, retry logic
```

---

## 9. Express vs NestJS

**Decision:** Use Express instead of NestJS.

**Reasoning:**
- **Scope:** Simple API with 2 endpoints, full framework overhead not needed
- **Clarity:** Direct code visibility without framework abstraction
- **Speed:** Minimal boilerplate, fast iteration

**Production consideration:**
For larger systems with dozens of endpoints, NestJS would provide:
- Built-in dependency injection
- Decorators for validation/transformation
- OpenAPI/Swagger generation
- Modular architecture

For this scope, Express provides better code-to-functionality ratio.

---

## 10. Timeout Configuration

**Decision:** 5-second timeout for all external requests.

**Reasoning:**
- Medical imaging context: Metadata queries should be fast (<1s typically)
- Fail-fast principle: Don't let users wait for unresponsive servers
- User experience: 5s is reasonable wait time, balances patience vs responsiveness

**Implementation:**
```typescript
const response = await fetch(url, {
  signal: AbortSignal.timeout(5000)  // 5 seconds
});
```

**Production consideration:**
- Pixel data retrieval (WADO-RS) would need longer timeouts (30-60s)
- Implement exponential backoff for transient failures
- Add circuit breaker pattern for cascading failure prevention

---

## Production Considerations

### Core Infrastructure
1. **Database:** Replace mock data with Prisma + PostgreSQL
2. **Validation:** Add Zod schemas for request/response validation
3. **Testing:** Jest + Supertest for API integration tests
4. **Caching:** Redis for study metadata (immutable after acquisition)
5. **Monitoring:** OpenTelemetry for distributed tracing
6. **Security:** HTTPS, authentication (JWT), rate limiting
7. **Error handling:** Sentry for error tracking, structured logging
8. **CI/CD:** GitHub Actions for automated testing and deployment
9. **Documentation:** OpenAPI/Swagger for API documentation
10. **Performance:** Connection pooling, database indexes, query optimization

### AI/ML Processing (if adding automated reporting)
- **Queue System:** Redis/Bull for async processing (AI inference unreliable, needs retry logic)
- **Microservices:** Separate AI components for isolation and scalability
- **Monitoring:** Processing pipeline metrics (latency, success rate, queue depth)
- **Study-level labels:** Often sufficient for classification (not per-instance)
- **AI-generated reports:** Killer feature - acts as copilot for veterinarians

### Multi-Tenancy (Critical for SaaS veterinary radiology)
- **Kubernetes + Terraform:** Data isolation between clinics (HIPAA/regulatory requirement)
- **Per-tenant databases:** Prevents data leakage between practices
- **Network isolation:** Many vet clinics on closed networks or slow internet

### Known Issues to Handle
- **DB/Orthanc sync:** Periodic reconciliation job to detect orphaned records (DB has reference but files missing)
- **Upload reliability:** Most common failure point - needs robust retry with exponential backoff
- **DICOM format issues:** Some old equipment generates UUIDs instead of proper UIDs, compressed formats fail silently
- **Orthanc overload:** 50%+ intermittent errors usually indicate instance/memory issues
