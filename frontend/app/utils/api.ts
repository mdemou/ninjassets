import type { ApiResponse } from '~/types';
import { createObjectUrlCache } from '~/utils/objectUrlCache';

const BASE_URL = '';

function throwApiError(res: Response, data: ApiResponse): never {
  const message = data.message ?? 'Request failed';
  const err = new Error(message) as Error & { code?: string; statusCode?: number };
  err.code = data.code;
  err.statusCode = res.status;
  throw err;
}

function getHeaders(): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as ApiResponse<T>;
  if (!res.ok) throwApiError(res, data as ApiResponse);
  return data;
}

function authHeader(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Upload a raw binary body (e.g. an image blob). Content-Type is taken from the blob. */
async function uploadBinary<T>(method: string, path: string, blob: Blob): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { ...authHeader(), 'Content-Type': blob.type },
    body: blob,
  });
  const data = (await res.json()) as ApiResponse<T>;
  if (!res.ok) throwApiError(res, data as ApiResponse);
  return data;
}

/** POST a JSON body and read the response as a binary Blob (e.g. a generated PDF). */
export async function postForBlob(path: string, body?: unknown): Promise<Blob> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let data: ApiResponse = {} as ApiResponse;
    try {
      data = (await res.json()) as ApiResponse;
    } catch {
      // Non-JSON error body; fall through with empty data.
    }
    throwApiError(res, data);
  }
  const blob: Blob = await res.blob();
  return blob;
}

async function fetchBlob(path: string): Promise<Blob | null> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, { headers: authHeader(), cache: 'no-store' });
    if (!res.ok) return null;
    return res.blob();
  } catch {
    return null;
  }
}

const objectUrlCache = createObjectUrlCache(fetchBlob);

/** Fetch an authenticated binary resource as a cached object URL (deduped per path). */
function fetchObjectUrl(path: string): Promise<string | null> {
  return objectUrlCache.acquireObjectUrl(path);
}

function releaseObjectUrl(path: string): void {
  objectUrlCache.releaseObjectUrl(path);
}

export interface ApiClient {
  get: <T = undefined>(path: string) => Promise<ApiResponse<T>>;
  post: <T = undefined>(path: string, body?: unknown) => Promise<ApiResponse<T>>;
  patch: <T = undefined>(path: string, body?: unknown) => Promise<ApiResponse<T>>;
  delete: <T = undefined>(path: string, body?: unknown) => Promise<ApiResponse<T>>;
  upload: <T = undefined>(path: string, blob: Blob) => Promise<ApiResponse<T>>;
  postForBlob: (path: string, body?: unknown) => Promise<Blob>;
  fetchObjectUrl: (path: string) => Promise<string | null>;
  releaseObjectUrl: (path: string) => void;
}

export const api: ApiClient = {
  get: <T = undefined>(path: string) => request<T>('GET', path),
  post: <T = undefined>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T = undefined>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T = undefined>(path: string, body?: unknown) => request<T>('DELETE', path, body),
  upload: <T = undefined>(path: string, blob: Blob) => uploadBinary<T>('POST', path, blob),
  postForBlob,
  fetchObjectUrl,
  releaseObjectUrl,
};
