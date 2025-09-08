class AIUsageRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async runMigrations() {
    const fs = require('fs').promises;
    const path = require('path');
    const p = path.join(__dirname, '../../migrations/003_ai_usage.sql');
    try {
      const sql = await fs.readFile(p, 'utf8');
      await this.pool.query(sql);
    } catch (e) {
      if (!/already exists/i.test(e.message)) throw e;
    }
  }

  async addUsage(tenantId, spentUsd, tokens) {
    const q = `
      INSERT INTO ai_usage (tenant_id, spent_usd, tokens)
      VALUES ($1, $2, $3)
      ON CONFLICT (tenant_id, period)
      DO UPDATE SET spent_usd = ai_usage.spent_usd + EXCLUDED.spent_usd,
                    tokens = ai_usage.tokens + EXCLUDED.tokens,
                    updated_at = NOW()
      RETURNING tenant_id, period, spent_usd, tokens
    `;
    const r = await this.pool.query(q, [tenantId, spentUsd, tokens]);
    return r.rows[0];
  }

  async getUsage(tenantId, fromDate, toDate) {
    let q = `SELECT tenant_id, period, spent_usd, tokens FROM ai_usage WHERE tenant_id = $1`;
    const params = [tenantId];
    if (fromDate) { params.push(fromDate); q += ` AND period >= $${params.length}`; }
    if (toDate) { params.push(toDate); q += ` AND period <= $${params.length}`; }
    q += ` ORDER BY period DESC LIMIT 90`;
    const r = await this.pool.query(q, params);
    return r.rows;
  }
}

module.exports = AIUsageRepository;


