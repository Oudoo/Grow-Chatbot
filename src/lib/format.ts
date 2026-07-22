// Stable, locale/timezone-independent formatting so server and client render
// identically (avoids React hydration mismatches).

export function formatDateTime(iso: string): string {
  if (!iso) return "";
  return iso.slice(0, 16).replace("T", " ");
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}
