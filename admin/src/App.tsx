import React, { useState } from 'react';
import { Dashboard } from './pages/Dashboard';
import { Users } from './pages/Users';
import { Claims } from './pages/Claims';

type Page = 'dashboard' | 'users' | 'claims';

const NAV_ITEMS: { id: Page; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '◈' },
  { id: 'users', label: 'Users', icon: '◉' },
  { id: 'claims', label: 'Claims', icon: '⬡' },
];

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0A0A0A', color: '#fff' }}>
      {/* Sidebar */}
      <nav style={{
        width: 220,
        background: '#0D0D0D',
        borderRight: '1px solid #1E1E1E',
        padding: '32px 0',
        flexShrink: 0,
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: 0,
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ paddingLeft: 24, paddingBottom: 32 }}>
          <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 1, color: '#fff' }}>
            REALITY <span style={{ color: '#00A8FF' }}>CHECK</span>
          </div>
          <div style={{ fontSize: 10, color: '#303030', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 4 }}>
            Admin
          </div>
        </div>

        <div style={{ flex: 1 }}>
          {NAV_ITEMS.map((item) => {
            const isActive = page === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  padding: '12px 24px',
                  background: isActive ? 'rgba(0, 168, 255, 0.08)' : 'transparent',
                  border: 'none',
                  borderLeft: isActive ? '2px solid #00A8FF' : '2px solid transparent',
                  color: isActive ? '#00A8FF' : '#505050',
                  fontSize: 14,
                  fontWeight: isActive ? 700 : 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid #1E1E1E' }}>
          <div style={{ color: '#303030', fontSize: 11 }}>v1.0.0</div>
        </div>
      </nav>

      {/* Content */}
      <main style={{ marginLeft: 220, flex: 1, minHeight: '100vh' }}>
        {page === 'dashboard' && <Dashboard />}
        {page === 'users' && <Users />}
        {page === 'claims' && <Claims />}
      </main>
    </div>
  );
}
