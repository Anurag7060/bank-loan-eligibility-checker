/**
 * PolicyManager.js - Credit Policy configuration console
 * Policy editor, shadow simulation, maker-checker, and version history
 */

import { DEFAULT_PRODUCT_POLICIES } from '../engine/productPolicies.js';
import { evaluateEligibility } from '../engine/eligibilityEngine.js';
import { generateShadowDataset } from '../engine/mockData.js';

export class PolicyManagerView {
  constructor(container, appState) {
    this.container = container;
    this.appState = appState;
    this.selectedProduct = 'personal_loan';
    this.shadowDataset = generateShadowDataset(120);
    this.draftPolicies = JSON.parse(JSON.stringify(this.appState.getPolicies()));
    this.shadowResults = null;
    this.activeTab = 'editor';
  }

  render() {
    const livePolicies = this.appState.getPolicies();
    const currentLive = livePolicies[this.selectedProduct] || DEFAULT_PRODUCT_POLICIES.personal_loan;
    const currentDraft = this.draftPolicies[this.selectedProduct] || currentLive;

    this.container.innerHTML = `
      <div class="page-header" style="text-align:center; margin-bottom:1.5rem;">
        <span class="badge badge-warning" style="margin-bottom:8px;">Risk Governance &bull; Policy Engine &bull; Maker-Checker</span>
        <h2 class="page-title">Credit Policy Configuration</h2>
        <p class="page-subtitle">Configure FOIR thresholds, LTV caps, CIBIL cutoffs. Test changes in Shadow Mode before publishing.</p>

        <div style="display:flex; justify-content:center; gap:6px; margin-top:1rem; flex-wrap:wrap;">
          <button class="btn btn-sm ${this.activeTab === 'editor' ? 'btn-primary' : 'btn-secondary'}" data-tab="editor">Policy Editor</button>
          <button class="btn btn-sm ${this.activeTab === 'shadow' ? 'btn-primary' : 'btn-secondary'}" data-tab="shadow">Shadow Simulation (120)</button>
          <button class="btn btn-sm ${this.activeTab === 'maker_checker' ? 'btn-primary' : 'btn-secondary'}" data-tab="maker_checker">
            Maker-Checker ${this.appState.getPendingPolicyProposals().length > 0 ? `(${this.appState.getPendingPolicyProposals().length})` : ''}
          </button>
          <button class="btn btn-sm ${this.activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}" data-tab="history">Version History</button>
        </div>
      </div>

      <div>
        ${this.activeTab === 'editor' ? this.renderEditor(currentLive, currentDraft) : ''}
        ${this.activeTab === 'shadow' ? this.renderShadow(currentLive, currentDraft) : ''}
        ${this.activeTab === 'maker_checker' ? this.renderMakerChecker() : ''}
        ${this.activeTab === 'history' ? this.renderHistory() : ''}
      </div>
    `;

    this.attachEventListeners();
  }

