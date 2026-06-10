// 老師後台 · 搬移工具(兩種模式)
//  1) 搬移繳交：把繳交整筆或單一檔案,搬到別的學號/週次
//  2) 從雲端匯入：從 Google Drive 任一資料夾挑檔,匯入成某學號某週次的繳交

function MoveTab({ toast }) {
  const [mode, setMode] = React.useState('move'); // move | import
  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 12px' }}>搬移 / 匯入</h2>
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg-soft,#f3f0ea)', padding: 3, borderRadius: 8, marginBottom: 16, width: 'fit-content' }}>
        {[['move', '搬移繳交'], ['import', '從雲端匯入']].map(([v, l]) => (
          <button key={v} onClick={() => setMode(v)} style={{
            padding: '6px 16px', fontSize: 13, fontWeight: mode === v ? 600 : 500, border: 'none', borderRadius: 6,
            cursor: 'pointer', background: mode === v ? 'white' : 'transparent',
            color: mode === v ? 'var(--ink-900)' : 'var(--ink-500)',
            boxShadow: mode === v ? '0 1px 2px rgba(0,0,0,.06)' : 'none',
          }}>{l}</button>
        ))}
      </div>
      {mode === 'move' ? <MoveSection toast={toast} /> : <ImportSection toast={toast} />}
    </div>
  );
}

// ════ 共用資料載入 ════
function useTeacherData() {
  const [assignments, setAssignments] = React.useState([]);
  const [submissions, setSubmissions] = React.useState([]);
  const [students, setStudents] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const reload = React.useCallback(async () => {
    setLoading(true);
    const [r1, r2] = await Promise.all([
      window.BCC_API.api('listAllAssignments', { ...window.BCC_API.teacherAuth() }),
      window.BCC_API.api('listStudents', { ...window.BCC_API.teacherAuth() }),
    ]);
    if (r1.ok) {
      setAssignments([...(r1.assignments || [])].sort((a, b) => a.week - b.week));
      setSubmissions(r1.submissions || []);
    }
    if (r2.ok) setStudents(r2.students);
    setLoading(false);
  }, []);
  React.useEffect(() => { reload(); }, [reload]);
  return { assignments, submissions, students, loading, reload };
}

