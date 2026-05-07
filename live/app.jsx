// 真實系統的 App 流程控制 + 串接後端 API

const api = (action, params) => window.BCC_API.api(action, params);

// 老師 API 的身分參數:優先用 session(老師登入後),沒有才退到 TEACHER_KEY(備用)
window.BCC_API.teacherAuth = function () {
  const s = window.BCC_API.getSession();
  if (s) return { session: s };
  const k = window.BCC_API.getTeacherKey();
  if (k) return { teacherKey: k };
  return {};
};

// ─── 應用主框架(管理視圖切換)──────────────────────────
function LiveApp() {
  // view: 'login' | 'forgot' | 'reset' | 'setup' | 'student' | 'teacher'
  const [view, setView] = React.useState(() => {
    // 開啟時若帶 #reset=... 直接進重設密碼頁
    const hash = window.location.hash || '';
    if (hash.startsWith('#reset=')) return 'reset';
    return 'login';
  });
  const [profile, setProfile] = React.useState(null);
  const [toast, setToast] = React.useState(null);

  // 開啟時若已有 session,問後端當前用戶是老師還是學生
  React.useEffect(() => {
    const hash = window.location.hash || '';
    if (hash.startsWith('#reset=')) return;
    if (!window.BCC_API.getSession()) return;
    (async () => {
      const r = await api('me', { session: window.BCC_API.getSession() });
      if (r.ok) {
        setProfile(r.profile);
        // 若還沒完成首次設定 → 強制導到 setup,無法繞過
        if (r.profile.mustChangePassword) {
          setView('setup');
        } else {
          setView(r.profile.role === 'teacher' ? 'teacher' : 'student');
        }
      } else {
        window.BCC_API.setSession(null);
      }
    })();
  }, []);

  // ── Idle 自動登出 ──
  // 30 分鐘無操作自動登出,最後 1 分鐘彈警告
  const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
  const WARN_BEFORE_MS = 60 * 1000;
  const [idleWarn, setIdleWarn] = React.useState(false);
  const idleTimerRef = React.useRef(null);
  const warnTimerRef = React.useRef(null);

  const resetIdleTimer = React.useCallback(() => {
    setIdleWarn(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
    if (!window.BCC_API.getSession()) return;
    warnTimerRef.current = setTimeout(() => setIdleWarn(true), IDLE_TIMEOUT_MS - WARN_BEFORE_MS);
    idleTimerRef.current = setTimeout(() => {
      window.BCC_API.setSession(null);
      setProfile(null);
      setIdleWarn(false);
      setView('login');
      setToast({ msg: '閒置過久,已自動登出', kind: 'warn' });
      setTimeout(() => setToast(null), 4000);
    }, IDLE_TIMEOUT_MS);
  }, []);

  React.useEffect(() => {
    if (view === 'login' || view === 'forgot' || view === 'reset') {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
      return;
    }
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    const handler = () => resetIdleTimer();
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    resetIdleTimer();
    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
    };
  }, [view, resetIdleTimer]);

  const showToast = (msg, kind = 'info') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3500);
  };

  const handleLoginSuccess = (result) => {
    window.BCC_API.setSession(result.session);
    setProfile(result.profile);
    if (result.mustChangePassword) setView('setup');
    else setView(result.role === 'teacher' ? 'teacher' : 'student');
  };

  const handleLogout = () => {
    window.BCC_API.setSession(null);
    setProfile(null);
    setView('login');
  };

  const goTeacher = () => {
    // 備用入口:用 TEACHER_KEY 直接進後台(忘記老師帳號密碼時的應急)
    if (!window.BCC_API.getTeacherKey()) {
      const k = prompt('輸入老師金鑰進入備用後台(忘記老師帳號密碼時使用):');
      if (!k) return;
      window.BCC_API.setTeacherKey(k);
    }
    setView('teacher');
  };

  // 首次設定完成後,依 role 走到對的頁面
  const handleSetupDone = () => {
    setView(profile && profile.role === 'teacher' ? 'teacher' : 'student');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', display: 'flex', flexDirection: 'column' }}>
      {view === 'login'   && <LiveLogin    onSuccess={handleLoginSuccess} onForgot={() => setView('forgot')} onTeacher={goTeacher} toast={showToast} />}
      {view === 'forgot'  && <LiveForgot   onBack={() => setView('login')} toast={showToast} />}
      {view === 'reset'   && <LiveReset    onDone={() => setView('login')} toast={showToast} />}
      {view === 'setup'   && <LiveSetup    onDone={handleSetupDone} toast={showToast} />}
      {view === 'student' && <LiveStudent  profile={profile} onLogout={handleLogout} toast={showToast} />}
      {view === 'teacher' && <LiveTeacher  onLogout={handleLogout} toast={showToast} />}

      {idleWarn && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 10000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div className="card" style={{ width: 360, padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⏰</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 6 }}>
              閒置即將自動登出
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-600)', marginBottom: 18 }}>
              您已超過 29 分鐘沒有操作,1 分鐘後將自動登出。
            </div>
            <button className="btn-primary" style={{ width: '100%' }} onClick={() => resetIdleTimer()}>
              繼續使用
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          background: toast.kind === 'error' ? '#dc2626' : (toast.kind === 'ok' ? '#059669' : '#1f2937'),
          color: 'white', padding: '10px 20px', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,.2)', zIndex: 9999, fontSize: 14, fontWeight: 500,
        }}>{toast.msg}</div>
      )}
    </div>
  );
}

