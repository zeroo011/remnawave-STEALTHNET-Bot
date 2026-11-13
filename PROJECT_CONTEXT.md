# 🧭 PROJECT CONTEXT & KNOWLEDGE BASE
> **Назначение файла:** Полная оперативная память, контекст и история всех задач, решений, изменений и развертываний проекта **Remnawave-STEALTHNET-Bot**.  
> **Для нового чата / AI-ассистента:** Прочитайте этот файл перед началом работы — здесь есть вся информация о кодовой базе, структуре репозитория, сервере продакшена, архитектурных правилах и последних сделанных изменениях.

---

## 1. 📌 Общие сведения о проекте

**Remnawave-STEALTHNET-Bot** — комплексное решение для автоматизации продаж и управления VPN-сервисом на базе Remnawave, Sing-box и классических прокси:
- **Telegram Bot (`bot/`):** Бот на фреймворке **grammY** с поддержкой классических инлайн-меню, Web App (Mini App), Telegram Widgets (`sendWidget` / `htmlbubbles`), мультиязычности и кастомных эмодзи.
- **Backend API (`backend/`):** REST API на **Node.js 22+ (TypeScript, Express)**, работающий с **PostgreSQL** через **Prisma ORM**. Управляет подписками, интеграцией с Remnawave, биллингом (множество платежных шлюзов), партнерской программой, рассылками и тикетами поддержки.
- **Frontend / Web UI (`frontend/`):** SPA на **React 18, Vite, Tailwind CSS, shadcn/ui**. Включает:
  - Панель администратора (`/admin`).
  - Личный кабинет клиента (с тремя темами оформления: *Classic*, *Aurora*, *Stealth*).
  - PWA-режим с оффлайн-кэшированием и Telegram Mini App интеграцией.
- **Broadcast Worker (`backend/src/worker/broadcast-worker.ts`):** Отдельный изолированный фоновый процесс для безопасной массовой рассылки сообщений через Telegram Bot API.
- **SSH Console (`console/`):** Терминальная консоль мониторинга на Go (Bubble Tea).

---

## 2. 🌐 Репозитории и Git-конфигурация

- **Upstream (официальный репозиторий проекта):**  
  `https://github.com/STEALTHNET-APP/remnawave-STEALTHNET-Bot.git`  
  *Remote имя:* `origin`
- **Fork (репозиторий пользователя для разработки и PR):**  
  `git@github.com:zeroo011/remnawave-STEALTHNET-Bot.git`  
  *Remote имя:* `fork`
