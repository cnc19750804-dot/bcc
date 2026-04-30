// 老師後台 — 真實資料版

const teacherApi = (action, params) => window.BCC_API.api(action, params);

function LiveTeacher({ onLogout, toast }) {
  const [tab, setTab] = React.useState('students'); // students | submissions | materials
  const tk = window.BCC_API.getTeacherKey();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div style={{
        background: 'var(--ink-900)', color: 'white', padding: '10px 24px',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>🎓 老師後台</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', fontFamily: 'var(--font-mono)' }}>
          KEY: {tk ? tk.substring(0, 6) + '••••••' : '(未設定)'}
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={onLogout} className="btn btn-sm" style={{ background: 'rgba(255,255,255,.1)', color: 'white' }}>退出後台</button>
      </div>

      <div style={{ background: 'white', borderBottom: 'var(--border-soft)', padding: '0 24px', display: 'flex', gap: 2 }}>
        {[
          { id: 'students', label: '學生管理' },
          { id: 'assignments', label: '作業管理' },
          { id: 'submissions', label: '繳交狀況' },
          { id: 'materials', label: '教材管理' },
        ].map((t) => {
          const on = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '12px 16px', fontSize: 13, fontWeight: on ? 600 : 500,
              color: on ? 'var(--brand-600)' : 'var(--ink-500)',
              borderBottom: on ? '2px solid var(--brand-500)' : '2px solid transparent',
              marginBottom: -1,
            }}>{t.label}</button>
          );
        })}
      </div>

      <div style={{ flex: 1, maxWidth: 1100, margin: '0 auto', width: '100%', padding: '24px 24px 48px' }}>
        {tab === 'students' && <StudentsTab toast={toast} />}
        {tab === 'assignments' && <window.AssignmentsAdminTab toast={toast} />}
        {tab === 'submissions' && <SubmissionsTab toast={toast} />}
        {tab === 'materials' && <TeacherMaterialsTab toast={toast} />}
      </div>
    </div>
  );
}

// ─── 學生管理 ────────────────────────────────────────────
function StudentsTab({ toast }) {
  const [students, setStudents] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [openAdd, setOpenAdd] = React.useState(false);
  const [openReset, setOpenReset] = React.useState(null);

  async function refresh() {
    setLoading(true);
    const r = await teacherApi('listStudents', { teacherKey: window.BCC_API.getTeacherKey() });
    if (r.ok) setStudents(r.students);
    else toast('載入失敗:' + r.error, 'error');
    setLoading(false);
  }
  React.useEffect(() => { refresh(); }, []);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>學生名單</h2>
        <div style={{ flex: 1 }} />
        <button onClick={() => setOpenAdd(true)} className="btn btn-primary btn-sm">
          <IconPlus size={14} />新增 / 匯入學生
        </button>
      </div>

      {loading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>載入中…</div>}
      {!loading && students.length === 0 && <EmptyState icon="👥" title="還沒有學生" desc="點右上角「新增 / 匯入學生」開始建立。" />}
      {!loading && students.length > 0 && (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-soft)' }}>
                <Th>學號</Th><Th>姓名</Th><Th>Email</Th><Th>狀態</Th><Th>最近登入</Th><Th>操作</Th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.studentId} style={{ borderTop: 'var(--border-soft)' }}>
                  <Td mono>{s.studentId}</Td>
                  <Td>{s.name}</Td>
                  <Td>{s.email || <span style={{ color: 'var(--ink-400)' }}>—</span>}</Td>
                  <Td><StatusBadge status={s.status} /></Td>
                  <Td>{s.lastLogin ? fmtDate(s.lastLogin) : <span style={{ color: 'var(--ink-400)' }}>從未登入</span>}</Td>
                  <Td>
                    <button onClick={() => setOpenReset(s)} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>
                      🔑 重設密碼
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openAdd && <AddStudentDialog onClose={() => setOpenAdd(false)} onDone={() => { setOpenAdd(false); refresh(); }} toast={toast} />}
      {openReset && <ResetPasswordDialog student={openReset} onClose={() => setOpenReset(null)} toast={toast} />}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    active: { color: '#059669', bg: '#d1fae5', label: '使用中' },
    pending: { color: '#d97706', bg: '#fef3c7', label: '待設定' },
    disabled: { color: '#6b7280', bg: '#e5e7eb', label: '已停用' },
  };
  const m = map[status] || map.pending;
  return <span style={{ color: m.color, background: m.bg, padding: '2px 8px', borderRadius: 'var(--r-pill)', fontSize: 11, fontWeight: 500 }}>{m.label}</span>;
}

