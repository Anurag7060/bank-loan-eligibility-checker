/**
 * Loan Eligibility System (LES) - Core Eligibility Engine
 * Multi-Product Evaluation, Triple-Method Sizing, Tiered LTV & Risk-Based Pricing
 */

import { DEFAULT_PRODUCT_POLICIES } from './productPolicies.js';
import { REASON_CODES } from './reasonCodes.js';
import { simulateBureauPull } from './bureauSimulator.js';
import { parseAccountAggregatorData } from './accountAggregator.js';

/**
 * Standard reducing balance monthly EMI calculator
 * P = Principal, r = monthly interest rate (annual / 12 / 100), n = tenure in months
 */
export function calculateEmi(principal, annualRatePct, tenureMonths) {
  if (!principal || principal <= 0 || !tenureMonths || tenureMonths <= 0) return 0;
  const monthlyRate = (annualRatePct / 12) / 100;
  if (monthlyRate === 0) return Math.round(principal / tenureMonths);
  const factor = Math.pow(1 + monthlyRate, tenureMonths);
  const emi = principal * monthlyRate * (factor / (factor - 1));
  return Math.round(emi);
}

/**
 * Invert EMI formula to compute maximum loan principal supported by a given monthly installment capacity
 */
export function calculateMaxPrincipalFromEmi(maxEmiCapacity, annualRatePct, tenureMonths) {
  if (!maxEmiCapacity || maxEmiCapacity <= 0 || !tenureMonths || tenureMonths <= 0) return 0;
  const monthlyRate = (annualRatePct / 12) / 100;
  if (monthlyRate === 0) return Math.round(maxEmiCapacity * tenureMonths);
  const factor = Math.pow(1 + monthlyRate, tenureMonths);
  const maxPrincipal = maxEmiCapacity * ((factor - 1) / (monthlyRate * factor));
  return Math.round(maxPrincipal);
}

/**
 * Tiered RBI LTV Calculator for Secured Products (Home Loan, LAP, Auto, Gold)
 */
export function calculateMaxLtv(productPolicy, collateralValue, propertyType = 'Residential') {
  if (!collateralValue || collateralValue <= 0) return { maxLtvPct: 0, maxCollateralLoanAmount: 0, slabName: 'No Collateral' };

  // Home Loan RBI Tiered LTV Slabs
  if (productPolicy.id === 'home_loan' && productPolicy.rules.ltvSlabs) {
    for (const slab of productPolicy.rules.ltvSlabs) {
      if (collateralValue <= slab.maxPropertyValue) {
        return {
          maxLtvPct: slab.maxLtvPct,
          maxCollateralLoanAmount: Math.round(collateralValue * (slab.maxLtvPct / 100)),
          slabName: slab.slabName
        };
      }
    }
  }

  // LAP
  if (productPolicy.id === 'lap') {
    const ltv = propertyType === 'Commercial' ? 55 : (productPolicy.rules.maxLtvPct || 65);
    return {
      maxLtvPct: ltv,
      maxCollateralLoanAmount: Math.round(collateralValue * (ltv / 100)),
      slabName: `LAP Collateral (${ltv}% LTV)`
    };
  }

  // Auto Loan
  if (productPolicy.id === 'auto_loan') {
    const ltv = propertyType === 'Used Vehicle' 
      ? (productPolicy.rules.maxLtvUsedVehiclePct || 80) 
      : (productPolicy.rules.maxLtvNewVehiclePct || 90);
    return {
      maxLtvPct: ltv,
      maxCollateralLoanAmount: Math.round(collateralValue * (ltv / 100)),
      slabName: `Auto On-Road Valuation (${ltv}% LTV)`
    };
  }

  // Gold Loan (RBI 75% Statutory Ceiling)
  if (productPolicy.id === 'gold_loan') {
    const ltv = productPolicy.rules.maxLtvPct || 75;
    return {
      maxLtvPct: ltv,
      maxCollateralLoanAmount: Math.round(collateralValue * (ltv / 100)),
      slabName: `RBI Gold Loan Ceiling (${ltv}% LTV)`
    };
  }

  return {
    maxLtvPct: 80,
    maxCollateralLoanAmount: Math.round(collateralValue * 0.80),
    slabName: 'Standard 80% LTV'
  };
}

