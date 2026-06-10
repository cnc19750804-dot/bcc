// 老師後台 · 搬移工具 Tab
// 把某份作業的繳交記錄(整筆,含學號)搬到另一份作業

function MoveTab({ toast }) {
  const [assignments, setAssignments] = React.useState([]);
  const [submissions, setSubmissions] = React.useState([]);
  const [students, setStudents] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [fromId, setFromId] = React.useState('');
  const [toId, setToId] = React.useState('');
  const [picked, setPicked] = React.useState({}); // submissionId -> true
  const [moveDrive, setMoveDrive] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState('');

  async function refresh() {
    setLoading(true);
    const [r1, r2] = await Promise.all([
      window.BCC_API.api('listAllAssignments', { ...window.BCC_API.teacherAuth() }),
      window.BCC_API.api('listStudents', { ...window.BCC_API.teacherAuth() }),
    ]);
    if (r1.ok) {
      const a = [...(r1.assignments || [])].sort((x, y) => x.week - y.week);
      setAssignments(a);
      setSubmissions(r1.submissions || []);
      if (!fromId && a.length) setFromId(a[0].assignmentId);
    }
    if (r2.ok) setStudents(r2.students);
    setLoading(false);
  }
  React.useEffect(() => { refresh(); }, []);

  const nameOf = (sid) => {
    const s = students.find((x) => String(x.studentId) === String(sid));
    return s ? s.name : '';
  };

  // 來源作業的繳交,依繳交時間排序
  const rows = submissions
    .filter((s) => s.assignmentId === fromId)
    .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));

  const fileCount = (s) => { try { return JSON.parse(s.fileNames || '[]').length; } catch { return 0; } };
  const pickedIds = Object.keys(picked).filter((k) => picked[k]);

  function toggleAll(on) {
    if (!on) { setPicked({}); return; }
    const next = {};
    rows.forEach((r) => { next[r.submissionId] = true; });
    setPicked(next);
  }

  // 快速勾選:某日期(含)之後上傳的
  function pickAfter(dateStr) {
    const cut = new Date(dateStr);
    const next = {};
    rows.forEach((r) => { if (new Date(r.submittedAt) >= cut) next[r.submissionId] = true; });
    setPicked(next);
  }

  async function doMove() {
    if (!toId) return toast('請選擇目標週次', 'error');
    if (fromId === toId) return toast('來源與目標不能相同', 'error');
    if (pickedIds.length === 0) return toast('請至少勾選一筆', 'error');
    if (!confirm(`確定把 ${pickedIds.length} 筆繳交從來源搬到目標作業?學號不變。`)) return;
    setBusy(true);
    let done = 0, fail = 0;
    for (const sid of pickedIds) {
      setProgress(`搬移中… ${done + fail + 1}/${pickedIds.length}`);
      const r = await window.BCC_API.api('moveSubmission', {
        ...window.BCC_API.teacherAuth(),
        submissionId: sid, toAssignmentId: toId, moveDrive,
      });
      if (r.ok) done++; else fail++;
    }
    setBusy(false);
    setProgress('');
    setPicked({});
    toast(`完成:成功 ${done} 筆${fail ? ` · 失敗 ${fail} 筆` : ''}`, fail ? 'error' : 'ok');
    refresh();
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-500)' }}>載入中…</div>;

  const selStyle = { height: 34, padding: '0 10px', borderRadius: 8, border: '1px solid var(--ink-300, #d8d2c5)', fontSize: 13, background: 'white' };
  const aLabel = (a) => `W${String(a.week).padStart(2, '0')} · ${a.title}`;

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 6px' }}>搬移繳交記錄</h2>
      <p style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 16 }}>
        把選取的繳交(整筆,含學號與檔案)從來源作業搬到目標作業。常用於學生交錯週次。
      </p>

      {/* 來源 / 目標 選擇 */}
      <div className="card" style={{ padding: 16, marginBottom: 14, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: 'var(--ink-600)', fontWeight: 500 }}>來源週次</label>
          <select value={fromId} onChange={(e) => { setFromId(e.target.value); setPicked({}); }} style={selStyle}>
            {assignments.map((a) => <option key={a.assignmentId} value={a.assignmentId}>{aLabel(a)}（{submissions.filter(s => s.assignmentId === a.assignmentId).length} 份）</option>)}
          </select>
        </div>
        <div style={{ fontSize: 20, color: 'var(--ink-400)', paddingBottom: 4 }}>→</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: 'var(--ink-600)', fontWeight: 500 }}>目標週次</label>
          <select value={toId} onChange={(e) => setToId(e.target.value)} style={selStyle}>
            <option value="">— 請選擇 —</option>
            {assignments.filter((a) => a.assignmentId !== fromId).map((a) => <option key={a.assignmentId} value={a.assignmentId}>{aLabel(a)}</option>)}
          </select>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-600)', paddingBottom: 8 }}>
          <input type="checkbox" checked={moveDrive} onChange={(e) => setMoveDrive(e.target.checked)} />
          同時搬移雲端檔案(較慢但完整)
        </label>
      </div>

      {/* 快速勾選 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>快速勾選:</span>
        <button className="btn btn-ghost btn-sm" onClick={() => toggleAll(true)}>全選</button>
        <button className="btn btn-ghost btn-sm" onClick={() => toggleAll(false)}>全不選</button>
        <input type="date" id="mv-after" defaultValue="2026-05-21"
          style={{ height: 30, padding: '0 8px', borderRadius: 6, border: '1px solid var(--ink-300,#d8d2c5)', fontSize: 12 }} />
        <button className="btn btn-ghost btn-sm" onClick={() => pickAfter(document.getElementById('mv-after').value)}>
          勾選此日期(含)之後上傳
        </button>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--brand-700)', fontWeight: 600 }}>已選 {pickedIds.length} 筆</span>
      </div>

      {/* 繳交列表 */}
      <div className="card" style={{ padding: 0, overflow: 'auto', maxHeight: 460 }}>
        {rows.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-500)', fontSize: 13 }}>此作業目前沒有繳交記錄</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: 'var(--bg-soft,#f7f5f0)' }}>
              <th style={mth(40)}></th>
              <th style={mth()}>學號</th>
              <th style={mth()}>姓名</th>
              <th style={mth()}>繳交時間</th>
              <th style={mth()}>檔案數</th>
              <th style={mth()}>狀態</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => {
                const on = !!picked[r.submissionId];
                return (
                  <tr key={r.submissionId}
                    onClick={() => setPicked((p) => ({ ...p, [r.submissionId]: !p[r.submissionId] }))}
                    style={{ borderTop: '1px solid var(--ink-100,#eee)', cursor: 'pointer', background: on ? 'var(--brand-50,#eef2ff)' : 'white' }}>
                    <td style={mtd()}><input type="checkbox" checked={on} readOnly /></td>
                    <td style={{ ...mtd(), fontFamily: 'var(--font-mono)' }}>{r.studentId}</td>
                    <td style={mtd()}>{nameOf(r.studentId)}</td>
                    <td style={mtd()}>{fmtMv(r.submittedAt)}</td>
                    <td style={mtd()}>{fileCount(r)}</td>
                    <td style={mtd()}>{r.state === 'late' ? '逾期' : (r.state === 'graded' ? '已評分' : '已繳交')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
        <button className="btn btn-primary" disabled={busy || pickedIds.length === 0 || !toId} onClick={doMove}>
          {busy ? (progress || '搬移中…') : `搬移選取的 ${pickedIds.length} 筆 →`}
        </button>
        {busy && <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>請勿關閉視窗</span>}
      </div>
    </div>
  );
}

function mth(w) { return { textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 500, color: 'var(--ink-500)', width: w || 'auto' }; }
function mtd() { return { padding: '8px 12px' }; }
function fmtMv(d) {
  if (!d) return '—';
  const dt = new Date(d); if (isNaN(dt)) return String(d);
  return dt.toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

window.MoveTab = MoveTab;
