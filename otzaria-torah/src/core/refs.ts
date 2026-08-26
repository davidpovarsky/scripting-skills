import { DEFAULT_LIMIT } from "./config"
import { toLine } from "./line"
import { clampInt, safe } from "./text"
import { OtzariaParams } from "./types"

export async function readRefAction(db: any, params: OtzariaParams) {
  const ref = safe(params.ref || params.query).trim()
  if (!ref) throw new Error("חסר ref לפעולת read_ref")
  const limit = clampInt(params.limit, Math.max(DEFAULT_LIMIT, 20), 1, 120)

  const rows = await db.fetchAll([
    "SELECT line.id AS lineId, line.heRef, line.content, line.lineIndex,",
    "       book.id AS bookId, book.title AS bookTitle",
    "FROM line",
    "JOIN book ON book.id = line.bookId",
    "WHERE line.heRef = ?",
    "   OR line.heRef LIKE ? || ',%'",
    "   OR line.heRef LIKE ? || ' %'",
    "ORDER BY book.id, line.lineIndex",
    `LIMIT ${limit}`
  ].join("\n"), [ref, ref, ref])

  return { ref, limit, resultCount: rows.length, results: rows.map(toLine) }
}

export async function readContextAction(db: any, params: OtzariaParams) {
  let lineId = Number(params.lineId)
  let bookId = Number(params.bookId)
  let lineIndex = Number(params.lineIndex)
  const radius = clampInt(params.radius, 3, 0, 20)

  if (Number.isFinite(lineId) && lineId > 0) {
    const base = await db.fetchOne([
      "SELECT line.id AS lineId, line.bookId, line.lineIndex, line.heRef, book.title AS bookTitle",
      "FROM line JOIN book ON book.id = line.bookId WHERE line.id = ? LIMIT 1"
    ].join("\n"), [lineId])
    if (!base) throw new Error(`lineId לא נמצא: ${lineId}`)
    bookId = Number(base.bookId)
    lineIndex = Number(base.lineIndex)
  }

  if (!Number.isFinite(bookId) || bookId <= 0 || !Number.isFinite(lineIndex)) {
    throw new Error("read_context דורש lineId או bookId + lineIndex")
  }

  const rows = await db.fetchAll([
    "SELECT line.id AS lineId, line.heRef, line.content, line.lineIndex,",
    "       book.id AS bookId, book.title AS bookTitle",
    "FROM line",
    "JOIN book ON book.id = line.bookId",
    "WHERE line.bookId = ? AND line.lineIndex BETWEEN ? AND ?",
    "ORDER BY line.lineIndex"
  ].join("\n"), [bookId, lineIndex - radius, lineIndex + radius])

  return { bookId, lineIndex, radius, resultCount: rows.length, results: rows.map(toLine) }
}
