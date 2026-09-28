function sendMessage(message) {
  browser.runtime.sendMessage(message).catch(() => {});
}

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
