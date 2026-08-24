/**
 * Loan Eligibility System (LES) - Reason Codes & Explainability Framework
 * Aligned with RBI Fair Practices Code & Digital Lending Guidelines
 */

export const REASON_CODES = {
  // Hard Exclusions
  ERR_NEGATIVE_LIST_MATCH: {
    code: 'ERR_NEGATIVE_LIST_MATCH',
    type: 'DECLINE',
    category: 'Fraud & Compliance',
    title: 'Regulatory or Caution List Match',
    description: 'Applicant profile matches internal negative list, RBI wilful defaulter registry, or CIBIL suit-filed records.',
    actionableRoadmap: 'Contact credit operations for manual identity reconciliation if you believe this is a false-positive match.',
    rbiDisclosureCode: 'FPC-SEC-9.1'
  },
  ERR_CIBIL_SCORE_LOW: {
    code: 'ERR_CIBIL_SCORE_LOW',
    type: 'DECLINE',
    category: 'Credit Bureau',
    title: 'Credit Score Below Policy Cutoff',
    description: 'Bureau score ({cibilScore}) is below the minimum required threshold of {minCibilScore} for {productName}.',
    actionableRoadmap: 'Maintain regular on-time EMI/credit card payments and clear overdue balances. You may re-check eligibility in 90 days as your score recovers.',
    rbiDisclosureCode: 'FPC-SEC-4.2'
  },
  ERR_AGE_CRITERIA: {
    code: 'ERR_AGE_CRITERIA',
    type: 'DECLINE',
    category: 'Demographic',
    title: 'Age Eligibility Criteria Not Met',
    description: 'Applicant age ({age} years) falls outside the permitted policy bracket of {minAge} to {maxAge} years for this product tenure.',
    actionableRoadmap: 'Consider adding a joint co-borrower meeting age criteria or applying for a product with higher age allowances like Gold Loan.',
    rbiDisclosureCode: 'FPC-SEC-3.1'
  },
  ERR_MIN_INCOME: {
    code: 'ERR_MIN_INCOME',
    type: 'DECLINE',
    category: 'Financial Capacity',
    title: 'Monthly Income Below Minimum Floor',
    description: 'Net monthly income (₹{income}) is below the minimum required floor of ₹{minIncome} for {productName}.',
    actionableRoadmap: 'Club income with a working spouse/parent as co-applicant to meet the cumulative household income threshold.',
    rbiDisclosureCode: 'FPC-SEC-5.1'
  },
  ERR_VINTAGE_SHORT: {
    code: 'ERR_VINTAGE_SHORT',
    type: 'DECLINE',
    category: 'Stability',
    title: 'Business / Employment Vintage Insufficient',
    description: 'Operational business vintage ({vintage} years) is below the minimum required 3-year threshold.',
    actionableRoadmap: 'Provide alternate proof of continuous operational vintage (GST registration, municipal trade license) or reapply upon completing 3 years.',
    rbiDisclosureCode: 'FPC-SEC-6.3'
  },
  ERR_FOIR_BREACH: {
    code: 'ERR_FOIR_BREACH',
    type: 'DECLINE',
    category: 'Debt Burden',
    title: 'Excessive Fixed Obligation to Income Ratio (FOIR)',
    description: 'Current debt obligations consume {foirPct}% of net income, exceeding the risk ceiling of {maxFoirPct}%.',
    actionableRoadmap: 'Foreclose or prepay existing small personal loans/credit card EMIs by at least ₹{remedyEmiReduction}/month, or opt for a longer loan tenure.',
    rbiDisclosureCode: 'FPC-SEC-5.4'
  },
  ERR_LTV_EXCEEDED: {
    code: 'ERR_LTV_EXCEEDED',
    type: 'DECLINE',
    category: 'Collateral Cover',
    title: 'Loan-to-Value (LTV) Cap Exceeded',
    description: 'Requested loan amount exceeds the maximum allowable regulatory/policy LTV ceiling of {maxLtvPct}% for this collateral value.',
    actionableRoadmap: 'Increase own-contribution down payment by ₹{remedyDownPayment} or provide additional property/asset valuation.',
    rbiDisclosureCode: 'RBI-LTV-2024-CAP'
  },

  // Conditional Approvals & Mitigants
  WARN_CONDITIONAL_OFFER: {
    code: 'WARN_CONDITIONAL_OFFER',
    type: 'CONDITIONAL',
    category: 'Offer Modification',
    title: 'Eligible with Modified Terms',
    description: 'Applicant does not qualify for the full requested amount of ₹{requestedAmount}, but qualifies for ₹{eligibleAmount}.',
    actionableRoadmap: 'Accept the revised amount, add a co-applicant to bridge the gap, or extend the loan tenure.',
    rbiDisclosureCode: 'FPC-SEC-7.1'
  },
  WARN_COAPPLICANT_RECOMMENDED: {
    code: 'WARN_COAPPLICANT_RECOMMENDED',
    type: 'CONDITIONAL',
    category: 'Income Enhancement',
    title: 'Co-Applicant Addition Recommended',
    description: 'Adding a salaried or business co-applicant will increase your maximum eligible loan amount up to ₹{enhancedAmount}.',
    actionableRoadmap: 'Add spouse, parent, or business partner as co-borrower in step 2 to enhance borrowing limits.',
    rbiDisclosureCode: 'FPC-SEC-7.2'
  },
  WARN_TENURE_EXTENSION: {
    code: 'WARN_TENURE_EXTENSION',
    type: 'CONDITIONAL',
    category: 'Tenure Optimization',
    title: 'Extend Tenure to Reduce EMI Burden',
    description: 'Extending tenure from {requestedTenure} to {suggestedTenure} months brings FOIR within policy thresholds.',
    actionableRoadmap: 'Select a {suggestedTenure}-month tenure to lower your monthly installment to ₹{suggestedEmi}.',
    rbiDisclosureCode: 'FPC-SEC-7.3'
  },

  // Positive Approvals
  SUCC_PRE_APPROVED: {
    code: 'SUCC_PRE_APPROVED',
    type: 'APPROVE',
    category: 'Pre-Approved',
    title: 'Pre-Approved Under Standard Policy',
    description: 'Applicant successfully passes all FOIR, bureau score, LTV, and risk-based pricing matrices.',
    actionableRoadmap: 'Proceed to complete online KYC verification and upload documents for instant digital sanction.',
    rbiDisclosureCode: 'FPC-SEC-1.1'
  },
  SUCC_SUPER_PRIME_RATE: {
    code: 'SUCC_SUPER_PRIME_RATE',
    type: 'APPROVE',
    category: 'Risk-Based Pricing',
    title: 'Super Prime Risk Tier Qualification',
    description: 'Superior credit score ({cibilScore}) qualifies applicant for our lowest benchmark repo-linked interest rate.',
    actionableRoadmap: 'Lock in this promotional indicative rate within the 30-day offer validity window.',
    rbiDisclosureCode: 'EBLR-PRICING-TIER1'
  }
};

