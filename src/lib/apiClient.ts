const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export function apiUrl(path: string): string {
    return `${API_BASE}${path}`;
}
