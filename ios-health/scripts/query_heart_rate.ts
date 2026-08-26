import { Script } from "scripting"

// Query heart rate (bpm) over a date range: average / min / max / most-recent.
const params = Script.queryParameters
const startDateStr = params.start_date as string | undefined
const endDateStr = params.end_date as string | undefined

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

    // bpm = count / minute
    const bpm = HealthUnit.count().divided(HealthUnit.minute())

    const stats = await Health.queryStatistics("heartRate", {
      startDate, endDate,
      statisticsOptions: ["discreteAverage", "discreteMin", "discreteMax", "mostRecent"],
    })

    const avg = stats?.averageQuantity(bpm) ?? null
    const min = stats?.minimumQuantity(bpm) ?? null
    const max = stats?.maximumQuantity(bpm) ?? null
    const recent = stats?.mostRecentQuantity(bpm) ?? null
    const recentInterval = stats?.mostRecentQuantityDateInterval() ?? null

    const fmt = (v: number | null) => (v == null ? null : Math.round(v))

    const result = {
      success: true,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      unit: "bpm",
      averageBpm: fmt(avg),
      minBpm: fmt(min),
      maxBpm: fmt(max),
      mostRecentBpm: fmt(recent),
      mostRecentAt: recentInterval?.start ? recentInterval.start.toISOString() : null,
      formatted: {
        average: avg == null ? "—" : `${Math.round(avg)} bpm`,
        min: min == null ? "—" : `${Math.round(min)} bpm`,
        max: max == null ? "—" : `${Math.round(max)} bpm`,
        mostRecent: recent == null ? "—" : `${Math.round(recent)} bpm`,
      },
    }

    Script.exit(result)
  } catch (error: any) {
    Script.exit({ success: false, error: error?.message ?? String(error) })
  }
}

main()
