/**
 * 資訊科技課程作業系統 — Apps Script 後端
 *
 * 部署方式:
 *   1. 在 Google Sheet 中:擴充功能 → Apps Script
 *   2. 把這個檔案貼到 Code.gs,把 Email.html 也貼成另一個 HTML 檔
 *   3. 執行 setup() 一次,初始化資料表
 *   4. 部署 → 新部署 → 類型「網路應用程式」
 *      • 執行身分:我
 *      • 存取權:任何人(API 自己會檢查學號密碼)
 *   5. 取得網址,貼到前端 HTML 的 API_URL 變數
 */

// ─── 設定 ────────────────────────────────────────────────
const CONFIG = {
  ROOT_FOLDER_NAME: '資訊科技課程作業系統',
  SYSTEM_FOLDER_NAME: '_system',
  COURSE_NAME: '資訊科技與生活',
  TEACHER_EMAIL: Session.getActiveUser().getEmail(),  // 部署者
  FRONTEND_URL: 'https://cnc19750804-dot.github.io/bcc/',  // 學生使用的網址,密碼重設信會帶這個
  DEFAULT_PASSWORD: '00000000',  // 預設密碼(學生首次登入後強制修改)
  RESET_TOKEN_TTL_MIN: 30,
  SESSION_TTL_HOURS: 8,
  SHEETS: {
    students: 'Students',
    assignments: 'Assignments',
    submissions: 'Submissions',
    materials: 'Materials',
    resetTokens: 'ResetTokens',
    auditLog: 'AuditLog',
  },
};

// ─── HTTP 進入點 ──────────────────────────────────────────
function doGet(e)  { return handle(e, 'GET'); }
function doPost(e) { return handle(e, 'POST'); }

