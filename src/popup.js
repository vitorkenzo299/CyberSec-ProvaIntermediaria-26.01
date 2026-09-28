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
}

function renderThirdPartyDomains(report) {
  document.querySelector("#third-party-count").textContent =
    `${report.thirdPartyRequestCount} requisições`;

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
}

loadCurrentPage().catch(() => {
  document.querySelector("#status").textContent =
    "Não foi possível consultar a página atual.";
});

