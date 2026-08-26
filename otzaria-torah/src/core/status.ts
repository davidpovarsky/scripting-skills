import { OtzariaParams } from "./types"

export async function dbStatusAction(db: any, params: OtzariaParams, dbPath: string) {
  const meta = await db.fetchAll("SELECT key, value FROM db_meta ORDER BY key")
  const counts: Record<string, number> = {}
  for (const table of ["book", "line", "line_fts", "link", "tocEntry", "tocText", "connection_type"]) {
    try {
      const row = await db.fetchOne(`SELECT COUNT(*) AS count FROM ${table}`)
      counts[table] = Number(row?.count || 0)
    } catch {}
  }
  const connectionTypes = await db.fetchAll("SELECT id, name FROM connection_type ORDER BY id")
  return { dbPath, meta, counts, connectionTypes }
}
