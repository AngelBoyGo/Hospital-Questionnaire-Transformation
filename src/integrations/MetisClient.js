// Metis Backend Integration Client (mockable)
const axios = require('axios');

class MetisClient {
  constructor({ baseUrl, apiKey, logger, mock = true, maxRetries, retryDelayMs } = {}) {
    this.baseUrl = baseUrl || process.env.METIS_BASE_URL || 'https://mock.metis.local';
    this.apiKey = apiKey || process.env.METIS_API_KEY || 'mock-key';
    this.logger = logger || console;
    this.mock = process.env.METIS_MOCK === 'false' ? false : mock;
    this.maxRetries = Number(process.env.METIS_MAX_RETRIES || maxRetries || 3);
    this.retryDelayMs = Number(process.env.METIS_RETRY_DELAY_MS || retryDelayMs || 500);
  }

  async sendReport({ hospitalId, transformationId, documents, metadata = {} }) {
    if (this.mock) {
      this.logger.info('[METIS MOCK] sendReport', { hospitalId, transformationId, docs: Object.keys(documents || {}) });
      return { success: true, metisJobId: `mock_${Date.now()}` };
    }

    const url = `${this.baseUrl}/api/reports`;
    const payload = { hospitalId, transformationId, documents, metadata };
    const headers = this.buildAuthHeaders();
    return await this.requestWithRetry('post', url, { data: payload, headers, timeout: 15000 });
  }

  async getStatus(metisJobId) {
    if (this.mock) {
      return { metisJobId, status: 'processed', updatedAt: new Date().toISOString() };
    }
    const url = `${this.baseUrl}/api/reports/${encodeURIComponent(metisJobId)}`;
    const headers = this.buildAuthHeaders();
    return await this.requestWithRetry('get', url, { headers, timeout: 10000 });
  }

  async health() {
    if (this.mock) {
      return { status: 'mock_operational' };
    }
    const url = `${this.baseUrl}/health`;
    return await this.requestWithRetry('get', url, { timeout: 5000 });
  }

  buildAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  async requestWithRetry(method, url, options = {}) {
    let attempt = 0;
    let lastError;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        this.logger.info(`[METIS] ${method.toUpperCase()} ${url} (attempt ${attempt + 1})`);
        const response = await axios({ method, url, ...options });
        this.logger.info(`[METIS] Success ${method.toUpperCase()} ${url}`, { status: response.status });
        return response.data;
      } catch (error) {
        lastError = error;
        const status = error?.response?.status;
        const isRetryable = this.isRetryableError(status, error);
        attempt += 1;
        this.logger.warn(`[METIS] Request failed (attempt ${attempt})`, { status, message: error.message });
        if (!isRetryable || attempt > this.maxRetries) {
          this.logger.error('[METIS] Giving up after attempts', { attempts: attempt, url, method });
          throw new Error(`METIS request failed: ${status || 'no-status'} ${error.message}`);
        }
        await this.delay(this.getBackoffDelay(attempt));
      }
    }
  }

  isRetryableError(status, error) {
    if (!status) return true; // network errors, timeouts
    if ([429, 502, 503, 504].includes(status)) return true;
    // retry ECONNRESET / ETIMEDOUT
    const code = error?.code || '';
    return ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN'].includes(code);
  }

  getBackoffDelay(attempt) {
    const jitter = Math.floor(Math.random() * 100);
    return Math.min(5000, this.retryDelayMs * Math.pow(2, attempt - 1)) + jitter;
  }

  delay(ms) { return new Promise(res => setTimeout(res, ms)); }
}

module.exports = MetisClient;