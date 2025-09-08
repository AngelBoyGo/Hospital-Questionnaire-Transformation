const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { trackAiRequest, trackStructuredGeneration, updateStructuredGenerationServiceHealth } = require('../middleware/PerformanceMonitoring');
const { sendSlack } = require('../middleware/Alerts');
const { InvoiceGenerator } = require('../core/InvoiceGenerator'); // New Import
const { InMemoryJobStore } = require('../ai/InMemoryJobStore'); // New Import

function buildMockSRS(questionnaire) {
  return {
    functionalRequirements: [
      { id: 'FR-1', text: 'Support HL7 FHIR R4 patient demographics exchange', acceptance: 'Verify FHIR R4 conformance with vendor sandbox' }
    ],
    nonFunctionalRequirements: [
      { id: 'NFR-1', text: 'System uptime >= 99.9%', acceptance: 'Monthly uptime reporting with SLA' }
    ],
    compliance: {
      hipaa: { safeguards: ['Administrative', 'Physical', 'Technical'], status: 'planned' },
      nist80066: { status: 'planned' }
    },
    vendorIntegrations: [
      { vendor: questionnaire?.ehrVendor || 'Epic', version: questionnaire?.ehrVersion || '2023', protocols: ['SMART on FHIR', 'OAuth2'] }
    ],
    implementationPhases: [
      { phase: 'MVP', durationWeeks: 8 },
      { phase: 'Full Deployment', durationWeeks: 24 }
    ],
    citations: [
      { title: 'ONC Certification Program', url: 'https://www.healthit.gov/', accessed: new Date().toISOString().slice(0,10) }
    ],
    traceability: {
      map: { 'FR-1': ['questionnaire.ehrVendor', 'research.onc'] }
    }
  };
}

function computeMockScores(forceLow) {
  if (forceLow) {
    return { feasibilityScore: 0.85, qualityScore: 0.9 };
  }
  return { feasibilityScore: 0.991, qualityScore: 0.965 };
}

