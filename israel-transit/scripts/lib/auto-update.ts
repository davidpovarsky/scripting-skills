import { FileManager, Path } from "scripting"

const REPOSITORY = "davidpovarsky/scripting-skills"
const BRANCH = "main"
const SKILL_PREFIX = "israel-transit/"
const COMPANION_PREFIX = "assets/israel_transit_companion/"
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000
const STATE_PATH = Path.join(FileManager.appGroupDocumentsDirectory, "israel-transit-auto-update.json")
const RAW_BASE = `https://raw.githubusercontent.com/${REPOSITORY}/${BRANCH}/${SKILL_PREFIX}`
const TREE_URL = `https://api.github.com/repos/${REPOSITORY}/git/trees/${BRANCH}?recursive=1`

type UpdateState = { lastCheck?: number; lastVersion?: string }
type UpdateResult = { checked: boolean; updated: boolean; version?: string; error?: string }
type TreeItem = { path?: string; type?: string }

type DownloadedFile = {
  relativePath: string
  bytes: Uint8Array
}

let inFlight: Promise<UpdateResult> | null = null

function versionParts(version: string): number[] {
  return String(version || "0")
    .split(".")
    .map(part => Number.parseInt(part, 10))
    .map(value => Number.isFinite(value) ? value : 0)
}

function compareVersions(a: string, b: string): number {
  const left = versionParts(a)
  const right = versionParts(b)
  const length = Math.max(left.length, right.length)
  for (let i = 0; i < length; i++) {
    const delta = (left[i] || 0) - (right[i] || 0)
    if (delta !== 0) return delta
  }
  return 0
}

async function exists(path: string): Promise<boolean> {
  try { return await FileManager.exists(path) } catch { return false }
}

async function readJSON<T>(path: string): Promise<T | null> {
  try {
    if (!(await exists(path))) return null
    return JSON.parse(await FileManager.readAsString(path)) as T
  } catch {
    return null
  }
}

async function writeJSON(path: string, value: unknown): Promise<void> {
  await FileManager.writeAsString(path, JSON.stringify(value, null, 2))
}

async function findSkillRoot(): Promise<string | null> {
  const candidates: string[] = []
  if (FileManager.isiCloudEnabled) {
    try { candidates.push(Path.join(FileManager.iCloudDocumentsDirectory, "scripting-skills", "israel-transit")) } catch {}
  }
  candidates.push(Path.join(FileManager.documentsDirectory, "scripting-skills", "israel-transit"))
  for (const root of candidates) {
    if (await exists(Path.join(root, "SKILL.md"))) return root
  }
  return null
}

async function fetchJSON<T>(url: string): Promise<T> {
  const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}`)
  if (!response.ok) throw new Error(`Update request failed (${response.status})`)
  return await response.json() as T
}

async function downloadFile(relativePath: string): Promise<DownloadedFile> {
  const response = await fetch(`${RAW_BASE}${relativePath}?_=${Date.now()}`)
  if (!response.ok) throw new Error(`Could not download ${relativePath} (${response.status})`)
  return { relativePath, bytes: new Uint8Array(await response.arrayBuffer()) }
}

async function ensureWritableFile(path: string): Promise<void> {
  if (await exists(path)) return
  // appendText creates the file and missing parent directories in Scripting.
  await FileManager.appendText(path, "")
}

async function writeBytes(path: string, bytes: Uint8Array): Promise<void> {
  await ensureWritableFile(path)
  await FileManager.writeAsBytes(path, bytes)
}

async function performUpdate(force: boolean): Promise<UpdateResult> {
  try {
    const now = Date.now()
    const state = await readJSON<UpdateState>(STATE_PATH) || {}
    if (!force && state.lastCheck && now - state.lastCheck < CHECK_INTERVAL_MS) {
      return { checked: false, updated: false, version: state.lastVersion }
    }

    const skillRoot = await findSkillRoot()
    if (!skillRoot) return { checked: true, updated: false, error: "Israel Transit skill folder was not found." }

    const localManifest = await readJSON<{ version?: string }>(Path.join(skillRoot, "skill.json"))
    const remoteManifest = await fetchJSON<{ version?: string }>(`${RAW_BASE}skill.json`)
    const localVersion = String(localManifest?.version || "0")
    const remoteVersion = String(remoteManifest?.version || "0")

    if (compareVersions(remoteVersion, localVersion) <= 0) {
      await writeJSON(STATE_PATH, { lastCheck: now, lastVersion: localVersion })
      return { checked: true, updated: false, version: localVersion }
    }

    const tree = await fetchJSON<{ tree?: TreeItem[] }>(TREE_URL)
    const paths = (tree.tree || [])
      .filter(item => item.type === "blob" && typeof item.path === "string" && item.path.startsWith(SKILL_PREFIX))
      .map(item => item.path!.slice(SKILL_PREFIX.length))
      .filter(Boolean)

    if (!paths.includes("SKILL.md") || !paths.includes("skill.json") || !paths.includes("scripts/transit-renderer.tsx")) {
      throw new Error("Remote Israel Transit tree is incomplete; update was not applied.")
    }

    // Download every file first. No installed file is touched until the complete
    // remote skill has been fetched successfully.
    const downloaded = await Promise.all(paths.map(downloadFile))

    // Write manifests last. If a filesystem write fails midway, the old version
    // stays visible and the next invocation retries the update.
    const ordinary = downloaded.filter(file => file.relativePath !== "skill.json" && file.relativePath !== `${COMPANION_PREFIX}script.json`)
    const companionManifest = downloaded.find(file => file.relativePath === `${COMPANION_PREFIX}script.json`)
    const skillManifest = downloaded.find(file => file.relativePath === "skill.json")

    for (const file of ordinary) {
      await writeBytes(Path.join(skillRoot, file.relativePath), file.bytes)
      if (file.relativePath.startsWith(COMPANION_PREFIX)) {
        const companionRelative = file.relativePath.slice(COMPANION_PREFIX.length)
        await writeBytes(Path.join(FileManager.scriptsDirectory, "israel_transit_companion", companionRelative), file.bytes)
      }
    }

    if (companionManifest) {
      await writeBytes(Path.join(skillRoot, companionManifest.relativePath), companionManifest.bytes)
      await writeBytes(Path.join(FileManager.scriptsDirectory, "israel_transit_companion", "script.json"), companionManifest.bytes)
    }
    if (skillManifest) await writeBytes(Path.join(skillRoot, "skill.json"), skillManifest.bytes)

    await writeJSON(STATE_PATH, { lastCheck: Date.now(), lastVersion: remoteVersion })
    return { checked: true, updated: true, version: remoteVersion }
  } catch (error) {
    return { checked: true, updated: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export function maybeAutoUpdate(options: { force?: boolean } = {}): Promise<UpdateResult> {
  if (!inFlight) {
    inFlight = performUpdate(options.force === true).finally(() => { inFlight = null })
  }
  return inFlight
}
