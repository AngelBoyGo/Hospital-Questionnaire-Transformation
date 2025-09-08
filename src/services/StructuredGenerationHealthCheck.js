/**
 * Health check service for structured generation
 * Monitors outlines-core service availability and updates metrics
 */
const { updateStructuredGenerationServiceHealth } = require('../middleware/PerformanceMonitoring');
const StructuredGenerationClient = require('../ai/StructuredGenerationClient');

class StructuredGenerationHealthCheck {
  constructor(options = {}) {
    this.client = new StructuredGenerationClient(options);
    this.checkInterval = options.checkInterval || 30000; // 30 seconds
    this.logger = options.logger || console;
    this.isRunning = false;
    this.lastHealthStatus = null;
  }

  /**
   * Start periodic health checks
   */
  start() {
    if (this.isRunning) {
      this.logger.warn('Health check already running');
      return;
    }

    this.isRunning = true;
    this.logger.info(`Starting structured generation health checks every ${this.checkInterval}ms`);
    
    // Run initial check
    this.performHealthCheck();
    
    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.performHealthCheck();
    }, this.checkInterval);
  }

  /**
   * Stop periodic health checks
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.logger.info('Stopped structured generation health checks');
  }

  /**
   * Perform a single health check
   */
  async performHealthCheck() {
    try {
      const health = await this.client.getServiceHealth();
      const isHealthy = health.status === 'healthy' && health.outlines_available;
      
      // Update Prometheus metrics
      updateStructuredGenerationServiceHealth(this.client.serviceUrl, isHealthy);
      
      // Log status changes
      if (this.lastHealthStatus !== isHealthy) {
        const status = isHealthy ? 'HEALTHY' : 'UNHEALTHY';
        this.logger.info(`Structured generation service status changed: ${status}`);
        
        if (!isHealthy) {
          this.logger.warn(`Service details: ${JSON.stringify(health)}`);
        }
        
        this.lastHealthStatus = isHealthy;
      }
      
      return health;
      
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
      
      // Mark as unhealthy on error
      updateStructuredGenerationServiceHealth(this.client.serviceUrl, false);
      
      if (this.lastHealthStatus !== false) {
        this.logger.warn('Structured generation service marked as unhealthy due to connection error');
        this.lastHealthStatus = false;
      }
      
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get current health status
   */
  async getCurrentHealth() {
    return this.performHealthCheck();
  }

  /**
   * Get service metrics from the client
   */
  getClientMetrics() {
    return this.client.getMetrics();
  }
}

module.exports = StructuredGenerationHealthCheck;
