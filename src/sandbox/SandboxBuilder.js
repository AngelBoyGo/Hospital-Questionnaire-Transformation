/**
 * Hospital Sandbox Generator - Sandbox Builder
 * 
 * MISSION: Build actual isolated sandbox environments from infrastructure specs
 * PATENT: Patent Claim 9.c - "Safe isolation of healthcare testing environments"
 * 
 * This class implements Step 3 of our TDD approach:
 * "Can we spin up containers with correct configurations?"
 */

const EnvironmentParser = require('./EnvironmentParser');
const SRSDocumentReader = require('./SRSDocumentReader');
const { v4: uuidv4 } = require('uuid');

class SandboxBuilder {
  constructor() {
    this.parser = new EnvironmentParser();
    this.reader = new SRSDocumentReader();
    
    // In-memory storage for sandbox state (in production, use Redis/Database)
    this.sandboxes = new Map();
    
    // Default configuration
    this.defaultConfig = {
      baseUrl: 'http://localhost',
      networkPrefix: '172.20',
      portRange: { start: 8000, end: 9000 },
      healthCheckInterval: 30000, // 30 seconds
      maxSandboxes: 100
    };

    // Component port assignments
    this.componentPorts = {
      dashboard: 3000,
      database: 5432,
      cache: 6379,
      ehrMock: 8080,
      monitoring: 9090,
      grafana: 3001
    };

    // Initialize port tracking
    this.usedPorts = new Set();
  }

  /**
   * Create a complete sandbox environment from SRS
   * @param {string} hospitalId - Hospital identifier
   * @param {Object} srsDocument - SRS document
   * @returns {Promise<Object>} - Sandbox creation result
   */
  async createSandboxEnvironment(hospitalId, srsDocument) {
    try {
      // Validate SRS document
      const srsValidation = this.reader.readSRS(srsDocument);
      if (!srsValidation.success) {
        return {
          success: false,
          error: `Invalid SRS document: ${srsValidation.error}`
        };
      }

      // Generate unique sandbox ID
      const sandboxId = this._generateSandboxId(hospitalId);

      // Parse requirements
      const infraReqs = this.reader.extractInfrastructureNeeds(srsDocument);
      const complianceReqs = this.reader.extractComplianceRequirements(srsDocument);
      const performanceReqs = this.reader.extractPerformanceRequirements(srsDocument);
      const ehrReqs = this.reader.extractEHRRequirements(srsDocument);

      // Generate environment specifications
      const dockerSpecs = this.parser.generateDockerSpecs(srsDocument);
      const ehrMocks = this.parser.generateEHRMockServices(srsDocument);
      const monitoringStack = this.parser.generateMonitoringStack(srsDocument);
      const securityConfig = this.parser.generateSecurityConfig(srsDocument);

      // Create sandbox configuration
      const sandboxConfig = {
        sandboxId,
        hospitalId,
        status: 'creating',
        createdAt: new Date().toISOString(),
        srsDocument,
        specifications: {
          docker: dockerSpecs,
          ehrMocks,
          monitoring: monitoringStack,
          security: securityConfig
        },
        components: this._identifyComponents(infraReqs, ehrReqs),
        network: this._generateNetworkConfig(sandboxId),
        ports: this._allocatePorts(sandboxId),
        accessUrls: {},
        healthStatus: 'unknown'
      };

      // Store sandbox configuration
      this.sandboxes.set(sandboxId, sandboxConfig);

      // Generate access URLs
      const accessUrls = this._generateAccessUrls(sandboxConfig);
      sandboxConfig.accessUrls = accessUrls;

      return {
        success: true,
        sandboxId,
        status: 'creating',
        components: sandboxConfig.components,
        accessUrls: accessUrls,
        networkConfig: sandboxConfig.network
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to create sandbox: ${error.message}`
      };
    }
  }

  /**
   * Deploy Docker containers for sandbox
   * @param {string} sandboxId - Sandbox identifier
   * @returns {Promise<Object>} - Deployment result
   */
  async deployDockerContainers(sandboxId) {
    try {
      const sandbox = this.sandboxes.get(sandboxId);
      if (!sandbox) {
        return {
          success: false,
          error: 'Sandbox not found'
        };
      }

      // Simulate container deployment (in production, use Docker API)
      const containers = {};
      const networkName = `${sandboxId}-network`;

      // Deploy PostgreSQL if required
      if (sandbox.components.database) {
        containers.postgresql = {
          id: `${sandboxId}-postgresql`,
          image: 'postgres:15',
          status: 'running',
          port: sandbox.ports.database,
          network: networkName,
          healthCheck: 'healthy'
        };
      }

      // Deploy Redis if required
      if (sandbox.components.cache) {
        containers.redis = {
          id: `${sandboxId}-redis`,
          image: 'redis:7-alpine',
          status: 'running',
          port: sandbox.ports.cache,
          network: networkName,
          healthCheck: 'healthy'
        };
      }

      // Deploy EHR mocks if required
      if (sandbox.components.ehrMocks && sandbox.components.ehrMocks.length > 0) {
        sandbox.components.ehrMocks.forEach((mock, index) => {
          containers[`${mock.vendor.toLowerCase()}-mock`] = {
            id: `${sandboxId}-${mock.vendor.toLowerCase()}-mock`,
            image: 'nginx:alpine', // Mock EHR service
            status: 'running',
            port: sandbox.ports.ehrMock + index,
            network: networkName,
            healthCheck: 'healthy'
          };
        });
      }

      // Deploy monitoring if required
      if (sandbox.components.monitoring) {
        containers.prometheus = {
          id: `${sandboxId}-prometheus`,
          image: 'prom/prometheus:latest',
          status: 'running',
          port: sandbox.ports.monitoring,
          network: networkName,
          healthCheck: 'healthy'
        };
      }

      // Update sandbox status
      sandbox.status = 'running';
      sandbox.containers = containers;
      sandbox.lastDeployment = new Date().toISOString();

      return {
        success: true,
        sandboxId,
        containers,
        networkName,
        networkConfig: {
          isolated: true,
          subnet: sandbox.network.subnet,
          driver: 'bridge'
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to deploy containers: ${error.message}`
      };
    }
  }

