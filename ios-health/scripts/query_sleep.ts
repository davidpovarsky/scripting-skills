import { Script } from "scripting"

// Query sleep analysis samples over a date range and summarize total sleep
// plus per-stage breakdown (inBed / asleepCore / asleepDeep / asleepREM / awake / asleepUnspecified).
const params = Script.queryParameters
const startDateStr = params.start_date as string | undefined
const endDateStr = params.end_date as string | undefined
const sourceNameParam = params.source_name as string | undefined
const sourcePreferenceParam = params.source_preference as string | undefined
const includeSourceSummaryParam = params.include_source_summary

function parseDate(raw: string, label: string): Date {
  const trimmed = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-").map(n => parseInt(n, 10))
    const date = new Date(y, m - 1, d, 0, 0, 0, 0)
    if (isNaN(date.getTime())) throw new Error(`Invalid ${label}: ${raw}`)
    return date
  }
  const spaceMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (spaceMatch) {
    const [, y, m, d, h, mi, s] = spaceMatch
    const date = new Date(
      parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10),
      parseInt(h, 10), parseInt(mi, 10), s ? parseInt(s, 10) : 0, 0,
    )
    if (isNaN(date.getTime())) throw new Error(`Invalid ${label}: ${raw}`)
    return date
  }
  const date = new Date(trimmed)
  if (isNaN(date.getTime())) throw new Error(`Invalid ${label}: ${raw}`)
  return date
}

function formatMinutes(totalMin: number): string {
  const m = Math.round(totalMin)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r === 0 ? `${h} h` : `${h} h ${r} min`
}

function toBool(value: any, defaultValue: boolean): boolean {
  if (value == null) return defaultValue
  if (typeof value === "boolean") return value
  const s = String(value).trim().toLowerCase()
  if (["1", "true", "yes", "y"].includes(s)) return true
  if (["0", "false", "no", "n"].includes(s)) return false
  return defaultValue
}

function normalize(s: string | undefined | null): string {
  return (s ?? "").trim().toLowerCase()
}

// Matches the HealthCategoryValueSleepAnalysis enum values.
const STAGE_NAME: Record<number, string> = {
  0: "inBed",
  1: "asleepUnspecified",
  2: "awake",
  3: "asleepCore",
  4: "asleepDeep",
  5: "asleepREM",
}

// "Actually asleep" excludes inBed (usually a superset) and awake.
const ASLEEP_VALUES = new Set<number>([1, 3, 4, 5])

function chooseSource(sourceNames: string[], sourcePreference?: string, exactSourceName?: string): string | null {
  if (sourceNames.length === 0) return null

  if (exactSourceName && exactSourceName.trim()) {
    const target = normalize(exactSourceName)
    const exact = sourceNames.find(name => normalize(name) === target)
    if (exact) return exact
    const partial = sourceNames.find(name => normalize(name).includes(target))
    if (partial) return partial
    return null
  }

  const pref = normalize(sourcePreference)
  if (pref === "all") return null

  if (pref === "watch" || pref === "apple_watch") {
    const watch = sourceNames.find(name => normalize(name).includes("watch"))
    if (watch) return watch
  }

  if (pref === "iphone" || pref === "phone") {
    const phone = sourceNames.find(name => {
      const n = normalize(name)
      return n.includes("iphone") || n.includes("phone")
    })
    if (phone) return phone
  }

  const watch = sourceNames.find(name => normalize(name).includes("watch"))
  if (watch) return watch

  return sourceNames[0]
}

