import { DEFAULT_DB_FILENAMES } from "../core/config"
import { joinPath } from "../core/text"

const SQLiteAPI = (globalThis as any).SQLite
const FileManagerAPI = (globalThis as any).FileManager

async function exists(path: string): Promise<boolean> {
  try { return await FileManagerAPI.exists(path) } catch { return false }
}

export async function findDb(explicitPath?: string): Promise<string> {
  if (!SQLiteAPI) throw new Error("SQLite global is not available")
  if (!FileManagerAPI) throw new Error("FileManager global is not available")

  const bases: string[] = []
  if (FileManagerAPI.isiCloudEnabled && FileManagerAPI.iCloudDocumentsDirectory) bases.push(FileManagerAPI.iCloudDocumentsDirectory)
  if (FileManagerAPI.documentsDirectory) bases.push(FileManagerAPI.documentsDirectory)
  if (FileManagerAPI.appGroupDocumentsDirectory) bases.push(FileManagerAPI.appGroupDocumentsDirectory)

  const candidates: string[] = []
  if (explicitPath) candidates.push(explicitPath)
  for (const base of bases) {
    for (const name of DEFAULT_DB_FILENAMES) candidates.push(joinPath(base, name))
  }

  for (const path of Array.from(new Set(candidates.filter(Boolean)))) {
    if (await exists(path)) return path
  }

  throw new Error("לא נמצא seforim.db / seforim.dp בתיקיות המסמכים של Scripting. העבר dbPath מפורש או שים את הקובץ ב־Documents.")
}

export async function openOtzariaDb(explicitPath?: string) {
  const dbPath = await findDb(explicitPath)
  const db = SQLiteAPI.open(dbPath, {
    readonly: true,
    foreignKeysEnabled: false,
    journalMode: "default",
    busyMode: "immediateError",
    maximumReaderCount: 1,
    label: "otzaria-torah"
  })
  return { db, dbPath }
}

export async function closeDb(db: any) {
  try { if (db && typeof db.close === "function") await db.close() } catch {}
}
