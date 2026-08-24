/**
 * Loan Eligibility System (LES) - Account Aggregator (AA) & Alternate Data Engine
 * Aligned with RBI Account Aggregator (AA) Framework & DPDP Act 2023
 */

export function parseAccountAggregatorData(applicant, consentedBank = 'HDFC Bank') {
  const monthlyIncome = Number(applicant.monthlyIncome) || 45000;
  const existingEmis = Number(applicant.existingEmis) || 0;
  const isMsme = applicant.employmentType === 'Self-Employed Business' || applicant.loanProduct === 'msme_loan';

  // Bank Statement Simulation
  const simulatedSalaryCredits = [
    { month: 'Month -1', amount: monthlyIncome * 0.98, date: '01-Jul-2026', narration: 'ACH/SALARY/EMPLOYER CORP' },
    { month: 'Month -2', amount: monthlyIncome * 1.00, date: '01-Jun-2026', narration: 'ACH/SALARY/EMPLOYER CORP' },
    { month: 'Month -3', amount: monthlyIncome * 1.02, date: '01-May-2026', narration: 'ACH/SALARY/EMPLOYER CORP' }
  ];

  const averageBankBalance = Math.round(monthlyIncome * 0.35 + (existingEmis * 0.5));
  const detectedEmiDebits = existingEmis;
  const inwardChequeBounces = applicant.cibilScore && applicant.cibilScore < 660 ? 1 : 0;

  // Alternate Data: UPI & Utility Payment Score
  const upiTransactionHealthScore = Math.min(95, Math.max(60, Math.round(75 + (monthlyIncome / 10000))));
  const utilityBillPunctualityPct = 98.5;

  // GST & Business Surrogate (if MSME)
  let gstAnalytics = null;
  if (isMsme) {
    const annualGstTurnover = Number(applicant.annualTurnover) || (monthlyIncome * 12 * 4.5);
    gstAnalytics = {
      gstin: applicant.gstin || '27AABCS1429B1Z8',
      filingFrequency: 'Monthly (GSTR-3B & GSTR-1 Consistent)',
      annualTurnoverDeclared: annualGstTurnover,
      verifiedTurnover: Math.round(annualGstTurnover * 0.96),
      yoyGrowthPct: 14.8,
      interstateVsIntrastateSplit: '35% / 65%',
      topBuyerConcentrationPct: 22.4 // Low customer concentration risk
    };
  }

  return {
    success: true,
    provider: 'RBI-Licensed Account Aggregator (Anumati / Sahamati AA Ecosystem)',
    consentId: `AA-CONSENT-${Date.now().toString(36).toUpperCase()}`,
    consentStatus: 'ACTIVE_CONSENTED',
    timestamp: new Date().toISOString(),
    bankingSummary: {
      primaryBank: consentedBank,
      averageBankBalanceMonthly: averageBankBalance,
      detectedMonthlySalaryCredits: monthlyIncome,
      detectedExistingEmiOutflows: detectedEmiDebits,
      inwardChequeBouncesLast6M: inwardChequeBounces,
      netSurplusMonthly: Math.max(0, monthlyIncome - detectedEmiDebits),
      salaryStabilityScore: 'High (Verified Regular 1st of Month Credit)'
    },
    alternateDataSummary: {
      upiTransactionHealthScore,
      utilityBillPunctualityPct,
      spendingBehaviorRisk: 'Low'
    },
    gstAnalytics
  };
}

/**
 * Consent Audit Vault - DPDP Act 2023 Compliance
 */
export class ConsentVault {
  static getConsentLogs() {
    try {
      const logs = localStorage.getItem('les_consent_logs');
      return logs ? JSON.parse(logs) : [];
    } catch {
      return [];
    }
  }

  static recordConsent({ applicantName, pan, mobile, purposes, ipAddress = '127.0.0.1' }) {
    const consentRecord = {
      consentId: `DPDP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      applicantName,
      maskedPan: pan ? `${pan.slice(0, 2)}XXXXX${pan.slice(-2)}` : 'XXXXXXXXXX',
      maskedMobile: mobile ? `+91 ${mobile.slice(0, 2)}******${mobile.slice(-2)}` : '+91 XXXXXXXXXX',
      purposes: purposes || [
        'Soft Credit Bureau Inquiry (CIC Act Compliant - Zero Score Impact)',
        'Identity & PAN Verification (Income Tax Dept / NSDL)',
        'Account Aggregator Bank Statement Retrieval (RBI AA Framework)'
      ],
      legalBasis: 'DPDP Act 2023 Section 6 - Purpose Limited Consented Processing',
      ipAddress,
      revocable: true,
      expiryDays: 30
    };

    const existing = this.getConsentLogs();
    existing.unshift(consentRecord);
    // Keep last 100 entries in local storage
    localStorage.setItem('les_consent_logs', JSON.stringify(existing.slice(0, 100)));
    return consentRecord;
  }
}