async function main() {
  if (!startDateStr || !endDateStr) {
    Script.exit({ success: false, error: "Missing required parameters: start_date and end_date" })
    return
  }

  try {
    if (!Health.isHealthDataAvailable) {
      Script.exit({ success: false, error: "Health data is not available on this device." })
      return
    }

    const startDate = parseDate(startDateStr, "start_date")
    const endDate = parseDate(endDateStr, "end_date")
    if (endDate.getTime() <= startDate.getTime()) {
      Script.exit({ success: false, error: `end_date (${endDateStr}) must be after start_date (${startDateStr}).` })
      return
    }

    const includeSourceSummary = toBool(includeSourceSummaryParam, true)

    const rawSamples = await Health.queryCategorySamples("sleepAnalysis", {
      startDate, endDate,
      sortDescriptors: [{ key: "startDate", order: "forward" }],
    })

    const enrichedSamples = rawSamples
      .map((s: any) => ({
        raw: s,
        startDate: s.startDate,
        endDate: s.endDate,
        value: s.value,
        source: s?.sourceRevision?.source?.name ?? "Unknown source",
      }))
      .filter((s: any) => s.endDate?.getTime?.() > s.startDate?.getTime?.())

    const sourceMap: Record<string, { sampleCount: number; asleepMinutes: number; stageMinutes: Record<string, number> }> = {}
    for (const s of enrichedSamples) {
      const source = s.source
      const durMin = (s.endDate.getTime() - s.startDate.getTime()) / 60000
      if (!sourceMap[source]) {
        sourceMap[source] = { sampleCount: 0, asleepMinutes: 0, stageMinutes: {} }
      }
      sourceMap[source].sampleCount += 1
      const stage = STAGE_NAME[s.value] ?? "unknown"
      sourceMap[source].stageMinutes[stage] = (sourceMap[source].stageMinutes[stage] ?? 0) + durMin
      if (ASLEEP_VALUES.has(s.value)) sourceMap[source].asleepMinutes += durMin
    }

    const availableSources = Object.keys(sourceMap)
    const selectedSource = chooseSource(availableSources, sourcePreferenceParam, sourceNameParam)

    if (sourceNameParam && !selectedSource) {
      Script.exit({
        success: false,
        error: `Requested source not found: ${sourceNameParam}`,
        availableSources,
      })
      return
    }

    const samples = selectedSource
      ? enrichedSamples.filter((s: any) => s.source === selectedSource)
      : enrichedSamples

    // Aggregate stage durations (minutes).
    const stageMinutes: Record<string, number> = {
      inBed: 0,
      asleepUnspecified: 0,
      awake: 0,
      asleepCore: 0,
      asleepDeep: 0,
      asleepREM: 0,
    }
    let asleepMinutes = 0

    for (const s of samples) {
      const durMs = s.endDate.getTime() - s.startDate.getTime()
      if (durMs <= 0) continue
      const durMin = durMs / 60000
      const name = STAGE_NAME[s.value] ?? "unknown"
      if (!(name in stageMinutes)) stageMinutes[name] = 0
      stageMinutes[name] += durMin
      if (ASLEEP_VALUES.has(s.value)) asleepMinutes += durMin
    }

    // Count distinct sleep sessions: collapse consecutive samples with gap < 1h.
    const sortedSamples = [...samples].sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
    let sessions = 0
    let lastEnd = -Infinity
    for (const s of sortedSamples) {
      if (s.startDate.getTime() - lastEnd > 60 * 60 * 1000) sessions++
      lastEnd = Math.max(lastEnd, s.endDate.getTime())
    }

    const stageFormatted: Record<string, string> = {}
    const stageRounded: Record<string, number> = {}
    for (const [k, v] of Object.entries(stageMinutes)) {
      stageRounded[k] = Math.round(v)
      stageFormatted[k] = formatMinutes(v)
    }

    const sourceSummaries = includeSourceSummary
      ? Object.entries(sourceMap)
          .map(([source, item]) => ({
            source,
            sampleCount: item.sampleCount,
            asleepMinutes: Math.round(item.asleepMinutes),
            asleepFormatted: formatMinutes(item.asleepMinutes),
            stageMinutes: Object.fromEntries(
              Object.entries(item.stageMinutes).map(([k, v]) => [k, Math.round(v)])
            ),
          }))
          .sort((a, b) => b.asleepMinutes - a.asleepMinutes)
      : undefined

    Script.exit({
      success: true,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      requestedSourceName: sourceNameParam ?? null,
      requestedSourcePreference: sourcePreferenceParam ?? null,
      selectedSource: selectedSource ?? "all",
      availableSources,
      sampleCount: samples.length,
      sessionCount: sessions,
      totalAsleepMinutes: Math.round(asleepMinutes),
      totalAsleepFormatted: formatMinutes(asleepMinutes),
      stageMinutes: stageRounded,
      stageFormatted,
      sourceSummaries,
    })
  } catch (error: any) {
    Script.exit({ success: false, error: error?.message ?? String(error) })
  }
}

main()
