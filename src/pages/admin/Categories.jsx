// src/pages/admin/Categories.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { admin as adminApi } from '@/api/client';
import toast from 'react-hot-toast';

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newCategory, setNewCategory] = useState('');
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      // ✅ FIXED: Use getAdminCategories for admin view
      const { data } = await adminApi.getAdminCategories(true);
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleAdd = async () => {
    if (!newCategory.trim()) {
      toast.error('Category name is required');
      return;
    }
    try {
      // ✅ FIXED: Use createCategory endpoint
      await adminApi.createCategory({ name: newCategory });
      toast.success('Category added successfully');
      setNewCategory('');
      fetchCategories();
    } catch (error) {
      console.error('Error adding category:', error);
      toast.error(error?.response?.data?.message || 'Failed to add category');
    }
  };

  const handleEdit = (category) => {
    setEditing(category._id);
    setEditName(category.name);
  };

  const handleUpdate = async (id) => {
    if (!editName.trim()) {
      toast.error('Category name is required');
      return;
    }
    try {
      // ✅ FIXED: Use updateCategory endpoint
      await adminApi.updateCategory(id, { name: editName });
      toast.success('Category updated successfully');
      setEditing(null);
      setEditName('');
      fetchCategories();
    } catch (error) {
      console.error('Error updating category:', error);
      toast.error(error?.response?.data?.message || 'Failed to update category');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    try {
      // ✅ FIXED: Use deleteCategory endpoint
      await adminApi.deleteCategory(id);
      toast.success('Category deleted successfully');
      fetchCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error(error?.response?.data?.message || 'Failed to delete category');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-muted)' }}>
        Loading categories...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--admin-text)', marginBottom: 4 }}>
          Categories
        </h1>
        <p style={{ color: 'var(--admin-muted)', fontSize: 14 }}>
          Manage product categories
        </p>
      </div>

      {/* Add Category */}
      <div className="admin-card" style={{ padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <input
            className="admin-input"
            placeholder="Enter category name..."
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
            style={{ flex: 1 }}
          />
          <button
            className="btn btn-primary"
            onClick={handleAdd}
            style={{
              padding: '8px 20px',
              background: 'var(--sage)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Add Category
          </button>
        </div>
      </div>

      {/* Categories List */}
      <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Products</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--admin-muted)' }}>
                  No categories found
                </td>
              </tr>
            ) : (
              categories.map((category) => (
                <tr key={category._id}>
                  <td>
                    {editing === category._id ? (
                      <input
                        className="admin-input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleUpdate(category._id)}
                        style={{ width: '100%' }}
                      />
                    ) : (
                      <span style={{ fontWeight: 500 }}>{category.name}</span>
                    )}
                  </td>
                  <td style={{ color: 'var(--admin-muted)', fontSize: 13 }}>
                    {category.slug || '—'}
                  </td>
                  <td style={{ color: 'var(--admin-muted)', fontSize: 13 }}>
                    {category.productCount || 0}
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      background: category.isActive ? 'rgba(122,158,126,0.15)' : 'rgba(248,113,113,0.15)',
                      color: category.isActive ? '#7a9e7e' : '#f87171',
                    }}>
                      {category.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {editing === category._id ? (
                        <>
                          <button
                            onClick={() => handleUpdate(category._id)}
                            style={{
                              padding: '3px 8px',
                              background: 'rgba(122,158,126,0.1)',
                              color: '#7a9e7e',
                              border: 'none',
                              borderRadius: 4,
                              cursor: 'pointer',
                              fontSize: 12,
                            }}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditing(null)}
                            style={{
                              padding: '3px 8px',
                              background: 'rgba(248,113,113,0.1)',
                              color: '#f87171',
                              border: 'none',
                              borderRadius: 4,
                              cursor: 'pointer',
                              fontSize: 12,
                            }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEdit(category)}
                            style={{
                              padding: '3px 8px',
                              background: 'rgba(74,133,200,0.1)',
                              color: '#4a85c8',
                              border: 'none',
                              borderRadius: 4,
                              cursor: 'pointer',
                              fontSize: 12,
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(category._id)}
                            style={{
                              padding: '3px 8px',
                              background: 'rgba(248,113,113,0.1)',
                              color: '#f87171',
                              border: 'none',
                              borderRadius: 4,
                              cursor: 'pointer',
                              fontSize: 12,
                            }}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}