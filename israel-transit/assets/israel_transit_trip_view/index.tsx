import {
  Annotation,
  Button,
  Circle,
  HStack,
  Image,
  Map,
  MapPolyline,
  Marker,
  Navigation,
  NavigationStack,
  ScrollView,
  Script,
  Spacer,
  Text,
  VStack,
  useEffect,
  useObservable,
  useState,
} from "scripting"
import { executeRich } from "./scripts/lib/transit"
import type { Coordinate, Departure, TransitConfig, Vehicle } from "./views/types"

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
  fromCoordinate?: Coordinate
  toCoordinate?: Coordinate
  coordinates?: Coordinate[]
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

type LegLiveState = {
  index: number
  departures: Departure[]
  vehicles: Vehicle[]
  routeCoordinates: Coordinate[]
  updatedAt: number
  error?: string
}

const CONTEXT_FILE = FileManager.appGroupDocumentsDirectory + "/israel-transit-trip-action.json"
const REFRESH_MS = 20_000
const DEFAULT_REGION = {
  center: { latitude: 31.78, longitude: 35.22 },
  span: { latitudeDelta: 0.05, longitudeDelta: 0.05 },
}

function validTrip(parsed: any): parsed is TripPayload {
  return !!parsed && Array.isArray(parsed.legs) && Number.isFinite(parsed.startTime) && Number.isFinite(parsed.endTime)
}

function loadTrip(): TripPayload | null {
  try {
    const rawPayload = Script.queryParameters?.payload
    if (rawPayload) {
      const parsed = JSON.parse(String(rawPayload))
      if (validTrip(parsed)) return parsed
    }
  } catch {}
  try {
    if (!FileManager.existsSync(CONTEXT_FILE)) return null
    const parsed = JSON.parse(FileManager.readAsStringSync(CONTEXT_FILE))
    return validTrip(parsed) ? parsed : null
  } catch {
    return null
  }
}

function clock(ms?: number): string {
  if (!ms) return ""
  return new Date(ms).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })
}

function minuteLabel(minutes?: number): string {
  if (!Number.isFinite(minutes)) return "—"
  const value = Math.max(0, Math.round(Number(minutes)))
  return value <= 0 ? "עכשיו" : `${value} דק׳`
}

function transitLegs(trip: TripPayload): TripLegPayload[] {
  return trip.legs.filter(leg => String(leg.mode || "") !== "WALK" && leg.route)
}

function itineraryCoordinates(trip: TripPayload): Coordinate[] {
  const coords: Coordinate[] = []
  for (const leg of trip.legs) {
    if (Array.isArray(leg.coordinates)) coords.push(...leg.coordinates)
    else {
      if (leg.fromCoordinate) coords.push(leg.fromCoordinate)
      if (leg.toCoordinate) coords.push(leg.toCoordinate)
    }
  }
  return coords
}

function routeKey(value?: string): string {
  return String(value || "").replace(/^1:/, "")
}

