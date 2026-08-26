import { Script } from "scripting"

const params = Script.queryParameters
const startDateStr = params.start_date as string | undefined
const endDateStr = params.end_date as string | undefined
const daily = toBool(params.daily)

function toBool(v: unknown): boolean {
  return v === true || v === 1 || v === "true" || v === "1"
}

function parseDate(raw: string, label: string): Date {
  // Accept "YYYY-MM-DD" (local start-of-day), "YYYY-MM-DD HH:mm:ss", or full ISO.
  const trimmed = raw.trim()
  // Pure date -> treat as local midnight
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-").map(n => parseInt(n, 10))
    const date = new Date(y, m - 1, d, 0, 0, 0, 0)
    if (isNaN(date.getTime())) throw new Error(`Invalid ${label}: ${raw}`)
    return date
  }
  // Date with space-separated time -> treat as local time
  const spaceMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (spaceMatch) {
    const [, y, m, d, h, mi, s] = spaceMatch
    const date = new Date(
      parseInt(y, 10),
      parseInt(m, 10) - 1,
      parseInt(d, 10),
      parseInt(h, 10),
      parseInt(mi, 10),
      s ? parseInt(s, 10) : 0,
      0,
    )
    if (isNaN(date.getTime())) throw new Error(`Invalid ${label}: ${raw}`)
    return date
  }
  // Fallback to Date parser (ISO with timezone, etc.)
  const date = new Date(trimmed)
  if (isNaN(date.getTime())) throw new Error(`Invalid ${label}: ${raw}`)
  return date
}

function formatLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

async function main() {
  if (!startDateStr || !endDateStr) {
    Script.exit({
      success: false,
      error: "Missing required parameters: start_date and end_date",
    })
    return
  }

  try {
    if (!Health.isHealthDataAvailable) {
      Script.exit({
        success: false,
        error: "Health data is not available on this device.",
      })
      return
    }

    const startDate = parseDate(startDateStr, "start_date")
    const endDate = parseDate(endDateStr, "end_date")

    if (endDate.getTime() <= startDate.getTime()) {
      Script.exit({
        success: false,
        error: `end_date (${endDateStr}) must be after start_date (${startDateStr}).`,
      })
      return
    }

    const countUnit = HealthUnit.count()

    // Total over the whole range.
    const stats = await Health.queryStatistics("stepCount", {
      startDate,
      endDate,
      statisticsOptions: "cumulativeSum",
    })
    const totalSteps = stats?.sumQuantity(countUnit) ?? 0

    const result: Record<string, any> = {
      success: true,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalSteps: Math.round(totalSteps),
    }

    if (daily) {
      // Anchor at local midnight of the start date so buckets align with calendar days.
      const anchorDate = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate(),
        0, 0, 0, 0,
      )
      const intervalComponents = new DateComponents({ day: 1 })
      const collection = await Health.queryStatisticsCollection("stepCount", {
        startDate,
        endDate,
        statisticsOptions: "cumulativeSum",
        anchorDate,
        intervalComponents,
      })

      const dailyResults = collection.statistics()
        .filter(s => s.startDate.getTime() < endDate.getTime() && s.endDate.getTime() > startDate.getTime())
        .map(s => ({
          date: formatLocalDate(s.startDate),
          steps: Math.round(s.sumQuantity(countUnit) ?? 0),
        }))

      result.daily = dailyResults
    }

    Script.exit(result)
  } catch (error: any) {
    Script.exit({
      success: false,
      error: error?.message ?? String(error),
    })
  }
}

main()
