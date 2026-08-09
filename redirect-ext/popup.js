// ============================================================
//  URL Redirect Pro - popup.js
// ============================================================

// ── Tab switching ──────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
  });
});

// ── Helpers ───────────────────────────────────────────────
function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return `${Math.floor(diff / 1000)}s trước`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}p trước`;
  return new Date(ts).toLocaleTimeString('vi-VN');
}

function truncate(str, n) {
  return str && str.length > n ? str.slice(0, n) + '…' : str;
}

// ── Render HTML Fallback card ─────────────────────────────
function renderHtmlFallback(fbCfg) {
  const card    = document.getElementById('htmlFallbackCard');
  const badge   = document.getElementById('fbBadge');
  const desc    = document.getElementById('fbDesc');
  const patterns = document.getElementById('fbPatterns');

  if (!fbCfg) { card.style.display = 'none'; return; }

  card.style.display = 'block';

  if (fbCfg.enabled) {
    badge.textContent = 'ON';
    badge.className = 'fb-badge on';
  } else {
    badge.textContent = 'OFF';
    badge.className = 'fb-badge off';
  }

  desc.textContent = fbCfg.description || 'Thêm .html nếu page 404';

  const pts = fbCfg.matchPatterns || [];
  patterns.innerHTML = pts.map(p => `<span class="fb-pattern">${p}</span>`).join('');
}

// ── Render Rules ──────────────────────────────────────────
function renderRules(rules) {
  const list = document.getElementById('rulesList');
  const enabledCount = rules.filter(r => r.enabled).length;

  document.getElementById('stat-total').textContent = rules.length;
  document.getElementById('stat-enabled').textContent = enabledCount;

  if (!rules.length) {
    list.innerHTML = `<div class="empty-state"><div class="icon">📭</div>Không có rule nào trong config.json</div>`;
    return;
  }

  list.innerHTML = rules.map(rule => `
    <div class="rule-card ${rule.enabled ? '' : 'disabled'}">
      <div class="rule-header">
        <div class="rule-id" title="${rule.id}">${rule.id}</div>
        <span class="type-badge">${rule.matchType || 'prefix'}</span>
        <span class="badge ${rule.enabled ? 'enabled' : 'disabled'}">${rule.enabled ? 'ON' : 'OFF'}</span>
      </div>
      <div class="rule-arrow">
        <div class="rule-url">
          <span class="label">FROM</span>
          <span class="url-val" title="${rule.from}">${truncate(rule.from, 45)}</span>
        </div>
        <div class="rule-url to">
          <span class="label">TO</span>
          <span class="url-val" title="${rule.to}">${truncate(rule.to, 45)}</span>
        </div>
      </div>
      ${rule.description ? `<div class="rule-desc">${rule.description}</div>` : ''}
    </div>
  `).join('');
}

// ── Render History ────────────────────────────────────────
function renderHistory(history) {
  const list = document.getElementById('historyList');

  if (!history || !history.length) {
    list.innerHTML = `<div class="empty-state"><div class="icon">📭</div>Chưa có redirect nào được ghi nhận.</div>`;
    return;
  }

  list.innerHTML = history.map(h => `
    <div class="history-item">
      <div class="h-rule">↪ ${h.ruleId}</div>
      <div class="h-from" title="${h.from}">🔗 ${truncate(h.from, 50)}</div>
      <div class="h-to" title="${h.to}">✓ ${truncate(h.to, 50)}</div>
      <div class="h-time">🕐 ${timeAgo(h.timestamp)}</div>
    </div>
  `).join('');
}

// ── Load data from storage + background ──────────────────
async function loadData() {
  try {
    const {
      redirectRules = [],
      redirectHistory = [],
      htmlFallbackConfig = null
    } = await chrome.storage.local.get([
      'redirectRules',
      'redirectHistory',
      'htmlFallbackConfig'
    ]);

    renderRules(redirectRules);
    renderHistory(redirectHistory);
    renderHtmlFallback(htmlFallbackConfig);

    document.getElementById('stat-hits').textContent = redirectHistory.length;

    const activeRules = redirectRules.filter(r => r.enabled).length;
    const fbOn = htmlFallbackConfig?.enabled ? ' + HTML Fallback ON' : '';
    document.getElementById('statusText').textContent = `${activeRules} rules${fbOn}`;

  } catch (err) {
    console.error('[RedirectPro Popup] Lỗi load data:', err);
    document.getElementById('rulesList').innerHTML =
      `<div class="empty-state"><div class="icon">⚠️</div>Lỗi khi tải dữ liệu.</div>`;
  }
}

// ── Reload config button ──────────────────────────────────
const reloadBtn = document.getElementById('reloadBtn');
reloadBtn.addEventListener('click', async () => {
  reloadBtn.classList.add('spinning');
  reloadBtn.disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({ type: 'RELOAD_CONFIG' });
    if (response) {
      if (response.rules)        renderRules(response.rules);
      if (response.htmlFallback) renderHtmlFallback(response.htmlFallback);

      const activeRules = (response.rules || []).filter(r => r.enabled).length;
      const fbOn = response.htmlFallback?.enabled ? ' + HTML Fallback ON' : '';
      document.getElementById('statusText').textContent =
        `Reloaded: ${activeRules} rules${fbOn}`;
    }
  } catch (e) {
    document.getElementById('statusText').textContent = 'Lỗi reload config';
  }

  setTimeout(() => {
    reloadBtn.classList.remove('spinning');
    reloadBtn.disabled = false;
  }, 600);
});

// ── Clear history button ──────────────────────────────────
document.getElementById('clearHistoryBtn').addEventListener('click', async () => {
  await chrome.storage.local.set({ redirectHistory: [] });
  renderHistory([]);
  document.getElementById('stat-hits').textContent = '0';
});

// ── Init ─────────────────────────────────────────────────
loadData();
