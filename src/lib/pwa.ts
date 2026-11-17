// Web-only helpers for running Societree as an installed app (PWA).
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';
const DISMISS_KEY = 'societree.install-dismissed';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();

if (isWeb) {
  // Chrome/Edge/Android fire this when the app can be installed.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

/** Register the service worker (production web builds only). */
export function registerServiceWorker() {
  if (!isWeb || __DEV__ || !('serviceWorker' in navigator)) return;
  const register = () => navigator.serviceWorker.register('/sw.js').catch(() => {});
  // The app bundle often runs after the page's load event has already fired.
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

function isStandalone() {
  return isWeb && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
}

function isAndroid() {
  return isWeb && /Android/i.test(navigator.userAgent);
}

function isIOS() {
  if (!isWeb) return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * What install help to show on the web:
 *  - 'prompt': the browser can install it in one tap (Android/Chrome/Edge)
 *  - 'ios': iPhone/iPad, so explain Share → Add to Home Screen
 *  - 'android': Android but no install prompt (e.g. opened inside WhatsApp), so explain Chrome's menu
 *  - null: computer, native app, already installed, or dismissed
 */
export function useInstallOffer() {
  const [, force] = useState(0);
  const [dismissed, setDismissed] = useState(readDismissed);

  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const kind: 'prompt' | 'ios' | 'android' | null =
    !isWeb || dismissed || isStandalone() ? null : deferred ? 'prompt' : isIOS() ? 'ios' : isAndroid() ? 'android' : null;

  return {
    kind,
    install: async () => {
      if (!deferred) return;
      await deferred.prompt();
      await deferred.userChoice.catch(() => null);
      deferred = null;
      force((n) => n + 1);
    },
    dismiss: () => {
      try {
        localStorage.setItem(DISMISS_KEY, '1');
      } catch {
        // private mode: just hide it for this visit
      }
      setDismissed(true);
    },
  };
}
