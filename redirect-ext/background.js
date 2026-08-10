// ============================================================
//  URL Redirect Pro - background.js (Service Worker)
//
//  Strict Scope: ONLY processes http/https URLs on localhost:4502
//  (or custom rules / live domains). Completely ignores all other
//  localhost ports (3000, 8080, 5000...) and external sites.
// ============================================================

const CONFIG_URL = chrome.runtime.getURL("config.json");
const activeResolutions = new Map();

// ─── Config Loader ──────────────────────────────────────────
async function loadFullConfig() {
  try {
    const { userConfig } = await chrome.storage.local.get("userConfig");
    if (userConfig) return userConfig;

    const res = await fetch(CONFIG_URL);
    const cfg = await res.json();
    await chrome.storage.local.set({ userConfig: cfg });
    return cfg;
  } catch (err) {
    console.error("[RedirectPro] Config load error:", err);
    return { rules: [], htmlFallback: { enabled: false }, aemAuthorRewrite: { enabled: false } };
  }
}

// ─── Strict Target URL Guard (Port 4502 Only) ────────────────
function isTargetUrl(urlStr, cfg) {
  if (!urlStr || typeof urlStr !== "string") return false;

  // 1. Must strictly start with http:// or https://
  if (!urlStr.startsWith("http://") && !urlStr.startsWith("https://")) {
    return false;
  }

  let urlObj;
  try {
    urlObj = new URL(urlStr);
  } catch {
    return false;
  }

  // 2. Scheme check: only http: or https: allowed
  if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
    return false;
  }

  const hostname = urlObj.hostname.toLowerCase();
  const port = urlObj.port || (urlObj.protocol === "https:" ? "443" : "80");

  // 3. MUST be port 4502 on localhost / 127.0.0.1
  if ((hostname === "localhost" || hostname === "127.0.0.1") && port === "4502") {
    return true;
  }

  // 4. Match explicitly configured dynamic rules in config.json
  const rules = cfg?.rules || [];
  for (const rule of rules) {
    if (rule?.enabled && rule?.from && urlStr.startsWith(rule.from)) {
      return true;
    }
  }

  // 5. Match configured liveDomains
  const liveDomains = cfg?.aemAuthorRewrite?.liveDomains || [];
  for (const domain of liveDomains) {
    if (domain && urlStr.toLowerCase().startsWith(domain.toLowerCase())) {
      return true;
    }
  }

  return false;
}

// ─── DeclarativeNetRequest Rules ────────────────────────────
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
      return null;
    }
  } catch {
    return null;
  }

  return {
    id: numericId,
    priority: 1,
    action: { type: "redirect", redirect: { regexSubstitution } },
    condition: { regexFilter, resourceTypes: ["main_frame", "sub_frame"] }
  };
}

async function applyDeclarativeRules(rules) {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existing.map((r) => r.id);
  const addRules = rules.map((rule, i) => ruleToDeclarative(rule, i + 1)).filter(Boolean);

  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: removeIds, addRules });
}

// ─── URL Existence Check ────────────────────────────────────
async function urlExists(targetUrl) {
  if (!targetUrl || (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://"))) {
    return false;
  }

  // Double check target host before fetch
  if (!isTargetUrl(targetUrl)) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    let res = await fetch(targetUrl, {
      method: "HEAD",
      credentials: "include",
      cache: "no-store",
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) return true;

    if (res.status === 405) {
      const getController = new AbortController();
      const getTimeoutId = setTimeout(() => getController.abort(), 2000);
      res = await fetch(targetUrl, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        signal: getController.signal
      });
      clearTimeout(getTimeoutId);
      return res.ok;
    }

    return false;
  } catch {
    return false;
  }
}

