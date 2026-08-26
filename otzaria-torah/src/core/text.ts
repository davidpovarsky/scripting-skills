export function safe(value: any): string {
  if (value == null) return ""
  try { return String(value) } catch { return "[unprintable]" }
}

export function joinPath(base: string, name: string): string {
  return safe(base).replace(/\/+$/, "") + "/" + safe(name).replace(/^\/+/, "")
}

export function clampInt(value: any, fallback: number, min: number, max: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.floor(n)))
}

export function boolValue(value: any, fallback: boolean): boolean {
  if (typeof value === "boolean") return value
  const text = safe(value).trim().toLowerCase()
  if (["true", "1", "yes", "y", "כן"].includes(text)) return true
  if (["false", "0", "no", "n", "לא"].includes(text)) return false
  return fallback
}

export function stripHtml(text: any): string {
  return safe(text)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&quot;", `"`)
    .replaceAll("&apos;", `'`)
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replace(/\s+/g, " ")
    .trim()
}

export function stripHebrewMarks(text: any): string {
  return safe(text).replace(/[\u0591-\u05C7]/g, "")
}

export function normalizeHebrewForSearch(text: any): string {
  return stripHebrewMarks(text)
    .replaceAll("־", " ")
    .replaceAll("״", "")
    .replaceAll("׳", "")
    .replace(/[ך]/g, "כ")
    .replace(/[ם]/g, "מ")
    .replace(/[ן]/g, "נ")
    .replace(/[ף]/g, "פ")
    .replace(/[ץ]/g, "צ")
    .replace(/\s+/g, " ")
    .trim()
}

export function truncate(value: any, max = 650): string {
  const text = safe(value).replace(/\s+/g, " ").trim()
  return text.length > max ? text.slice(0, max) + "…" : text
}

export function qString(value: string) {
  return `'${safe(value).replace(/'/g, "''")}'`
}

export function toJson(value: any): string {
  try { return JSON.stringify(value, null, 2) } catch { return safe(value) }
}
