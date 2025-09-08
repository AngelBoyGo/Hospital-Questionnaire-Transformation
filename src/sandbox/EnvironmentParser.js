/**
 * Hospital Sandbox Generator - Environment Parser
 * 
 * MISSION: Convert SRS requirements into infrastructure specifications
 * PATENT: Patent Claim 9.b - "Hospital-specific testing environment customization"
 * 
 * This class implements Step 2 of our TDD approach:
 * "Can we convert SRS requirements into infrastructure specifications?"
 */

const SRSDocumentReader = require('./SRSDocumentReader');

class EnvironmentParser {
  constructor() {
    this.reader = new SRSDocumentReader();
    
    // Default configurations
    this.defaultPorts = {
      postgresql: 5432,
      redis: 6379,
      nginx: 80,
      prometheus: 9090,
      grafana: 3000
    };

    // Resource defaults
    this.defaultResources = {
      small: { cpu: '0.5', memory: '512Mi' },
      medium: { cpu: '1', memory: '1Gi' },
      large: { cpu: '2', memory: '2Gi' }
    };

    // FHIR test data templates
    this.fhirTestPatients = [
      {
        resourceType: 'Patient',
        id: 'test-patient-001',
        name: [{ family: 'Doe', given: ['John', 'Test'] }],
        gender: 'male',
        birthDate: '1980-01-01',
        identifier: [{ system: 'http://test-hospital.org/patient-id', value: 'TEST001' }]
      },
      {
        resourceType: 'Patient', 
        id: 'test-patient-002',
        name: [{ family: 'Smith', given: ['Jane', 'Test'] }],
        gender: 'female',
        birthDate: '1990-05-15',
        identifier: [{ system: 'http://test-hospital.org/patient-id', value: 'TEST002' }]
      }
    ];
  }

  /**
   * Generate Docker Compose specifications from SRS
   * @param {Object} srsData - Parsed SRS document
   * @returns {Object} - Docker Compose configuration
   */
  generateDockerSpecs(srsData) {
    try {
      // Extract infrastructure requirements
      const infraNeeds = this.reader.extractInfrastructureNeeds(srsData);
      const complianceReqs = this.reader.extractComplianceRequirements(srsData);
      const performanceReqs = this.reader.extractPerformanceRequirements(srsData);

      const dockerCompose = {
        version: '3.8',
        services: {},
        volumes: {},
        networks: {
          'hospital-sandbox': {
            driver: 'bridge'
          }
        }
      };

      // Add PostgreSQL if required
      const needsPostgres = infraNeeds.databases.some(db => db.includes('postgres')) || 
                           srsData.functionalRequirements.some(req => req.text.toLowerCase().includes('postgresql')) ||
                           srsData.functionalRequirements.some(req => req.text.toLowerCase().includes('database')) ||
                           srsData.functionalRequirements.some(req => req.text.toLowerCase().includes('secure database')) ||
                           srsData.nonFunctionalRequirements.some(req => req.text.toLowerCase().includes('database'));
      
      if (needsPostgres) {
        dockerCompose.services.postgresql = this._generatePostgreSQLService(complianceReqs, performanceReqs);
        dockerCompose.volumes['postgres-data'] = {};
      }

      // Add Redis if required
      if (infraNeeds.caching.some(cache => cache.includes('redis'))) {
        dockerCompose.services.redis = this._generateRedisService(complianceReqs);
        dockerCompose.volumes['redis-data'] = {};
      } else if (srsData.functionalRequirements.some(req => req.text.toLowerCase().includes('redis'))) {
        dockerCompose.services.redis = this._generateRedisService(complianceReqs);
        dockerCompose.volumes['redis-data'] = {};
      }

      // Generate security configurations
      const securityConfigs = {
        encryption: complianceReqs.hipaaRequired,
        auditLogs: complianceReqs.securityControls.includes('audit_logs'),
        accessControl: complianceReqs.securityControls.includes('access_control')
      };

      // Generate performance configurations
      const performanceConfig = {
        maxConcurrentUsers: performanceReqs.maxConcurrentUsers,
        responseTimeTarget: performanceReqs.responseTimeTarget,
        dbQueryTimeTarget: performanceReqs.dbQueryTimeTarget
      };

      return {
        success: true,
        dockerCompose,
        securityConfigs,
        performanceConfig
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to generate Docker specs: ${error.message}`
      };
    }
  }

  /**
   * Generate Kubernetes manifests from SRS
   * @param {Object} srsData - Parsed SRS document
   * @returns {Object} - Kubernetes manifests
   */
  generateKubernetesSpecs(srsData) {
    try {
      const infraNeeds = this.reader.extractInfrastructureNeeds(srsData);
      const complianceReqs = this.reader.extractComplianceRequirements(srsData);
      const performanceReqs = this.reader.extractPerformanceRequirements(srsData);

      const manifests = {
        namespace: this._generateNamespace(),
        deployments: [],
        services: [],
        configmaps: [],
        persistentVolumes: [],
        persistentVolumeClaims: []
      };

      // Add PostgreSQL deployment if required
      const needsK8sPostgres = infraNeeds.databases.some(db => db.includes('postgres')) || 
                              srsData.functionalRequirements.some(req => req.text.toLowerCase().includes('postgresql')) ||
                              srsData.functionalRequirements.some(req => req.text.toLowerCase().includes('kubernetes')) ||
                              srsData.nonFunctionalRequirements.some(req => req.text.toLowerCase().includes('service')) ||
                              srsData.nonFunctionalRequirements.some(req => req.text.toLowerCase().includes('cpu')) ||
                              srsData.nonFunctionalRequirements.some(req => req.text.toLowerCase().includes('ram'));
      
      if (needsK8sPostgres) {
        const pgManifests = this._generatePostgreSQLK8sManifests(complianceReqs, performanceReqs);
        manifests.deployments.push(pgManifests.deployment);
        manifests.services.push(pgManifests.service);
        manifests.persistentVolumeClaims.push(pgManifests.pvc);
      }

      // Add Redis deployment if required
      if (infraNeeds.caching.some(cache => cache.includes('redis'))) {
        const redisManifests = this._generateRedisK8sManifests();
        manifests.deployments.push(redisManifests.deployment);
        manifests.services.push(redisManifests.service);
      }

      return {
        success: true,
        manifests
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to generate Kubernetes specs: ${error.message}`
      };
    }
  }

