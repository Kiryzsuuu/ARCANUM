// ARCANUM — Shared utilities + Theme system

// ══════════════════════════════════════════════
//  THEME SYSTEM
// ══════════════════════════════════════════════
const THEMES = [
  { id: 'navy',    label: 'NAVY',    color: '#185FA5' },
  { id: 'matrix',  label: 'MATRIX',  color: '#166b25' },
  { id: 'abyss',   label: 'ABYSS',   color: '#505050' },
  { id: 'desert',  label: 'DESERT',  color: '#8b6422' },
  { id: 'crimson', label: 'CRIMSON', color: '#8c1e1e' },
];

function applyTheme(name) {
  document.documentElement.setAttribute('data-theme', name);
  localStorage.setItem('arcanum-theme', name);
  // Update active state in picker if open
  document.querySelectorAll('.theme-opt').forEach(el => {
    el.classList.toggle('active', el.dataset.theme === name);
  });
}

function loadTheme() {
  const saved = localStorage.getItem('arcanum-theme') || 'navy';
  document.documentElement.setAttribute('data-theme', saved);
  return saved;
}

// Inject theme link + apply on first load
(function() {
  if (!document.querySelector('link[href="/css/themes.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/themes.css';
    document.head.appendChild(link);
  }
  loadTheme();
})();

// ══════════════════════════════════════════════
//  PROFILE PANEL (injected into every page)
// ══════════════════════════════════════════════
function injectProfilePanel(user) {
  if (document.getElementById('profile-panel')) return;

  const ROLE_COLOR = { SA:'#378ADD', ADMIN:'#378ADD', CMD:'#378ADD', OPS:'#639922', RECON:'#EF9F27', INTEL:'#85B7EB', LOG:'#666' };
  const ROLE_BG    = { SA:'#0a1628', ADMIN:'#0a1628', CMD:'#0C1F38', OPS:'#173404', RECON:'#1a0e04', INTEL:'#0a1020', LOG:'#1a1a1a' };
  const rc = ROLE_COLOR[user.role] || '#639922';
  const rb = ROLE_BG[user.role]    || '#173404';

  const style = document.createElement('style');
  style.textContent = `
    #profile-overlay { position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:8000;display:none; }
    #profile-overlay.show { display:block; }
    #profile-panel {
      position:fixed;top:0;right:-380px;width:360px;max-width:100vw;height:100%;
      background:var(--bg-panel);border-left:.5px solid var(--border);
      z-index:8001;display:flex;flex-direction:column;
      transition:right .28s cubic-bezier(.4,0,.2,1);
      box-shadow:-8px 0 32px rgba(0,0,0,.5);
    }
    #profile-panel.open { right:0; }
    .pp-header { padding:16px 18px 12px;border-bottom:.5px solid var(--border);display:flex;align-items:center;justify-content:space-between; }
    .pp-title  { font-size:12px;font-weight:bold;color:var(--frost);letter-spacing:.08em; }
    .pp-close  { background:none;border:none;color:var(--ash);font-size:18px;cursor:pointer;padding:4px;line-height:1; }
    .pp-close:hover { color:var(--threat); }
    .pp-body   { flex:1;overflow-y:auto;padding:20px 18px; }
    .pp-avatar-row { display:flex;flex-direction:column;align-items:center;gap:10px;margin-bottom:22px; }
    .pp-avatar { width:72px;height:72px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:bold;letter-spacing:.04em; }
    .pp-id     { font-size:10px;color:var(--signal);letter-spacing:.1em; }
    .pp-badge  { display:inline-flex;align-items:center;gap:5px;background:var(--deep);border:.5px solid var(--cmd);border-radius:4px;padding:3px 10px;font-size:10px;color:var(--mist); }
    .pp-field  { margin-bottom:14px; }
    .pp-label  { font-size:9px;color:var(--signal);letter-spacing:.08em;text-transform:uppercase;margin-bottom:5px;display:flex;align-items:center;gap:5px; }
    .pp-input  { background:var(--bg-input);border:.5px solid var(--cmd);border-radius:6px;height:38px;display:flex;align-items:center;padding:0 12px;gap:8px;transition:border-color .15s; }
    .pp-input:focus-within { border-color:var(--signal); }
    .pp-input input { background:transparent;border:none;outline:none;color:var(--frost);font-family:var(--font);font-size:12px;flex:1;width:100%; }
    .pp-input input::placeholder { color:var(--ash); }
    .pp-input input:disabled { color:var(--ash);cursor:not-allowed; }
    .pp-input .pp-eye { font-size:14px;color:var(--ash);cursor:pointer; }
    .pp-input .pp-eye:hover { color:var(--signal); }
    .pp-divider { border:none;border-top:.5px solid var(--border);margin:18px 0; }
    .pp-section-title { font-size:10px;color:var(--cmd);letter-spacing:.08em;text-transform:uppercase;margin-bottom:12px; }
    .pp-footer { padding:14px 18px;border-top:.5px solid var(--border);display:flex;flex-direction:column;gap:8px; }
    .pp-msg { font-size:11px;padding:7px 10px;border-radius:5px;display:none; }
    .pp-msg.ok  { background:#0d2210;color:var(--ops);border:.5px solid #3B6D11;display:block; }
    .pp-msg.err { background:#1a0505;color:var(--threat);border:.5px solid #A32D2D;display:block; }
    @media(max-width:400px){ #profile-panel{width:100vw;} }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.id = 'profile-overlay';
  overlay.onclick = closeProfile;
  document.body.appendChild(overlay);

  const panel = document.createElement('div');
  panel.id = 'profile-panel';
  panel.innerHTML = `
    <div class="pp-header">
      <span class="pp-title">MY PROFILE</span>
      <button class="pp-close" onclick="closeProfile()"><i class="ti ti-x"></i></button>
    </div>
    <div class="pp-body">
      <div class="pp-avatar-row">
        <div class="pp-avatar" id="pp-av" style="background:${rb};color:${rc};border:2px solid ${rc};">
          ${user.name.slice(0,2).toUpperCase()}
        </div>
        <div class="pp-id">${user.id}</div>
        <div class="pp-badge">
          <i class="ti ti-shield" style="font-size:12px;color:${rc};"></i>
          <span style="color:${rc};">${user.role}</span>
          <span style="color:var(--ash);">·</span>
          <span>LVL ${user.clearance}</span>
        </div>
      </div>

      <div class="pp-section-title">Info Akun</div>

      <div class="pp-field">
        <div class="pp-label"><i class="ti ti-user" style="font-size:11px;"></i> Nama / Callsign</div>
        <div class="pp-input">
          <input type="text" id="pp-name" value="${user.name}" placeholder="Callsign" autocomplete="off" spellcheck="false">
        </div>
      </div>
      <div class="pp-field">
        <div class="pp-label"><i class="ti ti-mail" style="font-size:11px;"></i> Email</div>
        <div class="pp-input">
          <input type="email" id="pp-email" value="${user.email || ''}" placeholder="email@domain.com" autocomplete="off">
        </div>
      </div>

      <hr class="pp-divider">
      <div class="pp-section-title">Ganti Passphrase</div>

      <div class="pp-field">
        <div class="pp-label"><i class="ti ti-lock" style="font-size:11px;"></i> Passphrase Baru <span style="color:var(--ash);font-size:9px;">(kosongkan jika tidak diganti)</span></div>
        <div class="pp-input">
          <input type="password" id="pp-newpass" placeholder="Min. 6 karakter" autocomplete="new-password">
          <span class="pp-eye" onclick="togglePPPass('pp-newpass',this)"><i class="ti ti-eye"></i></span>
        </div>
      </div>
      <div class="pp-field">
        <div class="pp-label"><i class="ti ti-lock-check" style="font-size:11px;"></i> Konfirmasi Passphrase Baru</div>
        <div class="pp-input">
          <input type="password" id="pp-newpass2" placeholder="Ulangi passphrase baru" autocomplete="new-password">
        </div>
      </div>

      <hr class="pp-divider">

      <div class="pp-field">
        <div class="pp-label"><i class="ti ti-shield-lock" style="font-size:11px;color:var(--threat);"></i> <span style="color:var(--threat);">Passphrase Saat Ini</span> <span style="color:var(--ash);font-size:9px;">(wajib diisi)</span></div>
        <div class="pp-input" style="border-color:var(--steel);">
          <input type="password" id="pp-curpass" placeholder="Konfirmasi identitas" autocomplete="current-password">
          <span class="pp-eye" onclick="togglePPPass('pp-curpass',this)"><i class="ti ti-eye"></i></span>
        </div>
      </div>
    </div>

    <div class="pp-footer">
      <div class="pp-msg" id="pp-msg"></div>
      <button class="btn btn-primary" style="width:100%;justify-content:center;height:40px;" onclick="saveProfile()">
        <i class="ti ti-device-floppy"></i> Simpan Perubahan
      </button>
      <a href="/logout" class="btn btn-danger" style="width:100%;justify-content:center;height:36px;text-decoration:none;">
        <i class="ti ti-logout"></i> Logout
      </a>
    </div>
  `;
  document.body.appendChild(panel);
}

function openProfile() {
  document.getElementById('profile-overlay')?.classList.add('show');
  document.getElementById('profile-panel')?.classList.add('open');
}
function closeProfile() {
  document.getElementById('profile-overlay')?.classList.remove('show');
  document.getElementById('profile-panel')?.classList.remove('open');
}
function togglePPPass(id, btn) {
  const inp = document.getElementById(id);
  inp.type  = inp.type === 'password' ? 'text' : 'password';
  btn.innerHTML = inp.type === 'password' ? '<i class="ti ti-eye"></i>' : '<i class="ti ti-eye-off"></i>';
}

async function saveProfile() {
  const name       = document.getElementById('pp-name')?.value.trim();
  const email      = document.getElementById('pp-email')?.value.trim();
  const newPass    = document.getElementById('pp-newpass')?.value;
  const newPass2   = document.getElementById('pp-newpass2')?.value;
  const curPass    = document.getElementById('pp-curpass')?.value;
  const msgEl      = document.getElementById('pp-msg');

  msgEl.className = 'pp-msg';

  if (!curPass) { showPPMsg('Masukkan passphrase saat ini untuk konfirmasi', 'err'); return; }
  if (newPass && newPass.length < 6) { showPPMsg('Passphrase baru minimal 6 karakter', 'err'); return; }
  if (newPass && newPass !== newPass2) { showPPMsg('Konfirmasi passphrase baru tidak cocok', 'err'); return; }

  const body = { name, email, passphrase: curPass };
  if (newPass) body.newPassphrase = newPass;

  try {
    const r = await fetch('/api/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const d = await r.json();
    if (d.error) { showPPMsg(d.error, 'err'); return; }

    // Update UI
    const initials = d.user.name.slice(0,2).toUpperCase();
    document.getElementById('pp-av').textContent = initials;
    const avatarEl = document.getElementById('user-initials');
    if (avatarEl) avatarEl.textContent = initials;
    document.getElementById('pp-curpass').value  = '';
    document.getElementById('pp-newpass').value  = '';
    document.getElementById('pp-newpass2').value = '';
    showPPMsg('Profil berhasil disimpan', 'ok');
    // Push posisi ulang agar map update nama baru
    pushPosition();
  } catch (_) {
    showPPMsg('Gagal menyimpan — coba lagi', 'err');
  }
}

function showPPMsg(text, type) {
  const el = document.getElementById('pp-msg');
  el.textContent = text;
  el.className   = 'pp-msg ' + type;
  setTimeout(() => { el.className = 'pp-msg'; }, 4000);
}

// Inject theme picker button into topbar (called after DOM ready)
function injectThemePicker() {
  const tbRight = document.querySelector('.tb-right');
  if (!tbRight || document.getElementById('theme-btn')) return;

  const currentTheme = localStorage.getItem('arcanum-theme') || 'navy';

  const btn = document.createElement('div');
  btn.id = 'theme-btn';
  btn.className = 'tb-item';
  btn.style.cssText = 'cursor:pointer;position:relative;';
  btn.title = 'Change Theme';
  btn.innerHTML = `<i class="ti ti-palette" style="font-size:14px;"></i>`;
  btn.onclick = (e) => {
    e.stopPropagation();
    const picker = document.getElementById('theme-picker');
    picker.style.display = picker.style.display === 'none' ? 'flex' : 'none';
  };
  tbRight.insertBefore(btn, tbRight.firstChild);

  // Create picker popup
  const picker = document.createElement('div');
  picker.id = 'theme-picker';
  picker.style.cssText = `
    display:none; position:fixed; top:44px; right:12px; z-index:9999;
    background:var(--bg-panel); border:0.5px solid var(--border);
    border-radius:8px; padding:10px 12px; flex-direction:column; gap:6px;
    box-shadow:0 4px 20px rgba(0,0,0,.6); min-width:150px;
  `;
  picker.innerHTML = `
    <div style="font-size:9px;color:var(--cmd);letter-spacing:.1em;margin-bottom:4px;text-transform:uppercase;">Theme</div>
    ${THEMES.map(t => `
      <div class="theme-opt${t.id === currentTheme ? ' active' : ''}" data-theme="${t.id}"
        onclick="applyTheme('${t.id}');document.getElementById('theme-picker').style.display='none';"
        style="display:flex;align-items:center;gap:8px;padding:5px 6px;border-radius:5px;cursor:pointer;font-size:11px;color:var(--mist);transition:background .15s;">
        <div style="width:12px;height:12px;border-radius:50%;background:${t.color};flex-shrink:0;"></div>
        <span>${t.label}</span>
        <i class="ti ti-check" style="margin-left:auto;font-size:11px;display:${t.id === currentTheme ? 'block' : 'none'};color:var(--signal);"></i>
      </div>
    `).join('')}
  `;
  document.body.appendChild(picker);

  // Close on outside click
  document.addEventListener('click', () => {
    picker.style.display = 'none';
  });
}

// Override applyTheme to also refresh checkmarks
const _applyTheme = applyTheme;
window.applyTheme = function(name) {
  _applyTheme(name);
  document.querySelectorAll('.theme-opt').forEach(el => {
    const check = el.querySelector('.ti-check');
    if (check) check.style.display = el.dataset.theme === name ? 'block' : 'none';
    el.style.background = el.dataset.theme === name ? 'var(--deep)' : '';
  });
};

// ══════════════════════════════════════════════
//  UTC CLOCK
// ══════════════════════════════════════════════
function startClock(el) {
  const tz   = Intl.DateTimeFormat().resolvedOptions().timeZone;           // e.g. "Asia/Jakarta"
  const city = tz.split('/').pop().replace(/_/g, ' ');                     // e.g. "Jakarta"
  const fmt  = new Intl.DateTimeFormat([], {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    timeZone: tz
  });
  const tick = () => { el.textContent = fmt.format(new Date()) + ' ' + city; };
  tick();
  setInterval(tick, 1000);
}

// ══════════════════════════════════════════════
//  FETCH HELPERS
// ══════════════════════════════════════════════
async function loadUser() {
  const res = await fetch('/api/me');
  return res.json();
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  });
  return res.json();
}

// ══════════════════════════════════════════════
//  TOPBAR INIT
// ══════════════════════════════════════════════
async function initTopbar(pathLabel) {
  const user = await loadUser();
  const clock     = document.getElementById('utc-clock');
  const initials  = document.getElementById('user-initials');
  const breadcrumb= document.getElementById('breadcrumb');

  if (clock)      startClock(clock);
  if (initials) {
    initials.textContent = user.name.slice(0, 2).toUpperCase();
    initials.style.cursor = 'pointer';
    initials.title = user.name + ' — edit profile';
    initials.onclick = openProfile;
  }
  if (breadcrumb && pathLabel) breadcrumb.textContent = pathLabel;

  // Inject profile panel & theme picker
  injectProfilePanel(user);
  injectThemePicker();

  // Geolocation refresh every 5 minutes (300 000 ms)
  startPositionRefresh();

  return user;
}

// ══════════════════════════════════════════════
//  POSITION REFRESH (every 5 minutes, GPS-first)
// ══════════════════════════════════════════════
function startPositionRefresh() {
  pushPosition();
  setInterval(pushPosition, 5 * 60 * 1000);
}

function pushPosition() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Precise GPS from browser — send coords directly
        fetch('/api/position', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat:      pos.coords.latitude,
            lng:      pos.coords.longitude,
            accuracy: pos.coords.accuracy   // in metres
          })
        }).catch(() => {});
      },
      () => {
        // User denied GPS — fall back to IP geolocation on server
        fetch('/api/position', { method: 'POST' }).catch(() => {});
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  } else {
    // Browser doesn't support geolocation — IP fallback
    fetch('/api/position', { method: 'POST' }).catch(() => {});
  }
}

// ══════════════════════════════════════════════
//  SHARED HELPERS
// ══════════════════════════════════════════════
function fmtTime(iso) {
  return new Date(iso).toUTCString().split(' ')[4].slice(0, 5) + ' UTC';
}

function priorityClass(p) {
  return { high:'threat', medium:'siaga', low:'ops', info:'signal' }[p] || 'ash';
}

function statusBadge(status) {
  const map = {
    pending:    ['badge-alert',   'PENDING'],
    reviewed:   ['badge-info',    'REVIEWED'],
    closed:     ['badge-neutral', 'CLOSED'],
    nominal:    ['badge-ok',      'NOMINAL'],
    monitoring: ['badge-alert',   'MON'],
    danger:     ['badge-danger',  'THREAT'],
    alert:      ['badge-alert',   'ALERT'],
  };
  const [cls, label] = map[status] || ['badge-neutral', (status||'').toUpperCase()];
  return `<span class="badge ${cls}">${label}</span>`;
}

// Hover highlight for theme-opt
document.addEventListener('mouseover', e => {
  if (e.target.closest('.theme-opt')) {
    e.target.closest('.theme-opt').style.background = 'var(--deep)';
  }
});
document.addEventListener('mouseout', e => {
  const el = e.target.closest('.theme-opt');
  if (el && el.dataset.theme !== (localStorage.getItem('arcanum-theme') || 'navy')) {
    el.style.background = '';
  }
});
