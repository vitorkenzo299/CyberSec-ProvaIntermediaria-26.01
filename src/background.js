const reportsByTab = new Map();
const pendingNavigationSignals = new Map();

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
    }
  };
}

function createReport(pageUrl = "") {
  return {
    pageUrl,
    pageHost: hostnameFromUrl(pageUrl),
    requestCount: 0,
    thirdPartyRequestCount: 0,
    thirdPartyDomains: {},
    cookies: emptyCookies(),
    storage: emptyStorage(),
    signals: emptySignals(),
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

function incrementMapValue(map, key) {
  map[key] = (map[key] || 0) + 1;
}

function recordQuerySignals(report, url, requestHost, isMainFrame = false) {
  const names = queryParameterNames(url);
  if (names.length === 0) {
    return;
  }

  const bounceNames = names.filter((name) =>
    trackingParameterNames.has(name) || cookieSyncParameterNames.has(name)
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
  const trackingQuery = names.some((name) => trackingParameterNames.has(name));

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
    if (trackingParameterNames.has(name) || cookieSyncParameterNames.has(name)) {
      incrementMapValue(bounce.parameters, name);
    }
  }
}

function observeRequest(details) {
  if (details.tabId < 0) {
    return;
  }

  if (details.type === "main_frame") {
    const report = createReport(details.url);
    const pending = pendingNavigationSignals.get(details.tabId);
    if (pending) {
      report.signals.bounceTracking = pending;
      pendingNavigationSignals.delete(details.tabId);
    }
    reportsByTab.set(details.tabId, report);
    recordQuerySignals(report, details.url, report.pageHost, true);
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

function updateStorageSnapshot(report, data) {
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

async function reportForTab(tabId) {
  const report = reportsByTab.get(tabId) || createReport();
  await refreshCookieInventory(report);
  return report;
}

browser.webRequest.onBeforeRequest.addListener(observeRequest, {
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

  const tabId = sender.tab?.id;
  if (tabId === undefined) {
    return undefined;
  }

  const report = ensureReport(tabId, sender.tab.url);
  if (message?.type === "storage-snapshot") {
    updateStorageSnapshot(report, message.data);
  }

  if (message?.type === "storage-event") {
    updateStorageEvent(report, message);
  }

  if (message?.type === "canvas-event") {
    updateCanvasSignal(report, message.method);
  }

  return undefined;
});

browser.runtime.onInstalled.addListener(() => {
  console.info("Privacy Inspector instalado");
});

