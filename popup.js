// ─── Переводы ────────────────────────────────────────────────────────────────
const I18N = {
  en: {
    settingsTitle:    'What to record',
    chkPushesLabel:   'Log pushes',
    chkPushesSub:     'dataLayer.push events',
    chkConsoleLabel:  'Log console',
    chkConsoleSub:    'console.log / warn / error / info',
    consoleFilterPh:  'Filter console (substring)',
    btnStart:         '▶ Start session',
    btnStop:          '⏹ Stop session',
    statusLabel:      'Status:',
    statusInactive:   'inactive',
    statusActive:     'recording...',
    clicksLabel:      'Clicks:',
    pushesLabel:      'Pushes:',
    consoleLabel:     'Console logs:',
    btnDownload:      '⬇ Download report',
    btnClear:         '🗑 Clear',
    hintInactive:     'Configure what to record and click "Start session"',
    hintActive:       'Browse the site — everything is being recorded',
    confirmClear:     'Clear all logs?',
  },
  ru: {
    settingsTitle:    'Что записывать',
    chkPushesLabel:   'Логировать пуши',
    chkPushesSub:     'dataLayer.push события',
    chkConsoleLabel:  'Логировать консоль',
    chkConsoleSub:    'console.log / warn / error / info',
    consoleFilterPh:  'Фильтр консоли (подстрока)',
    btnStart:         '▶ Начать сессию',
    btnStop:          '⏹ Остановить сессию',
    statusLabel:      'Статус:',
    statusInactive:   'неактивен',
    statusActive:     'запись идёт...',
    clicksLabel:      'Кликов:',
    pushesLabel:      'Пушей:',
    consoleLabel:     'Логов консоли:',
    btnDownload:      '⬇ Скачать отчёт',
    btnClear:         '🗑 Очистить',
    hintInactive:     'Настрой что записывать и нажми "Начать сессию"',
    hintActive:       'Ходи по сайту — всё записывается',
    confirmClear:     'Очистить весь лог?',
  },
};

let currentLang = 'en';
let isActive    = false;

// ─── Версия ──────────────────────────────────────────────────────────────────
const ver = chrome.runtime.getManifest().version;
document.getElementById('version').textContent = 'v' + ver;

// ─── Применить язык ──────────────────────────────────────────────────────────
function applyLang(lang) {
  currentLang = lang;
  const t = I18N[lang];

  // Обновляем все элементы с data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key] !== undefined) el.textContent = t[key];
  });

  // Placeholder-переводы
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const key = el.getAttribute('data-i18n-ph');
    if (t[key] !== undefined) el.placeholder = t[key];
  });

  // Кнопки языка
  document.getElementById('langEn').classList.toggle('active', lang === 'en');
  document.getElementById('langRu').classList.toggle('active', lang === 'ru');

  // Динамические тексты (статус, кнопка сессии) — обновляем отдельно
  updateSessionUI();
}

// ─── Переключатели языка ─────────────────────────────────────────────────────
document.getElementById('langEn').addEventListener('click', () => {
  chrome.storage.local.set({ dl_lang: 'en' }, () => applyLang('en'));
});
document.getElementById('langRu').addEventListener('click', () => {
  chrome.storage.local.set({ dl_lang: 'ru' }, () => applyLang('ru'));
});

// ─── Загрузить состояние ─────────────────────────────────────────────────────
function loadState() {
  chrome.storage.local.get(
    ['dl_session_active', 'dl_log_pushes', 'dl_log_console', 'dl_lang', 'dl_console_filter'],
    (result) => {
      isActive = result.dl_session_active === true;

      const lang = result.dl_lang || 'en';
      currentLang = lang;

      document.getElementById('chkPushes').checked  = result.dl_log_pushes  !== false;
      document.getElementById('chkConsole').checked = result.dl_log_console === true;
      document.getElementById('consoleFilter').value = result.dl_console_filter || '';

      // Читаем лог из in-memory background — единственный источник правды
      chrome.runtime.sendMessage({ type: 'GET_LOG' }, (response) => {
        const log         = response?.log || [];
        const clicks      = log.filter(e => e.id !== 0).length;
        const pushes      = log.reduce((s, e) => s + (e.pushes?.length || 0), 0);
        const consoleLogs = log.reduce((s, e) => s + (e.consoleLogs?.length || 0), 0);

        document.getElementById('clickCount').textContent   = clicks;
        document.getElementById('pushCount').textContent    = pushes;
        document.getElementById('consoleCount').textContent = consoleLogs;
        document.getElementById('btnDownload').disabled     = log.length === 0;

        applyLang(lang);
      });
    }
  );
}

// ─── Обновить UI под текущий статус ─────────────────────────────────────────
function updateSessionUI() {
  const t    = I18N[currentLang];
  const btn  = document.getElementById('btnSession');
  const dot  = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  const hint = document.getElementById('hint');

  if (isActive) {
    btn.textContent  = t.btnStop;
    btn.className    = 'session-btn stop';
    dot.className    = 'dot active';
    text.textContent = t.statusActive;
    hint.textContent = t.hintActive;
  } else {
    btn.textContent  = t.btnStart;
    btn.className    = 'session-btn start';
    dot.className    = 'dot inactive';
    text.textContent = t.statusInactive;
    hint.textContent = t.hintInactive;
  }
}