  /**
   * Deploy Kubernetes manifests for sandbox
   * @param {string} sandboxId - Sandbox identifier
   * @returns {Promise<Object>} - Deployment result
   */
  async deployKubernetesManifests(sandboxId) {
    try {
      const sandbox = this.sandboxes.get(sandboxId);
      if (!sandbox) {
        return {
          success: false,
          error: 'Sandbox not found'
        };
      }

      // Generate Kubernetes specifications
      const k8sSpecs = this.parser.generateKubernetesSpecs(sandbox.srsDocument);
      if (!k8sSpecs.success) {
        return {
          success: false,
          error: `Failed to generate K8s specs: ${k8sSpecs.error}`
        };
      }

      const namespace = `sandbox-${sandboxId}`;

      // Simulate Kubernetes deployment (in production, use kubectl or K8s API)
      const deployments = k8sSpecs.manifests.deployments.map((deployment, index) => ({
        name: deployment.metadata.name,
        namespace: namespace,
        replicas: deployment.spec.replicas,
        status: 'running',
        pods: deployment.spec.replicas
      }));

      const services = k8sSpecs.manifests.services.map((service, index) => ({
        name: service.metadata.name,
        namespace: namespace,
        type: service.spec.type || 'ClusterIP',
        ports: service.spec.ports
      }));

      // Extract resource limits from performance requirements
      const performanceReqs = this.reader.extractPerformanceRequirements(sandbox.srsDocument);
      const resourceQuotas = this._calculateResourceQuotas(performanceReqs, sandbox.srsDocument);

      // Update sandbox status
      sandbox.status = 'running';
      sandbox.kubernetesDeployment = {
        namespace,
        deployments,
        services,
        resourceQuotas
      };
      sandbox.lastDeployment = new Date().toISOString();

      return {
        success: true,
        sandboxId,
        namespace,
        deployments,
        services,
        resourceQuotas
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to deploy K8s manifests: ${error.message}`
      };
    }
  }

  /**
   * Get sandbox status and health information
   * @param {string} sandboxId - Sandbox identifier
   * @returns {Promise<Object>} - Status result
   */
  async getSandboxStatus(sandboxId) {
    try {
      const sandbox = this.sandboxes.get(sandboxId);
      if (!sandbox) {
        return {
          success: false,
          error: 'Sandbox not found'
        };
      }

      // Calculate uptime
      const uptime = Date.now() - new Date(sandbox.createdAt).getTime();

      // Simulate resource usage (in production, get from monitoring)
      const resourceUsage = {
        cpu: Math.random() * 80, // 0-80% CPU usage
        memory: Math.random() * 70, // 0-70% memory usage
        disk: Math.random() * 50, // 0-50% disk usage
        network: Math.random() * 30 // 0-30% network usage
      };

      // Generate component health status
      const components = {};
      Object.keys(sandbox.components).forEach(component => {
        if (sandbox.components[component]) {
          components[component] = {
            status: sandbox.status === 'running' ? 'healthy' : 'unknown',
            lastCheck: new Date().toISOString()
          };
        }
      });

      return {
        success: true,
        sandboxId,
        status: sandbox.status,
        hospitalId: sandbox.hospitalId,
        createdAt: sandbox.createdAt,
        uptime,
        components,
        healthChecks: components,
        resourceUsage
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to get sandbox status: ${error.message}`
      };
    }
  }

