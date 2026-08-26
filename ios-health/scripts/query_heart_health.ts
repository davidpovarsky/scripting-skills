import { Script } from "scripting"

const params = Script.queryParameters

const startDateStr = params.start_date as string | undefined
const endDateStr = params.end_date as string | undefined
const metric = (params.metric as string) || "all" // "hrv", "resting", "walking", "current", "vo2max", "all"

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

function formatHRV(ms: number): string {
  let status = ""
  if (ms >= 50) status = "良好"
  else if (ms >= 30) status = "一般"
  else status = "偏低"
  return `${ms.toFixed(0)} ms (${status})`
}

function formatRestingHeartRate(bpm: number): string {
  let status = ""
  if (bpm >= 60 && bpm <= 100) status = "正常"
  else if (bpm < 60) status = "偏低（运动员常见）"
  else status = "偏高"
  return `${bpm.toFixed(0)} bpm (${status})`
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
    const bpmUnit = HealthUnit.count().divided(HealthUnit.minute())
    const msUnit = HealthUnit.secondUnit(HealthMetricPrefix.milli) // milliseconds
    const vo2Unit = HealthUnit.fromString("mL/min·kg") // VO2 Max unit

    // Query heart rate variability (HRV)
    if (metric === "all" || metric === "hrv") {
      const stats = await Health.queryStatistics("heartRateVariabilitySDNN", {
        startDate, endDate,
        statisticsOptions: ["discreteAverage", "discreteMin", "discreteMax", "mostRecent"],
      })

      const avg = stats?.averageQuantity(msUnit) ?? null
      const min = stats?.minimumQuantity(msUnit) ?? null
      const max = stats?.maximumQuantity(msUnit) ?? null
      const recent = stats?.mostRecentQuantity(msUnit) ?? null
      const recentInterval = stats?.mostRecentQuantityDateInterval() ?? null

      if (recent != null) {
        result.hrv = {
          latest: Math.round(recent),
          latestFormatted: formatHRV(recent),
          latestDate: recentInterval?.start?.toISOString() ?? null,
          average: avg != null ? Math.round(avg) : null,
          averageFormatted: avg != null ? formatHRV(avg) : null,
          min: min != null ? Math.round(min) : null,
          max: max != null ? Math.round(max) : null,
        }
      } else {
        result.hrv = { message: "No HRV data found" }
      }
    }

    // Query resting heart rate
    if (metric === "all" || metric === "resting") {
      const stats = await Health.queryStatistics("restingHeartRate", {
        startDate, endDate,
        statisticsOptions: ["discreteAverage", "discreteMin", "discreteMax", "mostRecent"],
      })

      const avg = stats?.averageQuantity(bpmUnit) ?? null
      const min = stats?.minimumQuantity(bpmUnit) ?? null
      const max = stats?.maximumQuantity(bpmUnit) ?? null
      const recent = stats?.mostRecentQuantity(bpmUnit) ?? null
      const recentInterval = stats?.mostRecentQuantityDateInterval() ?? null

      if (recent != null) {
        result.restingHeartRate = {
          latest: Math.round(recent),
          latestFormatted: formatRestingHeartRate(recent),
          latestDate: recentInterval?.start?.toISOString() ?? null,
          average: avg != null ? Math.round(avg) : null,
          averageFormatted: avg != null ? formatRestingHeartRate(avg) : null,
          min: min != null ? Math.round(min) : null,
          max: max != null ? Math.round(max) : null,
        }
      } else {
        result.restingHeartRate = { message: "No resting heart rate data found" }
      }
    }

    // Query walking heart rate average
    if (metric === "all" || metric === "walking") {
      const stats = await Health.queryStatistics("walkingHeartRateAverage", {
        startDate, endDate,
        statisticsOptions: ["discreteAverage", "discreteMin", "discreteMax", "mostRecent"],
      })

      const avg = stats?.averageQuantity(bpmUnit) ?? null
      const recent = stats?.mostRecentQuantity(bpmUnit) ?? null
      const recentInterval = stats?.mostRecentQuantityDateInterval() ?? null

      if (recent != null) {
        result.walkingHeartRate = {
          latest: Math.round(recent),
          latestFormatted: `${Math.round(recent)} bpm`,
          latestDate: recentInterval?.start?.toISOString() ?? null,
          average: avg != null ? Math.round(avg) : null,
          averageFormatted: avg != null ? `${Math.round(avg)} bpm` : null,
        }
      } else {
        result.walkingHeartRate = { message: "No walking heart rate data found" }
      }
    }

    // Query current heart rate
    if (metric === "all" || metric === "current") {
      const stats = await Health.queryStatistics("heartRate", {
        startDate, endDate,
        statisticsOptions: ["discreteAverage", "discreteMin", "discreteMax", "mostRecent"],
      })

      const avg = stats?.averageQuantity(bpmUnit) ?? null
      const min = stats?.minimumQuantity(bpmUnit) ?? null
      const max = stats?.maximumQuantity(bpmUnit) ?? null
      const recent = stats?.mostRecentQuantity(bpmUnit) ?? null
      const recentInterval = stats?.mostRecentQuantityDateInterval() ?? null

      if (recent != null) {
        result.heartRate = {
          latest: Math.round(recent),
          latestFormatted: `${Math.round(recent)} bpm`,
          latestDate: recentInterval?.start?.toISOString() ?? null,
          average: avg != null ? Math.round(avg) : null,
          averageFormatted: avg != null ? `${Math.round(avg)} bpm` : null,
          min: min != null ? Math.round(min) : null,
          max: max != null ? Math.round(max) : null,
        }
      } else {
        result.heartRate = { message: "No heart rate data found" }
      }
    }

    // Query VO2 Max
    if (metric === "all" || metric === "vo2max") {
      const stats = await Health.queryStatistics("vo2Max", {
        startDate, endDate,
        statisticsOptions: ["discreteAverage", "discreteMin", "discreteMax", "mostRecent"],
      })

      const avg = stats?.averageQuantity(vo2Unit) ?? null
      const recent = stats?.mostRecentQuantity(vo2Unit) ?? null
      const recentInterval = stats?.mostRecentQuantityDateInterval() ?? null

      if (recent != null) {
        let fitnessLevel = ""
        if (recent >= 40) fitnessLevel = "优秀"
        else if (recent >= 35) fitnessLevel = "良好"
        else if (recent >= 30) fitnessLevel = "一般"
        else fitnessLevel = "需提升"

        result.vo2Max = {
          latest: Math.round(recent * 10) / 10,
          latestFormatted: `${recent.toFixed(1)} mL/min/kg (${fitnessLevel})`,
          latestDate: recentInterval?.start?.toISOString() ?? null,
          average: avg != null ? Math.round(avg * 10) / 10 : null,
          averageFormatted: avg != null ? `${avg.toFixed(1)} mL/min/kg` : null,
        }
      } else {
        result.vo2Max = { message: "No VO2 Max data found" }
      }
    }

    // Calculate heart health score
    if (metric === "all") {
      let score = 0
      let maxScore = 0
      const details: string[] = []

      // HRV score (max 30 points)
      if (result.hrv?.latest) {
        maxScore += 30
        if (result.hrv.latest >= 50) { score += 30; details.push("HRV良好") }
        else if (result.hrv.latest >= 30) { score += 20; details.push("HRV一般") }
        else { score += 10; details.push("HRV偏低") }
      }

      // Resting HR score (max 30 points)
      if (result.restingHeartRate?.latest) {
        maxScore += 30
        const rhr = result.restingHeartRate.latest
        if (rhr >= 60 && rhr <= 80) { score += 30; details.push("静息心率正常") }
        else if (rhr >= 50 && rhr < 100) { score += 20; details.push("静息心率可接受") }
        else { score += 10; details.push("静息心率异常") }
      }

      // Current HR score (max 20 points)
      if (result.heartRate?.latest) {
        maxScore += 20
        const hr = result.heartRate.latest
        if (hr >= 60 && hr <= 100) { score += 20; details.push("当前心率正常") }
        else { score += 10; details.push("当前心率需关注") }
      }

      // VO2 Max score (max 20 points)
      if (result.vo2Max?.latest) {
        maxScore += 20
        if (result.vo2Max.latest >= 35) { score += 20; details.push("心肺功能良好") }
        else if (result.vo2Max.latest >= 25) { score += 15; details.push("心肺功能一般") }
        else { score += 10; details.push("心肺功能需提升") }
      }

      if (maxScore > 0) {
        const percentage = Math.round((score / maxScore) * 100)
        let level = ""
        if (percentage >= 90) level = "优秀"
        else if (percentage >= 70) level = "良好"
        else if (percentage >= 50) level = "一般"
        else level = "需改善"

        result.heartHealthScore = {
          score,
          maxScore,
          percentage,
          level,
          formatted: `${percentage}% (${level})`,
          details,
        }
      }
    }

    Script.exit(result)
  } catch (error: any) {
    Script.exit({ success: false, error: error?.message ?? String(error) })
  }
}

main()