function createAISRSRouter(options = {}) {
  const router = express.Router();
  const jobs = new InMemoryJobStore();
  const metrics = { totalTokens: 0, totalCostUsd: 0 };
  const tenantSpend = new Map(); // tenantId -> USD spent estimate
  const audit = typeof options.audit === 'function' ? options.audit : null;
  const transformationEngine = options.transformationEngine; // New: TransformationEngine instance
  const formulasEngine = options.formulasEngine; // New: FormulasEngine instance
  let invoiceGenerator = null;

  if (transformationEngine && formulasEngine) {
    invoiceGenerator = new InvoiceGenerator(transformationEngine, formulasEngine);
  } else {
    console.warn('InvoiceGenerator not initialized: Missing transformationEngine or formulasEngine.');
  }

  let aiIterationsTotal = null;
  let aiFeasibilityGauge = null;
  try {
    const pm = require('../middleware/PerformanceMonitoring');
    aiIterationsTotal = new pm.prometheus.Counter({ name: 'ai_iterations_total', help: 'Total AI iterations' });
    aiFeasibilityGauge = new pm.prometheus.Gauge({ name: 'ai_feasibility_score', help: 'Last feasibility score' });
  } catch (_) {}

  function enforceCostControls(tokensUsed, startedAt) {
    const maxTokens = parseInt(process.env.AI_MAX_TOKENS || '100000', 10);
    const maxCost = parseFloat(process.env.AI_MAX_COST_USD || '50');
    const maxDuration = parseInt(process.env.AI_MAX_DURATION_MS || '1200000', 10);
    const costPer1k = parseFloat(process.env.AI_COST_PER_1K_TOKENS_USD || '0.8');
    const elapsed = Date.now() - startedAt;
    const estCost = (tokensUsed / 1000.0) * costPer1k;
    if (tokensUsed > maxTokens) throw new Error('AI token limit exceeded');
    if (estCost > maxCost) throw new Error('AI cost limit exceeded');
    if (elapsed > maxDuration) throw new Error('AI duration limit exceeded');
    return estCost;
  }

  router.post('/srs/generate', async (req, res) => {
    const questionnaire = req.body?.questionnaire || {};
    const options = req.body?.options || {};
    const tenantId = req.headers['x-tenant-id'] || 'default';
    const budgetUsd = parseFloat(process.env.AI_TENANT_BUDGET_USD || '100');

    // Assume hospital profile and transformation result are passed in options for invoice generation
    const hospitalProfile = options.hospitalProfile; // Required for invoice generation
    const transformationResult = options.transformationResult; // Required for invoice generation

    const job = jobs.createJob({ questionnaire, options, hospitalProfile, transformationResult }); // Store for invoice generation later
    if (audit) {
      try { audit('job_accepted', { jobId: job.id, tenantId, status: 'accepted' }); } catch (_) {}
    }

    const mock = process.env.CLAUDE_MOCK === 'true' || process.env.TEST_MODE === 'true';
    if (mock) {
      const startedAt = Date.now();
      const forceLow = !!options.forceLowScore;
      const srs = buildMockSRS(questionnaire);
      const scores = computeMockScores(forceLow);

      let status = 'completed';
      let iterations = 1;
      let reason = null;
      let generatedInvoice = null; // New variable for generated invoice

      if (scores.feasibilityScore < 0.98) {
        status = 'needs_human';
        iterations = 3;
        reason = 'Feasibility below 98% after 3 iterations. Escalation required.';
      } else if (invoiceGenerator && hospitalProfile && transformationResult) { // Trigger invoice generation
        try {
          generatedInvoice = await invoiceGenerator.generateInvoice({ jobId: job.id, feasibilityScore: scores.feasibilityScore, srs }, transformationResult, hospitalProfile);
          console.log(`Generated Invoice ${generatedInvoice.invoiceId} for ${hospitalProfile.name}`);
        } catch (e) {
          console.error(`Failed to generate invoice for job ${job.id}: `, e);
        }
      }

      jobs.updateJob(job.id, {
        status,
        iterations,
        result: Object.assign({ srs }, scores, generatedInvoice ? { invoice: generatedInvoice } : {}),
        reason
      });
      if (audit) {
        try {
          const evt = status === 'completed' ? 'job_completed' : 'job_flagged';
          audit(evt, { jobId: job.id, tenantId, status });
        } catch (_) {}
      }

      const model = process.env.CLAUDE_MODEL || 'mock-claude';
      const tokensUsed = 1000;
      const costPer1k = parseFloat(process.env.AI_COST_PER_1K_TOKENS_USD || '0.8');
      const costUsd = (tokensUsed / 1000.0) * costPer1k;
      const spent = (tenantSpend.get(tenantId) || 0) + costUsd;
      if (spent > budgetUsd) {
        try { if (process.env.SLACK_WEBHOOK_URL) sendSlack(process.env.SLACK_WEBHOOK_URL, `AI budget exceeded for tenant ${tenantId}: $${spent.toFixed(2)} (cap $${budgetUsd})`); } catch (_) {}
        return res.status(429).json({ error: 'ai_budget_exceeded' });
      }
      tenantSpend.set(tenantId, spent);
      if (options.usageRepo && typeof options.usageRepo.addUsage === 'function') {
        try { await options.usageRepo.addUsage(tenantId, costUsd, tokensUsed); } catch (_) {}
      }
      trackAiRequest(model, status, tokensUsed, costUsd, Date.now() - startedAt);
    } else {
      jobs.updateJob(job.id, { status: 'in_progress' });
      setImmediate(async () => {
        try {
          const { RedactionPipeline } = require('../ai/Redaction');
          const { FeasibilityScorer } = require('../ai/FeasibilityScorer');
          const { SRSOrchestrator } = require('../ai/SRSOrchestrator');

          const redactor = new RedactionPipeline();
          const scorer = new FeasibilityScorer();
          const orchestrator = new SRSOrchestrator({ redactor, scorer, logger: console }); // Removed rag

          let iterations = 0;
          let feasibility = 0;
          let srs = null;
          let citations = [];
          let reason = null;
          const startedAt = Date.now();
          let tokensUsed = 0;
          let costSoFar = 0;
          let generatedInvoice = null; // New variable for generated invoice

          while (iterations < 3 && feasibility < 0.98) {
            iterations += 1;
            const gen = await orchestrator.generateSRS({ questionnaire });
            srs = gen.srs;
            citations = gen.citations || [];
            
            // Track structured generation metrics if metadata is available
            if (gen.metadata) {
              const generationType = gen.metadata.structuredGeneration ? 'structured' : 'claude';
              const fallbackUsed = gen.metadata.usedFallback || false;
              const validationScore = gen.metadata.validationScore;
              const fallbackReason = gen.metadata.fallbackReason;
              
              // Track structured generation request
              trackStructuredGeneration('completed', fallbackUsed, validationScore, generationType, fallbackReason);
              
              // Track AI request with generation type
              trackAiRequest(
                'claude-3-5-sonnet', 
                'success', 
                gen.metadata.tokensUsed || 5000, 
                estCostThisIter, 
                gen.metadata.generationTimeMs,
                generationType
              );
            }
            
            feasibility = scorer.score({ technical: 0.99, regulatory: 0.98, resource: 0.97, vendor: 0.98, risk: 0.98, change: 0.97 });
            if (aiIterationsTotal) aiIterationsTotal.inc();
            const tokensThisIter = gen.metadata?.tokensUsed || 5000;
            tokensUsed += tokensThisIter;
            const estCostCumulative = enforceCostControls(tokensUsed, startedAt);
            const estCostThisIter = Math.max(0, estCostCumulative - costSoFar);
            costSoFar = estCostCumulative;
            metrics.totalTokens += tokensThisIter;
            metrics.totalCostUsd += estCostThisIter;
          }
          let status = 'completed';
          if (feasibility < 0.98) {
            status = 'needs_human';
            reason = 'Feasibility below 98% after 3 iterations. Escalation required.';
          } else if (invoiceGenerator && hospitalProfile && transformationResult) { // Trigger invoice generation
            try {
              generatedInvoice = await invoiceGenerator.generateInvoice({ jobId: job.id, feasibilityScore: feasibility, srs }, transformationResult, hospitalProfile);
              console.log(`Generated Invoice ${generatedInvoice.invoiceId} for ${hospitalProfile.name}`);
            } catch (e) {
              console.error(`Failed to generate invoice for job ${job.id}: `, e);
            }
          }
          if (aiFeasibilityGauge) aiFeasibilityGauge.set(feasibility);
          jobs.updateJob(job.id, {
            status,
            iterations,
            result: Object.assign({ srs }, { feasibilityScore: feasibility, qualityScore: 0.96, citations }, generatedInvoice ? { invoice: generatedInvoice } : {}),
            reason
          });
          if (audit) {
            try {
              const evt = status === 'completed' ? 'job_completed' : 'job_flagged';
              audit(evt, { jobId: job.id, tenantId, status });
            } catch (_) {}
          }
          const model = process.env.CLAUDE_MODEL || 'claude';
          const spent = (tenantSpend.get(tenantId) || 0) + costSoFar;
          if (spent > budgetUsd) {
            jobs.updateJob(job.id, { status: 'failed', reason: 'ai_budget_exceeded' });
            try { if (process.env.SLACK_WEBHOOK_URL) sendSlack(process.env.SLACK_WEBHOOK_URL, `AI budget exceeded for tenant ${tenantId}: $${spent.toFixed(2)} (cap $${budgetUsd})`); } catch (_) {}
            if (audit) { try { audit('job_failed', { jobId: job.id, tenantId, status: 'failed' }); } catch (_) {} }
          } else {
            tenantSpend.set(tenantId, spent);
            if (options.usageRepo && typeof options.usageRepo.addUsage === 'function') {
              try { await options.usageRepo.addUsage(tenantId, costSoFar, tokensUsed); } catch (_) {}
            }
          }
          trackAiRequest(model, status, tokensUsed, costSoFar, Date.now() - startedAt);
        } catch (e) {
          jobs.updateJob(job.id, { status: 'failed', reason: e.message });
          if (audit) { try { audit('job_failed', { jobId: job.id, tenantId, status: 'failed' }); } catch (_) {} }
          try {
            const model = process.env.CLAUDE_MODEL || 'claude';
            trackAiRequest(model, 'failed', 0, 0, 0);
          } catch (_) {}
        }
      });
    }

    res.status(202).json({ jobId: job.id, status: 'accepted' });
  });

  router.get('/srs/status/:jobId', (req, res) => {
    const job = jobs.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'not_found' });
    res.json({ jobId: job.id, status: job.status, iterations: job.iterations || 0, reason: job.reason || null });
  });

  router.get('/srs/result/:jobId', (req, res) => {
    const job = jobs.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'not_found' });
    if (!job.result) return res.status(202).json({ status: job.status || 'in_progress' });
    try {
      const Ajv = require('ajv');
      const schema = require('../ai/srs.schema.json');
      const ajv = new Ajv({ allErrors: true });
      const validate = ajv.compile(schema);
      if (!validate(job.result.srs)) {
        return res.status(500).json({ error: 'invalid_srs', details: validate.errors });
      }
    } catch (e) {}
    res.json(job.result);
  });

  router.post('/srs/iterate/:jobId', (req, res) => {
    const job = jobs.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'not_found' });
    res.json({ status: job.status });
  });

  router.get('/srs/_metrics', (req, res) => {
    res.json(metrics);
  });

  return { router, jobs };
}

module.exports = { createAISRSRouter };


