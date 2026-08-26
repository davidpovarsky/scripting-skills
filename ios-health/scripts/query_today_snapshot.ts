import { Script } from "scripting"

// One-shot "today" overview: steps, distance, active energy, exercise minutes,
// stand hours, activity ring goals, latest heart rate, latest resting heart rate,
// and last night's sleep. All queries are parallel so HealthKit shows a single
// merged permission prompt.
const params = Script.queryParameters
const sourceNameParam = params.source_name as string | undefined
const sourcePreferenceParam = params.source_preference as string | undefined

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfTomorrow(): Date {
  const d = startOfToday()
  d.setDate(d.getDate() + 1)
  return d
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000)
}

function formatMinutes(totalMin: number): string {
  const m = Math.round(totalMin)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r === 0 ? `${h} h` : `${h} h ${r} min`
}

function normalize(s: string | undefined | null): string {
  return (s ?? "").trim().toLowerCase()
}

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

async function getCumulative(
  type: HealthQuantityType,
  unit: HealthUnit,
  startDate: Date,
  endDate: Date,
): Promise<number> {
  const stats = await Health.queryStatistics(type, {
    startDate, endDate,
    statisticsOptions: "cumulativeSum",
  })
  return stats?.sumQuantity(unit) ?? 0
}

async function getMostRecent(
  type: HealthQuantityType,
  unit: HealthUnit,
  startDate: Date,
  endDate: Date,
): Promise<{ value: number; at: string } | null> {
  const stats = await Health.queryStatistics(type, {
    startDate, endDate,
    statisticsOptions: ["mostRecent"],
  })
  const v = stats?.mostRecentQuantity(unit)
  const interval = stats?.mostRecentQuantityDateInterval()
  if (v == null) return null
  return { value: v, at: interval?.start?.toISOString() ?? "" }
}

async function getActivitySummaryToday() {
  const today = new Date()
  const start = new DateComponents({
    calendar: "gregorian",
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    day: today.getDate(),
  })
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const end = new DateComponents({
    calendar: "gregorian",
    year: tomorrow.getFullYear(),
    month: tomorrow.getMonth() + 1,
    day: tomorrow.getDate(),
  })
  const summaries = await Health.queryActivitySummaries({ start, end })
  return summaries[0] ?? null
}

async function getSleepLastNight(now: Date, sourcePreference?: string, sourceName?: string) {
  // Last night = roughly window [now-18h, now]. Covers late-night-to-morning sleep.
  const windowStart = new Date(now.getTime() - 18 * 60 * 60 * 1000)
  const rawSamples = await Health.queryCategorySamples("sleepAnalysis", {
    startDate: windowStart,
    endDate: now,
    sortDescriptors: [{ key: "startDate", order: "forward" }],
  })

  // "Actually asleep" excludes inBed (0) and awake (2).
  const ASLEEP = new Set<number>([1, 3, 4, 5])
  const stageName: Record<number, string> = {
    0: "inBed", 1: "asleepUnspecified", 2: "awake",
    3: "asleepCore", 4: "asleepDeep", 5: "asleepREM",
  }

  const enrichedSamples = rawSamples
    .map((s: any) => ({
      startDate: s.startDate,
      endDate: s.endDate,
      value: s.value,
      source: s?.sourceRevision?.source?.name ?? "Unknown source",
    }))
    .filter((s: any) => s.endDate?.getTime?.() > s.startDate?.getTime?.())

  if (enrichedSamples.length === 0) return null

  const availableSources = Array.from(new Set(enrichedSamples.map((s: any) => s.source)))
  const selectedSource = chooseSource(availableSources, sourcePreference, sourceName)

  if (sourceName && !selectedSource) {
    throw new Error(`Requested source not found: ${sourceName}. Available sources: ${availableSources.join(", ")}`)
  }

  const samples = selectedSource
    ? enrichedSamples.filter((s: any) => s.source === selectedSource)
    : enrichedSamples

  let asleepMin = 0
  const stages: Record<string, number> = {
    inBed: 0, asleepUnspecified: 0, awake: 0,
    asleepCore: 0, asleepDeep: 0, asleepREM: 0,
  }

  let sessionStart: Date | null = null
  let sessionEnd: Date | null = null

  for (const s of samples) {
    const durMs = s.endDate.getTime() - s.startDate.getTime()
    if (durMs <= 0) continue
    const durMin = durMs / 60000
    const name = stageName[s.value]
    if (name) stages[name] += durMin
    if (ASLEEP.has(s.value)) asleepMin += durMin
    if (!sessionStart || s.startDate < sessionStart) sessionStart = s.startDate
    if (!sessionEnd || s.endDate > sessionEnd) sessionEnd = s.endDate
  }

  if (samples.length === 0) return null

  return {
    requestedSourceName: sourceName ?? null,
    requestedSourcePreference: sourcePreference ?? null,
    selectedSource: selectedSource ?? "all",
    availableSources,
    sessionStart: sessionStart?.toISOString() ?? null,
    sessionEnd: sessionEnd?.toISOString() ?? null,
    totalAsleepMinutes: Math.round(asleepMin),
    totalAsleepFormatted: formatMinutes(asleepMin),
    stageMinutes: Object.fromEntries(
      Object.entries(stages).map(([k, v]) => [k, Math.round(v)]),
    ),
  }
}

