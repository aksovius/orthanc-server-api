/**
 * DICOM utility functions
 * Following DICOM PS3.5 Data Structures and Encoding standard
 */

/**
 * Validates DICOM Study Instance UID format
 *
 * DICOM UIDs must follow specific format per Part 5 of DICOM standard:
 * - Composed of numeric components separated by dots (e.g., "1.2.840.10008.5.1.4.1.1.1")
 * - Maximum length: 64 characters
 * - Only digits (0-9) and dots (.)
 * - Cannot start or end with a dot
 * - No consecutive dots
 *
 * @param uid - The Study Instance UID to validate
 * @returns true if valid DICOM UID format, false otherwise
 *
 * @example
 * isValidStudyInstanceUID("1.2.840.113619.2.55.3.123456789.001") // true
 * isValidStudyInstanceUID("invalid-uid") // false
 * isValidStudyInstanceUID("..1.2.3") // false
 */
export function isValidStudyInstanceUID(uid: string): boolean {
  // Check null/undefined/empty
  if (!uid || typeof uid !== 'string') {
    return false;
  }

  // Check length constraint (DICOM Part 5)
  if (uid.length === 0 || uid.length > 64) {
    return false;
  }

  // DICOM UID regex: numeric components separated by dots
  // - Must start and end with a digit
  // - Cannot have consecutive dots
  // - Only digits and dots allowed
  // Note: Some older equipment generates UUIDs instead of proper DICOM UIDs,
  // causing downstream parsing failures. Orthanc handles gracefully but validation helps.
  const dicomUidRegex = /^[0-9]+(\.[0-9]+)*$/;

  return dicomUidRegex.test(uid);
}

/**
 * Sanitizes a Study Instance UID for logging
 *
 * In production veterinary systems handling client data,
 * we should avoid logging full UIDs to prevent potential
 * data correlation attacks. This returns a prefix for debugging.
 *
 * @param uid - The Study Instance UID to sanitize
 * @returns Sanitized UID prefix for safe logging
 *
 * @example
 * sanitizeUidForLogging("1.2.840.113619.2.55.3.123456789.001")
 * // Returns: "1.2.840.113619...001"
 */
export function sanitizeUidForLogging(uid: string): string {
  if (!uid || uid.length < 20) {
    return '***';
  }

  const parts = uid.split('.');
  if (parts.length < 3) {
    return '***';
  }

  // Return first 3 components + last component
  const prefix = parts.slice(0, 3).join('.');
  const suffix = parts[parts.length - 1];

  return `${prefix}...${suffix}`;
}