// ─── 新增學生對話框 ──────────────────────────────────────
function AddStudentDialog({ onClose, onDone, toast }) {
  const [mode, setMode] = React.useState('single'); // single | bulk
  const [sid, setSid] = React.useState(''); const [name, setName] = React.useState(''); const [bday, setBday] = React.useState('');
  const [bulk, setBulk] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [results, setResults] = React.useState([]);

  async function addOne() {
    if (!sid || !name) return toast('學號與姓名必填', 'error');
    setBusy(true);
    const r = await teacherApi('createStudent', { teacherKey: window.BCC_API.getTeacherKey(), studentId: sid, name, birthMMDD: bday || '0000' });
    setBusy(false);
    if (r.ok) { toast(`已建立 · 預設密碼:${r.defaultPassword}`, 'ok'); onDone(); }
    else toast('失敗:' + r.error, 'error');
  }

  async function addBulk() {
    const lines = bulk.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return toast('請輸入資料', 'error');
    setBusy(true);
    const out = [];
    for (const line of lines) {
      const [bsid, bname, bbday] = line.split(/[,\t]/).map((s) => (s || '').trim());
      if (!bsid || !bname) { out.push({ line, ok: false, msg: '格式錯誤' }); continue; }
      const r = await teacherApi('createStudent', { teacherKey: window.BCC_API.getTeacherKey(), studentId: bsid, name: bname, birthMMDD: bbday || '0000' });
      out.push({ line, ...r });
      setResults([...out]);
    }
    setBusy(false);
    toast(`完成:${out.filter((x) => x.ok).length}/${out.length} 筆成功`, 'ok');
    onDone();
  }

  return (
    <Dialog onClose={onClose}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>新增學生</h3>
      <div style={{ display: 'flex', gap: 4, marginTop: 12, marginBottom: 16, background: '#f3f0ea', padding: 3, borderRadius: 6 }}>
        {['single', 'bulk'].map((m) => (
          <button key={m} onClick={() => setMode(m)} style={{
            flex: 1, padding: '6px 12px', fontSize: 12, border: 'none', borderRadius: 4, cursor: 'pointer',
            background: mode === m ? 'white' : 'transparent', fontWeight: mode === m ? 600 : 400,
          }}>{m === 'single' ? '單筆' : '批次貼上 (CSV)'}</button>
        ))}
      </div>

      {mode === 'single' ? (
        <div>
          <Field label="學號"><input className="input" value={sid} onChange={(e) => setSid(e.target.value)} placeholder="例如 11012001" /></Field>
          <Field label="姓名"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="生日 MMDD(預設密碼用,可省略)">
            <input className="input" value={bday} onChange={(e) => setBday(e.target.value)} placeholder="例如 0315" maxLength={4} />
          </Field>
          <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: -6, marginBottom: 12 }}>
            預設密碼:0000{bday || '0000'}
          </div>
          <button onClick={addOne} disabled={busy} className="btn btn-primary" style={{ width: '100%' }}>
            {busy ? '建立中…' : '建立'}
          </button>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 6 }}>
            每行一位學生,格式:<code>學號,姓名,生日MMDD</code>
          </div>
          <textarea value={bulk} onChange={(e) => setBulk(e.target.value)}
            placeholder="11012001,林思妤,0315&#10;11012002,王柏翰,0822"
            rows={8} className="input" style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 12 }} />
          <button onClick={addBulk} disabled={busy} className="btn btn-primary" style={{ width: '100%', marginTop: 10 }}>
            {busy ? `處理中… ${results.length}` : '批次建立'}
          </button>
          {results.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 11, fontFamily: 'monospace', maxHeight: 120, overflow: 'auto' }}>
              {results.map((r, i) => (
                <div key={i} style={{ color: r.ok ? '#059669' : '#dc2626', padding: '2px 0' }}>
                  {r.ok ? '✓' : '✗'} {r.line} {r.error && `(${r.error})`}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <button onClick={onClose} className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }}>關閉</button>
    </Dialog>
  );
}