// ─── AEM Author Rewriter ────────────────────────────────────
function getRawAemTargetUrl(urlStr, aemCfg) {
  if (!aemCfg || !aemCfg.enabled) return null;

  const localhostBase = "http://localhost:4502";
  const siteName = (aemCfg.defaultSiteName || "mysite").replace(/^\/+|\/+$/g, "");
  const contentPrefix = `/content/${siteName}`;

  // 1. Nested Live URL in Localhost:4502 (e.g. http://localhost:4502/.../https://live-site.com/abc)
  const nestedMatch = urlStr.match(/^https?:\/\/(?:localhost|127\.0\.0\.1):4502.*?(https?:\/\/[^\/]+)(\/.*)?$/i);
  if (nestedMatch) {
    let rawPath = nestedMatch[2] || "/";
    let cleanPath = rawPath.replace(/\/{2,}/g, "/");

    if (!cleanPath.startsWith("/content/")) {
      cleanPath = `${contentPrefix}${cleanPath.startsWith("/") ? "" : "/"}${cleanPath}`;
    }

    const targetUrl = `${localhostBase}${cleanPath}`;
    if (targetUrl !== urlStr) return targetUrl;
  }

  // 2. Direct Live Domain paste
  const liveDomains = aemCfg.liveDomains || [];
  for (const domain of liveDomains) {
    if (!domain) continue;
    const cleanDomain = domain.replace(/\/+$/, "").toLowerCase();
    if (urlStr.toLowerCase().startsWith(cleanDomain)) {
      let rawPath = urlStr.slice(cleanDomain.length) || "/";
      let cleanPath = rawPath.replace(/\/{2,}/g, "/");

      if (!cleanPath.startsWith("/content/")) {
        cleanPath = `${contentPrefix}${cleanPath.startsWith("/") ? "" : "/"}${cleanPath}`;
      }

      const targetUrl = `${localhostBase}${cleanPath}`;
      if (targetUrl !== urlStr) return targetUrl;
    }
  }

  return null;
}

async function processAemRewrite(tabId, originalUrl, aemCfg) {
  const rawTarget = getRawAemTargetUrl(originalUrl, aemCfg);
  if (!rawTarget) return false;

  // Step 1: Raw Target URL
  if (await urlExists(rawTarget)) {
    chrome.tabs.update(tabId, { url: rawTarget });
    return true;
  }

  // Step 2: Append .html fallback
  const lastSegment = rawTarget.split("/").pop() || "";
  if (!lastSegment.includes(".")) {
    const htmlTarget = rawTarget + ".html";
    if (await urlExists(htmlTarget)) {
      chrome.tabs.update(tabId, { url: htmlTarget });
      return true;
    }
  }

  return false;
}

// ─── Proactive Auto-Resolver ────────────────────────────────
function generateCandidateUrls(urlStr, fbCfg) {
  if (!urlStr || (!urlStr.startsWith("http://") && !urlStr.startsWith("https://"))) {
    return [];
  }

  let urlObj;
  try {
    urlObj = new URL(urlStr);
  } catch {
    return [];
  }

  const origin = urlObj.origin;
  const originalPath = urlObj.pathname;
  const searchAndHash = urlObj.search + urlObj.hash;

  const skipList = fbCfg.skipIfPathEndsWith || [];
  for (const skip of skipList) {
    if (originalPath.toLowerCase().endsWith(skip)) return [];
  }

  const candidates = [];
  const addCandidate = (path) => {
    if (!path) return;
    const cleanP = path.replace(/\/{2,}/g, "/");
    const fullUrl = origin + cleanP + searchAndHash;
    if (fullUrl !== urlStr && !candidates.includes(fullUrl)) {
      candidates.push(fullUrl);
    }
  };

  const pathNoTrailingSlash = originalPath.length > 1 ? originalPath.replace(/\/+$/, "") : originalPath;
  const hasTrailingSlash = originalPath.endsWith("/") && originalPath.length > 1;
  const lastSegment = pathNoTrailingSlash.split("/").pop() || "";
  const hasDotExtension = lastSegment.includes(".");

  const prefixes = fbCfg.pathPrefixes || [];

  if (!hasDotExtension) {
    addCandidate(pathNoTrailingSlash + ".html");
  } else if (hasTrailingSlash) {
    addCandidate(pathNoTrailingSlash);
  }

  prefixes.forEach((prefix) => {
    if (!prefix) return;
    const cleanPrefix = prefix.replace(/\/+$/, "");

    if (!originalPath.startsWith(cleanPrefix + "/") && originalPath !== cleanPrefix) {
      addCandidate(cleanPrefix + originalPath);
      if (hasTrailingSlash) addCandidate(cleanPrefix + pathNoTrailingSlash);
      if (!hasDotExtension) addCandidate(cleanPrefix + pathNoTrailingSlash + ".html");
    }
  });

  if (hasTrailingSlash && !hasDotExtension) {
    addCandidate(pathNoTrailingSlash);
  }

  return candidates;
}

