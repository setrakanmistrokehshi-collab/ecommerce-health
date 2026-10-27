// src/config/autoLogout.js
export const AUTO_LOGOUT_CONFIG = {
  // Change this value to adjust auto-logout time (in minutes)
  minutes: 13, // 👈 Change this number directly
  
  // Warn user 1 minute before logout
  warningThreshold: 60, // seconds
  
  // Check interval for visibility
  checkInterval: 1000, // milliseconds
};