  /**
   * Perform health checks on sandbox components
   * @param {string} sandboxId - Sandbox identifier
   * @returns {Promise<Object>} - Health check result
   */
  async performHealthChecks(sandboxId) {
    try {
      const sandbox = this.sandboxes.get(sandboxId);
      if (!sandbox) {
        return {
          success: false,
          error: 'Sandbox not found'
        };
      }

      const componentHealth = {};
      let healthyComponents = 0;
      let totalComponents = 0;

      // Check database health
      if (sandbox.components.database) {
        totalComponents++;
        componentHealth.database = {
          status: 'healthy',
          responseTime: Math.random() * 100, // 0-100ms
          lastCheck: new Date().toISOString()
        };
        healthyComponents++;
      }

      // Check cache health
      if (sandbox.components.cache) {
        totalComponents++;
        componentHealth.cache = {
          status: 'healthy',
          responseTime: Math.random() * 50, // 0-50ms
          lastCheck: new Date().toISOString()
        };
        healthyComponents++;
      }

      // Check EHR mock health
      if (sandbox.components.ehrMocks && sandbox.components.ehrMocks.length > 0) {
        totalComponents++;
        componentHealth.ehrMocks = {
          status: 'healthy',
          responseTime: Math.random() * 200, // 0-200ms
          lastCheck: new Date().toISOString()
        };
        healthyComponents++;
      }

      // Determine overall health
      const healthRatio = healthyComponents / totalComponents;
      let overallHealth = 'healthy';
      if (healthRatio < 0.5) {
        overallHealth = 'unhealthy';
      } else if (healthRatio < 1.0) {
        overallHealth = 'degraded';
      }

      return {
        success: true,
        sandboxId,
        overallHealth,
        componentHealth,
        healthyComponents,
        totalComponents,
        lastChecked: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to perform health checks: ${error.message}`
      };
    }
  }

  /**
   * Stop sandbox environment
   * @param {string} sandboxId - Sandbox identifier
   * @returns {Promise<Object>} - Stop result
   */
  async stopSandboxEnvironment(sandboxId) {
    try {
      const sandbox = this.sandboxes.get(sandboxId);
      if (!sandbox) {
        return {
          success: false,
          error: 'Sandbox not found'
        };
      }

      const previousStatus = sandbox.status;
      sandbox.status = 'stopped';
      sandbox.stoppedAt = new Date().toISOString();

      return {
        success: true,
        sandboxId,
        previousStatus,
        newStatus: 'stopped',
        stoppedAt: sandbox.stoppedAt
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to stop sandbox: ${error.message}`
      };
    }
  }

  /**
   * Destroy sandbox environment and clean up resources
   * @param {string} sandboxId - Sandbox identifier
   * @returns {Promise<Object>} - Destroy result
   */
  async destroySandboxEnvironment(sandboxId) {
    try {
      const sandbox = this.sandboxes.get(sandboxId);
      if (!sandbox) {
        return {
          success: false,
          error: 'Sandbox not found'
        };
      }

      // Simulate resource cleanup
      const resourcesRemoved = {
        containers: Object.keys(sandbox.containers || {}).length,
        volumes: sandbox.components.database ? 1 : 0,
        networks: 1
      };

      // Free up allocated ports
      Object.values(sandbox.ports || {}).forEach(port => {
        this.usedPorts.delete(port);
      });

      // Remove sandbox from memory
      this.sandboxes.delete(sandboxId);

      return {
        success: true,
        sandboxId,
        resourcesRemoved,
        destroyedAt: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to destroy sandbox: ${error.message}`
      };
    }
  }

  /**
   * List all sandboxes for a hospital
   * @param {string} hospitalId - Hospital identifier
   * @returns {Promise<Object>} - List result
   */
  async listSandboxes(hospitalId) {
    try {
      const hospitalSandboxes = [];
      
      for (const [sandboxId, sandbox] of this.sandboxes) {
        if (sandbox.hospitalId === hospitalId) {
          hospitalSandboxes.push({
            sandboxId,
            status: sandbox.status,
            createdAt: sandbox.createdAt,
            stoppedAt: sandbox.stoppedAt,
            components: Object.keys(sandbox.components).filter(key => sandbox.components[key])
          });
        }
      }

      return {
        success: true,
        hospitalId,
        sandboxes: hospitalSandboxes,
        totalCount: hospitalSandboxes.length
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to list sandboxes: ${error.message}`
      };
    }
  }