// ─── 重設密碼對話框 ──────────────────────────────────────
function ResetPasswordDialog({ student, onClose, toast }) {
  const [mode, setMode] = React.useState('email');
  const [tempPw, setTempPw] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(null);

  async function submit() {
    setBusy(true);
    const r = await teacherApi('teacherReset', {
      teacherKey: window.BCC_API.getTeacherKey(),
      studentId: student.studentId, mode,
      tempPassword: tempPw || undefined,
    });
    setBusy(false);
    if (r.ok) {
      if (mode === 'email') setDone({ mode: 'email', masked: r.masked });
      else setDone({ mode: 'temp', pw: r.tempPassword });
    } else {
      toast('失敗:' + r.error, 'error');
    }
  }

  if (done) return (
    <Dialog onClose={onClose}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>✅ 已重設</h3>
      {done.mode === 'email' ? (
        <p style={{ fontSize: 13, color: 'var(--ink-700)', marginTop: 12 }}>重設連結已寄至 <strong>{done.masked}</strong>。學生需在 30 分鐘內點擊連結設定新密碼。</p>
      ) : (
        <div>
          <p style={{ fontSize: 13, color: 'var(--ink-700)', marginTop: 12 }}>請告知學生此臨時密碼,學生登入後會被要求改密碼:</p>
          <div className="mono" style={{ fontSize: 18, padding: 12, background: '#fef3c7', borderRadius: 8, textAlign: 'center', fontWeight: 600, color: '#92400e' }}>{done.pw}</div>
        </div>
      )}
      <button onClick={onClose} className="btn btn-primary" style={{ width: '100%', marginTop: 16 }}>關閉</button>
    </Dialog>
  );

  return (
    <Dialog onClose={onClose}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>重設密碼</h3>
      <div style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: 4 }}>
        <span className="mono">{student.studentId}</span> · {student.name}
      </div>
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <RadioCard checked={mode === 'email'} onChange={() => setMode('email')} disabled={!student.email}
          title="📧 寄重設連結到學生 Email" desc={student.email || '(該學生尚未綁定 Email,無法使用此方式)'} />
        <RadioCard checked={mode === 'temp'} onChange={() => setMode('temp')}
          title="🔢 設定臨時密碼" desc="學生用此密碼登入後會被要求改密碼" />
      </div>
      {mode === 'temp' && (
        <Field label="臨時密碼(留空自動產生)">
          <input className="input" value={tempPw} onChange={(e) => setTempPw(e.target.value)} placeholder="留空自動產生 8 位數" />
        </Field>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>取消</button>
        <button onClick={submit} disabled={busy} className="btn btn-primary" style={{ flex: 1 }}>
          {busy ? '處理中…' : '確認重設'}
        </button>
      </div>
    </Dialog>
  );
}

function RadioCard({ checked, onChange, disabled, title, desc }) {
  return (
    <label style={{
      display: 'block', padding: 12, border: `2px solid ${checked ? 'var(--brand-500)' : 'var(--border-color)'}`,
      borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
      background: checked ? 'var(--brand-50)' : 'white',
    }}>
      <input type="radio" checked={checked} onChange={onChange} disabled={disabled} style={{ marginRight: 8 }} />
      <strong style={{ fontSize: 13 }}>{title}</strong>
      <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 4, marginLeft: 24 }}>{desc}</div>
    </label>
  );
}

