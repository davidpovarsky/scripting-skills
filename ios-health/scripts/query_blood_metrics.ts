import { Script } from "scripting"

const params = Script.queryParameters

const startDateStr = params.start_date as string | undefined
const endDateStr = params.end_date as string | undefined
const metric = (params.metric as string) || "all" // "oxygen", "bloodPressure", "glucose", "respiratory", "temperature", "all"

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

function formatOxygen(percent: number): string {
  let status = ""
  if (percent >= 95) status = "正常"
  else if (percent >= 90) status = "偏低"
  else status = "过低"
  return `${percent.toFixed(1)}% (${status})`
}

function formatBloodPressure(systolic: number, diastolic: number): string {
  let category = ""
  if (systolic < 120 && diastolic < 80) category = "正常"
  else if (systolic < 130 && diastolic < 80) category = "偏高"
  else if (systolic < 140 || diastolic < 90) category = "高血压1级"
  else if (systolic < 180 || diastolic < 120) category = "高血压2级"
  else category = "高血压危象"
  return `${systolic}/${diastolic} mmHg (${category})`
}

function formatGlucose(mgDl: number): string {
  let status = ""
  if (mgDl < 70) status = "低血糖"
  else if (mgDl < 100) status = "正常"
  else if (mgDl < 126) status = "偏高"
  else status = "糖尿病范围"
  return `${mgDl.toFixed(0)} mg/dL (${status})`
}

function roundMmHg(value: number): number {
  return Math.round(value)
}

function sampleQuantityValue(
  sample: HealthQuantitySample | HealthCumulativeQuantitySample | HealthDiscreteQuantitySample,
  unit: HealthUnit,
): number {
  return sample.quantityValue(unit)
}

