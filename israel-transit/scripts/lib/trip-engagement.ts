import { Path, Script } from "scripting"
import type { Itinerary, Leg } from "../../views/types"
import { decodeDisplayText } from "./normalize"

type TripActionInput = {
  fromName: string
  toName: string
  itinerary: Itinerary
}

type TripAction = "schedule_trip_reminder" | "start_live_activity"
type TripActionResult = { ok: boolean; message: string }
type CompanionResult = { ok?: boolean; message?: string }

const COMPANION_NAME = "israel_transit_companion"
const COMPANION_VERSION = "1.3.0"
const SKILL_ROOT = "/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripting-skills/israel-transit"
const COMPANION_SOURCE = Path.join(SKILL_ROOT, "assets", COMPANION_NAME)
const COMPANION_FILES = ["index.tsx", "app_intents.tsx", "live_activity.tsx", "notification.tsx", "widget.tsx", "script.json"]
const ACTION_CONTEXT_FILE = FileManager.appGroupDocumentsDirectory + "/israel-transit-trip-action.json"

function linesFor(itinerary: Itinerary): string {
  return itinerary.legs
    .filter(leg => leg.mode !== "WALK")
    .map(leg => decodeDisplayText(leg.route).trim())
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index)
    .join(" \u2192 ")
}

function currentLeg(itinerary: Itinerary, now: number): Leg | undefined {
  return itinerary.legs.find(leg => (leg.endTime || 0) >= now) || itinerary.legs[itinerary.legs.length - 1]
}

function stepLabel(leg?: Leg): string {
  if (!leg) return ""
  if (leg.mode === "WALK") return `\u05d4\u05dc\u05d9\u05db\u05d4: ${decodeDisplayText(leg.from.name)} \u2192 ${decodeDisplayText(leg.to.name)}`
  return `\u05e7\u05d5 ${decodeDisplayText(leg.route)}: ${decodeDisplayText(leg.from.name)} \u2192 ${decodeDisplayText(leg.to.name)}`
}

function compactLegs(itinerary: Itinerary) {
  return itinerary.legs.slice(0, 8).map((leg, index) => ({
    index,
    mode: leg.mode,
    route: decodeDisplayText(leg.route) || undefined,
    routeId: leg.routeId,
    tripId: leg.tripId,
    headsign: decodeDisplayText(leg.headsign) || undefined,
    color: leg.color,
    from: decodeDisplayText(leg.from.name),
    to: decodeDisplayText(leg.to.name),
    fromStopCode: leg.from.stopCode,
    toStopCode: leg.to.stopCode,
    startTime: leg.startTime,
    endTime: leg.endTime,
    durationSeconds: leg.durationSeconds,
  }))
}

function tripPayload(input: TripActionInput) {
  const now = Date.now()
  return {
    kind: "israel-transit-trip",
    fromName: decodeDisplayText(input.fromName),
    toName: decodeDisplayText(input.toName),
    startTime: input.itinerary.startTime,
    endTime: input.itinerary.endTime,
    durationMinutes: Math.max(0, Math.round(input.itinerary.durationSeconds / 60)),
    transfers: input.itinerary.transfers || 0,
    lines: linesFor(input.itinerary),
    currentStep: stepLabel(currentLeg(input.itinerary, now)),
    legs: compactLegs(input.itinerary),
  }
}

async function installedVersion(targetDir: string): Promise<string | undefined> {
  try {
    const configPath = Path.join(targetDir, "script.json")
    if (!(await FileManager.exists(configPath))) return undefined
    const raw = await FileManager.readAsString(configPath)
    return String(JSON.parse(raw)?.version || "") || undefined
  } catch {
    return undefined
  }
}

