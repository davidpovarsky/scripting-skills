import { launchCompanion, runCompanion } from "./companion"
import type { TransitRequest } from "./types"

export type MonitorKind = "stop" | "line" | "alerts" | "trip"
export type MonitorSpec = {
  kind: MonitorKind
  title?: string
  subtitle?: string
  stopCode?: string
  stopCodes?: string[]
  stopId?: string
  stopName?: string
  routeId?: string
  routeIds?: string[]
  routeCode?: string
  lineNumber?: string
  lineNumbers?: string[]
  directionQuery?: string
  destinationQuery?: string
  departureMode?: TransitRequest["departureMode"]
  date?: string
  followLocation?: boolean
  radius?: number
  pollIntervalSeconds?: number
  arrivalWindowMinutes?: number
  minMinutes?: number
  maxMinutes?: number
  maxResults?: number
  realtimeOnly?: boolean
  accessibleOnly?: boolean
  notifyMode?: TransitRequest["notifyMode"]
  condition?: TransitRequest["watchCondition"]
  delayAtLeastMinutes?: number
  etaChangeMinutes?: number
  connectionBufferMinutes?: number
  stopAfterFirstMatch?: boolean
  durationMinutes?: number
  until?: string
  maxChecks?: number
  delivery?: TransitRequest["delivery"]
  trip?: any
}

export type MonitorActionResult = { ok: boolean; message: string; data?: any }
export type SegmentHistorySpec = {
  routeId: string
  routeCode?: string
  lineNumber?: string
  fromStopCode: string
  toStopCode: string
  fromStopName?: string
  toStopName?: string
  pollIntervalSeconds?: number
}
const TRIP_CONTEXT_FILE = FileManager.appGroupDocumentsDirectory + "/israel-transit-trip-action.json"

function result(value: any, fallback: string): MonitorActionResult {
  return { ok: value?.ok === true, message: String(value?.message || fallback), data: value?.data }
}

async function restartRunner(): Promise<void> {
  const launched = await launchCompanion("monitor", "run_monitors", undefined, true)
  if (launched.ok !== true) console.warn(`Israel Transit monitor runner: ${launched.message || "failed"}`)
}

export async function startMonitor(spec: MonitorSpec): Promise<MonitorActionResult> {
  try {
    const created = await runCompanion("monitor", "add_monitor", spec, false)
    const out = result(created, "Could not create transit monitor.")
    if (!out.ok) return out
    await restartRunner()
    return out
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}

export async function ensureSegmentHistory(spec: SegmentHistorySpec): Promise<MonitorActionResult> {
  try {
    const created = await runCompanion("monitor", "ensure_segment_history", spec, false)
    const out = result(created, "Could not initialize segment history.")
    if (!out.ok) return out
    await restartRunner()
    return out
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}

function loadSavedTrip(): any | null {
  try {
    if (!FileManager.existsSync(TRIP_CONTEXT_FILE)) return null
    const value = JSON.parse(FileManager.readAsStringSync(TRIP_CONTEXT_FILE))
    if (!value || !Number.isFinite(value.startTime) || !Number.isFinite(value.endTime)) return null
    return value
  } catch {
    return null
  }
}

export async function startSavedTripWatch(req: TransitRequest): Promise<MonitorActionResult> {
  const trip = loadSavedTrip()
  if (!trip) return { ok: false, message: "No selected trip is available. Open a trip plan first." }
  if (trip.endTime <= Date.now()) return { ok: false, message: "Trip has already ended." }
  return startMonitor({
    kind: "trip",
    title: trip.toName ? `נסיעה אל ${trip.toName}` : "מעקב נסיעה",
    subtitle: trip.lines || undefined,
    trip,
    pollIntervalSeconds: req.pollIntervalSeconds || 30,
    notifyMode: req.notifyMode,
    condition: req.watchCondition || "any_change",
    delayAtLeastMinutes: req.delayAtLeastMinutes,
    etaChangeMinutes: req.etaChangeMinutes,
    connectionBufferMinutes: req.connectionBufferMinutes,
    stopAfterFirstMatch: req.stopAfterFirstMatch,
    durationMinutes: req.durationMinutes,
    until: req.until,
    maxChecks: req.maxChecks,
    delivery: req.delivery || "notification",
    realtimeOnly: req.realtimeOnly,
    maxResults: req.maxResults || 6,
  })
}

function watchPatch(req: TransitRequest) {
  const keys: (keyof TransitRequest)[] = [
    "pollIntervalSeconds", "arrivalWindowMinutes", "minMinutes", "maxMinutes", "maxResults",
    "destinationQuery", "directionQuery", "realtimeOnly", "accessibleOnly", "notifyMode",
    "watchCondition", "delayAtLeastMinutes", "etaChangeMinutes", "connectionBufferMinutes", "stopAfterFirstMatch",
    "durationMinutes", "until", "maxChecks", "delivery", "followLocation", "radius",
  ]
  const patch: any = {}
  for (const key of keys) if (req[key] !== undefined) patch[key === "watchCondition" ? "condition" : key] = req[key]
  if (req.stopCodes !== undefined) patch.stopCodes = req.stopCodes
  if (req.departureMode !== undefined) patch.departureMode = req.departureMode
  if (req.date !== undefined) patch.date = req.date
  if (req.lineNumbers !== undefined) patch.lineNumbers = req.lineNumbers
  return patch
}

export async function controlMonitor(req: TransitRequest): Promise<MonitorActionResult> {
  try {
    const action = req.watchAction || "list"
    if (action === "list") return result(await runCompanion("monitor", "list_monitors", undefined, false), "Could not load transit monitors.")
    if (action === "status") return result(await runCompanion("monitor", "get_monitor", { watchId: req.watchId, stopCode: req.stopCode, lineNumber: req.lineNumber, query: req.query }, false), "Could not load transit monitor.")
    if (action === "cancel_all") {
      const out = result(await runCompanion("monitor", "cancel_all", undefined, false), "Could not stop transit monitors.")
      await restartRunner()
      return out
    }
    const mapped = action === "cancel" ? "cancel_monitor" : action === "pause" ? "pause_monitor" : action === "resume" ? "resume_monitor" : "update_monitor"
    const selector = { watchId: req.watchId, stopCode: req.stopCode, lineNumber: req.lineNumber, query: req.query }
    const payload = mapped === "update_monitor" ? { ...selector, patch: watchPatch(req) } : selector
    const out = result(await runCompanion("monitor", mapped, payload, false), "Transit monitor action failed.")
    if (mapped !== "pause_monitor") await restartRunner()
    return out
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}
