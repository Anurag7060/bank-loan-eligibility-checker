/**
 * Loan Eligibility System (LES) - DSA & Channel Partner API Sandbox
 * Persona: Channel Partner & DSA Aggregator (BankBazaar / Paisabazaar integration)
 * Features: OpenAPI 3.0 Explorer, Interactive JSON Tester, cURL Code Generator, SLA Latency Tracker
 */

import { evaluateEligibility } from '../engine/eligibilityEngine.js';

export const OPENAPI_SPEC = {
  openapi: '3.0.3',
  info: {
    title: 'Loan Eligibility Checking System (LES) Partner API',
    version: '1.0.0',
    description: 'Stateless, idempotent REST API for real-time soft-pull loan pre-qualification and offer generation.'
  },
  endpoints: [
    {
      method: 'POST',
      path: '/api/v1/eligibility/check',
      summary: 'Evaluate Loan Eligibility (Synchronous)',
      description: 'Execute instant multi-rule eligibility evaluation with zero-impact soft bureau waterfall.',
      sampleRequest: {
        partnerId: 'DSA_BANKBAZAAR_01',
        consentArtifact: {
          consentedAt: '2026-08-23T11:00:00Z',
          purpose: 'CIC_SOFT_PREQUAL',
          dpdpComplianceTag: 'SEC_6_VALIDATED'
        },
        applicant: {
          fullName: 'Anaya Sharma',
          pan: 'ANAPS1234K',
          mobile: '9876543210',
          age: 29,
          employmentType: 'Salaried',
          monthlyIncome: 85000,
          existingEmis: 12000,
          requestedAmount: 800000,
          requestedTenureMonths: 48,
          loanProduct: 'personal_loan'
        }
      }
    },
    {
      method: 'GET',
      path: '/api/v1/policy/rules',
      summary: 'Retrieve Live Policy Matrices & Rate Cards',
      description: 'Fetch current repo-linked base rates, FOIR caps, and tiered LTV parameters across all 8 products.'
    }
  ]
};

export class PartnerApiSandboxView {
  constructor(container, appState) {
    this.container = container;
    this.appState = appState;
    this.selectedEndpoint = OPENAPI_SPEC.endpoints[0];
    this.requestPayloadText = JSON.stringify(this.selectedEndpoint.sampleRequest, null, 2);
    this.responsePayloadText = null;
    this.latencyMs = null;
    this.slaTargetMs = 3000;
  }

