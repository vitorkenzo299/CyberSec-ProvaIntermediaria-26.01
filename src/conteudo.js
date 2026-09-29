function sendMessage(message) {
  browser.runtime.sendMessage(message).catch(() => {});
}

let jsLeaksReported = false;

function inspectJsLeaksResult() {
  if (!location.pathname.endsWith("/security/js-leaks.html") || jsLeaksReported) {
    return;
  }

  const headings = [...document.querySelectorAll("h2, h3")];
  const counts = {};
  for (const title of ["Properties Added", "Properties Removed", "Properties Changed"]) {
    const heading = headings.find((item) => item.textContent.trim() === title);
    const list = heading?.nextElementSibling;
    counts[title] = list?.querySelectorAll("li").length || 0;
  }

  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  if (total === 0) {
    return;
  }

  jsLeaksReported = true;
  sendMessage({
    type: "hook-event",
    hook: {
      type: "global-profile",
      url: location.href,
      target: `js-leaks: ${JSON.stringify(counts)}`
    }
  });
}

const jsLeaksObserver = new MutationObserver(inspectJsLeaksResult);
jsLeaksObserver.observe(document.documentElement, { childList: true, subtree: true });
window.setTimeout(inspectJsLeaksResult, 0);

function collectStorageSnapshot() {
  const data = {};

  try {
    data.localStorage = {
      accesses: 1,
      keys: Object.keys(window.localStorage)
    };
  } catch {
    data.localStorage = { accesses: 0, keys: [] };
  }

  try {
    data.sessionStorage = {
      accesses: 1,
      keys: Object.keys(window.sessionStorage)
    };
  } catch {
    data.sessionStorage = { accesses: 0, keys: [] };
  }

  if (window.indexedDB?.databases) {
    window.indexedDB.databases()
      .then((databases) => {
        data.indexedDB = {
          accesses: 1,
          databases: databases.map((database) => database.name).filter(Boolean)
        };
        sendMessage({ type: "storage-snapshot", data });
      })
      .catch(() => sendMessage({ type: "storage-snapshot", data }));
    return;
  }

  data.indexedDB = { accesses: 0, databases: [] };
  sendMessage({ type: "storage-snapshot", data });
}

window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.source !== "privacy-inspector") {
    return;
  }

  if (event.data.kind === "canvas") {
    sendMessage({
      type: "canvas-event",
      method: event.data.action
    });
    return;
  }

  if (event.data.kind === "hook") {
    sendMessage({
      type: "hook-event",
      hook: event.data.hook
    });
    return;
  }

  sendMessage({
    type: "storage-event",
    storage: event.data.storage
  });
});

function injectPageHooks() {
  const root = document.documentElement;
  if (!root) {
    window.setTimeout(injectPageHooks, 0);
    return;
  }

  const script = document.createElement("script");
  script.src = browser.runtime.getURL("src/page-hooks.js");
  script.onload = () => script.remove();
  root.appendChild(script);
}

collectStorageSnapshot();
injectPageHooks();
