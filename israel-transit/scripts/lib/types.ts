export type Action = "geocode" | "search_stops" | "nearby_stops" | "nearby_line" | "search_lines" | "stop_board" | "stop_schedule" | "line_details" | "line_live" | "line_schedule" | "line_segment" | "alerts" | "plan_trip" | "shape" | "stop_pois" | "stop_validations" | "stop_watch" | "line_watch" | "alerts_watch" | "trip_watch" | "watch_control"
export type DetailLevel = "compact" | "full"
export type NotifyMode = "every_check" | "when_matches" | "on_change" | "new_matches" | "once"
export type WatchCondition = "matches" | "no_arrivals" | "service_resumed" | "delay" | "eta_change" | "disappeared" | "any_change" | "new_alerts" | "vehicle_change" | "connection_risk"
export type WatchAction = "list" | "status" | "update" | "pause" | "resume" | "cancel" | "cancel_all"
export type DeliveryMode = "notification" | "live_activity" | "both"
export type Coordinate = { latitude: number; longitude: number }
export type TransitRequest = {
  action: Action
  query?: string
  stopQuery?: string
  stopCode?: string
  stopCodes?: string[]
  stopId?: string
  lat?: number
  lon?: number
  radius?: number
  max?: number
  lineNumber?: string
  lineNumbers?: string[]
  routeId?: string
  routeIds?: string[]
  routeCode?: string
  patternId?: string
  shapeId?: string
  direction?: string
  directionQuery?: string
  destinationQuery?: string
  alternative?: string
  departureMode?: "next" | "last" | "first" | "schedule"
  date?: string
  time?: string
  arriveBy?: boolean
  wheelchair?: boolean
  fromQuery?: string
  toQuery?: string
  fromStopQuery?: string
  toStopQuery?: string
  fromStopCode?: string
  toStopCode?: string
  fromLat?: number
  fromLon?: number
  fromName?: string
  toLat?: number
  toLon?: number
  toName?: string
  limit?: number
  maxResults?: number
  minMinutes?: number
  maxMinutes?: number
  withinMinutes?: number
  arrivalWindowMinutes?: number
  includeLive?: boolean
  includeAlerts?: boolean
  realtimeOnly?: boolean
  accessibleOnly?: boolean
  detail?: DetailLevel
  useCurrentLocation?: boolean
  followLocation?: boolean
  preferContext?: boolean
  itineraryIndex?: number
  legIndex?: number
  pollIntervalSeconds?: number
  notifyMode?: NotifyMode
  watchCondition?: WatchCondition
  delayAtLeastMinutes?: number
  etaChangeMinutes?: number
  connectionBufferMinutes?: number
  stopAfterFirstMatch?: boolean
  durationMinutes?: number
  until?: string
  maxChecks?: number
  delivery?: DeliveryMode
  watchId?: string
  watchAction?: WatchAction
}
export type Stop = { id?: string; code: string; name: string; address?: string; city?: string; coordinate?: Coordinate; distanceMeters?: number; heading?: number }
export type LineCandidate = { patternId?: string; routeId: string; lineNumber: string; routeCode?: string; agency?: string; agencyId?: string; headsign?: string; origin?: Stop; destination?: Stop; direction?: string; alternative?: string; color?: string; longName?: string }
export type Departure = { tripId?: string; routeId?: string; routeCode?: string; lineNumber?: string; destination?: string; scheduledTime?: string; predictedTime?: string; minutes?: number; delayMinutes?: number; realtime: boolean; confidence?: string; vehicleId?: string; lastReported?: string; accessible?: boolean }
export type Vehicle = { vehicleId: string; tripId?: string; routeId?: string; routeCode?: string; lineNumber?: string; destination?: string; coordinate?: Coordinate; speedKmh?: number; bearing?: number; lastReported?: string; confidence?: string; nextStopCode?: string; etaAtTarget?: string; minutesToTarget?: number; delayMinutes?: number; shapeId?: string; onwardCalls?: {stopCode:string;stopSeq?:number;eta?:string}[] }
export type Alert = { id: string; title: string; description?: string; cause?: string; effect?: string; start?: string; end?: string; routeIds?: string[]; stopIds?: string[]; active?: boolean }
export type Leg = { mode: string; route?: string; agency?: string; headsign?: string; from: {name:string; coordinate?:Coordinate; stopCode?:string}; to:{name:string; coordinate?:Coordinate; stopCode?:string}; startTime?: number; endTime?: number; durationSeconds?: number; distanceMeters?: number; realtime?: boolean; wheelchairAccessible?: boolean; color?: string; coordinates?: Coordinate[]; routeId?:string; tripId?:string; agencyId?:string; intermediateStops?:Stop[]; steps?:{distanceMeters?:number;durationSeconds?:number;direction?:string;streetName?:string;latitude?:number;longitude?:number}[] }
export type Itinerary = { index:number; durationSeconds:number; startTime:number; endTime:number; walkSeconds?:number; waitingSeconds?:number; walkDistanceMeters?:number; transfers?:number; fare?:{amount:number;currency:string;symbol?:string}; legs:Leg[] }
export type SkillResult = { ok:boolean; action:Action; summary?:string; facts?:unknown; warnings?:string[]; sources?:string[]; error?:string }
export type InternalTransitResult = { result: SkillResult; renderConfig?: unknown }
