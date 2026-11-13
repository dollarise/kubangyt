import './style.css';
import { createClient } from '@supabase/supabase-js';

declare global { interface Window { ytManager?: { openYouTube: (id: string) => void; setBrowserBounds: (bounds: {x:number;y:number;width:number;height:number}) => void; } } }

const env = import.meta.env;
// Supabase publishable key is designed for public client-side use. Environment variables override these defaults.
const supabaseUrl = (env.VITE_SUPABASE_URL as string | undefined) ?? 'https://dwphicuwoeanxcwyihfj.supabase.co';
const supabaseKey = (env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? 'sb_publishable_Ay3EVoUrBVBLCVIyevofVA_BOBpQ1w7';
const youtubeApiKey = (env.VITE_YOUTUBE_API_KEY as string | undefined) ?? '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

type Account = { id: string; label: string; email: string | null; channel_url: string | null; created_at?: string };
let accounts: Account[] = [];
let activeId = '';
let filter = '';
let editingAccountId: string | null = null;

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div class="shell">
    <header class="topbar"><div class="brand"><span class="brand-icon">▶</span><span>YT <b>Manager</b></span></div><div class="top-actions"><span id="connection" class="status"><i></i> Local mode</span><button id="stats" class="secondary">Statistik Channel</button><button id="add" class="primary">＋ Tambah akun</button></div></header>
    <main class="layout">
      <section class="browser-panel">
        <div class="browser-head"><div><span class="eyebrow">WORKSPACE</span><h1>YouTube</h1></div><span id="active-label" class="active-label">Belum ada akun dipilih</span></div>
        <div class="browser-toolbar"><button class="tool" id="back" title="Kembali">‹</button><button class="tool" id="forward" title="Maju">›</button><button class="tool" id="reload" title="Muat ulang">↻</button><div class="address">https://www.youtube.com</div><button class="tool" id="open" title="Buka YouTube">↗</button></div>
        <div class="browser-stage" id="browser-stage"><div class="welcome"><div class="youtube-mark">▶</div><h2>Pilih akun untuk mulai</h2><p>YouTube akan dibuka di aplikasi desktop dengan sesi browser terpisah untuk setiap akun.</p><button id="choose" class="primary">Pilih akun</button><small>Versi web hanya menampilkan dashboard. Browser YouTube penuh tersedia di aplikasi desktop.</small></div></div>
      </section>
      <aside class="accounts-panel"><div class="accounts-title"><div><span class="eyebrow">ACCOUNT CENTER</span><h2>Semua Akun</h2></div><span id="count" class="count">0</span></div><label class="search"><span>⌕</span><input id="search" placeholder="Cari nama atau email..." /></label><div class="account-list" id="account-list"><div class="empty">Belum ada akun. Tambahkan akun pertama.</div></div><div class="panel-foot"><span>Profil browser disimpan lokal di perangkat</span><span class="dot"></span></div></aside>
    </main>
    <footer><span>YT Manager v1.0</span><span>Data akun tersimpan di Supabase · Sesi browser tersimpan lokal</span></footer>
  </div>
  <dialog id="account-dialog"><form id="account-form"><div class="dialog-head"><h2 id="account-dialog-title">Tambah akun YouTube</h2><button class="tool" id="close-account-dialog" type="button" aria-label="Tutup">×</button></div><label>Nama akun<input id="account-name" required placeholder="Contoh: Channel Utama" /></label><label>Email (opsional)<input id="account-email" type="email" placeholder="nama@gmail.com" /></label><label>URL channel (opsional)<input id="account-url" type="url" placeholder="https://www.youtube.com/@channel" /></label><div class="dialog-actions"><button class="secondary" id="cancel-account" type="button">Batal</button><button class="primary" id="save-account" type="submit">Simpan akun</button></div></form></dialog>
  <div id="toast" class="toast" role="status"></div>`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
function syncDesktopBrowserBounds() { const stage = $('browser-stage'); if (!window.ytManager || !stage) return; const r = stage.getBoundingClientRect(); window.ytManager.setBrowserBounds({x:r.x,y:r.y,width:r.width,height:r.height}); }
window.addEventListener('resize', syncDesktopBrowserBounds);
new MutationObserver(syncDesktopBrowserBounds).observe(document.documentElement,{childList:true,subtree:true,attributes:true});
setTimeout(syncDesktopBrowserBounds,500);
const toast = (message: string) => { const el = $('toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2800); };
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

function render() {
  $('count').textContent = String(accounts.length);
  $('active-label').textContent = accounts.find(a => a.id === activeId)?.label ?? 'Belum ada akun dipilih';
  const list = $('account-list');
  const filtered = accounts.filter(a => (a.label + ' ' + (a.email ?? '')).toLowerCase().includes(filter.toLowerCase()));
  list.innerHTML = filtered.length ? filtered.map(a => `<div class="account-row"><button class="account account-select ${a.id === activeId ? 'selected' : ''}" data-id="${a.id}"><span class="avatar">${escapeHtml(a.label.slice(0,1).toUpperCase())}</span><span class="account-meta"><b>${escapeHtml(a.label)}</b><small>${escapeHtml(a.email ?? 'Email belum diisi')}</small></span><span class="account-state">${a.id === activeId ? '● Aktif' : 'Pilih'}</span></button><button class="account-edit" data-edit-id="${a.id}" aria-label="Edit akun ${escapeHtml(a.label)}" title="Edit akun">Edit</button><button class="account-delete" data-delete-id="${a.id}" aria-label="Hapus akun ${escapeHtml(a.label)}" title="Hapus akun">Hapus</button></div>`).join('') : '<div class="empty">Tidak ada akun yang cocok.</div>';
  list.querySelectorAll<HTMLButtonElement>('.account-select').forEach(button => button.addEventListener('click', () => selectAccount(button.dataset.id!)));
  list.querySelectorAll<HTMLButtonElement>('.account-edit').forEach(button => button.addEventListener('click', () => openEditAccount(button.dataset.editId!)));
  list.querySelectorAll<HTMLButtonElement>('.account-delete').forEach(button => button.addEventListener('click', () => deleteAccount(button.dataset.deleteId!)));
}
async function loadAccounts() {
  if (!supabase) { $('connection').innerHTML = '<i></i> Demo mode'; accounts = []; render(); return; }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { $('connection').innerHTML = '<i></i> Belum login'; showSignIn(); return; }
  $('connection').innerHTML = '<i></i> Supabase terhubung';
  const { data, error } = await supabase.from('yt_accounts').select('id,label,email,channel_url,created_at').order('created_at', { ascending: true });
  if (error) { toast('Gagal memuat akun: ' + error.message); return; }
  accounts = data ?? []; render();
}
function showSignIn() {
  const stage = $('browser-stage');
  stage.innerHTML = `
    <div class="welcome">
      <div class="youtube-mark">▶</div>
      <h2>Masuk ke YT Manager</h2>
      <p>Gunakan akun autentikasi aplikasi. Ini terpisah dari login Google/YouTube di browser.</p>
      <form id="signin-form" class="signin-form">
        <input id="signin-email" type="email" autocomplete="email" required placeholder="Masukkan alamat email" aria-label="Alamat email" />
        <button id="signin" class="primary" type="submit">Kirim link login ke email</button>
      </form>
      <small id="signin-message">Link login akan dikirim ke alamat email Anda. Periksa juga folder Spam.</small>
    </div>`;
  $('signin-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = $<HTMLInputElement>('signin-email').value.trim();
    const button = $<HTMLButtonElement>('signin');
    const message = $('signin-message');
    if (!email || !supabase) return;
    button.disabled = true;
    button.textContent = 'Mengirim link…';
    message.textContent = 'Sedang mengirim link login ke ' + email;
    try {
      // Let Supabase use its configured Site URL. location.origin is "null"
      // when Electron loads the renderer from a file:// URL.
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) {
        message.textContent = 'Gagal mengirim link: ' + error.message;
      } else {
        message.textContent = 'Link login berhasil dikirim ke ' + email + '. Periksa Inbox atau Spam.';
      }
    } catch (error) {
      message.textContent = 'Terjadi kesalahan: ' + (error instanceof Error ? error.message : String(error));
    } finally {
      button.disabled = false;
      button.textContent = 'Kirim ulang link login';
    }
  });
}
function openEditAccount(id: string) {
  const account = accounts.find(a => a.id === id);
  if (!account) return;
  editingAccountId = id;
  $('account-dialog-title').textContent = 'Edit akun YouTube';
  $<HTMLInputElement>('account-name').value = account.label;
  $<HTMLInputElement>('account-email').value = account.email ?? '';
  $<HTMLInputElement>('account-url').value = account.channel_url ?? '';
  $('save-account').textContent = 'Simpan perubahan';
  $<HTMLDialogElement>('account-dialog').showModal();
}
function resetAccountForm() {
  editingAccountId = null;
  ($('account-form') as HTMLFormElement).reset();
  $('account-dialog-title').textContent = 'Tambah akun YouTube';
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
function showChannelStats() {
  const account = accounts.find(a => a.id === activeId);
  const stage = $('browser-stage');
  if (!account) { toast('Pilih akun YouTube terlebih dahulu.'); return; }
  stage.innerHTML = `
    <section class="stats-view">
      <div class="stats-heading"><div><span class="eyebrow">CHANNEL INSIGHTS</span><h2>Statistik Channel</h2><p>${escapeHtml(account.label)}</p></div><button id="refresh-stats" class="secondary">↻ Muat ulang</button></div>
      <div id="stats-content" class="stats-content"><div class="stats-loading">Memuat statistik channel…</div></div>
    </section>`;
  $('refresh-stats').addEventListener('click', () => { void loadChannelStats(account); });
  void loadChannelStats(account);
}
function formatCount(value: string | undefined) {
  return value === undefined ? 'Disembunyikan' : Number(value).toLocaleString('id-ID');
}
async function loadChannelStats(account: Account) {
  const content = $('stats-content');
  if (!content) return;
  if (!youtubeApiKey) {
    content.innerHTML = '<div class="stats-empty"><h3>API YouTube belum dikonfigurasi</h3><p>Tambahkan <b>VITE_YOUTUBE_API_KEY</b> di Environment Variables Cloudflare Pages. Aktifkan YouTube Data API v3 di Google Cloud terlebih dahulu.</p></div>';
    return;
  }
  if (!account.channel_url) {
    content.innerHTML = '<div class="stats-empty"><h3>URL channel belum diisi</h3><p>Edit akun ini dan masukkan URL channel YouTube, misalnya https://www.youtube.com/@namachannel atau URL /channel/UC…</p></div>';
    return;
  }
  const handle = account.channel_url.match(/youtube\\.com\\/@([^/?#]+)/i)?.[1];
  const channelId = account.channel_url.match(/youtube\\.com\\/channel\\/(UC[\\w-]+)/i)?.[1];
  if (!handle && !channelId) {
    content.innerHTML = '<div class="stats-empty"><h3>URL channel belum didukung</h3><p>Gunakan URL handle seperti youtube.com/@namachannel atau URL channel seperti youtube.com/channel/UC…</p></div>';
    return;
  }
  content.innerHTML = '<div class="stats-loading">Mengambil data dari YouTube…</div>';
  try {
    const params = new URLSearchParams({ part: 'snippet,statistics', key: youtubeApiKey });
    if (handle) params.set('forHandle', handle);
    if (channelId) params.set('id', channelId);
    const response = await fetch('https://www.googleapis.com/youtube/v3/channels?' + params.toString());
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error?.message ?? 'Permintaan YouTube API gagal.');
    const channel = payload.items?.[0];
    if (!channel) throw new Error('Channel tidak ditemukan. Periksa URL channel yang tersimpan.');
    const stats = channel.statistics ?? {};
    content.innerHTML = `
      <div class="stats-channel"><img src="${escapeHtml(channel.snippet?.thumbnails?.default?.url ?? '')}" alt="" /><div><b>${escapeHtml(channel.snippet?.title ?? account.label)}</b><small>Data publik dari YouTube</small></div></div>
      <div class="stats-grid">
        <article class="stat-card"><span>Subscriber</span><strong>${formatCount(stats.subscriberCount)}</strong></article>
        <article class="stat-card"><span>Total penayangan</span><strong>${formatCount(stats.viewCount)}</strong></article>
        <article class="stat-card"><span>Jumlah video</span><strong>${formatCount(stats.videoCount)}</strong></article>
      </div>
      <p class="stats-footnote">Statistik publik channel. Jumlah subscriber dapat dibulatkan atau disembunyikan oleh pemilik channel. Data diperbarui saat tombol Muat ulang ditekan.</p>`;
  } catch (error) {
    content.innerHTML = '<div class="stats-empty"><h3>Gagal memuat statistik</h3><p>' + escapeHtml(error instanceof Error ? error.message : String(error)) + '</p><small>Pastikan API key aktif, YouTube Data API v3 diaktifkan, dan pembatasan API key mengizinkan domain aplikasi.</small></div>';
  }
}
async function selectAccount(id: string) {
  activeId = id; render();
  const account = accounts.find(a => a.id === id);
  if (!account) return;
  if (window.ytManager?.openYouTube) {
    window.ytManager.openYouTube(account.id);
    $('browser-stage').innerHTML = '<div class="desktop-note"><h2>Memuat YouTube…</h2><p>Browser desktop sedang membuka sesi khusus akun ini.</p></div>';
  } else {
    $('browser-stage').innerHTML = '<div class="welcome"><div class="youtube-mark">▶</div><h2>' + escapeHtml(account.label) + '</h2><p>Profil browser akun ini siap digunakan di aplikasi desktop.</p><button class="primary" id="launch">Buka YouTube di tab baru</button><small>Di versi web, YouTube dibuka di tab terpisah. Untuk panel browser terintegrasi, gunakan aplikasi desktop.</small></div>';
    $('launch').addEventListener('click', () => window.open('https://www.youtube.com', '_blank', 'noopener'));
  }
}
$('stats').addEventListener('click', showChannelStats);
$('add').addEventListener('click', () => { resetAccountForm(); $<HTMLDialogElement>('account-dialog').showModal(); });
$('close-account-dialog').addEventListener('click', () => $<HTMLDialogElement>('account-dialog').close());
$('cancel-account').addEventListener('click', () => $<HTMLDialogElement>('account-dialog').close());
$('account-dialog').addEventListener('click', event => {
  if (event.target === $('account-dialog')) $<HTMLDialogElement>('account-dialog').close();
});
$('choose').addEventListener('click', () => $('add').click());
$('search').addEventListener('input', e => { filter = (e.target as HTMLInputElement).value; render(); });
$('account-form').addEventListener('submit', async e => {
  e.preventDefault();
  const label = $<HTMLInputElement>('account-name').value.trim();
  const email = $<HTMLInputElement>('account-email').value.trim() || null;
  const channel_url = $<HTMLInputElement>('account-url').value.trim() || null;
  if (!label) return;
  if (!supabase) { toast('Konfigurasi Supabase belum diisi.'); return; }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { toast('Silakan login ke YT Manager terlebih dahulu.'); return; }
  const result = editingAccountId
    ? await supabase.from('yt_accounts').update({ label, email, channel_url }).eq('id', editingAccountId).eq('user_id', session.user.id)
    : await supabase.from('yt_accounts').insert({ label, email, channel_url, user_id: session.user.id });
  if (result.error) { toast((editingAccountId ? 'Gagal memperbarui: ' : 'Gagal menyimpan: ') + result.error.message); return; }
  const wasEditing = Boolean(editingAccountId);
  $<HTMLDialogElement>('account-dialog').close();
  resetAccountForm();
  await loadAccounts();
  toast(wasEditing ? 'Akun berhasil diperbarui.' : 'Akun berhasil ditambahkan.');
});
$('open').addEventListener('click', () => window.open('https://www.youtube.com', '_blank', 'noopener'));
$('reload').addEventListener('click', () => { if (activeId) selectAccount(activeId); });
$('back').addEventListener('click', () => toast('Navigasi kembali tersedia di browser desktop.'));
$('forward').addEventListener('click', () => toast('Navigasi maju tersedia di browser desktop.'));
supabase?.auth.onAuthStateChange(() => { void loadAccounts(); });
void loadAccounts();
