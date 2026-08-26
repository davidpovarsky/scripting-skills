import { DEFAULT_LIMIT, MAX_SEARCH_LIMIT } from "./config"
import { buildFtsAttempts } from "./fts"
import { toLine } from "./line"
import { boolValue, clampInt, safe } from "./text"
import { OtzariaParams, OtzariaProgressHandler } from "./types"

function emit(onProgress: OtzariaProgressHandler | undefined, event: Parameters<OtzariaProgressHandler>[0]) {
  try { onProgress?.(event) } catch {}
}

export async function searchAction(
  db: any,
  params: OtzariaParams,
  onProgress?: OtzariaProgressHandler
) {
  const query = safe(params.query).trim()
  if (!query) throw new Error("חסר query לפעולת search")

  const limit = clampInt(params.limit, DEFAULT_LIMIT, 1, MAX_SEARCH_LIMIT)
  const heRefOnly = boolValue(params.heRefOnly, true)
  const attempts = buildFtsAttempts(query)
  const seen = new Set<number>()
  const results: any[] = []
  const attemptSummaries: any[] = []

  emit(onProgress, {
    phase: "search_prepare",
    title: "מכין חיפוש FTS",
    detail: `נבנו ${attempts.length} ניסיונות חיפוש עבור: ${query}`,
    action: "search",
    query,
    resultCount: 0,
    results: []
  })

  for (let index = 0; index < attempts.length; index++) {
    const attempt = attempts[index]
    emit(onProgress, {
      phase: "search_attempt_start",
      title: "מריץ ניסיון חיפוש",
      detail: attempt.label || attempt.match,
      action: "search",
      query,
      attemptIndex: index + 1,
      match: attempt.match,
      resultCount: results.length,
      results: [...results]
    })

    try {
      const rows = await db.fetchAll([
        "SELECT line.id AS lineId, line.heRef, line.content, line.lineIndex,",
        "       book.id AS bookId, book.title AS bookTitle, line_fts.rank AS rank",
        "FROM line_fts",
        "JOIN line ON line.id = line_fts.rowid",
        "JOIN book ON book.id = line.bookId",
        "WHERE line_fts MATCH ?",
        heRefOnly ? "  AND line.heRef IS NOT NULL" : "",
        "ORDER BY line_fts.rank",
        `LIMIT ${Math.max(limit * 2, limit)}`
      ].filter(Boolean).join("\n"), [attempt.match])

      attemptSummaries.push({ ...attempt, returned: rows.length })
      emit(onProgress, {
        phase: "search_attempt_done",
        title: "ניסיון חיפוש הסתיים",
        detail: `${attempt.label || attempt.match}: ${rows.length} שורות גולמיות`,
        action: "search",
        query,
        attemptIndex: index + 1,
        match: attempt.match,
        returned: rows.length,
        resultCount: results.length,
        results: [...results]
      })

      for (const row of rows) {
        const lineId = Number(row.lineId)
        if (seen.has(lineId)) continue
        seen.add(lineId)
        results.push(toLine(row))

        emit(onProgress, {
          phase: "search_partial_results",
          title: "נמצאה תוצאה",
          detail: `${results.length}/${limit}`,
          action: "search",
          query,
          attemptIndex: index + 1,
          match: attempt.match,
          resultCount: results.length,
          results: [...results]
        })

        if (results.length >= limit) break
      }
      if (results.length >= limit) break
    } catch (error) {
      attemptSummaries.push({ ...attempt, error: safe(error) })
      emit(onProgress, {
        phase: "search_attempt_error",
        title: "ניסיון חיפוש נכשל",
        detail: `${attempt.label || attempt.match}: ${safe(error)}`,
        action: "search",
        query,
        attemptIndex: index + 1,
        match: attempt.match,
        error: safe(error),
        resultCount: results.length,
        results: [...results]
      })
    }
  }

  return { query, limit, heRefOnly, attempts: attemptSummaries, resultCount: results.length, results }
}
