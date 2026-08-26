import { ScrollView, VStack, Text } from "scripting"
import { ToolEnvelope } from "../core/types"
import { safe } from "../core/text"
import { SourceCard } from "./SourceCard"

function headerTitle(envelope: ToolEnvelope): string {
  const result = envelope.result || {}
  if (envelope.action === "search") return `חיפוש: ${safe(result.query)}`
  if (envelope.action === "read_ref") return `מראה מקום: ${safe(result.ref)}`
  if (envelope.action === "read_context") return "הקשר סביב המקור"
  if (envelope.action === "find_book") return `איתור ספר: ${safe(result.query)}`
  if (envelope.action === "get_links") return `קישורים ל־lineId ${safe(result.lineId)}`
  if (envelope.action === "get_toc") return `תוכן עניינים: ${safe(result.bookTitle || result.bookId)}`
  if (envelope.action === "db_status") return "סטטוס מסד הנתונים"
  return `אוצריא: ${envelope.action}`
}

function resultCount(result: any): string {
  const count = result?.resultCount ?? (Array.isArray(result?.results) ? result.results.length : null)
  return count == null ? "" : `תוצאות: ${count}`
}

function Panel({ title, children }: { title: string; children: any }) {
  return (
    <VStack spacing={8} padding={12} background="systemGray6" clipShape={{ type: "rect", cornerRadius: 12 }}>
      <Text font="headline" fontWeight="semibold">{title}</Text>
      {children}
    </VStack>
  )
}

function renderSearchLikeResults(results: any[]) {
  return results.map((line, index) => <SourceCard
    key={`${line.lineId ?? index}`}
    bookTitle={safe(line.bookTitle)}
    heRef={line.heRef ?? null}
    text={safe(line.cleanContent || line.text)}
  />)
}

function renderBookResults(results: any[]) {
  return results.map((book, index) => <Panel key={`${book.bookId ?? index}`} title={safe(book.title)}>
    <Text font="caption" foregroundStyle="secondaryLabel">bookId: {safe(book.bookId)}</Text>
    {book.categoryTitle ? <Text font="caption" foregroundStyle="secondaryLabel">קטגוריה: {safe(book.categoryTitle)}</Text> : null}
    {book.sourceName ? <Text font="caption" foregroundStyle="secondaryLabel">מקור: {safe(book.sourceName)}</Text> : null}
    {book.totalLines ? <Text font="caption" foregroundStyle="secondaryLabel">שורות: {safe(book.totalLines)}</Text> : null}
    {book.description ? <Text>{safe(book.description)}</Text> : null}
  </Panel>)
}

function renderLinks(results: any[]) {
  return results.map((link, index) => <Panel key={`${link.linkId ?? index}`} title={`${safe(link.connectionType)} · ${safe(link.direction)}`}>
    <Text font="caption" foregroundStyle="secondaryLabel">מקור: {safe(link.source?.bookTitle)} {safe(link.source?.heRef)}</Text>
    <Text>{safe(link.source?.text)}</Text>
    <Text font="caption" foregroundStyle="secondaryLabel">יעד: {safe(link.target?.bookTitle)} {safe(link.target?.heRef)}</Text>
    <Text>{safe(link.target?.text)}</Text>
  </Panel>)
}

function renderToc(results: any[]) {
  return results.map((entry, index) => <Panel key={`${entry.id ?? index}`} title={safe(entry.text)}>
    <Text font="caption" foregroundStyle="secondaryLabel">level: {safe(entry.level)} · lineId: {safe(entry.lineId ?? "")} · lineIndex: {safe(entry.lineIndex ?? "")}</Text>
  </Panel>)
}

function renderStatus(result: any) {
  const counts = result?.counts || {}
  return <Panel title="ספירת טבלאות">
    {Object.keys(counts).map(key => <Text key={key} font="caption" foregroundStyle="secondaryLabel">{key}: {safe(counts[key])}</Text>)}
  </Panel>
}

function renderBody(envelope: ToolEnvelope) {
  const result = envelope.result || {}
  const results = Array.isArray(result.results) ? result.results : []

  if (envelope.action === "db_status") return renderStatus(result)
  if (envelope.action === "find_book") return renderBookResults(results)
  if (envelope.action === "get_links") return renderLinks(results)
  if (envelope.action === "get_toc") return renderToc(results)
  if (results.length > 0) return renderSearchLikeResults(results)

  return <Panel title="אין תוצאות">
    <Text>לא נמצאו תוצאות מתאימות.</Text>
  </Panel>
}

export function OtzariaResultsView({ envelope }: { envelope: ToolEnvelope; onRefresh?: () => void }) {
  const result = envelope.result || {}
  return (
    <ScrollView>
      <VStack spacing={12} padding={16}>
        <Text font="title2" fontWeight="bold">אוצריא</Text>
        <Panel title={headerTitle(envelope)}>
          <Text font="caption" foregroundStyle="secondaryLabel">פעולה: {envelope.action}</Text>
          {resultCount(result) ? <Text font="caption" foregroundStyle="secondaryLabel">{resultCount(result)}</Text> : null}
          {envelope.dbPath ? <Text font="caption" foregroundStyle="secondaryLabel">DB: {envelope.dbPath}</Text> : null}
        </Panel>

        {renderBody(envelope)}

        <Panel title="אבחון קצר">
          <Text font="caption" foregroundStyle="secondaryLabel">כלי: {safe(envelope.tool)}</Text>
          <Text font="caption" foregroundStyle="secondaryLabel">תוצאות: {Array.isArray(result.results) ? result.results.length : 0}</Text>
          <Text font="caption" foregroundStyle="secondaryLabel">ניסיונות חיפוש: {Array.isArray(result.attempts) ? result.attempts.length : 0}</Text>
        </Panel>
      </VStack>
    </ScrollView>
  )
}
