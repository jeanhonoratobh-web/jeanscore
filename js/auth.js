// =============================================
// JEANSCORE – AUTH (Supabase backend)
// =============================================

const AUTH = {
  currentUser: null,

  async hash(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  },

  init() {
    const saved = localStorage.getItem('js_session');
    if (saved) {
      try { this.currentUser = JSON.parse(saved); }
      catch { this.currentUser = null; }
    }
    this._updateUI();
  },

  async login(username, password) {
    const passHash = await this.hash(password);
    const r = await SUPA.loginUser(username, passHash);
    if (!r.ok) return { ok: false, error: r.error || 'Credenciais inválidas' };
    this.currentUser = r.user;
    localStorage.setItem('js_session', JSON.stringify(this.currentUser));
    this._updateUI();
    return { ok: true };
  },

  async register(username, email, password) {
    if (username.length < 3) return { ok: false, error: 'Nome de usuário muito curto (mín. 3 caracteres)' };
    if (password.length < 6) return { ok: false, error: 'Senha muito curta (mín. 6 caracteres)' };
    const passHash = await this.hash(password);
    return await SUPA.registerUser(username, email, passHash);
  },

  logout() {
    this.currentUser = null;
    localStorage.removeItem('js_session');
    this._updateUI();
    APP.navigate('elenco');
    showToast('Até logo!');
  },

  isLoggedIn()  { return !!this.currentUser; },
  isAdmin()     { return this.currentUser?.role === 'admin'; },
  getUsername() { return this.currentUser?.username || null; },

  _updateUI() {
    const authArea     = document.getElementById('authArea');
    const userArea     = document.getElementById('userArea');
    const userGreeting = document.getElementById('userGreeting');
    const navAvaliar   = document.getElementById('navAvaliar');
    const navAdmin     = document.getElementById('navAdmin');

    if (this.currentUser) {
      authArea.style.display   = 'none';
      userArea.style.display   = 'flex';
      userGreeting.textContent = `Olá, ${this.currentUser.username}`;
      navAvaliar.style.display = 'inline-flex';
      navAdmin.style.display   = this.isAdmin() ? 'inline-flex' : 'none';
    } else {
      authArea.style.display   = 'flex';
      userArea.style.display   = 'none';
      navAvaliar.style.display = 'none';
      navAdmin.style.display   = 'none';
    }
  },
};
