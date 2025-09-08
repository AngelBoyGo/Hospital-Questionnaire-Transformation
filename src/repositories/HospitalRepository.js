const fs = require('fs').promises;
const path = require('path');

class HospitalRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async runMigrations() {
    const migrationPath = path.join(__dirname, '..', '..', 'migrations', '001_initial_schema.sql');
    const sql = await fs.readFile(migrationPath, 'utf8');
    await this.pool.query(sql);
  }

  async createHospital(h) {
    const q = `
      INSERT INTO hospitals (tenant_id, name, facility_type, bed_count, current_ehr, location)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;
    const vals = [h.tenantId, h.name, h.facilityType, h.bedCount, h.currentEHR, h.location ? JSON.stringify(h.location) : null];
    const res = await this.pool.query(q, vals);
    return res.rows[0].id;
    }

  async getHospital(id) {
    const q = `SELECT id, tenant_id, name, facility_type, bed_count, current_ehr, location, created_at, updated_at FROM hospitals WHERE id = $1`;
    const res = await this.pool.query(q, [id]);
    if (res.rows.length === 0) throw new Error('Hospital not found');
    const row = res.rows[0];
    row.location = typeof row.location === 'string' ? JSON.parse(row.location) : row.location;
    return row;
  }

  async storeTransformation(t) {
    const q = `
      INSERT INTO transformations (hospital_id, questionnaire_data, transformation_result, generated_documents, processing_time, user_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;
    const vals = [t.hospitalId, JSON.stringify(t.questionnaireData), JSON.stringify(t.transformationResult), t.generatedDocuments, t.processingTime, t.userId];
    const res = await this.pool.query(q, vals);
    return res.rows[0].id;
  }

  async getTransformation(id) {
    const q = `SELECT id, hospital_id, questionnaire_data, transformation_result, generated_documents, processing_time, user_id, created_at FROM transformations WHERE id = $1`;
    const res = await this.pool.query(q, [id]);
    if (res.rows.length === 0) throw new Error('Transformation not found');
    const row = res.rows[0];
    row.questionnaireData = typeof row.questionnaire_data === 'string' ? JSON.parse(row.questionnaire_data) : row.questionnaire_data;
    row.transformationResult = typeof row.transformation_result === 'string' ? JSON.parse(row.transformation_result) : row.transformation_result;
    return row;
  }
}

module.exports = HospitalRepository;


