async function requestJson(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || 'Request failed. Please try again.');
    error.status = response.status;
    throw error;
  }
  return payload;
}

export class AuthController {
  constructor(appState) {
    this.appState = appState;
    this.root = document.getElementById('auth-controls');
    this.modalRoot = document.getElementById('auth-modal-root');
  }

  async init() {
    const token = new URLSearchParams(window.location.search).get('verify');
    if (token) {
      try {
        const result = await requestJson('/api/v1/auth/verify-email', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token })
        });
        this.appState.currentUser = result.user;
        this.appState.showToast('Your email is verified. You are now signed in.', 'success');
      } catch (error) {
        this.appState.showToast(error.message, 'warning');
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    await this.refresh();
  }

  async refresh() {
    try {
      const result = await requestJson('/api/v1/auth/me');
      this.appState.currentUser = result.user;
    } catch {
      this.appState.currentUser = null;
    }
    this.render();
  }

  render() {
    if (!this.root) return;
    const user = this.appState.currentUser;
    this.root.innerHTML = user
      ? `<span class="text-xs" title="Signed in">${user.email}</span><button class="btn btn-xs btn-outline" id="btn-logout">Sign out</button>`
      : '<button class="btn btn-xs btn-gold" id="btn-auth">Sign in / Register</button>';
    this.root.querySelector('#btn-auth')?.addEventListener('click', () => this.open());
    this.root.querySelector('#btn-logout')?.addEventListener('click', () => this.signOut());
  }

  open() {
    if (!this.modalRoot) return;
    this.modalRoot.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-dialog">
          <div class="modal-header-bar"><strong id="auth-title">Sign in</strong><button class="btn btn-xs btn-outline" id="auth-close">&times;</button></div>
          <form id="auth-form" class="modal-body-content">
            <p class="text-sm text-muted" id="auth-help">Sign in to save your enquiry and receive automatic email updates.</p>
            <div class="form-field"><label class="field-label" for="auth-email">Email address</label><input class="field-input" id="auth-email" type="email" required autocomplete="email"></div>
            <div class="form-field mt-3"><label class="field-label" for="auth-password">Password</label><input class="field-input" id="auth-password" type="password" minlength="10" required autocomplete="current-password"><span class="field-hint" id="password-hint">Use at least 10 characters.</span></div>
            <p class="text-sm" id="auth-message" role="alert" style="min-height:1.2rem; color:var(--danger);"></p>
            <button class="btn btn-success" style="width:100%" id="auth-submit">Sign in</button>
          </form>
          <div class="modal-footer-bar" style="justify-content:space-between"><button class="btn btn-xs btn-outline" id="auth-toggle">Create an account</button><button class="btn btn-xs btn-outline" id="auth-resend">Resend verification</button></div>
        </div>
      </div>`;
    let mode = 'login';
    const form = this.modalRoot.querySelector('#auth-form');
    const message = this.modalRoot.querySelector('#auth-message');
    const setMode = (next) => {
      mode = next;
      this.modalRoot.querySelector('#auth-title').textContent = mode === 'login' ? 'Sign in' : 'Create your account';
      this.modalRoot.querySelector('#auth-help').textContent = mode === 'login' ? 'Sign in to save your enquiry and receive automatic email updates.' : 'We will send a verification link to this email address.';
      this.modalRoot.querySelector('#auth-submit').textContent = mode === 'login' ? 'Sign in' : 'Create account';
      this.modalRoot.querySelector('#auth-toggle').textContent = mode === 'login' ? 'Create an account' : 'I already have an account';
      this.modalRoot.querySelector('#password-hint').textContent = mode === 'login' ? '' : 'Use at least 10 characters.';
      this.modalRoot.querySelector('#auth-password').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
      message.textContent = '';
    };
    this.modalRoot.querySelector('#auth-close').addEventListener('click', () => { this.modalRoot.innerHTML = ''; });
    this.modalRoot.querySelector('#auth-toggle').addEventListener('click', () => setMode(mode === 'login' ? 'register' : 'login'));
    this.modalRoot.querySelector('#auth-resend').addEventListener('click', async () => {
      const email = this.modalRoot.querySelector('#auth-email').value;
      try {
        const result = await requestJson('/api/v1/auth/resend-verification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
        message.style.color = 'var(--success)'; message.textContent = result.message;
      } catch (error) { message.style.color = 'var(--danger)'; message.textContent = error.message; }
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = this.modalRoot.querySelector('#auth-email').value;
      const password = this.modalRoot.querySelector('#auth-password').value;
      try {
        const result = await requestJson(`/api/v1/auth/${mode === 'login' ? 'login' : 'register'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
        if (mode === 'register') {
          message.style.color = 'var(--success)'; message.textContent = result.message;
          return;
        }
        this.appState.currentUser = result.user;
        this.modalRoot.innerHTML = '';
        this.render();
        this.appState.showToast('Signed in successfully.', 'success');
      } catch (error) { message.style.color = 'var(--danger)'; message.textContent = error.message; }
    });
  }

  async signOut() {
    await requestJson('/api/v1/auth/logout', { method: 'POST' });
    this.appState.currentUser = null;
    this.render();
    this.appState.showToast('You have signed out.', 'info');
  }
}
