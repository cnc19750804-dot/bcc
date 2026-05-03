// 老師後台 · 作業管理 Tab

function AssignmentsAdminTab({ toast }) {
  const [list, setList] = React.useState([]);
  const [subs, setSubs] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [openEdit, setOpenEdit] = React.useState(null); // null | 'new' | 作業物件

  async function refresh() {
    setLoading(true);
    const r = await window.BCC_API.api('listAllAssignments', { ...window.BCC_API.teacherAuth() });
    if (r.ok) { setList(r.assignments || []); setSubs(r.submissions || []); }
    else toast('載入失敗:' + r.error, 'error');
    setLoading(false);
  }
  React.useEffect(() => { refresh(); }, []);

  async function toggle(a) {
    const r = await window.BCC_API.api('updateAssignment', {
      ...window.BCC_API.teacherAuth(), assignmentId: a.assignmentId,
      patch: { published: !a.published },
    });
    if (r.ok) refresh(); else toast('失敗:' + r.error, 'error');
  }

  async function del(a) {
    if (!confirm(`確定刪除作業「${a.title}」?(已繳交的紀錄不會被刪)`)) return;
    const r = await window.BCC_API.api('deleteAssignment', {
      ...window.BCC_API.teacherAuth(), assignmentId: a.assignmentId,
    });
    if (r.ok) { toast('已刪除', 'ok'); refresh(); } else toast('失敗:' + r.error, 'error');
  }

  const sorted = [...list].sort((a, b) => +b.week - +a.week);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>作業管理</h2>
        <div style={{ flex: 1 }} />
        <button onClick={() => setOpenEdit('new')} className="btn btn-primary btn-sm">+ 新增作業</button>
      </div>

      {loading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>載入中…</div>}
      {!loading && sorted.length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>
          還沒有作業。點右上「新增作業」開始。
        </div>
      )}
      {!loading && sorted.length > 0 && (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: 'var(--bg-soft)' }}>
              <th style={th()}>週次</th><th style={th()}>標題</th>
              <th style={th()}>截止</th><th style={th()}>繳交</th>
              <th style={th()}>已發布</th><th style={th()}>操作</th>
            </tr></thead>
            <tbody>
              {sorted.map((a) => {
                const sCount = subs.filter((s) => s.assignmentId === a.assignmentId).length;
                return (
                  <tr key={a.assignmentId} style={{ borderTop: 'var(--border-soft)', opacity: a.published ? 1 : 0.55 }}>
                    <td style={{ ...td(), fontFamily: 'var(--font-mono)' }}>W{String(a.week).padStart(2, '0')}</td>
                    <td style={td()}>
                      <div style={{ fontWeight: 500 }}>{a.title}</div>
                      {a.description && <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 2 }}>{a.description}</div>}
                    </td>
                    <td style={{ ...td(), fontSize: 12 }}>{fmtD(a.dueAt)}</td>
                    <td style={td()}>{sCount} 份</td>
                    <td style={td()}>
                      <button onClick={() => toggle(a)} style={{
                        width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: a.published ? 'var(--brand-500)' : '#ccc', position: 'relative',
                      }}>
                        <div style={{
                          width: 14, height: 14, borderRadius: 7, background: 'white',
                          position: 'absolute', top: 3, left: a.published ? 19 : 3, transition: 'left .2s',
                        }} />
                      </button>
                    </td>
                    <td style={td()}>
                      <button onClick={() => setOpenEdit(a)} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>編輯</button>
                      <button onClick={() => del(a)} className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: '#dc2626' }}>刪除</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {openEdit && (
        <AssignmentEditor
          assignment={openEdit === 'new' ? null : openEdit}
          onClose={() => setOpenEdit(null)}
          onDone={() => { setOpenEdit(null); refresh(); }}
          toast={toast}
        />
      )}
    </div>
  );
}