/**
 * Match Bureau Score against Product Pricing Bands to determine Indicative Rate & Risk Category
 */
export function determinePricing(productPolicy, cibilScore) {
  const bands = productPolicy.pricingBands || [];
  for (const band of bands) {
    if (cibilScore >= band.cibilMin && cibilScore <= band.cibilMax) {
      return {
        indicativeRate: band.indicativeRate,
        rateSpread: band.rateSpread,
        riskCategory: band.riskCategory
      };
    }
  }

  // Fallback if below lowest band or no match
  const lowestBand = bands[bands.length - 1];
  return {
    indicativeRate: lowestBand ? lowestBand.indicativeRate + 1.5 : productPolicy.rules.baseInterestRate + 3.0,
    rateSpread: lowestBand ? lowestBand.rateSpread + 1.5 : 3.0,
    riskCategory: 'High Risk / Non-Standard'
  };
}

/**
 * Main Eligibility Assessment Engine
 */
export function evaluateEligibility(applicantInput, activePolicies = DEFAULT_PRODUCT_POLICIES) {
  const productId = applicantInput.loanProduct || 'personal_loan';
  const policy = activePolicies[productId] || DEFAULT_PRODUCT_POLICIES.personal_loan;
  const rules = policy.rules;

  // 1. Data Normalization
  const age = Number(applicantInput.age) || 30;
  const monthlyIncome = Number(applicantInput.monthlyIncome) || 0;
  const coApplicantIncome = Number(applicantInput.coApplicantIncome) || 0;
  const totalMonthlyIncome = monthlyIncome + coApplicantIncome;
  const existingEmis = Number(applicantInput.existingEmis) || 0;
  const requestedAmount = Number(applicantInput.requestedAmount) || (rules.minAmount * 2);
  const requestedTenureMonths = Number(applicantInput.requestedTenureMonths) || (rules.maxTenureMonths >= 60 ? 60 : rules.maxTenureMonths);
  const collateralValue = Number(applicantInput.collateralValue) || 0;
  const businessVintageYears = Number(applicantInput.businessVintageYears) || (applicantInput.employmentType === 'Salaried' ? 5 : 2);
  const annualTurnover = Number(applicantInput.annualTurnover) || (totalMonthlyIncome * 12 * 4);

  // 2. Soft Bureau & AA Pulls (Zero Impact)
  const bureauReport = applicantInput.bureauReport || simulateBureauPull(applicantInput);
  const aaData = applicantInput.aaData || parseAccountAggregatorData(applicantInput);
  const cibilScore = bureauReport.creditScore;

  // 3. Pricing Determination
  const pricing = determinePricing(policy, cibilScore);
  const indicativeRate = pricing.indicativeRate;

  // 4. Proposed Loan EMI at requested terms
  const proposedEmi = calculateEmi(requestedAmount, indicativeRate, requestedTenureMonths);
  const totalObligations = existingEmis + proposedEmi;
  const calculatedFoir = totalMonthlyIncome > 0 ? (totalObligations / totalMonthlyIncome) : 1.0;
  const existingFoir = totalMonthlyIncome > 0 ? (existingEmis / totalMonthlyIncome) : 0;

  // 5. Triple-Method Maximum Eligible Loan Sizing
  // Method A: Max capacity based on maximum allowable FOIR
  const maxAllowableEmiTotal = totalMonthlyIncome * rules.maxFoir;
  const maxAllowableProposedEmi = Math.max(0, maxAllowableEmiTotal - existingEmis);
  const foirSizedPrincipal = calculateMaxPrincipalFromEmi(maxAllowableProposedEmi, indicativeRate, requestedTenureMonths);

  // Method B: Income multiplier cap
  const multiplierFactor = rules.incomeMultiplier || 24;
  const multiplierSizedPrincipal = totalMonthlyIncome * multiplierFactor;

  // Method C: Collateral LTV Cap (for secured products)
  let ltvDetails = { maxLtvPct: 100, maxCollateralLoanAmount: Infinity, slabName: 'Unsecured' };
  let ltvSizedPrincipal = Infinity;
  let calculatedLtvPct = 0;

  const isSecured = ['home_loan', 'lap', 'auto_loan', 'gold_loan'].includes(productId);
  if (isSecured) {
    ltvDetails = calculateMaxLtv(policy, collateralValue, applicantInput.propertyType);
    ltvSizedPrincipal = ltvDetails.maxCollateralLoanAmount;
    calculatedLtvPct = collateralValue > 0 ? Math.round((requestedAmount / collateralValue) * 100) : 100;
  }

  // Method D: MSME Turnover Sizing
  let turnoverSizedPrincipal = Infinity;
  if (productId === 'msme_loan') {
    turnoverSizedPrincipal = Math.round(annualTurnover * (rules.turnoverMultiplier || 0.20));
  }

  // Comprehensive Max Eligible Calculation
  const sizingLimits = [foirSizedPrincipal, rules.maxAmount];
  if (multiplierSizedPrincipal > 0) sizingLimits.push(multiplierSizedPrincipal);
  if (isSecured && ltvSizedPrincipal > 0) sizingLimits.push(ltvSizedPrincipal);
  if (productId === 'msme_loan' && turnoverSizedPrincipal > 0) sizingLimits.push(turnoverSizedPrincipal);

  const maxEligibleAmount = Math.max(0, Math.min(...sizingLimits));
  const eligibleTenureMonths = Math.min(requestedTenureMonths, rules.maxTenureMonths);
  const eligibleEmi = calculateEmi(Math.min(requestedAmount, maxEligibleAmount), indicativeRate, eligibleTenureMonths);
  const eligibleFoir = totalMonthlyIncome > 0 ? ((existingEmis + eligibleEmi) / totalMonthlyIncome) : 0;

  // 6. Rules Evaluation & Reason Code Attribution
  const reasons = [];
  const flags = [];
  let isDecline = false;
  let isConditional = false;

  // Rule Check: Wilful Defaulter / Negative List Match
  if (bureauReport.isWilfulDefaulter) {
    reasons.push(REASON_CODES.ERR_NEGATIVE_LIST_MATCH);
    isDecline = true;
  }

  // Rule Check: Minimum CIBIL Score
  if (cibilScore < rules.minCibilScore) {
    const reason = {
      ...REASON_CODES.ERR_CIBIL_SCORE_LOW,
      description: REASON_CODES.ERR_CIBIL_SCORE_LOW.description
        .replace('{cibilScore}', cibilScore)
        .replace('{minCibilScore}', rules.minCibilScore)
        .replace('{productName}', policy.name)
    };
    reasons.push(reason);
    isDecline = true;
  }

  // Rule Check: Minimum Net Income
  if (totalMonthlyIncome < rules.minIncomeMonthly) {
    const reason = {
      ...REASON_CODES.ERR_MIN_INCOME,
      description: REASON_CODES.ERR_MIN_INCOME.description
        .replace('{income}', totalMonthlyIncome.toLocaleString('en-IN'))
        .replace('{minIncome}', rules.minIncomeMonthly.toLocaleString('en-IN'))
        .replace('{productName}', policy.name)
    };
    reasons.push(reason);
    isDecline = true;
  }

  // Rule Check: Age Bounds
  if (age < rules.minAge || age > rules.maxAge) {
    const reason = {
      ...REASON_CODES.ERR_AGE_CRITERIA,
      description: REASON_CODES.ERR_AGE_CRITERIA.description
        .replace('{age}', age)
        .replace('{minAge}', rules.minAge)
        .replace('{maxAge}', rules.maxAge)
    };
    reasons.push(reason);
    isDecline = true;
  }

  // Rule Check: Business Vintage (for MSME)
  if (productId === 'msme_loan' && businessVintageYears < rules.minBusinessVintageYears) {
    const reason = {
      ...REASON_CODES.ERR_VINTAGE_SHORT,
      description: REASON_CODES.ERR_VINTAGE_SHORT.description
        .replace('{vintage}', businessVintageYears)
    };
    reasons.push(reason);
    isDecline = true;
  }

  // Rule Check: Existing FOIR Exhaustion (Existing obligations alone exceed FOIR cap)
  if (existingFoir >= rules.maxFoir) {
    const excessEmi = Math.round(existingEmis - (totalMonthlyIncome * rules.maxFoir));
    const reason = {
      ...REASON_CODES.ERR_FOIR_BREACH,
      description: `Existing debt commitments consume ${(existingFoir * 100).toFixed(1)}% of income, leaving zero room for additional credit under the ${(rules.maxFoir * 100).toFixed(0)}% FOIR cap.`,
      actionableRoadmap: `Pay off existing loans to reduce monthly EMI commitments by at least ₹${Math.max(1000, excessEmi).toLocaleString('en-IN')}/month.`
    };
    reasons.push(reason);
    isDecline = true;
  }

  // Rule Check: LTV Cap (for secured products)
  if (isSecured && collateralValue > 0 && calculatedLtvPct > ltvDetails.maxLtvPct) {
    const excessLoan = requestedAmount - ltvDetails.maxCollateralLoanAmount;
    if (excessLoan > 0) {
      const reason = {
        ...REASON_CODES.ERR_LTV_EXCEEDED,
        description: REASON_CODES.ERR_LTV_EXCEEDED.description
          .replace('{maxLtvPct}', ltvDetails.maxLtvPct),
        actionableRoadmap: `Increase your down payment contribution by ₹${excessLoan.toLocaleString('en-IN')} to satisfy the ${ltvDetails.maxLtvPct}% regulatory LTV limit.`
      };
      if (maxEligibleAmount < rules.minAmount) isDecline = true;
      else isConditional = true;
      reasons.push(reason);
    }
  }

  // Check for Conditional / Sizing Adjustments
  if (!isDecline) {
    if (maxEligibleAmount < requestedAmount) {
      isConditional = true;
      const reason = {
        ...REASON_CODES.WARN_CONDITIONAL_OFFER,
        description: REASON_CODES.WARN_CONDITIONAL_OFFER.description
          .replace('{requestedAmount}', requestedAmount.toLocaleString('en-IN'))
          .replace('{eligibleAmount}', maxEligibleAmount.toLocaleString('en-IN'))
      };
      reasons.push(reason);

      // Sizing remedy recommendations
      if (coApplicantIncome === 0) {
        const potentialEnhanced = Math.round(maxEligibleAmount * 1.5);
        reasons.push({
          ...REASON_CODES.WARN_COAPPLICANT_RECOMMENDED,
          description: REASON_CODES.WARN_COAPPLICANT_RECOMMENDED.description
            .replace('{enhancedAmount}', potentialEnhanced.toLocaleString('en-IN'))
        });
      }

      if (requestedTenureMonths < rules.maxTenureMonths) {
        const longerTenure = rules.maxTenureMonths;
        const potentialEmi = calculateEmi(requestedAmount, indicativeRate, longerTenure);
        reasons.push({
          ...REASON_CODES.WARN_TENURE_EXTENSION,
          description: REASON_CODES.WARN_TENURE_EXTENSION.description
            .replace('{requestedTenure}', requestedTenureMonths)
            .replace('{suggestedTenure}', longerTenure),
          actionableRoadmap: `Extending tenure to ${longerTenure} months lowers monthly EMI to ₹${potentialEmi.toLocaleString('en-IN')}, improving eligibility.`
        });
      }
    } else {
      reasons.push(REASON_CODES.SUCC_PRE_APPROVED);
      if (cibilScore >= 780) {
        reasons.push({
          ...REASON_CODES.SUCC_SUPER_PRIME_RATE,
          description: REASON_CODES.SUCC_SUPER_PRIME_RATE.description.replace('{cibilScore}', cibilScore)
        });
      }
    }
  }

  // 7. Final Decision State
  const decisionStatus = isDecline ? 'DECLINED' : (isConditional ? 'CONDITIONAL' : 'PRE_APPROVED');

  // 8. Key Fact Statement (KFS) Metrics
  const approvedPrincipal = decisionStatus === 'DECLINED' ? 0 : Math.min(requestedAmount, maxEligibleAmount);
  const approvedTenure = decisionStatus === 'DECLINED' ? 0 : eligibleTenureMonths;
  const approvedEmi = decisionStatus === 'DECLINED' ? 0 : eligibleEmi;
  const totalRepayment = approvedEmi * approvedTenure;
  const totalInterest = Math.max(0, totalRepayment - approvedPrincipal);
  const processingFee = Math.round(approvedPrincipal * ((rules.processingFeePct || 1.0) / 100));
  const netDisbursement = Math.max(0, approvedPrincipal - processingFee);
  const indicativeApr = indicativeRate + (approvedPrincipal > 0 ? Number(((processingFee / approvedPrincipal) * (12 / (approvedTenure || 12)) * 100).toFixed(2)) : 0);

  // 9. Factor Radar / Attribution Scoring (0 to 100 per factor)
  const factorScores = {
    incomeCapacity: Math.min(100, Math.round((totalMonthlyIncome / 150000) * 100)),
    leverageHealth: Math.max(0, Math.min(100, Math.round((1 - calculatedFoir) * 100))),
    bureauHealth: Math.round(((cibilScore - 300) / 600) * 100),
    collateralCover: isSecured ? (collateralValue > 0 ? Math.min(100, Math.round((collateralValue / requestedAmount) * 80)) : 0) : 100,
    vintageStability: Math.min(100, Math.round((businessVintageYears / 5) * 100))
  };

  return {
    assessmentId: `LES-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
    evaluatedAt: new Date().toISOString(),
    productId,
    productName: policy.name,
    productCategory: policy.category,
    pslEligible: policy.pslEligible,
    pslCategory: policy.pslCategory || null,
    status: decisionStatus, // PRE_APPROVED | CONDITIONAL | DECLINED
    requestedTerms: {
      amount: requestedAmount,
      tenureMonths: requestedTenureMonths,
      proposedEmi
    },
    approvedOffer: {
      maxEligibleAmount,
      offeredAmount: approvedPrincipal,
      tenureMonths: approvedTenure,
      indicativeRate,
      estimatedEmi: approvedEmi,
      riskBand: pricing.riskCategory,
      rateSpread: pricing.rateSpread
    },
    keyFactStatement: {
      principal: approvedPrincipal,
      indicativeAnnualRate: indicativeRate,
      indicativeApr: Number(indicativeApr.toFixed(2)),
      tenureMonths: approvedTenure,
      monthlyEmi: approvedEmi,
      totalInterestPayable: totalInterest,
      processingFee,
      netDisbursement,
      totalRepaymentAmount: totalRepayment
    },
    metrics: {
      cibilScore,
      monthlyIncome: totalMonthlyIncome,
      existingEmis,
      existingFoirPct: Number((existingFoir * 100).toFixed(1)),
      calculatedFoirPct: Number((calculatedFoir * 100).toFixed(1)),
      eligibleFoirPct: Number((eligibleFoir * 100).toFixed(1)),
      maxPolicyFoirPct: Number((rules.maxFoir * 100).toFixed(1)),
      ltvPct: calculatedLtvPct,
      maxPolicyLtvPct: ltvDetails.maxLtvPct,
      ltvSlabName: ltvDetails.slabName
    },
    factorScores,
    reasons,
    bureauReport,
    aaData,
    policyVersionUsed: policy.version || 'v1.0-LIVE',
    regulatoryDisclaimer: 'Indicative pre-qualification decision. Soft inquiry with 0.00 score impact. Final sanction subject to full underwriting and verification in LOS.'
  };
}
