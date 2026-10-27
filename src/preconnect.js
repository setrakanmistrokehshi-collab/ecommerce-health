// utils/preconnect.js
// Only run on client-side, uses environment variables

export function setupPreconnect() {
  if (typeof window === 'undefined') return;
  
  const apiUrl = import.meta.env.VITE_API_BASE_URL;
  if (!apiUrl) return;
  
  // Extract domain from API URL (safe)
  try {
    const url = new URL(apiUrl);
    const domain = url.origin;
    
    // Only preconnect if it's a public domain (not localhost in production)
    if (domain.includes('localhost') && import.meta.env.PROD) {
      return;
    }
    
    // Dynamically add preconnect link
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = domain;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
    
    console.log(`🔗 Preconnected to: ${domain}`);
  } catch (e) {
    // Silently fail - not critical
  }
}