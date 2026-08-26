import { DEFAULT_LIMIT } from "./config"
import { clampInt, safe, truncate } from "./text"
import { OtzariaParams } from "./types"

export async function findBookAction(db: any, params: OtzariaParams) {
  const query = safe(params.query).trim()
  if (!query) throw new Error("חסר query לפעולת find_book")
  const limit = clampInt(params.limit, DEFAULT_LIMIT, 1, 60)

  const rows = await db.fetchAll([
    "SELECT b.id, b.title, b.heShortDesc, b.totalLines,",
    "       category.title AS categoryTitle, source.name AS sourceName,",
    "       MIN(ba.term) AS matchedAcronym",
    "       CASE",
    "         WHEN b.title = ? THEN 0",
    "         WHEN b.title LIKE ? || '%' THEN 1",
    "         WHEN ba.term = ? THEN 2",
    "         WHEN ba.term LIKE ? || '%' THEN 3",
    "         ELSE 4",
    "       END AS score",
    "FROM book b",
    "LEFT JOIN book_acronym ba ON ba.bookId = b.id",
    "LEFT JOIN category ON category.id = b.categoryId",
    "LEFT JOIN source ON source.id = b.sourceId",
    "WHERE b.title LIKE '%' || ? || '%' OR ba.term LIKE '%' || ? || '%'",
    "GROUP BY b.id",
    "ORDER BY score, b.title",
    `LIMIT ${limit}`
  ].join("\n"), [query, query, query, query, query, query])

  return {
    query,
    limit,
    resultCount: rows.length,
    results: rows.map((r: Record<string, any>) => ({
      bookId: Number(r.id),
      title: safe(r.title),
      categoryTitle: safe(r.categoryTitle),
      sourceName: safe(r.sourceName),
      totalLines: Number(r.totalLines || 0),
      matchedAcronym: safe(r.matchedAcronym),
      description: truncate(r.heShortDesc, 250)
    }))
  }
}
