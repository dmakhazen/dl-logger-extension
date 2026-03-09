// MAIN world — прямой доступ к window страницы.
// Перехватывает: dataLayer.push, console.*, history navigation (SPA).

(function () {
  if (window.__dlMainInjected) return;
  window.__dlMainInjected = true;

  // ─── Перехват dataLayer.push ─────────────────────────────────────────────
  function hookDataLayer() {
    if (!window.dataLayer) {
      let _dl;
      Object.defineProperty(window, 'dataLayer', {
        configurable: true,
        get() { return _dl; },
        set(val) {
          _dl = val;
          if (Array.isArray(_dl)) {
            patchPush(_dl);
            Object.defineProperty(window, 'dataLayer', {
              configurable: true, writable: true, value: _dl,
            });
          }
        },
      });
    } else {
      patchPush(window.dataLayer);
    }
  }

  function patchPush(dl) {
    if (dl.__dlPatched) return;
    dl.__dlPatched = true;
    const original = dl.push.bind(dl);
    dl.push = function (...args) {
      const result = original(...args);
      const payload = args[0];
      if (!payload) return result;
      let safe;
      try { safe = JSON.parse(JSON.stringify(payload)); }
      catch (e) { safe = { _error: 'не удалось сериализовать' }; }
      window.postMessage({ __dlSource: 'page', type: 'DL_PUSH', payload: safe }, '*');
      return result;
    };
  }

  hookDataLayer();

  // ─── Перехват SPA-навигации (history API) ────────────────────────────────
  // SPA меняет URL через pushState/replaceState — перезагрузки нет, content.js не перезапускается.
  // Поэтому ловим здесь и кидаем событие NAVIGATE.
  // Полные перезагрузки обрабатывает content.js сам (он стартует заново на каждой странице).

  function patchHistory() {
    ['pushState', 'replaceState'].forEach((method) => {
      const original = history[method].bind(history);
      history[method] = function (...args) {
        const result = original(...args);
        // args[2] — новый URL
        const newUrl = args[2] ? String(args[2]) : location.href;
        window.postMessage({
          __dlSource: 'page',
          type: 'NAVIGATE',
          navigationType: method === 'pushState' ? 'spa-push' : 'spa-replace',
          url: newUrl,
          title: document.title,
        }, '*');
        return result;
      };
    });

    // popstate — кнопка назад/вперёд в браузере
    window.addEventListener('popstate', () => {
      window.postMessage({
        __dlSource: 'page',
        type: 'NAVIGATE',
        navigationType: 'popstate',
        url: location.href,
        title: document.title,
      }, '*');
    });
  }

  patchHistory();

  // ─── Перехват console.* ───────────────────────────────────────────────────
  const LEVELS = ['log', 'info', 'warn', 'error', 'debug'];

  LEVELS.forEach((level) => {
    const original = console[level];
    const wrapper = function (...args) {
      original.apply(console, args);
      const text = serializeConsoleArgs(args);
      window.postMessage({
        __dlSource: 'page',
        type: 'CONSOLE',
        level,
        text,
        time: new Date().toISOString(),
      }, '*');
    };
    Object.defineProperty(wrapper, 'toString', {
      value: () => `function ${level}() { [native code] }`,
      writable: true, configurable: true,
    });
    Object.defineProperty(wrapper, 'name', {
      value: level, writable: true, configurable: true,
    });
    console[level] = wrapper;
  });

  // ─── Сериализация ─────────────────────────────────────────────────────────
  function serializeConsoleArgs(args) {
    if (args.length === 0) return '';
    const first = args[0];
    if (typeof first === 'string' && /%[csdoO]/.test(first)) {
      let argIndex = 1;
      let result = first.replace(/%([csdoO])/g, (match, directive) => {
        if (argIndex >= args.length) return match;
        const val = args[argIndex++];
        if (directive === 'c') return '';
        if (directive === 's') return String(val);
        if (directive === 'd') return Number(val);
        if (directive === 'o' || directive === 'O') {
          try { return JSON.stringify(val, null, 2); } catch (e) { return String(val); }
        }
        return match;
      });
      const remaining = args.slice(argIndex).map(serializeValue);
      if (remaining.length) result += ' ' + remaining.join(' ');
      return result.trim();
    }
    return args.map(serializeValue).join(' ');
  }

  function serializeValue(a) {
    if (a === null)      return 'null';
    if (a === undefined) return 'undefined';
    if (typeof a === 'string') return a;
    if (typeof a === 'object') {
      try { return JSON.stringify(a, null, 2); } catch (e) { return String(a); }
    }
    return String(a);
  }
})();
