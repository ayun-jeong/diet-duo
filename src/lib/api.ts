/**
 * API base URL
 * - Web (Vercel): "" (relative paths)
 * - Mobile (Capacitor): "https://diet-duo.vercel.app"
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
