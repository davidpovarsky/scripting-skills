import * as Scripting from "scripting"
import { LiveActivity, Notification, Script, Widget } from "scripting"
import { TripLiveActivity } from "./live_activity"
import type { TripLiveActivityLeg, TripLiveActivityState } from "./live_activity"

type TripLegPayload = {
  index: number
  mode?: string
  route?: string
  routeId?: string
  tripId?: string
  headsign?: string
  color?: string
  from?: string
  to?: string
  fromStopCode?: string
  toStopCode?: string
  startTime?: number
  endTime?: number
  durationSeconds?: number
}

type TripPayload = {
  kind?: string
  fromName: string
  toName: string
  startTime: number
  endTime: number
  durationMinutes: number
  transfers: number
  lines: string
  currentStep: string
  legs: TripLegPayload[]
}

type Result = { ok: boolean; message: string }
type LiveEta = {
  vehicleId?: string
  boardEta?: number
  alightEta?: number
  delayMinutes?: number
  lastReported?: string
  confidence?: string
}

const ACTIVITY_NAME = "IsraelTransitTrip"
const BackgroundKeeperAPI: any = (globalThis as any).BackgroundKeeper || (Scripting as any).BackgroundKeeper
const UPDATE_INTERVAL_MS = 10_000
const REALTIME_BASE = "https://kavnav.com/api/realtime"
const CURRENT_TRIP_KEY = "currentTrip"
const CONFIRMED_KEY = "journeyConfirmed"
const CONFIRMED_AT_KEY = "journeyConfirmedAt"
const CONFIRMED_VEHICLE_KEY = "journeyConfirmedVehicleId"
const CONFIRMED_LEG_KEY = "journeyConfirmedLegIndex"
const BOARD_GRACE_MS = 45_000

function parseTrip(): TripPayload {
  const raw = Script.queryParameters.payload
  if (!raw) throw new Error("Missing trip payload.")
  const value = JSON.parse(String(raw)) as TripPayload
  if (!value || !Number.isFinite(value.startTime) || !Number.isFinite(value.endTime)) throw new Error("Invalid trip payload.")
  value.legs = Array.isArray(value.legs) ? value.legs : []
  return value
}

