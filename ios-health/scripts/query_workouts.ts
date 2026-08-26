import { Script } from "scripting"

// Query workout sessions in a date range. Each workout returns activity type,
// time range, duration, distance, calories, average/max heart rate.
const params = Script.queryParameters
const startDateStr = params.start_date as string | undefined
const endDateStr = params.end_date as string | undefined
const limit = typeof params.limit === "number" ? (params.limit as number) : 50

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

// Map HealthWorkoutActivityType enum numeric values to human-readable names.
// Values mirror the HealthWorkoutActivityType enum in the Scripting API.
const ACTIVITY_NAME: Record<number, string> = {
  1: "American Football", 2: "Archery", 3: "Australian Football", 4: "Badminton",
  5: "Baseball", 6: "Basketball", 7: "Bowling", 8: "Boxing", 9: "Climbing",
  10: "Cricket", 11: "Cross Training", 12: "Curling", 13: "Cycling",
  14: "Dance", 15: "Dance-Inspired Training", 16: "Elliptical",
  17: "Equestrian Sports", 18: "Fencing", 19: "Fishing",
  20: "Functional Strength Training", 21: "Golf", 22: "Gymnastics",
  23: "Handball", 24: "Hiking", 25: "Hockey", 26: "Hunting", 27: "Lacrosse",
  28: "Martial Arts", 29: "Mind and Body", 30: "Mixed Metabolic Cardio",
  31: "Paddle Sports", 32: "Play", 33: "Preparation and Recovery",
  34: "Racquetball", 35: "Rowing", 36: "Rugby", 37: "Running", 38: "Sailing",
  39: "Skating Sports", 40: "Snow Sports", 41: "Soccer", 42: "Softball",
  43: "Squash", 44: "Stair Climbing", 45: "Surfing Sports", 46: "Swimming",
  47: "Table Tennis", 48: "Tennis", 49: "Track and Field",
  50: "Traditional Strength Training", 51: "Volleyball", 52: "Walking",
  53: "Water Fitness", 54: "Water Polo", 55: "Water Sports", 56: "Wrestling",
  57: "Yoga", 58: "Barre", 59: "Core Training", 60: "Cross-Country Skiing",
  61: "Downhill Skiing", 62: "Flexibility", 63: "HIIT", 64: "Jump Rope",
  65: "Kickboxing", 66: "Pilates", 67: "Snowboarding", 68: "Stairs",
  69: "Step Training", 70: "Wheelchair Walk Pace", 71: "Wheelchair Run Pace",
  72: "Tai Chi", 73: "Mixed Cardio", 74: "Hand Cycling", 75: "Disc Sports",
  76: "Fitness Gaming", 77: "Cardio Dance", 78: "Social Dance",
  79: "Pickleball", 80: "Cooldown", 82: "Swim Bike Run", 83: "Transition",
  84: "Underwater Diving", 3000: "Other",
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

    const workouts = await Health.queryWorkouts({
      startDate, endDate,
      limit,
      sortDescriptors: [{ key: "startDate", order: "reverse" }],
      // Also ask for these so we can read stats without a second prompt.
      requestPermissions: ["heartRate", "activeEnergyBurned", "distanceWalkingRunning", "distanceCycling", "distanceSwimming"],
    })

    const kmUnit = HealthUnit.meterUnit(HealthMetricPrefix.kilo)
    const kcalUnit = HealthUnit.kilocalorie()
    const bpmUnit = HealthUnit.count().divided(HealthUnit.minute())

    const items = workouts.map(w => {
      const typeNum = w.workoutActivityType as unknown as number
      const activityName = ACTIVITY_NAME[typeNum] ?? `Type ${typeNum}`
      const durationMin = w.duration / 60

      // Distance: pick whichever distance stat is present. Different activity
      // types use different distance quantity types.
      const distStat =
        w.allStatistics["distanceWalkingRunning"] ??
        w.allStatistics["distanceCycling"] ??
        w.allStatistics["distanceSwimming"] ??
        w.allStatistics["distancePaddleSports"] ??
        w.allStatistics["distanceRowing"] ??
        null
      const distanceKm = distStat?.sumQuantity(kmUnit) ?? null

      const energyStat = w.allStatistics["activeEnergyBurned"] ?? null
      const kcal = energyStat?.sumQuantity(kcalUnit) ?? null

      const hrStat = w.allStatistics["heartRate"] ?? null
      const avgHr = hrStat?.averageQuantity(bpmUnit) ?? null
      const maxHr = hrStat?.maximumQuantity(bpmUnit) ?? null

      const parts: string[] = [`${formatMinutes(durationMin)}`]
      if (distanceKm != null) parts.push(`${Math.round(distanceKm * 100) / 100} km`)
      if (kcal != null) parts.push(`${Math.round(kcal)} kcal`)
      if (avgHr != null) parts.push(`avg ${Math.round(avgHr)} bpm`)

      return {
        uuid: w.uuid,
        activityType: typeNum,
        activityName,
        startDate: w.startDate.toISOString(),
        endDate: w.endDate.toISOString(),
        durationMinutes: Math.round(durationMin),
        durationFormatted: formatMinutes(durationMin),
        distanceKm: distanceKm == null ? null : Math.round(distanceKm * 100) / 100,
        kcal: kcal == null ? null : Math.round(kcal),
        avgHeartRateBpm: avgHr == null ? null : Math.round(avgHr),
        maxHeartRateBpm: maxHr == null ? null : Math.round(maxHr),
        source: w.sourceRevision.source.name,
        formatted: `${activityName} — ${parts.join(" · ")}`,
      }
    })

    // Aggregate totals.
    const totalMinutes = items.reduce((s, i) => s + i.durationMinutes, 0)
    const totalKcal = items.reduce((s, i) => s + (i.kcal ?? 0), 0)
    const totalKm = items.reduce((s, i) => s + (i.distanceKm ?? 0), 0)

    Script.exit({
      success: true,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      count: items.length,
      totals: {
        durationMinutes: totalMinutes,
        durationFormatted: formatMinutes(totalMinutes),
        kcal: Math.round(totalKcal),
        km: Math.round(totalKm * 100) / 100,
      },
      workouts: items,
    })
  } catch (error: any) {
    Script.exit({ success: false, error: error?.message ?? String(error) })
  }
}

main()