// ─── 繳交狀況 Tab ───────────────────────────────────────
function SubmissionsTab({ toast }) {
  const [students, setStudents] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      const r = await teacherApi('listStudents', { teacherKey: window.BCC_API.getTeacherKey() });
      if (r.ok) setStudents(r.students);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>載入中…</div>;

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 16px' }}>學生作業檔案</h2>
      <p style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 16 }}>
        所有學生的作業都存放在 Google Drive「資訊科技課程作業系統」資料夾下,以「學號_姓名」分類。
        點下方「開啟資料夾」可直接到 Drive 檢視該生繳交檔案。
      </p>
      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: 'var(--bg-soft)' }}>
            <Th>學號</Th><Th>姓名</Th><Th>狀態</Th><Th>最近登入</Th><Th>檔案</Th>
          </tr></thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.studentId} style={{ borderTop: 'var(--border-soft)' }}>
                <Td mono>{s.studentId}</Td>
                <Td>{s.name}</Td>
                <Td><StatusBadge status={s.status} /></Td>
                <Td>{s.lastLogin ? fmtDate(s.lastLogin) : '—'}</Td>
                <Td>
                  <a href={`https://drive.google.com/drive/search?q=${encodeURIComponent(s.studentId + '_' + s.name)}`}
                    target="_blank" rel="noopener" className="btn btn-ghost btn-sm" style={{ fontSize: 11, textDecoration: 'none' }}>
                    📁 開啟資料夾
                  </a>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── 教材管理 Tab ────────────────────────────────────────
