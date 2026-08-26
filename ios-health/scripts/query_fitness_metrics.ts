import { Script } from "scripting"

const params = Script.queryParameters

const startDateStr = params.start_date as string | undefined
const endDateStr = params.end_date as string | undefined
const metric = (params.metric as string) || "all" // "flights", "stand", "exercise", "energy", "distance", "steps", "all"
const daily = String(params.daily) === "true"

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
    const countUnit = HealthUnit.count()
    const minuteUnit = HealthUnit.minute()
    const meterUnit = HealthUnit.meter()
    const kcalUnit = HealthUnit.kilocalorie()
    const kmUnit = HealthUnit.meterUnit(HealthMetricPrefix.kilo)

    // Helper for daily queries
    async function getDailyStats(quantityType: HealthQuantityType, unit: any, statsOption: HealthStatisticsOptions | HealthStatisticsOptions[] = ["cumulativeSum"]) {
      const anchorDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0)
      const collection = await Health.queryStatisticsCollection(quantityType, {
        startDate, endDate,
        statisticsOptions: statsOption as any,
        anchorDate,
        intervalComponents: new DateComponents({ day: 1 }),
      })
      return collection.statistics()
        .filter(s => s.startDate.getTime() < endDate.getTime() && s.endDate.getTime() > startDate.getTime())
        .map(s => ({
          date: formatLocalDate(s.startDate),
          value: s.sumQuantity(unit) ?? 0,
        }))
    }

    // Query flights climbed
    if (metric === "all" || metric === "flights") {
      const stats = await Health.queryStatistics("flightsClimbed", {
        startDate, endDate,
        statisticsOptions: ["cumulativeSum"],
      })
      const totalFlights = Math.round(stats?.sumQuantity(countUnit) ?? 0)
      result.flightsClimbed = {
        total: totalFlights,
        totalFormatted: `${totalFlights} 层`,
      }

      if (daily) {
        const dailyData = await getDailyStats("flightsClimbed", countUnit)
        result.flightsClimbed.daily = dailyData.map(d => ({
          date: d.date,
          flights: Math.round(d.value),
        }))
      }
    }

    // Query stand time (Apple Stand Hours)
    if (metric === "all" || metric === "stand") {
      const standSamples = await Health.queryCategorySamples("appleStandHour", {
        startDate, endDate,
        limit: 1000,
      })

      if (standSamples.length > 0) {
        const standHours = standSamples.length
        const standDays = new Set(standSamples.map(s => formatLocalDate(s.startDate))).size
        const avgStandPerDay = standDays > 0 ? standHours / standDays : 0

        result.stand = {
          totalHours: standHours,
          totalFormatted: `${standHours} 小时`,
          daysTracked: standDays,
          averagePerDay: Math.round(avgStandPerDay * 10) / 10,
          averagePerDayFormatted: `${(Math.round(avgStandPerDay * 10) / 10).toFixed(1)} 小时/天`,
          sampleCount: standSamples.length,
        }

        if (daily) {
          const dailyStand: Record<string, number> = {}
          standSamples.forEach(s => {
            const date = formatLocalDate(s.startDate)
            dailyStand[date] = (dailyStand[date] || 0) + 1
          })
          result.stand.daily = Object.entries(dailyStand)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, hours]) => ({ date, hours }))
        }
      } else {
        result.stand = { message: "No stand data found" }
      }
    }

    // Query exercise time
    if (metric === "all" || metric === "exercise") {
      const stats = await Health.queryStatistics("appleExerciseTime", {
        startDate, endDate,
        statisticsOptions: ["cumulativeSum"],
      })
      const totalMinutes = Math.round(stats?.sumQuantity(minuteUnit) ?? 0)
      const hours = Math.floor(totalMinutes / 60)
      const mins = totalMinutes % 60

      result.exerciseTime = {
        totalMinutes,
        totalFormatted: hours > 0 ? `${hours} 小时 ${mins} 分钟` : `${mins} 分钟`,
      }

      if (daily) {
        const dailyData = await getDailyStats("appleExerciseTime", minuteUnit)
        result.exerciseTime.daily = dailyData.map(d => ({
          date: d.date,
          minutes: Math.round(d.value),
          formatted: `${Math.round(d.value)} 分钟`,
        }))
      }
    }

    // Query active energy
    if (metric === "all" || metric === "energy") {
      const stats = await Health.queryStatistics("activeEnergyBurned", {
        startDate, endDate,
        statisticsOptions: ["cumulativeSum"],
      })
      const totalKcal = Math.round(stats?.sumQuantity(kcalUnit) ?? 0)
      result.activeEnergy = {
        totalKcal,
        totalFormatted: `${totalKcal} 千卡`,
      }

      if (daily) {
        const dailyData = await getDailyStats("activeEnergyBurned", kcalUnit)
        result.activeEnergy.daily = dailyData.map(d => ({
          date: d.date,
          kcal: Math.round(d.value),
        }))
      }
    }

    // Query walking + running distance
    if (metric === "all" || metric === "distance") {
      const stats = await Health.queryStatistics("distanceWalkingRunning", {
        startDate, endDate,
        statisticsOptions: ["cumulativeSum"],
      })
      const totalKm = Math.round((stats?.sumQuantity(kmUnit) ?? 0) * 100) / 100

      result.distance = {
        totalKm,
        totalFormatted: `${totalKm.toFixed(2)} 公里`,
      }

      if (daily) {
        const dailyData = await getDailyStats("distanceWalkingRunning", kmUnit)
        result.distance.daily = dailyData.map(d => {
          const km = Math.round(d.value * 100) / 100
          return {
            date: d.date,
            km,
            formatted: `${km.toFixed(2)} 公里`,
          }
        })
      }
    }

    // Query step count
    if (metric === "all" || metric === "steps") {
      const stats = await Health.queryStatistics("stepCount", {
        startDate, endDate,
        statisticsOptions: ["cumulativeSum"],
      })
      const totalSteps = Math.round(stats?.sumQuantity(countUnit) ?? 0)
      result.steps = {
        total: totalSteps,
        totalFormatted: `${totalSteps.toLocaleString()} 步`,
      }

      if (daily) {
        const dailyData = await getDailyStats("stepCount", countUnit)
        result.steps.daily = dailyData.map(d => ({
          date: d.date,
          steps: Math.round(d.value),
        }))
      }
    }

    // Calculate fitness score
    if (metric === "all") {
      let score = 0
      let maxScore = 0
      const details: string[] = []
      const daysInRange = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))

      // Exercise time score (max 30 points)
      if (result.exerciseTime?.totalMinutes) {
        maxScore += 30
        const dailyAvg = result.exerciseTime.totalMinutes / daysInRange
        if (dailyAvg >= 30) { score += 30; details.push("运动时间充足") }
        else if (dailyAvg >= 20) { score += 20; details.push("运动时间良好") }
        else if (dailyAvg >= 10) { score += 10; details.push("运动时间偏少") }
        else { score += 5; details.push("运动时间不足") }
      }

      // Stand score (max 20 points)
      if (result.stand?.averagePerDay) {
        maxScore += 20
        if (result.stand.averagePerDay >= 12) { score += 20; details.push("站立时间达标") }
        else if (result.stand.averagePerDay >= 9) { score += 15; details.push("站立时间良好") }
        else if (result.stand.averagePerDay >= 6) { score += 10; details.push("站立时间偏少") }
        else { score += 5; details.push("站立时间不足") }
      }

      // Steps score (max 25 points)
      if (result.steps?.total) {
        maxScore += 25
        const dailyAvg = result.steps.total / daysInRange
        if (dailyAvg >= 10000) { score += 25; details.push("步数达标") }
        else if (dailyAvg >= 7500) { score += 20; details.push("步数良好") }
        else if (dailyAvg >= 5000) { score += 15; details.push("步数偏少") }
        else { score += 5; details.push("步数不足") }
      }

      // Flights score (max 25 points)
      if (result.flightsClimbed?.total) {
        maxScore += 25
        const dailyAvg = result.flightsClimbed.total / daysInRange
        if (dailyAvg >= 10) { score += 25; details.push("爬楼达标") }
        else if (dailyAvg >= 5) { score += 15; details.push("爬楼良好") }
        else if (dailyAvg >= 2) { score += 10; details.push("爬楼偏少") }
        else { score += 5; details.push("爬楼不足") }
      }

      if (maxScore > 0) {
        const percentage = Math.round((score / maxScore) * 100)
        let level = ""
        if (percentage >= 90) level = "优秀"
        else if (percentage >= 70) level = "良好"
        else if (percentage >= 50) level = "一般"
        else level = "需提升"

        result.fitnessScore = {
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
