import type { TransitConfig } from "../../views/types"

export type ContextLineRef = {
  lineNumber?: string
  routeId?: string
  routeCode?: string
  direction?: string
  alternative?: string
  agency?: string
  headsign?: string
}

type ContextLeg = ContextLineRef & {
  index: number
  mode: string
  tripId?: string
  fromStopCode?: string
  toStopCode?: string
  fromName?: string
  toName?: string
}

type ContextItinerary = { index: number; legs: ContextLeg[] }
type RenderContext = {
  version: number
  updatedAt: number
  type: string
  selectedItinerary?: number
  selectedLeg?: number
  selectedRoute?: ContextLineRef
  line?: ContextLineRef
  routes?: ContextLineRef[]
  itineraries?: ContextItinerary[]
}

const CONTEXT_FILE = FileManager.appGroupDocumentsDirectory + "/israel-transit-context.json"

function clean<T extends Record<string, any>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined && v !== null && v !== "")) as T
}

function lineRef(line: any): ContextLineRef {
  return clean({
    lineNumber: String(line?.lineNumber ?? line?.routeNumber ?? line?.route ?? "") || undefined,
    routeId: line?.routeId ? String(line.routeId) : undefined,
    routeCode: line?.routeCode || line?.code ? String(line.routeCode || line.code) : undefined,
    direction: line?.direction !== undefined ? String(line.direction) : undefined,
    alternative: line?.alternative !== undefined ? String(line.alternative) : undefined,
    agency: line?.agency ? String(line.agency) : undefined,
    headsign: line?.headsign || line?.routeLongName || line?.longName ? String(line.headsign || line.routeLongName || line.longName) : undefined,
  })
}

function contextFromConfig(config: TransitConfig): RenderContext {
  const base: RenderContext = { version: 1, updatedAt: Date.now(), type: config.type }
  if (config.type === "trip-plan") {
    base.selectedItinerary = 0
    base.itineraries = config.itineraries.slice(0, 5).map((it, itineraryIndex) => ({
      index: itineraryIndex,
      legs: it.legs.map((leg, index) => clean({
        index,
        mode: String(leg.mode || ""),
        lineNumber: leg.route ? String(leg.route) : undefined,
        routeId: leg.routeId ? String(leg.routeId) : undefined,
        tripId: leg.tripId ? String(leg.tripId) : undefined,
        agency: leg.agency ? String(leg.agency) : undefined,
        headsign: leg.headsign ? String(leg.headsign) : undefined,
        fromStopCode: leg.from?.stopCode ? String(leg.from.stopCode) : undefined,
        toStopCode: leg.to?.stopCode ? String(leg.to.stopCode) : undefined,
        fromName: leg.from?.name,
        toName: leg.to?.name,
      }) as ContextLeg),
    }))
  } else if (config.type === "line" || config.type === "line-live") {
    base.line = lineRef(config.line)
    base.selectedRoute = base.line
  } else if (config.type === "stop-board") {
    base.routes = (config.routes || []).slice(0, 24).map(lineRef)
  } else if (config.type === "line-candidates") {
    base.routes = (config.lines || []).slice(0, 24).map(lineRef)
  }
  return base
}

export function saveRenderContext(config: TransitConfig): void {
  try {
    FileManager.writeAsStringSync(CONTEXT_FILE, JSON.stringify(contextFromConfig(config)))
  } catch {}
}

export function loadRenderContext(): RenderContext | null {
  try {
    if (!FileManager.existsSync(CONTEXT_FILE)) return null
    const raw = FileManager.readAsStringSync(CONTEXT_FILE)
    const parsed = JSON.parse(raw)
    return parsed && parsed.version === 1 ? parsed as RenderContext : null
  } catch {
    return null
  }
}

export function updateRenderSelection(patch: { selectedItinerary?: number; selectedLeg?: number; selectedRoute?: ContextLineRef }): void {
  try {
    const current = loadRenderContext()
    if (!current) return
    const next = { ...current, ...patch, updatedAt: Date.now() }
    FileManager.writeAsStringSync(CONTEXT_FILE, JSON.stringify(next))
  } catch {}
}

export function resolveContextLine(options: { lineNumber?: string; itineraryIndex?: number; legIndex?: number } = {}): ContextLineRef | null {
  const ctx = loadRenderContext()
  if (!ctx) return null
  const requestedLine = options.lineNumber ? String(options.lineNumber) : undefined
  const matches = (line?: ContextLineRef) => !!line && (!requestedLine || String(line.lineNumber || "") === requestedLine)

  if (matches(ctx.selectedRoute)) return ctx.selectedRoute || null

  const itineraryIndex = options.itineraryIndex ?? ctx.selectedItinerary ?? 0
  const itinerary = ctx.itineraries?.find(x => x.index === itineraryIndex) || ctx.itineraries?.[0]
  if (itinerary) {
    const preferredLegIndex = options.legIndex ?? ctx.selectedLeg
    if (preferredLegIndex !== undefined) {
      const leg = itinerary.legs.find(x => x.index === preferredLegIndex)
      if (matches(leg)) return leg || null
    }
    const leg = itinerary.legs.find(x => x.routeId && matches(x))
    if (leg) return leg
  }

  if (matches(ctx.line)) return ctx.line || null
  const route = ctx.routes?.find(matches)
  return route || null
}
