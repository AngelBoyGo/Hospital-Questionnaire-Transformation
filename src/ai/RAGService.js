class InMemoryRAGService {
  constructor() {
    this.docs = [];
  }

  addDocument({ id, content, metadata }) {
    this.docs.push({ id: id || String(this.docs.length + 1), content, metadata: metadata || {} });
  }

  // Naive keyword-based retrieval stub
  retrieve(query, topK = 3) {
    const terms = String(query || '').toLowerCase().split(/\W+/).filter(Boolean);
    const scored = this.docs.map(d => {
      const score = terms.reduce((acc, t) => acc + (d.content.toLowerCase().includes(t) ? 1 : 0), 0);
      return { doc: d, score };
    }).sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).filter(s => s.score > 0).map(s => s.doc);
  }
}

module.exports = { InMemoryRAGService };


