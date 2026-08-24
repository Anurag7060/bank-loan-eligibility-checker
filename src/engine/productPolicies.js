/**
 * Zenith Private Bank - Product Policies & Benchmark Rule Matrices
 * Version 1.0 (Aligned with RBI Master Directions & Zenith Credit Policy 2026)
 * Bank CIN: L65110MH1994PLC080880 | Scheduled Commercial Bank
 */

export const DEFAULT_PRODUCT_POLICIES = {
  personal_loan: {
    id: 'personal_loan',
    name: 'Zenith SmartPersonal Loan',
    bankBrand: 'Zenith Bank',
    category: 'Unsecured Retail',
    description: 'Instant collateral-free credit for salaried & self-employed with flexible 12-60 month tenures.',
    pslEligible: false,
    color: '#003366',
    rules: {
      minAge: 21,
      maxAge: 58,
      minIncomeMonthly: 25000,
      minCibilScore: 650,
      maxFoir: 0.55,
      maxTenureMonths: 60,
      minTenureMonths: 12,
      minAmount: 50000,
      maxAmount: 4000000,
      baseInterestRate: 10.49, // Base Repo-linked rate
      processingFeePct: 1.25,
      incomeMultiplier: 24,
      allowedEmploymentTypes: ['Salaried', 'Self-Employed Professional']
    },
    pricingBands: [
      { cibilMin: 780, cibilMax: 900, rateSpread: 0.0, riskCategory: 'Zenith Super Prime (Repo + 3.99%)', indicativeRate: 10.49 },
      { cibilMin: 740, cibilMax: 779, rateSpread: 1.0, riskCategory: 'Zenith Prime (Repo + 4.99%)', indicativeRate: 11.49 },
      { cibilMin: 700, cibilMax: 739, rateSpread: 2.25, riskCategory: 'Zenith Standard (Repo + 6.24%)', indicativeRate: 12.74 },
      { cibilMin: 650, cibilMax: 699, rateSpread: 4.0, riskCategory: 'Conditional Margin', indicativeRate: 14.49 }
    ]
  },

  home_loan: {
    id: 'home_loan',
    name: 'Zenith Prime Home Loan',
    bankBrand: 'Zenith Bank',
    category: 'Secured Mortgage',
    description: 'Home purchase & construction financing with tiered RBI LTV caps (up to 90%) and 30-year tenures.',
    pslEligible: true,
    pslCategory: 'Priority Sector - Housing (Loans up to ₹35L in metros / ₹25L in non-metros)',
    color: '#006644',
    rules: {
      minAge: 21,
      maxAge: 65,
      minIncomeMonthly: 35000,
      minCibilScore: 680,
      maxFoir: 0.65,
      maxTenureMonths: 360,
      minTenureMonths: 60,
      minAmount: 500000,
      maxAmount: 100000000,
      baseInterestRate: 8.40,
      processingFeePct: 0.35,
      incomeMultiplier: 60,
      ltvSlabs: [
        { maxPropertyValue: 3000000, maxLtvPct: 90, slabName: 'Up to ₹30 Lakhs (RBI 90% LTV)' },
        { maxPropertyValue: 7500000, maxLtvPct: 80, slabName: '₹30L to ₹75 Lakhs (RBI 80% LTV)' },
        { maxPropertyValue: Infinity, maxLtvPct: 75, slabName: 'Above ₹75 Lakhs (RBI 75% LTV)' }
      ],
      allowedEmploymentTypes: ['Salaried', 'Self-Employed Professional', 'Self-Employed Business']
    },
    pricingBands: [
      { cibilMin: 780, cibilMax: 900, rateSpread: 0.0, riskCategory: 'Super Prime (Repo + 1.90%)', indicativeRate: 8.40 },
      { cibilMin: 740, cibilMax: 779, rateSpread: 0.35, riskCategory: 'Prime (Repo + 2.25%)', indicativeRate: 8.75 },
      { cibilMin: 700, cibilMax: 739, rateSpread: 0.75, riskCategory: 'Standard (Repo + 2.65%)', indicativeRate: 9.15 },
      { cibilMin: 680, cibilMax: 699, rateSpread: 1.35, riskCategory: 'Conditional Margin', indicativeRate: 9.75 }
    ]
  },

  lap: {
    id: 'lap',
    name: 'Zenith PropertyPlus (LAP)',
    bankBrand: 'Zenith Bank',
    category: 'Secured Mortgage',
    description: 'High-value liquidity against residential or commercial properties for personal or business needs.',
    pslEligible: false,
    color: '#4c1d95',
    rules: {
      minAge: 23,
      maxAge: 65,
      minIncomeMonthly: 40000,
      minCibilScore: 680,
      maxFoir: 0.60,
      maxTenureMonths: 180,
      minTenureMonths: 36,
      minAmount: 1000000,
      maxAmount: 50000000,
      baseInterestRate: 9.25,
      processingFeePct: 0.75,
      maxLtvPct: 65,
      allowedEmploymentTypes: ['Salaried', 'Self-Employed Professional', 'Self-Employed Business']
    },
    pricingBands: [
      { cibilMin: 760, cibilMax: 900, rateSpread: 0.0, riskCategory: 'Super Prime Tier', indicativeRate: 9.25 },
      { cibilMin: 720, cibilMax: 759, rateSpread: 0.60, riskCategory: 'Prime Tier', indicativeRate: 9.85 },
      { cibilMin: 680, cibilMax: 719, rateSpread: 1.25, riskCategory: 'Standard Tier', indicativeRate: 10.50 }
    ]
  },

  auto_loan: {
    id: 'auto_loan',
    name: 'Zenith DriveAuto Loan',
    bankBrand: 'Zenith Bank',
    category: 'Secured Asset',
    description: 'Up to 90% on-road funding for premium passenger vehicles and electric cars.',
    pslEligible: false,
    color: '#b45309',
    rules: {
      minAge: 21,
      maxAge: 60,
      minIncomeMonthly: 30000,
      minCibilScore: 675,
      maxFoir: 0.55,
      maxTenureMonths: 84,
      minTenureMonths: 12,
      minAmount: 150000,
      maxAmount: 15000000,
      baseInterestRate: 8.85,
      processingFeePct: 0.50,
      maxLtvNewVehiclePct: 90,
      maxLtvUsedVehiclePct: 80,
      allowedEmploymentTypes: ['Salaried', 'Self-Employed Professional', 'Self-Employed Business']
    },
    pricingBands: [
      { cibilMin: 770, cibilMax: 900, rateSpread: 0.0, riskCategory: 'Super Prime', indicativeRate: 8.85 },
      { cibilMin: 730, cibilMax: 769, rateSpread: 0.50, riskCategory: 'Prime', indicativeRate: 9.35 },
      { cibilMin: 675, cibilMax: 729, rateSpread: 1.15, riskCategory: 'Standard', indicativeRate: 10.00 }
    ]
  },

  msme_loan: {
    id: 'msme_loan',
    name: 'Zenith Vyapar MSME Loan',
    bankBrand: 'Zenith Bank',
    category: 'Commercial / PSL',
    description: 'Fast-track business term loans and working capital based on GST turnover & banking cashflows.',
    pslEligible: true,
    pslCategory: 'Priority Sector - Micro, Small & Medium Enterprises (MSME)',
    color: '#0891b2',
    rules: {
      minAge: 24,
      maxAge: 65,
      minAnnualTurnover: 2000000,
      minBusinessVintageYears: 3,
      minIncomeMonthly: 50000,
      minCibilScore: 680,
      maxFoir: 0.60,
      maxTenureMonths: 60,
      minTenureMonths: 12,
      minAmount: 300000,
      maxAmount: 7500000,
      baseInterestRate: 11.75,
      processingFeePct: 1.5,
      turnoverMultiplier: 0.20,
      allowedEmploymentTypes: ['Self-Employed Business', 'Self-Employed Professional']
    },
    pricingBands: [
      { cibilMin: 780, cibilMax: 900, rateSpread: 0.0, riskCategory: 'Zenith Platinum Enterprise', indicativeRate: 11.75 },
      { cibilMin: 720, cibilMax: 779, rateSpread: 1.25, riskCategory: 'Zenith Gold Enterprise', indicativeRate: 13.00 },
      { cibilMin: 680, cibilMax: 719, rateSpread: 2.75, riskCategory: 'Standard Risk Band', indicativeRate: 14.50 }
    ]
  },

  education_loan: {
    id: 'education_loan',
    name: 'Zenith Scholar Education Loan',
    bankBrand: 'Zenith Bank',
    category: 'Specialized Retail / PSL',
    description: 'Comprehensive higher studies funding for premier Indian (IIT/IIM) and overseas universities with moratorium.',
    pslEligible: true,
    pslCategory: 'Priority Sector - Education (Loans up to ₹20 Lakhs)',
    color: '#be185d',
    rules: {
      minAge: 18,
      maxAge: 35,
      minParentIncomeMonthly: 30000,
      minCibilScore: 660,
      maxFoir: 0.60,
      maxTenureMonths: 180,
      minTenureMonths: 36,
      minAmount: 200000,
      maxAmount: 15000000,
      baseInterestRate: 9.50,
      processingFeePct: 0.5,
      allowedEmploymentTypes: ['Student with Salaried/Self-Employed Co-Borrower']
    },
    pricingBands: [
      { cibilMin: 760, cibilMax: 900, rateSpread: 0.0, riskCategory: 'Premier Global University Tier', indicativeRate: 9.50 },
      { cibilMin: 710, cibilMax: 759, rateSpread: 0.75, riskCategory: 'Tier-1 Accredited', indicativeRate: 10.25 },
      { cibilMin: 660, cibilMax: 709, rateSpread: 1.75, riskCategory: 'Tier-2 Co-borrower weighted', indicativeRate: 11.25 }
    ]
  },

  gold_loan: {
    id: 'gold_loan',
    name: 'Zenith Swarna Gold Loan',
    bankBrand: 'Zenith Bank',
    category: 'Secured Commodity',
    description: 'Instant liquidity against 22k/24k gold ornaments with doorstep appraisal and RBI 75% LTV valuation.',
    pslEligible: true,
    pslCategory: 'Priority Sector - Agriculture / Micro-Credit (for verified allied activities)',
    color: '#ca8a04',
    rules: {
      minAge: 18,
      maxAge: 70,
      minIncomeMonthly: 15000,
      minCibilScore: 600,
      maxFoir: 0.70,
      maxTenureMonths: 24,
      minTenureMonths: 3,
      minAmount: 25000,
      maxAmount: 5000000,
      baseInterestRate: 8.95,
      processingFeePct: 0.35,
      goldPricePerGram22k: 6500,
      maxLtvPct: 75
    },
    pricingBands: [
      { cibilMin: 700, cibilMax: 900, rateSpread: 0.0, riskCategory: 'Zenith Swarna Prime Tier', indicativeRate: 8.95 },
      { cibilMin: 600, cibilMax: 699, rateSpread: 1.0, riskCategory: 'Standard Gold Tier', indicativeRate: 9.95 }
    ]
  },

  credit_card: {
    id: 'credit_card',
    name: 'Zenith Signature & Metal Credit Cards',
    bankBrand: 'Zenith Bank',
    category: 'Revolving Credit',
    description: 'Pre-approved revolving credit limits with airport lounge access, reward multipliers, and zero joining fee.',
    pslEligible: false,
    color: '#4338ca',
    rules: {
      minAge: 21,
      maxAge: 60,
      minIncomeMonthly: 25000,
      minCibilScore: 700,
      maxFoir: 0.50,
      maxTenureMonths: 1,
      minTenureMonths: 1,
      minAmount: 25000,
      maxAmount: 1500000,
      baseInterestRate: 3.49,
      processingFeePct: 0.0,
      allowedEmploymentTypes: ['Salaried', 'Self-Employed Professional', 'Self-Employed Business']
    },
    pricingBands: [
      { cibilMin: 780, cibilMax: 900, rateSpread: 0.0, riskCategory: 'Zenith Infinite Metal (Limit ₹10L+)', indicativeRate: 2.99 },
      { cibilMin: 740, cibilMax: 779, rateSpread: 0.3, riskCategory: 'Zenith Signature Card (Limit ₹3L-₹8L)', indicativeRate: 3.29 },
      { cibilMin: 700, cibilMax: 739, rateSpread: 0.5, riskCategory: 'Zenith Platinum Card (Limit ₹50k-₹2.5L)', indicativeRate: 3.49 }
    ]
  }
};
