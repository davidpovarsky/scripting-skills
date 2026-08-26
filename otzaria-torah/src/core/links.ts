import { MAX_LINK_LIMIT } from "./config"
import { clampInt, safe, stripHtml, truncate } from "./text"
import { OtzariaParams } from "./types"

export async function getLinksAction(db: any, params: OtzariaParams) {
  const lineId = Number(params.lineId)
  if (!Number.isFinite(lineId) || lineId <= 0) throw new Error("get_links דורש lineId")

  const direction = safe(params.direction || "both")
  const connectionType = safe(params.connectionType).toUpperCase()
  const limit = clampInt(params.limit, 20, 1, MAX_LINK_LIMIT)
  const allLinks: any[] = []

  async function queryLinks(dir: "incoming" | "outgoing") {
    const condition = dir === "incoming" ? "link.targetLineId = ?" : "link.sourceLineId = ?"
    const typeFilter = connectionType ? "AND ct.name = ?" : ""
    const args = connectionType ? [lineId, connectionType] : [lineId]

    const rows = await db.fetchAll([
      "SELECT link.id AS linkId, ct.name AS connectionType,",
      "       sourceBook.title AS sourceBookTitle, sourceLine.id AS sourceLineId, sourceLine.heRef AS sourceHeRef, sourceLine.content AS sourceContent,",
      "       targetBook.title AS targetBookTitle, targetLine.id AS targetLineId, targetLine.heRef AS targetHeRef, targetLine.content AS targetContent",
      "FROM link",
      "JOIN connection_type ct ON ct.id = link.connectionTypeId",
      "JOIN book sourceBook ON sourceBook.id = link.sourceBookId",
      "JOIN book targetBook ON targetBook.id = link.targetBookId",
      "JOIN line sourceLine ON sourceLine.id = link.sourceLineId",
      "JOIN line targetLine ON targetLine.id = link.targetLineId",
      `WHERE ${condition}`,
      typeFilter,
      "ORDER BY ct.name, sourceBook.title, targetBook.title",
      `LIMIT ${limit}`
    ].filter(Boolean).join("\n"), args)

    for (const r of rows) {
      allLinks.push({
        direction: dir,
        linkId: Number(r.linkId),
        connectionType: safe(r.connectionType),
        source: {
          lineId: Number(r.sourceLineId),
          bookTitle: safe(r.sourceBookTitle),
          heRef: r.sourceHeRef == null ? null : safe(r.sourceHeRef),
          text: truncate(stripHtml(r.sourceContent), 500)
        },
        target: {
          lineId: Number(r.targetLineId),
          bookTitle: safe(r.targetBookTitle),
          heRef: r.targetHeRef == null ? null : safe(r.targetHeRef),
          text: truncate(stripHtml(r.targetContent), 500)
        }
      })
    }
  }

  if (direction === "incoming" || direction === "both") await queryLinks("incoming")
  if (direction === "outgoing" || direction === "both") await queryLinks("outgoing")

  return { lineId, direction, connectionType: connectionType || null, resultCount: allLinks.length, results: allLinks.slice(0, limit * 2) }
}