function AssignmentEditor({ assignment, onClose, onDone, toast }) {
  const [week, setWeek] = React.useState(assignment?.week || 1);
  const [title, setTitle] = React.useState(assignment?.title || '');
  const [desc, setDesc] = React.useState(assignment?.description || '');
  const [dueAt, setDueAt] = React.useState(assignment ? toLocalInput(assignment.dueAt) : '');
  const [maxFiles, setMaxFiles] = React.useState(assignment?.maxFiles || 5);
  const [maxSizeMB, setMaxSizeMB] = React.useState(assignment?.maxSizeMB || 25);
  const [published, setPublished] = React.useState(assignment ? !!assignment.published : true);
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    if (!title || !week || !dueAt) return toast('週次/標題/截止時間必填', 'error');
    setBusy(true);
    const params = {
      ...window.BCC_API.teacherAuth(),
      week: +week, title, description: desc,
      dueAt: new Date(dueAt).toISOString(),
      maxFiles: +maxFiles, maxSizeMB: +maxSizeMB, published,
    };
    let r;
    if (assignment) {
      r = await window.BCC_API.api('updateAssignment', {
        ...window.BCC_API.teacherAuth(), assignmentId: assignment.assignmentId,
        patch: { week: +week, title, description: desc, dueAt: params.dueAt,
          maxFiles: +maxFiles, maxSizeMB: +maxSizeMB, published },
      });
    } else {
      r = await window.BCC_API.api('createAssignment', params);
    }
    setBusy(false);
    if (r.ok) { toast(assignment ? '已更新' : '已建立', 'ok'); onDone(); }
    else toast('失敗:' + r.error, 'error');
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: '92%', maxWidth: 520, padding: 24, background: 'white', maxHeight: '90vh', overflow: 'auto' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{assignment ? '編輯作業' : '新增作業'}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12, marginTop: 16 }}>
          <Lbl>週次</Lbl>
          <input type="number" min={1} max={20} className="input" value={week} onChange={(e) => setWeek(e.target.value)} />
          <Lbl>標題</Lbl>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如:HTML 基礎結構練習" />
          <Lbl>說明</Lbl>
          <textarea rows={3} className="input" value={desc} onChange={(e) => setDesc(e.target.value)}
            style={{ width: '100%', resize: 'vertical' }} placeholder="作業要求..." />
          <Lbl>截止時間</Lbl>
          <input type="datetime-local" className="input" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          <Lbl>檔案數上限</Lbl>
          <input type="number" min={1} max={20} className="input" value={maxFiles} onChange={(e) => setMaxFiles(e.target.value)} />
          <Lbl>單檔大小 (MB)</Lbl>
          <input type="number" min={1} max={50} className="input" value={maxSizeMB} onChange={(e) => setMaxSizeMB(e.target.value)} />
          <Lbl>立即發布</Lbl>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
            <span style={{ fontSize: 13 }}>{published ? '學生可以看到' : '草稿(學生看不到)'}</span>
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} disabled={busy} className="btn btn-ghost" style={{ flex: 1 }}>取消</button>
          <button onClick={submit} disabled={busy} className="btn btn-primary" style={{ flex: 1 }}>
            {busy ? '處理中…' : (assignment ? '儲存' : '建立')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Lbl({ children }) { return <div style={{ fontSize: 12, color: 'var(--ink-700)', fontWeight: 500, paddingTop: 9 }}>{children}</div>; }
function th() { return { textAlign: 'left', padding: '10px 14px', fontWeight: 500, fontSize: 11, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: 0.5 }; }
function td() { return { padding: '10px 14px' }; }
function fmtD(d) {
  if (!d) return '';
  const dt = new Date(d); if (isNaN(dt)) return d;
  return dt.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }) + ' ' + dt.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
}
function toLocalInput(d) {
  const dt = new Date(d); if (isNaN(dt)) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

window.AssignmentsAdminTab = AssignmentsAdminTab;
