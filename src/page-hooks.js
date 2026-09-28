(() => {
  if (window.__privacyInspectorHooksLoaded) {
    return;
  }

  window.__privacyInspectorHooksLoaded = true;

  function notify(storage, action) {
    window.postMessage({
      source: "privacy-inspector",
      storage,
      action
    }, "*");
  }


  function storageName(storage) {
    try {
      return storage === window.sessionStorage ? "sessionStorage" : "localStorage";
    } catch {
      return "localStorage";
    }
  }

  if (window.Storage) {
    for (const method of ["getItem", "setItem", "removeItem", "clear"]) {
      const original = window.Storage.prototype[method];
      if (!original) {
        continue;
      }

      window.Storage.prototype[method] = function (...args) {
        notify(storageName(this), method);
        return original.apply(this, args);
      };
    }
  }

  if (window.IDBFactory?.prototype?.open) {
    const originalOpen = window.IDBFactory.prototype.open;
    window.IDBFactory.prototype.open = function (...args) {
      notify("indexedDB", "open");
      return originalOpen.apply(this, args);
    };
  }

})();
