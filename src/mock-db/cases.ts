import { CaseBundle } from '../types';

/**
 * Mock database simulating PostgreSQL/Prisma models
 * In production, this would be replaced with actual database queries
 *
 * Note: In production veterinary systems, weight is critical for:
 * - Anesthesia dosing calculations (mg/kg dosing)
 * - Medication prescribing (especially for small animals)
 * - Treatment planning (radiation therapy, chemotherapy)
 * - Contrast agent dosing for CT/MRI studies
 *
 * Including breed helps identify breed-specific conditions:
 * - Hip dysplasia in large breeds (German Shepherds, Golden Retrievers)
 * - IVDD in Dachshunds and Corgis
 * - Brachycephalic airway issues in Bulldogs, Pugs
 */

// Sample veterinary cases
export const caseBundles: Record<string, CaseBundle> = {
  '1.3.6.1.4.1.14519.5.2.1.2193.7172.847236098565581057121195872945': {
    studyInstanceUid: '1.3.6.1.4.1.14519.5.2.1.2193.7172.847236098565581057121195872945',
    patient: {
      id: 'P004',
      name: 'Luna',
      species: 'Canine',
      breed: 'Mixed Breed',
      ageYears: 3,
      weightKg: 18.7,
      sex: 'FS',
    },
    history: 'Routine chest radiographs for pre-anesthetic screening. No clinical signs.',
    labResults: {},
    imaging: {
      studyInstanceUid: '1.3.6.1.4.1.14519.5.2.1.2193.7172.847236098565581057121195872945',
      series: [], // Will be populated from local Orthanc
      sedationProtocol: 'None required (conscious radiographs)',
    },
  },
  '1.2.826.0.1.3680043.8.1055.1.20111103111148288.98361414.79379639': {
    studyInstanceUid: '1.2.826.0.1.3680043.8.1055.1.20111103111148288.98361414.79379639',
    patient: {
      id: 'P001',
      name: 'Fluffy',
      species: 'Feline',
      breed: 'Domestic Shorthair',
      ageYears: 10,
      weightKg: 4.2,
      sex: 'FS',
    },
    history: 'Straining to urinate, suspected UTI. Owner reports vocalizing when using litter box.',
    labResults: {
      urinalysis: {
        culture: 'E. coli',
        result: 'Positive',
      },
    },
    imaging: {
      studyInstanceUid: '1.2.826.0.1.3680043.8.1055.1.20111103111148288.98361414.79379639',
      series: [], // Will be populated from Orthanc
      sedationProtocol: 'Dexmedetomidine 5 mcg/kg IM',
    },
  },
  '123': {
    studyInstanceUid: '123',
    patient: {
      id: 'P002',
      name: 'Max',
      species: 'Canine',
      breed: 'Golden Retriever',
      ageYears: 5,
      weightKg: 32.5,
      sex: 'M',
    },
    history: 'Limping on right hind leg for 3 days. No known trauma. Possible CCL tear (common in breed).',
    labResults: {},
    imaging: {
      studyInstanceUid: '123',
      series: ['SERIES_UID_1', 'SERIES_UID_2'],
      sedationProtocol: 'Propofol 6 mg/kg IV for positioning',
    },
  },
  '2.16.840.1.113669.632.20.1211.10000357775': {
    studyInstanceUid: '2.16.840.1.113669.632.20.1211.10000357775',
    patient: {
      id: 'P003',
      name: 'Buddy',
      species: 'Canine',
      breed: 'Labrador Retriever',
      ageYears: 7,
      weightKg: 28.3,
      sex: 'M',
    },
    history: 'Persistent cough for 2 weeks, exercise intolerance. Rule out cardiac disease vs respiratory pathology.',
    labResults: {},
    imaging: {
      studyInstanceUid: '2.16.840.1.113669.632.20.1211.10000357775',
      // Mock series UIDs (simulating what Orthanc would return)
      // In production, these would be fetched from real DICOM server
      series: [
        '1.3.46.670589.11.0.0.11.4.2.0.8743.5.5396.2006120114285654497',
        '1.3.46.670589.11.0.0.11.4.2.0.8743.5.5396.2006120114314125550',
        '1.3.46.670589.11.0.0.11.4.2.0.8743.5.5396.2006120114262848496',
      ],
      sedationProtocol: 'None (cooperative patient, conscious radiographs)',
    },
  },
};

// Helper function to find case by study UID
export const findCaseByStudyUid = (studyInstanceUid: string): CaseBundle | undefined => {
  return caseBundles[studyInstanceUid];
};
