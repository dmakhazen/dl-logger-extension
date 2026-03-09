# dataLayer Logger

A Chrome extension for recording sessions when debugging GTM / analytics.

Records page screenshots and links them to dataLayer pushes and console logs for each click. At the end of a session, an HTML report is downloaded.

---

## Why

When debugging GTM and analytics you often need to:
- Check exactly what fired when clicking a specific element
- Catch rare events that are hard to reproduce
- Capture the state of dataLayer at the moment of an action
- Record output from third-party debuggers (DataLayer Checker and similar) from the console

Standard tools (console, Tag Assistant, Dataslayer) don't save sessions and don't link events to screenshots.

---

## Installation

1. Download or clone the repository
2. Open Chrome → address bar → `chrome://extensions`
3. Enable **"Developer mode"** (toggle in the top right)
4. Click **"Load unpacked"** → select the extension folder (the one containing `manifest.json`)
5. The extension icon will appear in the browser toolbar

> The extension runs locally only — it has not been published to the Chrome Web Store.

---

## How to use

1. Open the target website
2. Click the extension icon in the browser toolbar
3. Configure what to record (checkboxes)
4. Click **▶ Start session**
5. Browse the site and click — everything is recorded automatically
6. When done → click the extension icon → **⬇ Download report**
7. Open the downloaded `.html` file in the browser

Click **🗑 Clear** to reset the log and start a new session.

---

## Recording settings

| Checkbox | What it records |
|---|---|
| **Log pushes** | All `dataLayer.push()` events — GTM clicks, pageview, ecommerce, etc. |
| **Log console** | Everything printed to the console: `console.log / warn / error / info / debug`. Useful for third-party debuggers like DataLayer Checker that output pushes to the console with formatting |

---

## What goes into the report

For each click the report records:

- **Click number** and timestamp
- **Page URL** and tab title
- **Element info** — tag, id, classes, text, aria-label
- **Page screenshot** at the moment of click (clicked element highlighted with a red outline)
- **dataLayer pushes** that occurred after this click (until the next click)
- **Console logs** in the same interval

---

## How it works technically

The extension consists of three parts:

**`content-main.js`** — runs in `MAIN` world (same environment as the page itself). This is the only way to access the real `window.dataLayer` bypassing the site's Content Security Policy. Intercepts `dataLayer.push` and `console.*`, sends data via `window.postMessage`.

**`content.js`** — runs in `ISOLATED` world (isolated extension environment). Listens to `postMessage` from `content-main.js` and forwards data to the background via `chrome.runtime.sendMessage`. Also handles click detection and element highlighting.

**`background.js`** — service worker. Takes screenshots via `chrome.tabs.captureVisibleTab` (a browser API — a real screenshot, not a canvas redraw). Stores the entire session log in `chrome.storage.local`.

---

## Data storage

All data is stored locally in `chrome.storage.local` — the extension's isolated browser storage. Nothing is sent anywhere.

**What is stored:**

| Key | Description |
|---|---|
| `dl_log` | Array of session entries (base64 jpeg screenshots, click data, pushes, console logs) |
| `dl_session_active` | Active session flag (boolean) |
| `dl_log_pushes` | "Log pushes" setting (boolean) |
| `dl_log_console` | "Log console" setting (boolean) |
| `dl_lang` | Interface language: `en` or `ru` |

**Size:** each screenshot is ~100–300 KB (jpeg, quality 70, scale 0.5). With 30–50 clicks the log may reach 5–15 MB. `chrome.storage.local` allows up to ~10 MB — if it overflows, screenshots will stop saving but click and push data will not be lost. Clear the log with **🗑 Clear** between sessions.

---

## Limitations

- Only works on pages with `window.dataLayer` (GTM)
- Screenshot captures only the visible part of the page (not the full scroll height)
- On pages with strict CSP, dataLayer interception works via `world: MAIN` in the manifest — this bypasses restrictions correctly
- If the page uses Shadow DOM, element text may not be resolved

---

---

# dataLayer Logger (на русском)

Chrome расширение для записи сессий при отладке GTM / аналитики.

Записывает скриншоты страницы и привязывает к ним dataLayer пуши и консольные логи по каждому клику. В конце сессии скачивается HTML отчёт.

---

## Зачем