// ─── Старт / Стоп ────────────────────────────────────────────────────────────
document.getElementById('btnSession').addEventListener('click', () => {
  isActive = !isActive;
  chrome.storage.local.set({ dl_session_active: isActive }, () => {
    updateSessionUI();
    loadState();
  });
});

// ─── Чекбоксы ────────────────────────────────────────────────────────────────
document.getElementById('chkPushes').addEventListener('change', (e) => {
  chrome.storage.local.set({ dl_log_pushes: e.target.checked });
});
document.getElementById('chkConsole').addEventListener('change', (e) => {
  chrome.storage.local.set({ dl_log_console: e.target.checked });
});
document.getElementById('consoleFilter').addEventListener('input', (e) => {
  chrome.storage.local.set({ dl_console_filter: e.target.value });
});

// ─── Скачать отчёт ───────────────────────────────────────────────────────────
document.getElementById('btnDownload').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'GET_LOG' }, (response) => {
    const log = response?.log || [];
    const filter = document.getElementById('consoleFilter').value.trim();
    const html = buildReport(log, filter);
    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;

    // Имя файла: {YYYY-MM-DD} {HH-mm} {название сайта}.html
    const now = new Date();
    const datePart = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0');
    const timePart = String(now.getHours()).padStart(2, '0') + '-' +
      String(now.getMinutes()).padStart(2, '0');
    const firstEntry = log.find(e => e.url);
    let siteName = 'report';
    if (firstEntry && firstEntry.url) {
      try {
        siteName = new URL(firstEntry.url).hostname.replace(/[^a-zA-Z0-9а-яА-ЯёЁ._-]/g, '_');
      } catch (e) { /* keep default */ }
    }
    a.download = `${datePart} ${timePart} ${siteName}.html`;
    a.click();
    URL.revokeObjectURL(url);
  });
});

// ─── Очистить ────────────────────────────────────────────────────────────────
document.getElementById('btnClear').addEventListener('click', () => {
  if (!confirm(I18N[currentLang].confirmClear)) return;
  chrome.runtime.sendMessage({ type: 'CLEAR_LOG' }, () => loadState());
});

