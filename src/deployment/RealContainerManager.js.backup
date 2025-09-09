/**
 * Real Container Manager - Enterprise OwlCloud Integration
 * 
 * MISSION: Replace simulated container deployment with real Kubernetes API calls
 * PLATFORM: OwlCloud Kubernetes cluster via GitLab CI/CD
 * 
 * This replaces the simulated deployment in SandboxBuilder with actual container management
 */

const k8s = require('@kubernetes/client-node');
const yaml = require('js-yaml');
const fs = require('fs').promises;
const path = require('path');

class RealContainerManager {
  constructor() {
    // Initialize Kubernetes client
    this.kc = new k8s.KubeConfig();
    
    // Load config from cluster (when running in OwlCloud) or local kubeconfig
    if (process.env.KUBERNETES_SERVICE_HOST) {
      this.kc.loadFromCluster();
    } else {
      this.kc.loadFromDefault();
    }
    
    // Initialize API clients
    this.k8sAppsV1Api = this.kc.makeApiClient(k8s.AppsV1Api);
    this.k8sCoreV1Api = this.kc.makeApiClient(k8s.CoreV1Api);
    this.k8sNetworkingV1Api = this.kc.makeApiClient(k8s.NetworkingV1Api);
    
    // Base configuration
    this.baseNamespace = 'hospital-sandbox';
    this.deploymentPath = path.join(__dirname, '../../deployment/k8s');
  }

  /**
   * Create real sandbox namespace and deploy containers
   * @param {string} sandboxId - Unique sandbox identifier
   * @param {Object} sandboxConfig - Sandbox configuration from SandboxBuilder
   * @returns {Promise<Object>} - Real deployment result with actual container status
   */
  async deployRealSandbox(sandboxId, sandboxConfig) {
    try {
      const namespace = `sandbox-${sandboxId}`;
      
      // Step 1: Create isolated namespace for this sandbox
      await this._createNamespace(namespace);
      
      // Step 2: Deploy PostgreSQL with real persistence
      const postgresDeployment = await this._deployPostgreSQL(namespace, sandboxConfig);
      
      // Step 3: Deploy Redis cache
      const redisDeployment = await this._deployRedis(namespace, sandboxConfig);
      
      // Step 4: Deploy EHR mock services if needed
      const ehrMocks = await this._deployEHRMocks(namespace, sandboxConfig);
      
      // Step 5: Deploy main sandbox application
      const appDeployment = await this._deployMainApplication(namespace, sandboxConfig);
      
      // Step 6: Create ingress for external access
      const ingress = await this._createIngress(namespace, sandboxId);
      
      // Step 7: Wait for all pods to be ready
      await this._waitForPodsReady(namespace);
      
      // Step 8: Get real container status
      const realStatus = await this._getRealContainerStatus(namespace);
      
      return {
        success: true,
        sandboxId,
        namespace,
        realDeployment: true,
        containers: realStatus.containers,
        services: realStatus.services,
        ingress: realStatus.ingress,
        accessUrls: this._generateRealAccessUrls(sandboxId)
      };
      
    } catch (error) {
      console.error(`Real deployment failed for ${sandboxId}:`, error);
      return {
        success: false,
        error: `Real deployment failed: ${error.message}`,
        sandboxId
      };
    }
  }