function handle(e, method) {
  try {
    const params = method === 'POST' && e.postData
      ? JSON.parse(e.postData.contents || '{}')
      : (e.parameter || {});
    const action = params.action || (e.parameter && e.parameter.action);
    const handler = ACTIONS[action];
    if (!handler) return json({ ok: false, error: 'unknown_action: ' + action });
    return json(handler(params));
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err) });
  }
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── 公開 API ─────────────────────────────────────────────
const ACTIONS = {
  ping: () => ({ ok: true, time: new Date().toISOString() }),

  // 登入:回傳 sessionToken
  login: ({ studentId, password }) => {
    const s = findStudent(studentId);
    if (!s) return { ok: false, error: 'invalid_credentials' };
    if (s.status === 'disabled') return { ok: false, error: 'account_disabled' };
    if (!verifyPassword(password, s.salt, s.passwordHash)) {
      audit(studentId, 'login_failed', studentId, {});
      return { ok: false, error: 'invalid_credentials' };
    }
    updateStudent(studentId, { lastLogin: new Date() });
    audit(studentId, 'login', studentId, {});
    return {
      ok: true,
      session: createSession(studentId),
      mustChangePassword: s.mustChangePassword === true || s.mustChangePassword === 'TRUE',
      hasEmail: !!s.email,
      role: s.role || 'student',
      profile: { studentId: s.studentId, name: s.name, email: s.email, role: s.role || 'student' },
    };
  },

  // 首次設定:設密碼 + 設 Email
  completeSetup: ({ session, newPassword, email }) => {
    const sid = verifySession(session);
    if (!sid) return { ok: false, error: 'invalid_session' };
    if (!isStrongPassword(newPassword)) return { ok: false, error: 'weak_password' };
    if (email && !isValidEmail(email)) return { ok: false, error: 'invalid_email' };
    const { hash, salt } = hashPassword(newPassword);
    updateStudent(sid, {
      passwordHash: hash, salt: salt,
      email: email || '', emailVerified: !!email,
      mustChangePassword: false, status: 'active',
    });
    audit(sid, 'setup_complete', sid, { hasEmail: !!email });
    if (email) sendWelcomeEmail(sid, email);
    return { ok: true };
  },

  // 取得當前登入學生的資料
  me: ({ session }) => {
    const sid = verifySession(session);
    if (!sid) return { ok: false, error: 'invalid_session' };
    const s = findStudent(sid);
    if (!s) return { ok: false, error: 'student_not_found' };
    return { ok: true, profile: {
      studentId: s.studentId, name: s.name, email: s.email || '',
      status: s.status, role: s.role || 'student',
      mustChangePassword: s.mustChangePassword === true || s.mustChangePassword === 'TRUE',
    } };
  },

  // 學生:只更新 Email(不動密碼)
  updateEmail: ({ session, email }) => {
    const sid = verifySession(session);
    if (!sid) return { ok: false, error: 'invalid_session' };
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'invalid_email' };
    updateStudent(sid, { email: email || '' });
    audit(sid, 'email_updated', sid, { email: maskEmail(email || '') });
    return { ok: true };
  },

  // 學生請求重設密碼
  requestReset: ({ studentId }) => {
    const s = findStudent(studentId);
    // 故意不洩漏學號是否存在(防枚舉)
    if (!s || !s.email) return { ok: true, sent: false };
    const token = randomToken(32);
    const expiresAt = new Date(Date.now() + CONFIG.RESET_TOKEN_TTL_MIN * 60 * 1000);
    appendRow(CONFIG.SHEETS.resetTokens, [token, studentId, new Date(), expiresAt, '', '']);
    sendResetEmail(s.email, s.name, token);
    audit(studentId, 'reset_requested', studentId, {});
    return { ok: true, sent: true, masked: maskEmail(s.email) };
  },

  // 老師重設(臨時密碼或寄信)
  teacherReset: ({ session, teacherKey, studentId, mode, tempPassword }) => {
    const actor = authTeacher({ session, teacherKey });
    if (!actor) return { ok: false, error: 'unauthorized' };
    const s = findStudent(studentId);
    if (!s) return { ok: false, error: 'not_found' };
    if (mode === 'email') {
      if (!s.email) return { ok: false, error: 'no_email_bound' };
      return ACTIONS.requestReset({ studentId });
    }
    if (mode === 'temp') {
      const pw = tempPassword || ('Temp@' + Math.floor(Math.random() * 9000 + 1000));
      const { hash, salt } = hashPassword(pw);
      updateStudent(studentId, { passwordHash: hash, salt: salt, mustChangePassword: true });
      audit(actor, 'temp_password_set', studentId, {});
      return { ok: true, tempPassword: pw };
    }
    return { ok: false, error: 'invalid_mode' };
  },

  // 用 token 重設密碼
  resetWithToken: ({ token, newPassword }) => {
    const sheet = getSheet(CONFIG.SHEETS.resetTokens);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] !== token) continue;
      if (data[i][4]) return { ok: false, error: 'token_used' };
      if (new Date(data[i][3]) < new Date()) return { ok: false, error: 'token_expired' };
      if (!isStrongPassword(newPassword)) return { ok: false, error: 'weak_password' };
      const sid = data[i][1];
      const { hash, salt } = hashPassword(newPassword);
      updateStudent(sid, { passwordHash: hash, salt: salt, mustChangePassword: false });
      sheet.getRange(i + 1, 5).setValue(new Date());
      audit(sid, 'reset_complete', sid, {});
      return { ok: true };
    }
    return { ok: false, error: 'token_not_found' };
  },

  // 老師建立學生(單筆)
  createStudent: ({ session, teacherKey, studentId, name }) => {
    const actor = authTeacher({ session, teacherKey });
    if (!actor) return { ok: false, error: 'unauthorized' };
    if (findStudent(studentId)) return { ok: false, error: 'already_exists' };
    const defaultPw = CONFIG.DEFAULT_PASSWORD;
    const { hash, salt } = hashPassword(defaultPw);
    const folder = ensureStudentFolder(studentId, name);
    appendRow(CONFIG.SHEETS.students, [
      studentId, name, '', false, hash, salt, true,
      folder.getId(), 'pending', new Date(), '', 'student',
    ]);
    audit(actor, 'student_created', studentId, { defaultPw });
    return { ok: true, defaultPassword: defaultPw, folderUrl: folder.getUrl() };
  },

  // 列出學生(老師)
  listStudents: ({ session, teacherKey }) => {
    if (!authTeacher({ session, teacherKey })) return { ok: false, error: 'unauthorized' };
    const rows = readSheet(CONFIG.SHEETS.students);
    return { ok: true, students: rows.map((r) => ({
      studentId: r.studentId, name: r.name, email: r.email,
      status: r.status, createdAt: r.createdAt, lastLogin: r.lastLogin,
      role: r.role || 'student',
    })).filter((r) => r.role !== 'teacher') };
  },

  // 學生作業列表
  myAssignments: ({ session }) => {
    const _v = verifyActiveSession(session);
    if (_v.error) return { ok: false, error: _v.error };
    const sid = _v.sid;
    const assignments = readSheet(CONFIG.SHEETS.assignments).filter((a) => a.published);
    const subs = readSheet(CONFIG.SHEETS.submissions).filter((s) => s.studentId === sid);
    return { ok: true, assignments, submissions: subs };
  },

  // 老師:列出全部作業(含未發布)
  listAllAssignments: ({ session, teacherKey }) => {
    if (!authTeacher({ session, teacherKey })) return { ok: false, error: 'unauthorized' };
    const assignments = readSheet(CONFIG.SHEETS.assignments);
    const submissions = readSheet(CONFIG.SHEETS.submissions);
    return { ok: true, assignments, submissions };
  },

  // 老師:新增作業
  createAssignment: ({ session, teacherKey, week, title, description, dueAt, allowedTypes, maxFiles, maxSizeMB, published, lateAllowed }) => {
    const actor = authTeacher({ session, teacherKey });
    if (!actor) return { ok: false, error: 'unauthorized' };
    if (!week || !title || !dueAt) return { ok: false, error: 'missing_fields' };
    const assignmentId = 'w' + String(week).padStart(2, '0') + '_' + Utilities.getUuid().slice(0, 6);
    appendRow(CONFIG.SHEETS.assignments, [
      assignmentId, +week, title, description || '', new Date(dueAt),
      JSON.stringify(allowedTypes || []), +maxFiles || 5, +maxSizeMB || 25,
      !!published, new Date(), lateAllowed !== false,
    ]);
    audit(actor, 'assignment_created', assignmentId, { title });
    return { ok: true, assignmentId };
  },

  // 老師:更新作業
  updateAssignment: ({ session, teacherKey, assignmentId, patch }) => {
    if (!authTeacher({ session, teacherKey })) return { ok: false, error: 'unauthorized' };
    const sheet = getSheet(CONFIG.SHEETS.assignments);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idCol = headers.indexOf('assignmentId');
    for (let i = 1; i < data.length; i++) {
      if (data[i][idCol] === assignmentId) {
        Object.keys(patch).forEach((k) => {
          const c = headers.indexOf(k);
          if (c >= 0) {
            let v = patch[k];
            if (k === 'dueAt') v = new Date(v);
            if (k === 'allowedTypes') v = JSON.stringify(v);
            sheet.getRange(i + 1, c + 1).setValue(v);
          }
        });
        return { ok: true };
      }
    }
    return { ok: false, error: 'not_found' };
  },

  // 老師:刪除作業
  deleteAssignment: ({ session, teacherKey, assignmentId }) => {
    const actor = authTeacher({ session, teacherKey });
    if (!actor) return { ok: false, error: 'unauthorized' };
    deleteSheetRow(CONFIG.SHEETS.assignments, 'assignmentId', assignmentId);
    audit(actor, 'assignment_deleted', assignmentId, {});
    return { ok: true };
  },

  // 上傳檔案(base64)
  uploadFile: ({ session, assignmentId, fileName, mimeType, base64 }) => {
    const _v = verifyActiveSession(session);
    if (_v.error) return { ok: false, error: _v.error };
    const sid = _v.sid;
    const s = findStudent(sid);
    const folder = DriveApp.getFolderById(s.folderId);
    const subFolder = ensureSubFolder(folder, assignmentId);
    const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, fileName);
    const file = subFolder.createFile(blob);
    audit(sid, 'upload', assignmentId, { fileName, fileId: file.getId() });
    return { ok: true, fileId: file.getId(), url: file.getUrl() };
  },

  // 下載檔案(學生抓自己的繳交檔)
  downloadFile: ({ session, fileId }) => {
    const _v = verifyActiveSession(session);
    if (_v.error) return { ok: false, error: _v.error };
    const sid = _v.sid;
    // 確認這個檔案是這位學生交過的
    const subs = readSheet(CONFIG.SHEETS.submissions).filter((x) => x.studentId === sid);
    const owned = subs.some((s) => {
      try { return JSON.parse(s.fileIds || '[]').indexOf(fileId) >= 0; } catch { return false; }
    });
    if (!owned) return { ok: false, error: 'forbidden' };
    try {
      const file = DriveApp.getFileById(fileId);
      const blob = file.getBlob();
      return {
        ok: true,
        fileName: file.getName(),
        mimeType: blob.getContentType(),
        base64: Utilities.base64Encode(blob.getBytes()),
      };
    } catch (e) { return { ok: false, error: 'file_not_found' }; }
  },

  // 下載教材(學生)
  downloadMaterial: ({ session, materialId }) => {
    const _v = verifyActiveSession(session);
    if (_v.error) return { ok: false, error: _v.error };
    const sid = _v.sid;
    const m = readSheet(CONFIG.SHEETS.materials).find((x) => x.materialId === materialId);
    if (!m || !m.published) return { ok: false, error: 'not_found' };
    try {
      const file = DriveApp.getFileById(m.fileId);
      const blob = file.getBlob();
      audit(sid, 'material_downloaded', materialId, {});
      return {
        ok: true,
        fileName: file.getName(),
        mimeType: blob.getContentType(),
        base64: Utilities.base64Encode(blob.getBytes()),
      };
    } catch (e) { return { ok: false, error: 'file_not_found' }; }
  },

  // 老師下載任何檔案
  teacherDownload: ({ session, teacherKey, fileId }) => {
    const actor = authTeacher({ session, teacherKey });
    if (!actor) return { ok: false, error: 'unauthorized' };
    try {
      const file = DriveApp.getFileById(fileId);
      const blob = file.getBlob();
      return {
        ok: true,
        fileName: file.getName(),
        mimeType: blob.getContentType(),
        base64: Utilities.base64Encode(blob.getBytes()),
      };
    } catch (e) { return { ok: false, error: 'file_not_found' }; }
  },

  // 提交作業(將 draft 轉為 submitted)
  submitAssignment: ({ session, assignmentId, fileIds, fileNames, note }) => {
    const _v = verifyActiveSession(session);
    if (_v.error) return { ok: false, error: _v.error };
    const sid = _v.sid;
    const a = readSheet(CONFIG.SHEETS.assignments).find((x) => x.assignmentId === assignmentId);
    if (!a) return { ok: false, error: 'assignment_not_found' };
    const isLate = new Date() > new Date(a.dueAt);
    // 逾期且這份作業不允許逾期繳交 → 拒收
    if (isLate && a.lateAllowed === false) return { ok: false, error: 'past_due_locked' };
    appendRow(CONFIG.SHEETS.submissions, [
      Utilities.getUuid(), sid, assignmentId,
      isLate ? 'late' : 'submitted',
      JSON.stringify(fileIds || []), JSON.stringify(fileNames || []),
      note || '', new Date(), '', '', '', 1,
    ]);
    audit(sid, 'submit', assignmentId, { isLate });
    return { ok: true, late: isLate };
  },

  // 學生:刪除自己繳交的某個檔案
  deleteSubmissionFile: ({ session, submissionId, fileId }) => {
    const _v = verifyActiveSession(session);
    if (_v.error) return { ok: false, error: _v.error };
    const sid = _v.sid;
    const sheet = getSheet(CONFIG.SHEETS.submissions);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idCol = headers.indexOf('submissionId');
    const sidCol = headers.indexOf('studentId');
    const fidsCol = headers.indexOf('fileIds');
    const fnamesCol = headers.indexOf('fileNames');
    const stateCol = headers.indexOf('state');
    for (let i = 1; i < data.length; i++) {
      if (data[i][idCol] !== submissionId) continue;
      if (String(data[i][sidCol]) !== String(sid)) return { ok: false, error: 'forbidden' };
      if (data[i][stateCol] === 'graded') return { ok: false, error: 'already_graded' };
      let ids = [], names = [];
      try { ids = JSON.parse(data[i][fidsCol] || '[]'); } catch {}
      try { names = JSON.parse(data[i][fnamesCol] || '[]'); } catch {}
      const idx = ids.indexOf(fileId);
      if (idx < 0) return { ok: false, error: 'file_not_found' };
      ids.splice(idx, 1); names.splice(idx, 1);
      sheet.getRange(i + 1, fidsCol + 1).setValue(JSON.stringify(ids));
      sheet.getRange(i + 1, fnamesCol + 1).setValue(JSON.stringify(names));
      // 嘗試把 Drive 的檔案移到垃圾桶
      try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) {}
      audit(sid, 'delete_submission_file', submissionId, { fileId });
      return { ok: true, remaining: ids.length };
    }
    return { ok: false, error: 'submission_not_found' };
  },

  // ─── 教材 API ───────────────────────────────────────────

  // 學生 / 老師都可呼叫:列出已發布的教材
  listMaterials: ({ session }) => {
    const _v = verifyActiveSession(session);
    if (_v.error) return { ok: false, error: _v.error };
    const sid = _v.sid;
    const rows = readSheet(CONFIG.SHEETS.materials).filter((m) => m.published);
    return { ok: true, materials: rows };
  },

  // 老師:列出全部教材(含未發布)
  listAllMaterials: ({ session, teacherKey }) => {
    if (!authTeacher({ session, teacherKey })) return { ok: false, error: 'unauthorized' };
    return { ok: true, materials: readSheet(CONFIG.SHEETS.materials) };
  },

  // 老師:新增教材(上傳檔案到系統資料夾)
  createMaterial: ({ session, teacherKey, week, title, description, fileName, mimeType, base64, published }) => {
    const actor = authTeacher({ session, teacherKey });
    if (!actor) return { ok: false, error: 'unauthorized' };
    const root = ensureRootFolder();
    const matFolder = ensureSubFolder(root, '_materials');
    const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, fileName);
    const file = matFolder.createFile(blob);
    const materialId = 'M' + Utilities.getUuid().slice(0, 8);
    appendRow(CONFIG.SHEETS.materials, [
      materialId, week, title, description || '',
      file.getId(), fileName, file.getSize(), guessFileType(fileName),
      published !== false, new Date(),
    ]);
    audit(actor, 'material_created', materialId, { title, week });
    return { ok: true, materialId, fileId: file.getId() };
  },

  // 老師:切換發布狀態
  toggleMaterial: ({ session, teacherKey, materialId, published }) => {
    const actor = authTeacher({ session, teacherKey });
    if (!actor) return { ok: false, error: 'unauthorized' };
    updateMaterial(materialId, { published: !!published });
    audit(actor, 'material_toggled', materialId, { published });
    return { ok: true };
  },

  // 老師:刪除教材
  deleteMaterial: ({ session, teacherKey, materialId }) => {
    if (!authTeacher({ session, teacherKey })) return { ok: false, error: 'unauthorized' };
    const m = readSheet(CONFIG.SHEETS.materials).find((x) => x.materialId === materialId);
    if (m && m.fileId) {
      try { DriveApp.getFileById(m.fileId).setTrashed(true); } catch (e) {}
    }
    deleteSheetRow(CONFIG.SHEETS.materials, 'materialId', materialId);
    audit('teacher', 'material_deleted', materialId, {});
    return { ok: true };
  },

  // 學生:取得單一教材的下載連結
  getMaterialUrl: ({ session, materialId }) => {
    const _v = verifyActiveSession(session);
    if (_v.error) return { ok: false, error: _v.error };
    const sid = _v.sid;
    const m = readSheet(CONFIG.SHEETS.materials).find((x) => x.materialId === materialId);
    if (!m || !m.published) return { ok: false, error: 'not_found' };
    const file = DriveApp.getFileById(m.fileId);
    audit(sid, 'material_viewed', materialId, {});
    return { ok: true, url: file.getUrl(), downloadUrl: 'https://drive.google.com/uc?export=download&id=' + m.fileId };
  },
};

