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

function loadTrip(): TripPayload | null {
  try {
    if (!FileManager.existsSync(CONTEXT_FILE)) return null
    const parsed = JSON.parse(FileManager.readAsStringSync(CONTEXT_FILE)) as TripPayload
    if (!parsed || !Array.isArray(parsed.legs) || !Number.isFinite(parsed.startTime) || !Number.isFinite(parsed.endTime)) return null
    return parsed
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

function uniqueVehicles(states: Record<number, LegLiveState>, legs: TripLegPayload[]) {
  const out: Array<{ vehicle: Vehicle; line: string; color: string }> = []
  const seen = new Set<string>()
  for (const leg of legs) {
    const state = states[leg.index]
    for (const vehicle of state?.vehicles || []) {
      if (!vehicle.coordinate) continue
      const key = String(vehicle.vehicleId || `${leg.index}:${vehicle.coordinate.latitude}:${vehicle.coordinate.longitude}`)
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ vehicle, line: String(leg.route || vehicle.lineNumber || ""), color: leg.color || "systemBlue" })
    }
  }
  return out
}

async function loadLegLive(leg: TripLegPayload): Promise<LegLiveState> {
  const index = leg.index
  const lineNumber = String(leg.route || "")
  const stopCode = String(leg.fromStopCode || "")
  let departures: Departure[] = []
  let vehicles: Vehicle[] = []
  let routeCoordinates: Coordinate[] = []
  const errors: string[] = []

  if (stopCode && lineNumber) {
    try {
      const board = await executeRich({
        action: "stop_board",
        stopCode,
        lineNumber,
        maxResults: 5,
        includeAlerts: false,
      })
      const config = board.renderConfig as TransitConfig | undefined
      if (config?.type === "stop-board") departures = config.departures.slice(0, 5)
      else if (!board.result.ok) errors.push(board.result.error || "לא ניתן לעדכן זמני הגעה")
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }

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
      if (config?.type === "line") {
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
                <Text font="caption2" foregroundStyle={departure.realtime ? "white" : "secondaryLabel"}>{clock(Date.parse(String(departure.predictedTime || departure.scheduledTime || "")))}</Text>
                {departure.realtime ? <Text font="caption2" foregroundStyle="white">חי</Text> : <Text font="caption2" foregroundStyle="tertiaryLabel">מתוכנן</Text>}
              </VStack>
            ))}
          </HStack>
        </ScrollView>
      ) : (
        <Text font="caption" foregroundStyle="secondaryLabel">{state?.error ? "לא ניתן לעדכן כרגע" : "אין הגעות קרובות כרגע"}</Text>
      )}
      <HStack>
        {state?.error ? <Text font="caption2" foregroundStyle="systemOrange" lineLimit={1}>{state.error}</Text> : null}
        <Spacer />
        <Text font="caption2" foregroundStyle="tertiaryLabel">מתרענן כל 20 שניות</Text>
      </HStack>
    </VStack>
  )
}

function TripLiveView({ trip }: { trip: TripPayload }) {
  const legs = transitLegs(trip)
  const baseCoords = itineraryCoordinates(trip)
  const region = MapUtils.regionFromCoordinates(baseCoords, 0.22) || DEFAULT_REGION
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
            {vehicles.map(({ vehicle, line, color }) => (
              <Annotation key={`vehicle-${vehicle.vehicleId}`} coordinate={vehicle.coordinate!} title={`קו ${line}`} anchor="center">
                <HStack spacing={4} padding={{ horizontal: 8, vertical: 6 }} background={color} clipShape={{ type: "rect", cornerRadius: 11 }}>
                  <Image systemName="bus.fill" font="caption2" foregroundStyle="white" />
                  <Text font="caption" fontWeight="bold" foregroundStyle="white">{line}</Text>
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
    await Navigation.present(
      <NavigationStack>
        <VStack spacing={10} padding={24}>
          <Image systemName="exclamationmark.triangle.fill" font="title" foregroundStyle="systemOrange" />
          <Text font="headline">אין מסלול שמור</Text>
          <Text font="caption" foregroundStyle="secondaryLabel">פתח קודם מסלול תחבורה דרך ה-Agent ואז נסה שוב.</Text>
        </VStack>
      </NavigationStack>
    )
    Script.exit()
    return
  }
  await Navigation.present(<TripLiveView trip={trip} />)
  Script.exit()
}

void main()
