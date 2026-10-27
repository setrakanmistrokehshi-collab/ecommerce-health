// EXAMPLE PATCH for src/pages/admin/ProductList.jsx
// Shows how to conditionally render buttons based on permissions.
// Apply this pattern to your other admin pages (Orders, Customers, Reviews, Settings).

import usePermission from '../../hooks/usePermission';
import { PERMISSIONS } from '../../hooks/permissions';

// Inside the ProductList component, add:
const { can } = usePermission();

// Then wrap the "Add Product" button:
{can(PERMISSIONS.PRODUCTS_CREATE) && (
  <button className="btn btn-primary" onClick={() => navigate('/admin/products/add')}>
    + Add Product
  </button>
)}

// Wrap the Edit button:
{can(PERMISSIONS.PRODUCTS_UPDATE) && (
  <button className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: 11 }}
    onClick={() => navigate(`/admin/products/edit/${p._id}`)}>
    Edit
  </button>
)}

// Wrap the Delete button:
{can(PERMISSIONS.PRODUCTS_DELETE) && (
  <button className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: 11, color: 'var(--danger)', borderColor: 'rgba(255,77,109,.3)' }}
    onClick={() => setConfirmDelete(p)}>
    Delete
  </button>
)}

// ─────────────────────────────────────────────────────────────────
// Same pattern applies everywhere:
//
// Orders.jsx     → can(PERMISSIONS.ORDERS_UPDATE) around the status dropdown
// Reviews.jsx    → can(PERMISSIONS.REVIEWS_MODERATE) around Approve/Reject buttons
// Settings.jsx   → can(PERMISSIONS.SETTINGS_UPDATE) around the Save button
// Customers.jsx  → can(PERMISSIONS.CUSTOMERS_DELETE) around any delete action
// AdminLayout.jsx → can(PERMISSIONS.STAFF_MANAGE) to show/hide the "Admin Roles" nav link
// ─────────────────────────────────────────────────────────────────