function updateMaterial(materialId, patch) {
  const sheet = getSheet(CONFIG.SHEETS.materials);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('materialId');
  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === materialId) {
      Object.keys(patch).forEach((k) => {
        const c = headers.indexOf(k);
        if (c >= 0) sheet.getRange(i + 1, c + 1).setValue(patch[k]);
      });
      return true;
    }
  }
  return false;
}

function deleteSheetRow(sheetName, idField, idValue) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  const idCol = data[0].indexOf(idField);
  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === idValue) { sheet.deleteRow(i + 1); return true; }
  }
  return false;
}

function guessFileType(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const map = {
    pdf: 'pdf', doc: 'doc', docx: 'doc',
    ppt: 'ppt', pptx: 'ppt', key: 'ppt',
    xls: 'xls', xlsx: 'xls', csv: 'xls',
    zip: 'zip', rar: 'zip', '7z': 'zip',
    jpg: 'img', jpeg: 'img', png: 'img', gif: 'img', webp: 'img',
    mp4: 'video', mov: 'video', webm: 'video', avi: 'video',
    mp3: 'audio', wav: 'audio', m4a: 'audio',
  };
  return map[ext] || 'file';
}

// ─── 工具函式 ─────────────────────────────────────────────
function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function readSheet(name) {
  const sheet = getSheet(name);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map((row) => {
    const o = {};
    headers.forEach((h, i) => { o[h] = row[i]; });
    return o;
  });
}

