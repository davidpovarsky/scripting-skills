import { Path, Script } from "scripting"

export type CompanionKind = "trip" | "monitor"
export type CompanionResult = { ok?: boolean; message?: string; data?: any }

const SKILL_ROOT = "/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripting-skills/israel-transit"
const PROJECTS: Record<CompanionKind, { name: string; source: string; files: string[] }> = {
  trip: {
    name: "israel_transit_companion",
    source: Path.join(SKILL_ROOT, "assets", "israel_transit_companion"),
    files: ["index.tsx", "app_intents.tsx", "live_activity.tsx", "notification.tsx", "widget.tsx", "script.json"],
  },
  monitor: {
    name: "israel_transit_monitor",
    source: Path.join(SKILL_ROOT, "assets", "israel_transit_monitor"),
    files: ["index.tsx", "live_activity.tsx", "notification.tsx", "script.json"],
  },
}

async function manifestVersion(configPath: string): Promise<string | undefined> {
  try {
    if (!(await FileManager.exists(configPath))) return undefined
    const raw = await FileManager.readAsString(configPath)
    return String(JSON.parse(raw)?.version || "") || undefined
  } catch {
    return undefined
  }
}

export function companionName(kind: CompanionKind): string {
  return PROJECTS[kind].name
}

export async function ensureCompanionProject(kind: CompanionKind): Promise<void> {
  const project = PROJECTS[kind]
  const targetDir = Path.join(FileManager.scriptsDirectory, project.name)
  const sourceConfig = Path.join(project.source, "script.json")
  const sourceVersion = await manifestVersion(sourceConfig)
  if (!sourceVersion) throw new Error(`Missing or invalid ${project.name} source: script.json`)

  let ready = (await manifestVersion(Path.join(targetDir, "script.json"))) === sourceVersion
  if (ready) {
    for (const file of project.files) {
      if (!(await FileManager.exists(Path.join(targetDir, file)))) { ready = false; break }
    }
  }
  if (ready) return

  await FileManager.createDirectory(targetDir, true)
  for (const file of project.files) {
    if (file === "script.json") continue
    const source = Path.join(project.source, file)
    if (!(await FileManager.exists(source))) throw new Error(`Missing ${project.name} source: ${file}`)
    await FileManager.writeAsString(Path.join(targetDir, file), await FileManager.readAsString(source))
  }
  await FileManager.writeAsString(Path.join(targetDir, "script.json"), await FileManager.readAsString(sourceConfig))
}

export async function runCompanion(kind: CompanionKind, action: string, payload?: unknown, singleMode = false): Promise<CompanionResult | null> {
  await ensureCompanionProject(kind)
  return Script.run<CompanionResult>({
    name: companionName(kind),
    queryParameters: {
      action,
      ...(payload === undefined ? {} : { payload: JSON.stringify(payload) }),
    },
    singleMode,
  })
}

export async function launchCompanion(kind: CompanionKind, action: string, payload?: unknown, singleMode = true): Promise<CompanionResult> {
  await ensureCompanionProject(kind)
  try {
    const launched = Script.run<CompanionResult>({
      name: companionName(kind),
      queryParameters: {
        action,
        ...(payload === undefined ? {} : { payload: JSON.stringify(payload) }),
      },
      singleMode,
    })
    const early = await Promise.race([
      launched.then(result => ({ done: true as const, result })),
      new Promise<{ done: false }>(resolve => setTimeout(() => resolve({ done: false }), 900)),
    ])
    if (early.done) return early.result || { ok: false, message: "Companion script returned no result." }
    void launched.catch(error => console.error(`${companionName(kind)} background run ended:`, error))
    return { ok: true, message: `${companionName(kind)} background runner started.` }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}
