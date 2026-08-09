// ============================================================
//  URL Redirect Pro - background.js (Service Worker)
//
//  Hai cơ chế hoạt động:
//
//  [1] declarativeNetRequest  → redirect https→http (tầng network,
//      trước SSL handshake). Path/query/fragment preserve qua \1.
//
//  [2] webRequest.onHeadersReceived → HTML Fallback:
//      Nếu server trả 404 và URL không có extension, thử thêm
//      ".html" vào cuối. Chỉ redirect nếu phiên bản .html tồn tại
//      (HEAD request trả 2xx). Listener đăng ký ở top-level để
//      service worker luôn bắt được event.
// ============================================================

const CONFIG_URL = chrome.runtime.getURL("config.json");

// ─── Load toàn bộ config.json ────────────────────────────────
async function loadFullConfig() {
  try {
    const res = await fetch(CONFIG_URL);
    return await res.json();
  } catch (err) {
    console.error("[RedirectPro] Không thể load config.json:", err);
    return { rules: [], htmlFallback: { enabled: false } };
  }
}

// ─── Chuyển rule config → declarativeNetRequest rule ────────
//
//  Với prefix match:
//    from: "https://localhost:4502/"
//    to:   "http://localhost:4502/"
//    → regexFilter:       "^https://localhost:4502/(.*)"
//    → regexSubstitution: "http://localhost:4502/\1"
//    ⇒ https://localhost:4502/abc       → http://localhost:4502/abc        ✓
//    ⇒ https://localhost:4502/a/b?q=1  → http://localhost:4502/a/b?q=1   ✓
//
function ruleToDeclarative(rule, numericId) {
  if (!rule.enabled) return null;

  let regexFilter, regexSubstitution;

  try {
    if (rule.matchType === "prefix") {
      const escaped = rule.from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      regexFilter = `^${escaped}(.*)`;
      regexSubstitution = rule.to + "\\1";

    } else if (rule.matchType === "regex") {
      regexFilter = rule.from;
      regexSubstitution = rule.to;

    } else if (rule.matchType === "exact") {
      const escaped = rule.from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      regexFilter = `^${escaped}$`;
      regexSubstitution = rule.to;

    } else {
      console.warn(`[RedirectPro] matchType không hỗ trợ: "${rule.matchType}" (rule: ${rule.id})`);
      return null;
    }
  } catch (e) {
    console.warn(`[RedirectPro] Lỗi xử lý rule "${rule.id}":`, e.message);
    return null;
  }

  return {
    id: numericId,
    priority: 1,
    action: {
      type: "redirect",
      redirect: { regexSubstitution },
    },
    condition: {
      regexFilter,
      resourceTypes: ["main_frame", "sub_frame"],
    },
  };
}

// ─── Đăng ký rules vào declarativeNetRequest ────────────────
async function applyDeclarativeRules(rules) {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existing.map((r) => r.id);

  const addRules = rules
    .map((rule, i) => ruleToDeclarative(rule, i + 1))
    .filter(Boolean);

  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: removeIds, addRules });

  const enabledCount = rules.filter((r) => r.enabled).length;
  console.info(
    `[RedirectPro] declarativeNetRequest: ${addRules.length} rules đăng ký ` +
    `(${enabledCount}/${rules.length} enabled)`
  );
}

// ─── Lưu redirect history (tối đa 100 entries) ──────────────
async function logRedirect(ruleId, from, to) {
  const { redirectHistory = [] } = await chrome.storage.local.get("redirectHistory");
  redirectHistory.unshift({ ruleId, from, to, timestamp: Date.now() });
  if (redirectHistory.length > 100) redirectHistory.length = 100;
  await chrome.storage.local.set({ redirectHistory });
}

// ───────────────────────────────────────────────────────────
//  HTML FALLBACK LOGIC
//  Kiểm tra URL có nên thêm .html không:
//  - URL không được kết thúc bằng / hoặc bất kỳ extension nào
//    trong danh sách skipIfPathEndsWith
//  - Path segment cuối không được đã có dấu chấm (tức có extension)
// ───────────────────────────────────────────────────────────

/**
 * Kiểm tra URL có đủ điều kiện thử .html fallback không
 * @param {string} urlStr   - URL đang xét
 * @param {object} fbCfg    - config.htmlFallback
 * @returns {boolean}
 */
function isEligibleForHtmlFallback(urlStr, fbCfg) {
  if (!fbCfg?.enabled) return false;

  let urlObj;
  try {
    urlObj = new URL(urlStr);
  } catch {
    return false;
  }

  const pathname = urlObj.pathname;

  // Bỏ qua nếu path kết thúc bằng bất kỳ suffix nào trong danh sách
  const skipList = fbCfg.skipIfPathEndsWith || [];
  for (const skip of skipList) {
    if (pathname.endsWith(skip)) return false;
  }

  // Bỏ qua nếu segment cuối đã có dấu chấm (có extension rồi)
  const lastSegment = pathname.split("/").pop() || "";
  if (lastSegment.includes(".")) return false;

  return true;
}

