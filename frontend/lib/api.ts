'use client';

import { getSupabaseBrowserClient } from './supabase';

const apiUrl = process.env.NEXT_PUBLIC_API_URL;

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!apiUrl) {
    throw new Error('NEXT_PUBLIC_API_URL must be set');
  }

  const {
    data: { session },
  } = await getSupabaseBrowserClient().auth.getSession();

  if (!session?.access_token) {
    throw new Error('You must be signed in to continue');
  }

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${session.access_token}`);
  if (!(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers,
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      payload?.message ?? payload?.error ?? `Request failed (${response.status})`,
    );
  }

  return payload as T;
}
