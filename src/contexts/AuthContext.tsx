import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserPreference } from '../types';
import { ApiService } from '../services/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, confirmPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUserPreferencesState: (preferences: UserPreference) => void;
  updateUserProfileState: (updatedFields: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Check initial session from HttpOnly cookie
  const refreshUser = useCallback(async () => {
    try {
      setIsLoading(true);
      const userData = await ApiService.getMe();
      setUser(userData);
      setError(null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    setError(null);
    try {
      const { user: loggedInUser } = await ApiService.login({ email, password });
      setUser(loggedInUser);
    } catch (err: any) {
      const msg = err.message || 'Erro ao realizar login.';
      setError(msg);
      throw err;
    }
  };

  const register = async (
    username: string,
    email: string,
    password: string,
    confirmPassword: string
  ) => {
    setError(null);
    try {
      const { user: registeredUser } = await ApiService.register({
        username,
        email,
        password,
        confirmPassword,
      });
      setUser(registeredUser);
    } catch (err: any) {
      const msg = err.message || 'Erro ao realizar cadastro.';
      setError(msg);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await ApiService.logout();
    } finally {
      setUser(null);
    }
  };

  const updateUserPreferencesState = (preferences: UserPreference) => {
    if (user) {
      setUser({ ...user, preferences });
    }
  };

  const updateUserProfileState = (updatedFields: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...updatedFields });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        error,
        login,
        register,
        logout,
        refreshUser,
        updateUserPreferencesState,
        updateUserProfileState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
