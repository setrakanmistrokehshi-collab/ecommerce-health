import OneSignal from 'react-onesignal';

const appId = import.meta.env.VITE_ONESIGNAL_APP_ID?.trim();
let initializationPromise;
let initializationReady = false;
let loginPromise;
let pendingExternalId;
let activeExternalId;

function isSupported() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  return !isIOSInstallRequired();
}

function canUsePush() {
  return Boolean(appId) && isSupported();
}

function registerDebugListeners() {
  if (!import.meta.env.DEV) return;

  OneSignal.Notifications.addEventListener('permissionChange', (granted) => {
    console.debug('[OneSignal] Notification permission changed:', granted);
  });

  OneSignal.User.PushSubscription.addEventListener('change', ({ current }) => {
    console.debug('[OneSignal] Push subscription changed:', current.optedIn);
  });
}

export function initPush() {
  if (!canUsePush()) return Promise.resolve(false);
  if (!initializationPromise) {
    initializationPromise = OneSignal.init({
      appId,
      autoRegister: false,
      path: '/',
      serviceWorkerPath: '/OneSignalSDKWorker.js',
    }).then(() => {
      initializationReady = true;
      registerDebugListeners();
      return true;
    }).catch((error) => {
      console.error('[OneSignal] Initialization failed.', error);
      return false;
    });
  }
  return initializationPromise;
}

export function isPushConfigured() {
  return Boolean(appId);
}

export function isIOSInstallRequired() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isInstalled = navigator.standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches === true;
  return isIOS && !isInstalled;
}

export function loginPush(userId) {
  const externalId = String(userId ?? '').trim();
  if (!canUsePush() || !externalId || externalId === 'undefined' || externalId === 'null') {
    return Promise.resolve(false);
  }
  if (activeExternalId === externalId) return Promise.resolve(true);
  if (loginPromise && pendingExternalId === externalId) return loginPromise;

  pendingExternalId = externalId;
  loginPromise = (async () => {
    if (!await initPush()) return false;
    if (activeExternalId === externalId) return true;
    await OneSignal.login(externalId);
    activeExternalId = externalId;
    return true;
  })().catch((error) => {
    console.error('[OneSignal] Login failed.', error);
    return false;
  }).finally(() => {
    if (pendingExternalId === externalId) {
      pendingExternalId = null;
      loginPromise = null;
    }
  });

  return loginPromise;
}

export async function logoutPush() {
  if (!canUsePush()) return false;
  try {
    if (loginPromise) await loginPromise;
    if (!await initPush()) return false;
    await OneSignal.logout();
    activeExternalId = null;
    return true;
  } catch (error) {
    console.error('[OneSignal] Logout failed.', error);
    return false;
  }
}

export function requestPushPermission() {
  if (!canUsePush() || !initializationReady) return Promise.resolve('unsupported');
  try {
    return OneSignal.Notifications.requestPermission()
      .then(() => getPushPermissionState())
      .catch((error) => {
        console.error('[OneSignal] Permission request failed.', error);
        return getPushPermissionState();
      });
  } catch (error) {
    console.error('[OneSignal] Permission request failed.', error);
    return Promise.resolve(getPushPermissionState());
  }
}

export function getPushPermissionState() {
  if (!canUsePush()) return 'unsupported';
  return window.Notification.permission;
}