function TeacherMaterialsTab({ toast }) {
  const [list, setList] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [openUpload, setOpenUpload] = React.useState(false);

  async function refresh() {
    setLoading(true);
    const r = await teacherApi('listAllMaterials', { teacherKey: window.BCC_API.getTeacherKey() });
    if (r.ok) setList(r.materials);
    setLoading(false);
  }
  React.useEffect(() => { refresh(); }, []);

  async function toggle(m) {
    const r = await teacherApi('toggleMaterial', {
      teacherKey: window.BCC_API.getTeacherKey(), materialId: m.materialId, published: !m.published,
    });
    if (r.ok) refresh();
    else toast('失敗:' + r.error, 'error');
  }

  async function del(m) {
    if (!confirm(`確定刪除教材「${m.title}」?`)) return;
    const r = await teacherApi('deleteMaterial', {
      teacherKey: window.BCC_API.getTeacherKey(), materialId: m.materialId,
    });
    if (r.ok) { toast('已刪除', 'ok'); refresh(); }
    else toast('失敗:' + r.error, 'error');
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>教材管理</h2>
        <div style={{ flex: 1 }} />
        <button onClick={() => setOpenUpload(true)} className="btn btn-primary btn-sm">
          <IconUpload size={14} />上傳教材
        </button>
      </div>

      {loading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>載入中…</div>}
      {!loading && list.length === 0 && <EmptyState icon="📚" title="還沒有教材" desc="點右上角「上傳教材」開始建立。" />}
      {!loading && list.length > 0 && (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: 'var(--bg-soft)' }}>
              <Th>週次</Th><Th>標題</Th><Th>大小</Th><Th>上傳時間</Th><Th>已發布</Th><Th>操作</Th>
            </tr></thead>
            <tbody>
              {list.map((m) => (
                <tr key={m.materialId} style={{ borderTop: 'var(--border-soft)', opacity: m.published ? 1 : 0.55 }}>
                  <Td mono>W{String(m.week).padStart(2, '0')}</Td>
                  <Td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FileTypeIcon type={m.fileType} size={24} />
                      <div>
                        <div style={{ fontWeight: 500 }}>{m.title}</div>
                        {m.description && <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>{m.description}</div>}
                      </div>
                    </div>
                  </Td>
                  <Td>{humanSize(m.fileSize)}</Td>
                  <Td>{fmtDate(m.uploadedAt)}</Td>
                  <Td>
                    <button onClick={() => toggle(m)} style={{
                      width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: m.published ? 'var(--brand-500)' : '#ccc', position: 'relative',
                    }}>
                      <div style={{
                        width: 14, height: 14, borderRadius: 7, background: 'white',
                        position: 'absolute', top: 3, left: m.published ? 19 : 3, transition: 'left .2s',
                      }} />
                    </button>
                  </Td>
                  <Td>
                    <button onClick={() => del(m)} className="btn btn-ghost btn-sm" style={{ color: '#dc2626', fontSize: 11 }}>刪除</button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openUpload && <UploadMaterialDialog onClose={() => setOpenUpload(false)} onDone={() => { setOpenUpload(false); refresh(); }} toast={toast} />}
    </div>
  );
}

function UploadMaterialDialog({ onClose, onDone, toast }) {
  const [week, setWeek] = React.useState(1);
  const [title, setTitle] = React.useState('');
  const [desc, setDesc] = React.useState('');
  const [file, setFile] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    if (!file || !title) return toast('檔案與標題必填', 'error');
    setBusy(true);
    const base64 = await fileToBase64(file);
    const r = await teacherApi('createMaterial', {
      teacherKey: window.BCC_API.getTeacherKey(),
      week: +week, title, description: desc,
      fileName: file.name, mimeType: file.type || 'application/octet-stream',
      base64, published: true,
    });
    setBusy(false);
    if (r.ok) { toast('已上傳', 'ok'); onDone(); }
    else toast('失敗:' + r.error, 'error');
  }

  return (
    <Dialog onClose={onClose}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>上傳教材</h3>
      <Field label="週次"><input type="number" min={1} max={20} className="input" value={week} onChange={(e) => setWeek(e.target.value)} /></Field>
      <Field label="標題"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label="說明(可選)"><textarea className="input" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} style={{ width: '100%', resize: 'vertical' }} /></Field>
      <Field label="檔案">
        <input type="file" onChange={(e) => setFile(e.target.files[0])}
          style={{ display: 'block', width: '100%', padding: 12, border: '2px dashed #ccc', borderRadius: 8, cursor: 'pointer' }} />
      </Field>
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={onClose} disabled={busy} className="btn btn-ghost" style={{ flex: 1 }}>取消</button>
        <button onClick={submit} disabled={busy || !file || !title} className="btn btn-primary" style={{ flex: 1 }}>
          {busy ? '上傳中…' : '確認上傳'}
        </button>
      </div>
    </Dialog>
  );
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => { const s = r.result; resolve(s.substring(s.indexOf(',') + 1)); };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// ─── 共用 ────────────────────────────────────────────────
function Th({ children }) { return <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, fontSize: 11, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{children}</th>; }
function Td({ children, mono }) { return <td style={{ padding: '10px 14px', fontFamily: mono ? 'var(--font-mono)' : 'inherit' }}>{children}</td>; }
function Field({ label, children }) {
  return <div style={{ marginBottom: 12 }}>
    <label style={{ fontSize: 12, color: 'var(--ink-700)', fontWeight: 500, display: 'block', marginBottom: 5 }}>{label}</label>
    {children}
  </div>;
}
function Dialog({ onClose, children }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: '92%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto', padding: 24, background: 'white' }}>{children}</div>
    </div>
  );
}
function EmptyState({ icon, title, desc }) {
  return <div style={{ textAlign: 'center', padding: 60 }}>
    <div style={{ fontSize: 48 }}>{icon}</div>
    <div style={{ fontSize: 16, fontWeight: 600, marginTop: 12 }}>{title}</div>
    <div style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: 4 }}>{desc}</div>
  </div>;
}
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }) + ' ' + dt.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
}
function humanSize(b) { if (!b) return '—'; if (b < 1024) return b + ' B'; if (b < 1024 * 1024) return (b / 1024).toFixed(0) + ' KB'; return (b / 1024 / 1024).toFixed(1) + ' MB'; }

window.LiveTeacher = LiveTeacher;
