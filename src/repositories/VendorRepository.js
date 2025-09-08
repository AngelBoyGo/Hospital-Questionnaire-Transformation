class VendorRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async seedVendorData() {
    // Data seeded by migration
    const res = await this.pool.query('SELECT COUNT(*) FROM vendor_compatibility');
    if (parseInt(res.rows[0].count, 10) === 0) {
      throw new Error('Vendor compatibility seed failed');
    }
  }

  async getVendorCompatibility(vendorName, facilityType) {
    const q = `SELECT integration_complexity, base_cost, implementation_weeks, requirements FROM vendor_compatibility WHERE vendor_name = $1 AND facility_type = $2`;
    const res = await this.pool.query(q, [vendorName.toLowerCase(), facilityType]);
    if (res.rows.length === 0) throw new Error(`No compatibility data found for ${vendorName} + ${facilityType}`);
    const r = res.rows[0];
    return {
      integrationComplexity: r.integration_complexity,
      baseCost: parseFloat(r.base_cost),
      implementationWeeks: r.implementation_weeks,
      requirements: typeof r.requirements === 'string' ? JSON.parse(r.requirements) : r.requirements
    };
  }

  async getAllVendors() {
    const res = await this.pool.query('SELECT DISTINCT vendor_name FROM vendor_compatibility ORDER BY vendor_name');
    return res.rows.map(x => x.vendor_name);
  }

  async getCompatibilityMatrix(facilityType) {
    const q = `SELECT vendor_name, integration_complexity, base_cost, implementation_weeks FROM vendor_compatibility WHERE facility_type = $1 ORDER BY base_cost ASC`;
    const res = await this.pool.query(q, [facilityType]);
    return res.rows.map(row => ({ vendor: row.vendor_name, complexity: row.integration_complexity, cost: parseFloat(row.base_cost), weeks: row.implementation_weeks }));
  }
}

module.exports = VendorRepository;


