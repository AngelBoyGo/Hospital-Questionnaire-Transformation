const fs = require('fs');
const path = require('path');

let _schemaCache = null;

function loadQuestionnaireSchema() {
  if (_schemaCache) return _schemaCache;
  const schemaPath = path.join(__dirname, '..', 'questionnaire', 'schema.json');
  const content = fs.readFileSync(schemaPath, 'utf8');
  _schemaCache = JSON.parse(content);
  return _schemaCache;
}

function applySchemaDefaults(input) {
  const schema = loadQuestionnaireSchema();
  const defaults = schema.defaults || {};
  const merged = { ...defaults, ...(input || {}) };
  if (!merged.facilityName) merged.facilityName = 'Default Hospital';

  // Normalize types
  if (typeof merged.bedCount === 'string') merged.bedCount = parseInt(merged.bedCount) || defaults.bedCount || 100;
  if (merged.complianceFrameworks && !Array.isArray(merged.complianceFrameworks)) {
    merged.complianceFrameworks = String(merged.complianceFrameworks).split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (merged.clinicalSystems && !Array.isArray(merged.clinicalSystems)) {
    merged.clinicalSystems = String(merged.clinicalSystems).split(',').map((s) => s.trim()).filter(Boolean);
  }

  // Normalize facilityType tokens
  const ft = String(merged.facilityType || '').toLowerCase();
  const normalized = {
    academic: 'academic',
    community: 'community',
    specialty: 'specialty',
    general: 'general',
    'critical access': 'critical_access',
    critical_access: 'critical_access',
    multi_site: 'multi_site'
  }[ft] || 'community';
  merged.facilityType = normalized;
  return merged;
}

// Backwards-compatible alias
const applyDefaults = applySchemaDefaults;

module.exports = { loadQuestionnaireSchema, applySchemaDefaults, applyDefaults };