/**
 * Generate an RBI-compliant Adverse Action Notice artifact/payload
 */
export function generateAdverseActionNotice(applicant, product, decisionTrail) {
  const dateStr = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return {
    noticeId: `AAN-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
    generatedAt: dateStr,
    timestamp: new Date().toISOString(),
    regulationReference: 'RBI Fair Practices Code for Lenders (DNBR/DoR Guidelines 2026)',
    applicant: {
      name: applicant.fullName || 'Valued Applicant',
      maskedPan: applicant.pan ? `${applicant.pan.slice(0, 2)}XXXXX${applicant.pan.slice(-2)}` : 'XXXXXXXXXX',
      maskedMobile: applicant.mobile ? `+91 ${applicant.mobile.slice(0, 2)}******${applicant.mobile.slice(-2)}` : '+91 XXXXXXXXXX'
    },
    loanProduct: product.name,
    requestedTerms: {
      amount: applicant.requestedAmount || 0,
      tenureMonths: applicant.requestedTenureMonths || 0
    },
    decision: decisionTrail.status,
    primaryReasonCodes: decisionTrail.reasons.map(r => ({
      code: r.code,
      title: r.title,
      description: r.description,
      rbiCode: r.rbiDisclosureCode || 'FPC-SEC-9.9'
    })),
    bureauInformation: {
      agencyName: decisionTrail.bureauUsed || 'TransUnion CIBIL',
      inquiryType: 'Soft Inquiry / Pre-Qualification (Zero Credit Score Impact)',
      creditScoreObserved: decisionTrail.cibilScore || 'N/A',
      disputeRights: 'Under the Credit Information Companies (Regulation) Act, 2005, you have the right to inspect and dispute any inaccurate information in your credit report directly with the credit bureau.'
    },
    actionableRemedies: decisionTrail.reasons.map(r => r.actionableRoadmap).filter(Boolean),
    validityDays: 30,
    disclaimer: 'This communication provides an indicative pre-qualification assessment and does not constitute a formal rejection or binding legal sanction. Final loan approval remains subject to document verification and underwriting approval in the Loan Origination System.'
  };
}
