// ============================================================
//  URL Redirect Pro - popup.js
// ============================================================

let currentConfig = {
  rules: [],
  aemAuthorRewrite: {
    enabled: true,
    localhostBase: "http://localhost:4502",
    defaultSiteName: "mysite",
    liveDomains: ["https://live-site.com"]
  },
  htmlFallback: {
    enabled: true,
    matchPatterns: ["http://localhost:4502/*"],
    pathPrefixes: ["/content/mysite"],
    skipIfPathEndsWith: [".js", ".css", ".png", ".jpg", ".svg", ".json", ".woff2"]
  }
};

let editingRuleIndex = -1;

function resetRuleForm() {
  document.getElementById('ruleIdInput').value = '';
  document.getElementById('ruleFromInput').value = '';
  document.getElementById('ruleToInput').value = '';
  document.getElementById('ruleDescInput').value = '';
  document.getElementById('addRuleBtn').textContent = '➕ Add Rule';
  editingRuleIndex = -1;
}

// ─── Tabs Navigation Control ──────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));

    tab.classList.add('active');
    document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');

    if (tab.dataset.tab === 'json') {
      updateJsonAreaFromConfig();
    }
  });
});

// ─── Toast Notification Helper ────────────────────────────
function showToast(message, bgColor = "#10b981") {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.style.backgroundColor = bgColor;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
}

// ─── Render Functions ───────────────────────────────────────

function renderAemSettings() {
  const aem = currentConfig.aemAuthorRewrite || {};
  document.getElementById('aemEnabled').checked = !!aem.enabled;
  document.getElementById('aemSiteName').value = aem.defaultSiteName || 'mysite';

  const domainsContainer = document.getElementById('liveDomainsList');
  const domains = aem.liveDomains || [];
  domainsContainer.innerHTML = domains.map((domain, index) => `
    <div class="tag-item">
      <span>${domain}</span>
      <span class="remove-tag" data-domain-index="${index}">✕</span>
    </div>
  `).join('');

  document.querySelectorAll('[data-domain-index]').forEach(el => {
    el.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.domainIndex, 10);
      currentConfig.aemAuthorRewrite.liveDomains.splice(idx, 1);
      renderAemSettings();
    });
  });
}

function renderFallbackSettings() {
  const fb = currentConfig.htmlFallback || {};
  document.getElementById('htmlFallbackEnabled').checked = !!fb.enabled;

  const prefixesContainer = document.getElementById('prefixesList');
  const prefixes = fb.pathPrefixes || [];
  prefixesContainer.innerHTML = prefixes.map((prefix, index) => `
    <div class="tag-item">
      <span>${prefix}</span>
      <span class="remove-tag" data-prefix-index="${index}">✕</span>
    </div>
  `).join('');

  document.querySelectorAll('[data-prefix-index]').forEach(el => {
    el.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.prefixIndex, 10);
      currentConfig.htmlFallback.pathPrefixes.splice(idx, 1);
      renderFallbackSettings();
    });
  });
}

function renderRulesList() {
  const container = document.getElementById('rulesContainer');
  const rules = currentConfig.rules || [];
  document.getElementById('ruleCount').textContent = rules.length;

  if (!rules.length) {
    container.innerHTML = `<div style="font-size:11px; color:var(--text-secondary); text-align:center; padding:15px; font-family:'JetBrains Mono', monospace;">No rules configured yet.</div>`;
    return;
  }

  container.innerHTML = rules.map((rule, idx) => `
    <div class="rule-item">
      <div class="rule-item-header">
        <span class="rule-item-title">${rule.id}</span>
        <div style="display:flex; align-items:center; gap:8px;">
          <label class="switch-toggle">
            <input type="checkbox" data-rule-toggle="${idx}" ${rule.enabled ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
          <button class="btn-icon" data-rule-edit="${idx}" title="Edit Rule">✏️</button>
          <button class="btn-icon" data-rule-delete="${idx}" title="Delete Rule">🗑</button>
        </div>
      </div>
      <div class="rule-item-body">
        <div>FROM: ${rule.from}</div>
        <div class="to">TO: ${rule.to}</div>
        ${rule.description ? `<div style="color:var(--text-secondary); margin-top:2px;">${rule.description}</div>` : ''}
      </div>
    </div>
  `).join('');

  document.querySelectorAll('[data-rule-toggle]').forEach(el => {
    el.addEventListener('change', (e) => {
      const idx = parseInt(e.target.dataset.ruleToggle, 10);
      currentConfig.rules[idx].enabled = e.target.checked;
    });
  });

  document.querySelectorAll('[data-rule-edit]').forEach(el => {
    el.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.ruleEdit, 10);
      const rule = currentConfig.rules[idx];
      if (!rule) return;
      document.getElementById('ruleIdInput').value = rule.id;
      document.getElementById('ruleFromInput').value = rule.from;
      document.getElementById('ruleToInput').value = rule.to;
      document.getElementById('ruleTypeInput').value = rule.matchType || 'prefix';
      document.getElementById('ruleDescInput').value = rule.description || '';
      document.getElementById('addRuleBtn').textContent = '💾 Update Rule';
      editingRuleIndex = idx;
    });
  });

  document.querySelectorAll('[data-rule-delete]').forEach(el => {
    el.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.ruleDelete, 10);
      if (editingRuleIndex === idx) {
        resetRuleForm();
      }
      currentConfig.rules.splice(idx, 1);
      renderRulesList();
    });
  });
}