async function findValidCandidateFast(candidates) {
  if (!candidates || !candidates.length) return null;
  const promises = candidates.map(async (url) => {
    if (await urlExists(url)) return url;
    throw new Error();
  });
  try {
    return await Promise.any(promises);
  } catch {
    return null;
  }
}

async function resolveAndRedirect(tabId, originalUrl) {
  if (!originalUrl || activeResolutions.get(tabId) === originalUrl) return;

  const cfg = await loadFullConfig();

  // STRICT FILTER: Only allow localhost:4502, explicit rules, or liveDomains
  if (!isTargetUrl(originalUrl, cfg)) return;

  // 1. Process AEM Author Rewrite
  if (await processAemRewrite(tabId, originalUrl, cfg.aemAuthorRewrite)) return;

  // 2. Process Proactive Path & HTML Fallback
  const fbCfg = cfg.htmlFallback;
  if (!fbCfg?.enabled) return;

  const candidates = generateCandidateUrls(originalUrl, fbCfg);
  if (!candidates.length) return;

  activeResolutions.set(tabId, originalUrl);

  try {
    const validUrl = await findValidCandidateFast(candidates);
    if (validUrl) {
      chrome.tabs.update(tabId, { url: validUrl });
    }
  } catch (err) {
    console.error("[RedirectPro] Resolve error:", err);
  } finally {
    setTimeout(() => {
      if (activeResolutions.get(tabId) === originalUrl) {
        activeResolutions.delete(tabId);
      }
    }, 1500);
  }
}

// ─── Listeners ──────────────────────────────────────────────
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId === 0 && details.url && (details.url.startsWith("http://") || details.url.startsWith("https://"))) {
    resolveAndRedirect(details.tabId, details.url);
  }
});

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.frameId === 0 && details.statusCode >= 400 && details.url && (details.url.startsWith("http://") || details.url.startsWith("https://"))) {
      resolveAndRedirect(details.tabId, details.url);
    }
  },
  { urls: ["http://*/*", "https://*/*"], types: ["main_frame"] }
);

chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    if (details.frameId === 0 && details.url && (details.url.startsWith("http://") || details.url.startsWith("https://"))) {
      resolveAndRedirect(details.tabId, details.url);
    }
  },
  { urls: ["http://*/*", "https://*/*"], types: ["main_frame"] }
);

// ─── Init & Messages ────────────────────────────────────────
async function init() {
  const cfg = await loadFullConfig();
  await applyDeclarativeRules(cfg.rules || []);
}

chrome.runtime.onInstalled.addListener(init);
chrome.runtime.onStartup.addListener(init);

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "GET_STATUS") {
    loadFullConfig().then((cfg) => sendResponse({ config: cfg, status: "ok" }));
    return true;
  }

  if (msg.type === "SAVE_CONFIG") {
    const updatedConfig = msg.config;
    chrome.storage.local.set({ userConfig: updatedConfig }, async () => {
      await applyDeclarativeRules(updatedConfig.rules || []);
      sendResponse({ status: "saved", config: updatedConfig });
    });
    return true;
  }
});
