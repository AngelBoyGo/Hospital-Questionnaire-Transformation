const prometheus = require('prom-client');

const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
});

const transformationDuration = new prometheus.Histogram({
  name: 'transformation_duration_seconds',
  help: 'Duration of transformations in seconds',
  labelNames: ['hospital_type', 'document_type'],
  buckets: [1, 2, 5, 10, 15, 30, 60]
});

// AI metrics
const aiRequestDuration = new prometheus.Histogram({
  name: 'ai_request_duration_seconds',
  help: 'Duration of AI SRS requests in seconds',
  labelNames: ['model', 'outcome', 'generation_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
});
const aiTokensTotal = new prometheus.Counter({
  name: 'ai_tokens_total',
  help: 'Total AI tokens consumed',
  labelNames: ['model', 'generation_type']
});
const aiCostUsdTotal = new prometheus.Counter({
  name: 'ai_cost_usd_total',
  help: 'Total AI cost in USD (estimated)',
  labelNames: ['model', 'generation_type']
});
const aiErrorsTotal = new prometheus.Counter({
  name: 'ai_errors_total',
  help: 'Total AI orchestration errors',
  labelNames: ['type', 'generation_type']
});

// Structured generation specific metrics
const structuredGenerationRequests = new prometheus.Counter({
  name: 'structured_generation_requests_total',
  help: 'Total structured generation requests',
  labelNames: ['status', 'fallback_used']
});

const structuredGenerationValidationScore = new prometheus.Histogram({
  name: 'structured_generation_validation_score',
  help: 'Validation score for structured generation (0.0-1.0)',
  labelNames: ['generation_type'],
  buckets: [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.98, 1.0]
});

const structuredGenerationServiceHealth = new prometheus.Gauge({
  name: 'structured_generation_service_healthy',
  help: 'Whether structured generation service is healthy (1=healthy, 0=unhealthy)',
  labelNames: ['service_url']
});

const structuredGenerationFallbackRate = new prometheus.Gauge({
  name: 'structured_generation_fallback_rate',
  help: 'Rate of fallback usage in structured generation (0.0-1.0)',
  labelNames: ['fallback_reason']
});

const memoryUsage = new prometheus.Gauge({ name: 'nodejs_memory_usage_bytes', help: 'Memory usage in bytes', labelNames: ['type'] });
const activeConnections = new prometheus.Gauge({ name: 'active_connections_total', help: 'Number of active connections' });

function performanceMiddleware(req, res, next) {
  const start = Date.now();
  activeConnections.inc();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration.labels(req.method, req.route?.path || req.path, res.statusCode).observe(duration);
    activeConnections.dec();
  });
  next();
}

function trackTransformation(hospitalType, documentType, duration) {
  transformationDuration.labels(hospitalType, documentType).observe(duration);
}

function trackAiRequest(model, outcome, tokensUsed, costUsd, durationMs, generationType = 'claude') {
  const seconds = (durationMs || 0) / 1000;
  try {
    aiRequestDuration.labels(model || 'unknown', outcome || 'unknown', generationType).observe(seconds);
    if (typeof tokensUsed === 'number' && tokensUsed > 0) aiTokensTotal.labels(model || 'unknown', generationType).inc(tokensUsed);
    if (typeof costUsd === 'number' && costUsd > 0) aiCostUsdTotal.labels(model || 'unknown', generationType).inc(costUsd);
  } catch (_) {
    // swallow metric errors
  }
}

function trackStructuredGeneration(status, fallbackUsed, validationScore, generationType = 'structured', fallbackReason = null) {
  try {
    structuredGenerationRequests.labels(status, fallbackUsed ? 'true' : 'false').inc();
    
    if (typeof validationScore === 'number') {
      structuredGenerationValidationScore.labels(generationType).observe(validationScore);
    }
    
    if (fallbackReason) {
      structuredGenerationFallbackRate.labels(fallbackReason).set(1);
    }
  } catch (_) {
    // swallow metric errors
  }
}

function updateStructuredGenerationServiceHealth(serviceUrl, isHealthy) {
  try {
    structuredGenerationServiceHealth.labels(serviceUrl || 'unknown').set(isHealthy ? 1 : 0);
  } catch (_) {
    // swallow metric errors
  }
}

setInterval(() => {
  const u = process.memoryUsage();
  memoryUsage.labels('heap_used').set(u.heapUsed);
  memoryUsage.labels('heap_total').set(u.heapTotal);
  memoryUsage.labels('external').set(u.external);
  memoryUsage.labels('rss').set(u.rss);
}, 5000).unref();

async function getMetrics() {
  return prometheus.register.metrics();
}

module.exports = { 
  performanceMiddleware, 
  trackTransformation, 
  trackAiRequest, 
  trackStructuredGeneration,
  updateStructuredGenerationServiceHealth,
  getMetrics, 
  prometheus 
};


