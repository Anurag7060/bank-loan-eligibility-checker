/**
 * Loan Eligibility System (LES) - Benchmark Dataset & Sample Personas
 * Includes 100+ Synthetic Applicant Profiles for Policy Shadow Simulation Mode
 */

export const SAMPLE_PERSONAS = [
  {
    id: 'anaya_salaried',
    name: 'Anaya Sharma (Salaried Tech Lead)',
    age: 29,
    pan: 'ANAPS1234K',
    mobile: '9876543210',
    employmentType: 'Salaried',
    employerName: 'Infosys BPM Ltd',
    employerCategory: 'Super Cat A / MNC',
    monthlyIncome: 85000,
    coApplicantIncome: 0,
    existingEmis: 12000,
    requestedAmount: 800000,
    requestedTenureMonths: 48,
    loanProduct: 'personal_loan',
    cibilScoreOverride: 785,
    tag: 'Retail Salaried / Super Prime'
  },
  {
    id: 'ravi_msme',
    name: 'Ravi Patel (Precision Tools MSME)',
    age: 41,
    pan: 'RAVIP5678M',
    mobile: '9823456789',
    employmentType: 'Self-Employed Business',
    employerName: 'Patel Precision Engineering Pvt Ltd',
    employerCategory: 'MSME Registered',
    monthlyIncome: 140000,
    coApplicantIncome: 45000,
    annualTurnover: 18000000, // ₹1.8 Cr GST Turnover
    businessVintageYears: 6,
    existingEmis: 35000,
    requestedAmount: 3500000,
    requestedTenureMonths: 60,
    loanProduct: 'msme_loan',
    cibilScoreOverride: 742,
    tag: 'MSME Business / Priority Sector'
  },
  {
    id: 'pooja_home',
    name: 'Pooja Iyer (Senior Architect)',
    age: 34,
    pan: 'POOJI9012P',
    mobile: '9811223344',
    employmentType: 'Salaried',
    employerName: 'Morphogenesis Architects',
    employerCategory: 'Cat A Listed',
    monthlyIncome: 130000,
    coApplicantIncome: 80000,
    existingEmis: 18000,
    requestedAmount: 5500000,
    requestedTenureMonths: 240, // 20 years
    loanProduct: 'home_loan',
    collateralValue: 7000000, // ₹70 Lakhs Property
    propertyType: 'Residential Flat',
    cibilScoreOverride: 770,
    tag: 'Mortgage / Tiered LTV 80%'
  },
  {
    id: 'vikas_borderline',
    name: 'Vikas Gupta (Retail Store Manager)',
    age: 38,
    pan: 'VIKAG3456T',
    mobile: '9899887766',
    employmentType: 'Salaried',
    employerName: 'Reliance Retail Ltd',
    employerCategory: 'Cat B',
    monthlyIncome: 42000,
    coApplicantIncome: 0,
    existingEmis: 22000, // High existing debt (52% FOIR)
    requestedAmount: 400000,
    requestedTenureMonths: 36,
    loanProduct: 'personal_loan',
    cibilScoreOverride: 668,
    tag: 'Borderline / High Debt Burden'
  },
  {
    id: 'karan_caution',
    name: 'Karan Malhotra (Negative List Test)',
    age: 45,
    pan: 'ABCDE1234F', // On mock blacklist
    mobile: '9800112233',
    employmentType: 'Self-Employed Business',
    monthlyIncome: 90000,
    existingEmis: 10000,
    requestedAmount: 1000000,
    requestedTenureMonths: 36,
    loanProduct: 'personal_loan',
    cibilScoreOverride: 620,
    tag: 'Caution / Wilful Defaulter Match'
  }
];

/**
 * Generate 120 synthetic historical applicant profiles for Shadow Mode Simulation
 */
export function generateShadowDataset(count = 120) {
  const products = ['personal_loan', 'home_loan', 'lap', 'auto_loan', 'msme_loan', 'education_loan', 'gold_loan', 'credit_card'];
  const employmentTypes = ['Salaried', 'Self-Employed Professional', 'Self-Employed Business'];
  const firstNames = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan', 'Diya', 'Saanvi', 'Ananya', 'Aadhya', 'Pari', 'Anika', 'Navya', 'Angel', 'Riya', 'Myra'];
  const lastNames = ['Sharma', 'Verma', 'Patel', 'Reddy', 'Nair', 'Iyer', 'Gupta', 'Singh', 'Mehta', 'Joshi', 'Chopra', 'Rao', 'Bhat', 'Deshmukh', 'Kulkarni'];

  const dataset = [];

  for (let i = 1; i <= count; i++) {
    const fn = firstNames[i % firstNames.length];
    const ln = lastNames[(i * 3) % lastNames.length];
    const product = products[i % products.length];
    const empType = employmentTypes[i % employmentTypes.length];
    
    // Controlled distribution of income and scores
    const incomeBase = 25000 + ((i * 7919) % 180000);
    const scoreBase = 580 + ((i * 3571) % 310); // 580 to 890
    const age = 22 + (i % 42); // 22 to 64
    const existingDebtRatio = ((i * 13) % 65) / 100; // 0% to 65%
    const existingEmis = Math.round(incomeBase * existingDebtRatio);
    const requestedAmount = Math.round(incomeBase * (6 + (i % 25)));
    const collateralValue = ['home_loan', 'lap', 'auto_loan', 'gold_loan'].includes(product)
      ? Math.round(requestedAmount * (1.1 + ((i % 5) * 0.2)))
      : 0;

    dataset.push({
      applicantId: `HIST-APP-${1000 + i}`,
      fullName: `${fn} ${ln}`,
      age,
      pan: `MOCK${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + ((i * 2) % 26))}${1000 + i}Z`,
      mobile: `98${Math.floor(10000000 + ((i * 888777) % 89999999))}`,
      employmentType: empType,
      monthlyIncome: incomeBase,
      coApplicantIncome: (i % 4 === 0) ? Math.round(incomeBase * 0.6) : 0,
      existingEmis,
      requestedAmount,
      requestedTenureMonths: product === 'home_loan' ? 240 : (product === 'lap' ? 120 : (product === 'gold_loan' ? 12 : 48)),
      loanProduct: product,
      collateralValue,
      businessVintageYears: 1 + (i % 12),
      annualTurnover: incomeBase * 12 * 4,
      cibilScoreOverride: scoreBase
    });
  }

  return dataset;
}
