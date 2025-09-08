let Anthropic = null;
const { TEMPLATES, buildUserPrompt } = require('./srsPromptTemplates');
const StructuredGenerationClient = require('./StructuredGenerationClient');

class SRSOrchestrator {
  constructor({ redactor, scorer, logger }) {
    this.redactor = redactor;
    this.scorer = scorer;
    this.logger = logger || console;
    const apiKey = process.env.CLAUDE_API_KEY;
    this.mock = process.env.CLAUDE_MOCK === 'true' || process.env.TEST_MODE === 'true' || !apiKey;
    
    // Initialize structured generation client
    this.structuredClient = new StructuredGenerationClient({
      serviceUrl: process.env.STRUCTURED_GENERATION_SERVICE_URL,
      timeout: 60000,
      enableFallback: true
    });
    
    // Track structured generation events
    this.structuredClient.on('generation_success', (data) => {
      this.logger.info(`Structured generation success: ${data.responseTime}ms, validation=${data.validationScore}`);
    });
    
    this.structuredClient.on('fallback_used', (data) => {
      this.logger.warn(`Structured generation fallback: ${data.error}`);
    });
    
    if (!this.mock) {
      try {
        Anthropic = Anthropic || require('anthropic');
        this.client = new Anthropic({ apiKey });
      } catch (e) {
        // Anthropic SDK not installed; fallback to mock
        this.mock = true;
        this.client = null;
      }
    } else {
      this.client = null;
    }
    this.model = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20240620';
  }

  async generateSRS(input) {
    const startTime = Date.now();
    const sanitized = this.redactor ? this.redactor.redact(input) : input;
    
    // Lightweight RAG retrieval (works also in mock mode)
    let ragCitations = [];
    if (this.rag && sanitized?.questionnaire) {
      try {
        const q = JSON.stringify(sanitized.questionnaire);
        let docs = this.rag.retrieve(q, 3) || [];
        if (!docs.length) {
          // Fallback to general healthcare IT keywords
          docs = this.rag.retrieve('FHIR HIPAA ONC SMART authorization', 3) || [];
        }
        ragCitations = docs.map(d => ({ title: d.metadata?.title || 'RAG Doc', url: d.metadata?.url || null })).filter(c => c.title);
      } catch (_) {}
    }

    // Try structured generation first
    if (!this.mock) {
      try {
        const healthCheck = await this.structuredClient.getServiceHealth();
        
        if (healthCheck.status === 'healthy' && healthCheck.outlines_available) {
          this.logger.info('Using structured generation service for SRS');
          
          const context = { 
            guidelines: { ieee29148: true, hipaa: true, hl7: true },
            ragContext: ragCitations
          };
          
          const structuredResult = await this.structuredClient.generateStructuredSRS(
            sanitized.questionnaire,
            context,
            { maxTokens: 5000 }
          );
          
          // Merge RAG citations with generated citations
          const allCitations = [
            ...ragCitations,
            ...(structuredResult.srs.citations || [])
          ];
          
          // Remove duplicate citations by title
          const uniqueCitations = allCitations.filter((citation, index, self) =>
            index === self.findIndex(c => c.title === citation.title)
          );
          
          const totalTime = Date.now() - startTime;
          
          return {
            srs: structuredResult.srs,
            citations: uniqueCitations,
            metadata: {
              structuredGeneration: true,
              generationTimeMs: totalTime,
              validationScore: structuredResult.validation_score,
              tokensUsed: structuredResult.metadata.tokens_used,
              usedFallback: structuredResult.metadata.used_fallback,
              qualityWarning: structuredResult.validation_score < 0.8
            }
          };
        } else {
          this.logger.warn('Structured generation service not available, falling back to Claude');
        }
      } catch (error) {
        this.logger.warn(`Structured generation failed: ${error.message}, falling back to Claude`);
      }
    }

    // Fallback to traditional Claude generation
    if (this.mock) {
      // Real generation handled via AISRSRouter mock builder
      return { 
        srs: {}, 
        citations: ragCitations,
        metadata: {
          structuredGeneration: false,
          fallbackReason: 'mock_mode'
        }
      };
    }

    this.logger.info('Using traditional Claude generation for SRS');

    const ctx = { guidelines: { ieee29148: true, hipaa: true, hl7: true } };
    const generations = [];
    
    try {
      for (const tmpl of TEMPLATES) {
        const msg = await this.client.messages.create({
          model: this.model,
          max_tokens: 5000,
          temperature: 0.2,
          system: tmpl.system,
          messages: [
            { role: 'user', content: [buildUserPrompt(sanitized.questionnaire, ctx)] }
          ]
        });
        const text = msg.content?.[0]?.text || '{}';
        try {
          const json = JSON.parse(text);
          generations.push({ name: tmpl.name, json });
        } catch (e) {
          this.logger.warn(`Template ${tmpl.name} returned non-JSON; skipping`);
        }
      }

      // Simple ensemble: choose the JSON with most sections present
      const scored = generations.map(g => ({
        ...g,
        score: ['functionalRequirements','nonFunctionalRequirements','compliance','vendorIntegrations','implementationPhases','citations','traceability']
          .reduce((acc, k) => acc + (g.json && g.json[k] ? 1 : 0), 0)
      })).sort((a,b) => b.score - a.score);

      const best = scored[0] || { json: {} };
      const generatedCitations = (best.json?.citations || []);
      
      // Merge all citations
      const allCitations = [...ragCitations, ...generatedCitations];
      const uniqueCitations = allCitations.filter((citation, index, self) =>
        index === self.findIndex(c => c.title === citation.title)
      );
      
      const totalTime = Date.now() - startTime;
      
      return { 
        srs: best.json, 
        citations: uniqueCitations,
        metadata: {
          structuredGeneration: false,
          generationTimeMs: totalTime,
          fallbackReason: 'structured_generation_failed',
          ensembleTemplates: generations.length,
          bestTemplateScore: best.score
        }
      };
      
    } catch (error) {
      this.logger.error(`Claude generation failed: ${error.message}`);
      
      // Return minimal fallback SRS
      const totalTime = Date.now() - startTime;
      return {
        srs: {
          functionalRequirements: [],
          nonFunctionalRequirements: [],
          compliance: {},
          vendorIntegrations: [],
          implementationPhases: [],
          citations: [],
          traceability: {}
        },
        citations: ragCitations,
        metadata: {
          structuredGeneration: false,
          generationTimeMs: totalTime,
          fallbackReason: 'all_generation_failed',
          error: error.message
        }
      };
    }
  }
}

module.exports = { SRSOrchestrator };