  /**
   * Get real-time status of sandbox containers
   * @param {string} sandboxId - Sandbox identifier
   * @returns {Promise<Object>} - Real container health and metrics
   */
  async getRealSandboxStatus(sandboxId) {
    try {
      const namespace = `sandbox-${sandboxId}`;
      
      // Get real pod status from Kubernetes API
      const podsResponse = await this.k8sCoreV1Api.listNamespacedPod(namespace);
      const servicesResponse = await this.k8sCoreV1Api.listNamespacedService(namespace);
      
      const containers = {};
      const healthStatus = {
        healthy: 0,
        total: 0,
        details: {}
      };
      
      // Process real pod data
      podsResponse.body.items.forEach(pod => {
        const containerName = pod.metadata.labels?.app || pod.metadata.name;
        const podPhase = pod.status.phase;
        const containerStatuses = pod.status.containerStatuses || [];
        
        containers[containerName] = {
          name: containerName,
          status: podPhase,
          ready: containerStatuses.every(c => c.ready),
          restartCount: containerStatuses.reduce((sum, c) => sum + c.restartCount, 0),
          image: containerStatuses[0]?.image || 'unknown',
          node: pod.spec.nodeName,
          startTime: pod.status.startTime,
          podIP: pod.status.podIP
        };
        
        healthStatus.total++;
        if (podPhase === 'Running' && containers[containerName].ready) {
          healthStatus.healthy++;
        }
        
        healthStatus.details[containerName] = {
          status: podPhase,
          ready: containers[containerName].ready,
          lastCheck: new Date().toISOString()
        };
      });
      
      // Calculate real resource usage (simplified - would integrate with metrics server in production)
      const resourceUsage = await this._getRealResourceUsage(namespace);
      
      return {
        success: true,
        sandboxId,
        namespace,
        status: healthStatus.healthy === healthStatus.total ? 'running' : 'degraded',
        containers,
        healthStatus,
        resourceUsage,
        realTime: true,
        lastUpdated: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Failed to get real status: ${error.message}`,
        sandboxId
      };
    }
  }

  /**
   * Destroy real sandbox and cleanup all Kubernetes resources
   * @param {string} sandboxId - Sandbox identifier
   * @returns {Promise<Object>} - Cleanup result
   */
  async destroyRealSandbox(sandboxId) {
    try {
      const namespace = `sandbox-${sandboxId}`;
      
      // Get resource counts before deletion
      const podsResponse = await this.k8sCoreV1Api.listNamespacedPod(namespace);
      const servicesResponse = await this.k8sCoreV1Api.listNamespacedService(namespace);
      const pvcResponse = await this.k8sCoreV1Api.listNamespacedPersistentVolumeClaim(namespace);
      
      const resourceCounts = {
        pods: podsResponse.body.items.length,
        services: servicesResponse.body.items.length,
        persistentVolumes: pvcResponse.body.items.length
      };
      
      // Delete the entire namespace (cascades to all resources)
      await this.k8sCoreV1Api.deleteNamespace(namespace);
      
      // Wait for namespace deletion to complete
      await this._waitForNamespaceDeletion(namespace);
      
      return {
        success: true,
        sandboxId,
        namespace,
        resourcesRemoved: {
          containers: resourceCounts.pods,
          services: resourceCounts.services,
          volumes: resourceCounts.persistentVolumes,
          networks: 1 // namespace network
        },
        realCleanup: true,
        destroyedAt: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Failed to destroy real sandbox: ${error.message}`,
        sandboxId
      };
    }
  }

  // Private helper methods for real Kubernetes operations

  async _createNamespace(namespace) {
    const namespaceManifest = {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: {
        name: namespace,
        labels: {
          'app.kubernetes.io/name': 'hospital-sandbox',
          'app.kubernetes.io/part-of': 'metis-transformation-engine',
          'sandbox.metis.ai/id': namespace.replace('sandbox-', '')
        }
      }
    };
    
    try {
      await this.k8sCoreV1Api.createNamespace(namespaceManifest);
    } catch (error) {
      if (error.response?.statusCode !== 409) { // Ignore if already exists
        throw error;
      }
    }
  }

  async _deployPostgreSQL(namespace, sandboxConfig) {
    // Load and customize PostgreSQL deployment manifest
    const manifestPath = path.join(this.deploymentPath, 'postgres/deployment.yaml');
    const manifestContent = await fs.readFile(manifestPath, 'utf8');
    const manifests = yaml.loadAll(manifestContent);
    
    // Apply each manifest to the namespace
    for (const manifest of manifests) {
      if (manifest) {
        manifest.metadata.namespace = namespace;
        
        if (manifest.kind === 'Deployment') {
          await this.k8sAppsV1Api.createNamespacedDeployment(namespace, manifest);
        } else if (manifest.kind === 'Service') {
          await this.k8sCoreV1Api.createNamespacedService(namespace, manifest);
        } else if (manifest.kind === 'PersistentVolumeClaim') {
          await this.k8sCoreV1Api.createNamespacedPersistentVolumeClaim(namespace, manifest);
        } else if (manifest.kind === 'ConfigMap') {
          await this.k8sCoreV1Api.createNamespacedConfigMap(namespace, manifest);
        }
      }
    }
  }

