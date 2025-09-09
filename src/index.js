/**
 * Hospital Sandbox Generator - Main Application Entry Point
 * Enterprise deployment on OwlCloud with real container integration
 */

import express from('express');
import cors from('cors');
import helmet from('helmet');
import rateLimit from('express-rate-limit');
import SandboxBuilderReal from('./sandbox/SandboxBuilderReal');
import SRSDocumentReader from('./sandbox/SRSDocumentReader');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize sandbox builder with real deployment capabilities
const sandboxBuilder = new SandboxBuilderReal();
const srsReader = new SRSDocumentReader();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://hospital-sandbox.owlcloud.fau.edu', 'https://*.owlcloud.fau.edu']
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    realDeployment: process.env.REAL_DEPLOYMENT === 'true',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Metrics endpoint for monitoring
app.get('/metrics', (req, res) => {
  const memUsage = process.memoryUsage();
  const metrics = `
# HELP hospital_sandbox_memory_usage Memory usage in bytes
# TYPE hospital_sandbox_memory_usage gauge
hospital_sandbox_memory_rss ${memUsage.rss}
hospital_sandbox_memory_heap_used ${memUsage.heapUsed}
hospital_sandbox_memory_heap_total ${memUsage.heapTotal}

# HELP hospital_sandbox_uptime Application uptime in seconds  
# TYPE hospital_sandbox_uptime counter
hospital_sandbox_uptime ${process.uptime()}

# HELP hospital_sandbox_active_sandboxes Number of active sandbox environments
# TYPE hospital_sandbox_active_sandboxes gauge
hospital_sandbox_active_sandboxes ${sandboxBuilder.sandboxes.size}
`.trim();

  res.set('Content-Type', 'text/plain');
  res.send(metrics);
});

// API Routes

// Create sandbox environment from SRS document
app.post('/api/v1/sandbox/create', async (req, res) => {
  try {
    const { hospitalId, srsDocument } = req.body;
    
    if (!hospitalId || !srsDocument) {
      return res.status(400).json({
        error: 'Missing required fields: hospitalId and srsDocument'
      });
    }

    // Validate SRS document structure
    const validation = srsReader.validateSRSDocument(srsDocument);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Invalid SRS document structure',
        details: validation.errors
      });
    }

    // Create sandbox environment
    const result = await sandboxBuilder.createSandboxEnvironment(hospitalId, srsDocument);
    
    if (result.success) {
      res.status(201).json({
        success: true,
        sandbox: result,
        message: 'Sandbox environment created successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error creating sandbox:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while creating sandbox'
    });
  }
});

// Deploy sandbox containers
app.post('/api/v1/sandbox/:sandboxId/deploy', async (req, res) => {
  try {
    const { sandboxId } = req.params;
    
    // Deploy Docker containers
    const dockerResult = await sandboxBuilder.deployDockerContainers(sandboxId);
    if (!dockerResult.success) {
      return res.status(500).json(dockerResult);
    }

    // Deploy Kubernetes manifests
    const k8sResult = await sandboxBuilder.deployKubernetesManifests(sandboxId);
    if (!k8sResult.success) {
      return res.status(500).json(k8sResult);
    }

    res.json({
      success: true,
      sandboxId,
      deployment: {
        docker: dockerResult,
        kubernetes: k8sResult
      },
      message: 'Sandbox deployed successfully'
    });
  } catch (error) {
    console.error('Error deploying sandbox:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while deploying sandbox'
    });
  }
});

// Get sandbox status
app.get('/api/v1/sandbox/:sandboxId/status', async (req, res) => {
  try {
    const { sandboxId } = req.params;
    const status = await sandboxBuilder.getSandboxStatus(sandboxId);
    
    res.json(status);
  } catch (error) {
    console.error('Error getting sandbox status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while getting sandbox status'
    });
  }
});

// Perform health checks
app.get('/api/v1/sandbox/:sandboxId/health', async (req, res) => {
  try {
    const { sandboxId } = req.params;
    const health = await sandboxBuilder.performHealthChecks(sandboxId);
    
    res.json(health);
  } catch (error) {
    console.error('Error performing health checks:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while performing health checks'
    });
  }
});

// Get sandbox access URLs
app.get('/api/v1/sandbox/:sandboxId/urls', async (req, res) => {
  try {
    const { sandboxId } = req.params;
    const urls = await sandboxBuilder.getSandboxAccessUrls(sandboxId);
    
    res.json(urls);
  } catch (error) {
    console.error('Error getting access URLs:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while getting access URLs'
    });
  }
});

// Destroy sandbox environment
app.delete('/api/v1/sandbox/:sandboxId', async (req, res) => {
  try {
    const { sandboxId } = req.params;
    const result = await sandboxBuilder.destroySandboxEnvironment(sandboxId);
    
    res.json(result);
  } catch (error) {
    console.error('Error destroying sandbox:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while destroying sandbox'
    });
  }
});

// List all sandboxes
app.get('/api/v1/sandboxes', async (req, res) => {
  try {
    const sandboxes = Array.from(sandboxBuilder.sandboxes.entries()).map(([id, sandbox]) => ({
      sandboxId: id,
      hospitalId: sandbox.hospitalId,
      status: sandbox.status,
      createdAt: sandbox.createdAt,
      realDeployment: sandbox.realDeployment || false,
      kubernetesNamespace: sandbox.kubernetesNamespace
    }));
    
    res.json({
      success: true,
      sandboxes,
      count: sandboxes.length
    });
  } catch (error) {
    console.error('Error listing sandboxes:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while listing sandboxes'
    });
  }
});

// Get real-time metrics for a sandbox
app.get('/api/v1/sandbox/:sandboxId/metrics', async (req, res) => {
  try {
    const { sandboxId } = req.params;
    const metrics = await sandboxBuilder.getRealTimeMetrics(sandboxId);
    
    res.json(metrics);
  } catch (error) {
    console.error('Error getting sandbox metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while getting sandbox metrics'
    });
  }
});

// Scale sandbox resources
app.post('/api/v1/sandbox/:sandboxId/scale', async (req, res) => {
  try {
    const { sandboxId } = req.params;
    const { scaleConfig } = req.body;
    
    const result = await sandboxBuilder.scaleSandboxResources(sandboxId, scaleConfig);
    
    res.json(result);
  } catch (error) {
    console.error('Error scaling sandbox:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while scaling sandbox'
    });
  }
});

// Serve static files (for future web UI)
app.use(express.static('public'));

// Default route
app.get('/', (req, res) => {
  res.json({
    name: 'Hospital Sandbox Generator',
    version: '1.0.0',
    description: 'Enterprise-grade sandbox environment generator for healthcare systems',
    realDeployment: process.env.REAL_DEPLOYMENT === 'true',
    platform: 'OwlCloud Kubernetes',
    endpoints: {
      health: '/health',
      metrics: '/metrics',
      api: '/api/v1',
      documentation: '/api/docs'
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  
  // Clean up any active sandboxes if needed
  console.log(`Active sandboxes: ${sandboxBuilder.sandboxes.size}`);
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🏥 Hospital Sandbox Generator started on port ${PORT}`);
  console.log(`🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔧 Real deployment: ${process.env.REAL_DEPLOYMENT === 'true'}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📈 Metrics: http://localhost:${PORT}/metrics`);
  console.log(`🔗 API: http://localhost:${PORT}/api/v1`);
});

module.exports = app;
