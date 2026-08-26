import { Script } from "scripting"

const params = Script.queryParameters
const startDateStr = params.start_date as string | undefined
const endDateStr = params.end_date as string | undefined
const limitParam = params.limit
const includeSamplesParam = params.include_samples

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

const STAGE_NAME: Record<number, string> = {
  0: "inBed",
  1: "asleepUnspecified",
  2: "awake",
  3: "asleepCore",
  4: "asleepDeep",
  5: "asleepREM",
}

const ASLEEP_VALUES = new Set<number>([1, 3, 4, 5])

function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, (end.getTime() - start.getTime()) / 60000)
}

function overlapMinutes(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const start = Math.max(aStart.getTime(), bStart.getTime())
  const end = Math.min(aEnd.getTime(), bEnd.getTime())
  return Math.max(0, (end - start) / 60000)
}

function toBool(value: any, defaultValue: boolean): boolean {
  if (value == null) return defaultValue
  if (typeof value === "boolean") return value
  const s = String(value).trim().toLowerCase()
  if (["1", "true", "yes", "y"].includes(s)) return true
  if (["0", "false", "no", "n"].includes(s)) return false
  return defaultValue
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

    const limit = typeof limitParam === "number" ? limitParam : parseInt(String(limitParam ?? "500"), 10)
    const includeSamples = toBool(includeSamplesParam, true)

    const rawSamples = await Health.queryCategorySamples("sleepAnalysis", {
      startDate,
      endDate,
      limit: isNaN(limit) ? 500 : limit,
      sortDescriptors: [{ key: "startDate", order: "forward" }],
    })

    const samples = rawSamples
      .map((s: any, index: number) => {
        const durationMinutes = minutesBetween(s.startDate, s.endDate)
        const stage = STAGE_NAME[s.value] ?? `unknown(${String(s.value)})`
        const source = s?.sourceRevision?.source?.name ?? "Unknown source"
        const productType = s?.sourceRevision?.productType ?? null
        const version = s?.sourceRevision?.version ?? null
        return {
          index,
          uuid: s?.uuid ?? null,
          startDate: s.startDate,
          endDate: s.endDate,
          startDateIso: s.startDate.toISOString(),
          endDateIso: s.endDate.toISOString(),
          value: s.value,
          stage,
          durationMinutes,
          durationFormatted: formatMinutes(durationMinutes),
          isAsleep: ASLEEP_VALUES.has(s.value),
          source,
          productType,
          version,
          metadata: s?.metadata ?? null,
        }
      })
      .filter(s => s.durationMinutes > 0)

    const bySource: Record<string, any> = {}
    for (const s of samples) {
      if (!bySource[s.source]) {
        bySource[s.source] = {
          source: s.source,
          productTypes: new Set<string>(),
          versions: new Set<string>(),
          sampleCount: 0,
          asleepSampleCount: 0,
          totalMinutes: 0,
          asleepMinutes: 0,
          stageMinutes: {},
          firstStart: s.startDate,
          lastEnd: s.endDate,
        }
      }
      const item = bySource[s.source]
      item.sampleCount += 1
      item.totalMinutes += s.durationMinutes
      if (s.isAsleep) {
        item.asleepSampleCount += 1
        item.asleepMinutes += s.durationMinutes
      }
      item.stageMinutes[s.stage] = (item.stageMinutes[s.stage] ?? 0) + s.durationMinutes
      if (s.productType) item.productTypes.add(s.productType)
      if (s.version) item.versions.add(s.version)
      if (s.startDate < item.firstStart) item.firstStart = s.startDate
      if (s.endDate > item.lastEnd) item.lastEnd = s.endDate
    }

    const sourceSummaries = Object.values(bySource)
      .map((item: any) => ({
        source: item.source,
        productTypes: Array.from(item.productTypes),
        versions: Array.from(item.versions),
        sampleCount: item.sampleCount,
        asleepSampleCount: item.asleepSampleCount,
        totalMinutes: Math.round(item.totalMinutes),
        totalFormatted: formatMinutes(item.totalMinutes),
        asleepMinutes: Math.round(item.asleepMinutes),
        asleepFormatted: formatMinutes(item.asleepMinutes),
        firstStart: item.firstStart?.toISOString?.() ?? null,
        lastEnd: item.lastEnd?.toISOString?.() ?? null,
        stageMinutes: Object.fromEntries(
          Object.entries(item.stageMinutes).map(([k, v]) => [k, Math.round(v as number)])
        ),
      }))
      .sort((a: any, b: any) => b.asleepMinutes - a.asleepMinutes)

    let sameStageOverlapMinutes = 0
    let crossSourceOverlapMinutes = 0
    let crossSourceAsleepOverlapMinutes = 0
    const overlapExamples: any[] = []

    for (let i = 0; i < samples.length; i++) {
      for (let j = i + 1; j < samples.length; j++) {
        const a = samples[i]
        const b = samples[j]
        const ov = overlapMinutes(a.startDate, a.endDate, b.startDate, b.endDate)
        if (ov <= 0) continue
        if (a.stage === b.stage) sameStageOverlapMinutes += ov
        if (a.source !== b.source) {
          crossSourceOverlapMinutes += ov
          if (a.isAsleep && b.isAsleep) crossSourceAsleepOverlapMinutes += ov
          if (overlapExamples.length < 30) {
            overlapExamples.push({
              overlapMinutes: Math.round(ov),
              a: {
                source: a.source,
                stage: a.stage,
                startDate: a.startDateIso,
                endDate: a.endDateIso,
                durationMinutes: Math.round(a.durationMinutes),
              },
              b: {
                source: b.source,
                stage: b.stage,
                startDate: b.startDateIso,
                endDate: b.endDateIso,
                durationMinutes: Math.round(b.durationMinutes),
              },
            })
          }
        }
      }
    }

    Script.exit({
      success: true,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      sampleCount: samples.length,
      sourceCount: sourceSummaries.length,
      sourceSummaries,
      diagnostics: {
        sameStageOverlapMinutes: Math.round(sameStageOverlapMinutes),
        sameStageOverlapFormatted: formatMinutes(sameStageOverlapMinutes),
        crossSourceOverlapMinutes: Math.round(crossSourceOverlapMinutes),
        crossSourceOverlapFormatted: formatMinutes(crossSourceOverlapMinutes),
        crossSourceAsleepOverlapMinutes: Math.round(crossSourceAsleepOverlapMinutes),
        crossSourceAsleepOverlapFormatted: formatMinutes(crossSourceAsleepOverlapMinutes),
        overlapExampleCount: overlapExamples.length,
        overlapExamples,
      },
      samples: includeSamples ? samples.map(s => ({
        uuid: s.uuid,
        source: s.source,
        productType: s.productType,
        version: s.version,
        stage: s.stage,
        value: s.value,
        isAsleep: s.isAsleep,
        startDate: s.startDateIso,
        endDate: s.endDateIso,
        durationMinutes: Math.round(s.durationMinutes),
        durationFormatted: s.durationFormatted,
        metadata: s.metadata,
      })) : undefined,
    })
  } catch (error: any) {
    Script.exit({ success: false, error: error?.message ?? String(error) })
  }
}

main()
