/**
 * Loan Eligibility System (LES) - Underwriter Exceptions & Manual Review Queue
 * Persona: Underwriter (Credit Operations & Delegation of Authority - DOA)
 */

export class UnderwriterQueueView {
  constructor(container, appState) {
    this.container = container;
    this.appState = appState;
    this.selectedCaseId = null;
  }

  render() {
    const cases = this.appState.getUnderwriterCases();
    const activeCase = cases.find(c => c.caseId === this.selectedCaseId) || cases[0];

    this.container.innerHTML = `
      <div class="uw-header">
        <div class="uw-badge">
          <span class="pulse-dot"></span>
          <span>Delegation of Authority (DOA) &bull; Credit Underwriting Exceptions Desk</span>
        </div>
        <h1 class="uw-title">Underwriter Exceptions & Manual Overrides Queue</h1>
        <p class="uw-subtitle">
          Review policy-exception referrals from branch RMs, inspect full explainability trails, and issue auditable credit exception decisions.
        </p>
      </div>

      <div class="uw-layout">
        <!-- Left: Queue List -->
        <div class="uw-queue-list card glass-card">
          <div class="queue-header">
            <h3>Pending Exceptions (${cases.filter(c => c.status === 'PENDING_UNDERWRITER_REVIEW').length})</h3>
            <span class="badge badge-info">Real-Time Routing</span>
          </div>

          <div class="queue-items">
            ${cases.length === 0 ? `
              <div class="empty-state p-4">
                <i class="icon-inbox text-2xl text-muted"></i>
                <p class="text-muted text-sm mt-2">No pending underwriter exception cases.</p>
              </div>
            ` : cases.map(c => `
              <div class="queue-card ${activeCase && activeCase.caseId === c.caseId ? 'active' : ''}" data-case-id="${c.caseId}">
                <div class="q-top">
                  <span class="q-id text-mono">${c.caseId}</span>
                  <span class="badge ${c.status === 'PENDING_UNDERWRITER_REVIEW' ? 'badge-warning' : (c.status === 'APPROVED_EXCEPTION' ? 'badge-success' : 'badge-danger')}">
                    ${c.status === 'PENDING_UNDERWRITER_REVIEW' ? 'Pending Review' : c.status}
                  </span>
                </div>
                <div class="q-name"><strong>${c.applicantName}</strong></div>
                <div class="q-meta text-xs text-muted">
                  <span>PAN: ${c.pan}</span> &bull; <span>Product: ${c.productId}</span>
                </div>
                <div class="q-time text-xs text-muted mt-1">
                  Referred by ${c.rmName} &bull; ${new Date(c.timestamp).toLocaleTimeString()}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Right: Case Dossier & Underwriting Action -->
        <div class="uw-dossier-main">
          ${activeCase ? this.renderCaseDossier(activeCase) : `
            <div class="card glass-card p-5 text-center">
              <h3>Select a case from the queue to view dossier</h3>
            </div>
          `}
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  renderCaseDossier(c) {
    const isPending = c.status === 'PENDING_UNDERWRITER_REVIEW';

    return `
      <div class="card glass-card dossier-card">
        <div class="dossier-header-bar">
          <div>
            <span class="badge badge-primary">Case Dossier #${c.caseId}</span>
            <h2>${c.applicantName}</h2>
            <span class="text-xs text-muted">PAN: ${c.pan} &bull; Product Requested: <strong>${c.productId.toUpperCase()}</strong></span>
          </div>

          <div class="dossier-status-pill">
            <span class="badge ${isPending ? 'badge-warning' : (c.status === 'APPROVED_EXCEPTION' ? 'badge-success' : 'badge-danger')}">
              ${c.status}
            </span>
          </div>
        </div>

        <!-- RM Referral Rationale Box -->
        <div class="rm-rationale-box mt-3">
          <h4><i class="icon-message-square"></i> Branch RM Referral Justification</h4>
          <p class="text-sm">${c.justification}</p>
          <small class="text-muted">Referred by: ${c.rmName} on ${new Date(c.timestamp).toLocaleString()}</small>
        </div>

        <!-- Policy Exception Parameters -->
        <div class="exception-metrics-grid mt-4">
          <div class="e-metric-box">
            <span class="e-label">Requested Loan Amount</span>
            <strong class="e-val text-primary">₹${Number(c.requestedAmount || 1000000).toLocaleString('en-IN')}</strong>
          </div>
          <div class="e-metric-box">
            <span class="e-label">Recommended Exception DOA</span>
            <strong class="e-val text-accent">DOA Level-2 (Branch Head)</strong>
          </div>
          <div class="e-metric-box">
            <span class="e-label">Audit Retention</span>
            <strong class="e-val">8 Years (RBI FPC)</strong>
          </div>
        </div>

        ${isPending ? `
          <!-- Underwriting Decision Action Form -->
          <div class="uw-decision-action-box card glass-card mt-4">
            <h4><i class="icon-shield-check"></i> Execute Underwriter Exception Decision</h4>
            <div class="form-group mt-3">
              <label class="form-label text-xs">Mandatory Underwriter Audit Notes & Exception Conditions *</label>
              <textarea id="txt-uw-notes" class="form-control" rows="3" placeholder="Document policy deviation rationale (e.g. exception granted on FOIR based on verified collateral / vintage)..."></textarea>
            </div>

            <div class="uw-action-buttons">
              <button class="btn btn-danger" id="btn-uw-decline">
                <i class="icon-x-circle"></i> Decline Exception
              </button>
              <button class="btn btn-warning" id="btn-uw-conditional">
                <i class="icon-alert-triangle"></i> Approve with Conditional Terms
              </button>
              <button class="btn btn-success btn-glow" id="btn-uw-approve">
                <i class="icon-check-circle"></i> Approve Policy Exception
              </button>
            </div>
          </div>
        ` : `
          <div class="alert alert-info mt-4">
            <strong>Decision Rendered:</strong> ${c.status} by Underwriter Desk on ${new Date(c.resolvedAt || c.timestamp).toLocaleString()}.<br/>
            <strong>Audit Notes:</strong> ${c.underwriterNotes || 'Exception approved as per standard DOA matrix.'}
          </div>
        `}
      </div>
    `;
  }

  attachEventListeners() {
    this.container.querySelectorAll('.queue-card').forEach(card => {
      card.addEventListener('click', () => {
        this.selectedCaseId = card.dataset.caseId;
        this.render();
      });
    });

    const cases = this.appState.getUnderwriterCases();
    const activeCase = cases.find(c => c.caseId === this.selectedCaseId) || cases[0];
    if (!activeCase) return;

    const executeDecision = (status) => {
      const notes = this.container.querySelector('#txt-uw-notes')?.value.trim();
      if (!notes) {
        alert('Please enter mandatory underwriter audit notes before rendering decision.');
        return;
      }
      activeCase.status = status;
      activeCase.underwriterNotes = notes;
      activeCase.resolvedAt = new Date().toISOString();
      this.appState.saveUnderwriterCases();
      this.render();
      this.appState.showToast(`Case #${activeCase.caseId} decided as ${status}`, 'success');
    };

    const btnApprove = this.container.querySelector('#btn-uw-approve');
    if (btnApprove) btnApprove.addEventListener('click', () => executeDecision('APPROVED_EXCEPTION'));

    const btnDecline = this.container.querySelector('#btn-uw-decline');
    if (btnDecline) btnDecline.addEventListener('click', () => executeDecision('DECLINED_EXCEPTION'));

    const btnCond = this.container.querySelector('#btn-uw-conditional');
    if (btnCond) btnCond.addEventListener('click', () => executeDecision('APPROVED_CONDITIONAL_EXCEPTION'));
  }
}
