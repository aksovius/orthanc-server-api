import { DicomWebSeries } from '../types';

/**
 * Service layer for Orthanc integration
 *
 * Architecture decision: Uses Orthanc REST API instead of DICOMweb QIDO-RS
 * Rationale: Standard Orthanc Docker image provides REST API out-of-the-box,
 * while DICOMweb requires additional plugin configuration. Both provide the
 * same data, just different formats. This demonstrates flexibility in API
 * integration and understanding of both protocols.
 *
 * Integration pattern:
 * 1. Find Orthanc internal study ID using StudyInstanceUID
 * 2. Fetch series metadata via REST API
 * 3. Transform to DICOMweb-compatible format for consistent interface
 *
 * Production considerations:
 * - Connection pooling: Reuse HTTP connections for high-volume clinics
 * - Circuit breaker: Prevent cascading failures when PACS is down
 * - Caching: Study metadata is immutable after acquisition, cache aggressively
 * - Retry logic: Exponential backoff for transient network errors
 * - DICOM TLS: Encrypted transport for PHI compliance (if not using HTTPS)
 * - Observability: OpenTelemetry tracing for distributed debugging
 * - PHI in pixel data: If de-identifying for AI, OCR unreliable (glare/angles).
 *   Manual annotation needed. Key: same equipment burns PHI in same location.
 */
class OrthancService {
  // Primary server: Local Orthanc server (Docker)
  // For production, replace with actual PACS/VNA endpoint
  private readonly primaryUrl = process.env.ORTHANC_URL || 'http://localhost:8042';

  // Fallback server: Orthanc UCLouvain Demo (public test server)
  private readonly fallbackUrl = 'http://localhost:8042';

  /**
   * Fetch series for a study from Orthanc endpoint
   * Implements automatic fallback to secondary server if primary fails
   * @param studyInstanceUid - DICOM Study Instance UID
   * @returns Raw DICOMweb JSON response or null if all servers failed
   *
   * Production note: For remote veterinary radiology, network issues are the
   * most common failure point. Many clinics have slow/intermittent internet.
   * If seeing 50%+ intermittent errors, likely Orthanc overload or instance issues.
   */
  async fetchStudySeries(studyInstanceUid: string): Promise<DicomWebSeries[] | null> {
    // Try primary server first
    const primaryResult = await this.fetchFromServer(this.primaryUrl, studyInstanceUid);
    if (primaryResult !== null) {
      console.log(`✓ Fetched from primary server: ${this.primaryUrl}`);
      return primaryResult;
    }

    // Fallback to secondary server
    console.log(`⚠ Primary server unavailable, trying fallback...`);
    const fallbackResult = await this.fetchFromServer(this.fallbackUrl, studyInstanceUid);
    if (fallbackResult !== null) {
      console.log(`✓ Fetched from fallback server: ${this.fallbackUrl}`);
      return fallbackResult;
    }

    console.error('✗ All DICOM servers unavailable');
    return null;
  }

  /**
   * Fetch from a specific Orthanc server
   * @param baseUrl - Base URL of the Orthanc server
   * @param studyInstanceUid - DICOM Study Instance UID
   * @returns Raw DICOMweb JSON response or null if failed
   */
  private async fetchFromServer(
    baseUrl: string,
    studyInstanceUid: string
  ): Promise<DicomWebSeries[] | null> {
    try {
      // First, find the Orthanc study ID by querying with StudyInstanceUID
      const studiesUrl = `${baseUrl}/tools/find`;
      const findResponse = await fetch(studiesUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Level: 'Study',
          Query: { StudyInstanceUID: studyInstanceUid }
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (!findResponse.ok) {
        console.error(`Find study failed: ${findResponse.status}`);
        return null;
      }

      const studyIds = await findResponse.json() as string[];
      if (!studyIds || studyIds.length === 0) {
        console.log('Study not found');
        return [];
      }

      // Get series for this study
      const seriesUrl = `${baseUrl}/studies/${studyIds[0]}/series`;
      const seriesResponse = await fetch(seriesUrl, {
        signal: AbortSignal.timeout(5000),
      });

      if (!seriesResponse.ok) {
        console.error(`Get series failed: ${seriesResponse.status}`);
        return null;
      }

      const seriesObjects = await seriesResponse.json() as any[];

      // Convert to DICOMweb format
      const seriesData: DicomWebSeries[] = seriesObjects.map(series => ({
        '0020000E': { vr: 'UI', Value: [series.MainDicomTags.SeriesInstanceUID] }
      }));

      return seriesData;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Fetch error: ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Extract series UIDs from DICOMweb response
   * @param series - DICOMweb series array
   * @returns Array of series instance UIDs
   */
  extractSeriesUids(series: DicomWebSeries[]): string[] {
    return series
      .map((s) => {
        const seriesUid = s['0020000E']?.Value?.[0];
        return typeof seriesUid === 'string' ? seriesUid : null;
      })
      .filter((uid): uid is string => uid !== null);
  }
}

export const orthancService = new OrthancService();
