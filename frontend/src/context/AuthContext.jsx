import { createContext, useSyncExternalStore } from 'react';
import { sessionStore } from '../services/sessionStore.js';
import { authApi } from '../services/auth.js';

export const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const session = useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot);
  async function login(fields) { sessionStore.setSession((await authApi.login(fields)).data); }
  async function register(fields) {
    await authApi.register(fields);
    sessionStore.clear('Account created successfully. Please sign in.');
  }
  async function logout() {
    const token = sessionStore.getSnapshot().token;
    await authApi.logout();
    if (sessionStore.getSnapshot().token === token) sessionStore.clear('You have signed out of all devices.');
  }
  async function refreshProfile() {
    const token = sessionStore.getSnapshot().token;
    const { data } = await authApi.me();
    sessionStore.updateUser(data.user, token);
  }
  async function updateProfile(fields) {
    const token = sessionStore.getSnapshot().token;
    const { data } = await authApi.updateProfile(fields);
    sessionStore.updateUser(data.user, token);
  }
  async function changePassword(fields) {
    const token = sessionStore.getSnapshot().token;
    await authApi.changePassword(fields);
    if (sessionStore.getSnapshot().token === token) sessionStore.clear('Password updated. Please sign in with your new password.');
  }
  return <AuthContext.Provider value={{ ...session, login, register, logout, refreshProfile, updateProfile, changePassword }}>{children}</AuthContext.Provider>;
}
