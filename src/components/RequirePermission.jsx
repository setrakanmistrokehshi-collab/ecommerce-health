// src/components/admin/RequirePermission.jsx
//
// Use for routes that need a SPECIFIC permission, beyond just
// being an admin. Wrap individual admin routes that should be
// restricted to certain staff roles.
//
// Usage in App.jsx:
//   <Route element={<RequirePermission need="products.delete" />}>
//     <Route path="admin/products/:id/delete" element={<DeleteProductPage/>} />
//   </Route>

import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '@/context/authStore';

export default function RequirePermission({ need, needAny }) {
  const { user, isHydrated } = useAuthStore();

  if (!isHydrated) return <LoadingScreen/>;

  const permissions = user?.permissions ?? [];
  const isSuperAdmin = user?.role === 'super_admin';

  let allowed = isSuperAdmin;

  if (!allowed && need) {
    const required = Array.isArray(need) ? need : [need];
    allowed = required.every(p => permissions.includes(p));
  }

  if (!allowed && needAny) {
    const required = Array.isArray(needAny) ? needAny : [needAny];
    allowed = required.some(p => permissions.includes(p));
  }

  if (!allowed) return <Navigate to="/admin" replace />;

  return <Outlet />;
}
