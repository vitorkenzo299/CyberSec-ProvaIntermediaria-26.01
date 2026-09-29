const reportsByTab = new Map();
const pendingNavigationSignals = new Map();
const defaultBlockedDomains = ["bad.third-party.site"];
let blockedDomains = new Set(defaultBlockedDomains);
let blockedDomainsReady = Promise.resolve();

const compoundPublicSuffixes = new Set([
  "com.au",
  "com.br",
  "com.cn",
  "com.jp",
  "com.mx",
  "co.jp",
  "co.nz",
  "co.uk",
  "org.uk"
]);

const cookieSyncParameterNames = new Set([
  "uid",
  "user_id",
  "userid",
  "visitor_id",
  "device_id",
  "match",
  "match_id",
  "sync",
  "sync_id",
  "partner",
  "partner_id",
  "redirect"
]);

const trackingParameterNames = new Set([
  "gclid",
  "dclid",
  "fbclid",
  "msclkid",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fb_source",
  "click_id"
]);

const bounceParameterNames = new Set([
  "bounceuidlocalstorage",
  "bounceuidcookie",
  "isnew"
]);

function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function siteKey(hostname) {
  const labels = hostname.replace(/^\.+/, "").split(".").filter(Boolean);

  if (labels.length <= 2) {
    return labels.join(".");
  }

  const suffix = labels.slice(-2).join(".");
  const labelCount = compoundPublicSuffixes.has(suffix) ? 3 : 2;
  return labels.slice(-labelCount).join(".");
}

function isThirdParty(pageHost, requestHost) {
  return Boolean(pageHost && requestHost && siteKey(pageHost) !== siteKey(requestHost));
}

function emptyCookies() {
  return {
    available: true,
    total: 0,
    firstParty: 0,
    thirdParty: 0,
    session: 0,
    persistent: 0,
    changes: []
  };
}

function emptyStorage() {
  return {
    localStorage: { used: false, accesses: 0, keys: [] },
    sessionStorage: { used: false, accesses: 0, keys: [] },
    indexedDB: { used: false, accesses: 0, databases: [] }
  };
}

function emptySignals() {
  return {
    canvas: {
      detected: false,
      accesses: 0,
      methods: {}
    },
    cookieSync: {
      detected: false,
      requests: 0,
      domains: {},
      parameters: {}
    },
    bounceTracking: {
      detected: false,
      redirects: 0,
      routes: [],
      parameters: {}
    },
    hijacking: emptyHijackingSignals()
  };
}

function emptyHijackingSignals() {
  return {
    detected: false,
    webSockets: 0,
    eventSources: 0,
    polling: {
      detected: false,
      requests: 0,
      domains: {},
      urls: {}
    },
    globalHooks: {},
    events: []
  };
}

function createReport(pageUrl = "") {
  return {
    pageUrl,
    pageHost: hostnameFromUrl(pageUrl),
    requestCount: 0,
    failedRequestCount: 0,
    blockedRequestCount: 0,
    blockedDomains: {},
    failedDomains: {},
    thirdPartyRequestCount: 0,
    thirdPartyDomains: {},
    cookies: emptyCookies(),
    storage: emptyStorage(),
    storageOrigins: [],
    signals: emptySignals(),
    hijackingHistory: {},
    privacyScore: { score: 100, deductions: [] },
    updatedAt: Date.now()
  };
}

function ensureReport(tabId, pageUrl = "") {
  if (!reportsByTab.has(tabId)) {
    reportsByTab.set(tabId, createReport(pageUrl));
  }

  return reportsByTab.get(tabId);
}

function queryParameterNames(url) {
  try {
    return [...new Set([...new URL(url).searchParams.keys()].map((name) =>
      name.toLowerCase()
    ))];
  } catch {
    return [];
  }
}

function isBlockedHost(hostname) {
  return [...blockedDomains].some((domain) =>
    hostname === domain || hostname.endsWith(`.${domain}`)
  );
}

function normalizedDomain(value) {
  const text = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .split(/[/?#]/)[0]
    .split(":")[0];

  return /^[a-z0-9.-]+$/.test(text) ? text : "";
}

function normalizedDomainList(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map(normalizedDomain)
    .filter(Boolean))];
}

async function loadBlockedDomains() {
  try {
    const data = await browser.storage.local.get({
      blockedDomains: defaultBlockedDomains
    });
    const domains = normalizedDomainList(data.blockedDomains);
    blockedDomains = new Set(domains.length ? domains : defaultBlockedDomains);
  } catch {
    blockedDomains = new Set(defaultBlockedDomains);
  }
}