async function ensureCompanionProject(): Promise<void> {
  const targetDir = Path.join(FileManager.scriptsDirectory, COMPANION_NAME)
  let ready = (await installedVersion(targetDir)) === COMPANION_VERSION
  if (ready) {
    for (const file of COMPANION_FILES) {
      if (!(await FileManager.exists(Path.join(targetDir, file)))) { ready = false; break }
    }
  }
  if (ready) return

  await FileManager.createDirectory(targetDir, true)
  for (const file of COMPANION_FILES) {
    if (file === "script.json") continue
    const source = Path.join(COMPANION_SOURCE, file)
    if (!(await FileManager.exists(source))) throw new Error(`Missing companion source: ${file}`)
    await FileManager.writeAsString(Path.join(targetDir, file), await FileManager.readAsString(source))
  }
  const sourceConfig = Path.join(COMPANION_SOURCE, "script.json")
  if (!(await FileManager.exists(sourceConfig))) throw new Error("Missing companion source: script.json")
  await FileManager.writeAsString(Path.join(targetDir, "script.json"), await FileManager.readAsString(sourceConfig))
}

function resultFromCompanion(result: CompanionResult | null): TripActionResult {
  if (!result) return { ok: false, message: "Companion script returned no result." }
  return { ok: result.ok === true, message: String(result.message || (result.ok ? "Done." : "Companion action failed.")) }
}

async function runCompanion(action: TripAction, payload: unknown): Promise<TripActionResult> {
  await ensureCompanionProject()
  try {
    const result = await Script.run<CompanionResult>({
      name: COMPANION_NAME,
      queryParameters: { action, payload: JSON.stringify(payload) },
      singleMode: true,
    })
    return resultFromCompanion(result)
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}

async function launchLiveMonitor(payload: unknown): Promise<TripActionResult> {
  await ensureCompanionProject()
  try {
    const launched = Script.run<CompanionResult>({
      name: COMPANION_NAME,
      queryParameters: { action: "start_live_activity", payload: JSON.stringify(payload) },
      singleMode: true,
    })
    const early = await Promise.race([
      launched.then(result => ({ done: true as const, result })),
      new Promise<{ done: false }>(resolve => setTimeout(() => resolve({ done: false }), 900)),
    ])
    if (early.done) return resultFromCompanion(early.result)
    void launched.catch(error => console.error("Israel Transit Live Activity monitor ended:", error))
    return { ok: true, message: "Trip Live Activity started and realtime monitoring is running." }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}

export function saveTripEngagementContext(input: TripActionInput): void {
  try {
    FileManager.writeAsStringSync(ACTION_CONTEXT_FILE, JSON.stringify(tripPayload(input)))
  } catch {}
}

function loadSavedPayload(): any | null {
  try {
    if (!FileManager.existsSync(ACTION_CONTEXT_FILE)) return null
    const parsed = JSON.parse(FileManager.readAsStringSync(ACTION_CONTEXT_FILE))
    if (!parsed || !Number.isFinite(parsed.startTime) || !Number.isFinite(parsed.endTime)) return null
    return parsed
  } catch {
    return null
  }
}

export async function runSavedTripEngagement(action: "live" | "reminder"): Promise<TripActionResult> {
  const payload = loadSavedPayload()
  if (!payload) return { ok: false, message: "No selected trip is available. Open a trip plan first." }
  if (action === "reminder") {
    if (payload.startTime <= Date.now()) return { ok: false, message: "Trip departure time has already arrived." }
    return runCompanion("schedule_trip_reminder", payload)
  }
  if (payload.endTime <= Date.now()) return { ok: false, message: "Trip has already ended." }
  return launchLiveMonitor(payload)
}

export async function scheduleTripReminder(input: TripActionInput): Promise<TripActionResult> {
  if (input.itinerary.startTime <= Date.now()) return { ok: false, message: "Trip departure time has already arrived." }
  const payload = tripPayload(input)
  saveTripEngagementContext(input)
  return runCompanion("schedule_trip_reminder", payload)
}

export async function startTripLiveActivity(input: TripActionInput): Promise<TripActionResult> {
  if (input.itinerary.endTime <= Date.now()) return { ok: false, message: "Trip has already ended." }
  const payload = tripPayload(input)
  saveTripEngagementContext(input)
  return launchLiveMonitor(payload)
}