function appendRow(name, row) { getSheet(name).appendRow(row); }

function findStudent(studentId) {
  return readSheet(CONFIG.SHEETS.students).find((s) => String(s.studentId) === String(studentId));
}

function updateStudent(studentId, patch) {
  const sheet = getSheet(CONFIG.SHEETS.students);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) !== String(studentId)) continue;
    Object.keys(patch).forEach((k) => {
      const col = headers.indexOf(k);
      if (col >= 0) sheet.getRange(i + 1, col + 1).setValue(patch[k]);
    });
    return;
  }
}

function hashPassword(password, saltIn) {
  const salt = saltIn || randomToken(16);
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password + ':' + salt,
    Utilities.Charset.UTF_8,
  );
  const hash = bytes.map((b) => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
  return { hash, salt };
}

function verifyPassword(password, salt, expectedHash) {
  return hashPassword(password, salt).hash === expectedHash;
}

function isStrongPassword(pw) {
  return pw && pw.length >= 8 && /[A-Z]/.test(pw) && /[0-9]/.test(pw);
}
function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

function randomToken(len) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function maskEmail(e) {
  const [u, d] = e.split('@');
  return u[0] + '•••••@' + d;
}

// ─── Session(用 Properties 存,簡單版)────────────────────
function createSession(studentId) {
  const token = randomToken(32);
  const expires = Date.now() + CONFIG.SESSION_TTL_HOURS * 3600 * 1000;
  PropertiesService.getScriptProperties().setProperty(
    'session_' + token, JSON.stringify({ studentId, expires })
  );
  return token;
}

