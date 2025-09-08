/**
 * Client for structured SRS generation service
 * Integrates Node.js application with Python outlines-core service
 */
const axios = require('axios');
const EventEmitter = require('events');

class StructuredGenerationClient extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.serviceUrl = options.serviceUrl || process.env.STRUCTURED_GENERATION_SERVICE_URL || 'http://localhost:8001';
    this.timeout = options.timeout || 60000; // 60 second timeout
    this.retries = options.retries || 3;
    this.enableFallback = options.enableFallback !== false; // Default true
    
    // Metrics tracking
    this.metrics = {
      totalRequests: 0,
      totalErrors: 0,
      totalTokens: 0,
      totalResponseTime: 0,
      fallbackUsage: 0,
      get averageResponseTime() {
        return this.totalRequests > 0 ? this.totalResponseTime / this.totalRequests : 0;
      },
      get errorRate() {
        return this.totalRequests > 0 ? this.totalErrors / this.totalRequests : 0;
      },
      get fallbackRate() {
        return this.totalRequests > 0 ? this.fallbackUsage / this.totalRequests : 0;
      }
    };
    
    // Configure axios defaults
    this.httpClient = axios.create({
      baseURL: this.serviceUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Metis-Transformation-Engine/1.0'
      }
    });
  }

  /**
   * Generate structured SRS using outlines-core service
   * @param {Object} questionnaire - Hospital questionnaire data
   * @param {Object} context - Generation context and guidelines
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Structured SRS result
   */
  async generateStructuredSRS(questionnaire, context = {}, options = {}) {
    if (!questionnaire || typeof questionnaire !== 'object' || Object.keys(questionnaire).length === 0) {
      throw new Error('Invalid questionnaire: must be a non-empty object');
    }

    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      const requestData = {
        questionnaire,
        context,
        max_tokens: options.maxTokens || 5000,
        enable_fallback: options.enableFallback !== false
      };

      const result = await this._makeRequestWithRetry('/generate-srs', requestData);
      
      // Update metrics
      const responseTime = Date.now() - startTime;
      this.metrics.totalResponseTime += responseTime;
      this.metrics.totalTokens += result.metadata.tokens_used || 0;
      
      if (result.metadata.used_fallback) {
        this.metrics.fallbackUsage++;
      }

      // Emit success event
      this.emit('generation_success', {
        responseTime,
        tokensUsed: result.metadata.tokens_used,
        validationScore: result.validation_score,
        usedFallback: result.metadata.used_fallback
      });

      return result;

    } catch (error) {
      this.metrics.totalErrors++;
      
      // Try fallback if enabled and error is service-related
      if (this.enableFallback && this._isServiceError(error)) {
        console.warn('Structured generation service failed, using fallback:', error.message);
        
        const fallbackResult = this._generateFallbackSRS(questionnaire, context);
        this.metrics.fallbackUsage++;
        
        this.emit('fallback_used', { error: error.message, questionnaire });
        
        return fallbackResult;
      }

      this.emit('generation_error', { error: error.message, questionnaire });
      
      if (error.message.includes('timeout')) {
        throw new Error('Structured generation service timeout');
      } else if (this._isServiceError(error)) {
        throw new Error('Structured generation service unavailable');
      } else {
        throw error;
      }
    }
  }

  /**
   * Validate SRS structure against schema
   * @param {Object} srsData - SRS data to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateSRS(srsData) {
    try {
      const response = await this.httpClient.post('/validate-srs', srsData);
      return response.data;
    } catch (error) {
      throw new Error(`SRS validation failed: ${error.message}`);
    }
  }

  /**
   * Get service health status
   * @returns {Promise<Object>} Health status
   */
  async getServiceHealth() {
    try {
      const response = await this.httpClient.get('/health');
      return response.data;
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
        outlines_available: false,
        generator_initialized: false
      };
    }
  }

  /**
   * Get current SRS schema
   * @returns {Promise<Object>} Schema definition
   */
  async getSchema() {
    try {
      const response = await this.httpClient.get('/schema');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to retrieve schema: ${error.message}`);
    }
  }

  /**
   * Get service metrics
   * @returns {Object} Current metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Reset metrics counters
   */
  resetMetrics() {
    this.metrics.totalRequests = 0;
    this.metrics.totalErrors = 0;
    this.metrics.totalTokens = 0;
    this.metrics.totalResponseTime = 0;
    this.metrics.fallbackUsage = 0;
  }

  /**
   * Make HTTP request with retry logic
   * @private
   */
  async _makeRequestWithRetry(endpoint, data, attempt = 1) {
    try {
      const response = await this.httpClient.post(endpoint, data);
      return response.data;
    } catch (error) {
      if (attempt < this.retries && this._isRetryableError(error)) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
        await this._sleep(delay);
        return this._makeRequestWithRetry(endpoint, data, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Check if error is service-related (connection, timeout, 5xx)
   * @private
   */
  _isServiceError(error) {
    return (
      error.code === 'ECONNREFUSED' ||
      error.code === 'ENOTFOUND' ||
      error.message.includes('timeout') ||
      (error.response && error.response.status >= 500)
    );
  }

  /**
   * Check if error is retryable
   * @private
   */
  _isRetryableError(error) {
    return (
      this._isServiceError(error) ||
      (error.response && [502, 503, 504].includes(error.response.status))
    );
  }

  /**
   * Generate fallback SRS when service is unavailable
   * @private
   */
  _generateFallbackSRS(questionnaire, context) {
    const hospitalName = questionnaire.hospitalName || 'Unknown Hospital';
    const bedCount = questionnaire.bedCount || 100;
    const currentEHR = questionnaire.currentEHR || 'Unknown EHR';

    const fallbackSRS = {
      functionalRequirements: [
        {
          id: 'FR-FALLBACK-001',
          text: `System integration required for ${hospitalName}`,
          acceptance: 'Integration completed and tested'
        },
        {
          id: 'FR-FALLBACK-002',
          text: `Support for ${bedCount} patient capacity`,
          acceptance: 'Load testing confirms capacity'
        }
      ],
      nonFunctionalRequirements: [
        {
          id: 'NFR-FALLBACK-001',
          text: 'System response time under 3 seconds',
          acceptance: 'Performance testing validates requirement'
        },
        {
          id: 'NFR-FALLBACK-002',
          text: 'High availability with 99.5% uptime',
          acceptance: 'Monitoring confirms SLA compliance'
        }
      ],
      compliance: {
        hipaa: {
          encryption: 'AES-256 encryption required',
          access_controls: 'Role-based access with audit trails',
          data_retention: 'Compliant data retention policies'
        },
        hl7: {
          version: 'FHIR R4 compatibility required',
          message_types: 'Standard ADT, ORU, ORM messages',
          interoperability: 'IHE profile compliance'
        }
      },
      vendorIntegrations: [
        {
          vendor: currentEHR,
          system: 'Electronic Health Records',
          complexity: 'medium',
          estimatedHours: 160
        }
      ],
      implementationPhases: [
        {
          phase: 'Assessment and Planning',
          duration: '4 weeks',
          deliverables: ['System analysis', 'Integration plan', 'Risk assessment']
        },
        {
          phase: 'Implementation',
          duration: '8 weeks',
          deliverables: ['System integration', 'Testing', 'Documentation']
        }
      ],
      citations: [
        {
          title: 'HIPAA Compliance Guidelines',
          url: 'https://www.hhs.gov/hipaa/for-professionals/index.html'
        }
      ],
      traceability: {
        requirements_to_design: {
          'FR-FALLBACK-001': ['Design-001: Integration Architecture'],
          'NFR-FALLBACK-001': ['Design-002: Performance Architecture']
        },
        design_to_implementation: {
          'Design-001': ['Implementation-001: API Gateway'],
          'Design-002': ['Implementation-002: Caching Layer']
        }
      }
    };

    return {
      srs: fallbackSRS,
      metadata: {
        generation_time_ms: 100, // Fast fallback
        tokens_used: 0,
        iterations: 1,
        used_fallback: true,
        validation_score: 0.8, // Lower score for fallback
        generator_version: 'fallback-1.0'
      },
      validation_score: 0.8
    };
  }

  /**
   * Sleep utility for retry delays
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = StructuredGenerationClient;
