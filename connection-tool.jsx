// API client — 連線到 Apps Script 後端
// 使用方式:
//   const r = await api('login', { studentId: '11012001', password: 'pass' });
//   if (r.ok) { ... }
//
// API_URL 在 localStorage 裡保存,可在「老師工具」面板修改
// TEACHER_KEY 只在記憶體裡(老師工具面板要用時才輸入)

window.BCC_API = (() => {
  let API_URL = localStorage.getItem('bcc.apiUrl') || '';
  let teacherKey = sessionStorage.getItem('bcc.teacherKey') || '';

  function setApiUrl(url) {
    API_URL = url;
    localStorage.setItem('bcc.apiUrl', url);
  }
  function getApiUrl() { return API_URL; }
  function setTeacherKey(k) {
    teacherKey = k;
    sessionStorage.setItem('bcc.teacherKey', k);
  }
  function getTeacherKey() { return teacherKey; }

  async function api(action, params = {}) {
    if (!API_URL) return { ok: false, error: 'no_api_url', hint: '請先到老師工具設定 API URL' };
    try {
      // Apps Script Web App 不接受 application/json preflight,用 text/plain 繞過
      const r = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action, ...params }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        redirect: 'follow',
      });
      return await r.json();
    } catch (e) {
      return { ok: false, error: 'network_error', detail: String(e) };
    }
  }

  function setSession(token) {
    if (token) sessionStorage.setItem('bcc.session', token);
    else sessionStorage.removeItem('bcc.session');
  }
  function getSession() { return sessionStorage.getItem('bcc.session') || ''; }

  return { api, setApiUrl, getApiUrl, setTeacherKey, getTeacherKey, setSession, getSession };
})();