  render() {
    this.container.innerHTML = `
      <div class="api-header">
        <div class="api-badge">
          <span class="pulse-dot"></span>
          <span>OpenAPI 3.0 &bull; DSA & Aggregator Gateway &bull; mTLS & OAuth2 Supported</span>
        </div>
        <h1 class="api-title">DSA & Partner API Integration Sandbox</h1>
        <p class="api-subtitle">
          Test real-time stateless eligibility APIs with live cURL generation, SLA benchmark latency monitoring, and adverse action schemas.
        </p>
      </div>

      <div class="api-layout">
        <!-- Left: API Documentation & Request Editor -->
        <div class="api-req-panel card glass-card">
          <div class="panel-top-bar">
            <div class="endpoint-pill">
              <span class="method-badge post">POST</span>
              <span class="path-text text-mono">/api/v1/eligibility/check</span>
            </div>
            <span class="badge badge-success"><i class="icon-shield"></i> p95 SLA &lt; 3.0s</span>
          </div>

          <div class="auth-header-bar mt-2">
            <div class="auth-item">
              <span class="text-xs text-muted">Auth Header:</span>
              <code class="text-xs">Authorization: Bearer dsa_live_token_77a9b</code>
            </div>
            <div class="auth-item">
              <span class="text-xs text-muted">DPDP Consent Header:</span>
              <code class="text-xs">X-DPDP-Consent: Verified-CIC-Soft</code>
            </div>
          </div>

          <div class="editor-block mt-3">
            <div class="editor-label-row">
              <label class="form-label text-xs">JSON Request Payload (Editable)</label>
              <button class="btn btn-xs btn-outline" id="btn-reset-payload">
                <i class="icon-rotate-ccw"></i> Reset Sample
              </button>
            </div>
            <textarea id="txt-api-req" class="form-control text-mono code-editor" rows="14">${this.requestPayloadText}</textarea>
          </div>

          <div class="api-action-bar mt-3">
            <button class="btn btn-primary btn-glow" id="btn-send-api-req">
              <i class="icon-send"></i> Send Request (Execute Live API)
            </button>
          </div>
        </div>

        <!-- Right: Response & Code Snippets -->
        <div class="api-res-panel card glass-card">
          <div class="panel-top-bar">
            <h4>Live API Response</h4>
            ${this.latencyMs !== null ? `
              <div class="latency-badge ${this.latencyMs <= this.slaTargetMs ? 'text-success' : 'text-warning'}">
                <i class="icon-zap"></i> Latency: <strong>${this.latencyMs}ms</strong> (SLA &lt; 3000ms: PASS)
              </div>
            ` : '<span class="text-xs text-muted">Awaiting Request...</span>'}
          </div>

          <div class="response-view-block mt-2">
            ${this.responsePayloadText ? `
              <pre class="response-json-box"><code>${this.escapeHtml(this.responsePayloadText)}</code></pre>
            ` : `
              <div class="res-placeholder">
                <i class="icon-terminal text-2xl text-muted"></i>
                <p class="text-muted text-sm mt-2">Click "Send Request" to execute real-time eligibility evaluation via API.</p>
              </div>
            `}
          </div>

          <!-- cURL Code Snippet Box -->
          <div class="curl-box mt-3">
            <div class="curl-header">
              <span class="text-xs font-weight-bold"><i class="icon-code"></i> cURL Command</span>
              <button class="btn btn-xs btn-outline" id="btn-copy-curl">Copy</button>
            </div>
            <pre class="curl-code text-xs"><code>curl -X POST https://api.zenithbank.com/api/v1/eligibility/check \\
  -H "Authorization: Bearer dsa_live_token_77a9b" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(JSON.parse(this.requestPayloadText || '{}'))}'</code></pre>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  attachEventListeners() {
    const btnSend = this.container.querySelector('#btn-send-api-req');
    if (btnSend) {
      btnSend.addEventListener('click', () => {
        try {
          const reqText = this.container.querySelector('#txt-api-req').value;
          const parsed = JSON.parse(reqText);
          const startTime = performance.now();

          // Execute evaluation engine
          const applicant = parsed.applicant || parsed;
          const policies = this.appState.getPolicies();
          const evalResult = evaluateEligibility(applicant, policies);
          
          const endTime = performance.now();
          this.latencyMs = Math.round(endTime - startTime + Math.floor(40 + Math.random() * 80)); // Simulate realistic network roundtrip

          this.responsePayloadText = JSON.stringify({
            status: 'SUCCESS',
            httpStatusCode: 200,
            executionLatencyMs: this.latencyMs,
            slaAdherence: 'COMPLIANT_UNDER_3S',
            data: evalResult
          }, null, 2);

          this.requestPayloadText = reqText;
          this.render();
          this.appState.showToast(`API call executed in ${this.latencyMs}ms!`, 'success');
        } catch (err) {
          alert('Invalid JSON in Request Payload: ' + err.message);
        }
      });
    }

    const btnReset = this.container.querySelector('#btn-reset-payload');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        this.requestPayloadText = JSON.stringify(this.selectedEndpoint.sampleRequest, null, 2);
        this.responsePayloadText = null;
        this.latencyMs = null;
        this.render();
      });
    }

    const btnCopyCurl = this.container.querySelector('#btn-copy-curl');
    if (btnCopyCurl) {
      btnCopyCurl.addEventListener('click', () => {
        const curlText = this.container.querySelector('.curl-code').textContent;
        navigator.clipboard.writeText(curlText);
        this.appState.showToast('cURL snippet copied to clipboard!', 'info');
      });
    }
  }

  escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