async function main() {
  try {
    if (!Health.isHealthDataAvailable) {
      Script.exit({ success: false, error: "Health data is not available on this device." })
      return
    }

    const now = new Date()
    const dayStart = startOfToday()
    const dayEnd = startOfTomorrow()

    const kmUnit = HealthUnit.meterUnit(HealthMetricPrefix.kilo)
    const kcalUnit = HealthUnit.kilocalorie()
    const minUnit = HealthUnit.minute()
    const countUnit = HealthUnit.count()
    const bpmUnit = HealthUnit.count().divided(HealthUnit.minute())

    // Parallel fire — merges permission prompts into one.
    const [
      steps, distanceKm, activeKcal, exerciseMin, flights,
      latestHr, latestRestingHr,
      summary,
      sleep,
    ] = await Promise.all([
      getCumulative("stepCount", countUnit, dayStart, dayEnd),
      getCumulative("distanceWalkingRunning", kmUnit, dayStart, dayEnd),
      getCumulative("activeEnergyBurned", kcalUnit, dayStart, dayEnd),
      getCumulative("appleExerciseTime", minUnit, dayStart, dayEnd),
      getCumulative("flightsClimbed", countUnit, dayStart, dayEnd),
      // Most-recent heart rate within the last 24h (can be outside "today" before morning).
      getMostRecent("heartRate", bpmUnit, hoursAgo(24), now),
      // Most-recent resting heart rate in the last 7 days (updated less frequently).
      getMostRecent("restingHeartRate", bpmUnit, hoursAgo(24 * 7), now),
      getActivitySummaryToday(),
      getSleepLastNight(now, sourcePreferenceParam, sourceNameParam),
    ])

    // Assemble activity-ring view.
    let rings: any = null
    if (summary) {
      const moveMode = summary.activityMoveMode
      const isEnergyMode = moveMode === HealthActivityMoveMode.activeEnergy
      const moveActual = isEnergyMode
        ? summary.activeEnergyBurned(kcalUnit)
        : summary.appleMoveTime(minUnit)
      const moveGoal = isEnergyMode
        ? summary.activeEnergyBurnedGoal(kcalUnit)
        : summary.appleMoveTimeGoal(minUnit)
      const exerciseActual = summary.appleExerciseTime(minUnit)
      const exerciseGoal = summary.appleExerciseTimeGoal(minUnit)
      const standActual = summary.appleStandHours(countUnit)
      const standGoal = summary.appleStandHoursGoal(countUnit)
      const pct = (a: number, g: number) => (g > 0 ? Math.round((a / g) * 100) : null)

      rings = {
        moveMode: isEnergyMode ? "activeEnergy" : "appleMoveTime",
        move: {
          actual: Math.round(moveActual),
          goal: Math.round(moveGoal),
          unit: isEnergyMode ? "kcal" : "minute",
          percent: pct(moveActual, moveGoal),
          formatted: isEnergyMode
            ? `${Math.round(moveActual)} / ${Math.round(moveGoal)} kcal`
            : `${formatMinutes(moveActual)} / ${formatMinutes(moveGoal)}`,
        },
        exercise: {
          minutes: Math.round(exerciseActual),
          goalMinutes: Math.round(exerciseGoal),
          percent: pct(exerciseActual, exerciseGoal),
          formatted: `${Math.round(exerciseActual)} / ${Math.round(exerciseGoal)} min`,
        },
        stand: {
          hours: Math.round(standActual),
          goalHours: Math.round(standGoal),
          percent: pct(standActual, standGoal),
          formatted: `${Math.round(standActual)} / ${Math.round(standGoal)} hr`,
        },
      }
    }

    Script.exit({
      success: true,
      asOf: now.toISOString(),
      dayStart: dayStart.toISOString(),
      dayEnd: dayEnd.toISOString(),
      today: {
        steps: Math.round(steps),
        distanceKm: Math.round(distanceKm * 100) / 100,
        activeKcal: Math.round(activeKcal),
        exerciseMinutes: Math.round(exerciseMin),
        flightsClimbed: Math.round(flights),
        formatted: {
          steps: `${Math.round(steps)} steps`,
          distance: `${Math.round(distanceKm * 100) / 100} km`,
          activeEnergy: `${Math.round(activeKcal)} kcal`,
          exercise: formatMinutes(exerciseMin),
          flights: `${Math.round(flights)} floors`,
        },
      },
      heartRate: {
        latestBpm: latestHr == null ? null : Math.round(latestHr.value),
        latestAt: latestHr?.at ?? null,
        restingBpm: latestRestingHr == null ? null : Math.round(latestRestingHr.value),
        restingAt: latestRestingHr?.at ?? null,
      },
      rings,
      sleepLastNight: sleep,
    })
  } catch (error: any) {
    Script.exit({ success: false, error: error?.message ?? String(error) })
  }
}

main()
