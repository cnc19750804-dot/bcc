// 學生主畫面 — 真實資料版

const studentApi = (action, params) => window.BCC_API.api(action, params);

function LiveStudent({ profile, onLogout, toast }) {
  const [tab, setTab] = React.useState('assignments'); // assignments | materials | settings
  const [data, setData] = React.useState({ assignments: [], submissions: [] });
  const [materials, setMaterials] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [me, setMe] = React.useState(profile || JSON.parse(sessionStorage.getItem('bcc.profile') || 'null'));

  // 載入資料
  React.useEffect(() => {
    if (profile) sessionStorage.setItem('bcc.profile', JSON.stringify(profile));
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    const session = window.BCC_API.getSession();
    const [r1, r2, r3] = await Promise.all([
      studentApi('myAssignments', { session }),
      studentApi('listMaterials', { session }),
      studentApi('me', { session }),
    ]);
    if (r1.ok) setData({ assignments: r1.assignments, submissions: r1.submissions });
    if (r2.ok) setMaterials(r2.materials);
    if (r3.ok && r3.profile) {
      setMe(r3.profile);
      sessionStorage.setItem('bcc.profile', JSON.stringify(r3.profile));
    }
    setLoading(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Top bar */}
      <div style={{
        background: 'white', borderBottom: 'var(--border-soft)',
        padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <BrandMark size={28} />
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)' }}>資訊科技課程作業系統</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>
          <span className="mono">{me?.studentId}</span> · {me?.name || '同學'}
        </div>
        <button onClick={onLogout} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>登出</button>
      </div>

      {/* Tabs */}
      <div style={{ background: 'white', borderBottom: 'var(--border-soft)', padding: '0 24px', display: 'flex', gap: 2 }}>
        {[
          { id: 'assignments', label: '我的作業', icon: IconBook },
          { id: 'materials', label: '課程教材', icon: IconFolder },
          { id: 'settings', label: '個人設定', icon: IconSettings },
        ].map((t) => {
          const I = t.icon;
          const on = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '12px 16px', fontSize: 13, fontWeight: on ? 600 : 500,
              color: on ? 'var(--brand-600)' : 'var(--ink-500)',
              borderBottom: on ? '2px solid var(--brand-500)' : '2px solid transparent',
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: -1,
            }}>
              <I size={14} />{t.label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, maxWidth: 900, margin: '0 auto', width: '100%', padding: '24px 24px 48px' }}>
        {loading && <Loading />}
        {!loading && tab === 'assignments' && <AssignmentsTab data={data} onChanged={refresh} toast={toast} />}
        {!loading && tab === 'materials' && <MaterialsTab materials={materials} toast={toast} />}
        {!loading && tab === 'settings' && <SettingsTab me={me} setMe={setMe} toast={toast} />}
      </div>
    </div>
  );
}

// ─── 作業 Tab ────────────────────────────────────────────
function AssignmentsTab({ data, onChanged, toast }) {
  const [openUpload, setOpenUpload] = React.useState(null); // assignmentId

  const subsByAss = {};
  data.submissions.forEach((s) => {
    if (!subsByAss[s.assignmentId] || s.version > subsByAss[s.assignmentId].version) {
      subsByAss[s.assignmentId] = s;
    }
  });

  const sorted = [...data.assignments].sort((a, b) => +b.week - +a.week);

  if (sorted.length === 0) return (
    <EmptyState icon="📚" title="目前還沒有作業" desc="老師發布作業後會出現在這裡。" />
  );

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink-900)', margin: '0 0 16px' }}>我的作業</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sorted.map((a) => {
          const sub = subsByAss[a.assignmentId];
          const isLate = !sub && new Date() > new Date(a.dueAt);
          // 舊作業沒有 lateAllowed 欄位時以 true 處理
          const lateAllowed = a.lateAllowed !== false;
          const locked = isLate && !lateAllowed;
          return (
            <div key={a.assignmentId} className="card" style={{ padding: 16, opacity: locked && !sub ? 0.7 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div className="mono" style={{
                  background: 'var(--brand-50)', color: 'var(--brand-700)',
                  padding: '4px 10px', borderRadius: 'var(--r-pill)',
                  fontSize: 11, fontWeight: 600, flexShrink: 0,
                }}>W{String(a.week).padStart(2, '0')}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-900)' }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 4, lineHeight: 1.5 }}>{a.description}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span>📅 截止 {fmtDate(a.dueAt)}</span>
                    {sub && <SubBadge sub={sub} />}
                    {!sub && isLate && lateAllowed && <span style={{ color: '#d97706' }}>⚠️ 已逾期(仍可補交)</span>}
                    {!sub && locked && <span style={{ color: '#dc2626' }}>🔒 已逾期且鎖件</span>}
                  </div>
                </div>
                <button onClick={() => setOpenUpload(a.assignmentId)}
                  disabled={locked && !sub}
                  className={`btn btn-sm ${(locked && !sub) ? 'btn-ghost' : 'btn-primary'}`}
                  style={(locked && !sub) ? { opacity: 0.5, cursor: 'not-allowed' } : null}>
                  {(locked && !sub) ? '已鎖件' : (sub ? '重新上傳' : '上傳作業')}
                </button>
              </div>
              {sub && <SubmittedFiles sub={sub} toast={toast} onChanged={onChanged} />}
            </div>
          );
        })}
      </div>
      {openUpload && (
        <UploadDialog
          assignment={data.assignments.find((a) => a.assignmentId === openUpload)}
          onClose={() => setOpenUpload(null)}
          onDone={() => { setOpenUpload(null); onChanged(); }}
          toast={toast}
        />
      )}
    </div>
  );
}

