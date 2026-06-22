"use strict";
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };

  // src/beacon.ts
  function setMeta(m, url) {
    meta = m;
    ingestUrl = url;
  }
  function enqueue(event) {
    queue.push(event);
    if (queue.length >= MAX_QUEUE_SIZE) {
      flush();
      return;
    }
    if (!timer) {
      timer = setTimeout(flush, FLUSH_INTERVAL_MS);
    }
  }
  function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!queue.length) return;
    if (!meta.projectId) return;
    const payload = {
      projectId: meta.projectId,
      sessionId: meta.sessionId,
      domain: meta.domain,
      timestamp: meta.timestamp,
      events: queue.splice(0, queue.length)
      // automatically drain the queue
    };
    const blob = new Blob(
      [JSON.stringify(payload)],
      { type: "text/plain" }
    );
    const sent = navigator.sendBeacon(ingestUrl, blob);
    console.log("sendBeacon queued:", sent);
    if (!sent) {
      fetch(ingestUrl, {
        method: "POST",
        body: blob,
        keepalive: true
      }).catch(() => {
      });
    }
  }
  var queue, timer, meta, ingestUrl, FLUSH_INTERVAL_MS, MAX_QUEUE_SIZE;
  var init_beacon = __esm({
    "src/beacon.ts"() {
      "use strict";
      queue = [];
      timer = null;
      meta = { projectId: "", sessionId: "", domain: "", timestamp: 0, url: "" };
      ingestUrl = "http://localhost:3000/ingest";
      FLUSH_INTERVAL_MS = 2e3;
      MAX_QUEUE_SIZE = 200;
    }
  });

  // src/vitals.ts
  function initVitals(enqueue2) {
    enqueueFn = enqueue2;
    observeLcp();
    observeCls();
    observeFid();
    captureTtfb();
    listenForUserInteractions();
  }
  function finalizeLcp() {
    if (lcpFinalized || !lcpValue) return;
    lcpFinalized = true;
    enqueueFn({ type: "lcp", value: lcpValue, projectId: "", sessionId: "", ts: Date.now() });
  }
  function observeLcp() {
    try {
      const po = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          lcpValue = entry.startTime;
        }
      });
      po.observe({ type: "largest-contentful-paint", buffered: true });
    } catch {
    }
  }
  function observeCls() {
    try {
      const po = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry;
          if (!shift.hadRecentInput) {
            clsValue += shift.value;
          }
        }
      });
      po.observe({ type: "layout-shift", buffered: true });
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
          enqueueFn({ type: "cls", value: clsValue, projectId: "", sessionId: "", ts: Date.now() });
        }
      });
    } catch {
    }
  }
  function observeFid() {
    try {
      const po = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const fid = entry;
          enqueueFn({
            type: "fid",
            value: fid.processingStart - fid.startTime,
            projectId: "",
            sessionId: "",
            ts: Date.now()
          });
        }
      });
      po.observe({ type: "first-input", buffered: true });
    } catch {
    }
  }
  function captureTtfb() {
    const capture = () => {
      const [nav] = performance.getEntriesByType("navigation");
      if (!nav) return;
      enqueueFn({
        type: "ttfb",
        value: nav.responseStart,
        projectId: "",
        sessionId: "",
        ts: Date.now()
      });
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", capture, { once: true });
    } else {
      capture();
    }
  }
  function listenForUserInteractions() {
    const stop = () => {
      finalizeLcp();
      ["pointerdown", "keydown", "click", "touchstart"].forEach((evt) => document.removeEventListener(evt, stop, { capture: true }));
    };
    ["pointerdown", "keydown", "click", "touchstart"].forEach((evt) => document.addEventListener(evt, stop, { once: true, capture: true, passive: true }));
  }
  var lcpValue, clsValue, lcpFinalized, enqueueFn;
  var init_vitals = __esm({
    "src/vitals.ts"() {
      "use strict";
      lcpValue = 0;
      clsValue = 0;
      lcpFinalized = false;
    }
  });

  // src/selector.ts
  function getSelector(node) {
    if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
      return getSelector(node.parentElement) + " > #text";
    }
    if (!(node instanceof Element)) return "";
    const parts = [];
    let current = node;
    while (current && current !== document.body && current !== document.documentElement) {
      const tag = current.tagName.toLowerCase();
      if (current.id) {
        const safeId = CSS.escape(current.id);
        parts.unshift(`${tag}#${safeId}`);
        break;
      }
      const siblings = current.parentElement ? [...current.parentElement.children] : [];
      const index = siblings.indexOf(current) + 1;
      parts.unshift(`${tag}:nth-child(${index})`);
      current = current.parentElement;
    }
    return parts.join(" > ") || node.nodeName.toLowerCase();
  }
  var init_selector = __esm({
    "src/selector.ts"() {
      "use strict";
    }
  });

  // src/replay.ts
  function initReplay(enqueue2) {
    stopReplay();
    observer = new MutationObserver((records) => {
      for (const record of records) {
        try {
          const diff = {
            type: "mutation",
            target: getSelector(record.target),
            added: [...record.addedNodes].map(serializeNode),
            removed: [...record.removedNodes].map((n) => getSelector(n)),
            attr: record.attributeName,
            oldValue: record.oldValue,
            newValue: record.attributeName && record.target instanceof Element ? record.target.getAttribute(record.attributeName) : null,
            ts: performance.now()
          };
          enqueue2(diff);
        } catch {
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      // child node additions/removals
      subtree: true,
      // all descendants, not just direct children
      attributes: true,
      //atribute changes
      attributeOldValue: true,
      // capture previous attribute values for replay
      characterData: false
      //skip text node changes - too noisy
    });
  }
  function stopReplay() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }
  function serializeNode(node, depth = 0) {
    if (node.nodeType === Node.TEXT_NODE) {
      return {
        tag: "#text",
        attributes: {},
        text: node.textContent?.slice(0, 500) ?? null,
        // cap long text
        children: []
      };
    }
    if (node.nodeType === Node.ELEMENT_NODE && node instanceof Element) {
      const attributes = {};
      for (const attr of node.attributes) {
        if (!attr.name.startsWith("on")) {
          attributes[attr.name] = attr.value.slice(0, 200);
        }
      }
      const children = depth < 5 ? [...node.childNodes].map((child) => serializeNode(child, depth + 1)) : [];
      return {
        tag: node.tagName.toLowerCase(),
        attributes,
        text: node.childNodes.length === 0 ? node.textContent.slice(0, 200) ?? null : null,
        children
      };
    }
    return {
      tag: "#other",
      attributes: {},
      text: null,
      children: []
    };
  }
  var observer;
  var init_replay = __esm({
    "src/replay.ts"() {
      "use strict";
      init_selector();
      observer = null;
    }
  });

  // src/error.ts
  function initErrors(enqueue2) {
    window.addEventListener("error", (e) => {
      enqueue2({
        type: "error",
        message: e.message,
        stack: e.error instanceof Error ? e.error.stack || null : null,
        ts: Date.now(),
        url: location.href
      });
    });
    window.addEventListener("unhandledrejection", (e) => {
      const message = e.reason instanceof Error ? e.reason.message : typeof e.reason === "string" ? e.reason : "Unhandle promised rejection";
      const stack = e.reason instanceof Error ? e.reason.stack : void 0;
      enqueue2({
        type: "error",
        message,
        stack: stack || null,
        ts: Date.now(),
        url: location.href
      });
    });
  }
  var init_error = __esm({
    "src/error.ts"() {
      "use strict";
    }
  });

  // src/index.ts
  var require_index = __commonJS({
    "src/index.ts"() {
      init_beacon();
      init_vitals();
      init_replay();
      init_error();
      var scriptEl = document.currentScript;
      var config = {
        projectId: scriptEl?.getAttribute("data-project-id") ?? "",
        ingestUrl: scriptEl?.getAttribute("data-ingest-url") ?? "http://localhost:3000/api/ingest",
        debug: scriptEl?.getAttribute("data-debug") === "true"
      };
      if (!config.projectId) {
        console.warn("[perf-sdk] No data-project-id found on the script tag. Events will not be sent.");
      }
      var sessionId = crypto.randomUUID();
      setMeta({
        projectId: config.projectId,
        sessionId,
        domain: location.hostname,
        timestamp: Date.now(),
        url: location.href
      }, config.ingestUrl);
      function init() {
        if (!config.debug) {
          console.log("[perf-sdk] Initialized", config.projectId, sessionId);
        }
        initVitals(enqueue);
        initReplay(enqueue);
        initErrors(enqueue);
      }
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
      } else {
        init();
      }
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
          finalizeLcp();
          stopReplay();
          flush();
        }
      });
    }
  });
  require_index();
})();