  renderEditor(live, draft) {
    const products = Object.values(this.draftPolicies);
    return `
      <!-- Product pills -->
      <div style="display:flex; gap:6px; overflow-x:auto; padding-bottom:8px; margin-bottom:1rem;">
        ${products.map(p => `
          <button class="btn btn-xs ${this.selectedProduct === p.id ? 'btn-gold' : 'btn-outline'} pill-btn" data-product-id="${p.id}">${p.name}</button>
        `).join('')}
      </div>

      <div class="bank-card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem; margin-bottom:1.25rem;">
          <div>
            <h3 style="font-size:1.05rem;">Editing: <span style="color:var(--bank-primary-light);">${draft.name}</span></h3>
            <span class="text-xs text-muted">Category: ${draft.category} &bull; Base EBLR: ${draft.rules.baseInterestRate}%</span>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm" id="btn-reset-draft">Revert to Live</button>
            <button class="btn btn-outline btn-sm" id="btn-run-shadow-direct">Run Shadow Test &rarr;</button>
            <button class="btn btn-primary btn-sm" id="btn-propose-policy">Submit Proposal (Maker)</button>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:1rem;">
          <div class="form-field">
            <label class="field-label">Max FOIR (Debt-to-Income Cap)</label>
            <input type="number" id="rule-maxFoir" class="field-input" step="0.05" min="0.30" max="0.80" value="${draft.rules.maxFoir}" />
            <span class="field-hint">Live: ${(live.rules.maxFoir * 100).toFixed(0)}%</span>
          </div>
          <div class="form-field">
            <label class="field-label">Min CIBIL Score</label>
            <input type="number" id="rule-minCibilScore" class="field-input" min="500" max="850" value="${draft.rules.minCibilScore}" />
            <span class="field-hint">Live: ${live.rules.minCibilScore}</span>
          </div>
          <div class="form-field">
            <label class="field-label">Min Monthly Income (₹)</label>
            <input type="number" id="rule-minIncomeMonthly" class="field-input" step="5000" min="10000" value="${draft.rules.minIncomeMonthly}" />
            <span class="field-hint">Live: ₹${live.rules.minIncomeMonthly.toLocaleString('en-IN')}</span>
          </div>
          <div class="form-field">
            <label class="field-label">Base Interest Rate (%)</label>
            <input type="number" id="rule-baseRate" class="field-input" step="0.10" min="5.0" max="25.0" value="${draft.rules.baseInterestRate}" />
            <span class="field-hint">Live: ${live.rules.baseInterestRate}%</span>
          </div>
          <div class="form-field">
            <label class="field-label">Min Age (Years)</label>
            <input type="number" id="rule-minAge" class="field-input" min="18" max="30" value="${draft.rules.minAge}" />
            <span class="field-hint">Live: ${live.rules.minAge} yrs</span>
          </div>
          <div class="form-field">
            <label class="field-label">Max Age (Years)</label>
            <input type="number" id="rule-maxAge" class="field-input" min="50" max="75" value="${draft.rules.maxAge}" />
            <span class="field-hint">Live: ${live.rules.maxAge} yrs</span>
          </div>
          <div class="form-field">
            <label class="field-label">Max Tenure (Months)</label>
            <input type="number" id="rule-maxTenure" class="field-input" step="12" min="12" max="360" value="${draft.rules.maxTenureMonths}" />
            <span class="field-hint">Live: ${live.rules.maxTenureMonths} months</span>
          </div>
          <div class="form-field">
            <label class="field-label">Processing Fee (%)</label>
            <input type="number" id="rule-proceesingFee" class="field-input" step="0.25" min="0.0" max="5.0" value="${draft.rules.processingFeePct}" />
            <span class="field-hint">Live: ${live.rules.processingFeePct}%</span>
          </div>
        </div>

        <!-- Pricing bands table -->
        <div style="margin-top:1.5rem;">
          <h4 style="font-size:0.95rem; margin-bottom:0.75rem;">Risk-Based Pricing Tiers</h4>
          <table class="bank-table">
            <thead>
              <tr><th>CIBIL Band</th><th>Risk Class</th><th>Spread (+%)</th><th>Effective Rate</th></tr>
            </thead>
            <tbody>
              ${draft.pricingBands.map((band, idx) => `
                <tr>
                  <td>${band.cibilMin} - ${band.cibilMax}</td>
                  <td><input type="text" class="field-input field-input-sm band-risk" data-idx="${idx}" value="${band.riskCategory}" /></td>
                  <td><input type="number" step="0.25" class="field-input field-input-sm band-spread" data-idx="${idx}" value="${band.rateSpread}" /></td>
                  <td><strong style="color:var(--bank-primary-light);">${(draft.rules.baseInterestRate + band.rateSpread).toFixed(2)}%</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  renderShadow(live, draft) {
    if (!this.shadowResults) this.runShadowSimulation();
    const res = this.shadowResults;
    const approvalDelta = res.draftApprovalRatePct - res.liveApprovalRatePct;
    const isTighter = approvalDelta < 0;

    return `
      <div class="bank-card" style="margin-bottom:1.25rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
          <div>
            <span class="badge badge-primary" style="margin-bottom:4px;">Shadow Mode</span>
            <h3 style="font-size:1.1rem;">Impact on 120 Profiles</h3>
            <p class="text-sm text-muted">Evaluate approval-rate sensitivity before deployment.</p>
          </div>
          <button class="btn btn-primary btn-sm" id="btn-re-run-shadow">Re-Calculate</button>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1rem; margin-bottom:1.25rem;">
        <div class="bank-card" style="text-align:center;">
          <span class="text-xs text-muted">Approval (Live)</span>
          <div style="font-size:1.6rem; font-weight:800;">${res.liveApprovalRatePct}%</div>
          <span class="text-xs text-muted">${res.liveApprovedCount}/120</span>
        </div>
        <div class="bank-card" style="text-align:center;">
          <span class="text-xs text-muted">Approval (Draft)</span>
          <div style="font-size:1.6rem; font-weight:800; color:var(--bank-primary-light);">${res.draftApprovalRatePct}%</div>
          <span class="text-xs text-muted">${res.draftApprovedCount}/120</span>
        </div>
        <div class="bank-card" style="text-align:center; border-color:var(--border-gold);">
          <span class="text-xs text-muted">Delta</span>
          <div style="font-size:1.6rem; font-weight:800; color:${isTighter ? 'var(--warning)' : 'var(--success)'};">${approvalDelta > 0 ? '+' : ''}${approvalDelta.toFixed(1)}%</div>
          <span class="text-xs">${isTighter ? 'Tighter' : 'Expansionary'}</span>
        </div>
        <div class="bank-card" style="text-align:center;">
          <span class="text-xs text-muted">Avg Loan Size (Draft)</span>
          <div style="font-size:1.6rem; font-weight:800; color:var(--bank-primary-light);">₹${res.avgDraftLoanSize.toLocaleString('en-IN')}</div>
          <span class="text-xs text-muted">Delta: ₹${(res.avgDraftLoanSize - res.avgLiveLoanSize).toLocaleString('en-IN')}</span>
        </div>
      </div>

      <div class="bank-card">
        <h3 style="font-size:0.95rem; margin-bottom:0.75rem;">Cohort Comparison (First 15)</h3>
        <div style="overflow-x:auto;">
          <table class="bank-table">
            <thead>
              <tr><th>ID</th><th>Name</th><th>Income/Debt</th><th>CIBIL</th><th>Live</th><th>Draft</th><th>Note</th></tr>
            </thead>
            <tbody>
              ${res.comparisons.slice(0, 15).map(c => `
                <tr>
                  <td class="text-mono" style="font-size:0.75rem;">${c.applicant.applicantId}</td>
                  <td><strong>${c.applicant.fullName}</strong> (${c.applicant.employmentType})</td>
                  <td>₹${(c.applicant.monthlyIncome / 1000).toFixed(0)}k / ₹${(c.applicant.existingEmis / 1000).toFixed(0)}k</td>
                  <td><strong>${c.applicant.cibilScoreOverride}</strong></td>
                  <td><span class="badge ${c.liveResult.status === 'PRE_APPROVED' ? 'badge-success' : (c.liveResult.status === 'CONDITIONAL' ? 'badge-warning' : 'badge-danger')}">${c.liveResult.status}</span></td>
                  <td><span class="badge ${c.draftResult.status === 'PRE_APPROVED' ? 'badge-success' : (c.draftResult.status === 'CONDITIONAL' ? 'badge-warning' : 'badge-danger')}">${c.draftResult.status}</span></td>
                  <td><small class="${c.statusChanged ? 'font-semibold' : 'text-muted'}" style="${c.statusChanged ? 'color:var(--bank-primary-light);' : ''}">${c.statusChanged ? `${c.liveResult.status} → ${c.draftResult.status}` : 'No change'}</small></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  renderMakerChecker() {
    const proposals = this.appState.getPendingPolicyProposals();
    return `
      <div class="bank-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <div>
            <h3 style="font-size:1.05rem;">Maker-Checker Review Queue</h3>
            <p class="text-xs text-muted">Dual-control for policy modifications</p>
          </div>
          <span class="badge badge-warning">${proposals.length} Pending</span>
        </div>

        ${proposals.length === 0 ? `
          <div style="text-align:center; padding:2rem; color:var(--text-muted);">
            <p style="font-size:1.5rem;">✓</p>
            <h4>No Pending Proposals</h4>
            <p class="text-sm">All policy versions are approved. Create a new proposal in the Editor.</p>
          </div>
        ` : `
          ${proposals.map(p => `
            <div class="bank-card" style="margin-bottom:0.75rem; border-left:3px solid var(--warning);">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px; margin-bottom:0.75rem;">
                <div>
                  <strong>Proposal #${p.proposalId} - ${p.productName}</strong>
                  <span class="text-xs text-muted" style="display:block;">Maker: ${p.makerName} &bull; ${new Date(p.createdAt).toLocaleString()}</span>
                </div>
                <span class="badge badge-warning">${p.status}</span>
              </div>
              <p class="text-sm"><strong>Rationale:</strong> ${p.justification || 'Standard adjustment'}</p>
              <pre style="background:var(--bg-input); border:1px solid var(--border-color); border-radius:var(--radius-xs); padding:8px; font-size:0.75rem; margin:8px 0; overflow-x:auto;">${JSON.stringify(p.diffSummary, null, 2)}</pre>
              <div style="display:flex; gap:8px;">
                <button class="btn btn-danger btn-sm btn-reject-proposal" data-proposal-id="${p.proposalId}">Reject</button>
                <button class="btn btn-success btn-sm btn-approve-proposal" data-proposal-id="${p.proposalId}">Approve & Deploy</button>
              </div>
            </div>
          `).join('')}
        `}
      </div>
    `;
  }

  renderHistory() {
    const history = this.appState.getPolicyVersionHistory();
    return `
      <div class="bank-card">
        <h3 style="font-size:1.05rem; margin-bottom:4px;">Policy Audit Trail</h3>
        <p class="text-xs text-muted mb-3">Reconstructable history per RBI IT Governance</p>

        ${history.map(v => `
          <div style="border-left:3px solid var(--bank-gold); padding-left:1rem; margin-bottom:1.25rem;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong>Version ${v.version} (${v.productName})</strong>
              <span class="badge ${v.isActive ? 'badge-success' : 'badge-primary'}">${v.isActive ? 'CURRENT LIVE' : 'ARCHIVED'}</span>
            </div>
            <p class="text-xs text-muted mt-1">${new Date(v.deployedAt).toLocaleString()} &bull; Approved by: ${v.approvedBy}</p>
            <p class="text-sm mt-1">${v.changeNotes}</p>
            ${!v.isActive ? `<button class="btn btn-outline btn-xs mt-2 btn-rollback-version" data-version="${v.version}" data-product-id="${v.productId}">Rollback</button>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  runShadowSimulation() {
    const livePolicies = this.appState.getPolicies();
    const draftPolicies = this.draftPolicies;
    let liveApprovedCount = 0, draftApprovedCount = 0, totalLiveLoan = 0, totalDraftLoan = 0;

    const comparisons = this.shadowDataset.map(applicant => {
      const liveRes = evaluateEligibility(applicant, livePolicies);
      const draftRes = evaluateEligibility(applicant, draftPolicies);
      if (liveRes.status === 'PRE_APPROVED' || liveRes.status === 'CONDITIONAL') liveApprovedCount++;
      if (draftRes.status === 'PRE_APPROVED' || draftRes.status === 'CONDITIONAL') draftApprovedCount++;
      totalLiveLoan += liveRes.approvedOffer.offeredAmount;
      totalDraftLoan += draftRes.approvedOffer.offeredAmount;
      return { applicant, liveResult: liveRes, draftResult: draftRes, statusChanged: liveRes.status !== draftRes.status };
    });

    const total = this.shadowDataset.length;
    this.shadowResults = {
      totalCount: total,
      liveApprovedCount, draftApprovedCount,
      liveApprovalRatePct: Number(((liveApprovedCount / total) * 100).toFixed(1)),
      draftApprovalRatePct: Number(((draftApprovedCount / total) * 100).toFixed(1)),
      avgLiveLoanSize: Math.round(totalLiveLoan / Math.max(1, liveApprovedCount)),
      avgDraftLoanSize: Math.round(totalDraftLoan / Math.max(1, draftApprovedCount)),
      comparisons
    };
  }

  attachEventListeners() {
    // Tab nav
    this.container.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => { this.activeTab = btn.dataset.tab; this.render(); });
    });

    // Product pills
    this.container.querySelectorAll('.pill-btn').forEach(btn => {
      if (btn.dataset.productId) btn.addEventListener('click', () => { this.selectedProduct = btn.dataset.productId; this.render(); });
    });

    // Editor inputs
    const bind = (id, prop) => {
      const el = this.container.querySelector(`#${id}`);
      if (el) el.addEventListener('input', () => {
        const v = Number(el.value);
        const r = this.draftPolicies[this.selectedProduct].rules;
        if (prop === 'maxFoir') r.maxFoir = v;
        if (prop === 'minCibilScore') r.minCibilScore = v;
        if (prop === 'minIncomeMonthly') r.minIncomeMonthly = v;
        if (prop === 'baseRate') r.baseInterestRate = v;
        if (prop === 'minAge') r.minAge = v;
        if (prop === 'maxAge') r.maxAge = v;
        if (prop === 'maxTenure') r.maxTenureMonths = v;
        if (prop === 'processingFee') r.processingFeePct = v;
      });
    };
    bind('rule-maxFoir', 'maxFoir'); bind('rule-minCibilScore', 'minCibilScore');
    bind('rule-minIncomeMonthly', 'minIncomeMonthly'); bind('rule-baseRate', 'baseRate');
    bind('rule-minAge', 'minAge'); bind('rule-maxAge', 'maxAge');
    bind('rule-maxTenure', 'maxTenure'); bind('rule-proceesingFee', 'processingFee');

    const btnShadow = this.container.querySelector('#btn-run-shadow-direct');
    if (btnShadow) btnShadow.addEventListener('click', () => { this.activeTab = 'shadow'; this.shadowResults = null; this.render(); });

    const btnReRun = this.container.querySelector('#btn-re-run-shadow');
    if (btnReRun) btnReRun.addEventListener('click', () => { this.shadowResults = null; this.render(); this.appState.showToast('Shadow simulation re-calculated', 'info'); });

    const btnPropose = this.container.querySelector('#btn-propose-policy');
    if (btnPropose) btnPropose.addEventListener('click', () => {
      const justification = prompt('Maker rationale for this revision:', 'Risk tightening per RBI circular');
      if (!justification) return;
      const proposal = {
        proposalId: `PROP-${Date.now().toString(36).toUpperCase()}`,
        productId: this.selectedProduct,
        productName: this.draftPolicies[this.selectedProduct].name,
        makerName: 'Policy Analyst (Maker)',
        createdAt: new Date().toISOString(),
        status: 'PENDING_CHECKER_APPROVAL',
        justification,
        diffSummary: { maxFoir: this.draftPolicies[this.selectedProduct].rules.maxFoir, minCibil: this.draftPolicies[this.selectedProduct].rules.minCibilScore, baseRate: this.draftPolicies[this.selectedProduct].rules.baseInterestRate },
        proposedPolicy: JSON.parse(JSON.stringify(this.draftPolicies[this.selectedProduct]))
      };
      this.appState.addPolicyProposal(proposal);
      this.activeTab = 'maker_checker';
      this.render();
      this.appState.showToast(`Proposal ${proposal.proposalId} submitted`, 'success');
    });

    this.container.querySelectorAll('.btn-approve-proposal').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.proposalId;
        this.appState.approvePolicyProposal(id, 'Risk Head (Checker)');
        this.draftPolicies = JSON.parse(JSON.stringify(this.appState.getPolicies()));
        this.render();
        this.appState.showToast(`Proposal ${id} approved and deployed`, 'success');
      });
    });

    this.container.querySelectorAll('.btn-reject-proposal').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.proposalId;
        this.appState.rejectPolicyProposal(id);
        this.render();
        this.appState.showToast(`Proposal ${id} rejected`, 'warning');
      });
    });
  }
}