function incrementMapValue(map, key) {
  map[key] = (map[key] || 0) + 1;
}

function recordQuerySignals(report, url, requestHost, isMainFrame = false) {
  const names = queryParameterNames(url);
  if (names.length === 0) {
    return;
  }

  const bounceNames = names.filter((name) =>
    trackingParameterNames.has(name) ||
    cookieSyncParameterNames.has(name) ||
    bounceParameterNames.has(name)
  );
  if (isMainFrame && bounceNames.length > 0) {
    const bounce = report.signals.bounceTracking;
    bounce.detected = true;
    for (const name of bounceNames) {
      incrementMapValue(bounce.parameters, name);
    }
  }

  if (isMainFrame || !isThirdParty(report.pageHost, requestHost)) {
    return;
  }

  const syncNames = names.filter((name) => cookieSyncParameterNames.has(name));
  if (syncNames.length === 0) {
    return;
  }

  const sync = report.signals.cookieSync;
  sync.detected = true;
  sync.requests += 1;
  const domain = sync.domains[requestHost] || { count: 0 };
  domain.count += 1;
  sync.domains[requestHost] = domain;
  for (const name of syncNames) {
    incrementMapValue(sync.parameters, name);
  }
}

function pendingBounceSignals(tabId) {
  if (!pendingNavigationSignals.has(tabId)) {
    pendingNavigationSignals.set(tabId, {
      detected: false,
      redirects: 0,
      routes: [],
      parameters: {}
    });
  }

  return pendingNavigationSignals.get(tabId);
}

function observeRedirect(details) {
  if (details.tabId < 0 || details.type !== "main_frame") {
    return;
  }

  const fromHost = hostnameFromUrl(details.url);
  const toHost = hostnameFromUrl(details.redirectUrl);
  const names = queryParameterNames(details.redirectUrl);
  const crossSite = isThirdParty(fromHost, toHost);
  const trackingQuery = names.some((name) =>
    trackingParameterNames.has(name) || bounceParameterNames.has(name)
  );

  if (!crossSite && !trackingQuery) {
    return;
  }

  const bounce = pendingBounceSignals(details.tabId);
  bounce.detected = true;
  bounce.redirects += 1;
  if (fromHost && toHost && bounce.routes.length < 20) {
    bounce.routes.push(`${fromHost} -> ${toHost}`);
  }
  for (const name of names) {
    if (trackingParameterNames.has(name) ||
        cookieSyncParameterNames.has(name) ||
        bounceParameterNames.has(name)) {
      incrementMapValue(bounce.parameters, name);
    }
  }
}

function observeRequest(details) {
  if (details.tabId < 0) {
    return;
  }

  if (details.type === "main_frame") {
    const previousReport = reportsByTab.get(details.tabId);
    const nextHost = hostnameFromUrl(details.url);
    const nextNames = queryParameterNames(details.url);
    const report = createReport(details.url);
    const pending = pendingNavigationSignals.get(details.tabId);
    if (pending) {
      report.signals.bounceTracking = pending;
      pendingNavigationSignals.delete(details.tabId);
    }
    reportsByTab.set(details.tabId, report);
    recordQuerySignals(report, details.url, report.pageHost, true);

    if (previousReport?.pageHost &&
        isThirdParty(previousReport.pageHost, nextHost) &&
        nextNames.some((name) =>
          trackingParameterNames.has(name) ||
          cookieSyncParameterNames.has(name) ||
          bounceParameterNames.has(name)
        )) {
      const bounce = report.signals.bounceTracking;
      bounce.detected = true;
      bounce.redirects = Math.max(1, bounce.redirects);
      if (bounce.routes.length < 20) {
        bounce.routes.push(`${previousReport.pageHost} -> ${nextHost}`);
      }
      for (const name of nextNames) {
        if (trackingParameterNames.has(name) ||
            cookieSyncParameterNames.has(name) ||
            bounceParameterNames.has(name)) {
          incrementMapValue(bounce.parameters, name);
        }
      }
    }
    return;
  }

  const report = reportsByTab.get(details.tabId);
  if (!report) {
    return;
  }

  const requestHost = hostnameFromUrl(details.url);
  if (!requestHost) {
    return;
  }

  report.requestCount += 1;
  report.updatedAt = Date.now();
  recordQuerySignals(report, details.url, requestHost);

  if (!isThirdParty(report.pageHost, requestHost)) {
    return;
  }

  report.thirdPartyRequestCount += 1;
  const domain = report.thirdPartyDomains[requestHost] || {
    count: 0,
    types: {}
  };
  domain.count += 1;
  domain.types[details.type] = (domain.types[details.type] || 0) + 1;
  report.thirdPartyDomains[requestHost] = domain;

  if (isBlockedHost(requestHost)) {
    report.blockedRequestCount += 1;
    incrementMapValue(report.blockedDomains, requestHost);
    return { cancel: true };
  }
}

