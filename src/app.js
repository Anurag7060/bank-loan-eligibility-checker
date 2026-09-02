/**
 * Loan Eligibility System (LES) - Application Controller & State Orchestrator
 */

import { DEFAULT_PRODUCT_POLICIES } from './engine/productPolicies.js';
import { RetailPortalView } from './views/RetailPortal.js';
import { RmConsoleView } from './views/RmConsole.js';
import { PolicyManagerView } from './views/PolicyManager.js';
import { UnderwriterQueueView } from './views/UnderwriterQueue.js';
import { PartnerApiSandboxView } from './views/PartnerApiSandbox.js';
import { AnalyticsDashboardView } from './views/AnalyticsDashboard.js';

class AppState {
  constructor() {
    this.policies = this.loadPolicies();
    this.policyProposals = this.loadPolicyProposals();
    this.policyVersionHistory = this.loadPolicyVersionHistory();
    this.underwriterCases = this.loadUnderwriterCases();
    this.assessments = this.loadAssessments();
    this.activeView = 'retail';
  }

  // --- Policy State ---
  loadPolicies() {
    try {
      const saved = localStorage.getItem('les_policies_v1');
      return saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(DEFAULT_PRODUCT_POLICIES));
    } catch {
      return JSON.parse(JSON.stringify(DEFAULT_PRODUCT_POLICIES));
    }
  }

  savePolicies() {
    localStorage.setItem('les_policies_v1', JSON.stringify(this.policies));
  }

  getPolicies() {
    return this.policies;
  }

  // --- Maker-Checker Proposals ---
  loadPolicyProposals() {
    try {
      const saved = localStorage.getItem('les_policy_proposals');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  addPolicyProposal(proposal) {
    this.policyProposals.unshift(proposal);
    localStorage.setItem('les_policy_proposals', JSON.stringify(this.policyProposals));
  }

  getPendingPolicyProposals() {
    return this.policyProposals.filter(p => p.status === 'PENDING_CHECKER_APPROVAL');
  }

  approvePolicyProposal(proposalId, checkerName) {
    const proposal = this.policyProposals.find(p => p.proposalId === proposalId);
    if (!proposal) return;

    proposal.status = 'APPROVED_AND_DEPLOYED';
    proposal.approvedBy = checkerName;
    proposal.approvedAt = new Date().toISOString();

    // Deploy to live policies
    this.policies[proposal.productId] = proposal.proposedPolicy;
    this.savePolicies();

    // Record in version history
    this.policyVersionHistory.unshift({
      version: `v${(1.0 + (this.policyVersionHistory.length * 0.1)).toFixed(1)}`,
      productId: proposal.productId,
      productName: proposal.productName,
      deployedAt: new Date().toISOString(),
      approvedBy: checkerName,
      changeNotes: proposal.justification,
      isActive: true,
      policySnapshot: JSON.parse(JSON.stringify(proposal.proposedPolicy))
    });
    localStorage.setItem('les_policy_history', JSON.stringify(this.policyVersionHistory));
    localStorage.setItem('les_policy_proposals', JSON.stringify(this.policyProposals));
  }

  rejectPolicyProposal(proposalId) {
    const proposal = this.policyProposals.find(p => p.proposalId === proposalId);
    if (!proposal) return;
    proposal.status = 'REJECTED_BY_CHECKER';
    proposal.rejectedAt = new Date().toISOString();
    localStorage.setItem('les_policy_proposals', JSON.stringify(this.policyProposals));
  }

  loadPolicyVersionHistory() {
    try {
      const saved = localStorage.getItem('les_policy_history');
      if (saved) return JSON.parse(saved);
    } catch {}

    return [
      {
        version: 'v1.0-LIVE',
        productId: 'personal_loan',
        productName: 'Personal Loan',
        deployedAt: '2026-08-20T10:00:00Z',
        approvedBy: 'Chief Risk Officer (Checker)',
        changeNotes: 'Initial production baseline rules per RBI digital lending guidelines.',
        isActive: true
      },
      {
        version: 'v1.0-LIVE',
        productId: 'home_loan',
        productName: 'Home Loan',
        deployedAt: '2026-08-20T10:00:00Z',
        approvedBy: 'Chief Risk Officer (Checker)',
        changeNotes: 'Tiered LTV statutory slabs implemented.',
        isActive: true
      }
    ];
  }

  getPolicyVersionHistory() {
    return this.policyVersionHistory;
  }

  // --- Underwriter Exceptions Queue ---
  loadUnderwriterCases() {
    try {
      const saved = localStorage.getItem('les_underwriter_cases');
      if (saved) return JSON.parse(saved);
    } catch {}

    return [
      {
        caseId: 'EXC-PL-9021',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        rmName: 'Priya (Branch RM #104)',
        applicantName: 'Vikas Gupta',
        pan: 'VIKAG3456T',
        productId: 'personal_loan',
        requestedAmount: 450000,
        justification: 'Client has an upcoming performance bonus credit and 7-year continuous salaried vintage. Requesting 5% FOIR relaxation.',
        status: 'PENDING_UNDERWRITER_REVIEW'
      }
    ];
  }

  addUnderwriterCase(c) {
    this.underwriterCases.unshift(c);
    this.saveUnderwriterCases();
  }

  saveUnderwriterCases() {
    localStorage.setItem('les_underwriter_cases', JSON.stringify(this.underwriterCases));
  }

  getUnderwriterCases() {
    return this.underwriterCases;
  }

  // --- Assessments Log ---
  loadAssessments() {
    try {
      const saved = localStorage.getItem('les_assessments');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  recordAssessment(evalResult) {
    this.assessments.unshift(evalResult);
    localStorage.setItem('les_assessments', JSON.stringify(this.assessments.slice(0, 100)));
  }

  getRecordedAssessments() {
    return this.assessments;
  }

  // --- Toast Notification Helper ---
  showToast(message, type = 'info') {
    const toastRoot = document.getElementById('toast-container');
    if (!toastRoot) return;

    const toast = document.createElement('div');
    toast.className = `toast-msg ${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <i class="${type === 'success' ? 'icon-check' : (type === 'warning' ? 'icon-alert-triangle' : 'icon-info')}"></i>
        <span>${message}</span>
      </div>
    `;

    toastRoot.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
}

// Global App Initialization
document.addEventListener('DOMContentLoaded', () => {
  const appState = new AppState();
  const mainContent = document.getElementById('app-main-content');

  const views = {
    retail: new RetailPortalView(mainContent, appState),
    rm_console: new RmConsoleView(mainContent, appState),
    policy_manager: new PolicyManagerView(mainContent, appState),
    underwriter: new UnderwriterQueueView(mainContent, appState),
    partner_api: new PartnerApiSandboxView(mainContent, appState),
    analytics: new AnalyticsDashboardView(mainContent, appState)
  };

  const switchView = (viewName) => {
    if (!views[viewName]) return;
    appState.activeView = viewName;

    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    views[viewName].render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Attach Persona Switcher Navigation
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchView(btn.dataset.view);
    });
  });

  // Dark / Light Theme Switcher
  const themeToggleBtn = document.getElementById('btn-theme-toggle');
  const savedTheme = localStorage.getItem('les_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('les_theme', next);
      themeToggleBtn.innerHTML = next === 'dark' ? '<i class="icon-sun"></i> Light Mode' : '<i class="icon-moon"></i> Dark Mode';
    });
  }

  // Initial view
  switchView('retail');
});