/**
 * Ghép .html vào trước query string và fragment
 * http://localhost:4502/content/page?foo=1#bar
 * → http://localhost:4502/content/page.html?foo=1#bar
 */
function buildHtmlFallbackUrl(urlStr) {
  const urlObj = new URL(urlStr);
  urlObj.pathname = urlObj.pathname + ".html";
  return urlObj.toString();
}

/**
 * Kiểm tra URL có trả về 2xx không bằng HEAD request
 * Trả về true nếu tồn tại, false nếu không
 */
async function urlExists(targetUrl) {
  try {
    const res = await fetch(targetUrl, {
      method: "HEAD",
      credentials: "include",  // Gửi kèm cookie (quan trọng cho AEM auth)
      cache: "no-store",
    });
    return res.ok; // true nếu status 200-299
  } catch {
    return false;
  }
}

// ─── webRequest.onHeadersReceived - HTML Fallback handler ────
//
//  ⚠️  QUAN TRỌNG: Listener phải đăng ký ở top-level (không trong
//  async function) để service worker luôn bắt được event,
//  kể cả khi vừa được wakeup.
//
//  Flow:
//  1. Browser nhận response headers từ server
//  2. Nếu statusCode === 404 → kiểm tra điều kiện htmlFallback
//  3. Nếu đủ điều kiện → HEAD request đến url + ".html"
//  4. Nếu .html tồn tại → redirect tab
//
chrome.webRequest.onHeadersReceived.addListener(
  async (details) => {
    // Chỉ xử lý main frame (điều hướng chính), bỏ qua resource phụ
    if (details.frameId !== 0) return;
    // Chỉ xử lý khi server trả về 404
    if (details.statusCode !== 404) return;

    // Đọc htmlFallback config từ storage (đã được sync lúc init)
    const { htmlFallbackConfig } = await chrome.storage.local.get("htmlFallbackConfig");
    if (!htmlFallbackConfig?.enabled) return;

    const originalUrl = details.url;

    if (!isEligibleForHtmlFallback(originalUrl, htmlFallbackConfig)) return;

    const htmlUrl = buildHtmlFallbackUrl(originalUrl);

    console.info(`[RedirectPro] 404 detected: ${originalUrl} — thử ${htmlUrl}`);

    const exists = await urlExists(htmlUrl);

    if (exists) {
      console.info(`[RedirectPro] ✓ HTML Fallback: ${originalUrl} → ${htmlUrl}`);
      await logRedirect("html-fallback", originalUrl, htmlUrl);
      // Redirect tab sang phiên bản .html
      chrome.tabs.update(details.tabId, { url: htmlUrl });
    } else {
      console.info(`[RedirectPro] ✗ HTML Fallback: ${htmlUrl} cũng không tồn tại — giữ nguyên 404`);
    }
  },
  // Áp dụng cho tất cả URL (lọc theo config bên trong handler)
  // để listener được đăng ký ngay cả trước khi config được load
  { urls: ["<all_urls>"], types: ["main_frame"] }
);

// ─── Khởi động ──────────────────────────────────────────────
async function init() {
  const cfg = await loadFullConfig();

  // Lưu toàn bộ config vào storage để popup và listener đọc được
  await chrome.storage.local.set({
    redirectRules: cfg.rules || [],
    htmlFallbackConfig: cfg.htmlFallback || { enabled: false },
    lastSync: Date.now(),
  });

  await applyDeclarativeRules(cfg.rules || []);

  console.info(
    `[RedirectPro] Init xong. ` +
    `HTML Fallback: ${cfg.htmlFallback?.enabled ? "ON" : "OFF"}`
  );
}

chrome.runtime.onInstalled.addListener(init);
chrome.runtime.onStartup.addListener(init);

// ─── Message handler từ popup ────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "GET_STATUS") {
    loadFullConfig().then((cfg) => {
      sendResponse({ rules: cfg.rules, htmlFallback: cfg.htmlFallback, status: "ok" });
    });
    return true;
  }

  if (msg.type === "RELOAD_CONFIG") {
    loadFullConfig().then(async (cfg) => {
      await chrome.storage.local.set({
        redirectRules: cfg.rules || [],
        htmlFallbackConfig: cfg.htmlFallback || { enabled: false },
        lastSync: Date.now(),
      });
      await applyDeclarativeRules(cfg.rules || []);
      sendResponse({ rules: cfg.rules, htmlFallback: cfg.htmlFallback, status: "reloaded" });
    });
    return true;
  }
});
