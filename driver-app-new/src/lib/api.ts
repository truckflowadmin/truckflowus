/**
 * API client for the TruckFlowUS backend.
 * Handles JWT auth, base URL, and common request patterns.
 */
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'tf_driver_token';
const API_URL_KEY = 'tf_api_url';

// Default — overridden by the user during setup or from env
let baseUrl = 'https://truckflowus.com';

export async function setApiUrl(url: string) {
  baseUrl = url.replace(/\/$/, '');
  await SecureStore.setItemAsync(API_URL_KEY, baseUrl);
}

export async function getApiUrl(): Promise<string> {
  const stored = await SecureStore.getItemAsync(API_URL_KEY);
  if (stored) baseUrl = stored;
  return baseUrl;
}

// ---- Token management ----

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// ---- HTTP helpers ----

interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: any;
  noAuth?: boolean;
}

export async function apiFetch<T = any>(
  path: string,
  opts: FetchOptions = {},
): Promise<T> {
  await getApiUrl();
  const { body, noAuth, ...rest } = opts;

  const headers: Record<string, string> = {
    'X-Platform': 'mobile',
    ...(rest.headers as Record<string, string>),
  };

  if (!noAuth) {
    const token = await getToken();
    console.log(`[API] ${rest.method || 'GET'} ${path} | token=${token ? token.slice(0, 12) + '...' : 'NULL'}`);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } else {
    console.log(`[API] ${rest.method || 'GET'} ${path} | noAuth=true`);
  }

  // WORKAROUND: React Native on iOS + Vercel has a bug where POST requests
  // with a body hang indefinitely. Encode the JSON payload as base64 in the
  // X-Body header instead. The server reads from X-Body when present.
  if (body) {
    headers['X-Body'] = btoa(JSON.stringify(body));
  }

  const url = `${baseUrl}${path}`;

  let res: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    res = await fetch(url, {
      ...rest,
      headers,
      // No body — data goes in X-Body header to avoid iOS+Vercel hang
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch (networkErr: any) {
    const msg = networkErr.name === 'AbortError'
      ? 'Request timed out — check your connection'
      : (networkErr.message || 'Network error — check your connection');
    throw new ApiError(msg, 0, { networkError: true });
  }

  console.log(`[API] ${path} → status=${res.status}`);
  if (res.status === 401) {
    const body401 = await res.text().catch(() => '');
    console.log(`[API] 401 body: ${body401}`);
    // Only clear the token for authenticated requests (not login/noAuth calls).
    if (!noAuth) {
      await clearToken();
    }
    throw new AuthError('Session expired. Please log in again.');
  }

  let data: any;
  try {
    const text = await res.text();
    data = JSON.parse(text);
  } catch {
    throw new ApiError(
      `Server returned non-JSON response (${res.status})`,
      res.status,
      { rawStatus: res.status },
    );
  }

  if (!res.ok) {
    throw new ApiError(data.error || data.message || 'Request failed', res.status, data);
  }

  return data as T;
}

/**
 * Upload a file (photo, signature) via multipart form data.
 */
export async function apiUpload<T = any>(
  path: string,
  formData: FormData,
): Promise<T> {
  await getApiUrl();
  const token = await getToken();

  const headers: Record<string, string> = {
    'X-Platform': 'mobile',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${baseUrl}${path}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (res.status === 401) {
    await clearToken();
    throw new AuthError('Session expired. Please log in again.');
  }

  const data = await res.json();

  if (!res.ok) {
    throw new ApiError(data.error || data.message || 'Upload failed', res.status, data);
  }

  return data as T;
}

// ---- Error classes ----

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}