  async _deployRedis(namespace, sandboxConfig) {
    const manifestPath = path.join(this.deploymentPath, 'redis/deployment.yaml');
    const manifestContent = await fs.readFile(manifestPath, 'utf8');
    const manifests = yaml.loadAll(manifestContent);
    
    for (const manifest of manifests) {
      if (manifest) {
        manifest.metadata.namespace = namespace;
        
        if (manifest.kind === 'Deployment') {
          await this.k8sAppsV1Api.createNamespacedDeployment(namespace, manifest);
        } else if (manifest.kind === 'Service') {
          await this.k8sCoreV1Api.createNamespacedService(namespace, manifest);
        } else if (manifest.kind === 'PersistentVolumeClaim') {
          await this.k8sCoreV1Api.createNamespacedPersistentVolumeClaim(namespace, manifest);
        } else if (manifest.kind === 'ConfigMap') {
          await this.k8sCoreV1Api.createNamespacedConfigMap(namespace, manifest);
        }
      }
    }
  }

  async _deployEHRMocks(namespace, sandboxConfig) {
    // Deploy EHR mock services based on vendor integrations
    const ehrMocks = [];
    
    if (sandboxConfig.components.ehrMocks && sandboxConfig.components.ehrMocks.length > 0) {
      for (const ehrSystem of sandboxConfig.components.ehrMocks) {
        const mockService = await this._createEHRMockService(namespace, ehrSystem);
        ehrMocks.push(mockService);
      }
    }
    
    return ehrMocks;
  }

