import { MAX_TOC_LIMIT } from "./config"
import { clampInt, safe } from "./text"
import { OtzariaParams } from "./types"

export async function getTocAction(db: any, params: OtzariaParams) {
  let bookId = Number(params.bookId)
  const limit = clampInt(params.limit, 80, 1, MAX_TOC_LIMIT)

  if ((!Number.isFinite(bookId) || bookId <= 0) && params.query) {
    const found = await db.fetchOne("SELECT id FROM book WHERE title LIKE '%' || ? || '%' ORDER BY title LIMIT 1", [params.query])
    if (found) bookId = Number(found.id)
  }

  if (!Number.isFinite(bookId) || bookId <= 0) throw new Error("get_toc דורש bookId או query של שם ספר")

  const rows = await db.fetchAll([
    "SELECT tocEntry.id, tocEntry.parentId, tocEntry.level, tocEntry.lineId, tocEntry.lineIndex, tocEntry.hasChildren, tocText.text, book.title AS bookTitle",
    "FROM tocEntry",
    "JOIN tocText ON tocText.id = tocEntry.textId",
    "JOIN book ON book.id = tocEntry.bookId",
    "WHERE tocEntry.bookId = ?",
    "ORDER BY COALESCE(tocEntry.lineIndex, 999999999), tocEntry.level, tocEntry.id",
    `LIMIT ${limit}`
  ].join("\n"), [bookId])

  return {
    bookId,
    bookTitle: rows[0] ? safe(rows[0].bookTitle) : "",
    resultCount: rows.length,
    results: rows.map((r: Record<string, any>) => ({
      id: Number(r.id),
      parentId: r.parentId == null ? null : Number(r.parentId),
      level: Number(r.level),
      lineId: r.lineId == null ? null : Number(r.lineId),
      lineIndex: r.lineIndex == null ? null : Number(r.lineIndex),
      hasChildren: Number(r.hasChildren) === 1,
      text: safe(r.text)
    }))
  }
}