function updateJsonAreaFromConfig() {
  document.getElementById('jsonArea').value = JSON.stringify(currentConfig, null, 2);
}

// ─── Collect UI inputs into currentConfig ───────────────────
function collectUiToConfig() {
  currentConfig.aemAuthorRewrite = currentConfig.aemAuthorRewrite || {};
  currentConfig.aemAuthorRewrite.enabled = document.getElementById('aemEnabled').checked;
  currentConfig.aemAuthorRewrite.localhostBase = "http://localhost:4502";
  currentConfig.aemAuthorRewrite.defaultSiteName = document.getElementById('aemSiteName').value.trim();

  currentConfig.htmlFallback = currentConfig.htmlFallback || {};
  currentConfig.htmlFallback.enabled = document.getElementById('htmlFallbackEnabled').checked;
}

// ─── Load & Save Data ──────────────────────────────────────
async function loadData() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
    if (response && response.config) {
      currentConfig = response.config;
    }

    renderAemSettings();
    renderFallbackSettings();
    renderRulesList();

  } catch (err) {
    console.error("[RedirectPro Popup] Error loading data:", err);
  }
}

async function saveAllConfig() {
  try {
    const activeTab = document.querySelector('.tab.active')?.dataset.tab;
    if (activeTab === 'json') {
      try {
        const parsed = JSON.parse(document.getElementById('jsonArea').value);
        currentConfig = parsed;
      } catch (jsonErr) {
        showToast("JSON Syntax Error!", "#ef4444");
        return;
      }
    } else {
      collectUiToConfig();
    }

    const saveRes = await chrome.runtime.sendMessage({
      type: "SAVE_CONFIG",
      config: currentConfig
    });

    if (saveRes && saveRes.status === 'saved') {
      showToast("Saved & Applied!", "#10b981");
      renderAemSettings();
      renderFallbackSettings();
      renderRulesList();
      updateJsonAreaFromConfig();
    }
  } catch (err) {
    console.error("[RedirectPro Popup] Error saving config:", err);
  }
}

// ─── Active Action: Open/Toggle Current Page in AEM Editor ───
document.getElementById('openInEditorBtn').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0] || !tabs[0].url) return;

    const currentUrlStr = tabs[0].url;
    let urlObj;
    try {
      urlObj = new URL(currentUrlStr);
    } catch {
      showToast("Invalid page URL!", "#ef4444");
      return;
    }

    const localhostBase = "http://localhost:4502";
    const siteName = (currentConfig.aemAuthorRewrite?.defaultSiteName || "mysite").replace(/^\/+|\/+$/g, "");

    let pathname = urlObj.pathname;
    const searchAndHash = urlObj.search + urlObj.hash;

    // Toggle Mode: If already in editor mode -> strip /editor.html to view Preview Mode
    if (pathname.includes("/editor.html")) {
      let previewPath = pathname.replace("/editor.html", "");
      if (!previewPath.startsWith("/")) previewPath = "/" + previewPath;
      const targetPreviewUrl = localhostBase + previewPath + searchAndHash;

      chrome.tabs.update(tabs[0].id, { url: targetPreviewUrl });
      showToast("Switched to Preview Mode", "#6366f1");
      return;
    }

    // Convert Mode: Transform current page URL to AEM Author Editor URL (/editor.html/content/{siteName}/...)
    let cleanPath = pathname.replace(/\/{2,}/g, "/");

    if (!cleanPath.startsWith("/content/")) {
      cleanPath = `/content/${siteName}${cleanPath.startsWith("/") ? "" : "/"}${cleanPath}`;
    }

    const lastSegment = cleanPath.split("/").pop() || "";
    if (!lastSegment.includes(".") && !cleanPath.endsWith("/")) {
      cleanPath += ".html";
    }

    const editorPath = `/editor.html${cleanPath.startsWith("/") ? "" : "/"}${cleanPath}`;
    const targetEditorUrl = localhostBase + editorPath + searchAndHash;

    console.info(`[RedirectPro] Opening active tab in AEM Editor: ${currentUrlStr} → ${targetEditorUrl}`);
    chrome.tabs.update(tabs[0].id, { url: targetEditorUrl });
    showToast("Opened in AEM Editor!", "#10b981");
  });
});