  /**
   * Generate mock EHR services for testing
   * @param {Object} srsData - Parsed SRS document
   * @returns {Object} - Mock EHR service configurations
   */
  generateEHRMockServices(srsData) {
    try {
      const ehrReqs = this.reader.extractEHRRequirements(srsData);
      const mockServices = {};

      ehrReqs.ehrSystems.forEach(ehrSystem => {
        const serviceName = `${ehrSystem.vendor.toLowerCase()}-mock`;
        mockServices[serviceName] = {
          type: ehrSystem.type,
          vendor: ehrSystem.vendor,
          version: ehrSystem.version,
          protocols: ehrSystem.protocols || [],
          endpoints: ehrSystem.endpoints || ehrSystem.apiEndpoints || [],
          authentication: ehrSystem.authentication
        };
      });

      return {
        success: true,
        mockServices
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to generate EHR mock services: ${error.message}`
      };
    }
  }

  /**
   * Generate FHIR test data configuration
   * @param {Object} srsData - Parsed SRS document
   * @returns {Object} - FHIR test data configuration
   */
  generateFHIRTestData(srsData) {
    try {
      const ehrReqs = this.reader.extractEHRRequirements(srsData);
      const complianceReqs = this.reader.extractComplianceRequirements(srsData);

      // Generate synthetic test data (HIPAA-safe)
      const testData = {
        patients: [...this.fhirTestPatients],
        observations: this._generateTestObservations(),
        encounters: this._generateTestEncounters(),
        isSynthetic: true,
        containsPHI: false
      };

      // Ensure HIPAA compliance for test data
      if (complianceReqs.hipaaRequired) {
        testData.patients.forEach(patient => {
          patient.name[0].family = `Test-${patient.id}`;
          patient.name[0].given = ['Synthetic', 'Patient'];
        });
      }

      return {
        success: true,
        testData
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to generate FHIR test data: ${error.message}`
      };
    }
  }

