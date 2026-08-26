import { ACTIONS } from "./config"
import { safe } from "./text"
import { OtzariaParams, RawToolParams } from "./types"

function tryParseJson(value: any): any | null {
  if (value == null) return null
  if (typeof value === "object") return value
  if (typeof value !== "string") return null
  const text = value.trim()
  if (!text) return null
  try {
    const parsed = JSON.parse(text)
    if (typeof parsed === "string") return tryParseJson(parsed) ?? parsed
    return parsed
  } catch {
    return null
  }
}

function mergeObject(target: Record<string, any>, source: any) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined && value !== null && value !== "" && target[key] === undefined) {
      target[key] = value
    }
  }
}

function hasMeaningfulInput(out: Record<string, any>): boolean {
  return Boolean(
    out.action || out.query || out.ref || out.reference || out.text || out.search ||
    out.lineId || out.bookId || out.lineIndex || out.connectionType || out.direction || out.dbPath
  )
}

export function normalizeToolParams(raw: RawToolParams | any): OtzariaParams {
  const out: Record<string, any> = {}

  if (typeof raw === "string") {
    const parsed = tryParseJson(raw)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) mergeObject(out, parsed)
    else if (raw.trim()) out.query = raw.trim()
  }

  if (raw && typeof raw === "object" && !Array.isArray(raw)) mergeObject(out, raw)

  const nestedKeys = [
    "tool_arguments", "toolArguments", "arguments", "args", "input", "payload", "params", "json", "command"
  ]
  for (const key of nestedKeys) {
    const nested = raw && typeof raw === "object" ? (raw as any)[key] : null
    const parsed = tryParseJson(nested)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) mergeObject(out, parsed)
  }

  // Normalize aliases BEFORE action inference.
  if (!out.query && out.text) out.query = out.text
  if (!out.query && out.search) out.query = out.search
  if (!out.ref && out.reference) out.ref = out.reference

  if (!out.action) {
    const commandText = safe(out.command || raw?.command).trim()
    if (ACTIONS.includes(commandText)) out.action = commandText
  }

  if (!out.action && hasMeaningfulInput(out)) {
    if (out.ref) out.action = "read_ref"
    else if (out.lineId && (out.direction || out.connectionType)) out.action = "get_links"
    else if (out.lineId) out.action = "read_context"
    else if (out.bookId) out.action = "get_toc"
    else if (out.query) out.action = "search"
  }

  return out as OtzariaParams
}

export function describeParams(params: OtzariaParams): string {
  const action = safe(params.action)
  if (action === "search") return `חיפוש: ${safe(params.query)}`
  if (action === "read_ref") return `קריאת מראה מקום: ${safe(params.ref || params.query)}`
  if (action === "read_context") return `הקשר סביב lineId=${safe(params.lineId)} bookId=${safe(params.bookId)} lineIndex=${safe(params.lineIndex)}`
  if (action === "find_book") return `איתור ספר: ${safe(params.query)}`
  if (action === "get_links") return `קישורים עבור lineId=${safe(params.lineId)}`
  if (action === "get_toc") return `תוכן עניינים עבור bookId=${safe(params.bookId)} query=${safe(params.query)}`
  if (action === "db_status") return "בדיקת סטטוס מסד הנתונים"
  return `פעולה: ${action}`
}