// ─── Event Listeners ───────────────────────────────────────

document.getElementById('saveAllBtn').addEventListener('click', saveAllConfig);

// Add Live Domain
document.getElementById('addLiveDomainBtn').addEventListener('click', () => {
  const val = document.getElementById('newLiveDomainInput').value.trim();
  if (val) {
    currentConfig.aemAuthorRewrite = currentConfig.aemAuthorRewrite || { liveDomains: [] };
    currentConfig.aemAuthorRewrite.liveDomains = currentConfig.aemAuthorRewrite.liveDomains || [];
    currentConfig.aemAuthorRewrite.liveDomains.push(val);
    document.getElementById('newLiveDomainInput').value = '';
    renderAemSettings();
  }
});

document.getElementById('newLiveDomainInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('addLiveDomainBtn').click();
  }
});

// Add Path Prefix
document.getElementById('addPrefixBtn').addEventListener('click', () => {
  const val = document.getElementById('newPrefixInput').value.trim();
  if (val) {
    currentConfig.htmlFallback = currentConfig.htmlFallback || { pathPrefixes: [] };
    currentConfig.htmlFallback.pathPrefixes = currentConfig.htmlFallback.pathPrefixes || [];
    currentConfig.htmlFallback.pathPrefixes.push(val);
    document.getElementById('newPrefixInput').value = '';
    renderFallbackSettings();
  }
});

document.getElementById('newPrefixInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('addPrefixBtn').click();
  }
});

// Add or Update Rule Form
document.getElementById('addRuleBtn').addEventListener('click', () => {
  const id = document.getElementById('ruleIdInput').value.trim();
  const from = document.getElementById('ruleFromInput').value.trim();
  const to = document.getElementById('ruleToInput').value.trim();
  const type = document.getElementById('ruleTypeInput').value;
  const desc = document.getElementById('ruleDescInput').value.trim();

  if (!id || !from || !to) {
    showToast("Please fill Rule ID, From, and To!", "#ef4444");
    return;
  }

  currentConfig.rules = currentConfig.rules || [];

  if (editingRuleIndex >= 0 && editingRuleIndex < currentConfig.rules.length) {
    currentConfig.rules[editingRuleIndex] = {
      ...currentConfig.rules[editingRuleIndex],
      id,
      description: desc,
      matchType: type,
      from,
      to
    };
    showToast("Rule updated!", "#10b981");
  } else {
    currentConfig.rules.push({
      id,
      description: desc,
      enabled: true,
      matchType: type,
      from,
      to
    });
    showToast("Rule added!", "#10b981");
  }

  resetRuleForm();
  renderRulesList();
});

// Format JSON
document.getElementById('formatJsonBtn').addEventListener('click', () => {
  try {
    const parsed = JSON.parse(document.getElementById('jsonArea').value);
    document.getElementById('jsonArea').value = JSON.stringify(parsed, null, 2);
    showToast("JSON Formatted!", "#6366f1");
  } catch (err) {
    showToast("JSON Syntax Error!", "#ef4444");
  }
});

// Copy JSON
document.getElementById('copyJsonBtn').addEventListener('click', () => {
  const jsonText = document.getElementById('jsonArea').value;
  if (!jsonText) return;
  navigator.clipboard.writeText(jsonText).then(() => {
    showToast("Copied to clipboard!", "#10b981");
  }).catch(() => {
    showToast("Failed to copy!", "#ef4444");
  });
});

// ─── Init ──────────────────────────────────────────────────
loadData();
