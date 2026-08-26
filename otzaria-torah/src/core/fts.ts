import { normalizeHebrewForSearch, safe } from "./text"

function hasFtsSyntax(query: string): boolean {
  return /\bAND\b|\bOR\b|\bNOT\b|["*()+\-:^]/.test(query)
}

function quoteFtsPhrase(query: string): string {
  return `"${query.replaceAll(`"`, `""`)}"`
}

function tokenParts(query: string): string[] {
  return normalizeHebrewForSearch(query).split(/\s+/).map(t => t.trim()).filter(t => t.length > 1)
}

export function buildFtsAttempts(query: string) {
  const raw = safe(query).trim()
  const normalized = normalizeHebrewForSearch(raw)
  const tokens = tokenParts(raw)
  const attempts: { label: string; match: string }[] = []

  if (raw) attempts.push({ label: "raw", match: raw })
  if (normalized && normalized !== raw) attempts.push({ label: "normalized", match: normalized })
  if (!hasFtsSyntax(raw) && tokens.length > 1) {
    attempts.push({ label: "and", match: tokens.join(" AND ") })
    attempts.push({ label: "phrase", match: quoteFtsPhrase(tokens.join(" ")) })
  }
  if (!hasFtsSyntax(raw) && tokens.length === 1 && tokens[0].length >= 3) {
    attempts.push({ label: "prefix", match: `${tokens[0]}*` })
  }

  const seen = new Set<string>()
  return attempts.filter(a => a.match && !seen.has(a.match) && seen.add(a.match)).slice(0, 5)
}
