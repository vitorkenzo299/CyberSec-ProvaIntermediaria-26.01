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

  function notifyCanvas(action) {
    window.postMessage({
      source: "privacy-inspector",
      kind: "canvas",
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

  function wrapCanvasMethod(prototype, method) {
    if (!prototype?.[method]) {
      return;
    }

    const original = prototype[method];
    if (original.__privacyInspectorWrapped) {
      return;
    }

    function wrappedCanvasMethod(...args) {
      notifyCanvas(method);
      return original.apply(this, args);
    }

    wrappedCanvasMethod.__privacyInspectorWrapped = true;
    try {
      Object.defineProperty(prototype, method, {
        ...Object.getOwnPropertyDescriptor(prototype, method),
        value: wrappedCanvasMethod
      });
    } catch {
      prototype[method] = wrappedCanvasMethod;
    }
  }

  wrapCanvasMethod(window.HTMLCanvasElement?.prototype, "getContext");
  wrapCanvasMethod(window.HTMLCanvasElement?.prototype, "toDataURL");
  wrapCanvasMethod(window.HTMLCanvasElement?.prototype, "toBlob");
  wrapCanvasMethod(window.CanvasRenderingContext2D?.prototype, "getImageData");
  wrapCanvasMethod(window.OffscreenCanvas?.prototype, "convertToBlob");
})();
