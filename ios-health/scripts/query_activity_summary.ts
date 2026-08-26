import { Script } from "scripting"

// Query Apple Activity Summaries (Move / Exercise / Stand rings) over a date range.
// Note: queryActivitySummaries takes DateComponents, and `end` is exclusive at day granularity.
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

function formatLocalDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

function formatMinutes(totalMin: number): string {
  const m = Math.round(totalMin)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r === 0 ? `${h} h` : `${h} h ${r} min`
}

function pct(actual: number, goal: number): number | null {
  if (!goal || goal <= 0) return null
  return Math.round((actual / goal) * 100)
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

    // queryActivitySummaries uses DateComponents with gregorian calendar.
    // End is exclusive — same convention as other scripts in this skill.
    const start = new DateComponents({
      calendar: "gregorian",
      year: startDate.getFullYear(),
      month: startDate.getMonth() + 1,
      day: startDate.getDate(),
    })
    const end = new DateComponents({
      calendar: "gregorian",
      year: endDate.getFullYear(),
      month: endDate.getMonth() + 1,
      day: endDate.getDate(),
    })

    const summaries = await Health.queryActivitySummaries({ start, end })

    const kcalUnit = HealthUnit.kilocalorie()
    const minUnit = HealthUnit.minute()
    const countUnit = HealthUnit.count()

    const daily = summaries.map(s => {
      const dc = s.dateComponents
      const y = dc.year ?? 0
      const m = dc.month ?? 0
      const d = dc.day ?? 0

      // Move ring — depends on activityMoveMode.
      // HealthActivityMoveMode.activeEnergy === 1, appleMoveTime === 2.
      const moveMode = s.activityMoveMode
      let moveActual = 0
      let moveGoal = 0
      let moveUnitLabel = ""
      let moveFormatted = ""
      if (moveMode === HealthActivityMoveMode.activeEnergy) {
        moveActual = s.activeEnergyBurned(kcalUnit)
        moveGoal = s.activeEnergyBurnedGoal(kcalUnit)
        moveUnitLabel = "kcal"
        moveFormatted = `${Math.round(moveActual)} / ${Math.round(moveGoal)} kcal`
      } else {
        moveActual = s.appleMoveTime(minUnit)
        moveGoal = s.appleMoveTimeGoal(minUnit)
        moveUnitLabel = "minute"
        moveFormatted = `${formatMinutes(moveActual)} / ${formatMinutes(moveGoal)}`
      }

      const exerciseActual = s.appleExerciseTime(minUnit)
      const exerciseGoal = s.appleExerciseTimeGoal(minUnit)
      const standActual = s.appleStandHours(countUnit)
      const standGoal = s.appleStandHoursGoal(countUnit)

      return {
        date: formatLocalDate(y, m, d),
        moveMode: moveMode === HealthActivityMoveMode.activeEnergy ? "activeEnergy" : "appleMoveTime",
        move: {
          actual: moveMode === HealthActivityMoveMode.activeEnergy ? Math.round(moveActual) : Math.round(moveActual),
          goal: Math.round(moveGoal),
          unit: moveUnitLabel,
          percent: pct(moveActual, moveGoal),
          formatted: moveFormatted,
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
    })

    Script.exit({
      success: true,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      dayCount: daily.length,
      daily,
    })
  } catch (error: any) {
    Script.exit({ success: false, error: error?.message ?? String(error) })
  }
}

main()
