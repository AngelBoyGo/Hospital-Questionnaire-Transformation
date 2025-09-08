# 🔌 Hospital Sandbox Generator API Documentation

## 🎯 Overview

The Hospital Sandbox Generator provides a comprehensive API for converting SRS documents into working sandbox environments. This document covers all classes, methods, and integration patterns.

---

## 📋 Table of Contents

1. [SRSDocumentReader API](#srsdocumentreader-api)
2. [EnvironmentParser API](#environmentparser-api)
3. [SandboxBuilder API](#sandboxbuilder-api)
4. [Integration Patterns](#integration-patterns)
5. [Error Handling](#error-handling)
6. [Type Definitions](#type-definitions)

---

## 🔍 SRSDocumentReader API

### Class: `SRSDocumentReader`

Reads and parses SRS documents to extract requirements for sandbox generation.

#### Constructor
```javascript
const reader = new SRSDocumentReader();
```

#### Methods

##### `readSRS(srsDocument)`
Validates and reads an SRS document.

**Parameters:**
- `srsDocument` (Object): SRS JSON document

**Returns:**
```javascript
{
  success: boolean,
  data?: {
    functionalRequirements: Array,
    nonFunctionalRequirements: Array,
    compliance: Object,
    vendorIntegrations: Array,
    implementationPhases: Array
  },
  error?: string
}
```

**Example:**
```javascript
const result = reader.readSRS({
  functionalRequirements: [
    { id: "FR-001", text: "Deploy PostgreSQL database", acceptance: "DB operational" }
  ],
  nonFunctionalRequirements: [],
  compliance: { hipaa: { required: true } },
  vendorIntegrations: [],
  implementationPhases: []
});

if (result.success) {
  console.log('SRS parsed successfully');
}
```

##### `extractInfrastructureNeeds(srsDocument)`
Extracts infrastructure requirements from SRS.

**Returns:**
```javascript
{
  databases: string[],      // ['postgresql', 'mysql']
  caching: string[],        // ['redis', 'memcached']  
  orchestration: string[],  // ['kubernetes', 'docker']
  messaging: string[],      // ['rabbitmq', 'kafka']
  nodes: number            // Minimum node count
}
```

##### `extractEHRRequirements(srsDocument)`
Extracts EHR integration requirements.

**Returns:**
```javascript
{
  ehrSystems: [{
    vendor: string,           // 'Epic', 'Cerner'
    type: string,            // 'EHR'
    version?: string,        // '2023'
    apiEndpoints: Array,     // [{ path: '/Patient', method: 'GET' }]
    protocols: string[],     // ['HL7-FHIR', 'REST']
    authentication: string  // 'OAuth2', 'SMART-on-FHIR'
  }],
  authenticationTypes: string[]
}
```

##### `extractComplianceRequirements(srsDocument)`
Extracts compliance and security requirements.

**Returns:**
```javascript
{
  hipaaRequired: boolean,
  nistRequired: boolean,
  hitechRequired: boolean,
  securityControls: string[]  // ['encryption', 'audit_logs', 'access_control']
}
```

##### `extractPerformanceRequirements(srsDocument)`
Extracts performance and scalability requirements.

**Returns:**
```javascript
{
  maxConcurrentUsers: number,    // 500
  responseTimeTarget: number,    // 2000ms
  dbQueryTimeTarget: number,     // 100ms
  uptimeTarget: number          // 99.9%
}
```

##### `extractIntegrationRequirements(srsDocument)`
Extracts API and integration requirements.

**Returns:**
```javascript
{
  protocols: string[],    // ['HL7-FHIR', 'REST', 'HL7-v2.5']
  endpoints: Array,       // [{ path: '/Patient', method: 'GET' }]
  vendors: Array         // [{ vendor: 'Epic', type: 'EHR' }]
}
```

---

## 🐳 EnvironmentParser API

### Class: `EnvironmentParser`

Converts SRS requirements into infrastructure specifications.

#### Constructor
```javascript
const parser = new EnvironmentParser();
```

#### Methods

##### `generateDockerSpecs(srsData)`
Generates Docker Compose specifications.

**Parameters:**
- `srsData` (Object): Parsed SRS data

**Returns:**
```javascript
{
  success: boolean,
  dockerCompose?: {
    version: string,
    services: Object,
    volumes: Object,
    networks: Object
  },
  securityConfigs?: {
    encryption: boolean,
    auditLogs: boolean,
    accessControl: boolean
  },
  performanceConfig?: {
    maxConcurrentUsers: number,
    responseTimeTarget: number,
    dbQueryTimeTarget: number
  },
  error?: string
}
```

**Example:**
```javascript
const dockerResult = parser.generateDockerSpecs(srsData);
if (dockerResult.success) {
  console.log('PostgreSQL service:', dockerResult.dockerCompose.services.postgresql);
}
```

##### `generateKubernetesSpecs(srsData)`
Generates Kubernetes manifest specifications.

**Returns:**
```javascript
{
  success: boolean,
  manifests?: {
    namespace: Object,
    deployments: Array,
    services: Array,
    configmaps: Array,
    persistentVolumes: Array,
    persistentVolumeClaims: Array
  },
  error?: string
}
```

##### `generateEHRMockServices(srsData)`
Generates EHR mock service configurations.

**Returns:**
```javascript
{
  success: boolean,
  mockServices?: {
    [serviceName]: {
      type: string,
      vendor: string,
      version?: string,
      protocols: string[],
      endpoints: Array,
      authentication: string
    }
  },
  error?: string
}
```

##### `generateFHIRTestData(srsData)`
Generates HIPAA-safe synthetic FHIR test data.

**Returns:**
```javascript
{
  success: boolean,
  testData?: {
    patients: Array,
    observations: Array,
    encounters: Array,
    isSynthetic: boolean,
    containsPHI: boolean
  },
  error?: string
}
```

##### `generateMonitoringStack(srsData)`
Generates monitoring and observability configuration.

**Returns:**
```javascript
{
  success: boolean,
  monitoringStack?: {
    prometheus: {
      scrapeConfigs: Array,
      alertRules: Array
    },
    grafana: {
      dashboards: Object,
      dataSources: Array
    },
    alertmanager: {
      routes: Array,
      receivers: Array
    }
  },
  error?: string
}
```

##### `generateSecurityConfig(srsData)`
Generates security and compliance configuration.

**Returns:**
```javascript
{
  success: boolean,
  securityConfig?: {
    networkPolicies: Array,
    podSecurityPolicies: Array,
    tlsConfig: {
      enabled: boolean,
      minVersion: string,
      cipherSuites: string[]
    },
    auditConfig: {
      enabled: boolean,
      logAllRequests: boolean,
      retention: string
    },
    encryptionConfig: {
      atRest: boolean,
      inTransit: boolean,
      algorithm: string
    }
  },
  error?: string
}
```

---

## 🏗️ SandboxBuilder API

### Class: `SandboxBuilder`

Builds and manages actual sandbox environments.

#### Constructor
```javascript
const builder = new SandboxBuilder();
```

#### Methods

##### `createSandboxEnvironment(hospitalId, srsDocument)`
Creates a complete sandbox environment.

**Parameters:**
- `hospitalId` (string): Hospital identifier
- `srsDocument` (Object): SRS document

**Returns:**
```javascript
Promise<{
  success: boolean,
  sandboxId?: string,
  status?: 'creating' | 'running' | 'stopped' | 'error',
  components?: {
    database: boolean,
    cache: boolean,
    ehrMocks: Array,
    monitoring: boolean,
    dashboard: boolean
  },
  accessUrls?: {
    dashboard: string,
    ehrMock: string,
    monitoring: string,
    grafana: string
  },
  networkConfig?: {
    name: string,
    subnet: string,
    gateway: string,
    isolated: boolean
  },
  error?: string
}>
```

**Example:**
```javascript
const sandbox = await builder.createSandboxEnvironment('memorial-hospital', srsDocument);
if (sandbox.success) {
  console.log(`Sandbox created: ${sandbox.sandboxId}`);
  console.log(`Dashboard: ${sandbox.accessUrls.dashboard}`);
}
```

##### `deployDockerContainers(sandboxId)`
Deploys Docker containers for sandbox components.

**Parameters:**
- `sandboxId` (string): Sandbox identifier

**Returns:**
```javascript
Promise<{
  success: boolean,
  sandboxId?: string,
  containers?: {
    [containerName]: {
      id: string,
      image: string,
      status: 'running' | 'stopped' | 'error',
      port: number,
      network: string,
      healthCheck: 'healthy' | 'unhealthy'
    }
  },
  networkName?: string,
  networkConfig?: {
    isolated: boolean,
    subnet: string,
    driver: string
  },
  error?: string
}>
```

##### `deployKubernetesManifests(sandboxId)`
Deploys Kubernetes manifests for sandbox.

**Returns:**
```javascript
Promise<{
  success: boolean,
  sandboxId?: string,
  namespace?: string,
  deployments?: Array,
  services?: Array,
  resourceQuotas?: {
    cpu: string,
    memory: string
  },
  error?: string
}>
```

##### `getSandboxStatus(sandboxId)`
Gets comprehensive sandbox status information.

**Returns:**
```javascript
Promise<{
  success: boolean,
  sandboxId?: string,
  status?: 'creating' | 'running' | 'stopped' | 'error',
  hospitalId?: string,
  createdAt?: string,
  uptime?: number,
  components?: Object,
  healthChecks?: Object,
  resourceUsage?: {
    cpu: number,
    memory: number,
    disk: number,
    network: number
  },
  error?: string
}>
```

##### `performHealthChecks(sandboxId)`
Performs health checks on sandbox components.

**Returns:**
```javascript
Promise<{
  success: boolean,
  sandboxId?: string,
  overallHealth?: 'healthy' | 'degraded' | 'unhealthy',
  componentHealth?: {
    [component]: {
      status: 'healthy' | 'unhealthy',
      responseTime: number,
      lastCheck: string
    }
  },
  healthyComponents?: number,
  totalComponents?: number,
  lastChecked?: string,
  error?: string
}>
```

##### `stopSandboxEnvironment(sandboxId)`
Stops a sandbox environment.

**Returns:**
```javascript
Promise<{
  success: boolean,
  sandboxId?: string,
  previousStatus?: string,
  newStatus?: string,
  stoppedAt?: string,
  error?: string
}>
```

##### `destroySandboxEnvironment(sandboxId)`
Destroys sandbox and cleans up all resources.

**Returns:**
```javascript
Promise<{
  success: boolean,
  sandboxId?: string,
  resourcesRemoved?: {
    containers: number,
    volumes: number,
    networks: number
  },
  destroyedAt?: string,
  error?: string
}>
```

##### `listSandboxes(hospitalId)`
Lists all sandboxes for a hospital.

**Returns:**
```javascript
Promise<{
  success: boolean,
  hospitalId?: string,
  sandboxes?: [{
    sandboxId: string,
    status: string,
    createdAt: string,
    stoppedAt?: string,
    components: string[]
  }],
  totalCount?: number,
  error?: string
}>
```

##### `getSandboxAccessUrls(sandboxId)`
Gets access URLs for sandbox components.

**Returns:**
```javascript
Promise<{
  success: boolean,
  sandboxId?: string,
  urls?: {
    dashboard: string,
    ehrMock: string,
    monitoring: string,
    grafana: string
  },
  error?: string
}>
```

##### `configureSandboxSecurity(sandboxId)`
Configures security settings for sandbox.

**Returns:**
```javascript
Promise<{
  success: boolean,
  sandboxId?: string,
  authentication?: {
    enabled: boolean,
    method: string,
    tokenExpiry: string
  },
  tls?: {
    enabled: boolean,
    version: string,
    certificates: string
  },
  auditLogging?: boolean,
  accessControl?: boolean,
  encryption?: boolean,
  error?: string
}>
```

---

## 🔗 Integration Patterns

### Pattern 1: Extend Existing Metis API

```javascript
// Add to existing SRS generation endpoint
app.post('/ai/srs/generate-with-sandbox', async (req, res) => {
  try {
    // 1. Generate SRS using existing Metis system
    const srsResult = await srsOrchestrator.generateSRS(req.body);
    
    if (!srsResult.success) {
      return res.status(400).json({ error: 'SRS generation failed' });
    }

    // 2. Create sandbox environment
    const sandboxBuilder = new SandboxBuilder();
    const sandbox = await sandboxBuilder.createSandboxEnvironment(
      req.body.hospitalId,
      srsResult.srs
    );

    // 3. Deploy environment
    if (sandbox.success) {
      await sandboxBuilder.deployDockerContainers(sandbox.sandboxId);
    }

    res.json({
      srs: srsResult.srs,
      sandbox: sandbox,
      accessUrls: sandbox.accessUrls
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Pattern 2: Standalone Sandbox Management

```javascript
// Sandbox management endpoints
app.post('/sandbox/create', async (req, res) => {
  const { hospitalId, srsDocument } = req.body;
  const builder = new SandboxBuilder();
  const result = await builder.createSandboxEnvironment(hospitalId, srsDocument);
  res.json(result);
});

app.get('/sandbox/:sandboxId/status', async (req, res) => {
  const builder = new SandboxBuilder();
  const result = await builder.getSandboxStatus(req.params.sandboxId);
  res.json(result);
});

app.delete('/sandbox/:sandboxId', async (req, res) => {
  const builder = new SandboxBuilder();
  const result = await builder.destroySandboxEnvironment(req.params.sandboxId);
  res.json(result);
});
```

### Pattern 3: Batch Processing

```javascript
// Process multiple hospitals concurrently
async function createMultipleSandboxes(hospitals) {
  const builder = new SandboxBuilder();
  
  const promises = hospitals.map(hospital => 
    builder.createSandboxEnvironment(hospital.id, hospital.srs)
  );
  
  const results = await Promise.all(promises);
  
  // Deploy all successful sandboxes
  const deployPromises = results
    .filter(r => r.success)
    .map(r => builder.deployDockerContainers(r.sandboxId));
    
  await Promise.all(deployPromises);
  
  return results;
}
```

---

## ⚠️ Error Handling

### Common Error Types

#### SRS Validation Errors
```javascript
{
  success: false,
  error: "Invalid SRS document: Missing required field: functionalRequirements"
}
```

#### Infrastructure Errors
```javascript
{
  success: false,
  error: "Failed to generate Docker specs: Invalid infrastructure requirements"
}
```

#### Deployment Errors
```javascript
{
  success: false,
  error: "Failed to deploy containers: Sandbox not found"
}
```

#### Resource Errors
```javascript
{
  success: false,
  error: "Failed to allocate resources: Port 8080 already in use"
}
```

### Error Handling Best Practices

```javascript
async function safeCreateSandbox(hospitalId, srsDocument) {
  try {
    const builder = new SandboxBuilder();
    const result = await builder.createSandboxEnvironment(hospitalId, srsDocument);
    
    if (!result.success) {
      console.error('Sandbox creation failed:', result.error);
      return { success: false, error: result.error };
    }
    
    // Attempt deployment with fallback
    const deployResult = await builder.deployDockerContainers(result.sandboxId);
    if (!deployResult.success) {
      // Cleanup failed sandbox
      await builder.destroySandboxEnvironment(result.sandboxId);
      return { success: false, error: 'Deployment failed, sandbox cleaned up' };
    }
    
    return { success: true, sandbox: result, deployment: deployResult };
    
  } catch (error) {
    console.error('Unexpected error:', error);
    return { success: false, error: 'Unexpected system error' };
  }
}
```

---

## 📝 Type Definitions

### SRS Document Schema
```typescript
interface SRSDocument {
  functionalRequirements: FunctionalRequirement[];
  nonFunctionalRequirements: NonFunctionalRequirement[];
  compliance: ComplianceRequirements;
  vendorIntegrations: VendorIntegration[];
  implementationPhases: ImplementationPhase[];
}

interface FunctionalRequirement {
  id: string;
  text: string;
  acceptance: string;
}

interface NonFunctionalRequirement {
  id: string;
  text: string;
  acceptance: string;
}

interface ComplianceRequirements {
  hipaa?: {
    required: boolean;
    safeguards?: string[];
  };
  nist80066?: {
    required: boolean;
    controls?: string[];
  };
  hitech?: {
    required: boolean;
  };
}

interface VendorIntegration {
  vendor: string;
  type: string;
  version?: string;
  protocols?: string[];
  endpoints?: APIEndpoint[];
  authentication?: string;
}

interface APIEndpoint {
  path: string;
  method: string;
}

interface ImplementationPhase {
  phase: number;
  name: string;
  duration: string;
  requirements: string[];
}
```

### Sandbox Configuration Schema
```typescript
interface SandboxConfig {
  sandboxId: string;
  hospitalId: string;
  status: 'creating' | 'running' | 'stopped' | 'error';
  createdAt: string;
  stoppedAt?: string;
  srsDocument: SRSDocument;
  components: {
    database: boolean;
    cache: boolean;
    ehrMocks: EHRMock[];
    monitoring: boolean;
    dashboard: boolean;
  };
  network: NetworkConfig;
  ports: PortAllocation;
  accessUrls: AccessUrls;
  healthStatus: string;
}

interface NetworkConfig {
  name: string;
  subnet: string;
  gateway: string;
  isolated: boolean;
}

interface PortAllocation {
  dashboard: number;
  database: number;
  cache: number;
  ehrMock: number;
  monitoring: number;
  grafana: number;
}

interface AccessUrls {
  dashboard: string;
  ehrMock: string;
  monitoring: string;
  grafana: string;
}
```

---

## 🚀 Performance Considerations

### Resource Management
- **Memory Usage**: ~512MB baseline per sandbox + components
- **CPU Usage**: Minimal when idle, scales with concurrent users
- **Port Management**: Dynamic allocation prevents conflicts
- **Network Isolation**: Each sandbox gets unique subnet

### Scalability Limits
- **Concurrent Sandboxes**: 100+ supported (hardware dependent)
- **Container Limits**: Based on Docker/Kubernetes cluster capacity
- **Network Limits**: 254 sandboxes per network class (172.20.x.0/24)

### Optimization Tips
```javascript
// Reuse builders for multiple operations
const builder = new SandboxBuilder();
const parser = new EnvironmentParser();

// Batch operations when possible
const results = await Promise.all([
  builder.createSandboxEnvironment('hospital-1', srs1),
  builder.createSandboxEnvironment('hospital-2', srs2)
]);

// Clean up resources promptly
await builder.destroySandboxEnvironment(sandboxId);
```

---

*API Documentation v1.0 | Hospital Sandbox Generator*  
*Built with Test-Driven Development | 37/37 tests passing*