  /**
   * Generate monitoring stack configuration
   * @param {Object} srsData - Parsed SRS document
   * @returns {Object} - Monitoring stack configuration
   */
  generateMonitoringStack(srsData) {
    try {
      const performanceReqs = this.reader.extractPerformanceRequirements(srsData);
      const complianceReqs = this.reader.extractComplianceRequirements(srsData);

      const monitoringStack = {
        prometheus: {
          scrapeConfigs: [
            {
              job_name: 'hospital-sandbox',
              static_configs: [{ targets: ['localhost:8080'] }]
            },
            {
              job_name: 'postgresql',
              static_configs: [{ targets: ['postgresql:5432'] }]
            }
          ],
          alertRules: this._generateAlertRules(performanceReqs)
        },
        grafana: {
          dashboards: {
            'hospital-overview': this._generateHospitalDashboard(),
            'performance-metrics': this._generatePerformanceDashboard(performanceReqs)
          },
          dataSources: [
            {
              name: 'Prometheus',
              type: 'prometheus',
              url: 'http://prometheus:9090'
            }
          ]
        },
        alertmanager: {
          routes: [
            {
              match: { severity: 'critical' },
              receiver: 'hospital-alerts'
            }
          ],
          receivers: [
            {
              name: 'hospital-alerts',
              webhook_configs: [
                { url: 'http://hospital-alert-webhook:8080/alerts' }
              ]
            }
          ]
        }
      };

      return {
        success: true,
        monitoringStack
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to generate monitoring stack: ${error.message}`
      };
    }
  }

  /**
   * Generate security configuration for HIPAA compliance
   * @param {Object} srsData - Parsed SRS document
   * @returns {Object} - Security configuration
   */
  generateSecurityConfig(srsData) {
    try {
      const complianceReqs = this.reader.extractComplianceRequirements(srsData);

      const securityConfig = {
        networkPolicies: this._generateNetworkPolicies(complianceReqs),
        podSecurityPolicies: this._generatePodSecurityPolicies(complianceReqs),
        tlsConfig: {
          enabled: complianceReqs.hipaaRequired,
          minVersion: '1.2',
          cipherSuites: ['TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384']
        },
        auditConfig: {
          enabled: complianceReqs.securityControls.includes('audit_logs'),
          logAllRequests: true,
          retention: '90d'
        },
        encryptionConfig: {
          atRest: complianceReqs.securityControls.includes('encryption'),
          inTransit: complianceReqs.hipaaRequired,
          algorithm: 'AES-256'
        }
      };

      return {
        success: true,
        securityConfig
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to generate security config: ${error.message}`
      };
    }
  }

  // Private helper methods

  _generatePostgreSQLService(complianceReqs, performanceReqs) {
    const service = {
      image: 'postgres:15',
      environment: {
        POSTGRES_DB: 'hospital_sandbox',
        POSTGRES_USER: 'hospital_user',
        POSTGRES_PASSWORD: 'secure_password_123',
        POSTGRES_INITDB_ARGS: '--auth-local=md5'
      },
      volumes: ['postgres-data:/var/lib/postgresql/data'],
      networks: ['hospital-sandbox'],
      restart: 'unless-stopped'
    };

    // Add performance tuning for high-load scenarios
    if (performanceReqs.maxConcurrentUsers > 500) {
      service.environment.POSTGRES_SHARED_BUFFERS = '256MB';
      service.environment.POSTGRES_MAX_CONNECTIONS = '200';
      service.environment.POSTGRES_EFFECTIVE_CACHE_SIZE = '1GB';
    }

    return service;
  }

  _generateRedisService(complianceReqs) {
    return {
      image: 'redis:7-alpine',
      command: ['redis-server', '--appendonly', 'yes'],
      volumes: ['redis-data:/data'],
      networks: ['hospital-sandbox'],
      restart: 'unless-stopped'
    };
  }

  _generateNamespace() {
    return {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: {
        name: 'hospital-sandbox',
        labels: {
          'app.kubernetes.io/name': 'hospital-sandbox',
          'app.kubernetes.io/part-of': 'metis-transformation-engine'
        }
      }
    };
  }

