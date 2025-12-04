/**
 * Case Bundle - Aggregates patient data with imaging metadata
 *
 * This interface represents the clinical workflow in veterinary radiology:
 * combining patient demographics, clinical history, lab results, and
 * imaging studies into a single cohesive bundle for radiologist review.
 *
 * Veterinary-specific considerations:
 * - species: Critical for anatomy interpretation (Canine vs Feline vs Equine have vastly different anatomy)
 * - breed: Risk factors for breed-predisposed conditions (e.g., hip dysplasia in German Shepherds)
 * - weightKg: Required for medication/anesthesia dosing (most vet drugs dosed mg/kg)
 * - sedationProtocol: Most imaging requires chemical restraint (animals can't hold still on command)
 *
 * In production, this would map to:
 * - patient/history/labs → Postgres/Prisma (EHR database)
 * - imaging.series → Fetched from Orthanc/PACS in real-time (immutable after acquisition)
 */
export interface CaseBundle {
  studyInstanceUid: string;
  patient: {
    id: string;              // Unique patient identifier
    name: string;            // Pet name
    species: string;         // Canine, Feline, Equine, Avian, etc
    breed?: string;          // Optional but clinically useful
    ageYears: number;        // Can be fractional for young animals
    weightKg?: number;       // Critical for dosing calculations
    sex: string;             // M/F/FS/MN (intact vs spayed/neutered)
  };
  history: string;           // Clinical presentation
  labResults: {              // Extensible lab result structure
    urinalysis?: {
      culture: string;
      result: string;
    };
  };
  imaging: {
    studyInstanceUid: string;      // Links to DICOM study
    series: string[];              // Array of SeriesInstanceUIDs
    sedationProtocol?: string;     // Anesthesia/sedation used
  };
}

/**
 * DICOMweb Series Response Format
 *
 * Represents DICOM JSON format per PS3.18 DICOMweb specification.
 * DICOM tags are encoded as keys in format "GGGGEEEE" (Group + Element in hex).
 *
 * Example:
 * {
 *   "0020000E": { vr: "UI", Value: ["1.2.840.113619.2.55.3.12345"] }  // SeriesInstanceUID
 * }
 *
 * VR = Value Representation (data type in DICOM)
 * Common VRs: UI (UID), LO (Long String), DA (Date), TM (Time), PN (Person Name)
 */
export interface DicomWebSeries {
  [key: string]: {
    Value?: unknown[];   // Tag value(s) - can be single or multi-valued
    vr?: string;         // Value Representation (DICOM data type)
  };
}

/**
 * Standard error response format
 * Follows HTTP API best practice of consistent error structure
 */
export interface ErrorResponse {
  error: string;  // Human-readable error message (generic for security)
}
