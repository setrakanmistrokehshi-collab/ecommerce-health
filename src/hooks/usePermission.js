// src/hooks/usePermission.js
//
// Usage in any component:
//   const { can, canAny } = usePermission();
//   if (can('products.delete')) { ... }
//
//   <button disabled={!can('products.delete')}>Delete</button>

import useAuthStore from '@/context/authStore';

export default function usePermission() {
  const user = useAuthStore((s) => s.user);

  const permissions = user?.permissions ?? [];
  const role        = user?.role;

  /** Returns true if user has ALL of the given permissions */
  const can = (...required) => {
    if (role === 'super_admin') return true;
    return required.every(p => permissions.includes(p));
  };

  /** Returns true if user has AT LEAST ONE of the given permissions */
  const canAny = (...required) => {
    if (role === 'super_admin') return true;
    return required.some(p => permissions.includes(p));
  };

  return { can, canAny, permissions, role };
}
