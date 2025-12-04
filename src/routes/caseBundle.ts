import { Router, Request, Response } from 'express';
import { findCaseByStudyUid } from '../mock-db/cases';
import { orthancService } from '../services/orthancService';
import { isValidStudyInstanceUID } from '../utils/dicom';

const router = Router();

/**
 * GET /api/case-bundle/:studyInstanceUid
 * Return a structured clinical case bundle for veterinary patient
 *
 * Combines:
 * - Patient demographics and species info
 * - Clinical history and presentation
 * - Lab results
 * - Imaging metadata (fetched real-time from DICOM server)
 *
 * Note: In production veterinary systems, this would also include:
 * - Sedation protocol (required for most imaging procedures)
 * - Referring veterinarian info
 * - Practice management system integration
 */
router.get('/:studyInstanceUid', async (req: Request, res: Response): Promise<void> => {
  try {
    const { studyInstanceUid } = req.params;

    // Validate DICOM UID format
    if (!isValidStudyInstanceUID(studyInstanceUid)) {
      res.status(400).json({
        error: 'Invalid StudyInstanceUID format',
      });
      return;
    }

    // Find case in mock database (would be Prisma query in production)
    const caseBundle = findCaseByStudyUid(studyInstanceUid);

    if (!caseBundle) {
      res.status(404).json({
        error: 'Case not found for study UID',
      });
      return;
    }

    // Enrich with real-time DICOM series data from Orthanc
    // This demonstrates hybrid approach: structured data + real DICOM metadata
    const seriesData = await orthancService.fetchStudySeries(studyInstanceUid);
    if (seriesData && seriesData.length > 0) {
      const seriesUids = orthancService.extractSeriesUids(seriesData);
      caseBundle.imaging.series = seriesUids;
    }
    // Production note: Common issue is DB references studies but Orthanc files missing
    // (failed uploads, network issues). Consider periodic reconciliation job to flag orphaned records.

    res.json(caseBundle);
  } catch (error) {
    console.error('Error in case-bundle route:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

// TODO for production:
// - Add pagination for case lists (GET /api/case-bundle?limit=50&offset=0)
// - Implement field filtering (?fields=patient,imaging) to reduce payload
// - Add query by species, date range, modality for clinic workflows
// - Consider GraphQL for more flexible queries by radiologists

export default router;
