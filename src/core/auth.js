/** Auth & RBAC foundation — Telegram ID / username */
const AuthManager = {
  user: null, // { id, username, first_name, last_name, language_code, is_premium }
  role: 'coach', // 'coach' | 'player' | 'guest'
  linkedPlayerId: null,

  init() {
    try {
      this.user = this._readTelegramUser();
      this._resolveRole();
      this._applyUiRole();
      if (this.user) {
        console.info('[Auth]', this.role, this.user.id, this.user.username || '');
      }
    } catch (e) {
      console.warn('[Auth] init', e);
      this.role = 'coach';
    }
    return this;
  },

  _readTelegramUser() {
    try {
      const tg = window.Telegram && window.Telegram.WebApp;
      if (!tg) return null;
      const u = (tg.initDataUnsafe && tg.initDataUnsafe.user) || null;
      if (!u || !u.id) return null;
      return {
        id: u.id,
        username: u.username || '',
        first_name: u.first_name || '',
        last_name: u.last_name || '',
        language_code: u.language_code || '',
        is_premium: !!u.is_premium,
        photo_url: u.photo_url || ''
      };
    } catch (_) {
      return null;
    }
  },

  _resolveRole() {
    const s = typeof Store !== 'undefined' && Store.get() ? Store.get() : null;
    const settings = (s && s.settings) || {};
    const rbac = settings.rbac || {};
    // coaches: array of telegram user ids (number|string) or @usernames
    const coaches = Array.isArray(rbac.coaches) ? rbac.coaches : [];
    const playerLinks = rbac.playerLinks || {}; // { "123456": "p01", "@nick": "p02" }

    // Поза Telegram — повний доступ тренера (локальна робота)
    if (!this.user) {
      this.role = 'coach';
      this.linkedPlayerId = null;
      return;
    }

    const idStr = String(this.user.id);
    const uname = (this.user.username || '').toLowerCase();
    const unameAt = uname ? '@' + uname : '';

    const isCoach =
      coaches.length === 0 || // порожній список = усі в TG з повним доступом (bootstrap)
      coaches.some(c => {
        const v = String(c).toLowerCase().replace(/^@/, '');
        return v === idStr || v === uname || ('@' + v) === unameAt;
      });

    if (isCoach) {
      this.role = 'coach';
      this.linkedPlayerId = null;
      return;
    }

    // Гравець — за прив'язкою
    const link =
      playerLinks[idStr] ||
      playerLinks[unameAt] ||
      playerLinks[uname] ||
      null;
    this.role = 'player';
    this.linkedPlayerId = link;
  },

  isCoach() { return this.role === 'coach'; },
  isPlayer() { return this.role === 'player'; },

  /** Перевірка права на дію */
  can(action) {
    if (this.role === 'coach' || this.role === 'guest') return true;
    // player permissions
    const playerOk = {
      'view-dashboard': true,
      'view-calendar': true,
      'view-trainings': true,
      'view-players': true,
      'view-matches': true,
      'view-diary': true,
      'view-settings': true,
      'view-analytics': false,
      'view-board': true, // перегляд
      'edit-board': false,
      'edit-players': false,
      'edit-trainings': false,
      'edit-exercises': false,
      'import-export': false,
      'reset-data': false,
      'apply-scheme': false
    };
    return playerOk[action] !== false;
  },

  displayName() {
    if (!this.user) return 'Локальний режим';
    const n = [this.user.first_name, this.user.last_name].filter(Boolean).join(' ');
    return n || (this.user.username ? '@' + this.user.username : 'ID ' + this.user.id);
  },

  roleLabel() {
    if (this.role === 'coach') return 'Тренер';
    if (this.role === 'player') return 'Гравець';
    return 'Гість';
  },

  _applyUiRole() {
    try {
      document.body.classList.toggle('role-coach', this.isCoach());
      document.body.classList.toggle('role-player', this.isPlayer());
      const el = document.getElementById('authBadge');
      if (el) {
        el.innerHTML = '<span class="auth-role">' + this.roleLabel() + '</span> · ' +
          '<span class="auth-name">' + (typeof sanitize === 'function' ? sanitize(this.displayName()) : this.displayName()) + '</span>';
        el.title = this.user ? ('Telegram ID: ' + this.user.id) : 'Без Telegram';
      }
    } catch (_) {}
  },

  /** Зберегти список тренерів у settings.rbac.coaches */
  setCoaches(list) {
    const s = Store.get();
    if (!s.settings.rbac) s.settings.rbac = { coaches: [], playerLinks: {} };
    s.settings.rbac.coaches = (list || []).map(String);
    this._resolveRole();
    this._applyUiRole();
    if (typeof StorageManager !== 'undefined') StorageManager.save();
  },

  linkPlayer(telegramKey, playerId) {
    const s = Store.get();
    if (!s.settings.rbac) s.settings.rbac = { coaches: [], playerLinks: {} };
    s.settings.rbac.playerLinks[String(telegramKey)] = playerId;
    this._resolveRole();
    this._applyUiRole();
    if (typeof StorageManager !== 'undefined') StorageManager.save();
  }
};
