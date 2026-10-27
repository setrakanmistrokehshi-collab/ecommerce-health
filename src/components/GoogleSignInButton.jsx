// components/GoogleSignInButton.jsx
//
// Matches your actual auth response shape: { success, accessToken,
// refreshToken, user } in the JSON body — not a cookie. This component
// does NOT decide what to do with those tokens; it hands the whole
// payload to onSuccess so you can feed it into whatever already
// consumes /login's response (your Zustand auth store). Using the
// same code path both places is what avoids a second, parallel state
// path — which is the kind of gap that caused the Zustand rehydration
// race you dealt with before.

import { useEffect, useRef, useState } from 'react';
import { useGoogleIdentity } from '../hooks/useGoogleIdentity';

const API_BASE = import.meta.env.VITE_API_BASE_URL; 

export default function GoogleSignInButton({ onSuccess, onError }) {
  const buttonRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);

  const handleCredential = async (response) => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || data.errors?.[0]?.msg || 'Google sign-in failed.');
      }

      // Hand off { accessToken, refreshToken, user } to the same
      // handler your password login already uses to populate the
      // Zustand store — do not fork the logic here.
      onSuccess?.(data);
    } catch (err) {
      onError?.(err);
    } finally {
      setSubmitting(false);
    }
  };

  const { ready, renderButton } = useGoogleIdentity(handleCredential);

  useEffect(() => {
    if (!ready || !buttonRef.current) return undefined;

    const container = buttonRef.current;
    const wrapper = container.parentElement;
    let lastWidth = 0;
    const renderResponsiveButton = () => {
      const availableWidth = wrapper?.clientWidth || container.clientWidth || 320;
      const width = Math.max(200, Math.min(400, Math.floor(availableWidth)));
      if (width === lastWidth) return;
      lastWidth = width;
      renderButton(container, { width });
    };

    renderResponsiveButton();
    const observer = new ResizeObserver(renderResponsiveButton);
    if (wrapper) observer.observe(wrapper);
    return () => observer.disconnect();
  }, [ready, renderButton]);

  return (
    <div style={{ width: '100%', minWidth: 0 }}>
      <div ref={buttonRef} aria-busy={submitting} style={{ width: '100%', minWidth: 0 }} />
      {submitting && <p style={{ fontSize: 13, opacity: 0.7 }}>Signing you in…</p>}
    </div>
  );
}