function observeRequestError(details) {
  if (details.tabId < 0) {
    return;
  }

  const report = reportsByTab.get(details.tabId);
  if (!report) {
    return;
  }

  const requestHost = hostnameFromUrl(details.url);
  if (!requestHost) {
    return;
  }

  report.failedRequestCount += 1;
  const domain = report.failedDomains[requestHost] || {
    count: 0,
    error: details.error || "unknown"
  };
  domain.count += 1;
  report.failedDomains[requestHost] = domain;
  report.updatedAt = Date.now();
}

function relevantCookie(cookie, report) {
  const cookieHost = (cookie.domain || "").replace(/^\.+/, "").toLowerCase();
  if (!cookieHost || !report.pageHost) {
    return false;
  }

  const observedSites = new Set([
    siteKey(report.pageHost),
    ...Object.keys(report.thirdPartyDomains).map(siteKey)
  ]);
  return observedSites.has(siteKey(cookieHost));
}

async function refreshCookieInventory(report) {
  if (!report.pageHost) {
    return;
  }

  try {
    const cookies = await browser.cookies.getAll({});
    const stats = emptyCookies();
    stats.changes = report.cookies.changes;

    for (const cookie of cookies) {
      if (!relevantCookie(cookie, report)) {
        continue;
      }

      const cookieHost = (cookie.domain || "").replace(/^\.+/, "");
      const thirdParty = isThirdParty(report.pageHost, cookieHost);
      stats.total += 1;
      stats[thirdParty ? "thirdParty" : "firstParty"] += 1;
      stats[cookie.session ? "session" : "persistent"] += 1;
    }

    report.cookies = stats;
  } catch {
    report.cookies.available = false;
  }
}

function registerCookieChange(changeInfo) {
  const cookie = changeInfo.cookie;
  if (!cookie) {
    return;
  }

  for (const report of reportsByTab.values()) {
    if (!relevantCookie(cookie, report)) {
      continue;
    }

    report.cookies.changes.unshift({
      name: cookie.name,
      domain: cookie.domain,
      removed: changeInfo.removed,
      session: cookie.session
    });
    report.cookies.changes = report.cookies.changes.slice(0, 20);
    void refreshCookieInventory(report);
  }
}

function updateStorageSnapshot(report, data, origin) {
  if (origin && !report.storageOrigins.includes(origin)) {
    report.storageOrigins.push(origin);
  }

  for (const name of ["localStorage", "sessionStorage", "indexedDB"]) {
    const snapshot = data?.[name];
    if (!snapshot) {
      continue;
    }

    const target = report.storage[name];
    target.used = true;
    target.accesses += snapshot.accesses || 0;

    if (Array.isArray(snapshot.keys)) {
      target.keys = [...new Set([...target.keys, ...snapshot.keys])];
    }

    if (Array.isArray(snapshot.databases)) {
      target.databases = [
        ...new Set([...target.databases, ...snapshot.databases])
      ];
    }
  }
}

function updateStorageEvent(report, event) {
  const target = report.storage[event?.storage];
  if (!target) {
    return;
  }

  target.used = true;
  target.accesses += 1;
}

function updateCanvasSignal(report, method) {
  const canvas = report.signals.canvas;
  const canvasMethod = method || "unknown";
  canvas.detected = true;
  canvas.accesses += 1;
  incrementMapValue(canvas.methods, canvasMethod);
}

