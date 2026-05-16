const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY || '';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': ADMIN_KEY,
      ...(options.headers as Record<string, string> || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data as T;
}

export interface AdminStats {
  totalUsers: number;
  premiumUsers: number;
  totalClaims: number;
  weeklySignups: number;
  dailyActiveUsers: number;
  estimatedMRR: number;
}

export interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  tier: string;
  checks_used_today: number;
  created_at: string;
}

export interface AdminClaim {
  id: string;
  text: string;
  category: string;
  heat_score: number;
  status: string;
  view_count: number;
  created_at: string;
  submitted_by_name: string;
  perspective_count: number;
  comment_count: number;
}

export const adminApi = {
  getStats: () => request<AdminStats>('/admin/stats'),
  getUsers: (page = 1) =>
    request<{ users: AdminUser[]; total: number; page: number }>(`/admin/users?page=${page}`),
  getClaims: (page = 1) =>
    request<{ claims: AdminClaim[]; total: number; page: number }>(`/admin/claims?page=${page}`),
  sendDigest: () => request<{ message: string }>('/admin/digest', { method: 'POST' }),
  deleteClaim: (id: string) => request<{ message: string }>(`/admin/claims/${id}`, { method: 'DELETE' }),
};
