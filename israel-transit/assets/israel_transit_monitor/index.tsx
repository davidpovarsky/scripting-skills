import * as Scripting from "scripting"
import { LiveActivity, Notification, Script } from "scripting"
import { MONITOR_ACTIVITY_NAME, MonitorLiveActivity } from "./live_activity"
import type { MonitorLiveItem, MonitorLiveState } from "./live_activity"

type MonitorKind = "stop" | "line" | "alerts" | "trip"
type NotifyMode = "every_check" | "when_matches" | "on_change" | "new_matches" | "once"
type MonitorCondition = "matches" | "no_arrivals" | "service_resumed" | "delay" | "eta_change" | "disappeared" | "any_change" | "new_alerts" | "vehicle_change" | "connection_risk"
type Delivery = "notification" | "live_activity" | "both"
type MonitorStatus = "active" | "paused" | "completed" | "cancelled" | "error"

type TripLeg = {
  index: number
  mode?: string
  route?: string
  routeId?: string
  tripId?: string
  headsign?: string
  from?: string
  to?: string
  fromStopCode?: string
  toStopCode?: string
  startTime?: number
  endTime?: number
  durationSeconds?: number
}

type TripPayload = {
  fromName?: string
  toName?: string
  startTime?: number
  endTime?: number
  lines?: string
  legs?: TripLeg[]
}

type MonitorSpec = {
  id?: string
  kind: MonitorKind
  title?: string
  subtitle?: string
  stopCode?: string
  stopId?: string
  stopName?: string
  stopCodes?: string[]
  routeId?: string
  routeIds?: string[]
  routeCode?: string
  lineNumber?: string
  lineNumbers?: string[]
  directionQuery?: string
  destinationQuery?: string
  departureMode?: "next" | "last" | "first" | "schedule"
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
  notifyMode?: NotifyMode
  condition?: MonitorCondition
  delayAtLeastMinutes?: number
  etaChangeMinutes?: number
  connectionBufferMinutes?: number
  stopAfterFirstMatch?: boolean
  durationMinutes?: number
  until?: string | number
  maxChecks?: number
  delivery?: Delivery
  trip?: TripPayload
}

type MonitorItem = MonitorLiveItem & {
  stopCode?: string
  stopName?: string
  routeId?: string
  routeCode?: string
  scheduledTime?: string
  predictedTime?: string
  delayMinutes?: number
  vehicleId?: string
  alertId?: string
  accessible?: boolean
}

type MonitorRecord = {
  id: string
  spec: MonitorSpec
  status: MonitorStatus
  createdAt: number
  updatedAt: number
  lastCheckAt?: number
  lastNotificationAt?: number
  checks: number
  consecutiveErrors: number
  lastError?: string
  previousHadMatches?: boolean
  lastFingerprint?: string
  lastItems?: MonitorItem[]
  sentKeys: string[]
  liveActivityId?: string
  completedReason?: string
}

type Result = { ok: boolean; message: string; data?: any }
type Snapshot = { items: MonitorItem[]; message?: string; sourceStatus?: string }

const BackgroundKeeperAPI: any = (globalThis as any).BackgroundKeeper || (Scripting as any).BackgroundKeeper
const STORE_KEY = "israelTransitMonitorsV1"
const RUNNER_HEARTBEAT_KEY = "israelTransitMonitorRunnerHeartbeat"
const KAVNAV = "https://kavnav.com"
const BUSNEARBY = "https://api.busnearby.co.il"
const DEFAULT_INTERVAL = 180
const LOOP_SLEEP_MS = 5_000
const MAX_SENT_KEYS = 240

function parsePayload<T = any>(): T {
  const raw = Script.queryParameters.payload
  return raw ? JSON.parse(String(raw)) as T : {} as T
}

function idKey(value?: string): string {
  const raw = String(value || "")
  if (!raw) return ""
  const parts = raw.split(":")
  return parts[parts.length - 1]
}

function normalizeText(value?: string): string {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase()
}

