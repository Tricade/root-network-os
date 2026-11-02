(function (root, factory) {
  const createEnglish =
    typeof module === 'object' && module.exports
      ? require('./locales/en.js')
      : root.RootEnglishCatalog;
  const api = factory(root, createEnglish);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ROOTI18N = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root, createEnglish) {
  'use strict';

  // Source strings are German because the local app is authored in German.
  // Keep values as plain text: callers can translate text nodes, attributes,
  // and canvas labels without changing markup or interpolated user data.
  const localizers = new Set();
  // Nested substitutions belong to this English catalog even when callers
  // explicitly request English while the persisted interface language is German.
  const { en, patterns } = createEnglish((text) => translate(text, 'en'));

  // Saved automatic names remain canonical German data. Display them in the
  // selected language without rewriting saves or interpreting arbitrary names.
  function isGeneratedServerName(server) {
    const prefixes = {
      edge: ['Edge-Knoten', 'Randknoten'],
      compute: ['Rechenknoten'],
      storage: ['Speicherknoten'],
      ai: ['KI-Beschleuniger'],
    };
    const match = String(server?.name || '').match(/^(.+?) (\d{2,})$/);
    return Boolean(match && prefixes[server?.type]?.includes(match[1]));
  }
  function serverName(server, locale) {
    if (!isGeneratedServerName(server)) return server?.name || '';
    const split = server.name.lastIndexOf(' ');
    return translate(server.name.slice(0, split), locale) + server.name.slice(split);
  }

  function translate(text, locale) {
    if (typeof text !== 'string') return text;
    const lang = locale || getLanguage();
    if (lang !== 'en') return text;
    const whitespace = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
    if (whitespace && (whitespace[1] || whitespace[3])) {
      const core = whitespace[2];
      if (!core) return text;
      const translatedCore = translate(core, lang);
      return whitespace[1] + translatedCore + whitespace[3];
    }
    if (Object.prototype.hasOwnProperty.call(en, text)) return en[text];
    for (const [pattern, replacement] of patterns) {
      const match = text.match(pattern);
      if (match) return text.replace(pattern, replacement);
    }
    return text;
  }
  function getLanguage() {
    try {
      return root && root.localStorage && root.localStorage.getItem('root.language') === 'en'
        ? 'en'
        : 'de';
    } catch (_) {
      return 'de';
    }
  }
  function setLanguage(locale) {
    const lang = locale === 'en' ? 'en' : 'de';
    try {
      if (root && root.localStorage) root.localStorage.setItem('root.language', lang);
    } catch (_) {}
    if (root && root.document && root.document.documentElement)
      root.document.documentElement.lang = lang;
    for (const instance of localizers) instance.refresh();
    return lang;
  }
  function installLocalization(options = {}) {
    const doc = root && root.document;
    const Observer = root && root.MutationObserver;
    if (!doc || !doc.documentElement || !Observer)
      return Object.freeze({ refresh() {}, localize() {}, dispose() {} });
    const getProtectedText =
      typeof options.getProtectedText === 'function' ? options.getProtectedText : () => [];
    const textSources = new WeakMap();
    const attrSources = new WeakMap();
    const internalTextWrites = new WeakMap();
    const internalAttributeWrites = new WeakMap();
    const pendingRoots = new Set();
    let pendingFullRefresh = false;
    let scheduled = 0;
    let disposed = false;

    function protectedValues() {
      try {
        const value = getProtectedText();
        if (value instanceof Set) return value;
        if (Array.isArray(value)) return new Set(value);
        if (value && typeof value[Symbol.iterator] === 'function') return new Set(value);
      } catch (_) {}
      return new Set();
    }
    function excluded(element) {
      const tag = element && element.tagName;
      return tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEXTAREA';
    }
    function parentExcluded(node) {
      let element = node && (node.nodeType === 1 ? node : node.parentElement);
      while (element) {
        if (excluded(element)) return true;
        element = element.parentElement;
      }
      return false;
    }
    function applyText(node, protectedSet) {
      if (!node || node.nodeType !== 3 || parentExcluded(node)) return;
      const current = node.data;
      const expected = internalTextWrites.get(node);
      if (expected !== undefined && current === expected) {
        internalTextWrites.delete(node);
      }
      if (!textSources.has(node)) textSources.set(node, current);
      let source = textSources.get(node);
      if (protectedSet.has(source)) {
        if (current !== source) {
          internalTextWrites.set(node, source);
          node.data = source;
        }
        return;
      }
      const next = translate(source);
      if (current !== next) {
        internalTextWrites.set(node, next);
        node.data = next;
      }
    }
    function applyAttribute(element, name, protectedSet) {
      if (!element || element.nodeType !== 1 || excluded(element) || !element.hasAttribute(name))
        return;
      let sources = attrSources.get(element);
      if (!sources) {
        sources = new Map();
        attrSources.set(element, sources);
      }
      const current = element.getAttribute(name);
      let writes = internalAttributeWrites.get(element);
      const expected = writes && writes.get(name);
      if (expected !== undefined && current === expected) {
        writes.delete(name);
      }
      if (!sources.has(name)) sources.set(name, current);
      const source = sources.get(name);
      if (protectedSet.has(source)) {
        if (current !== source) {
          if (!writes) {
            writes = new Map();
            internalAttributeWrites.set(element, writes);
          }
          writes.set(name, source);
          element.setAttribute(name, source);
        }
        return;
      }
      const next = translate(source);
      if (current !== next) {
        if (!writes) {
          writes = new Map();
          internalAttributeWrites.set(element, writes);
        }
        writes.set(name, next);
        element.setAttribute(name, next);
      }
    }
    function visit(node, protectedSet) {
      if (!node) return;
      if (node.nodeType === 3) {
        applyText(node, protectedSet);
        return;
      }
      if (node.nodeType !== 1 && node.nodeType !== 9 && node.nodeType !== 11) return;
      if (node.nodeType === 1 && excluded(node)) return;
      if (node.nodeType === 1)
        for (const name of ['title', 'aria-label', 'placeholder'])
          applyAttribute(node, name, protectedSet);
      const walker = doc.createTreeWalker(
        node,
        (root.NodeFilter ? root.NodeFilter.SHOW_ELEMENT : 1) |
          (root.NodeFilter ? root.NodeFilter.SHOW_TEXT : 4),
      );
      let current;
      while ((current = walker.nextNode())) {
        if (current.nodeType === 3) applyText(current, protectedSet);
        else if (!excluded(current))
          for (const name of ['title', 'aria-label', 'placeholder'])
            applyAttribute(current, name, protectedSet);
      }
    }
    function runPending() {
      scheduled = 0;
      if (disposed) return;
      const protectedSet = protectedValues();
      if (pendingFullRefresh) {
        pendingFullRefresh = false;
        pendingRoots.clear();
        visit(doc.documentElement, protectedSet);
      } else {
        const roots = Array.from(pendingRoots);
        pendingRoots.clear();
        for (const node of roots) visit(node, protectedSet);
      }
    }
    function schedule() {
      if (scheduled || disposed) return;
      const raf = root.requestAnimationFrame || ((callback) => root.setTimeout(callback, 0));
      scheduled = raf(runPending) || -1;
    }
    function refresh() {
      pendingFullRefresh = true;
      schedule();
    }
    const observer = new Observer((records) => {
      if (disposed) return;
      for (const record of records) {
        if (record.type === 'characterData') {
          const node = record.target;
          const current = node.data;
          const expected = internalTextWrites.get(node);
          if (expected !== undefined && current === expected) {
            internalTextWrites.delete(node);
            continue;
          }
          textSources.set(node, current);
          pendingRoots.add(node);
        } else if (record.type === 'attributes') {
          const element = record.target,
            name = record.attributeName;
          const current = element.getAttribute(name);
          const writes = internalAttributeWrites.get(element);
          const expected = writes && writes.get(name);
          if (expected !== undefined && current === expected) {
            writes.delete(name);
            continue;
          }
          if (current === null) {
            const sources = attrSources.get(element);
            if (sources) sources.delete(name);
          } else {
            let sources = attrSources.get(element);
            if (!sources) {
              sources = new Map();
              attrSources.set(element, sources);
            }
            sources.set(name, current);
          }
          pendingRoots.add(element);
        } else if (record.type === 'childList') {
          for (const node of record.addedNodes) pendingRoots.add(node);
        }
      }
      schedule();
    });
    observer.observe(doc.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['title', 'aria-label', 'placeholder'],
    });
    const instance = {
      refresh,
      localize(node) {
        if (!disposed) visit(node || doc.documentElement, protectedValues());
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        observer.disconnect();
        if (scheduled && root.cancelAnimationFrame) root.cancelAnimationFrame(scheduled);
        localizers.delete(instance);
      },
    };
    localizers.add(instance);
    if (doc.documentElement) doc.documentElement.lang = getLanguage();
    refresh();
    return Object.freeze(instance);
  }
  function localize(node) {
    for (const instance of localizers) instance.localize(node);
  }
  return Object.freeze({
    translate,
    isGeneratedServerName,
    serverName,
    getLanguage,
    setLanguage,
    installLocalization,
    localize,
    supportedLanguages: Object.freeze(['de', 'en']),
  });
});
