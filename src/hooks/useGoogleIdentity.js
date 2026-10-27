// hooks/useGoogleIdentity.js

import { useEffect, useRef, useState, useCallback } from 'react';

const GIS_SRC = 'https://accounts.google.com/gsi/client';

let scriptLoadPromise = null;
let initialized = false;

function loadGisScript() {
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve(window.google);
      return;
    }
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google));
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

/**
 * @param {(response: { credential: string }) => void} onCredential
 *   Called once with the GIS ID token when the user signs in.
 */
export function useGoogleIdentity(onCredential) {
  const [ready, setReady] = useState(false);
  const callbackRef = useRef(onCredential);
  callbackRef.current = onCredential; // always call the latest callback

  useEffect(() => {
    let cancelled = false;

    loadGisScript().then((google) => {
      if (cancelled) return;

      if (!initialized) {
        google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: (response) => callbackRef.current?.(response),
          auto_select: false,        
          use_fedcm_for_prompt: true, 
          itp_support: true,        
        });
        initialized = true;
      }
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  /** Renders the standard Google button into the given DOM node. */
  const renderButton = useCallback((container, options = {}) => {
    if (!ready || !container || !window.google) return;
    // Clear first — prevents duplicate buttons on re-render.
    container.innerHTML = '';
    window.google.accounts.id.renderButton(container, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      width: Math.max(200, Math.min(400, Math.floor(container.parentElement?.clientWidth || container.clientWidth || 320))),
      text: 'continue_with',
      ...options,
    });
  }, [ready]);

  /** Optional: trigger One Tap. Safe to call multiple times. */
  const promptOneTap = useCallback(() => {
    if (!ready || !window.google) return;
    window.google.accounts.id.prompt();
  }, [ready]);

  return { ready, renderButton, promptOneTap };
}