function numberOr(value: any, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function uniqueStrings(values: any[]): string[] {
  return values.map(v => String(v || "").trim()).filter(Boolean).filter((v, i, all) => all.indexOf(v) === i)
}

function loadMonitors(): MonitorRecord[] {
  try {
    const value = Storage.get<MonitorRecord[]>(STORE_KEY)
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function saveMonitors(records: MonitorRecord[]) {
  const deduped = [...new Map(records.map(record => [record.id, record])).values()]
  const live = deduped.filter(record => record.status === "active" || record.status === "paused" || record.status === "error")
  const archived = deduped.filter(record => record.status === "completed" || record.status === "cancelled").sort((a, b) => b.updatedAt - a.updatedAt)
  Storage.set(STORE_KEY, [...live, ...archived.slice(0, Math.max(0, 60 - live.length))])
}

function upsertMonitor(record: MonitorRecord) {
  const all = loadMonitors()
  const index = all.findIndex(x => x.id === record.id)
  if (index >= 0) all[index] = record
  else all.push(record)
  saveMonitors(all)
}

function getMonitor(id: string): MonitorRecord | undefined {
  return loadMonitors().find(x => x.id === id)
}

function newId(): string {
  return `watch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function defaultTitle(spec: MonitorSpec): string {
  if (spec.title) return spec.title
  if (spec.kind === "stop") return spec.lineNumber ? `קו ${spec.lineNumber} · תחנה ${spec.stopCode || ""}` : `תחנה ${spec.stopCode || ""}`
  if (spec.kind === "line") return `מעקב קו ${spec.lineNumber || ""}`
  if (spec.kind === "alerts") return spec.lineNumber ? `התראות קו ${spec.lineNumber}` : `התראות תחנה ${spec.stopCode || ""}`
  return spec.trip?.toName ? `נסיעה אל ${spec.trip.toName}` : "מעקב נסיעה"
}

function normalizeSpec(input: MonitorSpec): MonitorSpec {
  const explicitMax = Number.isFinite(Number(input.maxMinutes)) ? Number(input.maxMinutes) : undefined
  const explicitWindow = Number.isFinite(Number(input.arrivalWindowMinutes)) ? Number(input.arrivalWindowMinutes) : undefined
  const defaultWindow = input.kind === "stop" ? 5 : undefined
  const maxMinutes = explicitMax ?? explicitWindow ?? defaultWindow
  const minMinutes = Number.isFinite(Number(input.minMinutes)) ? Number(input.minMinutes) : (input.kind === "stop" ? 0 : undefined)
  const condition: MonitorCondition = input.condition || (input.kind === "alerts" ? "new_alerts" : input.kind === "line" ? "vehicle_change" : input.kind === "trip" ? "any_change" : "matches")
  const notifyMode: NotifyMode = input.notifyMode || (condition === "new_alerts" ? "new_matches" : condition === "vehicle_change" || condition === "any_change" ? "on_change" : "when_matches")
  const spec: MonitorSpec = {
    ...input,
    title: defaultTitle(input),
    pollIntervalSeconds: clamp(Math.round(numberOr(input.pollIntervalSeconds, DEFAULT_INTERVAL)), 15, 86_400),
    arrivalWindowMinutes: explicitWindow !== undefined ? clamp(explicitWindow, 0, 24 * 60) : (input.kind === "stop" && maxMinutes !== undefined ? clamp(maxMinutes, 0, 24 * 60) : undefined),
    minMinutes: minMinutes !== undefined ? clamp(minMinutes, -2, 24 * 60) : undefined,
    maxMinutes: maxMinutes !== undefined ? clamp(maxMinutes, 0, 24 * 60) : undefined,
    maxResults: clamp(Math.round(numberOr(input.maxResults, 8)), 1, 30),
    stopCodes: uniqueStrings(input.stopCodes || []),
    lineNumbers: uniqueStrings([...(input.lineNumbers || []), input.lineNumber]),
    routeIds: uniqueStrings([...(input.routeIds || []), input.routeId].map(idKey)),
    notifyMode,
    condition,
    delivery: input.delivery || "notification",
  }
  return spec
}

async function fetchJson(url: string, label: string): Promise<any> {
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json, text/plain, */*" },
    timeout: 15,
    debugLabel: label,
  })
  if (!response.ok) throw new Error(`${label} HTTP ${response.status}`)
  return response.json()
}

async function retry<T>(work: () => Promise<T>, attempts = 2): Promise<T> {
  let last: any
  for (let i = 0; i < attempts; i++) {
    try { return await work() } catch (error) { last = error; if (i + 1 < attempts) await sleep(650) }
  }
  throw last
}

function queryUrl(base: string, path: string, params: Record<string, any>): string {
  const u = new URL(path, base)
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== "") u.searchParams.set(key, String(value))
  return u.toString()
}

function sleep(ms: number) { return new Promise<void>(resolve => setTimeout(resolve, ms)) }

function todayLocal(): string {
  const d = new Date()
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function scheduleMs(date: string, time: any): number | undefined {
  const match = String(time || "").match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  const dm = String(date || "").match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match || !dm) return undefined
  const base = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), 0, 0, 0, 0).getTime()
  const ms = base + (Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] || 0)) * 1000
  return Number.isFinite(ms) ? ms : undefined
}

function etaMs(value: any): number | undefined {
  if (!value) return undefined
  const ms = new Date(String(value)).getTime()
  return Number.isFinite(ms) ? ms : undefined
}

function minutesFrom(ms?: number): number | undefined {
  return Number.isFinite(ms) ? Math.ceil((Number(ms) - Date.now()) / 60_000) : undefined
}

function clock(ms?: number): string | undefined {
  if (!Number.isFinite(ms)) return undefined
  return new Date(Number(ms)).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })
}


type SegmentTrackerSpec = {
  key?: string
  routeId: string
  routeCode?: string
  lineNumber?: string
  fromStopCode: string
  toStopCode: string
  fromStopName?: string
  toStopName?: string
  pollIntervalSeconds?: number
  expiresAt?: number
}

type SegmentTripObservation = {
  key: string
  tripId?: string
  vehicleId?: string
  firstSeenAt: number
  lastSeenAt: number
  sawFrom?: boolean
  sawTo?: boolean
  fromPresentLast?: boolean
  toPresentLast?: boolean
  lastFromEta?: number
  lastToEta?: number
  fromPassedAt?: number
  toPassedAt?: number
}

type SegmentActual = {
  tripId?: string
  vehicleId?: string
  fromTime: string
  toTime: string
  durationMinutes: number
  completedAt: number
  precisionSeconds: number
}

type SegmentTrackerRecord = {
  key: string
  spec: SegmentTrackerSpec
  createdAt: number
  updatedAt: number
  lastPollAt?: number
  activeTrips: SegmentTripObservation[]
  completed: SegmentActual[]
  lastError?: string
}

const SEGMENT_HISTORY_KEY = "israelTransitSegmentHistoryV1"
const SEGMENT_TRACKER_TTL_MS = 6 * 60 * 60 * 1000
const SEGMENT_DEFAULT_INTERVAL = 30

function segmentTrackerKey(spec: SegmentTrackerSpec): string {
  return [idKey(spec.routeId), String(spec.fromStopCode), String(spec.toStopCode)].join(":")
}

function normalizeSegmentSpec(input: SegmentTrackerSpec): SegmentTrackerSpec {
  const routeId = idKey(input.routeId)
  const fromStopCode = String(input.fromStopCode || "").trim()
  const toStopCode = String(input.toStopCode || "").trim()
  if (!routeId || !fromStopCode || !toStopCode) throw new Error("Missing segment tracker identifiers.")
  const spec: SegmentTrackerSpec = {
    ...input,
    routeId,
    fromStopCode,
    toStopCode,
    pollIntervalSeconds: clamp(Math.round(numberOr(input.pollIntervalSeconds, SEGMENT_DEFAULT_INTERVAL)), 15, 120),
    expiresAt: Math.max(numberOr(input.expiresAt, 0), Date.now() + SEGMENT_TRACKER_TTL_MS),
  }
  spec.key = segmentTrackerKey(spec)
  return spec
}

function loadSegmentTrackers(): SegmentTrackerRecord[] {
  try {
    const value = Storage.get<SegmentTrackerRecord[]>(SEGMENT_HISTORY_KEY)
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function saveSegmentTrackers(records: SegmentTrackerRecord[]) {
  const now = Date.now()
  const cleaned = records.map(record => ({
    ...record,
    activeTrips: (record.activeTrips || []).filter(trip => now - trip.lastSeenAt < 3 * 60 * 60 * 1000).slice(-80),
    completed: (record.completed || []).sort((a, b) => b.completedAt - a.completedAt).slice(0, 40),
  })).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 24)
  Storage.set(SEGMENT_HISTORY_KEY, cleaned)
}

function segmentPassageTime(lastEta: number | undefined, lastSeenAt: number, now: number, intervalMs: number): number | undefined {
  const allowedGap = Math.max(120_000, intervalMs * 3)
  if (now - lastSeenAt > allowedGap) return undefined
  if (Number.isFinite(lastEta) && Number(lastEta) > now + intervalMs * 1.5) return undefined
  const low = Math.max(0, lastSeenAt - intervalMs)
  const candidate = Number.isFinite(lastEta) ? Number(lastEta) : now
  return Math.max(low, Math.min(now, candidate))
}

function segmentCall(calls: any[], stopCode: string): any | undefined {
  return calls.find((call: any) => String(call?.stopCode || "") === String(stopCode))
}

function maybeCompleteSegmentTrip(record: SegmentTrackerRecord, trip: SegmentTripObservation, intervalSeconds: number) {
  if (!trip.fromPassedAt || !trip.toPassedAt) return
  const durationMinutes = (trip.toPassedAt - trip.fromPassedAt) / 60_000
  if (!(durationMinutes > 0 && durationMinutes <= 720)) return
  const duplicate = record.completed.some(item =>
    (trip.tripId && item.tripId === trip.tripId) ||
    (!trip.tripId && trip.vehicleId && item.vehicleId === trip.vehicleId && Math.abs(item.completedAt - trip.toPassedAt!) < 15 * 60_000)
  )
  if (!duplicate) {
    record.completed.push({
      tripId: trip.tripId,
      vehicleId: trip.vehicleId,
      fromTime: new Date(trip.fromPassedAt).toISOString(),
      toTime: new Date(trip.toPassedAt).toISOString(),
      durationMinutes: Math.max(1, Math.round(durationMinutes)),
      completedAt: trip.toPassedAt,
      precisionSeconds: Math.max(15, intervalSeconds),
    })
  }
  record.activeTrips = record.activeTrips.filter(item => item.key !== trip.key)
}

async function pollSegmentTracker(record: SegmentTrackerRecord): Promise<SegmentTrackerRecord> {
  const now = Date.now()
  const spec = record.spec
  const intervalSeconds = clamp(Math.round(numberOr(spec.pollIntervalSeconds, SEGMENT_DEFAULT_INTERVAL)), 15, 120)
  const intervalMs = intervalSeconds * 1000
  const url = spec.routeCode
    ? queryUrl(KAVNAV, "/api/realtime", { routeCode: spec.routeCode })
    : queryUrl(KAVNAV, "/api/realtime", { stopCode: spec.fromStopCode })
  try {
    const raw = await retry(() => fetchJson(url, `Segment realtime ${spec.lineNumber || spec.routeId}`))
    const vehicles = Array.isArray(raw?.vehicles) ? raw.vehicles : []
    const byKey = new Map(record.activeTrips.map(item => [item.key, item]))
    const seen = new Set<string>()

    for (const vehicle of vehicles) {
      if (idKey(vehicle?.trip?.routeId) !== idKey(spec.routeId)) continue
      const tripId = idKey(vehicle?.trip?.gtfsInfo?.tripId)
      const vehicleId = String(vehicle?.vehicleId || "") || undefined
      const key = tripId ? `trip:${tripId}` : vehicleId ? `vehicle:${vehicleId}` : ""
      if (!key) continue
      const calls = Array.isArray(vehicle?.trip?.onwardCalls?.calls) ? vehicle.trip.onwardCalls.calls : []
      const fromCall = segmentCall(calls, spec.fromStopCode)
      const toCall = segmentCall(calls, spec.toStopCode)
      const fromSeq = Number(fromCall?.stopSeq)
      const toSeq = Number(toCall?.stopSeq)
      if (fromCall && toCall && Number.isFinite(fromSeq) && Number.isFinite(toSeq) && toSeq <= fromSeq) continue

      let trip = byKey.get(key)
      if (!trip) {
        if (!fromCall) continue // Only begin measuring a trip before it has passed the origin.
        trip = { key, tripId: tripId || undefined, vehicleId, firstSeenAt: now, lastSeenAt: now }
        record.activeTrips.push(trip)
        byKey.set(key, trip)
      }
      seen.add(key)
      const previousSeenAt = trip.lastSeenAt || now
      trip.lastSeenAt = now
      trip.tripId = tripId || trip.tripId
      trip.vehicleId = vehicleId || trip.vehicleId

      if (fromCall?.eta) {
        trip.sawFrom = true
        trip.fromPresentLast = true
        const value = etaMs(fromCall.eta)
        if (value !== undefined) trip.lastFromEta = value
        if (!trip.fromPassedAt && value !== undefined && value <= now - 10_000) trip.fromPassedAt = Math.max(previousSeenAt - intervalMs, Math.min(now, value))
      } else if (trip.sawFrom && trip.fromPresentLast && !trip.fromPassedAt) {
        trip.fromPassedAt = segmentPassageTime(trip.lastFromEta, previousSeenAt, now, intervalMs)
        trip.fromPresentLast = false
      }

      if (toCall?.eta) {
        trip.sawTo = true
        trip.toPresentLast = true
        const value = etaMs(toCall.eta)
        if (value !== undefined) trip.lastToEta = value
        if (!trip.toPassedAt && value !== undefined && value <= now - 10_000) trip.toPassedAt = Math.max(previousSeenAt - intervalMs, Math.min(now, value))
      } else if (trip.sawTo && trip.toPresentLast && !trip.toPassedAt) {
        trip.toPassedAt = segmentPassageTime(trip.lastToEta, previousSeenAt, now, intervalMs)
        trip.toPresentLast = false
      }

      maybeCompleteSegmentTrip(record, trip, intervalSeconds)
    }

    for (const trip of [...record.activeTrips]) {
      if (seen.has(trip.key)) continue
      if (trip.sawFrom && !trip.fromPassedAt) trip.fromPassedAt = segmentPassageTime(trip.lastFromEta, trip.lastSeenAt, now, intervalMs)
      if (trip.sawTo && !trip.toPassedAt) trip.toPassedAt = segmentPassageTime(trip.lastToEta, trip.lastSeenAt, now, intervalMs)
      maybeCompleteSegmentTrip(record, trip, intervalSeconds)
    }

    record.lastPollAt = now
    record.updatedAt = now
    record.lastError = undefined
  } catch (error) {
    record.lastPollAt = now
    record.updatedAt = now
    record.lastError = error instanceof Error ? error.message : String(error)
  }
  return record
}

function segmentHistoryPayload(record: SegmentTrackerRecord) {
  return {
    key: record.key,
    collecting: Number(record.spec.expiresAt || 0) > Date.now(),
    lastPollAt: record.lastPollAt,
    lastError: record.lastError,
    recentActual: (record.completed || []).sort((a, b) => b.completedAt - a.completedAt).slice(0, 3),
  }
}

async function ensureSegmentHistory(input: SegmentTrackerSpec): Promise<Result> {
  const spec = normalizeSegmentSpec(input)
  const all = loadSegmentTrackers()
  let record = all.find(item => item.key === spec.key)
  if (!record) {
    record = { key: spec.key!, spec, createdAt: Date.now(), updatedAt: Date.now(), activeTrips: [], completed: [] }
    all.push(record)
  } else {
    record.spec = { ...record.spec, ...spec }
    record.updatedAt = Date.now()
  }
  await pollSegmentTracker(record)
  saveSegmentTrackers(all)
  return { ok: true, message: "Segment history collector is active.", data: segmentHistoryPayload(record) }
}

function stopScheduleTrips(raw: any): any[] {
  const value = raw?.stopSchedule
  if (Array.isArray(value) && value[0]?.trips) return value[0].trips
  return []
}

function routeMap(summary: any): Map<string, any> {
  const routes = summary?.[0]?.routes || []
  return new Map(routes.map((r: any) => [idKey(r.routeId), r]))
}

function stopArrivals(stopCode: string, date: string, summary: any, schedule: any, realtime: any): MonitorItem[] {
  const routes = routeMap(summary)
  const liveByTrip = new Map<string, any>()
  const liveVehicles = Array.isArray(realtime?.vehicles) ? realtime.vehicles : []
  for (const vehicle of liveVehicles) {
    const calls = vehicle?.trip?.onwardCalls?.calls || []
    const call = calls.find((x: any) => String(x.stopCode) === String(stopCode))
    if (!call?.eta) continue
    const tripId = String(vehicle?.trip?.gtfsInfo?.tripId || "")
    if (tripId) liveByTrip.set(tripId, { vehicle, call })
  }

  const result: MonitorItem[] = []
  const seen = new Set<string>()
  for (const trip of stopScheduleTrips(schedule)) {
    const key = String(trip.tripId || "")
    if (key && seen.has(key)) continue
    if (key) seen.add(key)
    const routeId = idKey(trip.routeId)
    const route = routes.get(routeId)
    const live = liveByTrip.get(key)
    const planned = scheduleMs(trip.operationalDate || date, trip.departureTime)
    const predicted = etaMs(live?.call?.eta)
    const effective = predicted ?? planned
    const minutes = minutesFrom(effective)
    if (minutes !== undefined && minutes < -2) continue
    const rawTrip = live?.vehicle?.trip
    result.push({
      key: key || `${routeId}:${trip.departureTime}:${trip.headsign || ""}`,
      routeId,
      routeCode: route?.code ? String(route.code) : undefined,
      line: String(route?.routeNumber || rawTrip?.gtfsInfo?.routeNumber || "") || undefined,
      destination: String(trip.headsign || route?.headsign || rawTrip?.gtfsInfo?.headsign || "") || undefined,
      scheduledTime: clock(planned),
      predictedTime: clock(predicted),
      minutes,
      realtime: !!predicted,
      delayMinutes: Number.isFinite(rawTrip?.departure?.delayMinutes) ? Number(rawTrip.departure.delayMinutes) : undefined,
      vehicleId: live?.vehicle?.vehicleId ? String(live.vehicle.vehicleId) : undefined,
      accessible: trip.wheelchairAccessible === true || trip.accessible === true || rawTrip?.wheelchairAccessible === true,
    })
  }

  for (const vehicle of liveVehicles) {
    const calls = vehicle?.trip?.onwardCalls?.calls || []
    const call = calls.find((x: any) => String(x.stopCode) === String(stopCode))
    if (!call?.eta) continue
    const tripId = String(vehicle?.trip?.gtfsInfo?.tripId || "")
    if (tripId && seen.has(tripId)) continue
    const routeId = idKey(vehicle?.trip?.routeId)
    const route = routes.get(routeId)
    result.push({
      key: tripId || `vehicle:${vehicle.vehicleId}:${stopCode}`,
      routeId,
      routeCode: route?.code ? String(route.code) : undefined,
      line: String(vehicle?.trip?.gtfsInfo?.routeNumber || route?.routeNumber || "") || undefined,
      destination: String(vehicle?.trip?.gtfsInfo?.headsign || route?.headsign || "") || undefined,
      predictedTime: clock(etaMs(call.eta)),
      minutes: minutesFrom(etaMs(call.eta)),
      realtime: true,
      delayMinutes: Number.isFinite(vehicle?.trip?.departure?.delayMinutes) ? Number(vehicle.trip.departure.delayMinutes) : undefined,
      vehicleId: vehicle?.vehicleId ? String(vehicle.vehicleId) : undefined,
      accessible: vehicle?.trip?.wheelchairAccessible === true,
    })
  }
  return result.sort((a, b) => numberOr(a.minutes, 99_999) - numberOr(b.minutes, 99_999))
}

function filterItems(items: MonitorItem[], spec: MonitorSpec, applyTime = true, applyLimit = true): MonitorItem[] {
  const lines = new Set(uniqueStrings([...(spec.lineNumbers || []), spec.lineNumber]))
  const routeIds = new Set(uniqueStrings([...(spec.routeIds || []), spec.routeId].map(idKey)))
  const destination = normalizeText(spec.destinationQuery || spec.directionQuery)
  const min = numberOr(spec.minMinutes, 0)
  const max = numberOr(spec.maxMinutes, numberOr(spec.arrivalWindowMinutes, 5))
  const filtered = items.filter(item => {
    if (lines.size && !lines.has(String(item.line || ""))) return false
    if (routeIds.size && !routeIds.has(idKey(item.routeId))) return false
    if (destination && !normalizeText(item.destination).includes(destination)) return false
    if (spec.realtimeOnly && !item.realtime) return false
    if (spec.accessibleOnly && item.accessible !== true) return false
    if (applyTime && item.minutes !== undefined && (item.minutes < min || item.minutes > max)) return false
    return true
  })
  return applyLimit ? filtered.slice(0, numberOr(spec.maxResults, 8)) : filtered
}

function selectDepartureMode(items: MonitorItem[], spec: MonitorSpec): MonitorItem[] {
  if (spec.departureMode !== "first" && spec.departureMode !== "last") return items
  const groups = new Map<string, MonitorItem[]>()
  for (const item of items) {
    const group = `${item.stopCode || spec.stopCode || ""}:${item.routeId || item.line || "all"}`
    const values = groups.get(group) || []
    values.push(item); groups.set(group, values)
  }
  const picked: MonitorItem[] = []
  for (const values of groups.values()) {
    values.sort((a, b) => numberOr(a.minutes, 99_999) - numberOr(b.minutes, 99_999))
    const chosen = spec.departureMode === "first" ? values[0] : values[values.length - 1]
    if (chosen) picked.push(chosen)
  }
  return picked.sort((a, b) => numberOr(a.minutes, 99_999) - numberOr(b.minutes, 99_999))
}

async function resolveMovingStop(spec: MonitorSpec): Promise<string | undefined> {
  if (!spec.followLocation) return spec.stopCode
  try {
    const loc = await Location.requestCurrent()
    if (!loc) return spec.stopCode
    const nearby = await fetchJson(queryUrl(BUSNEARBY, "/directions/index/stops", { locale: "he", radius: spec.radius || 1200, lat: loc.latitude, lon: loc.longitude, max: 16 }), "Transit nearby stops")
    const stops = Array.isArray(nearby) ? nearby : []
    if (!spec.lineNumber) {
      const nearest = stops[0]
      return nearest ? String(nearest.code || nearest.stopCode || nearest.stop_code || spec.stopCode || "") || spec.stopCode : spec.stopCode
    }
    for (const stop of stops.slice(0, 16)) {
      const code = String(stop.code || stop.stopCode || stop.stop_code || "")
      if (!code) continue
      try {
        const summary = await fetchJson(queryUrl(KAVNAV, "/api/stopSummary", { stopCode: code }), `Transit stop ${code}`)
        const routes = summary?.[0]?.routes || []
        if (routes.some((r: any) => String(r.routeNumber || r.lineNumber || "") === String(spec.lineNumber))) return code
      } catch {}
    }
  } catch {}
  return spec.stopCode
}

async function checkOneStop(spec: MonitorSpec, stopCode: string): Promise<Snapshot> {
  const date = spec.date || todayLocal()
  const [summary, schedule, realtime] = await Promise.all([
    retry(() => fetchJson(queryUrl(KAVNAV, "/api/stopSummary", { stopCode }), `Stop summary ${stopCode}`)),
    retry(() => fetchJson(queryUrl(KAVNAV, "/api/stopSchedule", { stopCode, date }), `Stop schedule ${stopCode}`)).catch(() => ({ stopSchedule: [] })),
    retry(() => fetchJson(queryUrl(KAVNAV, "/api/realtime", { stopCode }), `Realtime ${stopCode}`)),
  ])
  const meta = summary?.[0] || {}
  const stopName = String(meta.stopName || meta.name || (stopCode === spec.stopCode ? spec.stopName : "") || `תחנה ${stopCode}`)
  if (stopCode === spec.stopCode && !spec.stopName) spec.stopName = stopName
  const multiStop = uniqueStrings([...(spec.stopCodes || []), spec.stopCode]).length > 1
  const rawItems = stopArrivals(stopCode, date, summary, schedule, realtime).map(item => ({
    ...item,
    key: multiStop ? `${stopCode}:${item.key}` : item.key,
    stopCode,
    stopName,
    detail: item.detail || (multiStop ? `${stopName} · ${stopCode}` : item.detail),
  }))
  const identityFiltered = filterItems(rawItems, spec, false, false)
  const modeSelected = selectDepartureMode(identityFiltered, spec)
  const items = filterItems(modeSelected, spec, true, true)
  return { items, message: items.length ? undefined : `אין הגעות תואמות ב${stopName}`, sourceStatus: realtime?.lastVehicleReport ? `Realtime ${realtime.lastVehicleReport}` : undefined }
}

async function checkStop(spec: MonitorSpec): Promise<Snapshot> {
  let codes = uniqueStrings([...(spec.stopCodes || []), spec.stopCode])
  if (spec.followLocation) {
    const moving = await resolveMovingStop(spec)
    if (moving) codes = [moving]
  }
  if (!codes.length) throw new Error("Monitor is missing stopCode.")
  const snapshots = await Promise.all(codes.slice(0, 8).map(code => checkOneStop(spec, code)))
  const items = snapshots.flatMap(x => x.items).sort((a, b) => numberOr(a.minutes, 99_999) - numberOr(b.minutes, 99_999)).slice(0, numberOr(spec.maxResults, 8))
  return { items, message: items.length ? undefined : "אין הגעות תואמות בחלון שנבחר", sourceStatus: snapshots.map(x => x.sourceStatus).filter(Boolean).join(" · ") || undefined }
}

async function checkLine(spec: MonitorSpec): Promise<Snapshot> {
  if (!spec.routeCode) throw new Error("Line monitor is missing routeCode.")
  const raw = await retry(() => fetchJson(queryUrl(KAVNAV, "/api/realtime", { routeCode: spec.routeCode }), `Realtime line ${spec.lineNumber || spec.routeCode}`))
  const vehicles = Array.isArray(raw?.vehicles) ? raw.vehicles : []
  const routeIds = new Set(uniqueStrings([...(spec.routeIds || []), spec.routeId].map(idKey)))
  const destination = normalizeText(spec.destinationQuery || spec.directionQuery)
  const items: MonitorItem[] = vehicles.filter((v: any) => {
    if (routeIds.size && !routeIds.has(idKey(v?.trip?.routeId))) return false
    if (destination && !normalizeText(v?.trip?.gtfsInfo?.headsign).includes(destination)) return false
    return true
  }).map((v: any) => ({
    key: String(v.vehicleId || v?.trip?.gtfsInfo?.tripId || Math.random()),
    routeId: idKey(v?.trip?.routeId),
    routeCode: spec.routeCode,
    line: String(v?.trip?.gtfsInfo?.routeNumber || spec.lineNumber || "") || undefined,
    destination: String(v?.trip?.gtfsInfo?.headsign || "") || undefined,
    realtime: true,
    delayMinutes: Number.isFinite(v?.trip?.departure?.delayMinutes) ? Number(v.trip.departure.delayMinutes) : undefined,
    vehicleId: v?.vehicleId ? String(v.vehicleId) : undefined,
    detail: v?.lastReported ? `דיווח ${v.lastReported}` : undefined,
  })).slice(0, numberOr(spec.maxResults, 12))
  return { items, message: items.length ? undefined : "אין רכבים חיים תואמים כרגע", sourceStatus: raw?.lastVehicleReport ? `Realtime ${raw.lastVehicleReport}` : undefined }
}

function normalizeAlerts(raw: any): MonitorItem[] {
  return (raw?.alerts || []).filter((a: any) => !a.isDeleted).map((a: any) => ({
    key: String(a.alertId || a.id || ""),
    alertId: String(a.alertId || a.id || ""),
    title: String(a.header?.he || a.header?.en || a.title || "התראת שירות"),
    detail: String(a.description?.he || a.description?.en || a.description || a.effect || "") || undefined,
    realtime: true,
  }))
}

async function checkAlerts(spec: MonitorSpec): Promise<Snapshot> {
  if (!spec.stopId && !spec.routeId) throw new Error("Alert monitor is missing stopId or routeId.")
  const raw = await retry(() => fetchJson(queryUrl(KAVNAV, "/api/alerts", spec.stopId ? { stopId: spec.stopId } : { routeId: spec.routeId }), "Transit alerts"))
  const items = normalizeAlerts(raw).slice(0, numberOr(spec.maxResults, 12))
  return { items, message: items.length ? undefined : "אין התראות שירות פעילות" }
}

async function realtimeAtStop(stopCode: string): Promise<any> {
  return retry(() => fetchJson(queryUrl(KAVNAV, "/api/realtime", { stopCode }), `Trip realtime ${stopCode}`))
}

function tripEtaAtStop(leg: TripLeg, stopCode: string, raw: any): { eta?: number; vehicle?: any } {
  const routeId = idKey(leg.routeId)
  const tripId = idKey(leg.tripId)
  const matches = (Array.isArray(raw?.vehicles) ? raw.vehicles : []).map((v: any) => {
    if (routeId && idKey(v?.trip?.routeId) !== routeId) return undefined
    const calls = v?.trip?.onwardCalls?.calls || []
    const call = calls.find((c: any) => String(c.stopCode) === String(stopCode))
    const eta = etaMs(call?.eta)
    if (!eta || eta < Date.now() - 90_000) return undefined
    return { eta, vehicle: v, exact: !!tripId && idKey(v?.trip?.gtfsInfo?.tripId) === tripId }
  }).filter(Boolean) as any[]
  matches.sort((a, b) => (a.exact === b.exact ? a.eta - b.eta : a.exact ? -1 : 1))
  return matches[0] || {}
}

function tripLiveItem(leg: TripLeg, raw: any): MonitorItem {
  const vehicles = Array.isArray(raw?.vehicles) ? raw.vehicles : []
  const routeId = idKey(leg.routeId)
  const tripId = idKey(leg.tripId)
  const matches = vehicles.map((v: any) => {
    if (routeId && idKey(v?.trip?.routeId) !== routeId) return undefined
    const calls = v?.trip?.onwardCalls?.calls || []
    const boardCall = calls.find((c: any) => String(c.stopCode) === String(leg.fromStopCode || ""))
    const eta = etaMs(boardCall?.eta)
    if (!eta || eta < Date.now() - 90_000) return undefined
    return { v, eta, exact: !!tripId && idKey(v?.trip?.gtfsInfo?.tripId) === tripId }
  }).filter(Boolean) as any[]
  matches.sort((a, b) => (a.exact === b.exact ? a.eta - b.eta : a.exact ? -1 : 1))
  const best = matches[0]
  const scheduled = Number(leg.startTime || 0) || undefined
  const effective = best?.eta || scheduled
  return {
    key: best?.v?.vehicleId ? String(best.v.vehicleId) : `leg:${leg.index}:${leg.route || ""}`,
    routeId,
    line: leg.route,
    destination: leg.headsign || leg.to,
    minutes: minutesFrom(effective),
    realtime: !!best,
    scheduledTime: clock(scheduled),
    predictedTime: clock(best?.eta),
    delayMinutes: Number.isFinite(best?.v?.trip?.departure?.delayMinutes) ? Number(best.v.trip.departure.delayMinutes) : undefined,
    vehicleId: best?.v?.vehicleId ? String(best.v.vehicleId) : undefined,
    detail: `${leg.from || ""} → ${leg.to || ""}`,
  }
}

async function checkTrip(spec: MonitorSpec): Promise<Snapshot> {
  const trip = spec.trip
  if (!trip) throw new Error("Trip monitor is missing trip payload.")
  const allLegs = trip.legs || []
  const legs = allLegs.filter(leg => leg.mode !== "WALK" && leg.fromStopCode && Number(leg.endTime || 0) >= Date.now() - 120_000)
  const cache = new Map<string, Promise<any>>()
  const at = (code: string) => {
    let promise = cache.get(code)
    if (!promise) { promise = realtimeAtStop(code); cache.set(code, promise) }
    return promise
  }
  const items = await Promise.all(legs.slice(0, 6).map(async leg => {
    const code = String(leg.fromStopCode)
    try { return tripLiveItem(leg, await at(code)) } catch { return tripLiveItem(leg, { vehicles: [] }) }
  }))

  if (spec.condition === "connection_risk") {
    const risks: MonitorItem[] = []
    const buffer = Math.max(0, numberOr(spec.connectionBufferMinutes, 4))
    for (let i = 0; i < legs.length - 1; i++) {
      const previous = legs[i], next = legs[i + 1]
      if (!previous.toStopCode || !next.fromStopCode) continue
      try {
        const [previousRaw, nextRaw] = await Promise.all([at(String(previous.toStopCode)), at(String(next.fromStopCode))])
        const previousMatch = tripEtaAtStop(previous, String(previous.toStopCode), previousRaw)
        const nextMatch = tripEtaAtStop(next, String(next.fromStopCode), nextRaw)
        const previousArrival = previousMatch.eta || Number(previous.endTime || 0)
        const nextDeparture = nextMatch.eta || Number(next.startTime || 0)
        if (!previousArrival || !nextDeparture || nextDeparture < Date.now() - 60_000) continue
        const gap = (nextDeparture - previousArrival) / 60_000
        const walkMinutes = allLegs.filter(leg => leg.index > previous.index && leg.index < next.index && leg.mode === "WALK").reduce((sum, leg) => sum + numberOr(leg.durationSeconds, 0) / 60, 0)
        const required = walkMinutes + buffer
        if (gap <= required) {
          risks.push({
            key: `risk:${previous.index}:${next.index}`,
            title: "סיכון לפספוס החלפה",
            detail: `קו ${previous.route || "?"} → קו ${next.route || "?"} · מרווח ${Math.round(gap * 10) / 10} דק׳ · נדרש כ־${Math.round(required * 10) / 10}`,
            line: next.route,
            destination: next.headsign || next.to,
            minutes: Math.ceil(gap),
            realtime: !!previousMatch.eta || !!nextMatch.eta,
          })
        }
      } catch {}
    }
    return { items: risks, message: risks.length ? undefined : "לא זוהה כרגע סיכון להחלפה" }
  }

  const explicitWindow = spec.maxMinutes !== undefined || spec.arrivalWindowMinutes !== undefined || spec.minMinutes !== undefined
  const filtered = filterItems(items, explicitWindow ? spec : { ...spec, minMinutes: -2, maxMinutes: 24 * 60 })
  return { items: filtered, message: filtered.length ? undefined : "אין מקטעי תחבורה פעילים נוספים" }
}

async function snapshotFor(spec: MonitorSpec): Promise<Snapshot> {
  if (spec.kind === "stop") return checkStop(spec)
  if (spec.kind === "line") return checkLine(spec)
  if (spec.kind === "alerts") return checkAlerts(spec)
  return checkTrip(spec)
}

function fingerprint(items: MonitorItem[]): string {
  return items.map(item => [item.key, item.stopCode || "", item.minutes ?? "", item.delayMinutes ?? "", item.realtime ? 1 : 0, item.title || "", item.detail || "", item.destination || ""].join(":" )).sort().join("|")
}

function etaChanged(previous: MonitorItem[], current: MonitorItem[], threshold: number): boolean {
  const byKey = new Map(previous.map(x => [x.key, x]))
  return current.some(item => {
    const before = byKey.get(item.key)
    return before && Number.isFinite(before.minutes) && Number.isFinite(item.minutes) && Math.abs(Number(before.minutes) - Number(item.minutes)) >= threshold
  })
}

function evaluate(record: MonitorRecord, items: MonitorItem[]) {
  const previous = record.lastItems || []
  const previousKeys = new Set(previous.map(x => x.key))
  const currentKeys = new Set(items.map(x => x.key))
  const sent = new Set(record.sentKeys || [])
  const newKeys = items.filter(x => !sent.has(x.key)).map(x => x.key)
  const disappeared = previous.filter(x => !currentKeys.has(x.key)).map(x => x.key)
  const fp = fingerprint(items)
  const hasBaseline = record.lastFingerprint !== undefined
  const changed = hasBaseline && record.lastFingerprint !== fp
  const condition = record.spec.condition || "matches"
  let trigger = false
  if (condition === "matches") trigger = items.length > 0
  else if (condition === "no_arrivals") trigger = items.length === 0
  else if (condition === "service_resumed") trigger = record.previousHadMatches === false && items.length > 0
  else if (condition === "delay") trigger = items.some(x => numberOr(x.delayMinutes, -999) >= numberOr(record.spec.delayAtLeastMinutes, 5))
  else if (condition === "eta_change") trigger = etaChanged(previous, items, numberOr(record.spec.etaChangeMinutes, 3))
  else if (condition === "disappeared") trigger = disappeared.length > 0
  else if (condition === "new_alerts") trigger = hasBaseline && newKeys.length > 0
  else if (condition === "connection_risk") trigger = items.some(x => x.key.startsWith("risk:"))
  else if (condition === "vehicle_change" || condition === "any_change") trigger = changed

  const mode = record.spec.notifyMode || "when_matches"
  let shouldNotify = false
  if (mode === "every_check") shouldNotify = true
  else if (mode === "when_matches") shouldNotify = trigger
  else if (mode === "on_change") shouldNotify = trigger && changed
  else if (mode === "new_matches") shouldNotify = hasBaseline && trigger && newKeys.length > 0
  else if (mode === "once") shouldNotify = trigger && !record.lastNotificationAt

  return { trigger, shouldNotify, fp, newKeys, disappeared, currentKeys, previousKeys }
}

function notificationBody(items: MonitorItem[], fallback: string): string {
  if (!items.length) return fallback
  return items.slice(0, 4).map(item => {
    if (item.title) return item.title
    const line = item.line ? `קו ${item.line}` : ""
    const destination = item.destination ? ` ${item.destination}` : ""
    const eta = Number.isFinite(item.minutes) ? ` · ${item.minutes} דק׳` : ""
    return `${line}${destination}${eta}`.trim()
  }).join("\n")
}

function statusText(record: MonitorRecord): string {
  const every = Math.round(numberOr(record.spec.pollIntervalSeconds, DEFAULT_INTERVAL) / 60 * 10) / 10
  const window = record.spec.maxMinutes ?? record.spec.arrivalWindowMinutes
  return window !== undefined ? `בדיקה כל ${every} דק׳ · חלון ${window} דק׳` : `בדיקה כל ${every} דק׳`
}

function notificationInfo(record: MonitorRecord, snapshot: Snapshot) {
  return {
    kind: "israel-transit-monitor",
    monitorId: record.id,
    title: record.spec.title || defaultTitle(record.spec),
    subtitle: record.spec.subtitle || (record.spec.stopName ? `${record.spec.stopName} · ${record.spec.stopCode || ""}` : undefined),
    status: statusText(record),
    items: snapshot.items.slice(0, 8),
    message: snapshot.message,
    checkedAt: Date.now(),
  }
}

async function sendNotification(record: MonitorRecord, snapshot: Snapshot) {
  const info = notificationInfo(record, snapshot)
  const pauseUrl = Script.createRunURLScheme("israel_transit_monitor", { action: "pause_monitor", watchId: record.id })
  const cancelUrl = Script.createRunURLScheme("israel_transit_monitor", { action: "cancel_monitor", watchId: record.id })
  await Notification.schedule({
    title: info.title,
    subtitle: info.subtitle,
    body: notificationBody(snapshot.items, snapshot.message || "המעקב נבדק"),
    interruptionLevel: "timeSensitive",
    iconImageData: { systemImage: "bus.fill", color: "systemBlue" },
    customUI: true,
    threadIdentifier: `israel-transit-monitor-${record.id}`,
    tapAction: { type: "runScript", scriptName: "israel_transit_monitor" },
    actions: [
      { title: "השהה", icon: "pause.fill", url: pauseUrl },
      { title: "הפסק", icon: "stop.fill", url: cancelUrl, destructive: true },
    ],
    userInfo: info,
    trigger: null,
  })
}

function liveState(record: MonitorRecord, snapshot?: Snapshot): MonitorLiveState {
  return {
    monitorId: record.id,
    title: record.spec.title || defaultTitle(record.spec),
    subtitle: record.spec.subtitle || (record.spec.stopName ? `${record.spec.stopName} · ${record.spec.stopCode || ""}` : statusText(record)),
    status: record.status,
    updatedAt: record.lastCheckAt || Date.now(),
    items: (snapshot?.items || record.lastItems || []).slice(0, 4),
    error: record.lastError,
  }
}

async function startLiveActivity(record: MonitorRecord): Promise<string | undefined> {
  if (record.spec.delivery !== "live_activity" && record.spec.delivery !== "both") return undefined
  if (!(await LiveActivity.areActivitiesEnabled())) return undefined
  const before = new Set(await LiveActivity.getAllActivitiesIds())
  const activity = MonitorLiveActivity()
  const started = await activity.start(liveState(record), { staleDate: new Date(Date.now() + Math.max(30_000, numberOr(record.spec.pollIntervalSeconds, DEFAULT_INTERVAL) * 2_000)), relevanceScore: 0.8 })
  if (!started) return undefined
  const after = await LiveActivity.getAllActivitiesIds()
  return after.find(id => !before.has(id))
}

async function updateLiveActivity(record: MonitorRecord, snapshot?: Snapshot) {
  if (!record.liveActivityId) return
  try {
    const activity: any = LiveActivity.from(record.liveActivityId, MONITOR_ACTIVITY_NAME)
    const state = await activity.getActivityState()
    if (state === "active" || state === "stale") {
      await activity.update(liveState(record, snapshot), { staleDate: new Date(Date.now() + Math.max(30_000, numberOr(record.spec.pollIntervalSeconds, DEFAULT_INTERVAL) * 2_000)), relevanceScore: 0.8 })
    }
  } catch {}
}

async function endLiveActivity(record: MonitorRecord) {
  if (!record.liveActivityId) return
  try {
    const activity: any = LiveActivity.from(record.liveActivityId, MONITOR_ACTIVITY_NAME)
    await activity.end(liveState(record), { dismissTimeInterval: 30 })
  } catch {}
}

function endReason(record: MonitorRecord, now = Date.now()): string | undefined {
  if (record.spec.maxChecks && record.checks >= record.spec.maxChecks) return "max_checks"
  if (record.spec.durationMinutes && now >= record.createdAt + record.spec.durationMinutes * 60_000) return "duration"
  if (record.spec.until) {
    const until = typeof record.spec.until === "number" ? record.spec.until : new Date(record.spec.until).getTime()
    if (Number.isFinite(until) && now >= until) return "until"
  }
  if (record.spec.kind === "trip" && record.spec.trip?.endTime && now > Number(record.spec.trip.endTime) + 5 * 60_000) return "trip_ended"
  return undefined
}

async function runCheck(record: MonitorRecord): Promise<MonitorRecord> {
  const now = Date.now()
  const reason = endReason(record, now)
  if (reason) {
    const done = { ...record, status: "completed" as const, completedReason: reason, updatedAt: now }
    await endLiveActivity(done)
    return done
  }
  try {
    const snapshot = await snapshotFor(record.spec)
    const evaluation = evaluate(record, snapshot.items)
    const next: MonitorRecord = {
      ...record,
      spec: { ...record.spec },
      status: "active",
      updatedAt: now,
      lastCheckAt: now,
      checks: record.checks + 1,
      consecutiveErrors: 0,
      lastError: undefined,
      previousHadMatches: snapshot.items.length > 0,
      lastFingerprint: evaluation.fp,
      lastItems: snapshot.items,
      sentKeys: uniqueStrings([...(record.sentKeys || []), ...snapshot.items.map(x => x.key)]).slice(-MAX_SENT_KEYS),
    }
    await updateLiveActivity(next, snapshot)
    if ((next.spec.delivery === "notification" || next.spec.delivery === "both") && evaluation.shouldNotify) {
      await sendNotification(next, snapshot)
      next.lastNotificationAt = now
    }
    if (next.spec.stopAfterFirstMatch && evaluation.trigger) {
      next.status = "completed"
      next.completedReason = "first_match"
      await endLiveActivity(next)
    } else if (next.spec.maxChecks && next.checks >= next.spec.maxChecks) {
      next.status = "completed"
      next.completedReason = "max_checks"
      await endLiveActivity(next)
    }
    return next
  } catch (error) {
    const failures = record.consecutiveErrors + 1
    const message = error instanceof Error ? error.message : String(error)
    const next: MonitorRecord = { ...record, updatedAt: now, lastCheckAt: now, checks: record.checks + 1, consecutiveErrors: failures, lastError: message, status: failures >= 5 ? "error" : "active" }
    await updateLiveActivity(next)
    if (failures === 3 && (record.spec.delivery === "notification" || record.spec.delivery === "both")) {
      await sendNotification(next, { items: [], message: `לא ניתן לעדכן כרגע: ${message}` }).catch(() => {})
    }
    return next
  }
}

function compactRecord(record: MonitorRecord) {
  const heartbeat = Storage.get<number>(RUNNER_HEARTBEAT_KEY)
  return {
    id: record.id,
    kind: record.spec.kind,
    title: record.spec.title,
    status: record.status,
    stopCode: record.spec.stopCode,
    stopCodes: record.spec.stopCodes,
    lineNumber: record.spec.lineNumber,
    pollIntervalSeconds: record.spec.pollIntervalSeconds,
    arrivalWindowMinutes: record.spec.arrivalWindowMinutes,
    minMinutes: record.spec.minMinutes,
    maxMinutes: record.spec.maxMinutes,
    notifyMode: record.spec.notifyMode,
    condition: record.spec.condition,
    delivery: record.spec.delivery,
    checks: record.checks,
    lastCheckAt: record.lastCheckAt,
    lastNotificationAt: record.lastNotificationAt,
    lastError: record.lastError,
    lastItems: (record.lastItems || []).slice(0, 8),
    createdAt: record.createdAt,
    runnerHeartbeat: heartbeat,
    runnerHealthy: !!heartbeat && Date.now() - heartbeat < Math.max(90_000, numberOr(record.spec.pollIntervalSeconds, DEFAULT_INTERVAL) * 2_000 + 30_000),
  }
}

async function addMonitor(input: MonitorSpec): Promise<Result> {
  const spec = normalizeSpec(input)
  if (spec.followLocation && Script.requestAccess) {
    try { await Script.requestAccess(["location"]) } catch {}
  }
  const now = Date.now()
  const record: MonitorRecord = {
    id: input.id || newId(), spec, status: "active", createdAt: now, updatedAt: now,
    checks: 0, consecutiveErrors: 0, sentKeys: [],
  }
  record.liveActivityId = await startLiveActivity(record)
  upsertMonitor(record)
  return { ok: true, message: "Transit monitor created.", data: { monitor: compactRecord(record) } }
}

function requiredId(payload: any): string {
  const direct = String(payload?.watchId || payload?.id || Script.queryParameters.watchId || Script.queryParameters.id || "")
  if (direct) return direct
  const stopCode = String(payload?.stopCode || Script.queryParameters.stopCode || "")
  const lineNumber = String(payload?.lineNumber || Script.queryParameters.lineNumber || "")
  const query = normalizeText(payload?.query || Script.queryParameters.query)
  const candidates = loadMonitors().filter(record => {
    if (record.status === "cancelled" || record.status === "completed") return false
    if (stopCode && String(record.spec.stopCode || "") !== stopCode && !(record.spec.stopCodes || []).includes(stopCode)) return false
    if (lineNumber && String(record.spec.lineNumber || "") !== lineNumber && !(record.spec.lineNumbers || []).includes(lineNumber)) return false
    if (query && !normalizeText([record.spec.title, record.spec.stopName, record.spec.stopCode, ...(record.spec.stopCodes || []), record.spec.lineNumber].filter(Boolean).join(" ")).includes(query)) return false
    return true
  }).sort((a, b) => b.updatedAt - a.updatedAt)
  if (candidates[0]) return candidates[0].id
  throw new Error("No matching active transit monitor was found.")
}

async function mutateMonitor(action: string, payload: any): Promise<Result> {
  const id = requiredId(payload)
  const record = getMonitor(id)
  if (!record) return { ok: false, message: `Monitor ${id} was not found.` }
  const now = Date.now()
  let next = { ...record, spec: { ...record.spec }, updatedAt: now }
  if (action === "pause_monitor") next.status = "paused"
  else if (action === "resume_monitor") { next.status = "active"; next.lastError = undefined; next.consecutiveErrors = 0 }
  else if (action === "cancel_monitor") { next.status = "cancelled"; next.completedReason = "cancelled" }
  else if (action === "update_monitor") {
    const patch = { ...(payload?.patch || payload || {}) }
    delete patch.watchId; delete patch.id
    const merged: any = { ...next.spec, ...patch }
    if (patch.lineNumbers !== undefined && next.spec.kind === "stop") {
      delete merged.routeId
      merged.routeIds = []
    }
    if (Array.isArray(patch.stopCodes) && patch.stopCodes.length) {
      merged.stopCode = String(patch.stopCodes[0])
      delete merged.stopId
      delete merged.stopName
    }
    next.spec = normalizeSpec(merged)
    if (patch.durationMinutes !== undefined) next.createdAt = now
    if (patch.maxChecks !== undefined) next.checks = 0
    next.status = "active"
    next.lastError = undefined
    next.consecutiveErrors = 0
  }
  upsertMonitor(next)
  if (next.status === "cancelled" || next.status === "paused") await endLiveActivity(next)
  else if ((next.spec.delivery === "live_activity" || next.spec.delivery === "both") && !next.liveActivityId) {
    next.liveActivityId = await startLiveActivity(next)
    upsertMonitor(next)
  }
  return { ok: true, message: action === "cancel_monitor" ? "Transit monitor stopped." : action === "pause_monitor" ? "Transit monitor paused." : action === "resume_monitor" ? "Transit monitor resumed." : "Transit monitor updated.", data: { monitor: compactRecord(next) } }
}

async function cancelAll(): Promise<Result> {
  const all = loadMonitors()
  const next: MonitorRecord[] = []
  for (const record of all) {
    if (record.status === "active" || record.status === "paused" || record.status === "error") {
      const cancelled = { ...record, status: "cancelled" as const, completedReason: "cancelled", updatedAt: Date.now() }
      await endLiveActivity(cancelled)
      next.push(cancelled)
    } else next.push(record)
  }
  saveMonitors(next)
  return { ok: true, message: "All transit monitors stopped.", data: { monitors: next.map(compactRecord) } }
}

async function runMonitors(): Promise<Result> {
  const keepAlive = BackgroundKeeperAPI?.keepAlive ? await BackgroundKeeperAPI.keepAlive() : false
  if (!keepAlive) console.warn("Israel Transit Monitor: BackgroundKeeper unavailable or denied; monitoring may pause when iOS suspends Scripting.")
  try {
    while (true) {
      Storage.set(RUNNER_HEARTBEAT_KEY, Date.now())
      const now = Date.now()
      const active = loadMonitors().filter(x => x.status === "active")
      const segmentTrackers = loadSegmentTrackers().filter(x => Number(x.spec.expiresAt || 0) > now)
      if (!active.length && !segmentTrackers.length) break
      let checked = false
      for (const record of active) {
        const interval = numberOr(record.spec.pollIntervalSeconds, DEFAULT_INTERVAL) * 1000
        const due = !record.lastCheckAt || now - record.lastCheckAt >= interval
        if (due || endReason(record, now)) {
          const latest = getMonitor(record.id)
          if (!latest || latest.status !== "active") continue
          const baseUpdatedAt = latest.updatedAt
          const checkedRecord = await runCheck(latest)
          const current = getMonitor(record.id)
          if (!current || current.updatedAt === baseUpdatedAt) upsertMonitor(checkedRecord)
          checked = true
        }
      }
      if (segmentTrackers.length) {
        const allSegments = loadSegmentTrackers()
        for (const tracker of allSegments) {
          if (Number(tracker.spec.expiresAt || 0) <= now) continue
          const interval = numberOr(tracker.spec.pollIntervalSeconds, SEGMENT_DEFAULT_INTERVAL) * 1000
          if (!tracker.lastPollAt || now - tracker.lastPollAt >= interval) {
            await pollSegmentTracker(tracker)
            checked = true
          }
        }
        saveSegmentTrackers(allSegments)
      }
      await sleep(checked ? 1_000 : LOOP_SLEEP_MS)
    }
    return { ok: true, message: "No active transit monitors remain." }
  } finally {
    Storage.set(RUNNER_HEARTBEAT_KEY, Date.now())
    if (keepAlive) {
      if (BackgroundKeeperAPI?.stopKeepAlive) await BackgroundKeeperAPI.stopKeepAlive()
      else if (BackgroundKeeperAPI?.stop) await BackgroundKeeperAPI.stop()
    }
  }
}

async function main() {
  try {
    const action = String(Script.queryParameters.action || "")
    if (!action) { Script.exit({ ok: true, message: "Israel Transit Monitor is installed." }); return }
    const payload = parsePayload<any>()
    let result: Result
    if (action === "add_monitor") result = await addMonitor(payload)
    else if (action === "ensure_segment_history") result = await ensureSegmentHistory(payload)
    else if (action === "run_monitors") result = await runMonitors()
    else if (action === "list_monitors") result = { ok: true, message: "Transit monitors loaded.", data: { monitors: loadMonitors().map(compactRecord) } }
    else if (action === "get_monitor") {
      const record = getMonitor(requiredId(payload))
      result = record ? { ok: true, message: "Transit monitor loaded.", data: { monitor: compactRecord(record) } } : { ok: false, message: "Transit monitor not found." }
    }
    else if (["pause_monitor", "resume_monitor", "cancel_monitor", "update_monitor"].includes(action)) result = await mutateMonitor(action, payload)
    else if (action === "cancel_all") result = await cancelAll()
    else result = { ok: false, message: `Unknown monitor action: ${action}` }
    Script.exit(result)
  } catch (error) {
    Script.exit({ ok: false, message: error instanceof Error ? error.message : String(error) })
  }
}

void main()