При отладке GTM и аналитики часто нужно:
- Проверить что именно сработало при клике на конкретный элемент
- Поймать редкие события которые сложно воспроизвести повторно
- Зафиксировать состояние dataLayer в момент действия
- Записать вывод сторонних дебаггеров (DataLayer Checker и подобных) из консоли

Стандартные инструменты (консоль, Tag Assistant, Dataslayer) не сохраняют сессию и не привязывают события к скриншотам.

---

## Установка

1. Скачай или склонируй репозиторий
2. Открой Chrome → адресная строка → `chrome://extensions`
3. Включи **"Режим разработчика"** (переключатель вверху справа)
4. Нажми **"Загрузить распакованное"** → выбери папку с расширением (ту где лежит `manifest.json`)
5. Иконка расширения появится в панели браузера

> Расширение работает только локально — в Chrome Store не публиковалось.

---

## Как пользоваться

1. Открой нужный сайт
2. Нажми на иконку расширения в панели браузера
3. Настрой что записывать (чекбоксы)
4. Нажми **▶ Начать сессию**
5. Ходи по сайту и кликай — всё записывается автоматически
6. Когда закончил → нажми иконку расширения → **⬇ Скачать отчёт**
7. Открой скачанный `.html` файл в браузере

Для новой сессии нажми **🗑 Очистить** и начни заново.

---

## Настройки записи

| Чекбокс | Что записывает |
|---|---|
| **Логировать пуши** | Все `dataLayer.push()` события — GTM клики, pageview, ecommerce и т.д. |
| **Логировать консоль** | Всё что появляется в консоли: `console.log / warn / error / info / debug`. Полезно для сторонних дебаггеров типа DataLayer Checker которые выводят пуши в консоль с подсветкой |

---

## Что попадает в отчёт

По каждому клику в отчёте записывается:

- **Номер клика** и время
- **URL страницы** и заголовок вкладки
- **Информация об элементе** — тег, id, классы, текст, aria-label
- **Скриншот страницы** в момент клика (кликнутый элемент подсвечен красной рамкой)
- **dataLayer пуши** которые произошли после этого клика (до следующего)
- **Консольные логи** в том же промежутке

---

## Как работает технически

Расширение состоит из трёх частей:

**`content-main.js`** — запускается в `MAIN` world (то же окружение что и сама страница). Это единственный способ получить доступ к реальному `window.dataLayer` в обход Content Security Policy сайта. Перехватывает `dataLayer.push` и `console.*`, отправляет данные через `window.postMessage`.

**`content.js`** — запускается в `ISOLATED` world (изолированное окружение расширения). Слушает `postMessage` от `content-main.js` и пересылает данные в background через `chrome.runtime.sendMessage`. Также отвечает за обработку кликов и подсветку элементов.

**`background.js`** — service worker. Делает скриншоты через `chrome.tabs.captureVisibleTab` (это браузерный API — реальный скриншот, не перерисовка canvas). Хранит весь лог сессии в `chrome.storage.local`.

---

## Хранение данных

Все данные хранятся локально в `chrome.storage.local` — изолированное хранилище расширения в браузере. Никуда не отправляются.

**Что хранится:**

| Ключ | Описание |
|---|---|
| `dl_log` | Массив записей сессии (скриншоты base64 jpeg, данные кликов, пуши, логи консоли) |
| `dl_session_active` | Флаг активной сессии (boolean) |
| `dl_log_pushes` | Настройка "логировать пуши" (boolean) |
| `dl_log_console` | Настройка "логировать консоль" (boolean) |
| `dl_lang` | Язык интерфейса: `en` или `ru` |

**Объём:** каждый скриншот весит ~100–300 КБ (jpeg, quality 70, scale 0.5). При 30–50 кликах лог может занять 5–15 МБ. `chrome.storage.local` позволяет хранить до ~10 МБ — при переполнении скриншоты перестанут сохраняться, данные о кликах и пушах при этом не теряются. Очищай лог кнопкой **🗑 Очистить** между сессиями.

---

## Ограничения

- Работает только на страницах с `window.dataLayer` (GTM)
- Скриншот фиксирует только видимую часть страницы (не весь scroll)
- На страницах с жёстким CSP перехват dataLayer работает через `world: MAIN` в манифесте — это обходит ограничения корректно
- Если страница использует Shadow DOM — текст элемента может не определиться