function textKey(value?: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[\/_.,;:()\[\]{}\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function chooseDepartures(all: Departure[], leg: TripLegPayload): Departure[] {
  if (!all.length) return []
  const exactRoute = routeKey(leg.routeId)
  if (exactRoute) {
    const exact = all.filter(d => routeKey(d.routeId) === exactRoute)
    if (exact.length) return exact.slice(0, 5)
  }

  const direction = textKey(leg.headsign)
  if (direction) {
    const terms = direction.split(" ").filter(term => term.length > 1)
    const soft = all.filter(d => {
      const destination = textKey(d.destination)
      if (!destination) return false
      if (destination.includes(direction) || direction.includes(destination)) return true
      return terms.length > 0 && terms.some(term => destination.includes(term))
    })
    if (soft.length) return soft.slice(0, 5)
  }

  return all.slice(0, 5)
}

function bearingBetween(a: Coordinate, b: Coordinate): number {
  const toRad = (value: number) => value * Math.PI / 180
  const toDeg = (value: number) => value * 180 / Math.PI
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const dLon = toRad(b.longitude - a.longitude)
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

function vehicleDirection(vehicle: Vehicle, routeCoordinates: Coordinate[]): number {
  if (Number.isFinite(vehicle.bearing)) return ((Number(vehicle.bearing) % 360) + 360) % 360
  if (!vehicle.coordinate || routeCoordinates.length < 2) return 0

  let nearest = 0
  let best = Number.POSITIVE_INFINITY
  for (let i = 0; i < routeCoordinates.length; i++) {
    const point = routeCoordinates[i]
    const dLat = point.latitude - vehicle.coordinate.latitude
    const dLon = point.longitude - vehicle.coordinate.longitude
    const distance = dLat * dLat + dLon * dLon
    if (distance < best) {
      best = distance
      nearest = i
    }
  }

  const a = routeCoordinates[Math.max(0, Math.min(nearest, routeCoordinates.length - 2))]
  const b = routeCoordinates[Math.max(1, Math.min(nearest + 1, routeCoordinates.length - 1))]
  return bearingBetween(a, b)
}

function uniqueVehicles(states: Record<number, LegLiveState>, legs: TripLegPayload[]) {
  const out: Array<{ vehicle: Vehicle; line: string; color: string; routeCoordinates: Coordinate[] }> = []
  const seen = new Set<string>()
  for (const leg of legs) {
    const state = states[leg.index]
    for (const vehicle of state?.vehicles || []) {
      if (!vehicle.coordinate) continue
      const key = String(vehicle.vehicleId || `${leg.index}:${vehicle.coordinate.latitude}:${vehicle.coordinate.longitude}`)
      if (seen.has(key)) continue
      seen.add(key)
      out.push({
        vehicle,
        line: String(leg.route || vehicle.lineNumber || ""),
        color: leg.color || "systemBlue",
        routeCoordinates: state?.routeCoordinates?.length ? state.routeCoordinates : (leg.coordinates || []),
      })
    }
  }
  return out
}

async function loadArrivalBoard(leg: TripLegPayload): Promise<{ departures: Departure[]; error?: string }> {
  const lineNumber = String(leg.route || "")
  if (!lineNumber) return { departures: [], error: "חסר מספר קו למקטע" }

  try {
    let bundle: any
    if (leg.fromStopCode) {
      bundle = await executeRich({
        action: "stop_board",
        stopCode: String(leg.fromStopCode),
        lineNumber,
        maxResults: 20,
        includeAlerts: false,
      })
    } else if (leg.fromCoordinate) {
      bundle = await executeRich({
        action: "nearby_line",
        lat: leg.fromCoordinate.latitude,
        lon: leg.fromCoordinate.longitude,
        lineNumber,
        departureMode: "next",
        radius: 350,
        maxResults: 20,
        includeAlerts: false,
      })
    } else {
      return { departures: [], error: "חסר קוד תחנה למקטע זה" }
    }

    const config = bundle.renderConfig as TransitConfig | undefined
    if (config?.type !== "stop-board") {
      return {
        departures: [],
        error: bundle.result?.ok === false ? (bundle.result.error || "לא ניתן לעדכן זמני הגעה") : "לא התקבל לוח תחנה",
      }
    }

    return { departures: chooseDepartures(config.departures || [], leg) }
  } catch (error) {
    return { departures: [], error: error instanceof Error ? error.message : String(error) }
  }
}

async function loadLegLive(leg: TripLegPayload): Promise<LegLiveState> {
  const index = leg.index
  const lineNumber = String(leg.route || "")
  let departures: Departure[] = []
  let vehicles: Vehicle[] = []
  let routeCoordinates: Coordinate[] = []
  const errors: string[] = []

  const arrivals = await loadArrivalBoard(leg)
  departures = arrivals.departures
  if (arrivals.error) errors.push(arrivals.error)

  if (leg.routeId) {
    try {
      const live = await executeRich({
        action: "line_live",
        routeId: leg.routeId,
        lineNumber,
        includeAlerts: false,
        limit: 40,
      })
      const config = live.renderConfig as TransitConfig | undefined
      if (config?.type === "line" || config?.type === "line-live") {
        vehicles = config.vehicles || []
        routeCoordinates = config.coordinates || []
      } else if (!live.result.ok) errors.push(live.result.error || "לא ניתן לעדכן מיקום אוטובוסים")
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }

  return {
    index,
    departures,
    vehicles,
    routeCoordinates,
    updatedAt: Date.now(),
    error: errors.length ? errors.join(" · ") : undefined,
  }
}

function ArrivalCard({ leg, state }: { leg: TripLegPayload; state?: LegLiveState }) {
  const departures = state?.departures || []
  return (
    <VStack spacing={8} alignment="trailing" padding={12} background="systemGray6" clipShape={{ type: "rect", cornerRadius: 14 }}>
      <HStack spacing={7}>
        <Image systemName="bus.fill" foregroundStyle={leg.color || "systemBlue"} />
        <Text font="headline" fontWeight="semibold">קו {leg.route || ""}</Text>
        <Spacer />
        <Text font="caption" foregroundStyle="secondaryLabel">{leg.from || ""}</Text>
      </HStack>
      {departures.length ? (
        <ScrollView axes="horizontal">
          <HStack spacing={8}>
            {departures.map((departure, i) => (
              <VStack key={`${departure.tripId || departure.vehicleId || i}`} spacing={3} padding={{ horizontal: 10, vertical: 8 }} background={departure.realtime ? "systemBlue" : "systemGray5"} clipShape={{ type: "rect", cornerRadius: 11 }}>
                <Text font="headline" fontWeight="bold" foregroundStyle={departure.realtime ? "white" : "label"}>{minuteLabel(departure.minutes)}</Text>
                <Text font="caption2" foregroundStyle={departure.realtime ? "white" : "secondaryLabel"}>{departure.predictedTime || departure.scheduledTime || "—"}</Text>
                {departure.realtime ? <Text font="caption2" foregroundStyle="white">חי</Text> : <Text font="caption2" foregroundStyle="tertiaryLabel">מתוכנן</Text>}
              </VStack>
            ))}
          </HStack>
        </ScrollView>
      ) : (
        <Text font="caption" foregroundStyle="secondaryLabel">{state?.error ? "לא ניתן לעדכן כרגע" : "אין הגעות קרובות כרגע"}</Text>
      )}
      <HStack>
        {state?.error ? <Text font="caption2" foregroundStyle="systemOrange" lineLimit={2}>{state.error}</Text> : null}
        <Spacer />
        <Text font="caption2" foregroundStyle="tertiaryLabel">מתרענן כל 20 שניות</Text>
      </HStack>
    </VStack>
  )
}

function TripLiveView({ trip }: { trip: TripPayload }) {
  const legs = transitLegs(trip)
  const baseCoords = itineraryCoordinates(trip)
  const region = (baseCoords.length ? MapUtils.regionFromCoordinates(baseCoords, 0.22) : undefined) || DEFAULT_REGION
  const camera = useObservable(MapCameraPosition.region(region))
  const [states, setStates] = useState<Record<number, LegLiveState>>({})
  const [refreshing, setRefreshing] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<number | undefined>(undefined)

  const refresh = async () => {
    setRefreshing(true)
    const results = await Promise.all(legs.map(loadLegLive))
    const next: Record<number, LegLiveState> = {}
    for (const result of results) next[result.index] = result
    setStates(next)
    setUpdatedAt(Date.now())
    setRefreshing(false)
  }

  useEffect(() => {
    let cancelled = false
    let timer: any
    const tick = async () => {
      if (cancelled) return
      await refresh()
      if (!cancelled) timer = setTimeout(tick, REFRESH_MS)
    }
    void tick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [])

  const vehicles = uniqueVehicles(states, legs)
  const liveRouteCoords = legs.flatMap(leg => states[leg.index]?.routeCoordinates || [])
  const mapCoords = baseCoords.length ? baseCoords : liveRouteCoords

  useEffect(() => {
    if (!mapCoords.length) return
    const nextRegion = MapUtils.regionFromCoordinates(mapCoords, 0.22)
    if (nextRegion) camera.setValue(MapCameraPosition.region(nextRegion))
  }, [mapCoords.length])

  return (
    <NavigationStack>
      <ScrollView>
        <VStack spacing={12} padding={{ horizontal: 12, top: 10, bottom: 24 }}>
          <HStack>
            <VStack alignment="trailing" spacing={3}>
              <Text font="title3" fontWeight="bold" lineLimit={1}>{trip.fromName} ← {trip.toName}</Text>
              <Text font="caption" foregroundStyle="secondaryLabel">{clock(trip.startTime)}–{clock(trip.endTime)} · {trip.durationMinutes} דק׳ · {trip.transfers} החלפה</Text>
            </VStack>
            <Spacer />
            <Button action={() => { void refresh() }} buttonStyle="plain" disabled={refreshing}>
              <Image systemName={refreshing ? "arrow.triangle.2.circlepath" : "arrow.clockwise"} foregroundStyle="systemBlue" />
            </Button>
          </HStack>

          <Map cameraPosition={camera} frame={{ height: 350 }} mapStyle={{ style: "standard" }} clipShape={{ type: "rect", cornerRadius: 16 }}>
            {trip.legs.map((leg, i) => {
              const coords = Array.isArray(leg.coordinates) && leg.coordinates.length > 1 ? leg.coordinates : (states[leg.index]?.routeCoordinates || [])
              if (coords.length < 2) return null
              return <MapPolyline key={`leg-${i}`} coordinates={coords} strokeColor={leg.mode === "WALK" ? "secondaryLabel" : (leg.color || "systemBlue")} strokeStyle={{ lineWidth: leg.mode === "WALK" ? 3 : 6, dash: leg.mode === "WALK" ? [5, 5] : undefined, lineCap: "round", lineJoin: "round" }} />
            })}
            {trip.legs.flatMap((leg, i) => leg.mode === "WALK" ? [] : [
              leg.fromCoordinate ? <Marker key={`board-${i}`} coordinate={leg.fromCoordinate} title={`עלייה · קו ${leg.route || ""}`} tint="systemGreen" systemImage="arrow.up.circle.fill" /> : null,
              leg.toCoordinate ? <Marker key={`alight-${i}`} coordinate={leg.toCoordinate} title="ירידה" tint="systemOrange" systemImage="arrow.down.circle.fill" /> : null,
            ])}
            {vehicles.map(({ vehicle, line, color, routeCoordinates }) => (
              <Annotation key={`vehicle-${vehicle.vehicleId}`} coordinate={vehicle.coordinate!} title={`קו ${line}`} anchor="center">
                <HStack spacing={3} alignment="center">
                  <VStack spacing={1} alignment="center">
                    <Text font="caption2" fontWeight="bold" foregroundStyle={color} padding={{ horizontal: 5, vertical: 2 }} background="white" clipShape={{ type: "rect", cornerRadius: 6 }}>{line}</Text>
                    <Image systemName="bus.fill" font="title2" foregroundStyle={color} />
                  </VStack>
                  <Image systemName="arrow.up.circle.fill" font="caption" foregroundStyle={color} rotationEffect={vehicleDirection(vehicle, routeCoordinates)} />
                </HStack>
              </Annotation>
            ))}
          </Map>

          <HStack padding={{ horizontal: 2 }}>
            <HStack spacing={5}>
              <Circle frame={{ width: 8, height: 8 }} fill={vehicles.length ? "systemGreen" : "secondaryLabel"} />
              <Text font="caption" foregroundStyle="secondaryLabel">{vehicles.length ? `${vehicles.length} אוטובוסים מדווחים חי` : "ממתין למיקום אוטובוסים"}</Text>
            </HStack>
            <Spacer />
            <Text font="caption2" foregroundStyle="tertiaryLabel">{updatedAt ? `עודכן ${clock(updatedAt)}` : "מעדכן..."}</Text>
          </HStack>

          <VStack spacing={9}>
            {legs.map(leg => <ArrivalCard key={`arrival-${leg.index}`} leg={leg} state={states[leg.index]} />)}
          </VStack>
        </VStack>
      </ScrollView>
    </NavigationStack>
  )
}

async function main() {
  const trip = loadTrip()
  if (!trip) {
    await Navigation.present({
      element: (
        <NavigationStack>
          <VStack spacing={10} padding={24}>
            <Image systemName="exclamationmark.triangle.fill" font="title" foregroundStyle="systemOrange" />
            <Text font="headline">אין מסלול שמור</Text>
            <Text font="caption" foregroundStyle="secondaryLabel">פתח קודם מסלול תחבורה דרך ה-Agent ואז נסה שוב.</Text>
          </VStack>
        </NavigationStack>
      ),
    })
    Script.exit()
    return
  }
  await Navigation.present({ element: <TripLiveView trip={trip} /> })
  Script.exit()
}

void main()
