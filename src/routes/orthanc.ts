import { Router, Request, Response } from 'express';
import { orthancService } from '../services/orthancService';
import { isValidStudyInstanceUID, sanitizeUidForLogging } from '../utils/dicom';

const router = Router();

/**
 * GET /api/orthanc/series/:studyInstanceUid
 * Fetch series metadata via DICOMweb QIDO-RS protocol
 *
 * Returns array of series with DICOM JSON format (Part 18 Web Services)
 * Note: This endpoint fetches metadata only. For pixel data retrieval,
 * we'd extend this to support WADO-RS (DICOMweb RetrieveStudy)
 */
router.get('/series/:studyInstanceUid', async (req: Request, res: Response): Promise<void> => {
  try {
    const { studyInstanceUid } = req.params;

    // Validate DICOM UID format before external call
    // Prevents injection attacks and invalid requests to upstream servers
    if (!isValidStudyInstanceUID(studyInstanceUid)) {
      res.status(400).json({
        error: 'Invalid StudyInstanceUID format',
      });
      return;
    }

    // Fetch from Orthanc DICOMweb with automatic failover
    const seriesData = await orthancService.fetchStudySeries(studyInstanceUid);

    if (!seriesData) {
      // Note: In production, we'd want to distinguish between:
      // - 404 (study not found) vs 500 (server error) for retry logic
      // - But for this test, returning generic error as specified
      res.json({
        error: 'Unable to fetch from Orthanc',
      });
      return;
    }

    // Return raw DICOMweb JSON response
    res.json(seriesData);
  } catch (error) {
    // DICOM-aware error handling
    // Log for debugging but return generic message per HIPAA best practices
    const uid = req.params.studyInstanceUid;
    const sanitizedUid = sanitizeUidForLogging(uid);
    console.error(`DICOM fetch failed for study ${sanitizedUid}:`, error instanceof Error ? error.message : 'Unknown error');

    // Don't expose internal error details in production
    res.json({
      error: 'Unable to fetch from Orthanc',
    });
  }
});

// TODO for production:
// - Add rate limiting per client IP (prevent DICOM server abuse)
// - Implement response caching (studies don't change after acquisition)
// - Add audit logging for regulatory compliance (who accessed which studies)
// - Consider DICOM TLS (encrypt traffic to upstream Orthanc)

export default router;
