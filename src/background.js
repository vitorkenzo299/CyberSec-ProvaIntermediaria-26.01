const reportsByTab = new Map();

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


function createReport(pageUrl = "") {
  return {
    pageUrl,
    pageHost: hostnameFromUrl(pageUrl),
    requestCount: 0,
    thirdPartyRequestCount: 0,
    thirdPartyDomains: {},
    cookies: emptyCookies(),
    storage: emptyStorage(),
    updatedAt: Date.now()
  };
}

function ensureReport(tabId, pageUrl = "") {
  if (!reportsByTab.has(tabId)) {
    reportsByTab.set(tabId, createReport(pageUrl));
  }

  return reportsByTab.get(tabId);
}

function observeRequest(details) {
  if (details.tabId < 0) {
    return;
  }

  if (details.type === "main_frame") {
    reportsByTab.set(details.tabId, createReport(details.url));
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


async function reportForTab(tabId) {
  const report = reportsByTab.get(tabId) || createReport();
  await refreshCookieInventory(report);
  return report;
}

browser.webRequest.onBeforeRequest.addListener(observeRequest, {
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


  return undefined;
});

browser.runtime.onInstalled.addListener(() => {
  console.info("Privacy Inspector instalado");
});

