import './style.css';
import { createClient } from '@supabase/supabase-js';

declare global { interface Window { ytManager?: { openYouTube: (id: string, email?: string, profile?: { zoom: number; startPage: 'home' | 'studio' }) => void; setBrowserBounds: (bounds: {x:number;y:number;width:number;height:number}) => void; } } }

const env = import.meta.env;
// Supabase publishable key is designed for public client-side use. Environment variables override these defaults.
const supabaseUrl = (env.VITE_SUPABASE_URL as string | undefined) ?? 'https://dwphicuwoeanxcwyihfj.supabase.co';
const supabaseKey = (env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? 'sb_publishable_Ay3EVoUrBVBLCVIyevofVA_BOBpQ1w7';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

type Account = { id: string; label: string; email: string | null; created_at?: string };
type AccountProfile = { zoom: number; startPage: 'home' | 'studio' };
const DEFAULT_PROFILE: AccountProfile = { zoom: 1, startPage: 'home' };
const profileKey = (id: string) => `yt-manager:account-profile:${id}`;
function getAccountProfile(id: string): AccountProfile {
  try { const value = JSON.parse(localStorage.getItem(profileKey(id)) || 'null'); return { zoom: [0.8,0.9,1,1.1,1.2,1.25].includes(value?.zoom) ? value.zoom : 1, startPage: value?.startPage === 'studio' ? 'studio' : 'home' }; }
  catch { return { ...DEFAULT_PROFILE }; }
}
function saveAccountProfile(id: string, profile: AccountProfile) { localStorage.setItem(profileKey(id), JSON.stringify(profile)); }
let accounts: Account[] = [];
let activeId = '';
let filter = '';
let editingAccountId: string | null = null;
let editingProfileAccountId: string | null = null;

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div class="shell">
    <header class="topbar"><div class="brand"><span class="brand-icon">▶</span><span>YT <b>Manager</b></span></div><div class="top-actions"><span id="connection" class="status"><i></i> Local mode</span><button id="logout" class="logout" type="button" hidden>Keluar</button><button id="add" class="primary">＋ Tambah akun</button></div></header>
    <main class="layout">
      <section class="browser-panel">
        <div class="browser-stage" id="browser-stage"><div class="welcome"><div class="youtube-mark">▶</div><h2>Pilih akun untuk mulai</h2><p>YouTube akan dibuka di aplikasi desktop dengan sesi browser terpisah untuk setiap akun.</p><button id="choose" class="primary">Pilih akun</button><small>Versi web hanya menampilkan dashboard. Browser YouTube penuh tersedia di aplikasi desktop.</small></div></div>
      </section>
      <aside class="accounts-panel"><div class="accounts-title"><div><span class="eyebrow">ACCOUNT CENTER</span><h2>Semua Akun</h2></div><span id="count" class="count">0</span></div><label class="search"><span>⌕</span><input id="search" placeholder="Cari nama atau email..." /></label><div class="account-list" id="account-list"><div class="empty">Belum ada akun. Tambahkan akun pertama.</div></div><div class="panel-foot"><span>Profil browser disimpan lokal di perangkat</span><span class="dot"></span></div></aside>
    </main>
    <footer><span>YT Manager v1.0</span><span>Data akun tersimpan di Supabase · Sesi browser tersimpan lokal</span></footer>
  </div>
  <dialog id="account-dialog"><form id="account-form"><div class="dialog-head"><h2 id="account-dialog-title">Tambah akun YouTube</h2><button class="tool" id="close-account-dialog" type="button" aria-label="Tutup">×</button></div><label>Nomor akun (otomatis)<input id="account-name" required readonly aria-readonly="true" /></label><label>Email Google / YouTube<input id="account-email" type="email" autocomplete="off" required placeholder="nama@gmail.com" /></label><div class="dialog-actions"><button class="secondary" id="cancel-account" type="button">Batal</button><button class="primary" id="save-account" type="submit">Simpan akun</button></div></form></dialog>
  <dialog id="profile-dialog"><form id="profile-form"><div class="dialog-head"><h2>Pengaturan profil akun</h2><button class="tool" id="close-profile-dialog" type="button" aria-label="Tutup">×</button></div><p id="profile-account-label" class="profile-note"></p><label>Zoom browser<select id="profile-zoom"><option value="0.8">80%</option><option value="0.9">90%</option><option value="1">100%</option><option value="1.1">110%</option><option value="1.2">120%</option><option value="1.25">125%</option></select></label><label>Halaman awal YouTube<select id="profile-start-page"><option value="home">Beranda YouTube</option><option value="studio">YouTube Studio</option></select></label><p class="profile-note">Pengaturan ini tersimpan terpisah untuk akun ini di perangkat ini. Cookie dan sesi login tetap dipisahkan otomatis.</p><div class="dialog-actions"><button class="secondary" id="cancel-profile" type="button">Batal</button><button class="primary" type="submit">Simpan profil</button></div></form></dialog>
  <div id="toast" class="toast" role="status"></div>`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let lastBrowserBounds = '';
function syncDesktopBrowserBounds() {
  const stage = $('browser-stage');
  if (!window.ytManager || !stage) return;
  const r = stage.getBoundingClientRect();
  const bounds = { x: r.x, y: r.y, width: r.width, height: r.height };
  const signature = [bounds.x, bounds.y, bounds.width, bounds.height].join(':');
  if (signature === lastBrowserBounds) return;
  lastBrowserBounds = signature;
  window.ytManager.setBrowserBounds(bounds);
}
window.addEventListener('resize', syncDesktopBrowserBounds, { passive: true });
if (typeof ResizeObserver !== 'undefined') {
  const stage = $('browser-stage');
  new ResizeObserver(syncDesktopBrowserBounds).observe(stage);
}
requestAnimationFrame(syncDesktopBrowserBounds);
const toast = (message: string) => { const el = $('toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2800); };
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

function render() {
  $('count').textContent = String(accounts.length);
  const list = $('account-list');
  const filtered = accounts.filter(a => (a.label + ' ' + (a.email ?? '')).toLowerCase().includes(filter.toLowerCase()));
  list.innerHTML = filtered.length ? filtered.map(a => `<div class="account-row"><button class="account account-select ${a.id === activeId ? 'selected' : ''}" data-id="${a.id}"><span class="avatar">${escapeHtml(a.label.slice(0,1).toUpperCase())}</span><span class="account-meta"><b>${escapeHtml(a.label)}</b><small>${escapeHtml(a.email ?? 'Email belum diisi')}</small></span><span class="account-state">${a.id === activeId ? '● Aktif' : 'Pilih'}</span></button><button class="account-edit" data-profile-id="${a.id}" aria-label="Pengaturan profil ${escapeHtml(a.label)}" title="Pengaturan profil">Profil</button><button class="account-edit" data-edit-id="${a.id}" aria-label="Edit akun ${escapeHtml(a.label)}" title="Edit akun">Edit</button><button class="account-delete" data-delete-id="${a.id}" aria-label="Hapus akun ${escapeHtml(a.label)}" title="Hapus akun">Hapus</button></div>`).join('') : '<div class="empty">Tidak ada akun yang cocok.</div>';
  list.querySelectorAll<HTMLButtonElement>('.account-select').forEach(button => button.addEventListener('click', () => selectAccount(button.dataset.id!)));
  list.querySelectorAll<HTMLButtonElement>('[data-profile-id]').forEach(button => button.addEventListener('click', () => openProfileSettings(button.dataset.profileId!)));
  list.querySelectorAll<HTMLButtonElement>('[data-edit-id]').forEach(button => button.addEventListener('click', () => openEditAccount(button.dataset.editId!)));
  list.querySelectorAll<HTMLButtonElement>('.account-delete').forEach(button => button.addEventListener('click', () => deleteAccount(button.dataset.deleteId!)));
}
async function loadAccounts() {
  if (!supabase) { $('connection').innerHTML = '<i></i> Demo mode'; accounts = []; render(); return; }
  const { data: { session } } = await supabase.auth.getSession();
  $('logout').hidden = !session;
  if (!session) { $('connection').innerHTML = '<i></i> Belum login'; showSignIn(); return; }
  $('connection').innerHTML = '<i></i> Supabase terhubung';
  if ($('signin-form')) showWorkspaceWelcome();
  const { data, error } = await supabase.from('yt_accounts').select('id,label,email,created_at').order('created_at', { ascending: true });
  if (error) { toast('Gagal memuat akun: ' + error.message); return; }
  accounts = data ?? []; render();
}
function showWorkspaceWelcome() {
  const stage = $('browser-stage');
  stage.innerHTML = `
    <div class="welcome">
      <div class="youtube-mark">▶</div>
      <h2>Berhasil masuk ke YT Manager</h2>
      <p>Pilih akun YouTube dari daftar di sebelah kanan, atau tambahkan akun baru untuk mulai.</p>
      <button id="choose" class="primary" type="button">＋ Tambah akun</button>
      <small>Versi web mengelola daftar akun. Untuk sesi YouTube terpisah, gunakan aplikasi desktop YT Manager.</small>
    </div>`;
  $('choose').addEventListener('click', () => $('add').click());
}
function showSignIn(message = '') {
  $('logout').hidden = true;
  const stage = $('browser-stage');
  stage.innerHTML = `
    <div class="welcome">
      <div class="youtube-mark">▶</div>
      <h2>Masuk ke YT Manager</h2>
      <p>Masuk menggunakan email dan password akun YT Manager Anda.</p>
      <form id="signin-form" class="signin-form">
        <input id="signin-email" type="email" autocomplete="username" required placeholder="Alamat email" aria-label="Alamat email" />
        <input id="signin-password" type="password" autocomplete="current-password" required minlength="8" placeholder="Password" aria-label="Password" />
        <button id="signin" class="primary" type="submit">Masuk</button>
      </form>
      <button id="forgot-password" class="text-action" type="button">Belum punya password? Buat password pertama kali</button>
      <small id="signin-message">${escapeHtml(message || 'Masukkan email dan password untuk masuk.')}</small>
    </div>`;
  $('signin-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = $<HTMLInputElement>('signin-email').value.trim();
    const password = $<HTMLInputElement>('signin-password').value;
    const button = $<HTMLButtonElement>('signin');
    const message = $('signin-message');
    if (!email || !password || !supabase) return;
    button.disabled = true;
    button.textContent = 'Memeriksa…';
    message.textContent = 'Sedang memverifikasi akun…';
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      message.textContent = error ? 'Login gagal: ' + error.message : 'Login berhasil.';
      if (!error) await loadAccounts();
    } catch (error) {
      message.textContent = 'Terjadi kesalahan: ' + (error instanceof Error ? error.message : String(error));
    } finally {
      button.disabled = false;
      button.textContent = 'Masuk';
    }
  });
  $('forgot-password').addEventListener('click', async () => {
    const email = $<HTMLInputElement>('signin-email').value.trim();
    const message = $('signin-message');
    if (!email) { message.textContent = 'Masukkan email terlebih dahulu, lalu klik Buat password.'; return; }
    if (!supabase) return;
    const button = $<HTMLButtonElement>('forgot-password');
    button.disabled = true;
    message.textContent = 'Mengirim email untuk membuat password…';
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      message.textContent = error
        ? 'Gagal mengirim email: ' + error.message
        : 'Email pengaturan password dikirim ke ' + email + '. Buka email tersebut sekali untuk membuat password. Setelah itu login selalu memakai password.';
    } catch (error) {
      message.textContent = 'Terjadi kesalahan: ' + (error instanceof Error ? error.message : String(error));
    } finally {
      button.disabled = false;
    }
  });
}
function showSetPasswordForm() {
  $('logout').hidden = true;
  const stage = $('browser-stage');
  stage.innerHTML = `
    <div class="welcome">
      <div class="youtube-mark">▶</div>
      <h2>Buat password YT Manager</h2>
      <p>Buat password baru untuk akun Anda. Setelah ini, login berikutnya cukup menggunakan email dan password.</p>
      <form id="set-password-form" class="signin-form">
        <input id="new-password" type="password" autocomplete="new-password" required minlength="8" placeholder="Password baru (minimal 8 karakter)" aria-label="Password baru" />
        <input id="confirm-password" type="password" autocomplete="new-password" required minlength="8" placeholder="Ulangi password baru" aria-label="Ulangi password baru" />
        <button id="save-password" class="primary" type="submit">Simpan password</button>
      </form>
      <small id="password-message">Gunakan password yang kuat dan jangan bagikan kepada siapa pun.</small>
    </div>`;
  $('set-password-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = $<HTMLInputElement>('new-password').value;
    const confirm = $<HTMLInputElement>('confirm-password').value;
    const button = $<HTMLButtonElement>('save-password');
    const message = $('password-message');
    if (password.length < 8) { message.textContent = 'Password minimal 8 karakter.'; return; }
    if (password !== confirm) { message.textContent = 'Konfirmasi password tidak sama.'; return; }
    if (!supabase) return;
    button.disabled = true;
    message.textContent = 'Menyimpan password…';
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        message.textContent = 'Gagal menyimpan password: ' + error.message;
      } else {
        await supabase.auth.signOut();
        showSignIn('Password berhasil dibuat. Silakan login menggunakan email dan password baru.');
      }
    } catch (error) {
      message.textContent = 'Terjadi kesalahan: ' + (error instanceof Error ? error.message : String(error));
    } finally {
      button.disabled = false;
    }
  });
}
function nextAccountLabel() {
  const highest = accounts.reduce((max, account) => {
    const number = /^\d{4,}$/.test(account.label) ? Number(account.label) : 0;
    return Math.max(max, number);
  }, 0);
  return String(highest + 1).padStart(4, '0');
}
function openProfileSettings(id: string) {
  const account = accounts.find(a => a.id === id);
  if (!account) return;
  editingProfileAccountId = id;
  const profile = getAccountProfile(id);
  $('profile-account-label').textContent = `${account.label} · ${account.email ?? 'Email belum diisi'}`;
  $<HTMLSelectElement>('profile-zoom').value = String(profile.zoom);
  $<HTMLSelectElement>('profile-start-page').value = profile.startPage;
  $<HTMLDialogElement>('profile-dialog').showModal();
}
function openEditAccount(id: string) {
  const account = accounts.find(a => a.id === id);
  if (!account) return;
  editingAccountId = id;
  $('account-dialog-title').textContent = 'Edit akun YouTube';
  $<HTMLInputElement>('account-name').value = account.label;
  $<HTMLInputElement>('account-email').value = account.email ?? '';
  $('save-account').textContent = 'Simpan perubahan';
  $<HTMLDialogElement>('account-dialog').showModal();
}
function resetAccountForm() {
  editingAccountId = null;
  ($('account-form') as HTMLFormElement).reset();
  $('account-dialog-title').textContent = 'Tambah akun YouTube';
  $<HTMLInputElement>('account-name').value = nextAccountLabel();
  $('save-account').textContent = 'Simpan akun';
}
async function deleteAccount(id: string) {
  const account = accounts.find(a => a.id === id);
  if (!account) return;
  if (!window.confirm(`Hapus akun "${account.label}" dari YT Manager?`)) return;
  if (!supabase) { toast('Konfigurasi Supabase belum diisi.'); return; }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { toast('Silakan login ke YT Manager terlebih dahulu.'); return; }
  const { error } = await supabase.from('yt_accounts').delete().eq('id', id).eq('user_id', session.user.id);
  if (error) { toast('Gagal menghapus akun: ' + error.message); return; }
  if (activeId === id) {
    activeId = '';
    $('browser-stage').innerHTML = '<div class="welcome"><div class="youtube-mark">▶</div><h2>Pilih akun untuk mulai</h2><p>YouTube akan dibuka di aplikasi desktop dengan sesi browser terpisah untuk setiap akun.</p><button id="choose" class="primary">Pilih akun</button></div>';
    $('choose').addEventListener('click', () => $('add').click());
  }
  await loadAccounts();
  toast('Akun berhasil dihapus.');
}
async function selectAccount(id: string) {
  activeId = id; render();
  const account = accounts.find(a => a.id === id);
  if (!account) return;
  if (window.ytManager?.openYouTube) {
    window.ytManager.openYouTube(account.id, account.email ?? '', getAccountProfile(account.id));
    $('browser-stage').innerHTML = '<div class="desktop-note"><h2>Memuat YouTube…</h2><p>Browser desktop sedang membuka sesi khusus akun ini.</p></div>';
  } else {
    $('browser-stage').innerHTML = '<div class="welcome"><div class="youtube-mark">▶</div><h2>' + escapeHtml(account.label) + '</h2><p>Profil browser akun ini siap digunakan di aplikasi desktop.</p><button class="primary" id="launch">Buka YouTube di tab baru</button><small>Di versi web, YouTube dibuka di tab terpisah. Untuk panel browser terintegrasi, gunakan aplikasi desktop.</small></div>';
    $('launch').addEventListener('click', () => {
      const continueUrl = encodeURIComponent('https://www.youtube.com/');
      const emailHint = account.email ? `&Email=${encodeURIComponent(account.email)}` : '';
      const accountChooserUrl = `https://accounts.google.com/AccountChooser?continue=${continueUrl}${emailHint}`;
      window.open(accountChooserUrl, '_blank', 'noopener');
    });
  }
}
$('logout').addEventListener('click', async () => {
  if (!supabase) return;
  if (!window.confirm('Yakin ingin keluar dari YT Manager?')) return;
  const button = $<HTMLButtonElement>('logout');
  button.disabled = true;
  button.textContent = 'Keluar…';
  const { error } = await supabase.auth.signOut();
  button.disabled = false;
  button.textContent = 'Keluar';
  if (error) toast('Gagal keluar: ' + error.message);
});
$('add').addEventListener('click', () => { resetAccountForm(); $<HTMLDialogElement>('account-dialog').showModal(); });
$('close-account-dialog').addEventListener('click', () => $<HTMLDialogElement>('account-dialog').close());
$('close-profile-dialog').addEventListener('click', () => $<HTMLDialogElement>('profile-dialog').close());
$('cancel-profile').addEventListener('click', () => $<HTMLDialogElement>('profile-dialog').close());
$('profile-dialog').addEventListener('click', event => { if (event.target === $('profile-dialog')) $<HTMLDialogElement>('profile-dialog').close(); });
$('profile-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!editingProfileAccountId) return;
  const profile: AccountProfile = { zoom: Number($<HTMLSelectElement>('profile-zoom').value), startPage: $<HTMLSelectElement>('profile-start-page').value === 'studio' ? 'studio' : 'home' };
  saveAccountProfile(editingProfileAccountId, profile);
  const isActive = activeId === editingProfileAccountId;
  $<HTMLDialogElement>('profile-dialog').close();
  toast('Profil akun tersimpan. ' + (isActive ? 'Buka ulang akun untuk menerapkan pengaturan.' : 'Pengaturan diterapkan saat akun dibuka.'));
  if (isActive) selectAccount(editingProfileAccountId);
});
$('cancel-account').addEventListener('click', () => $<HTMLDialogElement>('account-dialog').close());
$('account-dialog').addEventListener('click', event => {
  if (event.target === $('account-dialog')) $<HTMLDialogElement>('account-dialog').close();
});
$('choose').addEventListener('click', () => $('add').click());
$('search').addEventListener('input', e => { filter = (e.target as HTMLInputElement).value; render(); });
$('account-form').addEventListener('submit', async e => {
  e.preventDefault();
  const label = editingAccountId
    ? accounts.find(account => account.id === editingAccountId)?.label ?? ''
    : nextAccountLabel();
  const email = $<HTMLInputElement>('account-email').value.trim() || null;
  if (!label) return;
  if (!supabase) { toast('Konfigurasi Supabase belum diisi.'); return; }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { toast('Silakan login ke YT Manager terlebih dahulu.'); return; }
  const result = editingAccountId
    ? await supabase.from('yt_accounts').update({ label, email }).eq('id', editingAccountId).eq('user_id', session.user.id)
    : await supabase.from('yt_accounts').insert({ label, email, user_id: session.user.id }).select('id').single();
  if (result.error) { toast((editingAccountId ? 'Gagal memperbarui: ' : 'Gagal menyimpan: ') + result.error.message); return; }
  const wasEditing = Boolean(editingAccountId);
  if (!wasEditing && result.data?.id) saveAccountProfile(result.data.id, { ...DEFAULT_PROFILE });
  $<HTMLDialogElement>('account-dialog').close();
  resetAccountForm();
  await loadAccounts();
  toast(wasEditing ? 'Akun berhasil diperbarui.' : 'Akun berhasil ditambahkan.');
});
supabase?.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') { showSetPasswordForm(); return; }
  void loadAccounts();
});
void loadAccounts();
