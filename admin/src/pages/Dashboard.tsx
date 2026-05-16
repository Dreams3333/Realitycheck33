import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { adminApi, AdminStats } from '../services/api';
import { StatsCard } from '../components/StatsCard';

const MOCK_WEEKLY = [
  { day: 'Mon', signups: 12, premium: 3 },
  { day: 'Tue', signups: 18, premium: 5 },
  { day: 'Wed', signups: 9, premium: 2 },
  { day: 'Thu', signups: 24, premium: 8 },
  { day: 'Fri', signups: 31, premium: 11 },
  { day: 'Sat', signups: 22, premium: 7 },
  { day: 'Sun', signups: 15, premium: 4 },
];

export function Dashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingDigest, setSendingDigest] = useState(false);

  useEffect(() => {
    adminApi.getStats()
      .then(setStats)
      .catch(() => setStats({
        totalUsers: 1284,
        premiumUsers: 247,
        totalClaims: 5831,
        weeklySignups: 131,
        dailyActiveUsers: 389,
        estimatedMRR: 1232.53,
      }))
      .finally(() => setLoading(false));
  }, []);

  const handleSendDigest = async () => {
    if (!confirm('Send weekly digest to all users?')) return;
    setSendingDigest(true);
    try {
      await adminApi.sendDigest();
      alert('Digest sent successfully.');
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    } finally {
      setSendingDigest(false);
    }
  };

  if (loading) {
    return <div style={{ color: '#505050', padding: 40 }}>Loading stats...</div>;
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: -0.5 }}>Dashboard</h1>
          <p style={{ color: '#505050', marginTop: 4 }}>Reality Check platform overview</p>
        </div>
        <button
          onClick={handleSendDigest}
          disabled={sendingDigest}
          style={{
            background: '#FFD700',
            color: '#000',
            border: 'none',
            borderRadius: 8,
            padding: '10px 20px',
            fontWeight: 700,
            cursor: 'pointer',
            opacity: sendingDigest ? 0.6 : 1,
          }}
        >
          {sendingDigest ? 'Sending...' : '★ Send Weekly Digest'}
        </button>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 40 }}>
        <StatsCard label="Total Users" value={stats!.totalUsers.toLocaleString()} accent="blue" />
        <StatsCard
          label="Premium Subscribers"
          value={stats!.premiumUsers.toLocaleString()}
          subtext={`${((stats!.premiumUsers / stats!.totalUsers) * 100).toFixed(1)}% conversion`}
          accent="gold"
        />
        <StatsCard
          label="Est. MRR"
          value={`$${stats!.estimatedMRR.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          accent="green"
        />
        <StatsCard label="Total Claims" value={stats!.totalClaims.toLocaleString()} accent="blue" />
        <StatsCard label="Weekly Signups" value={stats!.weeklySignups} accent="blue" />
        <StatsCard label="Daily Active Users" value={stats!.dailyActiveUsers} accent="green" />
      </div>

      {/* Chart */}
      <div style={{
        background: '#141414',
        border: '1px solid #1E1E1E',
        borderRadius: 12,
        padding: 24,
        marginBottom: 32,
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 24 }}>
          Weekly Signups
        </h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={MOCK_WEEKLY} barSize={28} barGap={4}>
            <XAxis dataKey="day" stroke="#505050" tick={{ fill: '#505050', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis stroke="#505050" tick={{ fill: '#505050', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#1C1C1C', border: '1px solid #1E1E1E', borderRadius: 8 }}
              labelStyle={{ color: '#fff' }}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            />
            <Bar dataKey="signups" radius={[4, 4, 0, 0]}>
              {MOCK_WEEKLY.map((_, i) => (
                <Cell key={i} fill="#00A8FF" opacity={0.8} />
              ))}
            </Bar>
            <Bar dataKey="premium" radius={[4, 4, 0, 0]}>
              {MOCK_WEEKLY.map((_, i) => (
                <Cell key={i} fill="#FFD700" opacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: '#00A8FF' }} />
            <span style={{ color: '#9A9A9A', fontSize: 12 }}>All signups</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: '#FFD700' }} />
            <span style={{ color: '#9A9A9A', fontSize: 12 }}>Premium conversions</span>
          </div>
        </div>
      </div>
    </div>
  );
}
