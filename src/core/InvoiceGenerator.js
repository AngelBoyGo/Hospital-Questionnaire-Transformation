
const { v4: uuidv4 } = require('uuid');

class InvoiceGenerator {
  constructor(transformationEngine, formulasEngine) {
    this.transformationEngine = transformationEngine;
    this.formulasEngine = formulasEngine;
  }

  /**
   * Generates an invoice based on transformation results and hospital profile.
   * @param {object} srsResult - The AI-generated SRS result.
   * @param {object} transformationResult - The initial transformation result (includes totalCost, timeline).
   * @param {object} hospitalProfile - The hospital's profile (e.g., bedCount, name, address).
   * @returns {object} The generated invoice details.
   */
  async generateInvoice(srsResult, transformationResult, hospitalProfile) {
    const invoiceId = `INV-${uuidv4()}`;
    const issueDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(issueDate.getDate() + 30); // 30 days due

    // Retrieve formulas (if not already part of transformationResult)
    const formulas = await this.formulasEngine.calculateFormulas(hospitalProfile, transformationResult);

    // 1. Implementation Fee (One-time)
    const implementationFeeAmount = (transformationResult.totalCost * 0.12) + (formulas.sidi * 5000);

    // 2. Monthly Platform Subscription
    const monthlySubscriptionAmount = (hospitalProfile.bedCount * 30) + (formulas.raf.estimatedCost / 12 * 0.05);

    // 3. Performance-Based ROI Fee (Tiered)
    const annualROIBenefitUSD = (transformationResult.totalCost * 0.20) + (formulas.hcs * 25000);
    const minimumThresholdBenefit = 150000; // USD/year
    let performanceFeeAmount = 0;

    if (annualROIBenefitUSD > minimumThresholdBenefit) {
      const netBenefitAboveThreshold = annualROIBenefitUSD - minimumThresholdBenefit;
      const tier1Percentage = 0.02; // 2% for benefits $150k - $500k
      const tier2Percentage = 0.05; // 5% for benefits $500k - $1M
      const tier3Percentage = 0.10; // 10% for benefits > $1M

      if (netBenefitAboveThreshold <= 350000) { // Total benefit up to $500k ($150k + $350k)
        performanceFeeAmount = netBenefitAboveThreshold * tier1Percentage;
      } else if (netBenefitAboveThreshold <= 850000) { // Total benefit up to $1M ($150k + $850k)
        performanceFeeAmount = (350000 * tier1Percentage) + ((netBenefitAboveThreshold - 350000) * tier2Percentage);
      } else { // Total benefit over $1M
        performanceFeeAmount = (350000 * tier1Percentage) + (500000 * tier2Percentage) + ((netBenefitAboveThreshold - 850000) * tier3Percentage);
      }
    }

    const totalAmount = implementationFeeAmount + monthlySubscriptionAmount + performanceFeeAmount;

    const invoiceItems = [
      {
        description: `METIS AI SRS Generation & Initial Implementation Plan (based on SRS ID: ${srsResult.jobId})`,
        quantity: 1,
        unitPrice: implementationFeeAmount,
        total: implementationFeeAmount,
        type: 'one-time'
      },
      {
        description: 'METIS Platform Monthly Subscription Fee',
        quantity: 1,
        unitPrice: monthlySubscriptionAmount,
        total: monthlySubscriptionAmount,
        type: 'recurring'
      }
    ];

    if (performanceFeeAmount > 0) {
      invoiceItems.push({
        description: `METIS Performance-Based ROI Fee (Annual Benefit: $${annualROIBenefitUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`,
        quantity: 1,
        unitPrice: performanceFeeAmount,
        total: performanceFeeAmount,
        type: 'performance-based'
      });
    }

    return {
      invoiceId,
      hospitalId: hospitalProfile.id,
      hospitalName: hospitalProfile.name,
      hospitalAddress: hospitalProfile.address || 'N/A',
      issueDate: issueDate.toISOString().split('T')[0],
      dueDate: dueDate.toISOString().split('T')[0],
      invoiceItems,
      subtotal: totalAmount,
      totalDue: totalAmount, // Assuming no taxes for simplicity initially
      currency: 'USD',
      paymentTerms: 'Net 30 days',
      metisNotices: '© 2025 METIS Healthcare Transformation Engine™. Patent-protected technology. All rights reserved.',
      srsJobId: srsResult.jobId,
      srsFeasibilityScore: srsResult.feasibilityScore,
      calculatedFormulas: { hcs: formulas.hcs, sidi: formulas.sidi, raf: formulas.raf }
    };
  }
}

module.exports = { InvoiceGenerator };