const aLabel = (a) => `W${String(a.week).padStart(2, '0')} · ${a.title}`;
const mvSel = { height: 32, padding: '0 8px', borderRadius: 7, border: '1px solid var(--ink-300,#d8d2c5)', fontSize: 12, background: 'white' };
function parseArr(s) { try { return JSON.parse(s || '[]'); } catch { return []; } }
function fmtMv(d) {
  if (!d) return '—';
  const dt = new Date(d); if (isNaN(dt)) return String(d);
  return dt.toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ════ 模式 1:搬移繳交(整筆 / 單檔)════
function MoveSection({ toast }) {
  const { assignments, submissions, students, loading, reload } = useTeacherData();
  const [fromId, setFromId] = React.useState('');
  const [expand, setExpand] = React.useState({}); // submissionId -> bool
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!fromId && assignments.length) setFromId(assignments[0].assignmentId);
  }, [assignments, fromId]);

  const nameOf = (sid) => { const s = students.find((x) => String(x.studentId) === String(sid)); return s ? s.name : ''; };
  const rows = submissions.filter((s) => s.assignmentId === fromId)
    .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));

  async function moveWhole(sub, toId) {
    if (!toId) return;
    if (!confirm(`把 ${sub.studentId} ${nameOf(sub.studentId)} 整筆繳交搬到目標週次?`)) return;
    setBusy(true);
    const r = await window.BCC_API.api('moveSubmission', { ...window.BCC_API.teacherAuth(), submissionId: sub.submissionId, toAssignmentId: toId, moveDrive: true });
    setBusy(false);
    if (r.ok) { toast('已搬移整筆', 'ok'); reload(); } else toast('失敗:' + r.error, 'error');
  }

  async function moveOneFile(sub, fileId, fileName, toStudentId, toId) {
    if (!toId) return toast('請選目標週次', 'error');
    setBusy(true);
    const r = await window.BCC_API.api('moveSubmissionFile', {
      ...window.BCC_API.teacherAuth(), submissionId: sub.submissionId, fileId,
      toStudentId: toStudentId || sub.studentId, toAssignmentId: toId, moveDrive: true,
    });
    setBusy(false);
    if (r.ok) { toast(`已搬移檔案「${fileName}」`, 'ok'); reload(); } else toast('失敗:' + r.error, 'error');
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>載入中…</div>;

  return (
    <div>
      <div className="card" style={{ padding: 14, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--ink-600)', fontWeight: 500 }}>來源週次</span>
        <select value={fromId} onChange={(e) => { setFromId(e.target.value); setExpand({}); }} style={{ ...mvSel, height: 34 }}>
          {assignments.map((a) => <option key={a.assignmentId} value={a.assignmentId}>{aLabel(a)}（{submissions.filter(s => s.assignmentId === a.assignmentId).length} 份）</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--ink-400)', marginLeft: 'auto' }}>點「展開」可搬移單一檔案</span>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {rows.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-500)', fontSize: 13 }}>此作業目前沒有繳交記錄</div>
        ) : rows.map((sub) => {
          const ids = parseArr(sub.fileIds), names = parseArr(sub.fileNames);
          const open = !!expand[sub.submissionId];
          return (
            <div key={sub.submissionId} style={{ borderTop: '1px solid var(--ink-100,#eee)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, minWidth: 86 }}>{sub.studentId}</span>
                <span style={{ fontSize: 13, minWidth: 64 }}>{nameOf(sub.studentId)}</span>
                <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>{fmtMv(sub.submittedAt)}</span>
                <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>{names.length} 檔</span>
                <span style={{ fontSize: 11, color: sub.state === 'late' ? '#d97706' : 'var(--ink-400)' }}>{sub.state === 'late' ? '逾期' : (sub.state === 'graded' ? '已評分' : '已繳交')}</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                  <select id={`whole-${sub.submissionId}`} defaultValue="" style={mvSel} disabled={busy}>
                    <option value="">整筆搬到…</option>
                    {assignments.filter(a => a.assignmentId !== fromId).map(a => <option key={a.assignmentId} value={a.assignmentId}>{aLabel(a)}</option>)}
                  </select>
                  <button className="btn btn-ghost btn-sm" disabled={busy}
                    onClick={() => moveWhole(sub, document.getElementById(`whole-${sub.submissionId}`).value)}>搬</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setExpand((p) => ({ ...p, [sub.submissionId]: !p[sub.submissionId] }))}>
                    {open ? '收合' : '展開'}
                  </button>
                </div>
              </div>
              {open && (
                <div style={{ background: 'var(--bg-soft,#faf9f6)', padding: '4px 14px 12px' }}>
                  {names.length === 0 && <div style={{ fontSize: 12, color: 'var(--ink-400)', padding: 8 }}>(無檔案)</div>}
                  {names.map((n, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', fontSize: 12 }}>
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📄 {n}</span>
                      <select id={`fstu-${sub.submissionId}-${i}`} defaultValue={sub.studentId} style={mvSel} title="目標學號">
                        {students.map((st) => <option key={st.studentId} value={st.studentId}>{st.studentId} {st.name}</option>)}
                      </select>
                      <select id={`fwk-${sub.submissionId}-${i}`} defaultValue="" style={mvSel} title="目標週次">
                        <option value="">週次…</option>
                        {assignments.map(a => <option key={a.assignmentId} value={a.assignmentId}>{aLabel(a)}</option>)}
                      </select>
                      <button className="btn btn-ghost btn-sm" disabled={busy}
                        onClick={() => moveOneFile(sub, ids[i], n,
                          document.getElementById(`fstu-${sub.submissionId}-${i}`).value,
                          document.getElementById(`fwk-${sub.submissionId}-${i}`).value)}>搬此檔</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════ 模式 2:從雲端資料夾匯入 ════
function ImportSection({ toast }) {
  const { assignments, students, loading } = useTeacherData();
  const [folderInput, setFolderInput] = React.useState('');
  const [folderName, setFolderName] = React.useState('');
  const [files, setFiles] = React.useState([]);
  const [scanning, setScanning] = React.useState(false);
  const [busyId, setBusyId] = React.useState('');
  const [copy, setCopy] = React.useState(true);

  async function scan() {
    if (!folderInput.trim()) return toast('請貼上資料夾連結或 ID', 'error');
    setScanning(true); setFiles([]);
    const r = await window.BCC_API.api('listDriveFolder', { ...window.BCC_API.teacherAuth(), folderId: folderInput.trim() });
    setScanning(false);
    if (!r.ok) return toast('讀取失敗:' + r.error, 'error');
    setFolderName(r.folderName || '');
    setFiles(r.files || []);
    if ((r.files || []).length === 0) toast('資料夾內沒有檔案', 'info');
  }

  async function importOne(f) {
    const stu = document.getElementById(`imp-stu-${f.fileId}`).value;
    const wk = document.getElementById(`imp-wk-${f.fileId}`).value;
    if (!stu || !wk) return toast('請選擇學號與週次', 'error');
    setBusyId(f.fileId);
    const r = await window.BCC_API.api('importDriveFile', {
      ...window.BCC_API.teacherAuth(), fileId: f.fileId, fileName: f.name,
      studentId: stu, assignmentId: wk, copy,
    });
    setBusyId('');
    if (r.ok) { toast(`已匯入「${f.name}」`, 'ok'); if (!copy) setFiles((arr) => arr.filter(x => x.fileId !== f.fileId)); }
    else toast('失敗:' + r.error, 'error');
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>載入中…</div>;

  return (
    <div>
      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: 'var(--ink-600)', marginBottom: 8, lineHeight: 1.6 }}>
          學生可把作業直接傳到您指定的 <b>Google Drive 資料夾</b>(避開 GitHub 不穩)。<br />
          在此貼上該資料夾的<b>分享連結或 ID</b> → 掃描 → 為每個檔案指定學號與週次後匯入。
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={folderInput} onChange={(e) => setFolderInput(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/xxxx 或直接貼 ID"
            style={{ flex: 1, height: 36, padding: '0 12px', borderRadius: 8, border: '1px solid var(--ink-300,#d8d2c5)', fontSize: 13 }} />
          <button className="btn btn-primary" disabled={scanning} onClick={scan}>{scanning ? '掃描中…' : '掃描資料夾'}</button>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-600)', marginTop: 10 }}>
          <input type="checkbox" checked={copy} onChange={(e) => setCopy(e.target.checked)} />
          複製檔案(保留原資料夾的檔案);取消勾選則直接搬移
        </label>
      </div>

      {files.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', background: 'var(--bg-soft,#f7f5f0)', fontSize: 12, color: 'var(--ink-600)' }}>
            📁 {folderName} · {files.length} 個檔案
          </div>
          {files.map((f) => (
            <div key={f.fileId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderTop: '1px solid var(--ink-100,#eee)' }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📄 {f.name}</span>
              <span style={{ fontSize: 11, color: 'var(--ink-400)' }}>{fmtMv(f.updated)}</span>
              <select id={`imp-stu-${f.fileId}`} defaultValue="" style={mvSel} title="指定學號">
                <option value="">學號…</option>
                {students.map((st) => <option key={st.studentId} value={st.studentId}>{st.studentId} {st.name}</option>)}
              </select>
              <select id={`imp-wk-${f.fileId}`} defaultValue="" style={mvSel} title="指定週次">
                <option value="">週次…</option>
                {assignments.map(a => <option key={a.assignmentId} value={a.assignmentId}>{aLabel(a)}</option>)}
              </select>
              <button className="btn btn-primary btn-sm" disabled={busyId === f.fileId} onClick={() => importOne(f)}>
                {busyId === f.fileId ? '匯入中…' : '匯入'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

window.MoveTab = MoveTab;