function recordHijackingSignal(report, hook = {}) {
  const url = hook.url || "";
  const requestHost = hostnameFromUrl(url);
  const thirdParty = isThirdParty(report.pageHost, requestHost);
  const hijacking = report.signals.hijacking;
  const event = {
    type: hook.type || "unknown",
    target: hook.target || "",
    host: requestHost,
    url
  };

  if (["global-hook", "global-profile"].includes(event.type)) {
    hijacking.detected = true;
    const target = event.target || "objeto global";
    incrementMapValue(hijacking.globalHooks, target);
  } else if (thirdParty && event.type === "websocket") {
    hijacking.detected = true;
    hijacking.webSockets += 1;
  } else if (thirdParty && event.type === "eventsource") {
    hijacking.detected = true;
    hijacking.eventSources += 1;
  } else if (thirdParty && ["fetch", "xmlhttprequest"].includes(event.type)) {
    const key = `${event.type}:${url}`;
    const now = Date.now();
    const history = report.hijackingHistory[key] || [];
    const recent = history.filter((time) => now - time <= 30000);
    recent.push(now);
    report.hijackingHistory[key] = recent;
    if (recent.length >= 3) {
      hijacking.detected = true;
      hijacking.polling.detected = true;
      hijacking.polling.requests = Math.max(
        hijacking.polling.requests,
        recent.length
      );
      incrementMapValue(hijacking.polling.domains, requestHost);
      incrementMapValue(hijacking.polling.urls, url);
    }
  }

  if (hijacking.detected && hijacking.events.length < 30) {
    hijacking.events.push(event);
  }
}

function calculatePrivacyScore(report) {
  let score = 100;
  const deductions = [];

  function deduct(label, points, reason) {
    if (points <= 0) return;
    score -= points;
    deductions.push({ label, points, reason });
  }

  const domainCount = Object.keys(report.thirdPartyDomains).length;
  deduct(
    "Dominios de terceiros",
    Math.min(15, domainCount * 5),
    "Cada dominio externo observado vale 5 pontos, ate 15."
  );
  deduct(
    "Requisicoes de terceiros",
    Math.min(20, Math.ceil(report.thirdPartyRequestCount / 5) * 5),
    "A cada grupo de 5 requisicoes externas sao descontados 5 pontos, ate 20."
  );
  deduct(
    "Cookies de terceiros",
    Math.min(20, report.cookies.thirdParty * 5),
    "Cada cookie de terceiro vale 5 pontos, ate 20."
  );

  if (report.signals.canvas.detected) {
    deduct("Leitura de canvas", 10, "O canvas pode ajudar a diferenciar o navegador.");
  }
  if (report.signals.cookieSync.detected) {
    deduct("Possivel cookie-sync", 15, "Parametros de identificacao foram enviados a terceiro.");
  }
  if (report.signals.bounceTracking.detected) {
    deduct("Possivel bounce tracking", 15, "Foi observada navegacao com parametros de rastreamento.");
  }
  if (report.signals.hijacking.detected) {
    deduct("Possivel hijacking ou hook", 20, "Foi observado WebSocket, polling repetido ou alteracao de objeto global.");
  }

  report.privacyScore = {
    score: Math.max(0, Math.min(100, score)),
    deductions
  };
}

async function reportForTab(tabId) {
  const report = reportsByTab.get(tabId) || createReport();
  await refreshCookieInventory(report);
  calculatePrivacyScore(report);
  return report;
}

browser.webRequest.onBeforeRequest.addListener(
  observeRequest,
  { urls: ["<all_urls>"] },
  ["blocking"]
);

browser.webRequest.onErrorOccurred.addListener(observeRequestError, {
  urls: ["<all_urls>"]
});

browser.webRequest.onBeforeRedirect.addListener(observeRedirect, {
  urls: ["<all_urls>"]
});

browser.cookies.onChanged.addListener(registerCookieChange);

browser.tabs.onRemoved.addListener((tabId) => {
  reportsByTab.delete(tabId);
});

browser.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === "get-report") {
    return reportForTab(message.tabId);
  }

  if (message?.type === "get-blocklist") {
    return blockedDomainsReady.then(() => [...blockedDomains]);
  }

  if (message?.type === "set-blocklist") {
    const domains = normalizedDomainList(message.domains);
    return blockedDomainsReady.then(() => {
      const savedDomains = domains.length ? domains : defaultBlockedDomains;
      blockedDomains = new Set(savedDomains);
      return browser.storage.local
        .set({ blockedDomains: savedDomains })
        .then(() => savedDomains);
    });
  }

  const tabId = sender.tab?.id;
  if (tabId === undefined) {
    return undefined;
  }

  const report = ensureReport(tabId, sender.tab.url);
  if (message?.type === "storage-snapshot") {
    updateStorageSnapshot(report, message.data, sender.url || sender.tab.url);
  }

  if (message?.type === "storage-event") {
    updateStorageEvent(report, message);
  }

  if (message?.type === "canvas-event") {
    updateCanvasSignal(report, message.method);
  }

  if (message?.type === "hook-event") {
    recordHijackingSignal(report, message.hook);
  }

  return undefined;
});

browser.runtime.onInstalled.addListener(() => {
  console.info("Privacy Inspector instalado");
});

blockedDomainsReady = loadBlockedDomains();