function SubBadge({ sub }) {
  const map = {
    submitted: { color: '#059669', label: '已繳交' },
    late: { color: '#f59e0b', label: '逾期繳交' },
    graded: { color: 'var(--brand-600)', label: `已評分 ${sub.score}/100` },
  };
  const m = map[sub.state] || map.submitted;
  return <span style={{ color: m.color, fontWeight: 500 }}>● {m.label}</span>;
}

// 已繳交檔案列表 + 下載/刪除按鈕(從 Apps Script 抓 base64 觸發瀏覽器下載)
function SubmittedFiles({ sub, toast, onChanged }) {
  const names = (() => { try { return JSON.parse(sub.fileNames || '[]'); } catch { return []; } })();
  const ids = (() => { try { return JSON.parse(sub.fileIds || '[]'); } catch { return []; } })();
  const [busyIdx, setBusyIdx] = React.useState(-1);
  const [delIdx, setDelIdx] = React.useState(-1);
  if (!names.length) return null;

  async function dl(i) {
    setBusyIdx(i);
    const r = await window.BCC_API.api('downloadFile', {
      session: window.BCC_API.getSession(), fileId: ids[i],
    });
    setBusyIdx(-1);
    if (!r.ok) { toast('下載失敗:' + r.error, 'error'); return; }
    window.saveBase64AsFile(r.base64, r.fileName, r.mimeType);
  }

  async function del(i) {
    if (!confirm(`確定刪除檔案「${names[i]}」?\n(此操作無法復原,如有需要請重新上傳)`)) return;
    setDelIdx(i);
    const r = await window.BCC_API.api('deleteSubmissionFile', {
      session: window.BCC_API.getSession(),
      submissionId: sub.submissionId, fileId: ids[i],
    });
    setDelIdx(-1);
    if (!r.ok) { toast('刪除失敗:' + r.error, 'error'); return; }
    toast('已刪除', 'ok');
    if (onChanged) onChanged();
  }

  const isGraded = sub.state === 'graded';

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--ink-200)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>
          ✅ 已繳交檔案 · 共 {names.length} 個
        </div>
        {sub.submittedAt && (
          <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>
            🕒 {fmtDate(sub.submittedAt)}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {names.map((n, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 10px', background: 'var(--bg-soft, #f7f5f0)', borderRadius: 6, fontSize: 12,
          }}>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              📄 {n}
            </span>
            <button onClick={() => dl(i)} disabled={busyIdx === i}
              title="下載"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px', fontSize: 12, color: 'var(--brand-700)' }}>
              {busyIdx === i ? '⏳' : '⬇ 下載'}
            </button>
            {!isGraded && (
              <button onClick={() => del(i)} disabled={delIdx === i}
                title="刪除這個檔案"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px', fontSize: 12, color: '#dc2626' }}>
                {delIdx === i ? '⏳' : '🗑 刪除'}
              </button>
            )}
          </div>
        ))}
      </div>
      {isGraded && (
        <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 6 }}>
          ℹ️ 此作業已評分,無法刪除檔案
        </div>
      )}
      {sub.note && (
        <div style={{ marginTop: 8, padding: 8, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, fontSize: 12, color: '#92400e' }}>
          📝 您的備註:{sub.note}
        </div>
      )}
    </div>
  );
}

