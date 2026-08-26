import { Script } from "scripting"

const params = Script.queryParameters

const startDateStr = params.start_date as string | undefined
const endDateStr = params.end_date as string | undefined
const metric = (params.metric as string) || "all" // "weight", "height", "bmi", "all"

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

function formatWeight(kg: number): string {
  return `${kg.toFixed(1)} kg`
}

function formatHeight(cm: number): string {
  return `${cm.toFixed(1)} cm`
}

function formatBMI(bmi: number): string {
  let category = ""
  if (bmi < 18.5) category = "偏瘦"
  else if (bmi < 24) category = "正常"
  else if (bmi < 28) category = "偏胖"
  else category = "肥胖"
  return `${bmi.toFixed(1)} (${category})`
}

async function main() {
  try {
    if (!Health.isHealthDataAvailable) {
      Script.exit({ success: false, error: "Health data is not available on this device." })
      return
    }

    const now = new Date()
    const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const startDate = startDateStr ? parseDate(startDateStr, "start_date") : defaultStart
    const endDate = endDateStr ? parseDate(endDateStr, "end_date") : now

    const result: Record<string, any> = {
      success: true,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    }

    // Units
    const kgUnit = HealthUnit.gramUnit(HealthMetricPrefix.kilo)
    const cmUnit = HealthUnit.meterUnit(HealthMetricPrefix.centi)
    const countUnit = HealthUnit.count()

    // Query weight (bodyMass)
    if (metric === "all" || metric === "weight") {
      const stats = await Health.queryStatistics("bodyMass", {
        startDate, endDate,
        statisticsOptions: ["discreteAverage", "discreteMin", "discreteMax", "mostRecent"],
      })

      const avg = stats?.averageQuantity(kgUnit) ?? null
      const min = stats?.minimumQuantity(kgUnit) ?? null
      const max = stats?.maximumQuantity(kgUnit) ?? null
      const recent = stats?.mostRecentQuantity(kgUnit) ?? null
      const recentInterval = stats?.mostRecentQuantityDateInterval() ?? null

      if (recent != null) {
        result.weight = {
          latest: Math.round(recent * 10) / 10,
          latestFormatted: formatWeight(recent),
          latestDate: recentInterval?.start?.toISOString() ?? null,
          average: avg != null ? Math.round(avg * 10) / 10 : null,
          averageFormatted: avg != null ? formatWeight(avg) : null,
          min: min != null ? Math.round(min * 10) / 10 : null,
          minFormatted: min != null ? formatWeight(min) : null,
          max: max != null ? Math.round(max * 10) / 10 : null,
          maxFormatted: max != null ? formatWeight(max) : null,
        }
      } else {
        result.weight = { message: "No weight data found" }
      }
    }

    // Query height
    if (metric === "all" || metric === "height") {
      const stats = await Health.queryStatistics("height", {
        startDate, endDate,
        statisticsOptions: ["discreteAverage", "mostRecent"],
      })

      const avg = stats?.averageQuantity(cmUnit) ?? null
      const recent = stats?.mostRecentQuantity(cmUnit) ?? null
      const recentInterval = stats?.mostRecentQuantityDateInterval() ?? null

      if (recent != null) {
        result.height = {
          latest: Math.round(recent * 10) / 10,
          latestFormatted: formatHeight(recent),
          latestDate: recentInterval?.start?.toISOString() ?? null,
          average: avg != null ? Math.round(avg * 10) / 10 : null,
          averageFormatted: avg != null ? formatHeight(avg) : null,
        }
      } else {
        result.height = { message: "No height data found" }
      }
    }

    // Query BMI
    if (metric === "all" || metric === "bmi") {
      const stats = await Health.queryStatistics("bodyMassIndex", {
        startDate, endDate,
        statisticsOptions: ["discreteAverage", "discreteMin", "discreteMax", "mostRecent"],
      })

      const avg = stats?.averageQuantity(countUnit) ?? null
      const min = stats?.minimumQuantity(countUnit) ?? null
      const max = stats?.maximumQuantity(countUnit) ?? null
      const recent = stats?.mostRecentQuantity(countUnit) ?? null
      const recentInterval = stats?.mostRecentQuantityDateInterval() ?? null

      if (recent != null) {
        result.bmi = {
          latest: Math.round(recent * 10) / 10,
          latestFormatted: formatBMI(recent),
          latestDate: recentInterval?.start?.toISOString() ?? null,
          average: avg != null ? Math.round(avg * 10) / 10 : null,
          averageFormatted: avg != null ? formatBMI(avg) : null,
          min: min != null ? Math.round(min * 10) / 10 : null,
          max: max != null ? Math.round(max * 10) / 10 : null,
        }
      } else {
        // Calculate BMI from weight and height if available
        if (result.weight?.latest && result.height?.latest) {
          const heightInMeters = result.height.latest / 100
          const calculatedBMI = result.weight.latest / (heightInMeters * heightInMeters)
          result.bmi = {
            calculated: Math.round(calculatedBMI * 10) / 10,
            calculatedFormatted: formatBMI(calculatedBMI),
            source: "calculated from weight and height",
          }
        } else {
          result.bmi = { message: "No BMI data found" }
        }
      }
    }

    // Query body fat percentage
    if (metric === "all" || metric === "bodyFat") {
      const stats = await Health.queryStatistics("bodyFatPercentage", {
        startDate, endDate,
        statisticsOptions: ["discreteAverage", "discreteMin", "discreteMax", "mostRecent"],
      })

      const pctUnit = HealthUnit.percent()
      const avg = stats?.averageQuantity(pctUnit) ?? null
      const recent = stats?.mostRecentQuantity(pctUnit) ?? null
      const recentInterval = stats?.mostRecentQuantityDateInterval() ?? null

      if (recent != null) {
        result.bodyFat = {
          latest: Math.round(recent * 1000) / 10,
          latestFormatted: `${(recent * 100).toFixed(1)}%`,
          latestDate: recentInterval?.start?.toISOString() ?? null,
          average: avg != null ? Math.round(avg * 1000) / 10 : null,
          averageFormatted: avg != null ? `${(avg * 100).toFixed(1)}%` : null,
        }
      } else {
        result.bodyFat = { message: "No body fat data found" }
      }
    }

    // Query waist circumference
    if (metric === "all" || metric === "waist") {
      const stats = await Health.queryStatistics("waistCircumference", {
        startDate, endDate,
        statisticsOptions: ["discreteAverage", "discreteMin", "discreteMax", "mostRecent"],
      })

      const avg = stats?.averageQuantity(cmUnit) ?? null
      const recent = stats?.mostRecentQuantity(cmUnit) ?? null
      const recentInterval = stats?.mostRecentQuantityDateInterval() ?? null

      if (recent != null) {
        result.waist = {
          latest: Math.round(recent * 10) / 10,
          latestFormatted: `${recent.toFixed(1)} cm`,
          latestDate: recentInterval?.start?.toISOString() ?? null,
          average: avg != null ? Math.round(avg * 10) / 10 : null,
          averageFormatted: avg != null ? `${avg.toFixed(1)} cm` : null,
        }
      } else {
        result.waist = { message: "No waist circumference data found" }
      }
    }

    Script.exit(result)
  } catch (error: any) {
    Script.exit({ success: false, error: error?.message ?? String(error) })
  }
}

main()