  async _createEHRMockService(namespace, ehrSystem) {
    // Create a simple NGINX-based EHR mock service
    const deployment = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: `${ehrSystem.vendor.toLowerCase()}-mock`,
        namespace: namespace,
        labels: {
          app: `${ehrSystem.vendor.toLowerCase()}-mock`,
          component: 'ehr-mock',
          vendor: ehrSystem.vendor
        }
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            app: `${ehrSystem.vendor.toLowerCase()}-mock`
          }
        },
        template: {
          metadata: {
            labels: {
              app: `${ehrSystem.vendor.toLowerCase()}-mock`
            }
          },
          spec: {
            containers: [{
              name: 'ehr-mock',
              image: 'nginx:alpine',
              ports: [{ containerPort: 80 }],
              resources: {
                requests: { memory: '64Mi', cpu: '50m' },
                limits: { memory: '128Mi', cpu: '100m' }
              }
            }]
          }
        }
      }
    };
    
    const service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: `${ehrSystem.vendor.toLowerCase()}-mock`,
        namespace: namespace
      },
      spec: {
        selector: {
          app: `${ehrSystem.vendor.toLowerCase()}-mock`
        },
        ports: [{
          port: 80,
          targetPort: 80
        }]
      }
    };
    
    await this.k8sAppsV1Api.createNamespacedDeployment(namespace, deployment);
    await this.k8sCoreV1Api.createNamespacedService(namespace, service);
    
    return {
      vendor: ehrSystem.vendor,
      service: `${ehrSystem.vendor.toLowerCase()}-mock`,
      deployed: true
    };
  }

  async _deployMainApplication(namespace, sandboxConfig) {
    // This would deploy the main Hospital Sandbox Generator application
    // For now, create a placeholder that will be replaced with the actual app
    const deployment = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: 'hospital-sandbox',
        namespace: namespace,
        labels: {
          app: 'hospital-sandbox',
          component: 'main-app'
        }
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            app: 'hospital-sandbox'
          }
        },
        template: {
          metadata: {
            labels: {
              app: 'hospital-sandbox'
            }
          },
          spec: {
            containers: [{
              name: 'hospital-sandbox',
              image: 'nginx:alpine', // Will be replaced with actual app image
              ports: [{ containerPort: 3000 }],
              env: [
                { name: 'DATABASE_URL', value: 'postgresql://hospital_user:secure_sandbox_password_123@postgres:5432/hospital_sandbox' },
                { name: 'REDIS_URL', value: 'redis://redis:6379' },
                { name: 'NODE_ENV', value: 'production' }
              ],
              resources: {
                requests: { memory: '256Mi', cpu: '200m' },
                limits: { memory: '512Mi', cpu: '500m' }
              }
            }]
          }
        }
      }
    };
    
    await this.k8sAppsV1Api.createNamespacedDeployment(namespace, deployment);
  }

  async _createIngress(namespace, sandboxId) {
    const ingress = {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: {
        name: 'hospital-sandbox-ingress',
        namespace: namespace,
        annotations: {
          'kubernetes.io/ingress.class': 'nginx',
          'cert-manager.io/cluster-issuer': 'letsencrypt-prod'
        }
      },
      spec: {
        tls: [{
          hosts: [`${sandboxId}.owlcloud.fau.edu`],
          secretName: `${sandboxId}-tls`
        }],
        rules: [{
          host: `${sandboxId}.owlcloud.fau.edu`,
          http: {
            paths: [
              {
                path: '/',
                pathType: 'Prefix',
                backend: {
                  service: {
                    name: 'hospital-sandbox',
                    port: { number: 80 }
                  }
                }
              },
              {
                path: '/fhir',
                pathType: 'Prefix',
                backend: {
                  service: {
                    name: 'epic-mock',
                    port: { number: 80 }
                  }
                }
              }
            ]
          }
        }]
      }
    };
    
    await this.k8sNetworkingV1Api.createNamespacedIngress(namespace, ingress);
  }

  async _waitForPodsReady(namespace, timeoutMs = 300000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const podsResponse = await this.k8sCoreV1Api.listNamespacedPod(namespace);
        const pods = podsResponse.body.items;
        
        if (pods.length === 0) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }
        
        const allReady = pods.every(pod => {
          const containerStatuses = pod.status.containerStatuses || [];
          return pod.status.phase === 'Running' && 
                 containerStatuses.length > 0 && 
                 containerStatuses.every(c => c.ready);
        });
        
        if (allReady) {
          return true;
        }
        
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        console.error('Error waiting for pods:', error.message);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    throw new Error(`Timeout waiting for pods to be ready in namespace ${namespace}`);
  }

  async _getRealContainerStatus(namespace) {
    const podsResponse = await this.k8sCoreV1Api.listNamespacedPod(namespace);
    const servicesResponse = await this.k8sCoreV1Api.listNamespacedService(namespace);
    const ingressResponse = await this.k8sNetworkingV1Api.listNamespacedIngress(namespace);
    
    return {
      containers: podsResponse.body.items.map(pod => ({
        name: pod.metadata.name,
        status: pod.status.phase,
        ready: pod.status.containerStatuses?.every(c => c.ready) || false,
        image: pod.status.containerStatuses?.[0]?.image || 'unknown'
      })),
      services: servicesResponse.body.items.map(svc => ({
        name: svc.metadata.name,
        type: svc.spec.type,
        ports: svc.spec.ports
      })),
      ingress: ingressResponse.body.items.map(ing => ({
        name: ing.metadata.name,
        hosts: ing.spec.rules?.map(r => r.host) || []
      }))
    };
  }

  async _getRealResourceUsage(namespace) {
    // Simplified resource usage - in production would integrate with metrics-server
    try {
      const podsResponse = await this.k8sCoreV1Api.listNamespacedPod(namespace);
      const podCount = podsResponse.body.items.length;
      
      return {
        cpu: Math.min(podCount * 15, 80), // Estimated CPU usage
        memory: Math.min(podCount * 20, 70), // Estimated memory usage
        pods: podCount,
        namespace: namespace,
        realMetrics: false, // Would be true with metrics-server integration
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      return {
        cpu: 0,
        memory: 0,
        pods: 0,
        error: error.message
      };
    }
  }

  async _waitForNamespaceDeletion(namespace, timeoutMs = 120000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        await this.k8sCoreV1Api.readNamespace(namespace);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        if (error.response?.statusCode === 404) {
          return true; // Namespace deleted successfully
        }
        throw error;
      }
    }
    
    throw new Error(`Timeout waiting for namespace ${namespace} deletion`);
  }

  _generateRealAccessUrls(sandboxId) {
    const baseUrl = `https://${sandboxId}.owlcloud.fau.edu`;
    
    return {
      dashboard: `${baseUrl}/`,
      api: `${baseUrl}/api`,
      ehrMock: `${baseUrl}/fhir/r4`,
      monitoring: `${baseUrl}/metrics`,
      health: `${baseUrl}/health`
    };
  }
}

module.exports = RealContainerManager;
