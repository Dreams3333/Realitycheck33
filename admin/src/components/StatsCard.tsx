import React from 'react';

interface StatsCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  accent?: 'blue' | 'gold' | 'green' | 'red';
}

const ACCENT_COLORS = {
  blue: '#00A8FF',
  gold: '#FFD700',
  green: '#00D68F',
  red: '#FF4444',
};

export function StatsCard({ label, value, subtext, accent = 'blue' }: StatsCardProps) {
  const color = ACCENT_COLORS[accent];
  return (
    <div style={{
      background: '#141414',
      border: `1px solid ${color}33`,
      borderRadius: 12,
      padding: '20px 24px',
      flex: 1,
      minWidth: 180,
      boxShadow: `0 0 20px ${color}11`,
    }}>
      <div style={{ color: '#505050', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ color, fontSize: 36, fontWeight: 900, lineHeight: 1 }}>
        {value}
      </div>
      {subtext && (
        <div style={{ color: '#606060', fontSize: 12, marginTop: 6 }}>{subtext}</div>
      )}
    </div>
  );
}
