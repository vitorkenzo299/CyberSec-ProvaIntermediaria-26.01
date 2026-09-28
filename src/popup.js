async function loadCurrentPage() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  document.querySelector("#page-title").textContent =
    tab?.title || "Página não identificada";

  const report = await browser.runtime.sendMessage({
    type: "get-report",
    tabId: tab?.id
  });

  renderThirdPartyDomains(report);
  renderCookies(report);
  renderStorage(report);
  renderSignals(report);
  await loadBlocklist();
}

function renderThirdPartyDomains(report) {
  document.querySelector("#third-party-count").textContent =
    `${report.thirdPartyRequestCount} requisições`;
  document.querySelector("#failed-request-summary").textContent =
    `Falhas de requisição: ${report.failedRequestCount || 0}`;
  document.querySelector("#blocked-request-summary").textContent =
    `Bloqueadas: ${report.blockedRequestCount || 0}`;

  const list = document.querySelector("#domain-list");
  const domains = Object.entries(report.thirdPartyDomains).sort(
    ([, first], [, second]) => second.count - first.count
  );

  list.replaceChildren();
  if (domains.length === 0) {
    const item = document.createElement("li");
    item.textContent = "Nenhum domínio observado.";
    list.append(item);
    return;
  }

  for (const [domain, data] of domains) {
    const item = document.createElement("li");
    item.textContent = `${domain}: ${data.count} requisições`;
    list.append(item);
  }
}

async function loadBlocklist() {
  const domains = await browser.runtime.sendMessage({ type: "get-blocklist" });
  renderBlocklist(domains || []);
}

function renderBlocklist(domains) {
  const list = document.querySelector("#blocked-domain-list");
  list.replaceChildren();

  if (domains.length === 0) {
    const item = document.createElement("li");
    item.textContent = "Nenhum dominio bloqueado.";
    list.append(item);
    return;
  }

  for (const domain of domains) {
    const item = document.createElement("li");
    item.textContent = domain;
    list.append(item);
  }
}

document.querySelector("#add-blocked-domain").addEventListener("click", async () => {
  const input = document.querySelector("#blocked-domain-input");
  const domain = input.value.trim().toLowerCase();
  if (!domain) {
    return;
  }

  const current = await browser.runtime.sendMessage({ type: "get-blocklist" });
  const domains = [...new Set([...(current || []), domain])];
  const saved = await browser.runtime.sendMessage({
    type: "set-blocklist",
    domains
  });
  input.value = "";
  renderBlocklist(saved || domains);
});

function renderCookies(report) {
  const cookies = report.cookies;
  const summary = document.querySelector("#cookie-summary");
  const changes = document.querySelector("#cookie-changes");

  if (!cookies.available) {
    summary.textContent = "A API de cookies não está disponível.";
    changes.textContent = "";
    return;
  }

  summary.textContent = [
    `total: ${cookies.total}`,
    `primeira parte: ${cookies.firstParty}`,
    `terceira parte: ${cookies.thirdParty}`,
    `sessão: ${cookies.session}`,
    `persistentes: ${cookies.persistent}`
  ].join(" | ");
  changes.textContent = `Alterações observadas: ${cookies.changes.length}`;
}

function renderStorage(report) {
  const list = document.querySelector("#storage-list");
  const storage = report.storage;
  const entries = [
    ["localStorage", storage.localStorage],
    ["sessionStorage", storage.sessionStorage],
    ["IndexedDB", storage.indexedDB]
  ];

  list.replaceChildren();
  const used = entries.filter(([, data]) => data.used);
  if (used.length === 0) {
    const item = document.createElement("li");
    item.textContent = "Nenhum acesso observado.";
    list.append(item);
    return;
  }

  for (const [name, data] of used) {
    const details = data.keys?.length || data.databases?.length || 0;
    const item = document.createElement("li");
    item.textContent = `${name}: ${data.accesses} acesso(s), ${details} item(ns)`;
    list.append(item);
  }

  if (report.storageOrigins?.length) {
    const item = document.createElement("li");
    item.textContent = `Origens observadas: ${report.storageOrigins.join(", ")}`;
    list.append(item);
  }
}

function renderSignals(report) {
  const list = document.querySelector("#signals-list");
  const signals = report.signals || {};
  const entries = [];

  if (signals.canvas?.detected) {
    const methods = Object.entries(signals.canvas.methods || {})
      .map(([method, count]) => `${method}: ${count}`)
      .join(", ");
    entries.push(
      `Canvas: ${signals.canvas.accesses} acesso(s) (${methods || "metodo nao identificado"})`
    );
  }

  if (signals.cookieSync?.detected) {
    const parameters = Object.keys(signals.cookieSync.parameters || {}).join(", ");
    const domains = Object.keys(signals.cookieSync.domains || {}).join(", ");
    entries.push(
      `Possivel cookie-sync: ${signals.cookieSync.requests} requisicao(oes)` +
      `${domains ? `; dominios: ${domains}` : ""}` +
      `${parameters ? `; parametros: ${parameters}` : ""}`
    );
  }

  if (signals.bounceTracking?.detected) {
    const parameters = Object.keys(signals.bounceTracking.parameters || {}).join(", ");
    const routes = (signals.bounceTracking.routes || []).join(", ");
    entries.push(
      `Possivel bounce tracking: ${signals.bounceTracking.redirects} redirect(s)` +
      `${routes ? `; rotas: ${routes}` : ""}` +
      `${parameters ? `; parametros: ${parameters}` : ""}`
    );
  }

  list.replaceChildren();
  if (entries.length === 0) {
    const item = document.createElement("li");
    item.textContent = "Nenhum indicador adicional observado.";
    list.append(item);
    return;
  }

  for (const entry of entries) {
    const item = document.createElement("li");
    item.textContent = entry;
    list.append(item);
  }
}

loadCurrentPage().catch(() => {
  document.querySelector("#status").textContent =
    "Não foi possível consultar a página atual.";
});