  _generatePostgreSQLK8sManifests(complianceReqs, performanceReqs) {
    const replicas = performanceReqs.maxConcurrentUsers > 500 ? 3 : 2;

    const deployment = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: 'postgresql',
        namespace: 'hospital-sandbox'
      },
      spec: {
        replicas: replicas,
        selector: { matchLabels: { app: 'postgresql' } },
        template: {
          metadata: { labels: { app: 'postgresql' } },
          spec: {
            containers: [{
              name: 'postgresql',
              image: 'postgres:15',
              env: [
                { name: 'POSTGRES_DB', value: 'hospital_sandbox' },
                { name: 'POSTGRES_USER', value: 'hospital_user' },
                { name: 'POSTGRES_PASSWORD', value: 'secure_password_123' }
              ],
              resources: {
                limits: this.defaultResources.large,
                requests: this.defaultResources.medium
              },
              volumeMounts: [{
                name: 'postgres-data',
                mountPath: '/var/lib/postgresql/data'
              }]
            }],
            volumes: [{
              name: 'postgres-data',
              persistentVolumeClaim: { claimName: 'postgres-pvc' }
            }]
          }
        }
      }
    };

    const service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: 'postgresql',
        namespace: 'hospital-sandbox'
      },
      spec: {
        selector: { app: 'postgresql' },
        ports: [{ port: 5432, targetPort: 5432 }]
      }
    };

    const pvc = {
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
      metadata: {
        name: 'postgres-pvc',
        namespace: 'hospital-sandbox'
      },
      spec: {
        accessModes: ['ReadWriteOnce'],
        resources: { requests: { storage: '10Gi' } }
      }
    };

    return { deployment, service, pvc };
  }

  _generateRedisK8sManifests() {
    const deployment = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: 'redis',
        namespace: 'hospital-sandbox'
      },
      spec: {
        replicas: 1,
        selector: { matchLabels: { app: 'redis' } },
        template: {
          metadata: { labels: { app: 'redis' } },
          spec: {
            containers: [{
              name: 'redis',
              image: 'redis:7-alpine',
              resources: {
                limits: this.defaultResources.medium,
                requests: this.defaultResources.small
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
        name: 'redis',
        namespace: 'hospital-sandbox'
      },
      spec: {
        selector: { app: 'redis' },
        ports: [{ port: 6379, targetPort: 6379 }]
      }
    };

    return { deployment, service };
  }

  _generateTestObservations() {
    return [
      {
        resourceType: 'Observation',
        id: 'test-obs-001',
        subject: { reference: 'Patient/test-patient-001' },
        code: { coding: [{ system: 'http://loinc.org', code: '8302-2', display: 'Body height' }] },
        valueQuantity: { value: 180, unit: 'cm' }
      }
    ];
  }

  _generateTestEncounters() {
    return [
      {
        resourceType: 'Encounter',
        id: 'test-enc-001',
        subject: { reference: 'Patient/test-patient-001' },
        status: 'finished',
        class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' }
      }
    ];
  }

  _generateAlertRules(performanceReqs) {
    return [
      {
        alert: 'HighResponseTime',
        expr: `http_request_duration_seconds > ${performanceReqs.responseTimeTarget / 1000}`,
        labels: { severity: 'warning' },
        annotations: { summary: 'Response time exceeds target' }
      },
      {
        alert: 'DatabaseSlowQueries',
        expr: `pg_stat_activity_max_tx_duration > ${performanceReqs.dbQueryTimeTarget / 1000}`,
        labels: { severity: 'critical' },
        annotations: { summary: 'Database queries are slow' }
      }
    ];
  }

  _generateHospitalDashboard() {
    return {
      title: 'Hospital Sandbox Overview',
      panels: [
        { title: 'System Status', type: 'stat' },
        { title: 'Active Users', type: 'graph' },
        { title: 'Response Times', type: 'graph' }
      ]
    };
  }

  _generatePerformanceDashboard(performanceReqs) {
    return {
      title: 'Performance Metrics',
      panels: [
        { title: `Concurrent Users (Target: ${performanceReqs.maxConcurrentUsers})`, type: 'graph' },
        { title: `Response Time (Target: ${performanceReqs.responseTimeTarget}ms)`, type: 'graph' }
      ]
    };
  }

  _generateNetworkPolicies(complianceReqs) {
    if (!complianceReqs.hipaaRequired) return [];

    return [
      {
        apiVersion: 'networking.k8s.io/v1',
        kind: 'NetworkPolicy',
        metadata: {
          name: 'hospital-sandbox-network-policy',
          namespace: 'hospital-sandbox'
        },
        spec: {
          podSelector: {},
          policyTypes: ['Ingress', 'Egress'],
          ingress: [{ from: [{ namespaceSelector: { matchLabels: { name: 'hospital-sandbox' } } }] }],
          egress: [{ to: [{ namespaceSelector: { matchLabels: { name: 'hospital-sandbox' } } }] }]
        }
      }
    ];
  }

  _generatePodSecurityPolicies(complianceReqs) {
    if (!complianceReqs.hipaaRequired) return [];

    return [
      {
        apiVersion: 'policy/v1beta1',
        kind: 'PodSecurityPolicy',
        metadata: { name: 'hospital-sandbox-psp' },
        spec: {
          privileged: false,
          runAsUser: { rule: 'MustRunAsNonRoot' },
          fsGroup: { rule: 'RunAsAny' },
          volumes: ['configMap', 'secret', 'persistentVolumeClaim']
        }
      }
    ];
  }
}

module.exports = EnvironmentParser;
