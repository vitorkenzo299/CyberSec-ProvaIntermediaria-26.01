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

  function notifyHook(type, url, target = "") {
    window.postMessage({
      source: "privacy-inspector",
      kind: "hook",
      hook: {
        type,
        url: url || location.href,
        target
      }
    }, "*");
  }

  function absoluteUrl(value) {
    try {
      const raw = typeof value === "string" ? value : value?.url;
      return new URL(raw, location.href).href;
    } catch {
      return location.href;
    }
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

  if (window.WebSocket && !window.WebSocket.__privacyInspectorWrapped) {
    const originalWebSocket = window.WebSocket;
    function hookedWebSocket(...args) {
      notifyHook("websocket", absoluteUrl(args[0]));
      return Reflect.construct(originalWebSocket, args, new.target || hookedWebSocket);
    }
    hookedWebSocket.prototype = originalWebSocket.prototype;
    Object.setPrototypeOf(hookedWebSocket, originalWebSocket);
    hookedWebSocket.__privacyInspectorWrapped = true;
    window.WebSocket = hookedWebSocket;
  }

  if (window.EventSource && !window.EventSource.__privacyInspectorWrapped) {
    const originalEventSource = window.EventSource;
    function hookedEventSource(...args) {
      notifyHook("eventsource", absoluteUrl(args[0]));
      return Reflect.construct(originalEventSource, args, new.target || hookedEventSource);
    }
    hookedEventSource.prototype = originalEventSource.prototype;
    Object.setPrototypeOf(hookedEventSource, originalEventSource);
    hookedEventSource.__privacyInspectorWrapped = true;
    window.EventSource = hookedEventSource;
  }

  if (window.fetch && !window.fetch.__privacyInspectorWrapped) {
    const originalFetch = window.fetch;
    function hookedFetch(...args) {
      notifyHook("fetch", absoluteUrl(args[0]));
      return originalFetch.apply(this, args);
    }
    hookedFetch.__privacyInspectorWrapped = true;
    window.fetch = hookedFetch;
  }

  if (window.XMLHttpRequest?.prototype?.open &&
      !window.XMLHttpRequest.prototype.open.__privacyInspectorWrapped) {
    const originalOpen = window.XMLHttpRequest.prototype.open;
    function hookedOpen(method, url, ...args) {
      notifyHook("xmlhttprequest", absoluteUrl(url));
      return originalOpen.call(this, method, url, ...args);
    }
    hookedOpen.__privacyInspectorWrapped = true;
    window.XMLHttpRequest.prototype.open = hookedOpen;
  }

  const watchedGlobals = new Map();
  for (const name of ["fetch", "WebSocket", "EventSource", "XMLHttpRequest"]) {
    watchedGlobals.set(name, window[name]);
  }

  window.setInterval(() => {
    for (const [name, expected] of watchedGlobals) {
      if (window[name] !== expected) {
        notifyHook("global-hook", location.href, name);
        watchedGlobals.set(name, window[name]);
      }
    }
  }, 1000);
})();
