import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Keychain/Keystore key for the JWT. SecureStore keys allow [A-Za-z0-9._-].
const TOKEN_KEY = 'batchfit.auth.token';

// SecureStore has no web implementation, so fall back to localStorage there to
// keep `expo start --web` usable in development. On device this is the OS
// keychain (iOS) / keystore-backed store (Android).
const webStorage = () => (typeof localStorage !== 'undefined' ? localStorage : null);

export async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') return webStorage()?.getItem(TOKEN_KEY) ?? null;
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    webStorage()?.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function deleteToken(): Promise<void> {
  if (Platform.OS === 'web') {
    webStorage()?.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