// ─── 上傳對話框 ───────────────────────────────────────────
function UploadDialog({ assignment, onClose, onDone, toast }) {
  const [files, setFiles] = React.useState([]);
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState({});

  function onPick(e) {
    setFiles([...e.target.files]);
  }

  async function submit() {
    if (files.length === 0) return toast('請選擇至少一個檔案', 'error');
    setBusy(true);
    const session = window.BCC_API.getSession();
    const ids = [], names = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setProgress((p) => ({ ...p, [i]: 0 }));
      const base64 = await fileToBase64(f);
      setProgress((p) => ({ ...p, [i]: 50 }));
      const r = await studentApi('uploadFile', {
        session, assignmentId: assignment.assignmentId,
        fileName: f.name, mimeType: f.type || 'application/octet-stream', base64,
      });
      if (!r.ok) {
        toast(`上傳失敗 ${f.name}:${r.error}`, 'error');
        setBusy(false); return;
      }
      setProgress((p) => ({ ...p, [i]: 100 }));
      ids.push(r.fileId); names.push(f.name);
    }
    const r2 = await studentApi('submitAssignment', {
      session, assignmentId: assignment.assignmentId,
      fileIds: ids, fileNames: names, note,
    });
    setBusy(false);
    if (r2.ok) {
      // 改成顯示成功對話框,讓學生明確看到繳交狀態
      const submittedTime = new Date().toLocaleString('zh-TW');
      toast(
        r2.late
          ? `✅ 逾期繳交完成!共 ${names.length} 個檔案 · ${submittedTime}`
          : `✅ 繳交成功!共 ${names.length} 個檔案 · ${submittedTime}`,
        'ok'
      );
      onDone();
    } else {
      if (r2.error === 'past_due_locked') toast('作業已逾期且老師尚未開放補交', 'error');
      else toast('繳交失敗:' + r2.error, 'error');
    }
  }

  return (
    <Dialog onClose={onClose}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>上傳作業</h3>
      <div style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: 4 }}>
        W{String(assignment.week).padStart(2, '0')} · {assignment.title}
      </div>
      <div style={{ marginTop: 16 }}>
        <input type="file" multiple onChange={onPick} disabled={busy}
          style={{ display: 'block', width: '100%', padding: 12, border: '2px dashed #ccc',
            borderRadius: 8, background: '#fafafa', cursor: 'pointer' }} />
      </div>
      {files.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {files.map((f, i) => (
            <div key={i} style={{ fontSize: 12, padding: 6, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📄 {f.name}</span>
              <span style={{ color: progress[i] === 100 ? '#059669' : 'var(--ink-500)' }}>
                {progress[i] === 100 ? '✓' : progress[i] ? `${progress[i]}%` : `${(f.size/1024).toFixed(0)} KB`}
              </span>
            </div>
          ))}
        </div>
      )}
      <Field label="備註(可選)">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
          className="input" style={{ width: '100%', resize: 'vertical' }} />
      </Field>
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={onClose} disabled={busy} className="btn btn-ghost" style={{ flex: 1 }}>取消</button>
        <button onClick={submit} disabled={busy || files.length === 0} className="btn btn-primary" style={{ flex: 1 }}>
          {busy ? '上傳中…' : '確認繳交'}
        </button>
      </div>
    </Dialog>
  );
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result;
      resolve(s.substring(s.indexOf(',') + 1));
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// ─── 教材 Tab ────────────────────────────────────────────
function MaterialsTab({ materials, toast }) {
  if (materials.length === 0) return (
    <EmptyState icon="📁" title="目前還沒有教材" desc="老師上傳教材後會出現在這裡。" />
  );

  const groups = {};
  materials.forEach((m) => { (groups[m.week] = groups[m.week] || []).push(m); });
  const weeks = Object.keys(groups).sort((a, b) => +b - +a);

  async function download(m) {
    toast('下載中…', 'info');
    const r = await studentApi('downloadMaterial', {
      session: window.BCC_API.getSession(), materialId: m.materialId,
    });
    if (!r.ok) { toast('無法下載:' + r.error, 'error'); return; }
    saveBase64AsFile(r.base64, r.fileName, r.mimeType);
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink-900)', margin: '0 0 16px' }}>課程教材</h2>
      {weeks.map((w) => (
        <div key={w} style={{ marginBottom: 20 }}>
          <div className="mono" style={{
            display: 'inline-block', fontSize: 11, fontWeight: 600,
            color: 'var(--brand-700)', background: 'var(--brand-50)',
            padding: '3px 10px', borderRadius: 'var(--r-pill)', marginBottom: 8,
          }}>WEEK {String(w).padStart(2, '0')}</div>
          {groups[w].map((m) => (
            <div key={m.materialId} className="card" style={{ padding: 12, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 12 }}>
              <FileTypeIcon type={m.fileType} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{m.title}</div>
                {m.description && <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>{m.description}</div>}
                <div style={{ fontSize: 11, color: 'var(--ink-400)', marginTop: 4 }}>
                  {humanSize(m.fileSize)} · {fmtDate(m.uploadedAt)}
                </div>
              </div>
              <button onClick={() => download(m)} className="btn btn-ghost btn-sm">
                <IconDownload size={14} />下載
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── 設定 Tab ────────────────────────────────────────────
function SettingsTab({ me, setMe, toast }) {
  const [email, setEmail] = React.useState(me?.email || '');
  const [oldPw, setOldPw] = React.useState('');
  const [newPw, setNewPw] = React.useState('');

  async function saveEmail() {
    const r = await studentApi('updateEmail', {
      session: window.BCC_API.getSession(), email,
    });
    if (r.ok) { toast('Email 已更新', 'ok'); setMe({ ...me, email }); }
    else toast('更新失敗:' + r.error, 'error');
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink-900)', margin: '0 0 16px' }}>個人設定</h2>
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>基本資料</h3>
        <Field label="學號"><input className="input" value={me?.studentId || ''} disabled /></Field>
        <Field label="姓名"><input className="input" value={me?.name || ''} disabled /></Field>
        <Field label="慣用 Email">
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <button onClick={saveEmail} className="btn btn-primary btn-sm">儲存 Email</button>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px' }}>修改密碼</h3>
        <p style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 0, marginBottom: 12 }}>
          若要修改密碼,請使用「忘記密碼」功能(會寄送重設連結到您的 Email)。
        </p>
      </div>
    </div>
  );
}

// ─── 雜項元件 ────────────────────────────────────────────
function Loading() {
  return <div style={{ textAlign: 'center', padding: 60, color: 'var(--ink-500)' }}>載入中…</div>;
}
function EmptyState({ icon, title, desc }) {
  return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <div style={{ fontSize: 48 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-900)', marginTop: 12 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: 4 }}>{desc}</div>
    </div>
  );
}
function Dialog({ onClose, children }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99,
    }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{
        width: '92%', maxWidth: 480, padding: 24, background: 'white',
      }}>{children}</div>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 12, color: 'var(--ink-700)', fontWeight: 500, display: 'block', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }) +
    ' ' + dt.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
}
function humanSize(b) {
  if (!b) return '—';
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(0) + ' KB';
  return (b / 1024 / 1024).toFixed(1) + ' MB';
}

window.LiveStudent = LiveStudent;