function saveTrip(trip: TripPayload | TripLiveActivityState) {
  Storage.set(CURRENT_TRIP_KEY, trip)
  try { Widget.reloadAll() } catch {}
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

function idKey(value?: string): string {
  const raw = String(value || "")
  if (!raw) return ""
  const parts = raw.split(":")
  return parts[parts.length - 1]
}

function etaMs(value: any): number | undefined {
  if (!value) return undefined
  const ms = new Date(String(value)).getTime()
  return Number.isFinite(ms) ? ms : undefined
}

async function realtimeAtStop(stopCode: string): Promise<any> {
  const u = new URL(REALTIME_BASE)
  u.searchParams.set("stopCode", stopCode)
  const response = await fetch(u.toString(), {
    method: "GET",
    headers: { Accept: "application/json, text/plain, */*" },
    timeout: 15,
    debugLabel: `Transit Live ${stopCode}`,
  })
  if (!response.ok) throw new Error(`Realtime HTTP ${response.status}`)
  return await response.json()
}

function extractEta(raw: any, leg: TripLegPayload, now: number, options: { requireFutureBoard?: boolean; lockToExactTrip?: boolean; lockVehicleId?: string } = {}): LiveEta | undefined {
  const vehicles = Array.isArray(raw?.vehicles) ? raw.vehicles : []
  const routeId = idKey(leg.routeId)
  const tripId = idKey(leg.tripId)
  const candidates = vehicles.filter((v: any) => {
    const trip = v?.trip
    if (!trip) return false
    const candidateRoute = idKey(trip.routeId)
    if (routeId && candidateRoute && candidateRoute !== routeId) return false
    return true
  }).map((v: any) => {
    const calls = v?.trip?.onwardCalls?.calls || []
    const boardCall = leg.fromStopCode ? calls.find((c: any) => String(c.stopCode) === String(leg.fromStopCode)) : undefined
    const alightCall = leg.toStopCode ? calls.find((c: any) => String(c.stopCode) === String(leg.toStopCode)) : undefined
    return {
      vehicle: v,
      vehicleId: v?.vehicleId ? String(v.vehicleId) : undefined,
      exactTrip: !!tripId && idKey(v?.trip?.gtfsInfo?.tripId) === tripId,
      boardEta: etaMs(boardCall?.eta),
      alightEta: etaMs(alightCall?.eta),
    }
  }).filter((x: any) => {
    if (options.requireFutureBoard && x.boardEta !== undefined && x.boardEta < now - 30_000) return false
    const relevantEta = options.requireFutureBoard ? (x.boardEta ?? x.alightEta) : (x.alightEta ?? x.boardEta)
    return relevantEta === undefined || relevantEta >= now - 90_000
  })

  candidates.sort((a: any, b: any) => {
    if (options.lockVehicleId) {
      const aVehicle = a.vehicleId === options.lockVehicleId
      const bVehicle = b.vehicleId === options.lockVehicleId
      if (aVehicle !== bVehicle) return aVehicle ? -1 : 1
    }
    if (options.lockToExactTrip && a.exactTrip !== b.exactTrip) return a.exactTrip ? -1 : 1
    const aBoard = a.boardEta ?? Number.MAX_SAFE_INTEGER
    const bBoard = b.boardEta ?? Number.MAX_SAFE_INTEGER
    if (aBoard !== bBoard) return aBoard - bBoard
    if (a.exactTrip !== b.exactTrip) return a.exactTrip ? -1 : 1
    return (a.alightEta ?? Number.MAX_SAFE_INTEGER) - (b.alightEta ?? Number.MAX_SAFE_INTEGER)
  })
  const best = candidates[0]
  if (!best) return undefined
  return {
    vehicleId: best.vehicleId,
    boardEta: best.boardEta,
    alightEta: best.alightEta,
    delayMinutes: Number.isFinite(best.vehicle?.trip?.departure?.delayMinutes) ? Number(best.vehicle.trip.departure.delayMinutes) : undefined,
    lastReported: best.vehicle?.lastReported,
    confidence: best.vehicle?.trip?.confidenceLevel,
  }
}
function minutesUntil(ms: number | undefined, now: number): number | undefined {
  if (!Number.isFinite(ms)) return undefined
  return Math.max(0, Math.ceil((Number(ms) - now) / 60_000))
}

function liveLegs(trip: TripPayload, liveByIndex: Map<number, LiveEta>, now: number, journeyConfirmed: boolean): TripLiveActivityLeg[] {
  const firstTransitIndex = trip.legs.findIndex(leg => leg.mode !== "WALK")
  return trip.legs.map((leg, index) => {
    const live = liveByIndex.get(index)
    const scheduledBoard = Number(leg.startTime || 0)
    const isWaitingLeg = !journeyConfirmed && index === firstTransitIndex && now >= scheduledBoard - 30_000
    const boardingMissed = isWaitingLeg && scheduledBoard < now - BOARD_GRACE_MS && !Number.isFinite(live?.boardEta)
    const effectiveBoard = live?.boardEta ?? (boardingMissed ? undefined : scheduledBoard)
    const effectiveAlight = live?.alightEta ?? Number(leg.endTime || 0)
    return {
      index,
      mode: String(leg.mode || ""),
      route: leg.route ? String(leg.route) : undefined,
      headsign: leg.headsign ? String(leg.headsign) : undefined,
      color: leg.color,
      from: String(leg.from || ""),
      to: String(leg.to || ""),
      startTime: scheduledBoard,
      endTime: Number(leg.endTime || 0),
      boardEta: live?.boardEta,
      alightEta: live?.alightEta,
      boardMinutes: minutesUntil(effectiveBoard, now),
      alightMinutes: minutesUntil(effectiveAlight, now),
      realtime: !!(live?.boardEta || live?.alightEta),
      delayMinutes: live?.delayMinutes,
      vehicleId: live?.vehicleId,
      boardingMissed,
    }
  })
}
function activeLegIndex(legs: TripLiveActivityLeg[], now: number, journeyConfirmed: boolean): number {
  if (!journeyConfirmed) {
    const firstTransit = legs.findIndex(leg => leg.mode !== "WALK")
    if (firstTransit >= 0 && now >= (legs[firstTransit].startTime || 0) - 30_000) return firstTransit
  }
  const idx = legs.findIndex(leg => {
    const effectiveEnd = leg.alightEta || leg.endTime || 0
    return effectiveEnd >= now - 30_000
  })
  return idx >= 0 ? idx : Math.max(0, legs.length - 1)
}
function estimatedArrival(trip: TripPayload, legs: TripLiveActivityLeg[]): number {
  let bestDelta = 0
  for (const leg of legs) {
    if (leg.alightEta && leg.endTime) bestDelta = leg.alightEta - leg.endTime
    else if (leg.boardEta && leg.startTime) bestDelta = leg.boardEta - leg.startTime
  }
  return Math.max(trip.endTime, trip.endTime + bestDelta)
}
function statusText(leg: TripLiveActivityLeg | undefined, now: number, journeyConfirmed: boolean): string {
  if (!leg) return ""
  if (leg.mode === "WALK") {
    const mins = minutesUntil(leg.endTime, now)
    return `\u05d4\u05dc\u05d9\u05db\u05d4 \u05dc${leg.to}${mins !== undefined ? ` \u00b7 ${mins} \u05d3\u05e7\u05f3` : ""}`
  }
  if (!journeyConfirmed && leg.boardingMissed) {
    return `\u05e7\u05d5 ${leg.route || ""} \u00b7 \u05de\u05d7\u05e4\u05e9 \u05d0\u05ea \u05d4\u05d0\u05d5\u05d8\u05d5\u05d1\u05d5\u05e1 \u05d4\u05d1\u05d0...`
  }
  const boardingTarget = leg.boardEta || leg.startTime || 0
  const boarding = !journeyConfirmed || boardingTarget > now + 45_000
  if (boarding) {
    const mins = minutesUntil(leg.boardingMissed ? undefined : boardingTarget, now)
    return `\u05e7\u05d5 ${leg.route || ""} ${mins !== undefined ? `\u05d1\u05e2\u05d5\u05d3 ${mins} \u05d3\u05e7\u05f3` : ""} \u00b7 ${leg.from}`
  }
  const mins = minutesUntil(leg.alightEta ?? leg.endTime, now)
  return `\u05e7\u05d5 ${leg.route || ""} \u00b7 \u05dc\u05e8\u05d3\u05ea \u05d1${leg.to}${mins !== undefined ? ` \u05d1\u05e2\u05d5\u05d3 ${mins} \u05d3\u05e7\u05f3` : ""}`
}
async function refreshState(trip: TripPayload, previous?: TripLiveActivityState): Promise<TripLiveActivityState> {
  const now = Date.now()
  const journeyConfirmed = Storage.get<boolean>(CONFIRMED_KEY) === true
  const confirmedAt = Storage.get<number>(CONFIRMED_AT_KEY) || previous?.confirmedAt || undefined
  const confirmedVehicleId = Storage.get<string>(CONFIRMED_VEHICLE_KEY) || undefined
  const confirmedLegIndex = Storage.get<number>(CONFIRMED_LEG_KEY)
  const firstTransitIndex = trip.legs.findIndex(leg => leg.mode !== "WALK")
  const liveByIndex = new Map<number, LiveEta>()
  const stopCache = new Map<string, Promise<any>>()
  const transitLegs = trip.legs.map((leg, index) => ({ leg, index })).filter(x => x.leg.mode !== "WALK" && x.leg.fromStopCode)
  await Promise.all(transitLegs.map(async ({ leg, index }) => {
    const stopCode = String(leg.fromStopCode)
    try {
      let request = stopCache.get(stopCode)
      if (!request) {
        request = realtimeAtStop(stopCode)
        stopCache.set(stopCode, request)
      }
      const raw = await request
      const waitingForBoard = !journeyConfirmed && index === firstTransitIndex && now >= Number(leg.startTime || 0) - 30_000
      const live = extractEta(raw, leg, now, {
        requireFutureBoard: waitingForBoard,
        lockVehicleId: journeyConfirmed && confirmedLegIndex === index ? confirmedVehicleId : undefined,
        lockToExactTrip: journeyConfirmed && !confirmedVehicleId && index === firstTransitIndex,
      })
      if (live) liveByIndex.set(index, live)
    } catch {}
  }))
  const legs = liveLegs(trip, liveByIndex, now, journeyConfirmed)
  const currentIndex = activeLegIndex(legs, now, journeyConfirmed)
  const current = legs[currentIndex]
  const nextTransitIndex = legs.findIndex((leg, i) => i >= currentIndex && leg.mode !== "WALK")
  const nextTransit = nextTransitIndex >= 0 ? legs[nextTransitIndex] : undefined
  return {
    fromName: trip.fromName,
    toName: trip.toName,
    startTime: trip.startTime,
    endTime: trip.endTime,
    estimatedEndTime: estimatedArrival(trip, legs),
    activityStartedAt: previous?.activityStartedAt || now,
    updatedAt: now,
    durationMinutes: trip.durationMinutes,
    transfers: trip.transfers,
    lines: trip.lines,
    currentStep: statusText(current, now, journeyConfirmed) || trip.currentStep,
    currentLegIndex: currentIndex,
    nextTransitIndex,
    nextLine: nextTransit?.route,
    nextBoardMinutes: nextTransit?.boardMinutes,
    realtimeAvailable: legs.some(leg => leg.realtime),
    journeyConfirmed,
    confirmedAt,
    legs,
  }
}
async function scheduleReminder(trip: TripPayload): Promise<Result> {
  const delaySeconds = Math.floor((trip.startTime - Date.now()) / 1000)
  if (delaySeconds < 1) return { ok: false, message: "Trip departure time has already arrived." }
  saveTrip(trip)
  const icon = UIImage.fromSFSymbol("bus.fill")?.withTintColor("systemBlue")?.toPNGData()
  await Notification.schedule({
    title: "\u05d4\u05d2\u05d9\u05e2 \u05d4\u05d6\u05de\u05df \u05dc\u05e6\u05d0\u05ea",
    subtitle: `${trip.fromName} \u2192 ${trip.toName}`,
    body: trip.lines ? `\u05de\u05e1\u05dc\u05d5\u05dc: ${trip.lines}` : "\u05de\u05e1\u05dc\u05d5\u05dc \u05d4\u05ea\u05d7\u05d1\u05d5\u05e8\u05d4 \u05e9\u05dc\u05da \u05de\u05ea\u05d7\u05d9\u05dc \u05e2\u05db\u05e9\u05d9\u05d5",
    interruptionLevel: "timeSensitive",
    ...(icon ? { iconImageData: icon } : {}),
    customUI: true,
    tapAction: { type: "runScript", scriptName: "israel_transit_companion" },
    threadIdentifier: "israel-transit-trip",
    userInfo: trip,
    trigger: new TimeIntervalNotificationTrigger({ timeInterval: delaySeconds, repeats: false }),
  })
  return { ok: true, message: "Trip departure notification scheduled." }
}

async function endExistingTransitActivities(finalState: TripLiveActivityState) {
  const ids = await LiveActivity.getAllActivitiesIds()
  await Promise.all(ids.map(async id => {
    try {
      const candidate: any = LiveActivity.from(id, ACTIVITY_NAME)
      const state = await candidate.getActivityState()
      if (state === "active" || state === "stale" || state === "ended") {
        await candidate.end(finalState, { dismissTimeInterval: 0 })
      }
    } catch {}
  }))
}

async function startLiveActivity(trip: TripPayload): Promise<Result> {
  const now = Date.now()
  if (trip.endTime <= now) return { ok: false, message: "Trip has already ended." }
  if (!(await LiveActivity.areActivitiesEnabled())) return { ok: false, message: "Live Activities are disabled on this device." }

  Storage.set(CONFIRMED_KEY, false)
  Storage.remove(CONFIRMED_AT_KEY)
  Storage.remove(CONFIRMED_VEHICLE_KEY)
  Storage.remove(CONFIRMED_LEG_KEY)
  let state = await refreshState(trip)
  await endExistingTransitActivities(state)
  saveTrip(state)

  const activity = TripLiveActivity()
  const started = await activity.start(state, {
    staleDate: new Date(now + 30_000),
    relevanceScore: 1,
  })
  if (!started) return { ok: false, message: "Could not start Trip Live Activity." }

  const keepAlive = BackgroundKeeperAPI?.keepAlive ? await BackgroundKeeperAPI.keepAlive() : false
  if (!keepAlive) console.warn("Israel Transit: BackgroundKeeper unavailable or not granted; Live Activity will continue, but realtime polling may pause in background.")

  try {
    while (Date.now() < Math.max(trip.endTime, state.estimatedEndTime) + 2 * 60_000) {
      await sleep(UPDATE_INTERVAL_MS)
      const activityState = await activity.getActivityState()
      if (activityState === "dismissed" || activityState === "ended" || activityState === null) break
      state = await refreshState(trip, state)
      saveTrip(state)
      await activity.update(state, {
        staleDate: new Date(Date.now() + 30_000),
        relevanceScore: 1,
      })
    }
    state = { ...state, updatedAt: Date.now(), currentStep: "\u05d4\u05e0\u05e1\u05d9\u05e2\u05d4 \u05d4\u05e1\u05ea\u05d9\u05d9\u05de\u05d4" }
    try { await activity.end(state, { dismissTimeInterval: 60 }) } catch {}
    Storage.remove(CONFIRMED_KEY)
    Storage.remove(CONFIRMED_AT_KEY)
    Storage.remove(CONFIRMED_VEHICLE_KEY)
    Storage.remove(CONFIRMED_LEG_KEY)
  } finally {
    if (keepAlive) {
      if (BackgroundKeeperAPI?.stopKeepAlive) await BackgroundKeeperAPI.stopKeepAlive()
      else if (BackgroundKeeperAPI?.stop) await BackgroundKeeperAPI.stop()
    }
  }
  return { ok: true, message: "Trip Live Activity finished." }
}

async function main() {
  try {
    const action = String(Script.queryParameters.action || "")
    if (!action) {
      Script.exit({ ok: true, message: "Israel Transit Companion is installed." })
      return
    }
    const trip = parseTrip()
    let result: Result
    if (action === "schedule_trip_reminder") result = await scheduleReminder(trip)
    else if (action === "start_live_activity") result = await startLiveActivity(trip)
    else if (action === "remember_trip") { saveTrip(trip); result = { ok: true, message: "Trip saved for widget." } }
    else result = { ok: false, message: `Unknown action: ${action}` }
    Script.exit(result)
  } catch (error) {
    Script.exit({ ok: false, message: error instanceof Error ? error.message : String(error) })
  }
}

void main()