// ─── 登入頁 ─────────────────────────────────────────────
function LiveLogin({ onSuccess, onForgot, onTeacher, toast }) {
  const [studentId, setStudentId] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [showPw, setShowPw] = React.useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!studentId || !password) return toast('請輸入學號與密碼', 'error');
    setBusy(true);
    const r = await api('login', { studentId: studentId.trim(), password });
    setBusy(false);
    if (r.ok) onSuccess(r);
    else if (r.error === 'invalid_credentials') toast('學號或密碼錯誤', 'error');
    else if (r.error === 'account_disabled') toast('此帳號已停用,請聯絡老師', 'error');
    else if (r.error === 'no_api_url') toast('請先設定 API URL', 'error');
    else toast('登入失敗:' + (r.error || ''), 'error');
  }

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <BrandMark />
          <div style={{ fontSize: 12, color: 'var(--ink-500)', letterSpacing: 1, marginTop: 12, fontFamily: 'var(--font-mono)' }}>
            BCC · 2026 SPRING
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink-900)', marginTop: 4, letterSpacing: -0.3 }}>
            資訊科技課程作業系統
          </div>
        </div>

        <form onSubmit={submit} className="card" style={{ padding: 28 }}>
          <Field label="學號">
            <input className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)}
              placeholder="例如 11012001" autoFocus inputMode="numeric"
              style={{ fontFamily: 'var(--font-mono)' }} />
          </Field>
          <Field label="密碼">
            <div style={{ position: 'relative' }}>
              <input className="input" type={showPw ? 'text' : 'password'}
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="首次登入請使用預設密碼" style={{ paddingRight: 36 }} />
              <button type="button" onClick={() => setShowPw(!showPw)}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-500)',
                  padding: 4, display: 'flex' }}>
                {showPw ? <IconEyeOff size={16} /> : <IconEye size={16} />}
              </button>
            </div>
          </Field>
          <button type="submit" disabled={busy}
            className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}>
            {busy ? '登入中…' : '登入'}
          </button>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, fontSize: 12 }}>
            <button type="button" onClick={onForgot}
              style={{ background: 'transparent', border: 'none', color: 'var(--brand-600)', cursor: 'pointer', padding: 0 }}>
              忘記密碼?
            </button>
            <button type="button" onClick={onTeacher} title="忘記老師帳號密碼時,可用老師金鑰進入備用後台"
              style={{ background: 'transparent', border: 'none', color: 'var(--ink-500)', cursor: 'pointer', padding: 0, fontSize: 11 }}>
              老師金鑰備用入口 ·
            </button>
          </div>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'var(--ink-500)' }}>
          首次登入請使用預設密碼:<code>00000000</code>
        </div>
      </div>
    </div>
  );
}

