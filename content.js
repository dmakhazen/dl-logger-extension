// ISOLATED world — доступ к chrome.runtime.
// Обрабатывает: клики, навигацию (SPA + полная загрузка страницы), postMessage от content-main.js.

(function () {
  if (window.__dlIsolatedInjected) return;
  window.__dlIsolatedInjected = true;

  let currentEntryId      = null;
  let sessionActive       = false;
  let logPushes           = true;
  let logConsole          = false;
  let clickListenerActive = false;

  // ─── Загружаем настройки при старте страницы ─────────────────────────────
  chrome.storage.local.get(['dl_session_active', 'dl_log_pushes', 'dl_log_console'], (r) => {
    sessionActive = r.dl_session_active === true;
    logPushes     = r.dl_log_pushes     !== false;
    logConsole    = r.dl_log_console    === true;

    if (sessionActive) {
      startClickListener();
      // Ждём полной загрузки страницы, чтоб скриншот был с контентом, а не пустой
      function onReady() {
        // Доп. задержка — дать странице дорендерить lazy-элементы
        setTimeout(() => sendNavigationEvent('page-load'), 1500);
      }
      if (document.readyState === 'complete') {
        onReady();
      } else {
        window.addEventListener('load', onReady, { once: true });
      }
    }
  });

  // ─── Фиксируем навигацию со скриншотом ───────────────────────────────────
  function sendNavigationEvent(navigationType, url, title) {
    const entryId = Date.now();
    currentEntryId = entryId;

    chrome.runtime.sendMessage({
      type: 'NAVIGATE',
      entryId,
      navigationType,          // 'page-load' | 'spa-push' | 'spa-replace' | 'popstate'
      url:   url   || location.href,
      title: title || document.title,
      time:  new Date().toISOString(),
    });
  }

  // ─── Реагируем на изменения настроек из popup ────────────────────────────
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.dl_session_active) {
      sessionActive = changes.dl_session_active.newValue === true;
      if (sessionActive) {
        startClickListener();
      } else {
        stopClickListener();
      }
    }
    if (changes.dl_log_pushes)  logPushes  = changes.dl_log_pushes.newValue  === true;
    if (changes.dl_log_console) {
      logConsole = changes.dl_log_console.newValue === true;
    }
  });

  // ─── Получаем события от content-main.js ─────────────────────────────────
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.__dlSource !== 'page') return;

    const msg = event.data;

    if (msg.type === 'DL_PUSH' && sessionActive && logPushes) {
      chrome.runtime.sendMessage({
        type: 'DL_PUSH',
        entryId: currentEntryId,
        payload: msg.payload,
        time: new Date().toISOString(),
      });
    }

    if (msg.type === 'CONSOLE' && sessionActive && logConsole) {
      chrome.runtime.sendMessage({
        type: 'CONSOLE',
        entryId: currentEntryId,
        level: msg.level,
        text: msg.text,
        time: new Date().toISOString(),
      });
    }

    // SPA-переход пойман в content-main.js — создаём запись с навигацией
    if (msg.type === 'NAVIGATE' && sessionActive) {
      sendNavigationEvent(msg.navigationType, msg.url, msg.title);
    }
  });

  // ─── Обработчик кликов ────────────────────────────────────────────────────
  // Поднимаемся от target к ближайшему значимому элементу (a, button и т.д.)
  function findMeaningfulTarget(el) {
    const clickable = 'a, button, [role="button"], [role="link"], input, select, textarea, summary';
    if (el.matches && el.matches(clickable)) return el;
    const ancestor = el.closest && el.closest(clickable);
    return ancestor || el;
  }

  function clickHandler(e) {
    const raw = e.target;
    const el = findMeaningfulTarget(raw);
    const entryId = Date.now();
    currentEntryId = entryId;

    const rect = el.getBoundingClientRect();

    chrome.runtime.sendMessage({
      type: 'NEW_CLICK',
      entryId,
      elementInfo: getElementInfo(el),
      elementRect: {
        top:    Math.round(rect.top),
        left:   Math.round(rect.left),
        width:  Math.round(rect.width),
        height: Math.round(rect.height),
      },
      viewportWidth:  window.innerWidth,
      viewportHeight: window.innerHeight,
      time: new Date().toISOString(),
      url: location.href,
      pageTitle: document.title,
    });
  }

  function startClickListener() {
    if (clickListenerActive) return;
    clickListenerActive = true;
    document.addEventListener('click', clickHandler, true);
  }

  function stopClickListener() {
    if (!clickListenerActive) return;
    clickListenerActive = false;
    document.removeEventListener('click', clickHandler, true);
  }

  function getElementInfo(el) {
    if (!el || el === document.body) return '(body)';
    const tag  = el.tagName.toLowerCase();
    const id   = el.id ? `#${el.id}` : '';
    const cls  = el.classList.length ? '.' + [...el.classList].slice(0, 3).join('.') : '';
    const ownText = [...el.childNodes]
      .filter(n => n.nodeType === Node.TEXT_NODE)
      .map(n => n.textContent.trim()).join(' ').trim().slice(0, 60);
    const text  = ownText || el.innerText?.trim().slice(0, 60) || '';
    const label = el.getAttribute('aria-label') || el.getAttribute('title') || '';
    return [`${tag}${id}${cls}`, text ? `"${text}"` : '', label ? `[${label}]` : '']
      .filter(Boolean).join(' ');
  }
})();
