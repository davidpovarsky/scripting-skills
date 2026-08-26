import { LineResult } from "./types"
import { safe, stripHebrewMarks, stripHtml, truncate } from "./text"

export function toLine(row: Record<string, any>): LineResult {
  const cleanContent = stripHtml(row.content)
  return {
    lineId: Number(row.lineId ?? row.id ?? 0),
    bookId: Number(row.bookId ?? 0),
    bookTitle: safe(row.bookTitle ?? row.title),
    heRef: row.heRef == null ? null : safe(row.heRef),
    lineIndex: Number(row.lineIndex ?? 0),
    cleanContent: truncate(cleanContent, 750),
    noNikudPreview: truncate(stripHebrewMarks(cleanContent), 220),
    rank: row.rank == null ? undefined : Number(row.rank)
  }
}