// ─── 忘記密碼 ────────────────────────────────────────────
function LiveForgot({ onBack, toast }) {
  const [studentId, setStudentId] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [masked, setMasked] = React.useState('');

  async function submit(e) {
    e.preventDefault();
    if (!studentId) return toast('請輸入學號', 'error');
    setBusy(true);
    const r = await api('requestReset', { studentId: studentId.trim() });
    setBusy(false);
    if (r.ok) {
      setSent(true);
      setMasked(r.masked || '');
      if (!r.sent) toast('若該學號有綁定 Email,信件已寄出', 'info');
    } else {
      toast('請求失敗', 'error');
    }
  }

  if (sent) return (
    <CenterCard>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 44 }}>📧</div>
        <h2 style={{ margin: '12px 0 8px', fontSize: 22, color: 'var(--ink-900)' }}>已寄出重設信</h2>
        <p style={{ color: 'var(--ink-500)', fontSize: 14, lineHeight: 1.6 }}>
          若該學號有綁定 Email,我們已寄出重設連結到{masked && <strong> {masked}</strong>}<br />
          請在 30 分鐘內點擊信件中的連結。
        </p>
        <button onClick={onBack} className="btn btn-primary" style={{ marginTop: 16, width: '100%' }}>返回登入</button>
      </div>
    </CenterCard>
  );

  return (
    <CenterCard>
      <h2 style={{ margin: 0, fontSize: 22, color: 'var(--ink-900)' }}>忘記密碼</h2>
      <p style={{ color: 'var(--ink-500)', fontSize: 13, marginTop: 6, marginBottom: 20 }}>
        輸入您的學號,系統會寄重設連結到您之前設定的 Email。若您還沒設定 Email,請聯絡老師協助重設。
      </p>
      <form onSubmit={submit}>
        <Field label="學號">
          <input className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)}
            placeholder="例如 11012001" autoFocus style={{ fontFamily: 'var(--font-mono)' }} />
        </Field>
        <button type="submit" disabled={busy} className="btn btn-primary" style={{ width: '100%', marginTop: 4 }}>
          {busy ? '寄送中…' : '寄送重設信'}
        </button>
        <button type="button" onClick={onBack} className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }}>
          返回登入
        </button>
      </form>
    </CenterCard>
  );
}

// ─── 用 Token 重設密碼(從 Email 連結進來)────────────────
function LiveReset({ onDone, toast }) {
  const hash = window.location.hash || '';
  const token = hash.startsWith('#reset=') ? hash.slice(7) : '';
  const [pw, setPw] = React.useState('');
  const [pw2, setPw2] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  async function submit(e) {
    e.preventDefault();
    if (pw !== pw2) return toast('兩次密碼不一致', 'error');
    if (pw.length < 8 || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw))
      return toast('密碼至少 8 字元,需含大寫與數字', 'error');
    setBusy(true);
    const r = await api('resetWithToken', { token, newPassword: pw });
    setBusy(false);
    if (r.ok) {
      toast('密碼已重設,請用新密碼登入', 'ok');
      window.history.replaceState({}, '', window.location.pathname);
      onDone();
    } else if (r.error === 'token_expired') toast('連結已過期,請重新申請', 'error');
    else if (r.error === 'token_used') toast('此連結已使用過', 'error');
    else toast('重設失敗:' + r.error, 'error');
  }

  return (
    <CenterCard>
      <h2 style={{ margin: 0, fontSize: 22, color: 'var(--ink-900)' }}>設定新密碼</h2>
      <p style={{ color: 'var(--ink-500)', fontSize: 13, marginTop: 6, marginBottom: 20 }}>
        密碼需至少 8 字元、含大寫字母與數字。
      </p>
      <form onSubmit={submit}>
        <Field label="新密碼">
          <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        </Field>
        <Field label="再次輸入">
          <input className="input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </Field>
        <button type="submit" disabled={busy} className="btn btn-primary" style={{ width: '100%', marginTop: 4 }}>
          {busy ? '處理中…' : '確認重設'}
        </button>
      </form>
    </CenterCard>
  );
}

