/**
 * Loan Eligibility System (LES) - Soft-Pull Bureau Integration & Screener
 * Zero-Impact Credit Bureau Waterfall (CIBIL, Experian, Equifax, CRIF High Mark)
 * Compliant with CIC (Credit Information Companies) Soft-Inquiry Standards
 */

// Simulated Regulatory and Internal Negative Lists
export const NEGATIVE_LIST_DATABASE = {
  panBlacklist: [
    'ABCDE1234F', // Mock Wilful Defaulter
    'ZXCVB9876Q', // Mock Suit-Filed Account
    'LKJHG5432P'  // Mock Internal Fraud Ring
  ],
  nameSoundexBlacklist: [
    'SCAMSTER CORP',
    'DEFAULT ENTERPRISES'
  ]
};

/**
 * Deterministic mock CIBIL score calculation based on PAN / Profile features
 */
export function simulateBureauPull(applicant, bureauProvider = 'CIBIL') {
  const pan = (applicant.pan || '').toUpperCase().trim();
  
  // 1. Negative List & Wilful Defaulter Screener
  const isWilfulDefaulter = NEGATIVE_LIST_DATABASE.panBlacklist.includes(pan);
  
  // 2. Deterministic bureau score simulation based on applicant attributes
  let baseScore = 750;
  
  if (applicant.cibilScoreOverride) {
    baseScore = applicant.cibilScoreOverride;
  } else if (pan) {
    // Generate deterministic hash from PAN
    let hash = 0;
    for (let i = 0; i < pan.length; i++) {
      hash = (hash << 5) - hash + pan.charCodeAt(i);
      hash |= 0;
    }
    const scoreMod = Math.abs(hash) % 250; // 0 to 249
    baseScore = 630 + scoreMod; // Range 630 to 879
  }

  // Adjust score slightly by income stability & existing EMI load
  const income = Number(applicant.monthlyIncome) || 30000;
  const existingEmi = Number(applicant.existingEmis) || 0;
  const currentDti = existingEmi / Math.max(income, 1);
  
  if (currentDti > 0.6) baseScore -= 45;
  else if (currentDti < 0.2) baseScore += 25;

  if (applicant.employmentType === 'Salaried' && applicant.employerCategory === 'Super Cat A / MNC') {
    baseScore += 15;
  }

  // Clamp within realistic CIBIL range [300, 900]
  const finalScore = Math.min(890, Math.max(300, Math.round(baseScore)));

  // Determine risk band
  let riskBand = 'Subprime';
  if (finalScore >= 780) riskBand = 'Super Prime';
  else if (finalScore >= 740) riskBand = 'Prime';
  else if (finalScore >= 680) riskBand = 'Near Prime';

  // Bureau trade lines and active credit facilities
  const activeTradeLines = Math.floor((finalScore - 550) / 40) + 1;
  const creditCardUtilization = finalScore > 750 ? 22 : finalScore > 680 ? 48 : 78;
  const overdue30DaysCount = finalScore < 660 ? 2 : finalScore < 700 ? 1 : 0;
  const softInquiriesLast90Days = 1; // Does not ding score

  return {
    success: true,
    bureauProvider,
    inquiryType: 'SOFT_INQUIRY_PREQUAL',
    inquiryTimestamp: new Date().toISOString(),
    creditScore: finalScore,
    riskBand,
    isWilfulDefaulter,
    summary: {
      score: finalScore,
      scoreScale: '300-900',
      activeAccounts: Math.max(1, activeTradeLines),
      totalOutstandingBalance: existingEmi * 28, // Estimated total debt
      creditCardUtilizationPct: creditCardUtilization,
      dpdOverdueCount: overdue30DaysCount,
      writtenOffCount: isWilfulDefaulter ? 1 : 0,
      recentEnquiriesCount: softInquiriesLast90Days,
      scoreFactorPositive: finalScore >= 720 ? '100% on-time payment track record across 24 months' : 'Consistent credit vintage',
      scoreFactorNegative: overdue30DaysCount > 0 ? 'Instances of 30+ DPD delays in past 12 months' : 'Credit utilization ratio'
    },
    regulatoryNotice: 'This report was generated under CIC Soft-Pull guidelines. It has 0.00 impact on the applicant credit score.'
  };
}