function summarizeBloodPressureReadings(readings: Array<{
  systolic: number
  diastolic: number
  startDate: Date
  endDate: Date
  uuid: string
  source: string | null
}>) {
  if (readings.length === 0) return null

  const latest = readings[0]
  let systolicSum = 0
  let diastolicSum = 0
  let systolicMin = Number.POSITIVE_INFINITY
  let systolicMax = Number.NEGATIVE_INFINITY
  let diastolicMin = Number.POSITIVE_INFINITY
  let diastolicMax = Number.NEGATIVE_INFINITY

  for (const reading of readings) {
    systolicSum += reading.systolic
    diastolicSum += reading.diastolic
    systolicMin = Math.min(systolicMin, reading.systolic)
    systolicMax = Math.max(systolicMax, reading.systolic)
    diastolicMin = Math.min(diastolicMin, reading.diastolic)
    diastolicMax = Math.max(diastolicMax, reading.diastolic)
  }

  const avgSystolic = systolicSum / readings.length
  const avgDiastolic = diastolicSum / readings.length

  return {
    sampleCount: readings.length,
    latest: {
      systolic: roundMmHg(latest.systolic),
      diastolic: roundMmHg(latest.diastolic),
      formatted: formatBloodPressure(roundMmHg(latest.systolic), roundMmHg(latest.diastolic)),
      date: latest.startDate.toISOString(),
      endDate: latest.endDate.toISOString(),
      uuid: latest.uuid,
      source: latest.source,
    },
    average: {
      systolic: roundMmHg(avgSystolic),
      diastolic: roundMmHg(avgDiastolic),
      formatted: formatBloodPressure(roundMmHg(avgSystolic), roundMmHg(avgDiastolic)),
    },
    range: {
      systolic: { min: roundMmHg(systolicMin), max: roundMmHg(systolicMax) },
      diastolic: { min: roundMmHg(diastolicMin), max: roundMmHg(diastolicMax) },
    },
  }
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
    const pctUnit = HealthUnit.percent()
    const mmHgUnit = HealthUnit.millimeterOfMercury()
    const bpmUnit = HealthUnit.count().divided(HealthUnit.minute())
    const celsiusUnit = HealthUnit.degreeCelsius()

    // Query blood oxygen (SpO2)
    if (metric === "all" || metric === "oxygen") {
      const stats = await Health.queryStatistics("oxygenSaturation", {
        startDate, endDate,
        statisticsOptions: ["discreteAverage", "discreteMin", "discreteMax", "mostRecent"],
      })

      const avg = stats?.averageQuantity(pctUnit) ?? null
      const min = stats?.minimumQuantity(pctUnit) ?? null
      const max = stats?.maximumQuantity(pctUnit) ?? null
      const recent = stats?.mostRecentQuantity(pctUnit) ?? null
      const recentInterval = stats?.mostRecentQuantityDateInterval() ?? null

      if (recent != null) {
        const oxygenPercent = recent * 100
        result.oxygen = {
          latest: Math.round(oxygenPercent * 10) / 10,
          latestFormatted: formatOxygen(oxygenPercent),
          latestDate: recentInterval?.start?.toISOString() ?? null,
          average: avg != null ? Math.round(avg * 1000) / 10 : null,
          averageFormatted: avg != null ? formatOxygen(avg * 100) : null,
          min: min != null ? Math.round(min * 1000) / 10 : null,
          max: max != null ? Math.round(max * 1000) / 10 : null,
        }
      } else {
        result.oxygen = { message: "No blood oxygen data found" }
      }
    }

    // Query blood pressure
    if (metric === "all" || metric === "bloodPressure") {
      // HealthKit represents a blood pressure reading as an HKCorrelation that
      // contains the systolic and diastolic quantity samples measured together.
      // Do not query the two quantity types independently and pair their
      // `mostRecent` values: they can come from different measurements/sources.
      const correlations = await Health.queryCorrelations("bloodPressure", {
        startDate, endDate,
        sortDescriptors: [{ key: "startDate", order: "reverse" }],
      })

      const readings: Array<{
        systolic: number
        diastolic: number
        startDate: Date
        endDate: Date
        uuid: string
        source: string | null
      }> = []

      for (const correlation of correlations) {
        let systolic: number | null = null
        let diastolic: number | null = null

        for (const sample of correlation.quantitySamples) {
          if (sample.quantityType === "bloodPressureSystolic") {
            systolic = sampleQuantityValue(sample, mmHgUnit)
          } else if (sample.quantityType === "bloodPressureDiastolic") {
            diastolic = sampleQuantityValue(sample, mmHgUnit)
          }
        }

        if (systolic == null || diastolic == null) continue

        readings.push({
          systolic,
          diastolic,
          startDate: correlation.startDate,
          endDate: correlation.endDate,
          uuid: correlation.uuid,
          source: correlation.sourceRevision.source.name,
        })
      }

      const summary = summarizeBloodPressureReadings(readings)
      result.bloodPressure = summary ?? { message: "No blood pressure data found" }
    }

    // Query blood glucose
    if (metric === "all" || metric === "glucose") {
      const stats = await Health.queryStatistics("bloodGlucose", {
        startDate, endDate,
        statisticsOptions: ["discreteAverage", "discreteMin", "discreteMax", "mostRecent"],
      })

      // Blood glucose unit - use mg/dL
      const mgDlUnit = HealthUnit.fromString("mg/dL")
      const avg = stats?.averageQuantity(mgDlUnit) ?? null
      const min = stats?.minimumQuantity(mgDlUnit) ?? null
      const max = stats?.maximumQuantity(mgDlUnit) ?? null
      const recent = stats?.mostRecentQuantity(mgDlUnit) ?? null
      const recentInterval = stats?.mostRecentQuantityDateInterval() ?? null

      if (recent != null) {
        result.glucose = {
          latest: Math.round(recent),
          latestFormatted: formatGlucose(recent),
          latestDate: recentInterval?.start?.toISOString() ?? null,
          average: avg != null ? Math.round(avg) : null,
          averageFormatted: avg != null ? formatGlucose(avg) : null,
          min: min != null ? Math.round(min) : null,
          max: max != null ? Math.round(max) : null,
        }
      } else {
        result.glucose = { message: "No blood glucose data found" }
      }
    }

    // Query respiratory rate
    if (metric === "all" || metric === "respiratory") {
      const stats = await Health.queryStatistics("respiratoryRate", {
        startDate, endDate,
        statisticsOptions: ["discreteAverage", "discreteMin", "discreteMax", "mostRecent"],
      })

      const avg = stats?.averageQuantity(bpmUnit) ?? null
      const recent = stats?.mostRecentQuantity(bpmUnit) ?? null
      const recentInterval = stats?.mostRecentQuantityDateInterval() ?? null

      if (recent != null) {
        let status = ""
        if (recent >= 12 && recent <= 20) status = "正常"
        else if (recent < 12) status = "偏低"
        else status = "偏高"

        result.respiratory = {
          latest: Math.round(recent),
          latestFormatted: `${Math.round(recent)} 次/分 (${status})`,
          latestDate: recentInterval?.start?.toISOString() ?? null,
          average: avg != null ? Math.round(avg) : null,
          averageFormatted: avg != null ? `${Math.round(avg)} 次/分` : null,
        }
      } else {
        result.respiratory = { message: "No respiratory rate data found" }
      }
    }

    // Query body temperature
    if (metric === "all" || metric === "temperature") {
      const stats = await Health.queryStatistics("bodyTemperature", {
        startDate, endDate,
        statisticsOptions: ["discreteAverage", "discreteMin", "discreteMax", "mostRecent"],
      })

      const avg = stats?.averageQuantity(celsiusUnit) ?? null
      const recent = stats?.mostRecentQuantity(celsiusUnit) ?? null
      const recentInterval = stats?.mostRecentQuantityDateInterval() ?? null

      if (recent != null) {
        let status = ""
        if (recent >= 36.1 && recent <= 37.2) status = "正常"
        else if (recent < 36.1) status = "偏低"
        else status = "偏高"

        result.temperature = {
          latest: Math.round(recent * 10) / 10,
          latestFormatted: `${recent.toFixed(1)}°C (${status})`,
          latestDate: recentInterval?.start?.toISOString() ?? null,
          average: avg != null ? Math.round(avg * 10) / 10 : null,
          averageFormatted: avg != null ? `${avg.toFixed(1)}°C` : null,
        }
      } else {
        result.temperature = { message: "No body temperature data found" }
      }
    }

    Script.exit(result)
  } catch (error: any) {
    Script.exit({ success: false, error: error?.message ?? String(error) })
  }
}

main()