// ─── 首次設定:設新密碼 + 設 Email ─────────────────────────
function LiveSetup({ onDone, toast }) {
  const [pw, setPw] = React.useState('');
  const [pw2, setPw2] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const strength = pwStrength(pw);

  async function submit(e) {
    e.preventDefault();
    if (pw !== pw2) return toast('兩次密碼不一致', 'error');
    if (strength < 3) return toast('密碼強度不足:至少 8 字元、含大寫、含數字', 'error');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast('Email 格式不正確', 'error');
    setBusy(true);
    const r = await api('completeSetup', {
      session: window.BCC_API.getSession(), newPassword: pw, email: email || '',
    });
    setBusy(false);
    if (r.ok) {
      toast('設定完成', 'ok');
      onDone();
    } else toast('設定失敗:' + r.error, 'error');
  }

  return (
    <CenterCard wide>
      <div style={{ fontSize: 11, color: 'var(--brand-600)', letterSpacing: 1, fontFamily: 'var(--font-mono)' }}>
        FIRST · TIME · SETUP
      </div>
      <h2 style={{ margin: '4px 0 4px', fontSize: 22, color: 'var(--ink-900)' }}>歡迎!請完成首次設定</h2>
      <p style={{ color: 'var(--ink-500)', fontSize: 13, marginBottom: 20 }}>
        為了帳號安全,首次登入請設定您自己的密碼,並綁定一個 Email 以便日後忘記密碼時找回。
      </p>
      <form onSubmit={submit}>
        <Field label="新密碼">
          <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)}
            placeholder="至少 8 字元,需含大寫與數字" autoFocus />
          <PasswordStrength value={strength} />
        </Field>
        <Field label="再次輸入新密碼">
          <input className="input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </Field>
        <Field label="慣用 Email(忘記密碼用)" hint="可填您常用的私人信箱">
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="example@gmail.com" />
        </Field>
        <button type="submit" disabled={busy} className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}>
          {busy ? '儲存中…' : '完成設定並進入系統'}
        </button>
      </form>
    </CenterCard>
  );
}

function pwStrength(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}
function PasswordStrength({ value }) {
  const colors = ['#dc2626', '#f59e0b', '#10b981', '#10b981'];
  const labels = ['', '太弱', '一般', '強', '很強'];
  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 6, alignItems: 'center' }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ flex: 1, height: 3, borderRadius: 2,
          background: i < value ? colors[value - 1] : '#e5e0d8' }} />
      ))}
      <div style={{ fontSize: 10, color: 'var(--ink-500)', marginLeft: 6 }}>{labels[value]}</div>
    </div>
  );
}

// ─── 通用元件 ─────────────────────────────────────────────
function CenterCard({ children, wide }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card" style={{ width: '100%', maxWidth: wide ? 460 : 400, padding: 28 }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, color: 'var(--ink-700)', fontWeight: 500, display: 'block', marginBottom: 5 }}>
        {label}
        {hint && <span style={{ color: 'var(--ink-500)', fontWeight: 400, marginLeft: 6 }}>· {hint}</span>}
      </label>
      {children}
    </div>
  );
}

window.LiveApp = LiveApp;
window.LiveField = Field;
