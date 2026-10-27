const KEY = 'wh_return_path';

export function saveReturnPath(path = window.location.pathname + window.location.search) {
  if (
    !path ||
    path.startsWith('/login') ||
    path.startsWith('/register') ||
    path.startsWith('/admin-login')
  ) {
    return;
  }
  // relative paths only — no open redirects
  if (!path.startsWith('/') || path.startsWith('//')) return;

  localStorage.setItem(KEY, path);
}

export function consumeReturnPath(fallback = '/') {
  const path = localStorage.getItem(KEY);
  localStorage.removeItem(KEY);

  if (!path || !path.startsWith('/') || path.startsWith('//')) {
    return fallback;
  }
  if (
    path.startsWith('/login') ||
    path.startsWith('/register') ||
    path.startsWith('/admin-login')
  ) {
    return fallback;
  }
  return path;
}

export function peekReturnPath() {
  return localStorage.getItem(KEY);
}