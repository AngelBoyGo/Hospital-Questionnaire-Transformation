class RedactionPipeline {
  constructor() {
    // Regex-based detectors (broad, conservative)
    this.patterns = [
      /\b(?:[A-Z][a-z]+\s+[A-Z][a-z]+)\b/g, // Names (very naive)
      /\b\d{3}-\d{2}-\d{4}\b/g, // SSN-like
      /\b\d{10}\b/g, // phone-like (digits only)
      /\b\(?(?:\d{3})\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, // phone common formats
      /\b\d{5}(?:-\d{4})?\b/g, // zip-like
      /\bMRN[:\s]*\w+\b/gi, // MRN tokens
      /\bDOB[:\s]*\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/gi, // DOB formats
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi // emails
    ];

    // Key-based redaction for structured objects
    this.sensitiveKeys = new Set([
      'name', 'firstName', 'lastName', 'middleName', 'patientName', 'fullName', 'dob', 'dateOfBirth',
      'phone', 'phoneNumber', 'mobile', 'email', 'mrn', 'medicalRecordNumber', 'ssn', 'socialSecurityNumber',
      'address', 'street', 'city', 'state', 'zip', 'zipCode'
    ]);
  }

  redactValueByKey(key, value) {
    if (value == null) return value;
    if (this.sensitiveKeys.has(String(key))) return '[REDACTED]';
    return value;
  }

  redact(obj) {
    try {
      const walker = (node) => {
        if (Array.isArray(node)) return node.map(walker);
        if (node && typeof node === 'object') {
          const result = {};
          for (const [k, v] of Object.entries(node)) {
            const redactedChild = walker(v);
            result[k] = this.redactValueByKey(k, redactedChild);
          }
          return result;
        }
        if (typeof node === 'string') {
          return this.patterns.reduce((acc, re) => acc.replace(re, '[REDACTED]'), node);
        }
        return node;
      };
      return walker(obj);
    } catch {
      return obj;
    }
  }

  validateNoPHI(obj) {
    const json = JSON.stringify(obj);
    return this.patterns.every((re) => !re.test(json));
  }
}

module.exports = { RedactionPipeline };


