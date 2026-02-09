'use client';

let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
    try {
        const response = await fetch('/api/auth/refresh', { method: 'POST' });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Client-side fetch wrapper that retries once on 401 by calling /api/auth/refresh.
 * Dedupes concurrent refresh attempts.
 */
export async function fetchWithRefresh(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const response = await fetch(input, init);
    if (response.status !== 401) {
        return response;
    }

    if (!refreshPromise) {
        refreshPromise = refreshSession().finally(() => {
            refreshPromise = null;
        });
    }

    const refreshed = await refreshPromise;
    if (!refreshed) {
        return response;
    }

    return fetch(input, init);
}