// ──────── 老師連線測試工具(浮動按鈕) ────────
function ConnectionTool() {
  const [open, setOpen] = React.useState(false);
  const [url, setUrl] = React.useState(window.BCC_API.getApiUrl());
  const [key, setKey] = React.useState(window.BCC_API.getTeacherKey());
  const [log, setLog] = React.useState([]);
  const [busy, setBusy] = React.useState(false);

  // 建立學生表單
  const [sid, setSid] = React.useState('11012001');
  const [name, setName] = React.useState('測試學生');
  const [bday, setBday] = React.useState('0101');
  // 登入測試
  const [loginId, setLoginId] = React.useState('11012001');
  const [loginPw, setLoginPw] = React.useState('00000101');

  function append(msg, ok) {
    setLog((L) => [{ msg, ok, time: new Date().toLocaleTimeString() }, ...L].slice(0, 12));
  }

  async function ping() {
    setBusy(true);
    const r = await window.BCC_API.api('ping');
    append(r.ok ? `✓ 後端通了 · ${r.time}` : `✗ 連不到 · ${r.error || ''}`, r.ok);
    setBusy(false);
  }

  async function createStudent() {
    setBusy(true);
    const r = await window.BCC_API.api('createStudent', {
      teacherKey: key, studentId: sid, name, birthMMDD: bday,
    });
    if (r.ok) append(`✓ 已建立學生 ${sid} · 預設密碼:${r.defaultPassword}`, true);
    else append(`✗ ${r.error}`, false);
    setBusy(false);
  }

  async function testLogin() {
    setBusy(true);
    const r = await window.BCC_API.api('login', { studentId: loginId, password: loginPw });
    if (r.ok) {
      window.BCC_API.setSession(r.session);
      append(`✓ 登入成功 · ${r.profile.name} · 強制改密碼:${r.mustChangePassword}`, true);
    } else {
      append(`✗ ${r.error}`, false);
    }
    setBusy(false);
  }

  async function listStudents() {
    setBusy(true);
    const r = await window.BCC_API.api('listStudents', { teacherKey: key });
    if (r.ok) append(`✓ 目前有 ${r.students.length} 位學生:${r.students.map((s) => s.studentId).join(', ') || '(無)'}`, true);
    else append(`✗ ${r.error}`, false);
    setBusy(false);
  }

  function save() {
    window.BCC_API.setApiUrl(url.trim());
    window.BCC_API.setTeacherKey(key.trim());
    append('✓ 已儲存設定', true);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        position: 'fixed', left: 16, bottom: 16, zIndex: 999,
        background: 'var(--ink-900)', color: 'white', border: 'none',
        padding: '10px 14px', borderRadius: 999, cursor: 'pointer',
        fontSize: 12, fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center',
        boxShadow: '0 4px 16px rgba(0,0,0,.2)',
      }}>
        🔌 連線工具
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed', left: 16, bottom: 16, zIndex: 999,
      width: 380, maxHeight: '80vh', overflow: 'auto',
      background: 'white', borderRadius: 12, padding: 16,
      boxShadow: '0 12px 40px rgba(0,0,0,.18)', border: '1px solid #e0d8cc',
      fontFamily: 'var(--font-sans)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <strong style={{ fontSize: 14 }}>🔌 後端連線工具</strong>
        <button onClick={() => setOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18 }}>×</button>
      </div>

      <Field label="API URL (Apps Script /exec)">
        <textarea value={url} onChange={(e) => setUrl(e.target.value)} rows={2}
          style={{ width: '100%', fontSize: 11, fontFamily: 'monospace', padding: 6, border: '1px solid #ccc', borderRadius: 6 }} />
      </Field>
      <Field label="TEACHER_KEY (老師金鑰)">
        <input type="password" value={key} onChange={(e) => setKey(e.target.value)}
          style={{ width: '100%', fontSize: 12, fontFamily: 'monospace', padding: 6, border: '1px solid #ccc', borderRadius: 6 }} />
      </Field>
      <button onClick={save} style={btnStyle('var(--ink-900)')}>💾 儲存設定</button>

      <hr style={{ margin: '14px 0', border: 'none', borderTop: '1px solid #eee' }} />

      <button onClick={ping} disabled={busy} style={btnStyle('#0a8')}>① 測試連線 (ping)</button>

      <div style={{ marginTop: 12, padding: 10, background: '#f7f5f0', borderRadius: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: '#666' }}>② 建立測試學生</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <input value={sid} onChange={(e) => setSid(e.target.value)} placeholder="學號"
            style={inputStyle()} />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="姓名"
            style={inputStyle()} />
          <input value={bday} onChange={(e) => setBday(e.target.value)} placeholder="MMDD"
            style={{ ...inputStyle(), width: 60 }} />
        </div>
        <button onClick={createStudent} disabled={busy} style={btnStyle('#7c3aed', true)}>建立</button>
      </div>

      <div style={{ marginTop: 8, padding: 10, background: '#f7f5f0', borderRadius: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: '#666' }}>③ 測試登入</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <input value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="學號" style={inputStyle()} />
          <input value={loginPw} onChange={(e) => setLoginPw(e.target.value)} placeholder="密碼" style={inputStyle()} />
        </div>
        <button onClick={testLogin} disabled={busy} style={btnStyle('#2563eb', true)}>登入</button>
      </div>

      <button onClick={listStudents} disabled={busy} style={{ ...btnStyle('#666'), marginTop: 8 }}>④ 列出全部學生</button>

      <div style={{ marginTop: 12, fontSize: 11, fontWeight: 600, color: '#666' }}>執行記錄:</div>
      <div style={{ marginTop: 4, fontSize: 11, fontFamily: 'monospace', maxHeight: 160, overflow: 'auto' }}>
        {log.length === 0 && <div style={{ color: '#aaa', padding: 4 }}>(無記錄)</div>}
        {log.map((l, i) => (
          <div key={i} style={{ padding: '3px 0', color: l.ok ? '#0a8' : '#d33', borderBottom: '1px dashed #eee' }}>
            <span style={{ color: '#aaa' }}>[{l.time}]</span> {l.msg}
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 3, fontWeight: 500 }}>{label}</div>
      {children}
    </div>
  );
}
function btnStyle(color, small) {
  return {
    background: color, color: 'white', border: 'none', padding: small ? '6px 10px' : '8px 12px',
    borderRadius: 6, cursor: 'pointer', fontSize: small ? 11 : 12, fontWeight: 600,
    width: '100%', marginTop: 4,
  };
}
function inputStyle() {
  return {
    flex: 1, fontSize: 11, padding: 5, border: '1px solid #ccc', borderRadius: 4,
    fontFamily: 'monospace', minWidth: 0,
  };
}

window.ConnectionTool = ConnectionTool;
