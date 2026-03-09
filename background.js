const LOG_KEY = 'dl_log';

// ─── In-memory лог с батчевой записью в storage ─────────────────────────────
// Решает race condition: при десятках rapid-fire console.log из YM debug
// параллельные get→set теряли данные. Теперь всё модифицируется in-memory,
// а в storage пишется батчем.
let memLog = null;
let saveTimer = null;

function withLog(callback) {
  if (memLog !== null) {
    callback(memLog);
    return;
  }
  chrome.storage.local.get([LOG_KEY], (result) => {
    memLog = result[LOG_KEY] || [];
    callback(memLog);
  });
}

function scheduleSave() {
  if (saveTimer !== null) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (memLog !== null) {
      chrome.storage.local.set({ [LOG_KEY]: memLog });
    }
  }, 150);
}

function saveNow() {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (memLog !== null) {
    chrome.storage.local.set({ [LOG_KEY]: memLog });
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // ─── Новый клик ───────────────────────────────────────────────────────────
  if (msg.type === 'NEW_CLICK') {
    withLog((log) => {
      log.push({
        id:          msg.entryId,
        kind:        'click',
        time:        msg.time,
        elementInfo: msg.elementInfo,
        elementRect: msg.elementRect,
        viewportWidth:  msg.viewportWidth,
        viewportHeight: msg.viewportHeight,
        url:         msg.url,
        pageTitle:   msg.pageTitle,
        screenshot:  null,
        pushes:      [],
        consoleLogs: [],
      });
      scheduleSave();

      // Скриншот без задержки — overlay уже в DOM до отправки сообщения,
      // а SPA-роутер ещё не успел перерисовать страницу
      chrome.tabs.captureVisibleTab(
        sender.tab.windowId,
        { format: 'jpeg', quality: 70 },
        (dataUrl) => {
          if (chrome.runtime.lastError || !dataUrl) return;
          withLog((log2) => {
            const entry = log2.find(e => e.id === msg.entryId);
            if (entry) {
              entry.screenshot = dataUrl;
              saveNow();
            }
          });
        }
      );
    });
    return true;
  }

  // ─── Навигация ────────────────────────────────────────────────────────────
  if (msg.type === 'NAVIGATE') {
    withLog((log) => {
      log.push({
        id:             msg.entryId,
        kind:           'navigate',
        navigationType: msg.navigationType,
        time:           msg.time,
        url:            msg.url,
        pageTitle:      msg.pageTitle,
        screenshot:     null,
        pushes:         [],
        consoleLogs:    [],
      });
      scheduleSave();

      const delay = msg.navigationType === 'page-load' ? 500 : 350;
      setTimeout(() => {
        chrome.tabs.captureVisibleTab(
          sender.tab.windowId,
          { format: 'jpeg', quality: 70 },
          (dataUrl) => {
            if (chrome.runtime.lastError || !dataUrl) return;
            withLog((log2) => {
              const entry = log2.find(e => e.id === msg.entryId);
              if (entry) {
                entry.screenshot = dataUrl;
                saveNow();
              }
            });
          }
        );
      }, delay);
    });
    return true;
  }

  // ─── dataLayer пуш ────────────────────────────────────────────────────────
  if (msg.type === 'DL_PUSH') {
    withLog((log) => {
      const entry = findEntry(log, msg.entryId);
      if (!entry) return;
      entry.pushes.push({ payload: msg.payload, time: msg.time });
      scheduleSave();
    });
  }

  // ─── Консоль ──────────────────────────────────────────────────────────────
  if (msg.type === 'CONSOLE') {
    withLog((log) => {
      const entry = findEntry(log, msg.entryId);
      if (!entry) return;
      if (!entry.consoleLogs) entry.consoleLogs = [];
      entry.consoleLogs.push({ level: msg.level, text: msg.text, time: msg.time });
      scheduleSave();
    });
  }

  // ─── Служебные ────────────────────────────────────────────────────────────
  if (msg.type === 'CLEAR_LOG') {
    memLog = [];
    if (saveTimer !== null) { clearTimeout(saveTimer); saveTimer = null; }
    chrome.storage.local.set({ [LOG_KEY]: [] }, () => {
      if (sendResponse) sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.type === 'GET_LOG') {
    withLog((log) => {
      sendResponse({ log });
    });
    return true;
  }
});

function findEntry(log, entryId) {
  if (entryId) {
    const byId = log.find(e => e.id === entryId);
    if (byId) return byId;
  }
  return log.length > 0 ? log[log.length - 1] : null;
}