// ─── Построить отчёт ─────────────────────────────────────────────────────────
function buildReport(log, consoleFilter) {
  const filterLower = (consoleFilter || '').toLowerCase();
  const LEVEL_COLOR = {
    log:   '#eee',
    info:  '#4fc3f7',
    warn:  '#ffb74d',
    error: '#ef5350',
    debug: '#ce93d8',
  };

  const NAV_LABELS = {
    'page-load':    '📄 Page load',
    'spa-push':     '📄 Navigation',
    'spa-replace':  '📄 Navigation',
    'popstate':     '📄 Back / Forward',
  };

  // Нумеруем клики и переходы раздельно
  let clickIdx = 0;
  let navIdx   = 0;

  const entries = log.map((entry) => {
    let screenshotHtml;
    if (!entry.screenshot) {
      screenshotHtml = `<div class="no-screenshot">screenshot unavailable</div>`;
    } else if (entry.kind === 'click' && entry.elementRect && entry.viewportWidth) {
      // Рисуем красную рамку поверх скриншота средствами CSS — 100% надёжно
      const r = entry.elementRect;
      const vw = entry.viewportWidth;
      const vh = entry.viewportHeight;
      const pad = 4;
      screenshotHtml = `
        <div class="screenshot-container" style="position:relative;display:inline-block">
          <img src="${entry.screenshot}" class="screenshot">
          <div style="position:absolute;top:${((r.top - pad) / vh * 100).toFixed(2)}%;left:${((r.left - pad) / vw * 100).toFixed(2)}%;width:${((r.width + pad * 2) / vw * 100).toFixed(2)}%;height:${((r.height + pad * 2) / vh * 100).toFixed(2)}%;border:3px solid #ff2244;border-radius:4px;box-shadow:0 0 8px rgba(255,34,68,0.6);pointer-events:none;"></div>
        </div>`;
    } else {
      screenshotHtml = `<img src="${entry.screenshot}" class="screenshot">`;
    }

    const pushesHtml = entry.pushes?.length
      ? `<div class="section-title">dataLayer pushes:</div>` +
        entry.pushes.map(p => `
          <div class="push">
            <div class="event-name">▶ ${escapeHtml(p.payload?.event || '(no event)')}
              <span class="log-time">${formatTime(p.time)}</span>
            </div>
            <pre>${escapeHtml(JSON.stringify(p.payload, null, 2))}</pre>
          </div>`).join('')
      : '';

    const consoleHtml = entry.consoleLogs?.length
      ? (() => {
          const filtered = filterLower
            ? entry.consoleLogs.filter(c => c.text.toLowerCase().includes(filterLower))
            : entry.consoleLogs;
          if (!filtered.length) return '';
          return `<div class="section-title" style="margin-top:12px">Console:</div>` +
            filtered.map(c => `
              <div class="console-row" style="color:${LEVEL_COLOR[c.level] || '#eee'}">
                <span class="console-level">${c.level.toUpperCase()}</span>
                <span class="log-time">${formatTime(c.time)}</span>
                <pre class="console-text">${escapeHtml(c.text)}</pre>
              </div>`).join('');
        })()
      : '';

    const nothingHtml = !entry.pushes?.length && !entry.consoleLogs?.length
      ? `<div class="no-push">— nothing recorded —</div>`
      : '';

    // ── Клик ──
    if (entry.kind === 'click' || !entry.kind) {
      clickIdx++;
      return `
        <div class="entry entry-click">
          <div class="entry-header">
            <span class="entry-num click-label">🖱 Click #${clickIdx}</span>
            <span class="log-time">${formatTime(entry.time)}</span>
            <span class="page-title">${escapeHtml(entry.pageTitle || '')}</span>
          </div>
          <div class="entry-url">${escapeHtml(entry.url || '')}</div>
          <div class="element-info click-info">🖱 ${escapeHtml(entry.elementInfo || '')}</div>
          <div class="screenshot-wrap">${screenshotHtml}</div>
          <div class="events-section">${pushesHtml}${consoleHtml}${nothingHtml}</div>
        </div>`;
    }

    // ── Навигация ──
    navIdx++;
    const navLabel = NAV_LABELS[entry.navigationType] || '📄 Navigation';
    return `
      <div class="entry entry-nav">
        <div class="entry-header">
          <span class="entry-num nav-label">${navLabel} #${navIdx}</span>
          <span class="log-time">${formatTime(entry.time)}</span>
          <span class="page-title">${escapeHtml(entry.pageTitle || '')}</span>
        </div>
        <div class="entry-url">${escapeHtml(entry.url || '')}</div>
        <div class="screenshot-wrap">${screenshotHtml}</div>
        <div class="events-section">${pushesHtml}${consoleHtml}${nothingHtml}</div>
      </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en"><head>
  <meta charset="utf-8">
  <title>dataLayer Session Report</title>
  <style>
    * { box-sizing:border-box; }
    body { font-family:monospace; background:#0f0f1a; color:#eee; padding:24px; line-height:1.5; }
    h1 { color:#e94560; margin-bottom:24px; }

    .entry { border-radius:10px; padding:20px; margin-bottom:16px; }
    .entry-click { border:1px solid #2a2a4a; background:#1a1a2e; }
    .entry-nav   { border:1px solid #1a3a2a; background:#0f1f17; }

    .entry-header { display:flex; align-items:baseline; gap:12px; margin-bottom:6px; }
    .entry-num  { font-weight:bold; font-size:15px; }
    .click-label { color:#e94560; }
    .nav-label   { color:#4caf50; }
    .page-title { color:#aaa; font-size:12px; }
    .log-time   { color:#555; font-size:11px; }
    .entry-url  { font-size:11px; margin-bottom:10px; word-break:break-all; }
    .entry-click .entry-url { color:#4fc3f7; }
    .entry-nav   .entry-url { color:#80cbc4; }

    .element-info { border-radius:4px; padding:8px 12px; font-size:13px; margin-bottom:12px; }
    .click-info { background:#12122a; border-left:3px solid #e94560; color:#ff8a80; }

    .screenshot { max-width:100%; border-radius:6px; display:block; }
    .entry-click .screenshot { border:2px solid #2a2a4a; }
    .entry-nav   .screenshot { border:2px solid #1a3a2a; }
    .no-screenshot { color:#555; font-style:italic; font-size:12px; }
    .screenshot-wrap { margin:12px 0; }

    .section-title { color:#888; font-size:11px; text-transform:uppercase; letter-spacing:.5px; margin-bottom:6px; }
    .push { background:#0f1e3d; border-radius:6px; padding:10px 12px; margin-bottom:6px; border-left:3px solid #0f3460; }
    .event-name { color:#4fc3f7; font-weight:bold; margin-bottom:4px; font-size:13px; }
    pre { font-size:11px; margin:0; white-space:pre-wrap; word-break:break-all; color:#fff9c4; }
    .console-row { background:#111827; border-radius:5px; padding:6px 10px; margin-bottom:4px; display:flex; flex-wrap:wrap; gap:6px; align-items:baseline; }
    .console-level { font-size:10px; font-weight:bold; min-width:40px; }
    .console-text  { font-size:11px; margin:0; flex:1; min-width:0; white-space:pre-wrap; word-break:break-all; color:inherit; }
    .no-push { color:#444; font-style:italic; font-size:12px; margin-top:8px; }
    .events-section { margin-top:4px; }
  </style>
</head><body>
  <h1>📋 dataLayer Session Report</h1>
  <div style="color:#555;font-size:12px;margin-bottom:16px">dataLayer Logger v${ver}${filterLower ? ' — console filter: <span style="color:#4fc3f7">' + escapeHtml(consoleFilter) + '</span>' : ''}</div>
  ${entries || '<div style="color:#555">Log is empty</div>'}
</body></html>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTime(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleTimeString(); }
  catch { return iso; }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

loadState();
