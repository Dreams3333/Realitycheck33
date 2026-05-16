import React, { useEffect, useState } from 'react';
import { adminApi, AdminClaim } from '../services/api';

function HeatBadge({ score }: { score: number }) {
  const color = score >= 70 ? '#FFD700' : score >= 35 ? '#FF8C00' : '#00A8FF';
  const label = score >= 70 ? 'Hot' : score >= 35 ? 'Contested' : 'Low';
  return (
    <span style={{
      background: `${color}18`,
      color,
      border: `1px solid ${color}`,
      borderRadius: 20,
      padding: '2px 10px',
      fontSize: 11,
      fontWeight: 700,
    }}>
      {score} · {label}
    </span>
  );
}

export function Claims() {
  const [claims, setClaims] = useState<AdminClaim[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = (p: number) => {
    setLoading(true);
    adminApi.getClaims(p)
      .then((data) => { setClaims(data.claims); setTotal(data.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(page); }, [page]);

  const handleDelete = async (id: string, text: string) => {
    if (!confirm(`Delete claim?\n\n"${text.slice(0, 80)}..."`)) return;
    setDeleting(id);
    try {
      await adminApi.deleteClaim(id);
      setClaims((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1300 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#fff' }}>Claims</h1>
        <p style={{ color: '#505050', marginTop: 4 }}>{total.toLocaleString()} total claims</p>
      </div>

      <div style={{ background: '#141414', border: '1px solid #1E1E1E', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1E1E1E' }}>
              {['Claim', 'Category', 'Heat', 'Status', 'Views', 'Submitted', ''].map((h) => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#505050', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#505050' }}>Loading...</td></tr>
            ) : claims.map((claim) => (
              <tr key={claim.id} style={{ borderBottom: '1px solid #1A1A1A' }}>
                <td style={{ padding: '12px 16px', color: '#fff', fontSize: 13, maxWidth: 360 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {claim.text}
                  </div>
                  <div style={{ color: '#505050', fontSize: 11, marginTop: 2 }}>
                    by {claim.submitted_by_name} · {claim.perspective_count} perspectives · {claim.comment_count} comments
                  </div>
                </td>
                <td style={{ padding: '12px 16px', color: '#9A9A9A', fontSize: 12, whiteSpace: 'nowrap' }}>
                  {claim.category}
                </td>
                <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                  <HeatBadge score={claim.heat_score} />
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    color: claim.status === 'processed' ? '#00D68F' : claim.status === 'failed' ? '#FF4444' : '#FF8C00',
                    fontSize: 12,
                    fontWeight: 600,
                  }}>
                    {claim.status}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', color: '#9A9A9A', fontSize: 13 }}>
                  {Number(claim.view_count).toLocaleString()}
                </td>
                <td style={{ padding: '12px 16px', color: '#505050', fontSize: 12, whiteSpace: 'nowrap' }}>
                  {new Date(claim.created_at).toLocaleDateString()}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <button
                    onClick={() => handleDelete(claim.id, claim.text)}
                    disabled={deleting === claim.id}
                    style={{
                      background: 'rgba(255,68,68,0.1)',
                      border: '1px solid #FF444433',
                      color: '#FF4444',
                      borderRadius: 6,
                      padding: '4px 10px',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {deleting === claim.id ? '...' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={paginationBtnStyle(page === 1)}>
          ← Prev
        </button>
        <span style={{ color: '#505050', fontSize: 13, padding: '6px 12px' }}>Page {page}</span>
        <button onClick={() => setPage((p) => p + 1)} disabled={claims.length < 50} style={paginationBtnStyle(claims.length < 50)}>
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
