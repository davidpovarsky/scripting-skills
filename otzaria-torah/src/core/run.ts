import { closeDb, openOtzariaDb } from "../db/connection"
import { safe } from "./text"
import { OtzariaParams, OtzariaProgressHandler, ToolEnvelope } from "./types"
import { searchAction } from "./search"
import { readContextAction, readRefAction } from "./refs"
import { findBookAction } from "./books"
import { getLinksAction } from "./links"
import { getTocAction } from "./toc"
import { dbStatusAction } from "./status"

function emit(onProgress: OtzariaProgressHandler | undefined, event: Parameters<OtzariaProgressHandler>[0]) {
  try { onProgress?.(event) } catch {}
}

export async function runOtzariaAction(
  params: OtzariaParams,
  onProgress?: OtzariaProgressHandler
): Promise<ToolEnvelope> {
  let db: any = null
  let dbPath: string | null = null
  const action = safe(params.action || inferAction(params))

  try {
    emit(onProgress, {
      phase: "start",
      title: "מתחיל פעולה באוצריא",
      detail: action ? `פעולה: ${action}` : "מנסה לזהות פעולה",
      action
    })

    emit(onProgress, {
      phase: "opening_db",
      title: "פותח מסד נתונים",
      detail: params.dbPath ? safe(params.dbPath) : "מחפש seforim.db / seforim.dp בתיקיות Scripting",
      action
    })

    const opened = await openOtzariaDb(params.dbPath)
    db = opened.db
    dbPath = opened.dbPath

    emit(onProgress, {
      phase: "db_opened",
      title: "מסד הנתונים נפתח",
      detail: dbPath || "",
      action,
      dbPath
    })

    emit(onProgress, {
      phase: "action_start",
      title: "מריץ פעולה",
      detail: action,
      action,
      dbPath
    })

    let result: any

    if (action === "search") result = await searchAction(db, params, onProgress)
    else if (action === "read_ref") result = await readRefAction(db, params)
    else if (action === "read_context") result = await readContextAction(db, params)
    else if (action === "find_book") result = await findBookAction(db, params)
    else if (action === "get_links") result = await getLinksAction(db, params)
    else if (action === "get_toc") result = await getTocAction(db, params)
    else if (action === "db_status") result = await dbStatusAction(db, params, dbPath)
    else throw new Error(`Unknown action: ${action}`)

    emit(onProgress, {
      phase: "action_complete",
      title: "הפעולה הסתיימה",
      detail: Array.isArray(result?.results) ? `נמצאו ${result.results.length} תוצאות` : "התקבלה תוצאה",
      action,
      dbPath,
      resultCount: Array.isArray(result?.results) ? result.results.length : undefined,
      results: Array.isArray(result?.results) ? result.results : undefined
    })

    return { tool: "otzaria_torah", action, dbPath, result }
  } catch (error) {
    emit(onProgress, {
      phase: "error",
      title: "שגיאה באוצריא",
      detail: safe(error),
      error: safe(error),
      action,
      dbPath
    })
    throw error
  } finally {
    await closeDb(db)
  }
}

export function inferAction(params: OtzariaParams): string {
  if (params.ref) return "read_ref"
  if (params.lineId) return "read_context"
  if (params.bookId) return "get_toc"
  if (params.query) return "search"
  return ""
}
