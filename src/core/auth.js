/** Auth & RBAC — тренер / гравець / гість */
const AuthManager = {
  user: null,
  role: 'coach', // coach | player | guest
  linkedPlayerId: null,

  /** Єдиний тренер за замовчуванням */
  DEFAULT_COACHES: ['Serdiuk_Artem'],

  init() {
    try {
      this.user = this._readTelegramUser();
      this.validationSource = 'unsafe';
      this._ensureRbacDefaults();
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

  /**
   * Async: confirm identity via server HMAC validation of initData.
   * Call after TelegramManager.init(). Safe to call when API is not configured (keeps unsafe mode).
   */
  async validateWithServer() {
    try {
      if (typeof TelegramManager === 'undefined' || !TelegramManager.validateSession) {
        this.validationSource = 'local';
        return { ok: true, source: 'local' };
      }
      const res = await TelegramManager.validateSession();
      this.validationSource = res.source || 'error';
      if (res.ok && res.user && res.source === 'server') {
        this.user = {
          id: res.user.id,
          username: res.user.username || '',
          first_name: res.user.first_name || '',
          last_name: res.user.last_name || '',
          language_code: res.user.language_code || '',
          is_premium: !!res.user.is_premium,
          photo_url: res.user.photo_url || ''
        };
        this._resolveRole();
        this._applyUiRole();
        console.info('[Auth] server-validated', this.role, this.user.id, this.user.username || '');
      } else if (!res.ok && res.source === 'error' && res.error && res.error !== 'auth_api_not_configured') {
        // Hard fail only when server is configured but rejected the signature
        if (res.error === 'hash_mismatch' || res.error === 'auth_date_expired') {
          this.user = null;
          this.role = 'guest';
          this.linkedPlayerId = null;
          this._applyUiRole();
          console.warn('[Auth] validation rejected — guest mode', res.error);
        }
      }
      return res;
    } catch (e) {
      console.warn('[Auth] validateWithServer', e);
      return { ok: false, source: 'error', error: String(e && e.message || e) };
    }
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

  /** Нормалізація ніка: без @, lower-case */
  _normNick(v) {
    return String(v || '').trim().replace(/^@/, '').toLowerCase();
  },

  _ensureRbacDefaults() {
    try {
      const s = Store.get();
      if (!s) return;
      if (!s.settings) s.settings = {};
      if (!s.settings.rbac) s.settings.rbac = { coaches: [], playerLinks: {} };
      if (!s.settings.rbac.playerLinks) s.settings.rbac.playerLinks = {};

      // Тренер ЗАВЖДИ @Serdiuk_Artem (не плутати з @Artem_Serdyuk)
      let coaches = Array.isArray(s.settings.rbac.coaches) ? s.settings.rbac.coaches.map(String) : [];
      const hasCoach = coaches.some(c => this._normNick(c) === 'serdiuk_artem');
      if (!hasCoach) coaches = ['Serdiuk_Artem'].concat(coaches);
      // прибрати помилкові варіанти, що плутають з гравцем
      coaches = coaches.filter(c => {
        const n = this._normNick(c);
        return n && n !== 'artem_serdyuk' && n !== 'artem_serdiuk';
      });
      if (!coaches.length) coaches = ['Serdiuk_Artem'];
      s.settings.rbac.coaches = coaches;

      // Автоприв'язка гравців з анкет (telegramUsername / telegramId)
      (s.players || []).forEach(p => {
        const tg = this._normNick(p.telegramUsername);
        if (tg && tg !== 'serdiuk_artem') {
          s.settings.rbac.playerLinks['@' + tg] = p.id;
          s.settings.rbac.playerLinks[tg] = p.id;
        }
        if (p.telegramId) {
          s.settings.rbac.playerLinks[String(p.telegramId)] = p.id;
        }
      });
    } catch (_) {}
  },

  _resolveRole() {
    this.linkedPlayerId = null;
    // Поза Telegram (браузер / dev) — тренер
    if (!this.user) {
      this.role = 'coach';
      return;
    }

    const s = typeof Store !== 'undefined' && Store.get() ? Store.get() : null;
    const rbac = (s && s.settings && s.settings.rbac) || {};
    const coaches = Array.isArray(rbac.coaches) && rbac.coaches.length
      ? rbac.coaches
      : this.DEFAULT_COACHES;
    const playerLinks = rbac.playerLinks || {};

    const idStr = String(this.user.id);
    const uname = (this.user.username || '').toLowerCase().replace(/^@/, '');
    const unameAt = uname ? '@' + uname : '';

    let isCoach = coaches.some(c => {
      const v = this._normNick(c);
      return v === idStr || v === uname;
    });
    // @Artem_Serdyuk — гравець, ніколи тренер (не плутати з @Serdiuk_Artem)
    if (uname === 'artem_serdyuk') isCoach = false;

    if (isCoach) {
      this.role = 'coach';
      return;
    }

    // Гравець: link з rbac / telegramUsername / telegramId / ім'я
    let link =
      playerLinks[idStr] ||
      playerLinks[unameAt] ||
      playerLinks[uname] ||
      null;

    if (!link && s) {
      const players = s.players || [];
      // 1) telegramId
      let pl = players.find(p => p.telegramId && String(p.telegramId) === idStr);
      // 2) username
      if (!pl && uname) {
        pl = players.find(p =>
          (p.telegramUsername || '').replace(/^@/, '').toLowerCase() === uname
        );
      }
      // 3) first_name (унікальний збіг) — для акаунтів без @username
      if (!pl && this.user.first_name) {
        const fn = String(this.user.first_name).trim().toLowerCase();
        const hits = players.filter(p =>
          String(p.firstName || '').trim().toLowerCase() === fn ||
          String(p.lastName || '').trim().toLowerCase() === fn
        );
        if (hits.length === 1) pl = hits[0];
      }
      if (pl) link = pl.id;
    }

    if (link) {
      this.role = 'player';
      this.linkedPlayerId = link;
      // підтягнути photo_url з Telegram у картку
      try {
        const pl = (s.players || []).find(p => p.id === link);
        if (pl && this.user && this.user.photo_url) {
          pl.telegramPhotoUrl = this.user.photo_url;
        }
      } catch (_) {}
      return;
    }

    this.role = 'guest';
  },

  isCoach() { return this.role === 'coach'; },
  isPlayer() { return this.role === 'player'; },
  isGuest() { return this.role === 'guest'; },

  getLinkedPlayer() {
    if (!this.linkedPlayerId) return null;
    try {
      return (Store.get().players || []).find(p => p.id === this.linkedPlayerId) || null;
    } catch (_) {
      return null;
    }
  },

  /** Чи цей запис гравця — поточний акаунт (підсвітка «я») */
  isLinkedPlayer(p) {
    if (!p) return false;
    if (this.linkedPlayerId && p.id === this.linkedPlayerId) return true;
    return this.matchesPlayer(p);
  },
  matchesPlayer(p) {
    if (!p || !this.user) return false;
    try {
      if (p.telegramId && String(p.telegramId) === String(this.user.id)) return true;
      const uname = this._normNick(this.user.username);
      const pug = this._normNick(p.telegramUsername);
      if (uname && pug && uname === pug) return true;
    } catch (_) {}
    return false;
  },

  can(action) {
    if (this.role === 'coach') return true;

    const guestOk = {
      'view-dashboard': true,
      'view-calendar': true,
      'view-matches': true,
      'view-players': true,
      'view-trainings': false,
      'view-analytics': false,
      'view-board': false,
      'view-diary': false,
      'view-settings': true,
      'edit-board': false,
      'edit-players': false,
      'edit-trainings': false,
      'edit-exercises': false,
      'import': true,
      'export': false,
      'import-export': false,
      'reset-data': false,
      'apply-scheme': false
    };

    const playerOk = {
      'view-dashboard': true,
      'view-calendar': true,
      'view-trainings': true,
      'view-players': true,
      'view-matches': true,
      'view-diary': true,
      'view-settings': true,
      'view-analytics': true,
      'view-board': true,
      'edit-board': false,
      'edit-players': false,
      'edit-trainings': false,
      'edit-exercises': false,
      'import': true,
      'export': false,
      'import-export': false,
      'reset-data': false,
      'apply-scheme': false
    };

    const map = this.role === 'guest' ? guestOk : playerOk;
    return map[action] !== false && map[action] !== undefined ? map[action] : false;
  },

  displayName() {
    if (!this.user) return 'Локальний режим (тренер)';
    const n = [this.user.first_name, this.user.last_name].filter(Boolean).join(' ');
    return n || (this.user.username ? '@' + this.user.username : 'ID ' + this.user.id);
  },

  roleLabel() {
    const r = this.role || 'guest';
    if (typeof I18n !== 'undefined' && I18n.t) {
      if (r === 'coach') return I18n.t('role_coach', 'Тренер');
      if (r === 'player') return I18n.t('role_player', 'Гравець');
      return I18n.t('role_guest', 'Гість');
    }
    if (r === 'coach') return 'Тренер';
    if (r === 'player') return 'Гравець';
    return 'Гість';
  },

  _applyUiRole() {
    try {
      document.body.classList.remove('role-coach', 'role-player', 'role-guest');
      document.body.classList.add('role-' + this.role);
      const el = document.getElementById('authBadge');
      if (el) {
        const name = typeof sanitize === 'function' ? sanitize(this.displayName()) : this.displayName();
        el.innerHTML = '<span class="auth-role">' + this.roleLabel() + '</span>: ' + name;
        el.title = this.user ? ('Telegram ID: ' + this.user.id) : 'Без Telegram — режим тренера';
      }
    } catch (_) {}
  },

  setCoaches(list) {
    const s = Store.get();
    if (!s.settings.rbac) s.settings.rbac = { coaches: [], playerLinks: {} };
    s.settings.rbac.coaches = (list || []).map(String);
    this._resolveRole();
    this._applyUiRole();
    if (typeof StorageManager !== 'undefined') StorageManager.save();
  },

  /** Викликати після імпорту JSON — оновити ролі за новими анкетами */
  afterDataImport() {
    this._ensureRbacDefaults();
    this._resolveRole();
    this._applyUiRole();
    try {
      if (typeof StorageManager !== 'undefined') StorageManager.save();
    } catch (_) {}
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
