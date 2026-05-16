import React, { useEffect, useState } from 'react';
import { adminApi, AdminUser } from '../services/api';

export function Users() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    adminApi.getUsers(page)
      .then((data) => { setUsers(data.users); setTotal(data.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  const filtered = users.filter(
    (u) => u.email.includes(search) || u.display_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#fff' }}>Users</h1>
          <p style={{ color: '#505050', marginTop: 4 }}>{total.toLocaleString()} total</p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users..."
          style={{
            background: '#141414',
            border: '1px solid #1E1E1E',
            borderRadius: 8,
            color: '#fff',
            padding: '8px 14px',
            fontSize: 14,
            outline: 'none',
            width: 240,
          }}
        />
      </div>

      <div style={{ background: '#141414', border: '1px solid #1E1E1E', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1E1E1E' }}>
              {['Name', 'Email', 'Tier', 'Checks Today', 'Joined'].map((h) => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#505050', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#505050' }}>Loading...</td></tr>
            ) : filtered.map((user) => (
              <tr key={user.id} style={{ borderBottom: '1px solid #1A1A1A' }}>
                <td style={{ padding: '12px 16px', color: '#fff', fontSize: 14 }}>{user.display_name}</td>
                <td style={{ padding: '12px 16px', color: '#9A9A9A', fontSize: 13 }}>{user.email}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    background: user.tier === 'premium' ? 'rgba(255,215,0,0.1)' : 'rgba(0,168,255,0.1)',
                    color: user.tier === 'premium' ? '#FFD700' : '#00A8FF',
                    border: `1px solid ${user.tier === 'premium' ? '#FFD700' : '#00A8FF'}`,
                    borderRadius: 20,
                    padding: '2px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}>
                    {user.tier}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', color: '#9A9A9A', fontSize: 13 }}>{user.checks_used_today}</td>
                <td style={{ padding: '12px 16px', color: '#505050', fontSize: 12 }}>
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          style={paginationBtnStyle(page === 1)}
        >
          ← Prev
        </button>
        <span style={{ color: '#505050', fontSize: 13, padding: '6px 12px' }}>Page {page}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={users.length < 50}
          style={paginationBtnStyle(users.length < 50)}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

function paginationBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    background: '#141414',
    border: '1px solid #1E1E1E',
    borderRadius: 8,
    color: disabled ? '#303030' : '#9A9A9A',
    padding: '6px 14px',
    fontSize: 13,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}
