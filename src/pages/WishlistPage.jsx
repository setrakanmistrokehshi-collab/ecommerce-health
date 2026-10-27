// WishlistPage.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { users as usersApi } from '@/api/client';
import useAuthStore from '@/context/authStore';
import { ProductCard, PageLoader, EmptyState } from '@/components/ui';
import { Heart } from 'lucide-react';

export function WishlistPage() {
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    usersApi.getProfile()
      .then(({ data }) => setItems(data.user.wishlist || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  return (
    <div style={{ padding: 'var(--space-8) 0 var(--space-16)' }}>
      <div className='container'>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, marginBottom: 'var(--space-8)', color: 'var(--forest)' }}>
          My Wishlist ({items.length})
        </h1>
        {items.length === 0 ? (
          <EmptyState
            icon={Heart}
            title='Your wishlist is empty'
            message='Save products you love by tapping the heart icon on any product.'
            action={<Link to='/products' className='btn btn-primary'>Browse Products</Link>}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-5)' }}>
            {items.map((p, i) => <ProductCard key={p._id || i} product={p} delay={i * 60} />)}
          </div>
        )}
      </div>
    </div>
  );
}

export default WishlistPage;
