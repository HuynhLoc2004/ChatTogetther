import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axiosClient from '../api/axiosClient';

const AuthContext = createContext(null);

const STORAGE_KEYS = {
  PROFILE: 'user_profile',
  USER_ID: 'user_id',
  ACCOUNT: 'account',
  USERNAME: 'username',
  NICKNAME: 'nickname',
  AVATAR: 'user_avatar',
  TOKEN: 'accesstoken'
};

const normalizeUser = (u) => {
  if (!u) return null;
  const id = u.id || u.userId || null;
  const account = u.account || u.username || '';
  const nickname = u.nickname || u.displayName || account || '';
  const avatar = u.avatar || u.avatarUrl || '';
  return {
    ...u,
    id: id ? (isNaN(id) ? id : Number(id)) : null,
    account,
    username: account,
    nickname,
    displayName: nickname,
    avatar,
    avatarUrl: avatar,
    personalFrequency: u.personalFrequency || null,
    vipTier: u.vipTier || 'MEMBER',
    roles: Array.isArray(u.roles) ? u.roles : []
  };
};

const loadInitialUser = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROFILE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed) return normalizeUser(parsed);
    }
  } catch (_) {}

  const id = localStorage.getItem(STORAGE_KEYS.USER_ID);
  const account = localStorage.getItem(STORAGE_KEYS.ACCOUNT) || localStorage.getItem(STORAGE_KEYS.USERNAME);
  const nickname = localStorage.getItem(STORAGE_KEYS.NICKNAME) || account;
  const avatar = localStorage.getItem(STORAGE_KEYS.AVATAR) || localStorage.getItem('avatar');

  if (id || account) {
    return normalizeUser({ id, account, nickname, avatar });
  }
  return null;
};

export const AuthProvider = ({ children }) => {
  // Snapshot khởi tạo tức thì từ localStorage (0ms delay khi chuyển route)
  const [currentUser, setCurrentUser] = useState(loadInitialUser);
  const [loading, setLoading] = useState(false);

  // Đồng bộ snapshot vào localStorage
  const syncToStorage = useCallback((user) => {
    if (!user) {
      localStorage.removeItem(STORAGE_KEYS.PROFILE);
      localStorage.removeItem(STORAGE_KEYS.USER_ID);
      localStorage.removeItem(STORAGE_KEYS.ACCOUNT);
      localStorage.removeItem(STORAGE_KEYS.USERNAME);
      localStorage.removeItem(STORAGE_KEYS.NICKNAME);
      localStorage.removeItem(STORAGE_KEYS.AVATAR);
      return;
    }
    const normalized = normalizeUser(user);
    try {
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(normalized));
    } catch (_) {}
    if (normalized.id) localStorage.setItem(STORAGE_KEYS.USER_ID, String(normalized.id));
    if (normalized.account) {
      localStorage.setItem(STORAGE_KEYS.ACCOUNT, normalized.account);
      localStorage.setItem(STORAGE_KEYS.USERNAME, normalized.account);
    }
    if (normalized.nickname) localStorage.setItem(STORAGE_KEYS.NICKNAME, normalized.nickname);
    if (normalized.avatar) {
      localStorage.setItem(STORAGE_KEYS.AVATAR, normalized.avatar);
      localStorage.setItem('avatar', normalized.avatar);
    }
  }, []);

  // Cập nhật thông tin người dùng tức thời
  const updateCurrentUser = useCallback((updates) => {
    setCurrentUser(prev => {
      const merged = normalizeUser({ ...prev, ...updates });
      syncToStorage(merged);
      return merged;
    });
  }, [syncToStorage]);

  // Làm mới hồ sơ người dùng âm thầm từ server
  const refreshProfile = useCallback(async () => {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    if (!token) return null;
    try {
      setLoading(true);
      const res = await axiosClient.get('/users/profile');
      const u = res?.data?.data;
      if (u) {
        const normalized = normalizeUser(u);
        setCurrentUser(normalized);
        syncToStorage(normalized);
        return normalized;
      }
    } catch (_) {
    } finally {
      setLoading(false);
    }
    return null;
  }, [syncToStorage]);

  // Đăng xuất toàn diện
  const logout = useCallback(() => {
    setCurrentUser(null);
    syncToStorage(null);
    localStorage.clear();
    sessionStorage.clear();
  }, [syncToStorage]);

  // Khi mount, nếu có token thì đồng bộ profile mới nhất từ server trong background
  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    if (token) {
      refreshProfile();
    }
  }, [refreshProfile]);

  return (
    <AuthContext.Provider value={{
      currentUser,
      setCurrentUser,
      updateCurrentUser,
      refreshProfile,
      logout,
      loading,
      isAuthenticated: Boolean(currentUser && (currentUser.id || currentUser.account))
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