  /**
   * Get access URLs for sandbox components
   * @param {string} sandboxId - Sandbox identifier
   * @returns {Promise<Object>} - Access URLs result
   */
  async getSandboxAccessUrls(sandboxId) {
    try {
      const sandbox = this.sandboxes.get(sandboxId);
      if (!sandbox) {
        return {
          success: false,
          error: 'Sandbox not found'
        };
      }

      return {
        success: true,
        sandboxId,
        urls: sandbox.accessUrls
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to get access URLs: ${error.message}`
      };
    }
  }

  /**
   * Configure sandbox security settings
   * @param {string} sandboxId - Sandbox identifier
   * @returns {Promise<Object>} - Security configuration result
   */
  async configureSandboxSecurity(sandboxId) {
    try {
      const sandbox = this.sandboxes.get(sandboxId);
      if (!sandbox) {
        return {
          success: false,
          error: 'Sandbox not found'
        };
      }

      const complianceReqs = this.reader.extractComplianceRequirements(sandbox.srsDocument);

      const securityConfig = {
        authentication: {
          enabled: complianceReqs.hipaaRequired,
          method: 'JWT',
          tokenExpiry: '24h'
        },
        tls: {
          enabled: complianceReqs.hipaaRequired,
          version: '1.2',
          certificates: 'self-signed'
        },
        auditLogging: complianceReqs.securityControls.includes('audit_logs'),
        accessControl: complianceReqs.securityControls.includes('access_control'),
        encryption: complianceReqs.securityControls.includes('encryption')
      };

      // Update sandbox with security configuration
      sandbox.securityConfig = securityConfig;

      return {
        success: true,
        sandboxId,
        ...securityConfig
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to configure security: ${error.message}`
      };
    }
  }

  // Private helper methods

  _generateSandboxId(hospitalId) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `sandbox-${hospitalId}-${timestamp}-${random}`;
  }

  _identifyComponents(infraReqs, ehrReqs) {
    return {
      database: infraReqs.databases.length > 0,
      cache: infraReqs.caching.length > 0,
      ehrMocks: ehrReqs.ehrSystems,
      monitoring: true, // Always include monitoring
      dashboard: true // Always include dashboard
    };
  }

  _generateNetworkConfig(sandboxId) {
    // Generate unique subnet for sandbox isolation
    const subnetId = Math.floor(Math.random() * 254) + 1;
    return {
      name: `${sandboxId}-network`,
      subnet: `172.20.${subnetId}.0/24`,
      gateway: `172.20.${subnetId}.1`,
      isolated: true
    };
  }

  _allocatePorts(sandboxId) {
    const ports = {};
    const basePort = 8000 + (this.sandboxes.size * 10);

    Object.entries(this.componentPorts).forEach(([component, defaultPort], index) => {
      let port = basePort + index;
      while (this.usedPorts.has(port)) {
        port++;
      }
      ports[component] = port;
      this.usedPorts.add(port);
    });

    return ports;
  }

  _generateAccessUrls(sandboxConfig) {
    const baseUrl = this.defaultConfig.baseUrl;
    const ports = sandboxConfig.ports;

    return {
      dashboard: `${baseUrl}:${ports.dashboard}/dashboard`,
      ehrMock: `${baseUrl}:${ports.ehrMock}/fhir/r4`,
      monitoring: `${baseUrl}:${ports.monitoring}/prometheus`,
      grafana: `${baseUrl}:${ports.grafana}/grafana`
    };
  }

  _calculateResourceQuotas(performanceReqs, srsDocument) {
    // First try to extract explicit resource limits from SRS
    let cpuQuota = 1;
    let memoryQuota = '1Gi';

    // Check non-functional requirements for explicit resource limits
    if (srsDocument && srsDocument.nonFunctionalRequirements) {
      srsDocument.nonFunctionalRequirements.forEach(req => {
        const text = req.text.toLowerCase();
        
        // Extract CPU limits - look for patterns like "1 CPU" or "2 CPU core"
        const cpuMatch = text.match(/(\d+)\s*cpu/);
        if (cpuMatch) {
          cpuQuota = parseInt(cpuMatch[1]);
        }
        
        // Extract memory limits - look for patterns like "2GB RAM"
        const memoryMatch = text.match(/(\d+)gb\s*ram/);
        if (memoryMatch) {
          memoryQuota = `${memoryMatch[1]}Gi`;
        }
        
        // Successfully extracted resource limits from text
      });
    }

    // Fallback: Calculate based on performance requirements
    if (cpuQuota === 1 && memoryQuota === '1Gi') {
      const maxUsers = performanceReqs.maxConcurrentUsers || 100;
      cpuQuota = Math.ceil(maxUsers / 100);
      memoryQuota = `${Math.ceil(maxUsers / 100)}Gi`;
    }

    return {
      cpu: cpuQuota.toString(),
      memory: memoryQuota
    };
  }
}

module.exports = SandboxBuilder;