function verifySession(token) {
  if (!token) return null;
  const raw = PropertiesService.getScriptProperties().getProperty('session_' + token);
  if (!raw) return null;
  const s = JSON.parse(raw);
  if (s.expires < Date.now()) return null;
  return s.studentId;
}

// 嚴格模式:必須通過 mustChangePassword 檢查,正常 API 應該用這個
// 回傳 { sid, error }; 若 error 不為 null,API 應立刻 return { ok:false, error }
function verifyActiveSession(token) {
  const sid = verifySession(token);
  if (!sid) return { sid: null, error: 'invalid_session' };
  const s = findStudent(sid);
  if (!s) return { sid: null, error: 'invalid_session' };
  if (s.mustChangePassword === true || s.mustChangePassword === 'TRUE') {
    return { sid: null, error: 'must_change_password' };
  }
  if (s.status && s.status !== 'active') {
    return { sid: null, error: 'account_disabled' };
  }
  return { sid: sid, error: null };
}

function verifyTeacherKey(key) {
  const expected = PropertiesService.getScriptProperties().getProperty('TEACHER_KEY');
  return expected && key === expected;
}

// 雙軌認證:接受老師 session 或 TEACHER_KEY(備用)
// 回傳 actor 字串供 audit 用,失敗回傳 null
function authTeacher({ session, teacherKey }) {
  if (session) {
    const sid = verifySession(session);
    if (sid) {
      const s = findStudent(sid);
      if (s && s.role === 'teacher'
          && !(s.mustChangePassword === true || s.mustChangePassword === 'TRUE')) {
        return sid;
      }
    }
  }
  if (teacherKey && verifyTeacherKey(teacherKey)) return 'teacher';
  return null;
}

