// 線稿 icon 集 — 依 currentColor / size 上色
const Icon = ({ d, size = 16, stroke = 1.6, fill = 'none', children, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
       strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style}>
    {d ? <path d={d} /> : children}
  </svg>
);

const IconHome     = (p) => <Icon {...p} d="M3 11l9-8 9 8M5 9.5V20h4v-6h6v6h4V9.5" />;
const IconBook     = (p) => <Icon {...p}><path d="M4 4h12a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4z"/><path d="M4 17a3 3 0 0 1 3-3h12"/></Icon>;
const IconUpload   = (p) => <Icon {...p} d="M12 16V4M6 10l6-6 6 6M4 20h16" />;
const IconUser     = (p) => <Icon {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></Icon>;
const IconUsers    = (p) => <Icon {...p}><circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3.5-6 7-6s7 2.5 7 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M22 20c0-3-2-5.5-5-6"/></Icon>;
const IconSettings = (p) => <Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h0a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v0a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></Icon>;
const IconLogOut   = (p) => <Icon {...p} d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />;
const IconCheck    = (p) => <Icon {...p} d="M5 13l4 4L19 7" />;
const IconX        = (p) => <Icon {...p} d="M6 6l12 12M6 18L18 6" />;
const IconClock    = (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Icon>;
const IconCalendar = (p) => <Icon {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></Icon>;
const IconSearch   = (p) => <Icon {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/></Icon>;
const IconChevronR = (p) => <Icon {...p} d="M9 6l6 6-6 6" />;
const IconChevronL = (p) => <Icon {...p} d="M15 6l-6 6 6 6" />;
const IconChevronD = (p) => <Icon {...p} d="M6 9l6 6 6-6" />;
const IconPlus     = (p) => <Icon {...p} d="M12 5v14M5 12h14" />;
const IconMinus    = (p) => <Icon {...p} d="M5 12h14" />;
const IconDownload = (p) => <Icon {...p} d="M12 4v12M6 10l6 6 6-6M4 20h16" />;
const IconMail     = (p) => <Icon {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></Icon>;
const IconLock     = (p) => <Icon {...p}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></Icon>;
const IconKey      = (p) => <Icon {...p}><circle cx="8" cy="14" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l3 3"/></Icon>;
const IconEye      = (p) => <Icon {...p}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></Icon>;
const IconEyeOff   = (p) => <Icon {...p} d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3 3.5M6.6 6.6A17 17 0 0 0 2 12s4 6 10 6c1.4 0 2.7-.3 3.9-.7M9.9 14.1A3 3 0 0 1 12 9" />;
const IconFile     = (p) => <Icon {...p}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></Icon>;
const IconFolder   = (p) => <Icon {...p} d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />;
const IconCloud    = (p) => <Icon {...p} d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19 11h.5a3.5 3.5 0 0 1 0 7H7z" />;
const IconAlert    = (p) => <Icon {...p}><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/></Icon>;
const IconInfo     = (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 8v.01M11 12h1v5h1"/></Icon>;
const IconMore     = (p) => <Icon {...p}><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></Icon>;
const IconBell     = (p) => <Icon {...p} d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 19a2 2 0 0 0 4 0" />;
const IconChart    = (p) => <Icon {...p} d="M3 21h18M6 17v-7M11 17V5M16 17v-9M21 17v-4" />;
const IconTrash    = (p) => <Icon {...p} d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14" />;
const IconEdit     = (p) => <Icon {...p} d="M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z" />;
const IconArrowL   = (p) => <Icon {...p} d="M19 12H5M11 18l-6-6 6-6" />;
const IconRefresh  = (p) => <Icon {...p} d="M3 12a9 9 0 0 1 15-6.7L21 8M21 4v4h-4M21 12a9 9 0 0 1-15 6.7L3 16M3 20v-4h4" />;

// 檔案類型 icon (彩色)
function FileTypeIcon({ type, size = 32 }) {
  const map = {
    pdf:    { color: '#dc2626', label: 'PDF' },
    doc:    { color: '#2563eb', label: 'DOC' },
    ppt:    { color: '#ea580c', label: 'PPT' },
    xls:    { color: '#16a34a', label: 'XLS' },
    img:    { color: '#7c3aed', label: 'IMG' },
    video:  { color: '#db2777', label: 'MP4' },
    audio:  { color: '#0891b2', label: 'WAV' },
    zip:    { color: '#a16207', label: 'ZIP' },
    code:   { color: '#475569', label: 'CODE' },
  };
  const m = map[type] || { color: '#64748b', label: 'FILE' };
  return (
    <div style={{
      width: size, height: size * 1.25, borderRadius: 4,
      background: 'white', border: `1.5px solid ${m.color}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
      paddingBottom: 4, position: 'relative', flexShrink: 0,
    }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: size * 0.3, height: size * 0.3,
        background: 'white', borderLeft: `1.5px solid ${m.color}`, borderBottom: `1.5px solid ${m.color}` }} />
      <div style={{ fontSize: size * 0.26, fontWeight: 700, color: m.color, fontFamily: 'IBM Plex Mono, monospace', letterSpacing: -0.3 }}>
        {m.label}
      </div>
    </div>
  );
}

// 大頭貼 (從學號或姓名生成)
function Avatar({ name, id, size = 32, color }) {
  const initial = name ? name[0] : (id ? String(id).slice(-2) : '?');
  // 從 id 生成穩定 hue
  let hue = 0;
  const s = String(id || name || '');
  for (let i = 0; i < s.length; i++) hue = (hue + s.charCodeAt(i) * 7) % 360;
  const bg = color || `oklch(0.78 0.06 ${hue})`;
  const fg = `oklch(0.32 0.10 ${hue})`;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg, color: fg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 600, flexShrink: 0,
      fontFamily: name ? 'inherit' : 'IBM Plex Mono, monospace',
    }}>{initial}</div>
  );
}

// 品牌標誌 — 自有 mark
function BrandMark({ size = 28 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 7,
      background: 'linear-gradient(135deg, oklch(0.50 0.16 255), oklch(0.34 0.12 255))',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', flexShrink: 0,
    }}>
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 16 16" fill="none">
        <path d="M2 4l6-3 6 3v8l-6 3-6-3V4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M2 4l6 3 6-3M8 7v8" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

Object.assign(window, {
  Icon,
  IconHome, IconBook, IconUpload, IconUser, IconUsers, IconSettings, IconLogOut,
  IconCheck, IconX, IconClock, IconCalendar, IconSearch,
  IconChevronR, IconChevronL, IconChevronD, IconPlus, IconMinus, IconDownload,
  IconMail, IconLock, IconKey, IconEye, IconEyeOff, IconFile, IconFolder,
  IconCloud, IconAlert, IconInfo, IconMore, IconBell, IconChart, IconTrash, IconEdit,
  IconArrowL, IconRefresh,
  FileTypeIcon, Avatar, BrandMark,
});
