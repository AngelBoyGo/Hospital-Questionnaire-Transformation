class RAGRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async runMigrations() {
    const fs = require('fs').promises;
    const path = require('path');
    const p = path.join(__dirname, '../../migrations/002_pgvector_and_knowledge.sql');
    try {
      const sql = await fs.readFile(p, 'utf8');
      await this.pool.query(sql);
    } catch (e) {
      if (!/already exists/i.test(e.message)) throw e;
    }
  }

  async upsertChunk({ tenantId, source, url, content, embedding }) {
    const q = `
      INSERT INTO knowledge_chunks (tenant_id, source, url, content, embedding)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    const r = await this.pool.query(q, [tenantId || null, source, url || null, content, embedding || null]);
    return r.rows[0].id;
  }

  async searchByEmbedding({ embedding, limit = 5 }) {
    // Fallback if pgvector not available: return empty
    try {
      const q = `
        SELECT id, source, url, content
        FROM knowledge_chunks
        ORDER BY embedding <-> $1
        LIMIT $2
      `;
      const r = await this.pool.query(q, [embedding, limit]);
      return r.rows;
    } catch {
      return [];
    }
  }

  async searchByKeyword({ query, limit = 5 }) {
    try {
      const terms = String(query || '')
        .toLowerCase()
        .split(/\W+/)
        .filter(Boolean)
        .slice(0, 5);
      if (terms.length === 0) return [];
      const likeClauses = terms.map((_, i) => `content ILIKE $${i + 1}`).join(' OR ');
      const params = terms.map(t => `%${t}%`);
      const sql = `SELECT id, source, url, content FROM knowledge_chunks WHERE ${likeClauses} LIMIT ${limit}`;
      const r = await this.pool.query(sql, params);
      return r.rows;
    } catch {
      return [];
    }
  }
}

module.exports = RAGRepository;