// ─── Email ───────────────────────────────────────────────
function sendResetEmail(to, name, token) {
  const url = CONFIG.FRONTEND_URL + '#reset=' + token;
  const html = HtmlService.createTemplateFromFile('Email');
  html.name = name; html.url = url; html.minutes = CONFIG.RESET_TOKEN_TTL_MIN;
  GmailApp.sendEmail(to, '【作業系統】密碼重設連結', '請使用支援 HTML 的信箱開啟', {
    htmlBody: html.evaluate().getContent(), name: '資訊科技課程作業系統',
  });
}

function sendWelcomeEmail(studentId, email) {
  GmailApp.sendEmail(email, '【作業系統】帳號設定完成',
    '您的學號 ' + studentId + ' 已完成密碼與 Email 設定。\n登入網址:' + ScriptApp.getService().getUrl(),
    { name: '資訊科技課程作業系統' });
}

// ─── Drive 資料夾 ────────────────────────────────────────
function ensureRootFolder() {
  const it = DriveApp.getFoldersByName(CONFIG.ROOT_FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CONFIG.ROOT_FOLDER_NAME);
}
function ensureStudentFolder(studentId, name) {
  const root = ensureRootFolder();
  const folderName = studentId + '_' + name;
  const it = root.getFoldersByName(folderName);
  return it.hasNext() ? it.next() : root.createFolder(folderName);
}
function ensureSubFolder(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

// ─── 日誌 ────────────────────────────────────────────────
function audit(actor, action, target, detail) {
  appendRow(CONFIG.SHEETS.auditLog, [
    new Date(), actor, action, target, JSON.stringify(detail || {}), '',
  ]);
}

// ─── 一次性初始化 ────────────────────────────────────────
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const headers = {
    Students: ['studentId','name','email','emailVerified','passwordHash','salt','mustChangePassword','folderId','status','createdAt','lastLogin','role'],
    Assignments: ['assignmentId','week','title','description','dueAt','allowedTypes','maxFiles','maxSizeMB','published','createdAt','lateAllowed'],
    Submissions: ['submissionId','studentId','assignmentId','state','fileIds','fileNames','note','submittedAt','score','feedback','gradedAt','version'],
    Materials: ['materialId','week','title','description','fileId','fileName','fileSize','fileType','published','uploadedAt'],
    ResetTokens: ['token','studentId','createdAt','expiresAt','usedAt','requestIp'],
    AuditLog: ['timestamp','actor','action','target','detail','ip'],
  };
  Object.keys(headers).forEach((name) => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers[name].length).setValues([headers[name]]).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
  });
  ensureRootFolder();
  // 確保預設老師帳號存在
  ensureDefaultTeacher();
  // 產生一把老師金鑰並列印出來(備用)
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('TEACHER_KEY')) {
    const key = randomToken(32);
    props.setProperty('TEACHER_KEY', key);
    Logger.log('TEACHER_KEY 已建立(請複製到前端):' + key);
  } else {
    Logger.log('TEACHER_KEY 已存在(在 專案設定 → 指令碼屬性 查看)');
  }
  Logger.log('setup() 完成。請繼續 → 部署 → 新部署 → 網路應用程式');
}

