const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export function apiUrl(path: string): string {
    return `${API_BASE}${path}`;
}

/**
 * Returns true when a backend API URL is configured (e.g. Cloudflare Worker).
 * On static hosts like GitHub Pages with no NEXT_PUBLIC_API_BASE set, this returns false
 * and the app falls back to direct client-side calls for public APIs.
 */
export function hasBackend(): boolean {
    return API_BASE.length > 0;
}
