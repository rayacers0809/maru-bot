// Bot Dashboard 프론트 로직
const $ = (id) => document.getElementById(id);
const show = (el) => el.classList.remove('hidden');
const hide = (el) => el.classList.add('hidden');

let state = {
  user: null,
  guilds: [],
  currentGuild: null,
  config: null,
  channels: [],
  dirty: false,
};

// ---------- 초기화 ----------
async function init() {
  try {
    const res = await fetch('/api/me', { credentials: 'include' });
    if (!res.ok) return showLogin();
    const data = await res.json();
    state.user = data.user;
    state.guilds = data.guilds || [];
    renderUser();
    renderGuilds();
    hide($('login'));
    show($('guilds'));
  } catch {
    showLogin();
  }
}

function showLogin() {
  show($('login'));
  hide($('guilds'));
  hide($('settings'));
}

function renderUser() {
  const avatar = state.user.avatar
    ? `https://cdn.discordapp.com/avatars/${state.user.id}/${state.user.avatar}.png?size=64`
    : `https://cdn.discordapp.com/embed/avatars/0.png`;
  $('userArea').innerHTML =
    `<img src="${avatar}" alt=""><span>${escapeHtml(state.user.username)}</span>` +
    `<button class="btn ghost sm" onclick="location.href='/api/auth/logout'">로그아웃</button>`;
}

// ---------- 서버 목록 ----------
function renderGuilds() {
  const grid = $('guildGrid');
  if (!state.guilds.length) {
    grid.innerHTML = `<p style="color:var(--muted);font-size:.9rem">관리 권한이 있는 서버가 없습니다. 봇이 들어가 있는 서버에서 관리자 권한이 필요합니다.</p>`;
    return;
  }
  grid.innerHTML = state.guilds.map(g => {
    const icon = g.icon
      ? `<img src="https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128" alt="">`
      : `<div class="ph">${escapeHtml((g.name || '?')[0])}</div>`;
    return `<div class="guild" data-id="${g.id}">${icon}<span class="nm">${escapeHtml(g.name)}</span></div>`;
  }).join('');
  grid.querySelectorAll('.guild').forEach(el => {
    el.onclick = () => openGuild(el.dataset.id);
  });
}

// ---------- 설정 화면 ----------
async function openGuild(guildId) {
  const guild = state.guilds.find(g => g.id === guildId);
  state.currentGuild = guild;
  $('curGuildName').textContent = guild.name;

  // 설정 + 채널 목록 로드
  const res = await fetch(`/api/guild/${guildId}`, { credentials: 'include' });
  if (!res.ok) { alert('설정을 불러오지 못했습니다. 봇이 해당 서버에 있는지 확인하세요.'); return; }
  const data = await res.json();
  state.config = data.config;
  state.channels = data.channels || [];

  fillForm();
  hide($('guilds'));
  show($('settings'));
  state.dirty = false;
  updateSaveBar();
  window.scrollTo(0, 0);
}

function channelOptions(selectedId, type) {
  // type: 'text' | 'all'
  const list = state.channels.filter(c => type === 'all' ? true : c.type === 0);
  return `<option value="">선택 안 함</option>` + list.map(c =>
    `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}># ${escapeHtml(c.name)}</option>`
  ).join('');
}

function fillForm() {
  const c = state.config;
  // 음성 로그
  $('voiceLog').checked = !!c.voiceLog?.enabled;
  $('voiceLogChannel').innerHTML = channelOptions(c.voiceLog?.channelId, 'text');
  // 메시지 로그
  $('messageLog').checked = !!c.messageLog?.enabled;
  $('messageLogChannel').innerHTML = channelOptions(c.messageLog?.channelId, 'text');
  // 환영
  $('welcome').checked = !!c.welcome?.enabled;
  $('welcomeChannel').innerHTML = channelOptions(c.welcome?.channelId, 'text');
  $('welcomeMsg').value = c.welcome?.message || '';
  // 필터
  $('swearFilter').checked = !!c.swearFilter?.enabled;
  $('spamFilter').checked = !!c.spamFilter?.enabled;
  $('spamThreshold').value = c.spamFilter?.threshold ?? 5;
  $('spamSeconds').value = c.spamFilter?.seconds ?? 5;

  syncSubVisibility();
}

function syncSubVisibility() {
  $('voiceLogSub').classList.toggle('show', $('voiceLog').checked);
  $('messageLogSub').classList.toggle('show', $('messageLog').checked);
  $('welcomeSub').classList.toggle('show', $('welcome').checked);
  $('spamFilterSub').classList.toggle('show', $('spamFilter').checked);
}

function collectForm() {
  return {
    voiceLog: { enabled: $('voiceLog').checked, channelId: $('voiceLogChannel').value || null },
    messageLog: { enabled: $('messageLog').checked, channelId: $('messageLogChannel').value || null },
    welcome: {
      enabled: $('welcome').checked,
      channelId: $('welcomeChannel').value || null,
      message: $('welcomeMsg').value.trim() || '{user} 님 환영합니다! 🎉',
    },
    swearFilter: { enabled: $('swearFilter').checked, action: 'delete' },
    spamFilter: {
      enabled: $('spamFilter').checked,
      threshold: Math.max(2, Math.min(20, +$('spamThreshold').value || 5)),
      seconds: Math.max(1, Math.min(60, +$('spamSeconds').value || 5)),
    },
  };
}

function markDirty() { state.dirty = true; updateSaveBar(); }
function updateSaveBar() { $('savebar').classList.toggle('show', state.dirty); }

async function save() {
  const payload = collectForm();
  $('saveBtn').disabled = true;
  $('saveBtn').textContent = '저장 중...';
  try {
    const res = await fetch(`/api/guild/${state.currentGuild.id}`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error();
    state.config = payload;
    state.dirty = false;
    updateSaveBar();
    toast('저장되었습니다');
  } catch {
    toast('저장 실패 — 다시 시도하세요');
  } finally {
    $('saveBtn').disabled = false;
    $('saveBtn').textContent = '저장하기';
  }
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// ---------- 이벤트 바인딩 ----------
document.addEventListener('change', (e) => {
  if (e.target.closest('#settings')) {
    syncSubVisibility();
    markDirty();
  }
});
document.addEventListener('input', (e) => {
  if (e.target.matches('#welcomeMsg, #spamThreshold, #spamSeconds')) markDirty();
});
$('saveBtn').onclick = save;
$('backBtn').onclick = () => {
  if (state.dirty && !confirm('저장하지 않은 변경사항이 있습니다. 나가시겠어요?')) return;
  hide($('settings'));
  show($('guilds'));
  state.dirty = false;
  updateSaveBar();
};

init();
