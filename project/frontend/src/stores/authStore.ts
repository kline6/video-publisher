import { create } from 'zustand';
import { User } from '@/types';
import { authApi } from '@/services';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: JSON.parse(localStorage.getItem('videoflow_user') || 'null'),
  token: localStorage.getItem('videoflow_token'),
  isAuthenticated: !!localStorage.getItem('videoflow_token'),
  isLoading: false,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const res = await authApi.login({ email, password });
      const payload = res.data?.data ?? res.data;
      const token: string | undefined = payload?.token;
      const user: User | undefined = payload?.user;

      if (!token || !user) {
        throw new Error('登录失败：服务器返回数据异常');
      }

      localStorage.setItem('videoflow_token', token);
      localStorage.setItem('videoflow_user', JSON.stringify(user));
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (username, email, password) => {
    set({ isLoading: true });
    try {
      const res = await authApi.register({ username, email, password });
      const payload = res.data?.data ?? res.data;
      const token: string | undefined = payload?.token;
      const user: User | undefined = payload?.user;

      if (!token || !user) {
        throw new Error('注册失败：服务器返回数据异常');
      }

      localStorage.setItem('videoflow_token', token);
      localStorage.setItem('videoflow_user', JSON.stringify(user));
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('videoflow_token');
    localStorage.removeItem('videoflow_user');
    set({ user: null, token: null, isAuthenticated: false });
  },

  loadUser: async () => {
    try {
      const res = await authApi.getProfile();
      const user = res.data?.data ?? res.data;
      set({ user });
      localStorage.setItem('videoflow_user', JSON.stringify(user));
    } catch {
      localStorage.removeItem('videoflow_token');
      localStorage.removeItem('videoflow_user');
      set({ user: null, token: null, isAuthenticated: false });
    }
  },
}));
