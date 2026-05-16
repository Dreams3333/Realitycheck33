import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { api } from './api';
import { User } from '@/constants/types';

export interface LoginResponse {
  user: User;
  token: string;
}

const storage = {
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  async delete(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  },
};

export const authService = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const data = await api.post<LoginResponse>('/auth/login', { email, password });
    await storage.set('auth_token', data.token);
    return data;
  },

  async register(
    email: string,
    password: string,
    displayName: string,
    startTrial = false
  ): Promise<LoginResponse> {
    const data = await api.post<LoginResponse>('/auth/register', {
      email,
      password,
      displayName,
      startTrial,
    });
    await storage.set('auth_token', data.token);
    return data;
  },

  async googleSignIn(idToken: string): Promise<LoginResponse> {
    const data = await api.post<LoginResponse>('/auth/google', { idToken });
    await storage.set('auth_token', data.token);
    return data;
  },

  async getMe(): Promise<User> {
    return api.get<User>('/auth/me');
  },

  async logout(): Promise<void> {
    await storage.delete('auth_token');
  },

  async getStoredToken(): Promise<string | null> {
    try {
      return await storage.get('auth_token');
    } catch {
      return null;
    }
  },

  async hasCompletedOnboarding(): Promise<boolean> {
    try {
      const val = await storage.get('onboarding_complete');
      return val === 'true';
    } catch {
      return false;
    }
  },

  async setOnboardingComplete(): Promise<void> {
    await storage.set('onboarding_complete', 'true');
  },
};
