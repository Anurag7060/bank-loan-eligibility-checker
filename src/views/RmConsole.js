/**
 * RmConsole.js - Relationship Manager 360 degree console
 * Multi-product borrower passport and What-If simulator
 */

import { DEFAULT_PRODUCT_POLICIES } from '../engine/productPolicies.js';
import { evaluateEligibility } from '../engine/eligibilityEngine.js';

export class RmConsoleView {
  constructor(container, appState) {
    this.container = container;
    this.appState = appState;
    this.clientProfile = {
      name: 'Client Applicant',
      pan: 'ABCDE1234F',
      mobile: '9876543210',
      age: 32,
      employmentType: 'Salaried',
      monthlyIncome: 80000,
      coApplicantIncome: 0,
      existingEmis: 15000,
      collateralValue: 6000000,
      requestedTenureMonths: 60,
      cibilScoreOverride: 760
    };
    this.whatIfParams = { ...this.clientProfile };
    this.passportResults = [];
  }

  render() {
    this.runPassportEvaluation();

    this.container.innerHTML = `
      <div class="page-header" style="text-align:center; margin-bottom:1.5rem;">
        <span class="badge badge-primary" style="margin-bottom:8px;">Branch RM Console &bull; Multi-Product Passport</span>
        <h2 class="page-title">360&deg; Client Loan Passport</h2>
        <p class="page-subtitle">See borrowing capacity across all products at once.</p>
      </div>

      <!-- Client Summary -->
      <div class="bank-card" style="margin-bottom:1.25rem;">
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:1rem;">
          <div class="form-field">
            <span class="text-xs text-muted">Client Name</span>
            <input type="text" id="rm-client-name" class="field-input field-input-sm" value="${this.clientProfile.name}" />
          </div>
          <div class="form-field">
            <span class="text-xs text-muted">PAN</span>
            <input type="text" id="rm-client-pan" class="field-input field-input-sm text-uppercase text-mono" maxlength="10" value="${this.clientProfile.pan}" />
          </div>
          <div>
            <span class="text-xs text-muted">Monthly Income</span>
            <strong style="display:block; color:var(--success);">₹${this.whatIfParams.monthlyIncome.toLocaleString('en-IN')}</strong>
            <span class="text-xs text-muted">Co-Appl: ₹${this.whatIfParams.coApplicantIncome.toLocaleString('en-IN')}</span>
          </div>
          <div>
            <span class="text-xs text-muted">Existing EMIs</span>
            <strong style="display:block; color:var(--danger);">₹${this.whatIfParams.existingEmis.toLocaleString('en-IN')}</strong>
            <span class="text-xs text-muted">DTI: ${((this.whatIfParams.existingEmis / Math.max(1, this.whatIfParams.monthlyIncome + this.whatIfParams.coApplicantIncome)) * 100).toFixed(0)}%</span>
          </div>
          <div>
            <span class="text-xs text-muted">CIBIL Score</span>
            <strong style="display:block; font-size:1.4rem; color:var(--bank-gold);">${this.clientProfile.cibilScoreOverride}</strong>
            <span class="text-xs" style="color:var(--success);">Soft Check</span>
          </div>
        </div>
      </div>

      <div class="grid-2col">
        <!-- Left: Passport Grid -->
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <h3 style="font-size:1.05rem;">Eligibility Across All Products</h3>
            <span class="badge badge-primary">Instant Comparison</span>
          </div>
          <div class="passport-cards-grid">
            ${this.passportResults.map(item => this.renderPassportCard(item)).join('')}
          </div>
        </div>

        <!-- Right: What-If Simulator -->
        <div>
          <div class="bank-card">
            <h3 style="font-size:1rem; margin-bottom:4px;">What-If Simulator</h3>
            <p class="text-xs text-muted mb-3">Adjust sliders to recalculate instantly</p>

            <div style="margin-bottom:1rem;">
              <div class="slider-row-header"><span>Monthly Income:</span><strong id="lbl-sim-income" style="color:var(--bank-primary-light);">₹${this.whatIfParams.monthlyIncome.toLocaleString('en-IN')}</strong></div>
              <input type="range" id="sim-slider-income" min="20000" max="300000" step="5000" value="${this.whatIfParams.monthlyIncome}" class="range-slider" />
            </div>
            <div style="margin-bottom:1rem;">
              <div class="slider-row-header"><span>Co-Applicant Income:</span><strong id="lbl-sim-co-income"  style="color:var(--bank-primary-light);">₹${this.whatIfParams.coApplicantIncome.toLocaleString('en-IN')}</strong></div>
              <input type="range" id="sim-slider-co-income" min="0" max="200000" step="5000" value="${this.whatIfParams.coApplicantIncome}" class="range-slider" />
            </div>
            <div style="margin-bottom:1rem;">
              <div class="slider-row-header"><span>Existing EMIs:</span><strong id="lbl-sim-debt" style="color:var(--danger);">₹${this.whatIfParams.existingEmis.toLocaleString('en-IN')}</strong></div>
              <input type="range" id="sim-slider-debt" min="0" max="100000" step="2500" value="${this.whatIfParams.existingEmis}" class="range-slider" />
            </div>
            <div style="margin-bottom:1rem;">
              <div class="slider-row-header"><span>Collateral Value:</span><strong id="lbl-sim-collateral" style="color:var(--success);">₹${this.whatIfParams.collateralValue.toLocaleString('en-IN')}</strong></div>
              <input type="range" id="sim-slider-collateral" min="500000" max="20000000" step="500000" value="${this.whatIfParams.collateralValue}" class="range-slider" />
            </div>

            <button class="btn btn-outline btn-block btn-sm" id="btn-reset-sim">Reset Sliders</button>
          </div>

          <!-- Exception Referral -->
          <div class="bank-card" style="margin-top:1rem;">
            <h4 style="font-size:0.95rem; margin-bottom:4px;">Refer for Exception</h4>
            <p class="text-xs text-muted mb-3">Request underwriter exception for borderline cases</p>
            <div class="form-field mb-3">
              <label class="field-label text-xs">Product</label>
              <select id="sel-override-product" class="field-select">
                ${this.passportResults.map(r => `<option value="${r.productId}">${r.productName}</option>`).join('')}
              </select>
            </div>
            <div class="form-field mb-3">
              <label class="field-label text-xs">Justification *</label>
              <textarea id="txt-override-justification" class="field-input" rows="2" placeholder="e.g. Long-term customer with good deposit balance..."></textarea>
            </div>
            <button class="btn btn-gold btn-block btn-sm" id="btn-submit-override">Submit Referral</button>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  runPassportEvaluation() {
    const policies = this.appState.getPolicies();
    this.passportResults = Object.keys(policies).map(productId => {
      const merged = {
        ...this.clientProfile,
        monthlyIncome: this.whatIfParams.monthlyIncome,
        coApplicantIncome: this.whatIfParams.coApplicantIncome,
        existingEmis: this.whatIfParams.existingEmis,
        collateralValue: this.whatIfParams.collateralValue,
        requestedTenureMonths: this.whatIfParams.requestedTenureMonths,
        loanProduct: productId
      };
      return evaluateEligibility(merged, policies);
    });
  }

  renderPassportCard(result) {
    const isApproved = result.status === 'PRE_APPROVED';
    const isConditional = result.status === 'CONDITIONAL';
    const borderClass = isApproved ? 'pass-approved' : (isConditional ? 'pass-conditional' : 'pass-declined');
    const badgeClass = isApproved ? 'badge-success' : (isConditional ? 'badge-warning' : 'badge-danger');
    const badgeText = isApproved ? 'Eligible' : (isConditional ? 'Conditional' : 'Not Eligible');

    return `
      <div class="passport-box ${borderClass}">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
          <div>
            <span class="badge ${badgeClass}">${badgeText}</span>
            <h4 style="font-size:0.9rem; margin-top:6px;">${result.productName}</h4>
            <span class="text-xs text-muted">${result.productCategory}</span>
          </div>
          <div style="text-align:right;">
            <strong style="font-size:1.05rem; color:var(--bank-gold);">${result.approvedOffer.indicativeRate}%</strong>
            <span class="text-xs text-muted" style="display:block;">Rate</span>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; background:var(--bg-input); padding:8px; border-radius:var(--radius-xs); margin-bottom:0.5rem;">
          <div>
            <span class="text-xs text-muted" style="display:block;">Max Loan</span>
            <strong style="font-size:0.82rem; color:var(--bank-primary-light);">₹${result.approvedOffer.maxEligibleAmount.toLocaleString('en-IN')}</strong>
          </div>
          <div>
            <span class="text-xs text-muted" style="display:block;">EMI</span>
            <strong style="font-size:0.82rem;">₹${result.approvedOffer.estimatedEmi.toLocaleString('en-IN')}</strong>
          </div>
          <div>
            <span class="text-xs text-muted" style="display:block;">Debt Ratio</span>
            <strong style="font-size:0.82rem;">${result.metrics.eligibleFoirPct}%</strong>
          </div>
        </div>

        <small class="text-muted">${result.reasons[0] ? result.reasons[0].title : 'Standard Policy'}</small>
      </div>
    `;
  }

  attachEventListeners() {
    const inpName = this.container.querySelector('#rm-client-name');
    const inpPan = this.container.querySelector('#rm-client-pan');
    if (inpName) inpName.addEventListener('change', (e) => this.clientProfile.name = e.target.value);
    if (inpPan) inpPan.addEventListener('change', (e) => this.clientProfile.pan = e.target.value.toUpperCase());

    const sliderIncome = this.container.querySelector('#sim-slider-income');
    const sliderCoIncome = this.container.querySelector('#sim-slider-co-income');
    const sliderDebt = this.container.querySelector('#sim-slider-debt');
    const sliderCollateral = this.container.querySelector('#sim-slider-collateral');

    const updateSim = () => {
      this.whatIfParams.monthlyIncome = Number(sliderIncome.value);
      this.whatIfParams.coApplicantIncome = Number(sliderCoIncome.value);
      this.whatIfParams.existingEmis = Number(sliderDebt.value);
      this.whatIfParams.collateralValue = Number(sliderCollateral.value);

      this.container.querySelector('#lbl-sim-income').textContent = `₹${this.whatIfParams.monthlyIncome.toLocaleString('en-IN')}`;
      this.container.querySelector('#lbl-sim-co-income').textContent = `₹${this.whatIfParams.coApplicantIncome.toLocaleString('en-IN')}`;
      this.container.querySelector('#lbl-sim-debt').textContent = `₹${this.whatIfParams.existingEmis.toLocaleString('en-IN')}`;
      this.container.querySelector('#lbl-sim-collateral').textContent = `₹${this.whatIfParams.collateralValue.toLocaleString('en-IN')}`;

      this.runPassportEvaluation();
      const grid = this.container.querySelector('.passport-cards-grid');
      if (grid) {
        grid.innerHTML = this.passportResults.map(item => this.renderPassportCard(item)).join('');
      }
    };

    if (sliderIncome) sliderIncome.addEventListener('input', updateSim);
    if (sliderCoIncome) sliderCoIncome.addEventListener('input', updateSim);
    if (sliderDebt) sliderDebt.addEventListener('input', updateSim);
    if (sliderCollateral) sliderCollateral.addEventListener('input', updateSim);

    const btnReset = this.container.querySelector('#btn-reset-sim');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        this.whatIfParams = { ...this.clientProfile };
        this.render();
      });
    }

    const btnOverride = this.container.querySelector('#btn-submit-override');
    if (btnOverride) {
      btnOverride.addEventListener('click', () => {
        const prod = this.container.querySelector('#sel-override-product').value;
        const just = this.container.querySelector('#txt-override-justification').value.trim();
        if (!just) { alert('Please enter a justification.'); return; }

        const caseItem = {
          caseId: `EXC-${Date.now().toString(36).toUpperCase()}`,
          timestamp: new Date().toISOString(),
          rmName: 'Branch RM',
          applicantName: this.clientProfile.name,
          pan: this.clientProfile.pan,
          productId: prod,
          requestedAmount: 1000000,
          justification: just,
          status: 'PENDING_UNDERWRITER_REVIEW'
        };

        this.appState.addUnderwriterCase(caseItem);
        this.appState.showToast(`Referral #${caseItem.caseId} sent to Underwriter`, 'success');
        this.container.querySelector('#txt-override-justification').value = '';
      });
    }
  }
}
