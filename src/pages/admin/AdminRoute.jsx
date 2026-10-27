// src/components/admin/AdminRoute.jsx
// Wraps all /admin routes. Redirects to /login if no token,
// or to / if user is not an admin.

import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../context/authStore'
export default function AdminRoute({ children }) {
  // Adjust this to match your actual auth store/context.
  // If you use Zustand: import { useAuthStore } from '../../stores/authStore'
  // If you use Context: import { useAuth } from '../../context/AuthContext'
  const token = useAuthStore.getItem('vc_access');
  let user = null;

  try {
    // Decode role from JWT payload (middle segment) without a library
    const payload = token ? JSON.parse(atob(token.split('.')[1])) : null;
    user = payload;
  } catch {
    // malformed token
  }

  if (!token)                    return <Navigate to="/login"  replace />;
  if (user?.role !== 'admin')    return <Navigate to="/"       replace />;

  return children;
}
