/**
 * Открытие платёжных страниц. Ключевая задача — надёжно работать во всех средах:
 * iOS Safari (включая standalone PWA «Добавлено на экран «Домой»»),
 * iOS Telegram Mini App, Android Chrome/WebView, десктоп.
 *
 * Ключевые правила:
 *
 *  1. В Telegram Mini App используется WebApp.openLink(url, { try_instant_view: false, try_browser: true }) —
 *     клиент Telegram открывает ссылку во внешнем системном браузере (Chrome / Safari),
 *     где корректно работают Universal Links и Intent-диплинки банков (СБП).
 *
 *  2. Вне Mini App используется same-tab navigation — window.location.assign(url) / window.location.href = url.
 */

type TelegramWebAppMinimal = {
  initData?: string;
  platform?: string;
  openLink?: (url: string, options?: { try_instant_view?: boolean; try_browser?: boolean | string }) => void;
};

/**
 * Возвращает WebApp если пользователь запущен внутри Telegram Mini App.
 * Проверяем наличие объекта WebApp, функции openLink, а также признак Mini App:
 * непустой initData либо platform, отличный от unknown.
 */
export function getTelegramWebApp(): TelegramWebAppMinimal | null {
  if (typeof window === "undefined") return null;
  const raw = (window as {
    Telegram?: { WebApp?: false | TelegramWebAppMinimal };
  }).Telegram?.WebApp;
  if (!raw || typeof raw !== "object") return null;
  const webApp = raw as TelegramWebAppMinimal;
  if (typeof webApp.openLink !== "function") return null;

  const hasInitData = typeof webApp.initData === "string" && webApp.initData.trim().length > 0;
  const hasPlatform = typeof webApp.platform === "string" && webApp.platform !== "unknown";
  if (!hasInitData && !hasPlatform) return null;

  return webApp;
}

export function isTelegramWebApp(): boolean {
  return Boolean(getTelegramWebApp());
}

export type PaymentRedirect = {
  open: (url: string) => void;
  cancel: () => void;
};

export function preparePaymentRedirect(): PaymentRedirect {
  if (typeof window === "undefined") {
    return { open: () => undefined, cancel: () => undefined };
  }

  const webApp = getTelegramWebApp();
  if (webApp) {
    return {
      open: (url) => {
        try {
          webApp.openLink!(url, { try_instant_view: false, try_browser: true });
        } catch {
          window.location.assign(url);
        }
      },
      cancel: () => undefined,
    };
  }

  return {
    open: (url) => {
      try {
        window.location.assign(url);
      } catch {
        window.location.href = url;
      }
    },
    cancel: () => undefined,
  };
}

/**
 * Открытие платёжной страницы в системном браузере (или в текущей вкладке вне Mini App).
 */
export function openPaymentInBrowser(url: string): void {
  const redirect = preparePaymentRedirect();
  redirect.open(url);
}
