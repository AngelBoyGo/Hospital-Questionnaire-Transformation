const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.File({ filename: 'logs/quality-validation.log' })]
});

/**
 * QualityValidationEngine
 * Performs completeness and consistency validation for questionnaires and results
 */
class QualityValidationEngine {
  /**
   * @param {Function} schemaLoader - function that returns the questionnaire schema JSON
   */
  constructor(schemaLoader) {
    this.loadSchema = schemaLoader;
  }

  /** Validate questionnaire completeness against schema */
  validateQuestionnaireCompleteness(questionnaire) {
    const schema = this.loadSchema();
    const requiredIds = [];
    for (const section of schema.sections) {
      for (const q of section.questions) {
        if (q.required) requiredIds.push(q.id);
      }
    }

    const missing = requiredIds.filter((id) => !this._hasValue(questionnaire[id]));
    const completeness = (requiredIds.length - missing.length) / Math.max(1, requiredIds.length);

    return {
      completenessScore: Number(completeness.toFixed(3)),
      requiredCount: requiredIds.length,
      missingCount: missing.length,
      missingFields: missing
    };
  }

  /** Basic consistency checks with deterministic rules */
  validateQuestionnaireConsistency(questionnaire) {
    const issues = [];
    const warnings = [];

    // Facility type token normalization
    const type = String(questionnaire.facilityType || '').toLowerCase();
    const bedCount = Number(questionnaire.bedCount);
    if (type === 'critical_access' && bedCount > 500) {
      warnings.push('Critical access hospitals typically have < 100 beds');
    }
    if (!Array.isArray(questionnaire.complianceFrameworks) || questionnaire.complianceFrameworks.length === 0) {
      issues.push('At least one compliance framework (e.g., HIPAA) should be selected');
    }
    if (!questionnaire.primaryEHR) {
      warnings.push('Primary EHR not specified; assumptions will be applied');
    }

    return { issues, warnings, isConsistent: issues.length === 0 };
  }

  /**
   * Validate a transformation result for structural completeness
   */
  validateTransformationResult(result) {
    const requiredSections = ['infrastructure', 'integration', 'security', 'compliance'];
    const missingSections = requiredSections.filter((s) => !result?.specification?.[s]);
    const hasExecutiveSummary = !!result?.executiveSummary?.hospitalName;
    const qualityHints = [];
    if (!hasExecutiveSummary) qualityHints.push('Executive summary appears incomplete');
    if (missingSections.length > 0) qualityHints.push(`Missing sections: ${missingSections.join(', ')}`);

    const coverage = (requiredSections.length - missingSections.length) / requiredSections.length;
    return {
      resultQualityScore: Number(coverage.toFixed(3)),
      missingSections,
      hints: qualityHints
    };
  }

  _hasValue(v) {
    if (v === null || v === undefined) return false;
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.length > 0;
    return true;
  }
}

module.exports = { QualityValidationEngine };

