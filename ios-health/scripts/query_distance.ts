import { Script } from "scripting"

// Query walking + running distance in meters, reported as kilometers.
const params = Script.queryParameters
const startDateStr = params.start_date as string | undefined
const endDateStr = params.end_date as string | undefined
const daily = toBool(params.daily)

function toBool(v: unknown): boolean {
  return v === true || v === 1 || v === "true" || v === "1"
}

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

function formatLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function round(n: number, digits = 2): number {
  const f = Math.pow(10, digits)
  return Math.round(n * f) / f
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

    // Kilometer unit. Distance is stored in meters; use "kilo" metric prefix.
    const kmUnit = HealthUnit.meterUnit(HealthMetricPrefix.kilo)

    const stats = await Health.queryStatistics("distanceWalkingRunning", {
      startDate, endDate,
      statisticsOptions: "cumulativeSum",
    })
    const totalKm = stats?.sumQuantity(kmUnit) ?? 0

    const result: Record<string, any> = {
      success: true,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      unit: "km",
      totalKm: round(totalKm, 2),
      formatted: `${round(totalKm, 2)} km`,
    }

    if (daily) {
      const anchorDate = new Date(
        startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0,
      )
      const intervalComponents = new DateComponents({ day: 1 })
      const collection = await Health.queryStatisticsCollection("distanceWalkingRunning", {
        startDate, endDate,
        statisticsOptions: "cumulativeSum",
        anchorDate, intervalComponents,
      })

      result.daily = collection.statistics()
        .filter(s => s.startDate.getTime() < endDate.getTime() && s.endDate.getTime() > startDate.getTime())
        .map(s => {
          const km = s.sumQuantity(kmUnit) ?? 0
          return {
            date: formatLocalDate(s.startDate),
            km: round(km, 2),
            formatted: `${round(km, 2)} km`,
          }
        })
    }

    Script.exit(result)
  } catch (error: any) {
    Script.exit({ success: false, error: error?.message ?? String(error) })
  }
}

main()
