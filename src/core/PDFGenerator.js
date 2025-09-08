/**
 * Professional PDF Document Generator for Hospital Technical Specifications
 * Converts JSON transformation results into professional PDF reports
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;

class PDFGenerator {
  constructor() {
    this.templatePath = path.join(__dirname, '..', 'templates');
    this.outputPath = path.join(__dirname, '..', '..', 'generated_documents');
    this.initialized = false;
  }

  async initialize() {
    try {
      // Ensure output directory exists
      await fs.mkdir(this.outputPath, { recursive: true });
      
      // Ensure templates directory exists
      await fs.mkdir(this.templatePath, { recursive: true });
      
      this.initialized = true;
      console.log('PDF Generator initialized successfully');
    } catch (error) {
      console.error('Failed to initialize PDF Generator:', error);
      throw error;
    }
  }

  /**
   * Generate Executive Summary PDF
   */
  async generateExecutiveSummary(transformationResult, options = {}) {
    if (!this.initialized) await this.initialize();

    const html = this.generateExecutiveSummaryHTML(transformationResult);
    const filename = `executive-summary-${transformationResult.transformationId}.pdf`;
    
    return await this.generatePDFFromHTML(html, filename, {
      format: 'A4',
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
      displayHeaderFooter: true,
      headerTemplate: this.getHeaderTemplate(transformationResult),
      footerTemplate: this.getFooterTemplate(),
      ...options
    });
  }

  /**
   * Generate Technical Specification PDF
   */
  async generateTechnicalSpecification(transformationResult, options = {}) {
    if (!this.initialized) await this.initialize();

    const html = this.generateTechnicalSpecHTML(transformationResult);
    const filename = `technical-specification-${transformationResult.transformationId}.pdf`;
    
    return await this.generatePDFFromHTML(html, filename, {
      format: 'A4',
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
      displayHeaderFooter: true,
      headerTemplate: this.getHeaderTemplate(transformationResult),
      footerTemplate: this.getFooterTemplate(),
      ...options
    });
  }

  /**
   * Generate Implementation Roadmap PDF
   */
  async generateImplementationRoadmap(transformationResult, options = {}) {
    if (!this.initialized) await this.initialize();

    const html = this.generateRoadmapHTML(transformationResult);
    const filename = `implementation-roadmap-${transformationResult.transformationId}.pdf`;
    
    return await this.generatePDFFromHTML(html, filename, {
      format: 'A4',
      orientation: 'landscape', // Better for timeline charts
      margin: { top: '15mm', right: '10mm', bottom: '15mm', left: '10mm' },
      displayHeaderFooter: true,
      headerTemplate: this.getHeaderTemplate(transformationResult),
      footerTemplate: this.getFooterTemplate(),
      ...options
    });
  }

  /**
   * Generate Complete Report Bundle (All documents in one PDF)
   */
  async generateCompleteReport(transformationResult, options = {}) {
    if (!this.initialized) await this.initialize();

    const html = this.generateCompleteReportHTML(transformationResult);
    const filename = `complete-report-${transformationResult.transformationId}.pdf`;
    
    return await this.generatePDFFromHTML(html, filename, {
      format: 'A4',
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
      displayHeaderFooter: true,
      headerTemplate: this.getHeaderTemplate(transformationResult),
      footerTemplate: this.getFooterTemplate(),
      printBackground: true,
      ...options
    });
  }

  /**
   * Core PDF generation from HTML
   */
  async generatePDFFromHTML(html, filename, options = {}) {
    let browser;
    try {
      browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const pdfPath = path.join(this.outputPath, filename);
      const pdfBuffer = await page.pdf({
        path: pdfPath,
        ...options
      });

      return {
        success: true,
        filename,
        path: pdfPath,
        buffer: pdfBuffer,
        size: pdfBuffer.length
      };

    } catch (error) {
      console.error('PDF generation failed:', error);
      throw new Error(`PDF generation failed: ${error.message}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Generate Executive Summary HTML
   */
  generateExecutiveSummaryHTML(transformationResult) {
    const { executiveSummary, metadata } = transformationResult;
    const hospitalName = executiveSummary?.hospitalName || 'Hospital';
    const hospitalType = executiveSummary?.hospitalType || 'Community Hospital';
    const bedCount = executiveSummary?.bedCount || 0;
    const estimatedCost = this.formatCurrency(executiveSummary?.estimatedCost || 0);
    const timeline = executiveSummary?.estimatedTimeline || 'TBD';

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Executive Summary - ${hospitalName}</title>
        <style>
            ${this.getBaseStyles()}
            .executive-summary {
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
            }
            .hospital-overview {
                background: linear-gradient(135deg, #2E86AB, #A23B72);
                color: white;
                padding: 30px;
                border-radius: 10px;
                margin-bottom: 30px;
            }
            .key-metrics {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px;
                margin-bottom: 30px;
            }
            .metric-card {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 8px;
                border-left: 4px solid #2E86AB;
            }
            .metric-value {
                font-size: 2rem;
                font-weight: bold;
                color: #2E86AB;
                margin-bottom: 5px;
            }
            .metric-label {
                color: #666;
                font-size: 0.9rem;
            }
            .recommendations {
                background: #fff3cd;
                padding: 20px;
                border-radius: 8px;
                border-left: 4px solid #F18F01;
            }
            .competitive-advantages {
                background: #d4edda;
                padding: 20px;
                border-radius: 8px;
                border-left: 4px solid #28a745;
                margin-top: 20px;
            }
        </style>
    </head>
    <body>
        <div class="executive-summary">
            <div class="hospital-overview">
                <h1>${hospitalName}</h1>
                <h2>${hospitalType} • ${bedCount} Beds</h2>
                <p>Healthcare IT Transformation Executive Summary</p>
                <p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
            </div>

            <div class="key-metrics">
                <div class="metric-card">
                    <div class="metric-value">${estimatedCost}</div>
                    <div class="metric-label">Estimated Investment</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${timeline}</div>
                    <div class="metric-label">Implementation Timeline</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${executiveSummary?.riskLevel || 'Medium'}</div>
                    <div class="metric-label">Risk Level</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${executiveSummary?.complexityScore ? Math.round(executiveSummary.complexityScore * 100) + '%' : 'TBD'}</div>
                    <div class="metric-label">Complexity Score</div>
                </div>
            </div>

            <div class="recommendations">
                <h3>🎯 Key Recommendations</h3>
                <ul>
                    ${(executiveSummary?.keyRecommendations || ['Standard implementation approach recommended']).map(rec => 
                        `<li>${rec}</li>`
                    ).join('')}
                </ul>
            </div>

            <div class="competitive-advantages">
                <h3>🚀 Metis Transformation Engine™ Advantages</h3>
                <ul>
                    <li><strong>Speed:</strong> ${executiveSummary?.competitiveAdvantages?.speedImprovement || '95% faster than manual processes'}</li>
                    <li><strong>Accuracy:</strong> ${executiveSummary?.competitiveAdvantages?.accuracyImprovement || '87% more accurate than traditional methods'}</li>
                    <li><strong>Cost Savings:</strong> ${executiveSummary?.competitiveAdvantages?.costSavings || '89% cost savings vs consulting firms'}</li>
                </ul>
            </div>

            <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #eee;">
                <p style="text-align: center; color: #666; font-size: 0.9rem;">
                    Generated by Metis Transformation Engine™ | Patent-Protected Technology<br>
                    Transformation ID: ${transformationResult.transformationId}
                </p>
            </div>
        </div>
    </body>
    </html>`;
  }

  /**
   * Generate Technical Specification HTML
   */
  generateTechnicalSpecHTML(transformationResult) {
    const { specification, executiveSummary } = transformationResult;
    const hospitalName = executiveSummary?.hospitalName || 'Hospital';

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Technical Specification - ${hospitalName}</title>
        <style>
            ${this.getBaseStyles()}
            .tech-spec {
                max-width: 900px;
                margin: 0 auto;
                padding: 20px;
            }
            .spec-section {
                margin-bottom: 30px;
                padding: 20px;
                border: 1px solid #ddd;
                border-radius: 8px;
            }
            .spec-section h3 {
                color: #2E86AB;
                border-bottom: 2px solid #2E86AB;
                padding-bottom: 10px;
            }
            .infrastructure-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 15px;
                margin-top: 15px;
            }
            .infrastructure-item {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 6px;
            }
            .infrastructure-item strong {
                color: #2E86AB;
            }
            .compliance-badge {
                display: inline-block;
                background: #28a745;
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 0.8rem;
                margin: 2px;
            }
        </style>
    </head>
    <body>
        <div class="tech-spec">
            <h1>Technical Specification</h1>
            <h2>${hospitalName} - Implementation Details</h2>

            <div class="spec-section">
                <h3>🖥️ Infrastructure Requirements</h3>
                <div class="infrastructure-grid">
                    <div class="infrastructure-item">
                        <strong>Application Servers:</strong><br>
                        ${specification?.infrastructure?.compute_requirements?.application_servers || 'TBD'} servers
                    </div>
                    <div class="infrastructure-item">
                        <strong>Database Servers:</strong><br>
                        ${specification?.infrastructure?.compute_requirements?.database_servers || 'TBD'} servers
                    </div>
                    <div class="infrastructure-item">
                        <strong>Total CPU Cores:</strong><br>
                        ${specification?.infrastructure?.compute_requirements?.total_cpu_cores || 'TBD'} cores
                    </div>
                    <div class="infrastructure-item">
                        <strong>Total Memory:</strong><br>
                        ${specification?.infrastructure?.compute_requirements?.total_memory_gb || 'TBD'} GB RAM
                    </div>
                    <div class="infrastructure-item">
                        <strong>Primary Storage:</strong><br>
                        ${specification?.infrastructure?.storage_requirements?.primary_storage_gb || 'TBD'} GB
                    </div>
                    <div class="infrastructure-item">
                        <strong>Backup Storage:</strong><br>
                        ${specification?.infrastructure?.storage_requirements?.backup_storage_gb || 'TBD'} GB
                    </div>
                </div>
            </div>

            <div class="spec-section">
                <h3>🔗 Integration Requirements</h3>
                <p><strong>Primary EHR:</strong> ${specification?.integration?.emr_integration?.system || 'TBD'}</p>
                <p><strong>Interface Engine:</strong> ${specification?.integration?.interface_engine || 'TBD'}</p>
                <p><strong>Data Exchange Protocols:</strong></p>
                <ul>
                    ${specification?.integration?.data_exchange_protocols ? 
                        Object.values(specification.integration.data_exchange_protocols).map(protocol => 
                            `<li>${protocol}</li>`
                        ).join('') : 
                        '<li>HL7 FHIR R4</li><li>HL7 v2.x</li>'
                    }
                </ul>
            </div>

            <div class="spec-section">
                <h3>🔒 Security & Compliance</h3>
                <div style="margin-bottom: 15px;">
                    <span class="compliance-badge">HIPAA Compliant</span>
                    <span class="compliance-badge">HITECH Compliant</span>
                    <span class="compliance-badge">SOC 2 Ready</span>
                </div>
                <ul>
                    <li>End-to-end encryption for all data transmission</li>
                    <li>Role-based access control (RBAC)</li>
                    <li>Comprehensive audit logging</li>
                    <li>Regular security assessments</li>
                    <li>Incident response procedures</li>
                </ul>
            </div>

            <div class="spec-section">
                <h3>📊 Cost Breakdown</h3>
                <div class="infrastructure-grid">
                    <div class="infrastructure-item">
                        <strong>Infrastructure Cost:</strong><br>
                        ${this.formatCurrency(specification?.infrastructure?.compute_requirements?.estimated_cost || 0)}
                    </div>
                    <div class="infrastructure-item">
                        <strong>Storage Cost:</strong><br>
                        ${this.formatCurrency(specification?.infrastructure?.storage_requirements?.estimated_cost || 0)}
                    </div>
                    <div class="infrastructure-item">
                        <strong>Total Estimated Cost:</strong><br>
                        ${this.formatCurrency(executiveSummary?.estimatedCost || 0)}
                    </div>
                </div>
            </div>

            <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #eee;">
                <p style="text-align: center; color: #666; font-size: 0.9rem;">
                    Generated by Metis Transformation Engine™ | Patent-Protected Technology<br>
                    Transformation ID: ${transformationResult.transformationId}
                </p>
            </div>
        </div>
    </body>
    </html>`;
  }

  /**
   * Generate Implementation Roadmap HTML
   */
  generateRoadmapHTML(transformationResult) {
    const { executiveSummary } = transformationResult;
    const hospitalName = executiveSummary?.hospitalName || 'Hospital';
    const timeline = executiveSummary?.estimatedTimeline || '14-17 weeks';

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Implementation Roadmap - ${hospitalName}</title>
        <style>
            ${this.getBaseStyles()}
            .roadmap {
                max-width: 1000px;
                margin: 0 auto;
                padding: 20px;
            }
            .timeline {
                position: relative;
                margin: 30px 0;
            }
            .timeline-item {
                display: flex;
                margin-bottom: 30px;
                position: relative;
            }
            .timeline-marker {
                width: 40px;
                height: 40px;
                background: #2E86AB;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
                margin-right: 20px;
                flex-shrink: 0;
            }
            .timeline-content {
                flex: 1;
                background: #f8f9fa;
                padding: 20px;
                border-radius: 8px;
                border-left: 4px solid #2E86AB;
            }
            .timeline-content h4 {
                color: #2E86AB;
                margin-top: 0;
            }
            .phase-duration {
                color: #666;
                font-size: 0.9rem;
                font-style: italic;
            }
        </style>
    </head>
    <body>
        <div class="roadmap">
            <h1>Implementation Roadmap</h1>
            <h2>${hospitalName} - ${timeline} Implementation Plan</h2>

            <div class="timeline">
                <div class="timeline-item">
                    <div class="timeline-marker">1</div>
                    <div class="timeline-content">
                        <h4>Project Initiation & Planning</h4>
                        <p class="phase-duration">Weeks 1-2</p>
                        <ul>
                            <li>Stakeholder alignment and project charter</li>
                            <li>Technical requirements validation</li>
                            <li>Infrastructure procurement initiation</li>
                            <li>Project team formation and training</li>
                        </ul>
                    </div>
                </div>

                <div class="timeline-item">
                    <div class="timeline-marker">2</div>
                    <div class="timeline-content">
                        <h4>Infrastructure Setup</h4>
                        <p class="phase-duration">Weeks 3-6</p>
                        <ul>
                            <li>Hardware procurement and installation</li>
                            <li>Network configuration and security setup</li>
                            <li>Database server deployment</li>
                            <li>Initial security hardening</li>
                        </ul>
                    </div>
                </div>

                <div class="timeline-item">
                    <div class="timeline-marker">3</div>
                    <div class="timeline-content">
                        <h4>Application Deployment</h4>
                        <p class="phase-duration">Weeks 7-10</p>
                        <ul>
                            <li>EHR system installation and configuration</li>
                            <li>Integration engine setup</li>
                            <li>Data migration planning and execution</li>
                            <li>Initial system testing</li>
                        </ul>
                    </div>
                </div>

                <div class="timeline-item">
                    <div class="timeline-marker">4</div>
                    <div class="timeline-content">
                        <h4>Integration & Testing</h4>
                        <p class="phase-duration">Weeks 11-14</p>
                        <ul>
                            <li>Interface development and testing</li>
                            <li>End-to-end workflow validation</li>
                            <li>User acceptance testing</li>
                            <li>Performance optimization</li>
                        </ul>
                    </div>
                </div>

                <div class="timeline-item">
                    <div class="timeline-marker">5</div>
                    <div class="timeline-content">
                        <h4>Go-Live & Support</h4>
                        <p class="phase-duration">Weeks 15-17</p>
                        <ul>
                            <li>Production cutover</li>
                            <li>24/7 go-live support</li>
                            <li>User training and documentation</li>
                            <li>Post-implementation optimization</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div style="background: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #F18F01; margin-top: 30px;">
                <h3>🎯 Success Metrics</h3>
                <ul>
                    <li><strong>Timeline Adherence:</strong> Complete within ${timeline}</li>
                    <li><strong>Budget Compliance:</strong> Within ${this.formatCurrency(executiveSummary?.estimatedCost || 0)} budget</li>
                    <li><strong>User Adoption:</strong> >90% user satisfaction within 30 days</li>
                    <li><strong>System Performance:</strong> <2 second response times</li>
                    <li><strong>Uptime Target:</strong> 99.9% system availability</li>
                </ul>
            </div>

            <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #eee;">
                <p style="text-align: center; color: #666; font-size: 0.9rem;">
                    Generated by Metis Transformation Engine™ | Patent-Protected Technology<br>
                    Transformation ID: ${transformationResult.transformationId}
                </p>
            </div>
        </div>
    </body>
    </html>`;
  }

  /**
   * Generate Complete Report HTML (All sections combined)
   */
  generateCompleteReportHTML(transformationResult) {
    const executiveHTML = this.generateExecutiveSummaryHTML(transformationResult);
    const technicalHTML = this.generateTechnicalSpecHTML(transformationResult);
    const roadmapHTML = this.generateRoadmapHTML(transformationResult);

    // Extract body content from each section
    const executiveBody = executiveHTML.match(/<body[^>]*>([\s\S]*)<\/body>/)[1];
    const technicalBody = technicalHTML.match(/<body[^>]*>([\s\S]*)<\/body>/)[1];
    const roadmapBody = roadmapHTML.match(/<body[^>]*>([\s\S]*)<\/body>/)[1];

    const hospitalName = transformationResult.executiveSummary?.hospitalName || 'Hospital';

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Complete Report - ${hospitalName}</title>
        <style>
            ${this.getBaseStyles()}
            .page-break {
                page-break-before: always;
            }
            .cover-page {
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                min-height: 80vh;
                text-align: center;
                background: linear-gradient(135deg, #2E86AB, #A23B72);
                color: white;
                padding: 40px;
                border-radius: 10px;
                margin-bottom: 40px;
            }
            .cover-page h1 {
                font-size: 3rem;
                margin-bottom: 20px;
            }
            .cover-page h2 {
                font-size: 1.5rem;
                margin-bottom: 40px;
                opacity: 0.9;
            }
        </style>
    </head>
    <body>
        <div class="cover-page">
            <h1>${hospitalName}</h1>
            <h2>Healthcare IT Transformation Report</h2>
            <p style="font-size: 1.2rem;">Complete Technical Specification & Implementation Plan</p>
            <p style="margin-top: 40px;">Generated by Metis Transformation Engine™</p>
            <p>${new Date().toLocaleDateString()}</p>
        </div>

        <div class="page-break">
            <h1 style="color: #2E86AB; text-align: center; margin-bottom: 40px;">Executive Summary</h1>
            ${executiveBody}
        </div>

        <div class="page-break">
            <h1 style="color: #2E86AB; text-align: center; margin-bottom: 40px;">Technical Specification</h1>
            ${technicalBody}
        </div>

        <div class="page-break">
            <h1 style="color: #2E86AB; text-align: center; margin-bottom: 40px;">Implementation Roadmap</h1>
            ${roadmapBody}
        </div>
    </body>
    </html>`;
  }

  /**
   * Get base CSS styles for all documents
   */
  getBaseStyles() {
    return `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        line-height: 1.6;
        color: #333;
        background: white;
      }
      h1, h2, h3, h4, h5, h6 {
        margin-bottom: 15px;
        color: #2E86AB;
      }
      h1 { font-size: 2.5rem; }
      h2 { font-size: 2rem; }
      h3 { font-size: 1.5rem; }
      h4 { font-size: 1.25rem; }
      p { margin-bottom: 15px; }
      ul, ol { margin-bottom: 15px; padding-left: 20px; }
      li { margin-bottom: 5px; }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
      }
      th, td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid #ddd;
      }
      th {
        background-color: #f8f9fa;
        font-weight: 600;
        color: #2E86AB;
      }
      .text-center { text-align: center; }
      .text-right { text-align: right; }
      .font-bold { font-weight: bold; }
      .color-primary { color: #2E86AB; }
      .color-secondary { color: #A23B72; }
      .color-accent { color: #F18F01; }
    `;
  }

  /**
   * Get header template for PDF
   */
  getHeaderTemplate(transformationResult) {
    const hospitalName = transformationResult.executiveSummary?.hospitalName || 'Hospital';
    return `
      <div style="font-size: 10px; color: #666; width: 100%; padding: 10px 15mm 0 15mm; display: flex; justify-content: space-between; align-items: center;">
        <span>${hospitalName} - Healthcare IT Transformation</span>
        <span>Metis Transformation Engine™</span>
      </div>
    `;
  }

  /**
   * Get footer template for PDF
   */
  getFooterTemplate() {
    return `
      <div style="font-size: 10px; color: #666; width: 100%; padding: 0 15mm 10px 15mm; display: flex; justify-content: space-between; align-items: center;">
        <span>© 2025 Metis AI - Patent-Protected Technology</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>
    `;
  }

  /**
   * Format currency values
   */
  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  /**
   * Get list of generated documents for a transformation
   */
  async getGeneratedDocuments(transformationId) {
    try {
      const files = await fs.readdir(this.outputPath);
      const transformationFiles = files.filter(file => 
        file.includes(transformationId) && file.endsWith('.pdf')
      );
      
      const documents = [];
      for (const file of transformationFiles) {
        const filePath = path.join(this.outputPath, file);
        const stats = await fs.stat(filePath);
        
        documents.push({
          filename: file,
          path: filePath,
          size: stats.size,
          created: stats.birthtime,
          type: this.getDocumentType(file)
        });
      }
      
      return documents;
    } catch (error) {
      console.error('Failed to get generated documents:', error);
      return [];
    }
  }

  /**
   * Determine document type from filename
   */
  getDocumentType(filename) {
    if (filename.includes('executive-summary')) return 'Executive Summary';
    if (filename.includes('technical-specification')) return 'Technical Specification';
    if (filename.includes('implementation-roadmap')) return 'Implementation Roadmap';
    if (filename.includes('complete-report')) return 'Complete Report';
    return 'Unknown';
  }

  /**
   * Clean up old generated documents
   */
  async cleanupOldDocuments(olderThanDays = 30) {
    try {
      const files = await fs.readdir(this.outputPath);
      const cutoffDate = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));
      
      let deletedCount = 0;
      for (const file of files) {
        const filePath = path.join(this.outputPath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.birthtime < cutoffDate) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }
      
      console.log(`Cleaned up ${deletedCount} old documents`);
      return deletedCount;
    } catch (error) {
      console.error('Failed to cleanup old documents:', error);
      return 0;
    }
  }
}

module.exports = PDFGenerator;