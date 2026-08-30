import { Safari, Script } from "scripting"
import type { Itinerary, Leg } from "../../views/types"
import { decodeDisplayText } from "./normalize"
import {
  ensureTripViewerProject,
  launchCompanion as launchBundledCompanion,
  runCompanion as runBundledCompanion,
  tripViewerName,
} from "./companion"

type TripActionInput = {
  fromName: string
  toName: string
  itinerary: Itinerary
}

type TripAction = "schedule_trip_reminder" | "start_live_activity"
type TripActionResult = { ok: boolean; message: string }
type CompanionResult = { ok?: boolean; message?: string }

const ACTION_CONTEXT_FILE = FileManager.appGroupDocumentsDirectory + "/israel-transit-trip-action.json"

function linesFor(itinerary: Itinerary): string {
  return itinerary.legs
    .filter(leg => leg.mode !== "WALK")
    .map(leg => decodeDisplayText(leg.route).trim())
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index)
    .join(" → ")
}

function currentLeg(itinerary: Itinerary, now: number): Leg | undefined {
  return itinerary.legs.find(leg => (leg.endTime || 0) >= now) || itinerary.legs[itinerary.legs.length - 1]
}

function stepLabel(leg?: Leg): string {
  if (!leg) return ""
  if (leg.mode === "WALK") return `הליכה: ${decodeDisplayText(leg.from.name)} → ${decodeDisplayText(leg.to.name)}`
  return `קו ${decodeDisplayText(leg.route)}: ${decodeDisplayText(leg.from.name)} → ${decodeDisplayText(leg.to.name)}`
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
    fromCoordinate: leg.from.coordinate,
    toCoordinate: leg.to.coordinate,
    coordinates: leg.coordinates,
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

function resultFromCompanion(result: CompanionResult | null): TripActionResult {
  if (!result) return { ok: false, message: "Companion script returned no result." }
  return { ok: result.ok === true, message: String(result.message || (result.ok ? "Done." : "Companion action failed.")) }
}

async function runCompanion(action: TripAction, payload: unknown): Promise<TripActionResult> {
  try {
    return resultFromCompanion(await runBundledCompanion("trip", action, payload, true))
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}

async function launchLiveMonitor(payload: unknown): Promise<TripActionResult> {
  try {
    return resultFromCompanion(await launchBundledCompanion("trip", "start_live_activity", payload, true))
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

export async function openTripViewer(input: TripActionInput): Promise<TripActionResult> {
  try {
    saveTripEngagementContext(input)
    await ensureTripViewerProject()
    const opened = await Safari.openURL(Script.createRunSingleURLScheme(tripViewerName()))
    return opened
      ? { ok: true, message: "Live trip viewer opened." }
      : { ok: false, message: "Could not open live trip viewer." }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
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