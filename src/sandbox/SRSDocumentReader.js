/**
 * Hospital Sandbox Generator - SRS Document Reader
 * 
 * MISSION: Read and understand SRS documents to extract sandbox requirements
 * PATENT: Extends Metis patent portfolio with automated sandbox generation
 * 
 * This class implements the first step of our TDD approach:
 * "Can we read an SRS document and understand what it says?"
 */

class SRSDocumentReader {
  constructor() {
    // Define required SRS fields for validation
    this.requiredFields = [
      'functionalRequirements',
      'nonFunctionalRequirements', 
      'compliance',
      'vendorIntegrations',
      'implementationPhases'
    ];

    // Infrastructure keywords for parsing
    this.infraKeywords = {
      databases: ['postgresql', 'postgres', 'mysql', 'mongodb', 'database'],
      caching: ['redis', 'memcached', 'cache'],
      orchestration: ['kubernetes', 'k8s', 'docker', 'container'],
      messaging: ['rabbitmq', 'kafka', 'activemq', 'message']
    };

    // EHR vendor patterns
    this.ehrVendors = ['Epic', 'Cerner', 'Allscripts', 'MEDITECH', 'athenahealth'];
  }

  /**
   * Read and validate an SRS document
   * @param {Object} srsDocument - The SRS JSON document
   * @returns {Object} - Success/failure result with parsed data
   */
  readSRS(srsDocument) {
    try {
      // Validate required fields
      const validation = this._validateSRSStructure(srsDocument);
      if (!validation.valid) {
        return {
          success: false,
          error: `Missing required field: ${validation.missingField}`
        };
      }

      // Parse and return the document
      return {
        success: true,
        data: {
          functionalRequirements: srsDocument.functionalRequirements || [],
          nonFunctionalRequirements: srsDocument.nonFunctionalRequirements || [],
          compliance: srsDocument.compliance || {},
          vendorIntegrations: srsDocument.vendorIntegrations || [],
          implementationPhases: srsDocument.implementationPhases || []
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to read SRS: ${error.message}`
      };
    }
  }

  /**
   * Validate SRS document structure and required fields
   * @param {Object} srsDocument - SRS document to validate
   * @returns {Object} - Validation result with isValid flag and errors array
   */
  validateSRSDocument(srsDocument) {
    const errors = [];
    
    // Check if document exists
    if (!srsDocument || typeof srsDocument !== 'object') {
      return {
        isValid: false,
        errors: ['SRS document must be a valid object']
      };
    }
    
    // Check required top-level properties
    const requiredFields = ['functionalRequirements', 'nonFunctionalRequirements', 'compliance'];
    for (const field of requiredFields) {
      if (!srsDocument[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }
    
    // Validate functional requirements structure
    if (srsDocument.functionalRequirements) {
      if (!Array.isArray(srsDocument.functionalRequirements)) {
        errors.push('functionalRequirements must be an array');
      } else {
        srsDocument.functionalRequirements.forEach((req, index) => {
          if (!req.id) errors.push(`functionalRequirements[${index}] missing id`);
          if (!req.text) errors.push(`functionalRequirements[${index}] missing text`);
        });
      }
    }
    
    // Validate non-functional requirements structure
    if (srsDocument.nonFunctionalRequirements) {
      if (!Array.isArray(srsDocument.nonFunctionalRequirements)) {
        errors.push('nonFunctionalRequirements must be an array');
      } else {
        srsDocument.nonFunctionalRequirements.forEach((req, index) => {
          if (!req.id) errors.push(`nonFunctionalRequirements[${index}] missing id`);
          if (!req.text) errors.push(`nonFunctionalRequirements[${index}] missing text`);
        });
      }
    }
    
    // Validate compliance structure
    if (srsDocument.compliance && typeof srsDocument.compliance !== 'object') {
      errors.push('compliance must be an object');
    }
    
    // Validate vendor integrations if present
    if (srsDocument.vendorIntegrations) {
      if (!Array.isArray(srsDocument.vendorIntegrations)) {
        errors.push('vendorIntegrations must be an array');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Extract infrastructure requirements from SRS
   * @param {Object} srsDocument - The SRS document
   * @returns {Object} - Infrastructure components needed
   */
  extractInfrastructureNeeds(srsDocument) {
    const infrastructure = {
      databases: [],
      caching: [],
      orchestration: [],
      messaging: [],
      nodes: 1
    };

    // Parse functional requirements for infrastructure mentions
    const allRequirements = [
      ...(srsDocument.functionalRequirements || []),
      ...(srsDocument.nonFunctionalRequirements || [])
    ];

    allRequirements.forEach(req => {
      const text = req.text.toLowerCase();
      
      // Check for database requirements
      this.infraKeywords.databases.forEach(keyword => {
        if (text.includes(keyword) && !infrastructure.databases.includes(keyword)) {
          infrastructure.databases.push(keyword);
        }
      });

      // Check for caching requirements  
      this.infraKeywords.caching.forEach(keyword => {
        if (text.includes(keyword) && !infrastructure.caching.includes(keyword)) {
          infrastructure.caching.push(keyword);
        }
      });

      // Check for orchestration requirements
      this.infraKeywords.orchestration.forEach(keyword => {
        if (text.includes(keyword) && !infrastructure.orchestration.includes(keyword)) {
          infrastructure.orchestration.push(keyword);
        }
      });

      // Extract node count for Kubernetes
      const nodeMatch = text.match(/(\d+)\s*nodes?/);
      if (nodeMatch) {
        infrastructure.nodes = Math.max(infrastructure.nodes, parseInt(nodeMatch[1]));
      }
    });

    return infrastructure;
  }

  /**
   * Extract EHR integration requirements
   * @param {Object} srsDocument - The SRS document  
   * @returns {Object} - EHR systems and requirements
   */
  extractEHRRequirements(srsDocument) {
    const ehrRequirements = {
      ehrSystems: [],
      authenticationTypes: []
    };

    // Parse vendor integrations for EHR systems
    (srsDocument.vendorIntegrations || []).forEach(integration => {
      if (integration.type === 'EHR' || this.ehrVendors.includes(integration.vendor)) {
        ehrRequirements.ehrSystems.push({
          vendor: integration.vendor,
          type: integration.type,
          version: integration.version,
          apiEndpoints: integration.apiEndpoints || integration.endpoints || [],
          protocols: integration.protocols || [],
          authentication: integration.authentication
        });

        // Collect authentication types
        if (integration.authentication && 
            !ehrRequirements.authenticationTypes.includes(integration.authentication)) {
          ehrRequirements.authenticationTypes.push(integration.authentication);
        }
      }
    });

    return ehrRequirements;
  }

  /**
   * Extract compliance requirements for sandbox security
   * @param {Object} srsDocument - The SRS document
   * @returns {Object} - Compliance and security requirements
   */
  extractComplianceRequirements(srsDocument) {
    const compliance = srsDocument.compliance || {};
    
    const requirements = {
      hipaaRequired: !!compliance.hipaa?.required,
      nistRequired: !!compliance.nist80066?.required,
      hitechRequired: !!compliance.hitech?.required,
      securityControls: []
    };

    // Extract HIPAA safeguards
    if (compliance.hipaa?.safeguards) {
      requirements.securityControls.push(...compliance.hipaa.safeguards);
    }

    // Extract NIST controls
    if (compliance.nist80066?.controls) {
      requirements.securityControls.push(...compliance.nist80066.controls);
    }

    // Remove duplicates
    requirements.securityControls = [...new Set(requirements.securityControls)];

    return requirements;
  }

  /**
   * Extract performance requirements for sandbox sizing
   * @param {Object} srsDocument - The SRS document
   * @returns {Object} - Performance and scalability requirements
   */
  extractPerformanceRequirements(srsDocument) {
    const performance = {
      maxConcurrentUsers: 100, // default
      responseTimeTarget: 5000, // 5s default
      dbQueryTimeTarget: 500, // 500ms default  
      uptimeTarget: 99.0 // 99% default
    };

    // Parse non-functional requirements for performance metrics
    (srsDocument.nonFunctionalRequirements || []).forEach(req => {
      const text = req.text.toLowerCase();
      const acceptance = (req.acceptance || '').toLowerCase();
      const allText = `${text} ${acceptance}`;

      // Extract concurrent user count
      const userMatch = allText.match(/(\d+)\s*concurrent\s*users?/);
      if (userMatch) {
        performance.maxConcurrentUsers = parseInt(userMatch[1]);
      }

      // Extract response time target from acceptance criteria
      const responseMatch = allText.match(/[<≤]?\s*(\d+)s\s*response/);
      if (responseMatch) {
        performance.responseTimeTarget = parseInt(responseMatch[1]) * 1000; // convert to ms
      }

      // Extract database query time
      const dbMatch = allText.match(/[<≤]?\s*(\d+)ms/);
      if (dbMatch && allText.includes('query')) {
        performance.dbQueryTimeTarget = parseInt(dbMatch[1]);
      }

      // Extract uptime target
      const uptimeMatch = allText.match(/(\d+\.?\d*)%.*(?:uptime|availability)/);
      if (uptimeMatch) {
        performance.uptimeTarget = parseFloat(uptimeMatch[1]);
      }
    });

    return performance;
  }

  /**
   * Extract integration and API requirements
   * @param {Object} srsDocument - The SRS document
   * @returns {Object} - Integration requirements for sandbox
   */
  extractIntegrationRequirements(srsDocument) {
    const integrations = {
      protocols: [],
      endpoints: [],
      vendors: []
    };

    // Parse functional requirements for protocols
    (srsDocument.functionalRequirements || []).forEach(req => {
      const text = req.text.toLowerCase();
      
      if (text.includes('hl7') || text.includes('fhir')) {
        if (!integrations.protocols.includes('HL7-FHIR')) {
          integrations.protocols.push('HL7-FHIR');
        }
      }
    });

    // Parse vendor integrations
    (srsDocument.vendorIntegrations || []).forEach(integration => {
      integrations.vendors.push({
        vendor: integration.vendor,
        type: integration.type
      });

      // Collect protocols
      if (integration.protocols) {
        integration.protocols.forEach(protocol => {
          if (!integrations.protocols.includes(protocol)) {
            integrations.protocols.push(protocol);
          }
        });
      }

      // Collect endpoints
      if (integration.endpoints) {
        integrations.endpoints.push(...integration.endpoints);
      }
    });

    return integrations;
  }

  /**
   * Validate SRS document structure
   * @private
   */
  _validateSRSStructure(srsDocument) {
    if (!srsDocument || typeof srsDocument !== 'object') {
      return { valid: false, missingField: 'document structure' };
    }

    for (const field of this.requiredFields) {
      if (!(field in srsDocument)) {
        return { valid: false, missingField: field };
      }
    }

    return { valid: true };
  }
}

module.exports = SRSDocumentReader;
