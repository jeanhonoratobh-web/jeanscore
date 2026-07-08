// =============================================
// JEANSCORE – AUTENTICAÇÃO
// =============================================

const AUTH = {
  currentUser: null,

  // Hash simples (para produção use bcrypt via Apps Script)
  async hash(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  },

  // Inicializa sessão do localStorage
  init() {
    const saved = localStorage.getItem('js_session');
    if (saved) {
      try {
        this.currentUser = JSON.parse(saved);
      } catch {
        this.currentUser = null;
      }
    }

    // Garante que admin existe no armazenamento local
    this._ensureAdmin();
    this._updateUI();
  },

  _ensureAdmin() {
    const users = SHEETS.local.getUsers();
    const adminExists = users.find(u => u.username === CONFIG.ADMIN_USER);
    if (!adminExists) {
      // Senha padrão do admin: "jean2025" — troque após primeiro login
      this.hash('jean2025').then(h => {
        users.push({
          username: CONFIG.ADMIN_USER,
          email:    CONFIG.ADMIN_EMAIL,
          passHash: h,
          role:     'admin',
          status:   'approved',
          createdAt: new Date().toISOString(),
        });
        SHEETS.local.saveUsers(users);
      });
    }
  },

  // Login
  async login(username, password) {
    const hash = await this.hash(password);

    if (isSheetsConfigured()) {
      const res = await SHEETS.loginUser(username, hash);
      if (!res.ok) return { ok: false, error: res.error || 'Credenciais inválidas' };
      this.currentUser = res.user;
    } else {
      const users = SHEETS.local.getUsers();
      const user = users.find(u => u.username === username && u.passHash === hash);
      if (!user) return { ok: false, error: 'Usuário ou senha incorretos' };
      if (user.status === 'pending') return { ok: false, error: 'Seu cadastro ainda não foi aprovado pelo admin' };
      if (user.status === 'rejected') return { ok: false, error: 'Seu cadastro foi recusado' };
      this.currentUser = { username: user.username, email: user.email, role: user.role };
    }

    localStorage.setItem('js_session', JSON.stringify(this.currentUser));
    this._updateUI();
    return { ok: true };
  },

  // Cadastro
  async register(username, email, password) {
    // Validações
    if (username.length < 3) return { ok: false, error: 'Nome de usuário muito curto (mín. 3 caracteres)' };
    if (password.length < 6) return { ok: false, error: 'Senha muito curta (mín. 6 caracteres)' };

    const hash = await this.hash(password);

    if (isSheetsConfigured()) {
      return await SHEETS.registerUser(username, email, hash);
    } else {
      const users = SHEETS.local.getUsers();
      if (users.find(u => u.username === username)) return { ok: false, error: 'Nome de usuário já existe' };
      if (users.find(u => u.email === email))       return { ok: false, error: 'E-mail já cadastrado' };

      users.push({
        username,
        email,
        passHash: hash,
        role:     'user',
        status:   'pending',
        createdAt: new Date().toISOString(),
      });
      SHEETS.local.saveUsers(users);
      return { ok: true, message: 'Cadastro solicitado! Aguarde a aprovação do admin.' };
    }
  },

  // Logout
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

  // Atualiza header
  _updateUI() {
    const authArea  = document.getElementById('authArea');
    const userArea  = document.getElementById('userArea');
    const userGreeting = document.getElementById('userGreeting');
    const navAvaliar = document.getElementById('navAvaliar');
    const navAdmin   = document.getElementById('navAdmin');

    if (this.currentUser) {
      authArea.style.display  = 'none';
      userArea.style.display  = 'flex';
      userGreeting.textContent = `Olá, ${this.currentUser.username}`;
      navAvaliar.style.display = 'inline-flex';
      navAdmin.style.display   = this.isAdmin() ? 'inline-flex' : 'none';
    } else {
      authArea.style.display  = 'flex';
      userArea.style.display  = 'none';
      navAvaliar.style.display = 'none';
      navAdmin.style.display   = 'none';
    }
  },
};
