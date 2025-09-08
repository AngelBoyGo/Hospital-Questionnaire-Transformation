// FormulasEngine computes deterministic metrics from questionnaire variables
// HCS: Hospital Complexity Score
// SIDI: Software Integration Difficulty Index
// RAF: Resource Allocation Formula (baseline resource units)

class FormulasEngine {
  // Make constructor for consistency with InvoiceGenerator
  constructor() {}

  async calculateFormulas(hospitalProfile, transformationResult) {
    const variables = {
      bedCount: hospitalProfile.bedCount,
      hospitalType: hospitalProfile.facilityType,
      primaryEHR: hospitalProfile.currentEHR,
      clinicalSystems: hospitalProfile.clinicalSystems, // Assuming this is part of hospitalProfile
      complianceFrameworks: hospitalProfile.complianceFrameworks, // Assuming this is part of hospitalProfile
      timeline: transformationResult.timeline // Use transformation result timeline
    };

    const hcs = FormulasEngine.computeHCS(variables);
    const sidi = FormulasEngine.computeSIDI(variables);
    const raf = FormulasEngine.computeRAF(variables, hcs, sidi);
    return { hcs, sidi, raf };
  }

  // Hospital Complexity Score (0-1)
  // Factors: bedCount, hospitalType, systemsCount, complianceLevel, timelinePressure
  static computeHCS(v) {
    const bedCount = this._boundedNumber(v.bedCount, 1, 5000, 100);
    const hospitalType = String(v.hospitalType || v.facilityType || 'community').toLowerCase();
    const systemsCount = this._boundedNumber(v.systemsCount ?? this._countArray(v.clinicalSystems), 0, 30, 2);
    const complianceWeight = this._complianceWeight(v.complianceFrameworks);
    const timelineWeight = this._timelineWeight(v.timeline || v.estimatedTimeline);

    const typeWeight = {
      academic: 1.0,
      multi_site: 0.95,
      specialty: 0.85,
      community: 0.7,
      critical_access: 0.6,
      general: 0.75
    }[hospitalType] ?? 0.7;

    // Normalize bed count to 0..1
    const bedScore = Math.min(bedCount / 2000, 1.0);
    const systemScore = Math.min(systemsCount / 10, 1.0);

    // Weighted sum
    const raw = (0.35 * bedScore) + (0.25 * systemScore) + (0.2 * typeWeight) + (0.15 * complianceWeight) + (0.05 * timelineWeight);
    return this._round01(raw);
  }

  // Software Integration Difficulty Index (>0)
  // Base model: product of vendor factors (alpha * beta * gamma) * delta
  // Simplified deterministic version using counts and capabilities
  static computeSIDI(v) {
    const ehr = String(v.primaryEHR || '').toLowerCase();
    const hasFHIR = this._includesAny(v.interoperabilityStandards, ['fhir', 'fhir r4']);
    const hasHL7 = this._includesAny(v.interoperabilityStandards, ['hl7', 'hl7 v2']);
    const customAPIs = this._includesAny(v.integrationNeeds, ['api', 'custom']);
    const extraEHRs = Math.max(0, (Array.isArray(v.ehrVendors) ? v.ehrVendors.length : 1) - 1);

    const vendorIndex = {
      epic: 0.9,
      cerner: 0.85,
      meditech: 0.8,
      allscripts: 0.75,
      athenahealth: 0.7,
    }[ehr] ?? 0.8;

    let score = 1.0;
    // Higher vendorIndex -> easier (lower difficulty), invert as factor
    score *= (1.5 - vendorIndex); // 0.6..0.8
    score *= (customAPIs ? 1.4 : 1.0);
    score *= (hasFHIR ? 0.8 : 1.0);
    score *= (hasHL7 ? 0.9 : 1.0);
    score *= (1 + (extraEHRs * 0.2));

    return Number(score.toFixed(2));
  }

  // Resource Allocation Formula -> baseline resource units and estimated cost
  static computeRAF(v, hcs, sidi) {
    // Baseline servers scale with beds and complexity
    const beds = this._boundedNumber(v.bedCount, 1, 5000, 100);
    const baselineServers = Math.ceil(Math.max(2, (beds / 150) * (0.6 + hcs)));

    const applicationServers = Math.max(2, Math.round(baselineServers * (0.9 + sidi * 0.3)));
    const webServers = Math.max(2, Math.round(baselineServers * 0.6));
    const dbServers = Math.max(1, Math.round(baselineServers * 0.4));

    const totalCpuCores = (applicationServers + webServers) * 8 + dbServers * 16;
    const totalMemoryGb = (applicationServers + webServers) * 16 + dbServers * 32;

    const primaryStorageGb = Math.round(Math.max(500, beds * (2 + hcs * 3)));
    const backupStorageGb = Math.round(primaryStorageGb * 3);

    // Simple cost model
    const infraCost = (applicationServers + webServers) * 15000 + dbServers * 25000;
    const storageCost = primaryStorageGb * 5 + backupStorageGb * 1.5;
    const estimatedCost = Math.round(infraCost + storageCost);

    return {
      servers: { applicationServers, webServers, dbServers },
      totalCpuCores,
      totalMemoryGb,
      storage: { primaryStorageGb, backupStorageGb },
      estimatedCost
    };
  }

  // Helpers
  static _boundedNumber(val, min, max, fallback) {
    const n = Number(val);
    if (Number.isFinite(n)) return Math.max(min, Math.min(max, n));
    return fallback;
  }

  static _round01(x) { return Math.max(0, Math.min(1, Number(x.toFixed(3)))); }

  static _countArray(arr) { return Array.isArray(arr) ? arr.length : 0; }

  static _complianceWeight(arr) {
    const set = new Set((arr || []).map(s => String(s).toLowerCase()));
    let w = 0.6;
    if (set.has('hipaa')) w += 0.15;
    if (set.has('hitrust')) w += 0.1;
    if (set.has('soc2')) w += 0.05;
    if (set.has('gdpr')) w += 0.05;
    return Math.min(w, 1.0);
  }

  static _timelineWeight(t) {
    const map = {
      '30_days': 1.0,
      '60_days': 0.9,
      '90_days': 0.8,
      '6_months': 0.7,
      '1_year': 0.5,
      'flexible': 0.6
    };
    return map[String(t || '').toLowerCase()] ?? 0.7;
  }

  static _includesAny(v, list) {
    if (!v) return false;
    const str = Array.isArray(v) ? v.join(' ').toLowerCase() : String(v).toLowerCase();
    return list.some(k => str.includes(String(k).toLowerCase()));
  }
}

module.exports = { FormulasEngine };