import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

function getBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  // Android emulator routes host machine's localhost through 10.0.2.2
  if (Platform.OS === 'android') return 'http://10.0.2.2:3000/api';
  return 'http://localhost:3000/api';
}

const BASE_URL = getBaseUrl();

async function getToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem('auth_token');
    }
    return await SecureStore.getItemAsync('auth_token');
  } catch {
    return null;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> || {}),
    },
  });

  const data = await response.json().catch(() => ({ message: 'Request failed' }));

  if (!response.ok) {
    throw new Error(data.message || `HTTP ${response.status}`);
  }

  return data as T;
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),
  post: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};

export const stripeApi = {
  createCheckout: () =>
    request<{ url: string }>('/stripe/create-checkout', { method: 'POST', body: '{}' }),
  createPortal: () =>
    request<{ url: string }>('/stripe/create-portal', { method: 'POST', body: '{}' }),
};

export const authApi = {
  me: () => request<import('@/constants/types').User>('/auth/me'),
};