- **Актуальная рабочая ветка:** `main` (синхронизирована с `origin/main` и `fork/main`).
- **Текущий HEAD коммит:** `dd50b52` (*perf: prefetch the landing chunk together with the public config, PR #275*).

---

## 3. 🚀 Боевой сервер (Production Environment)

- **SSH доступ:** `ssh vpn_bot`
- **Рабочий каталог на сервере:** `/opt/remnawave-STEALTHNET-Bot`
- **Публичные домены:**
  - Панель и Web-кабинет: `https://ghostnet.store` (бренд: *GhostNet*, бот: `@GhostNetPro_bot`)
  - Статус мониторинга (Uptime Kuma): `https://status.ghostnet.store`
- **Локальные файлы на сервере, которые КАТЕГОРИЧЕСКИ НЕЛЬЗЯ ЗАТИРАТЬ:**
  1. `docker-compose.yml`:
     - Порт API привязан строго к локалхосту: `127.0.0.1:5000:5000` (безопасность, чтобы API не торчал наружу в интернет).
  2. `nginx/nginx.conf`:
     - Настроен на домен `ghostnet.store` и SSL-сертификаты Let's Encrypt.
     - Содержит секцию проксирования для `status.ghostnet.store` на `uptime-kuma:3001`.
  > **Важно:** Перед выполнением `git pull` на сервере всегда делайте бэкап этих файлов или `git stash`, а затем возвращайте локальные изменения!

### Запущенные контейнеры Docker на сервере:
- `stealthnet-api` (образ `stealthnet-api:latest`, авто-миграции Prisma при старте через `docker-entrypoint.sh`).
- `stealthnet-bot` (Telegram бот `@GhostNetPro_bot`).
- `stealthnet-broadcast-worker` (обработка рассылок).
- `stealthnet-frontend-build` (одноразовый контейнер, компилирует статику в volume `frontend_dist`).
- `stealthnet-nginx` (Nginx, порты 80, 443).
- `stealthnet-postgres` (PostgreSQL 16, база `stealthnet`).
- `stealthnet-certbot` (Let's Encrypt SSL автопродление).
- `uptime-kuma` (мониторинг доступности на `127.0.0.1:3001`).
- `stealthnet-console` (Go SSH-консоль).

---

## 4. 📦 Хронология ключевых изменений и реализованных задач

### 4.1. Рефакторинг архитектуры бота (PR #263, коммиты `54fa8d3`, `d66ebea`, `573eed3`)
- **Проблема:** Файл `bot/src/index.ts` разросся до 4000+ строк, превратился в хрупкий монолит, где текстовые обработчики случайно перехватывали команды `/start`, `/menu` и др.
- **Решение:**
  - Декомпозиция монолита на модульные хэндлеры в папке `bot/src/handlers/`:
    - `main-menu.ts`: навигация по главному меню.
    - `devices.ts`: просмотр, лимиты и удаление привязанных устройств (HWID).
    - `payments.ts`: выбор тарифа, периодов, способов оплаты, автоплатежи.
    - `gifts.ts`: покупка и активация подарочных подписок.
    - `subscriptions.ts`: просмотр подписок, конфигов, QR-кодов, продление.
    - `support.ts`: тикеты и связь с администратором.
    - `referral.ts`: реферальная ссылка, статистика, вывод средств.
    - `promo.ts`: ввод промокодов.
    - `shared.ts`: общие утилиты форматирования текстов тарифов и подписок.
  - Внедрен `bot/src/state-store.ts` (in-memory state store со скользящим TTL для FSM диалогов).
  - Внедрен `bot/src/api-retry.ts` (отказоустойчивый API-клиент с таймаутами и ретраями).
  - В `bot/src/index.ts` остался только чистый bootstrapping бота и регистрация middleware/хэндлеров.
  - Покрыто unit/integration тестами (`bot/src/*.test.ts`, 54 теста, 100% pass).

### 4.2. Безопасность и жизненный цикл тикетов (PR #269, коммит `55c267f`, `fe8f2ad`, `af4b854`)
- Добавлен явный жизненный цикл тикетов: `OPEN` / `CLOSED`.
- Разделение списка обращений на вкладки: «Активные» и «Закрытые».
- Замена неочевидной плашки-галочки на явную кнопку действия «Закрыть обращение».
- Защита безопасности: клиент лишен возможности удалять тикеты из БД (только закрытие), валидация ownership на бэкенде.

### 4.3. PWA Smart Cache и бесшовные обновления (PR #264, коммит `cad82ca`)
- Создан модуль `frontend/src/lib/cache-housekeeper.ts`: авто-очистка устаревших чанков кэша (retention 7 дней) во избежание разрастания IndexedDB/CacheStorage.
- Создан модуль `frontend/src/lib/update-safety.ts`: умное применение обновлений PWA. Блокирует перезагрузку страницы, если клиент находится в процессе оплаты (checkout), вводит данные в формы или читает инструкцию.

### 4.4. Выплаты реферальных бонусов через СБП и Карты РФ (PR #268, коммит `3c49bdb`)
- В модуле вывода реферальных средств добавлены методы выплаты: СБП (по номеру телефона с указанием банка) и банковские карты РФ, наряду с USDT.

### 4.5. Исправление отображения баланса и навигации по устройствам в боте (Issues #266, #267, коммит `a1c32fe`)
- Исправлено форматирование копеек в балансе (вывод с двумя знаками после запятой).
- Для пользователей с одной активной подпиской кнопка «Устройства» сразу открывает список устройств этой подписки, минуя лишний шаг выбора подписки.

### 4.6. Управление лимитами доп. устройств и защита оплат (коммиты `3c30fbb`, `becc4fe`)
- Валидация на стороне API: запрет оформления заказа на количество доп. устройств, превышающее лимит тарифа (`maxExtraDevices`).
- Модуль `webhook-inbox`: фиксация всех входящих вебхуков от всех платежных систем в БД для аудита и разбора инцидентов.
- Оповещение администраторов о покупке дополнительных устройств.

### 4.7. Сортировка методов Platega и сворачивание шлюзов в админке (коммиты `7ad1686`, `fb53b03`)
- Возможность произвольной сортировки и переименования методов оплаты Platega (СБП, Карты, Криптовалюта, Международные).
- Сворачиваемые карточки (Collapsible) настроек CloudPayments и Telegram Stars для компактности интерфейса админки.

### 4.8. Исправление отображения лимитов устройств тарифов (PR #274, коммит `0799ed7`)
- **Проблема:** Бот и клиентские кабинеты (Classic, Stealth, Aurora) для современных тарифов с полем `includedDevices` показывали «устройства без лимита», так как проверяли только устаревшее поле `deviceLimit` (которое у новых тарифов равно `null`).
- **Решение:**
  - Создан хелпер `bot/src/tariff-device-limit.ts` с функцией `resolveTariffDeviceLimit(tariff)`. При наличии обоих полей берется большее, при `null` и `includedDevices > 0` берется `includedDevices`, `0` — честный безлимит.
  - Обновлены типы тарифов в `bot/src/api.ts` и `frontend/src/lib/api.ts`.
  - Обновлены `bot/src/handlers/shared.ts` (`formatTariffLine`), карточки подписок, экраны тарифов в кабинетах (Classic, Stealth, Aurora) и лендинг.
  - На бэкенде: офлайн-снапшот подписки дополнен полем `hwidDeviceLimit`.

### 4.9. Доработки мейннейнера upstream (коммиты `7d0b5df`, `378a3ee`, `0fd5bbc`, `ff22c44`, `1f34ddd`)
- **`7d0b5df`:** Введена таблица `payment_deliveries` (Prisma миграция `20261109090000_payment_delivery`). Создан `PaymentDeliveryService` для надежной и гарантированной выдачи оплаченных заказов даже при временном падении Remnawave.
- **`0fd5bbc`:**
  - Интеграция нового платежного провайдера **CisPay** (`cispay.service.ts`, `cispay.webhooks.ts`, `cispay-settings.tsx`).
  - Добавлены интерактивные **Telegram Widgets (`htmlbubbles test`)** через `sendWidget` (переключатель в админке: *Настройки -> Бот -> Поведение*).
  - Группировка навигации по настройкам админки (`SettingsNavigation`).
- **`ff22c44`:** Исправлен таймаут long polling в боте (удержание внутри HTTP-таймаута во избежание ложных разрывов соединения).
- **`1f34ddd`:** Подгонка размеров виджетов под длину текста и сохранение границ слов/эмодзи.

### 4.10. Оптимизация бандла, удаление GSAP и модуля «Мой налог» (PR #275, коммиты `14a7482`..`dd50b52`)
- **`14a7482`:** В `backend/tsconfig.json` отключена генерация деклараций (`declaration: false`, `declarationMap: false`), что решило 76 ошибок `TS2742` и ускорило сборку.
- **`b58b978`:** В `bot/src/handlers/payments.ts` устранен вложенный дубликат условия `if (data.startsWith("yk_recpt:"))`.
- **`883f678`:** В `frontend/src/App.tsx` клиентский кабинет, маркетплейс и лендинг переведены на `lazyPage`. Начальный чанк `index.js` уменьшился с **1 761 кБ до 568 кБ** (gzip 179 кБ).
- **`ddd0e3d`:** Полностью удален неработающий и неподдерживаемый модуль «Мой налог» (`backend/src/modules/nalog/`), убраны вызовы из вебхуков YooKassa, эндпоинты в `admin.routes.ts` и форма настроек в `settings.tsx`.
- **`23f4cc1`:** Полная замена `gsap` на `framer-motion` (удалены `gsap-utils.ts` и `scroll-reveal.ts`, пакет `gsap` удален из `package.json`). Устранены таймеры `setTimeout` и манипуляции с DOM через `querySelector`.
- **`dd50b52`:** Параллельная предзагрузка чанка лендинга вместе с получением публичного конфига во избежание двойного лоадера.
- **Развертывание на проде:** Все образы (`api`, `bot`, `frontend`) пересобраны и успешно выкачены на `vpn_bot` (`ghostnet.store`). Статус сервисов проверен, healthcheck `{"status":"ok"}`.

### 4.11. Оптимизация запросов БД, пакетная синхронизация, PWA-прекэш и рефакторинг платежей бота (PR #276, коммит `86222fd`)
- **Бэкенд (Аналитика):** В `backend/src/modules/admin/admin.routes.ts` эндпоинт `/admin/analytics` переписан с чтения всех клиентов в память Node.js на агрегаты Postgres (`prisma.client.aggregate({ _sum: { balance: true } })`, `COUNT(*) FILTER`, выборки с лимитом по времени 90 дней). Полностью исключено переполнение RAM при росте базы клиентов.
- **Бэкенд (Синхронизация Remnawave):** В `backend/src/modules/sync/sync.service.ts` метод `syncFromRemna()` переведен на пакетные запросы с оператором `IN (...)` (4 запроса на порцию из 100 пользователей вместо ~500 последовательных запросов в цикле).
- **Бот (Платежные шлюзы):** В `bot/src/handlers/payments.ts` размер файла сокращен с 2 560 до 1 000 строк. Логика диспетчеризации шлюзов, таблиц провайдеров и чекаутов вынесена в `bot/src/handlers/payment-gateways.ts`.
- **Фронтенд (PWA Прекэш):** В `frontend/vite.config.js` настроен `globIgnores` для исключения админских чанков из кэша сервисного воркера. Размер офлайн-кэша PWA сократился с **4 853 КиБ до 2 695 КиБ** (-44.5%).
- **Развертывание на проде:** Смержено в `main` (`86222fd`), образы `stealthnet-api`, `stealthnet-bot` и `stealthnet-frontend` собраны и перезапущены на сервере `vpn_bot` (`ghostnet.store`). Все контейнеры здоровы, `curl https://ghostnet.store/api/health` возвращает `{"status":"ok"}`.

### 4.12. Декомпозиция монолита admin.routes.ts (PR #277, коммит `5866756`)
- **Бэкенд (Админка):** Начата декомпозиция монолита `backend/src/modules/admin/admin.routes.ts` (размер сокращен с 8 097 до 7 055 строк, −1 042 строки).
- **Выделены 3 изолированных суб-роутера:**
  - `backend/src/modules/admin/remna.routes.ts` (+449 строк): все прокси-маршруты `/remna/*` (ноды, сквады, биллинг, профили, хвид, метрики) и хелпер `remnaPass`. Из `admin.routes.ts` удалены 66 неиспользуемых импортов.
  - `backend/src/modules/admin/tariffs.routes.ts` (+278 строк): CRUD операции над тарифами (`GET`, `POST`, `PATCH`, `DELETE`) и сериализатор `tariffToJson`.
  - `backend/src/modules/admin/analytics.routes.ts` (+359 строк): эндпоинты аналитики и финансовых метрик.
- **Подключение:** В `admin.routes.ts` смонтированы ровно 3 строками через `adminRouter.use(...)` с полным сохранением контракта путей API и проверок аутентификации.
- **Развертывание на проде:** Смержено в `main` (`5866756`), образ `stealthnet-api` пересобран и перезапущен на `vpn_bot` (`ghostnet.store`). Сервис здоров, `curl https://ghostnet.store/api/health` возвращает `{"status":"ok"}`.

### 4.13. Декомпозиция маршрутов клиентов и подписок (PR #278, коммит `813265e`)
- **Бэкенд (Админка):** Проведен второй этап декомпозиции `admin.routes.ts` (размер сократился с 7 055 до **5 371 строки**, суммарно срезано уже более 2 700 строк монолита).
- **Выделены 2 новых суб-роутера:**
  - `backend/src/modules/admin/clients.routes.ts` (+1 290 строк, 39 эндпоинтов): полный набор CRUD операций над клиентами, баланс, бан, сброс паролей/2FA, привязка/отвязка Remnawave, квоты, сквады, устройства, аудит и сводки.
  - `backend/src/modules/admin/subscriptions.routes.ts` (+434 строки, 13 эндпоинтов): продление дней подписок (`grant-extend`), управление Remna-профилями подписок, сквады, устройства, сброс трафика и удаление HWID.
- **Подключение:** В `admin.routes.ts` смонтированы через:
  ```ts
  adminRouter.use("/clients", adminClientsRouter);
  adminRouter.use("/subscriptions", adminSubscriptionsRouter);
  ```
- **Развертывание на проде:** Смержено в `main` (`813265e`), образ `stealthnet-api` пересобран и перезапущен на `vpn_bot` (`ghostnet.store`). Сервис здоров, `curl https://ghostnet.store/api/health` возвращает `{"status":"ok"}`.

### 4.14. Декомпозиция тикетов, промокодов, триалов и категорий тарифов (PR #279, коммит `426668e`)
- **Бэкенд (Админка):** Проведен третий этап декомпозиции `admin.routes.ts` (размер сократился с 5 378 до **4 526 строк**, суммарное сокращение монолита с исходных 8 097 составило −3 571 строку).
- **Выделены 4 новых изолированных суб-роутера:**
  - `backend/src/modules/admin/tickets.routes.ts` (+296 строк, 9 эндпоинтов): тикетная система техподдержки, multipart-загрузка вложений (`uploadTicketAttachment`), массовые ответы и удаление.
  - `backend/src/modules/admin/promo.routes.ts` (+275 строк, 10 эндпоинтов): промо-группы и промокоды (`adminPromoGroupsRouter` и `adminPromoCodesRouter`), валидация схем и генерация кодов.
  - `backend/src/modules/admin/trials.routes.ts` (+213 строк, 4 эндпоинта): CRUD пробных периодов (триалов) и сериализатор `trialToJson`.
  - `backend/src/modules/admin/tariff-categories.routes.ts` (+112 строк, 4 эндпоинта): CRUD категорий тарифов.
- **Подключение:** В `admin.routes.ts` смонтированы ровно 5 строками через `adminRouter.use(...)` с полным сохранением ролевого доступа и валидации.
- **Развертывание на проде:** Смержено в `main` (`426668e`), образ `stealthnet-api` пересобран и перезапущен на `vpn_bot` (`ghostnet.store`). Сервис здоров, `curl https://ghostnet.store/api/health` возвращает `{"status":"ok"}`.

### 4.15. Декомпозиция рассылок, вторичных подписок, онбординга и админов (PR #280, коммит `991a96c`)
- **Бэкенд (Админка):** Завершен четвертый этап декомпозиции `admin.routes.ts`. Размер файла сократился с 4 526 до **2 922 строк** (суммарно за 4 этапа вырезано **5 175 строк** из исходных 8 097, файл уменьшился на 64%).
- **Выделены 4 новых изолированных суб-роутера:**
  - `backend/src/modules/admin/broadcast.routes.ts` (+493 строки): ручные рассылки (`adminBroadcastRouter`, multipart-аттачи `broadcastUpload` до 50 МБ, прямая отправка в Telegram/Email, управление очередями рассылок) и авто-рассылки (`adminAutoBroadcastRouter`, триггеры, правила, догоняющая рассылка).
  - `backend/src/modules/admin/secondary-subscriptions.routes.ts` (+394 строки): управление вторичными подписками (`adminSecondarySubscriptionsRouter`), CRUD, фильтрация и массовое удаление.
  - `backend/src/modules/admin/tour.routes.ts` (+561 строка): конструктор онбординга пользователей (`adminTourStepsRouter`, шаги, видео-загрузка `uploadVideo`) и управление маскотами (`adminTourMascotsRouter`, эмоции, `uploadMascotImage`).
  - `backend/src/modules/admin/admins.routes.ts` (+237 строк): управление администраторами и менеджерами системы (`adminAdminsRouter`), права секций `ADMIN_ALLOWED_SECTIONS` (сохранен реэкспорт для совместимости).
- **Подключение:** В `admin.routes.ts` смонтированы через:
  ```ts
  adminRouter.use("/broadcast", adminBroadcastRouter);
  adminRouter.use("/auto-broadcast", adminAutoBroadcastRouter);
  adminRouter.use("/admins", adminAdminsRouter);
  adminRouter.use("/secondary-subscriptions", adminSecondarySubscriptionsRouter);
  adminRouter.use("/tour-steps", adminTourStepsRouter);
  adminRouter.use("/tour-mascots", adminTourMascotsRouter);
  ```
- **Развертывание на проде:** Смержено в `main` (`991a96c`), образ `stealthnet-api` пересобран и перезапущен на `vpn_bot` (`ghostnet.store`). Сервис здоров, `curl https://ghostnet.store/api/health` возвращает `{"status":"ok"}`.

### 4.16. Декомпозиция монолита настроек админки settings.tsx (PR #281, коммит `ef4b496`)
- **Фронтенд (Админка):** Проведен первый этап декомпозиции крупнейшего фронтенд-монолита `frontend/src/pages/settings.tsx`. Размер страницы сокращен с 6 459 до **3 891 строки** (−2 568 строк, **−40%**).
- **Выделены 2 изолированных компонента вкладок в `frontend/src/components/admin/settings/tabs/`:**
  - `payments-tab.tsx` (+1 392 строки): управление всеми платежными шлюзами (ЮKassa, ЮMoney, Platega, CryptoPay, Telegram Stars, Heleket, Lava, LavaTop, Overpay, RollyPay, ParityPay, CisPay, CloudPayments), автосписания, вебхуки, коллбэки и оферты Lava.top (`LavatopOffersBrowser`). Экспортирует константу `DEFAULT_PLATEGA_METHODS`.
  - `bot-tab.tsx` (+1 266 строк): все настройки Telegram бота с вложенными табами (Меню, Тексты, Эмодзи, Поведение, Ссылки), Drag-and-Drop сортировка кнопок (`BotButtonsList`, `SortableBotButtonCard`), типы и константы бота (`DEFAULT_BOT_*`, `BOT_EMOJI_*`, `BOT_STYLE_OPTIONS`, `BOT_BUTTON_HUMAN_NAMES`).
- **Подключение:** В `settings.tsx` гигантские секции заменены компактными вызовами:
  ```tsx
  <PaymentsTab settings={settings} setSettings={setSettings} saving={saving} token={token} message={message} autoRenewStats={autoRenewStats} handleSubmit={handleSubmit} />
  <BotTab settings={settings} setSettings={setSettings} saving={saving} message={message} saveBotMenu={saveBotMenu} botSubTab={botSubTab} setBotSubTab={setBotSubTab} />
  ```
- **Развертывание на проде:** Смержено в `main` (`ef4b496`), образ `stealthnet-frontend` пересобран на `vpn_bot` (`ghostnet.store`), обновлен том со статикой, Nginx перезагружен. Сервис здоров, `curl https://ghostnet.store/api/health` возвращает `{"status":"ok"}`.

### 4.17. Актуализация архитектурного руководства AGENTS.md (PR #282, коммит `4ce26bc`)
- **Документация репозитория:** Обновлен файл `AGENTS.md` в корне репозитория для полного соответствия современной модульной структуре:
  - Описаны 13 суб-роутеров `backend/src/modules/admin/` и провайдер `cispay/`.
  - Зафиксирована новая таблица `PaymentDelivery` и надежная выдача заказов `PaymentDeliveryService`.
  - Описана декомпозиция вкладок админки в `frontend/src/components/admin/settings/tabs/` (`payments-tab.tsx`, `bot-tab.tsx`).
  - Отражены lazy-loading клиентских страниц и отказ от GSAP в пользу `framer-motion`.
  - Описаны `bot/src/handlers/payment-gateways.ts` и `tariff-device-limit.ts`.
  - Добавлена команда `npm --prefix bot test` в чек-лист валидации.
- **Развертывание на проде:** Смержено в `main` (`4ce26bc`), запушено в форк и подтянуто на сервер `vpn_bot`.

### 4.18. Финализация декомпозиции settings.tsx (PR #283, коммит `26293d0`)
- **Фронтенд (Админка):** Проведен второй (завершающий) этап декомпозиции монолита `frontend/src/pages/settings.tsx`. Размер страницы сокращен с 3 891 до **2 083 строк** (за оба этапа: с исходных 6 459 до **2 083 строк**, суммарно вырезано **4 376 строк**, файл уменьшился на **68%**).
- **Выделены 5 новых изолированных компонентов вкладок в `frontend/src/components/admin/settings/tabs/`:**
  - `general-tab.tsx` (+825 строк): общие настройки панели, брендинг, валюты, языки, техобслуживание, блок 2FA. Экспортирует константы `FALLBACK_LANGS`, `LANG_NAMES`, `ALLOWED_CURRENCIES`.
  - `mail-telegram-tab.tsx` (+389 строк): настройки SMTP, отправка тестовых писем, ID чатов и бот уведомлений для администраторов.
  - `api-tab.tsx` (+392 строки): Remnawave API, бот-токен, тестирование/сброс токенов, менеджер вебхуков `BotWebhookManager`.
  - `referrals-tab.tsx` (+187 строк): настройки реферальной системы, процентов и лимитов выплат.
  - `gifts-tab.tsx` (+235 строк): настройки подарочных подписок и генерации кодов.
- **Подключение:** В `settings.tsx` вкладки подключены декларативно:
  ```tsx
  <GeneralTab settings={settings} setSettings={setSettings} saving={saving} message={message} installedLangCodes={installedLangCodes} totpEnabled={totpEnabled} openTwoFaEnable={openTwoFaEnable} openTwoFaDisable={openTwoFaDisable} />
  <MailTelegramTab settings={settings} setSettings={setSettings} saving={saving} message={message} token={token} admin={state.admin} />
  <ApiTab settings={settings} setSettings={setSettings} saving={saving} token={token} remnaTesting={remnaTesting} remnaTestResult={remnaTestResult} botTesting={botTesting} botTestResult={botTestResult} handleSubmit={handleSubmit} handleTestRemna={handleTestRemna} handleResetRemna={handleResetRemna} handleTestBot={handleTestBot} handleResetBotToken={handleResetBotToken} />
  <ReferralsTab settings={settings} setSettings={setSettings} saving={saving} message={message} />
  <GiftsTab settings={settings} setSettings={setSettings} saving={saving} message={message} handleSubmit={handleSubmit} />
  ```
- **Развертывание на проде:** Смержено в `main` (`26293d0`), образ `stealthnet-frontend` пересобран на `vpn_bot` (`ghostnet.store`), обновлен том со статикой, Nginx перезагружен. Сервис здоров, `curl https://ghostnet.store/api/health` возвращает `{"status":"ok"}`.

### 4.19. Декомпозиция клиентского API: Auth, Profile, Public Config (PR #284, коммит `6d934ad`)
- **Бэкенд (Клиент):** Начата декомпозиция крупнейшего монолита бэкенда `backend/src/modules/client/client.routes.ts`. Размер файла сокращен с 8 936 до **6 693 строк** (−2 243 строки, **−25%**).
- **Выделены 3 изолированных суб-роутера в `backend/src/modules/client/`:**
  - `client-auth.routes.ts` (+1 309 строк): вся аутентификация клиента (`clientAuthRouter` — регистрация, подтверждение email, логин, 2FA-логин, сброс пароля, Telegram-вход, Google OAuth, Apple OAuth, refresh token, сессии), хелпер `resolveBotForClientRequest` и утилиты валидации Telegram.
  - `client-profile.routes.ts` (+595 строк): профиль и безопасность клиента (`clientProfileRouter` — TOTP 2FA setup/confirm/disable, смена/установка пароля, онбординг, профиль, привязка Telegram и Email).
  - `client-public.routes.ts` (+363 строки): публичные эндпоинты (`publicConfigRouter` — доступность, динамический PWA-манифест, диплинки, привязка из бота, публичные тарифы VPN, прокси и Singbox). Реэкспортируется в `client.routes.ts` для сохранения совместимости.
- **Хелпер промокодов:** Функция `validatePromoCode` вынесена в `client.service.ts` для устранения циклических импортов между профильным роутером и сервисами.
- **Развертывание на проде:** Смержено в `main` (`6d934ad`), образ `stealthnet-api` пересобран на `vpn_bot` (`ghostnet.store`), контейнеры `api` и `broadcast-worker` перезапущены. Сервис здоров, `curl https://ghostnet.store/api/health` возвращает `{"status":"ok"}`.

### 4.20. Декомпозиция клиентского API: Referrals, Trials/Promo, Subscriptions, Tickets (PR #285, коммит `738dd40`)
- **Бэкенд (Клиент, Этап 2):** Продолжена декомпозиция `backend/src/modules/client/client.routes.ts`. Размер файла сокращен с 6 693 до **4 739 строк** (−1 954 строки, суммарно за 2 этапа с 8 936 до 4 739 строк, **−47%**).
- **Выделены 4 изолированных суб-роутера в `backend/src/modules/client/`:**
  - `client-referrals.routes.ts` (+246 строк): статистика рефералов (`/referral-stats`), создание и получение заявок на вывод (`/withdrawals`), валидация реквизитов карт и СБП (`normalizeCardDetails`, `normalizeSbpDetails`, `withdrawCreateSchema`).
  - `client-trials-promo.routes.ts` (+506 строк): бесплатные тесты и промокоды (`/trial`, `/trials/available`, `/trials/:id/activate`, `/promo/activate`, `/promo-code/check`, `/promo-code/activate`). Экспортируются функции `fetchAvailableTrialsForClient`, `extractCurrentExpireAt`, `calculateExpireAt`.
  - `client-subscriptions.routes.ts` (+986 строк): подписки и устройства (14 маршрутов: `/subscription`, `/subscription/by-uuid/:uuid`, `/subscription/all`, `/bot-bootstrap`, `/subscription/:id/name`, `/subscription/:id/cooldown`, `/subscriptions/cooldown-check`, перевыпуск ключей, автопродление, удаление доп. устройств, список и удаление HWID-устройств). Перенесена функция `resolveTariffDisplayName`.
  - `client-tickets.routes.ts` (+246 строк): клиентские обращения в поддержку (7 маршрутов: `/tickets`, `/tickets/unread-count`, `/tickets/:id`, сообщения с вложениями, смена статуса и блокировка удаления).
- **Middleware:** `requireRemnaOnline` вынесена в `client.middleware.ts` (+9 строк) и реэкспортируется из `client.routes.ts`.
- **Развертывание на проде:** Смержено в `main` (`738dd40`), образ `stealthnet-api` успешно пересобран и перезапущен на `vpn_bot` (`ghostnet.store`). Сервис здоров, `curl https://ghostnet.store/api/health` возвращает `{"status":"ok"}`.

### 4.21. Финализация декомпозиции клиентского API: Payments, AI Chat, Slots (PR #286, коммит `e692cf6`)
- **Бэкенд (Клиент, Финал):** Полностью завершена декомпозиция крупнейшего монолита бэкенда `backend/src/modules/client/client.routes.ts`. Размер файла сокращен с 4 739 до **76 строк** (−4 663 строки, **−98.4%**; суммарно с изначальных 8 936 до 76 строк, **−99.1%**). Теперь это лаконичный роутер-агрегатор.
- **Выделены 5 новых суб-роутеров и утилитный модуль в `backend/src/modules/client/`:**
  - `client-checkout.util.ts` (+130 строк): расчеты prorata для доп. устройств (`calculateDevicesProrataPriceCoefficient`, `calculateDevicesProrataPriceCoefficientForPrimary`, `resolveSubExpireAt`, `extractRemnaExpireAt`), конфигуратор гибкого тарифа `getCustomBuildConfig` и общая zod-схема платежей `heleketCreatePaymentSchema`.
  - `client-payments-balance.routes.ts` (+813 строк): внутренние оплаты (`/payments/balance`, `/custom-build/pay-balance`, `/payments/balance/option`).
  - `client-payments-fiat.routes.ts` (+1 460 строк): фиатные и рублевые шлюзы (Platega, YooMoney, YooKassa, CloudPayments, история платежей `/payments` и статус `/payments/:id/status`). Экспортирует публичный OAuth-обработчик `handleYoomoneyCallback`.
  - `client-payments-crypto.routes.ts` (+2 022 строки): криптовалютные и партнерские шлюзы (CryptoPay, Telegram Stars, Heleket, RollyPay, CisPay, ParityPay, Lava, LavaTop, Overpay).
  - `client-slots.routes.ts` (+93 строки): слоты прокси и singbox (`/proxy-slots`, `/singbox-slots`, `webClientRouter`).
  - `client-ai-chat.routes.ts` (+196 строк): AI-ассистент клиента (`POST /ai/chat`).
- **Middleware:** `requireRemnaPaymentOnline` перенесена в `client.middleware.ts` (+6 строк).
- **Завершение глобальной эпопеи «God files»:** Все 3 главных монолита проекта (`admin.routes.ts`: 8097→2922; `settings.tsx`: 6459→2083; `client.routes.ts`: 8936→76) полностью побеждены. Суммарно декомпозировано более 18 500 строк монолитного кода.
- **Развертывание на проде:** Смержено в `main` (`e692cf6`), образ `stealthnet-api` пересобран и перезапущен на `vpn_bot` (`ghostnet.store`). Сервис здоров, `curl https://ghostnet.store/api/health` возвращает `{"status":"ok"}`.

### 4.22. Устранение тройного дублирования покупки тарифов в темах кабинета (PR #287, коммиты `1b90350`, `b2fee4a`)
- **Фронтенд (Кабинет):** Устранено масштабное тройное дублирование логики оформления подписок и вызова платёжных шлюзов между темами Classic, Aurora и Stealth.
- **Новый хук:** Создан `frontend/src/pages/cabinet/use-cabinet-tariff-purchase.ts` (+879 строк), инкапсулирующий:
  - Загрузку тарифов, триалов, подписок и публичного конфига платежей (через `usePublicConfig()` напрямую, устраняя зависимость от контекст-провайдера в Stealth).
  - Выбор категории, тарифа, периода и доп. устройств с пересчетом скидок и цен за день (`applyExtrasPrice`).
  - Валидацию промокодов (`applyPromo`, `clearPromo`) и персональных скидок.
  - Продление (`?extend=<subId>`) и превью конвертации тарифов (`clientTariffConversionPreview`).
  - Единый `doPay` для всех 14 методов оплаты (включая списание с баланса и редиректы через `openPaymentInBrowser` / `onReadyUrl`).
- **Рефакторинг страниц тем:**
  - `client-tariffs.tsx`: сокращен на 708 строк (1 843 → 1 135).
  - `aurora-tariffs.tsx`: сокращен на 477 строк (1 064 → 587).
  - `stealth-tariffs.tsx`: сокращен на 440 строк (979 → 539).
  - Суммарно из трех тем удалено 1 625 строк дублирующегося кода (чистое сокращение кодовой базы: −349 строк).
- **Дополнительный аудит интерфейсов (коммит `b2fee4a`):**
  - В тему Stealth добавлен `autoSelectFirst: true` — теперь при открытии страницы сразу предвыбирается первая категория, первый тариф и стандартный период (30 дней), а тайлы цен и кнопка оплаты активны сразу (устранена проблема, когда при наличии одной категории пользователю было некуда кликнуть).
  - В `useCabinetTariffPurchase` устранена гонка между `extendParam` и `autoSelectFirst` при загрузке подписок.
  - `canPayWithBalance` скорректирован (`totalPrice > 0`), чтобы позволять оплату балансом при 100% скидке по промокоду (`finalPrice === 0`).
- **Развертывание на проде:** Смержено в `main`, образ `stealthnet-frontend` пересобран на `vpn_bot` (`ghostnet.store`), том `frontend_dist` обновлен, Nginx перезагружен. Сервис здоров, `curl https://ghostnet.store/api/health` возвращает `{"status":"ok"}`.

### 4.23. Проверка сессии клиента и динамические кнопки лендинга (PR #288, коммит `0904a72`)
- **Проблема:** При наличии активной сессии вход на `/cabinet/login` или `/cabinet/register` с лендинга показывал пустые формы логина/регистрации, а кнопки лендинга всегда предлагали «Войти» и «Подключиться».
- **Глобальный контекст:** `<ClientAuthProvider>` поднят в корневой `App()` вокруг `<AppRoutes />` в `frontend/src/App.tsx`; локальные обёртки убраны с `/cabinet/onboarding`, `/gift/:code` и `/cabinet`.
- **Маршрутный гард:** Добавлен `RequireAnonymousClient` в `App.tsx` (ожидает Mini App авторизацию через `miniappAuthLoading`, пропускает OAuth `#id_token`, при наличии токена редиректит в `returnTo` или `/cabinet/dashboard`). Защищены маршруты `login`, `register`, `forgot-password`.
- **Защитные эффекты:** В `client-login.tsx` и `client-register.tsx` добавлены эффекты редиректа в `/cabinet/dashboard` при наличии `state.token`.
- **Динамический лендинг:** В `landing-surface.tsx` подключен `useClientAuth()`. При наличии валидной сессии (`isAuthenticated`):
  - Кнопки шапки заменяются на «Личный кабинет» (`/cabinet`).
  - Основная кнопка Hero ведёт на `/cabinet` («В личный кабинет»), вторичная кнопка входа скрывается.
  - Кнопки тарифов и CTA переключаются на `/cabinet` («В кабинет»).
- **Развертывание на проде:** Влито в локальный `main`, запушено в `fork/main`, на сервере `vpn_bot` (`ghostnet.store`) пересобран контейнер фронтенда, обновлен том статики и перезагружен Nginx. Проверка `api/health` -> `{"status":"ok"}`.

### 4.24. Актуализация моделей Groq и динамическая подгрузка моделей AI (PR #289, коммит `ab75e45`)
- **Проблема:** Модели `llama3-8b-8192`, `llama3-70b-8192`, `mixtral-8x7b-32768` и др. сняты с поддержки Groq (`model_decommissioned`), из-за чего AI-чат падал с ошибкой обращения к API.
- **Обновление дефолтов:** Захардкоженный дефолт `llama3-8b-8192` заменён на актуальный `openai/gpt-oss-120b` в `client.service.ts`, `admin.routes.ts` и `client-ai-chat.routes.ts`.
- **Динамический загрузчик моделей:** В `admin.routes.ts` добавлен эндпоинт `POST /settings/groq-models`, запрашивающий `https://api.groq.com/openai/v1/models` через `proxyFetch` с `getProxyUrl("ai")` (гарантирует обход региональных блокировок Groq) и возвращающий только активные текстовые LLM.
- **Интерфейс настроек:** В `settings.tsx` добавлена кнопка «Загрузить модели из Groq», динамический список `availableModels` (актуальные дефолты + загруженные + сохранённые) для всех 4 селектов (основная модель и 3 fallback).
- **Развертывание на проде:** Смержено в `main`, запушено в `fork/main`, на `vpn_bot` (`ghostnet.store`) пересобраны и перезапущены контейнеры `stealthnet-api`, `stealthnet-broadcast-worker`, обновлён бандл `stealthnet-frontend` и перезагружен Nginx. Сервис здоров (`api/health` -> 200 OK).

### 4.25. Фикс отображения и лимитов триггера окончания подписки в минутах (PR #290, коммиты `9905fc9`, `4bcd286`)
- **Проблема:** В правилах авторассылки триггер «Подписка заканчивается скоро (за N минут)» (`subscription_ending_minutes`) в UI ошибочно отображал дни вместо минут («Через сколько дней (0–365)»), инпут зажимал значение до 365 (тогда как бэкенд разрешает до 10080 минут), а в списке правил писал «· через N дн.».
- **Решение в `frontend/src/pages/auto-broadcast.tsx`:**
  - Лейбл поля ввода исправлен на «За сколько минут до окончания (1–10080)».
  - Числовой инпут получил динамический диапазон `min`/`max`: для минут разрешено до 10 080 (7 дней), значение в `onChange` селекта клампится в `1..10080` (дефолт 15).
  - В карточке правила в списке правил добавлена ветка для минут: `«· за N мин. до окончания»`.
  - Добавлена понятная контекстная подсказка для минут под полем ввода.
- **Развертывание на проде:** Влито в локальный `main`, запушено в `fork/main`, на `vpn_bot` (`ghostnet.store`) пересобран контейнер фронтенда, обновлен том `frontend_dist` и перезагружен Nginx. Проверка `api/health` -> `{"status":"ok"}`.

### 4.26. Отображение лимита устройств в тарифах лендинга Studio (PR #291, коммиты `8746b56`, `324d585`)
- **Проблема:** На клиентском лендинге в карточках тарифов не отображалось количество устройств, даже если лимит был задан в админке (отображались только срок доступа и безлимит трафика).
- **Причина:** В актуальной модели тарифов `deviceLimit` является устаревшим полем (`null`), а лимит базовых устройств хранится в `includedDevices`. Компонент `landing-surface.tsx` проверял исключительно legacy-поле `t.deviceLimit`.
- **Решение в `frontend/src/components/landing-studio/landing-surface.tsx`:**
  - Добавлен модульный хелпер `const tariffDeviceLimit = (t: { deviceLimit?: number | null; includedDevices?: number | null }) => Math.max(t.deviceLimit ?? 0, t.includedDevices ?? 0);`.
  - Проверка и рендер в карточке тарифа переведены на `tariffDeviceLimit(t)` с подстановкой в шаблон `block.text.devicesLabel` («До {count} устройств»).
- **Развертывание на проде:** Влито в локальный `main`, запушено в `fork/main`. PR #291 создан в upstream-репозиторий `STEALTHNET-APP/remnawave-STEALTHNET-Bot` (1 файл, +2/-1, mergeable).

### 4.27. Добавление приложений STEALTHNET, INCY, актуализация Happ и интерактивный предпросмотр страницы подписки (PR #292, коммиты `ec35d76`, `e1f8031`, `a443df3`, `72540ad`)
- **Задачи:**
  1. Добавить официальное приложение STEALTHNET на страницу подписки для всех платформ (iOS, Android, macOS, Windows) с приоритетом ссылки на русский App Store (`https://apps.apple.com/ru/app/stealthnet/id6790923730`), добавлением глобального App Store (`https://apps.apple.com/us/app/stealthnet/id6790923730`) и протокола быстрого импорта `stealthnet://add/{{SUBSCRIPTION_LINK}}`.
  2. Актуализировать ссылки Happ: удалить неработающую ссылку на RU App Store (404) для iOS и macOS, оставить рабочую ссылку Global App Store (`https://apps.apple.com/us/app/happ-proxy-utility/id6504287215`) и добавить в описание предупреждение о необходимости иностранного Apple ID.
  3. Добавить приложение INCY (второе по популярности после Happ) для iOS, macOS и Android: рабочая ссылка на App Store Global (`https://apps.apple.com/us/app/incy/id6756943388`), предупреждение о недоступности в RU-регионе, ссылки на Google Play и GitHub releases, deep link импорта `incy://import/{{SUBSCRIPTION_LINK}}` и шаг подключения `incy://connect`.
  4. Внедрить интерактивный предпросмотр клиентской страницы подписки непосредственно в редакторе админ-панели (`Настройки` → `Сервис и кабинет` → `Страница подписки`).
- **Реализация:**
  - `backend/subpage-00000000-0000-0000-0000-000000000000.json`: Обновлены секции `ios`, `macos`, `android`, `windows` во всех 5 локалях (`en`, `ru`, `zh`, `fa`, `fr`). Добавлены STEALTHNET, INCY, обновлён Happ.
  - `frontend/src/lib/subscription-page.ts`: В дефолтную конфигурацию страницы подписки (`DEFAULT_SUBSCRIPTION_PAGE_CONFIG`) синхронизированы те же блоки для STEALTHNET, Happ и INCY.
  - `frontend/src/components/subscription-page-editor.tsx`: В панель инструментов редактора добавлена кнопка «Предпросмотр» и диалог `SubscriptionPagePreviewDialog`. Диалог эмулирует клиентскую страницу: поддерживает табы платформ, отображает интерактивную карточку с демо-ссылкой подписки (`https://vpn.example.com/sub/demo-preview-subscription`), список активных приложений и шаги подключения с подстановкой тестового URL в deep link.
- **Развертывание на проде:** Влито в локальный `main`, запушено в `fork/main`. PR #292 отправлен в upstream `STEALTHNET-APP/remnawave-STEALTHNET-Bot` (mergeable).

### 4.28. Официальный релиз 7.0.0 и принятие всех PR в upstream (коммиты 3d60d41..1bd48fc, тег `v7.0.0`)
- **Принятие всей очереди PR:** Все наши PR (`#275–#287`, `#288`, `#289`, `#290`, `#291`, `#292`) приняты и объединены в `origin/main`. В официальном чейнджлоге релиза 7.0.0 вынесена персональная благодарность zero011 за огромный вклад в проект.
- **Точечные полировки от мейнтейнера поверх наших PR:**
  1. **PR #292 (`subscription-page-editor.tsx`):**
     - Добавлен `useRef` для `initializedConfig` во избежание сброса состояния при повторных рендерах.
     - Экспортированы функции `parseConfigJson` и `mergeWithDefault` для unit-тестов.
     - Сохранение кастомных метаданных из `currentConfigJson` при `handleSubmit`.
  2. **PR #288 и PR #291 (`landing-surface.tsx`):**
     - Добавлен компонент `LandingAction` и хелпер `isCabinetAuthLink(href)`: динамическая замена на «Личный кабинет» применяется только к ссылкам `/cabinet/login` и `/cabinet/register`, исключая влияние на внешние или кастомные ссылки лендинга.
     - Исключено дублирование кнопок в шапке и Hero, если обе вели на вход.
  3. **PR #289 (`admin.routes.ts` — динамическая загрузка моделей Groq):**
     - Добавлен таймаут `AbortSignal.timeout(10_000)` на запрос к API Groq.
     - Добавлена информативная обработка кодов 401/403/429/504 без утечки внутренних данных.
     - Валидация длины ID моделей (`id.length <= 200`) и тесты в `backend/tests/groq-models.test.mjs`.
  4. **PR #287 (`use-cabinet-tariff-purchase.ts`):**
     - Улучшена обработка автовыбора первого тарифа и сохранение существующей подписки при повторном оформлении.
- **Ключевые фичи релиза 7.0.0:**
  - Тестовый режим HTML-виджетов в Telegram-боте (`botHtmlBubblesTest`) с отправкой отдельного сервисного сообщения для отката к обычному меню (персональный выбор каждого пользователя сохраняется в томе `bot_preferences`).
  - Новая платёжная система CisPay (RUB/USD, тестовые вебхуки, возвраты карт/СБП, партнёрская ставка 3.7%).
  - Поиск и разделы в настройках админки.
  - Возврат модуля «Мой Налог» (`nalog-tab.tsx`).
  - Миграции БД: реквизиты вывода СБП/карт (`20261106000000_withdrawal_sbp_and_card`) и таблица состояний выдачи заказов (`20261109090000_payment_delivery`).
  - Том `bot_preferences` и переменная `BOT_WIDGET_PREFERENCES_DIR` в `docker-compose.yml`.



---

## 5. 🛠 Инструкция по обновлению и деплою на боевой сервер

Стандартный регламент деплоя на `vpn_bot`:

```bash
# 1. Локально: подтянуть upstream и запушить в форк
git fetch origin
git merge --ff-only origin/main
git push fork main

# 2. На сервере: сохранить локальные настройки и обновить репозиторий
ssh vpn_bot
cd /opt/remnawave-STEALTHNET-Bot

# Сохраняем локальные конфиги
cp docker-compose.yml docker-compose.yml.local_backup
cp nginx/nginx.conf nginx/nginx.conf.local_backup

# Откатываем рабочую копию для чистого pull
git checkout -- docker-compose.yml nginx/nginx.conf

# Обновляем ветку main
git fetch origin
git merge --ff-only origin/main

# Восстанавливаем локальные конфиги
cp docker-compose.yml.local_backup docker-compose.yml
cp nginx/nginx.conf.local_backup nginx/nginx.conf

# Проверяем, что в git diff ТОЛЬКО наши локальные оверрайды (порт 127.0.0.1, домен ghostnet.store)
git diff

# 3. Пересборка Docker образов
docker compose build api bot frontend

# 4. Обновление статики фронтенда в volume
docker compose up --no-deps frontend

# 5. Перезапуск API, Bot и Broadcast Worker (API сам применит миграции Prisma при старте)
docker compose up -d --no-deps api broadcast-worker bot

# 6. Перезагрузка Nginx
docker compose exec nginx nginx -s reload

# 7. Проверка статуса сервисов
docker ps
docker logs --tail 30 stealthnet-api
docker logs --tail 30 stealthnet-bot
curl -s https://ghostnet.store/api/health
```

---

## 6. ⚠️ Строгие архитектурные правила и Gotchas

1. **Никаких лишних комментариев в коде:** По требованию владельца проекта, в новый TypeScript/JS код не следует добавлять пояснительные комментарии на русском или английском (сохранять только существующие необходимые jsdoc/типы).
2. **Безопасность портов:** Порт бэкенда `5000` в `docker-compose.yml` на боевом сервере ВСЕГДА должен быть привязан к `127.0.0.1:5000:5000`. Не публиковать наружу на `0.0.0.0`.
3. **Обработка вебхуков платежей:** Валидация и подтверждение поступления денег от банка/шлюза должны происходить независимо от доступности нод или API Remnawave. Факт оплаты фиксируется в БД, а выдача доступа гарантируется сервисом `PaymentDelivery`.
4. **Структура бота:** Не возвращать монолит в `bot/src/index.ts`! Любая новая логика или команды пишутся строго в отдельных модулях в `bot/src/handlers/`.
5. **Тестирование перед коммитом:**
   - Бот: `npm --prefix bot test` (должны проходить все 54+ тестов).
   - Бэкенд: `npm --prefix backend run build` (или проверка типов без emit через `./backend/node_modules/.bin/tsc`).
   - Фронтенд: `npm --prefix frontend run build`.

---

## 7. 💬 Шаблон для начала нового диалога

Скопируйте и вставьте это сообщение в первый запрос нового чата:

```text
Привет! Я продолжаю работу над проектом Remnawave-STEALTHNET-Bot. В корне репозитория есть файл PROJECT_CONTEXT.md — пожалуйста, прочитай его полностью перед началом работы. В нем описаны архитектура, все сделанные PR, доступы к боевому серверу vpn_bot (ghostnet.store) и правила разработки.
```