// 確保至少有一個老師帳號(預設學號:teacher,預設密碼:00000000,首次登入需改密碼)
function ensureDefaultTeacher() {
  const TEACHER_ID = 'teacher';
  const TEACHER_EMAIL = 'cnc19750804@gmail.com';
  const existing = findStudent(TEACHER_ID);
  if (existing) {
    // 若已存在但沒有 role,補上 teacher
    if (!existing.role) {
      updateStudent(TEACHER_ID, { role: 'teacher' });
      Logger.log('已將 ' + TEACHER_ID + ' 補上 role=teacher');
    }
    return;
  }
  const defaultPw = '00000000';
  const { hash, salt } = hashPassword(defaultPw);
  const folder = ensureStudentFolder(TEACHER_ID, '老師');
  appendRow(CONFIG.SHEETS.students, [
    TEACHER_ID, '老師', TEACHER_EMAIL, true, hash, salt, true,
    folder.getId(), 'pending', new Date(), '', 'teacher',
  ]);
  Logger.log('已建立預設老師帳號:' + TEACHER_ID + ' / ' + defaultPw + '(首次登入需改密碼)');
}

// 給已存在但缺欄位的舊試算表升級用:手動執行一次即可
function upgradeStudentsSchema() {
  const sheet = getSheet(CONFIG.SHEETS.students);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (headers.indexOf('role') === -1) {
    sheet.getRange(1, headers.length + 1).setValue('role').setFontWeight('bold');
    Logger.log('已新增 role 欄位');
  }
  // Assignments 表補 lateAllowed 欄位(舊資料預設 true:可逾期繳)
  const aSheet = getSheet(CONFIG.SHEETS.assignments);
  const aHeaders = aSheet.getRange(1, 1, 1, aSheet.getLastColumn()).getValues()[0];
  if (aHeaders.indexOf('lateAllowed') === -1) {
    const newCol = aHeaders.length + 1;
    aSheet.getRange(1, newCol).setValue('lateAllowed').setFontWeight('bold');
    const last = aSheet.getLastRow();
    if (last > 1) aSheet.getRange(2, newCol, last - 1, 1).setValue(true);
    Logger.log('已新增 lateAllowed 欄位(舊作業預設為可逾期繳)');
  }
  ensureDefaultTeacher();
}

// 把所有學生(role 不是 teacher 的)密碼一次重設為 00000000
// 使用情境:批次匯入時 Excel 把預設密碼欄吃壞了,需要全部重來
function resetAllStudentsPassword() {
  const { hash, salt } = hashPassword('00000000');
  const sheet = getSheet(CONFIG.SHEETS.students);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const colHash = headers.indexOf('passwordHash');
  const colSalt = headers.indexOf('salt');
  const colMust = headers.indexOf('mustChangePassword');
  const colRole = headers.indexOf('role');
  let count = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i][colRole] === 'teacher') continue;
    sheet.getRange(i + 1, colHash + 1).setValue(hash);
    sheet.getRange(i + 1, colSalt + 1).setValue(salt);
    sheet.getRange(i + 1, colMust + 1).setValue(true);
    count++;
  }
  Logger.log('已重設 ' + count + ' 位學生密碼為 00000000');
}
