import { Script } from "scripting"
import { ensureAvailable, fail, weekdaysToText, ValidationError } from "./_shared"

const params = (Script.queryParameters ?? {}) as Record<string, any>

async function main() {
  if (!ensureAvailable(Script.exit)) return

  try {
    // Strict allowed keys
    const allowed = new Set(["id"])
    for (const k of Object.keys(params)) {
      if (!allowed.has(k)) {
        throw new ValidationError(
          "UNKNOWN_PARAM",
          `Unknown parameter '${k}'. Allowed: id`,
          k,
        )
      }
    }

    let filterId: string | undefined
    if (params.id !== undefined && params.id !== null && params.id !== "") {
      if (typeof params.id !== "string") {
        throw new ValidationError("INVALID_PARAM", "'id' must be a string", "id")
      }
      filterId = params.id
    }

    const alarmList = await AlarmManager.alarms()
    const filtered = filterId ? alarmList.filter(a => a.id === filterId) : alarmList

    const results = filtered.map(alarm => ({
      id: alarm.id,
      state: alarm.state,
      schedule: alarm.schedule
        ? {
            type: alarm.schedule.type,
            date: alarm.schedule.date?.toISOString() ?? null,
            hour: alarm.schedule.hour ?? null,
            minute: alarm.schedule.minute ?? null,
            weekdays: alarm.schedule.weekdays ?? null,
            weekdaysText: weekdaysToText(alarm.schedule.weekdays),
          }
        : null,
      countdown: alarm.countdownDuration
        ? {
            preAlert: alarm.countdownDuration.preAlert ?? null,
            postAlert: alarm.countdownDuration.postAlert ?? null,
          }
        : null,
    }))

    Script.exit({
      success: true,
      count: results.length,
      alarms: results,
      ...(filterId ? { filterId, found: results.length > 0 } : {}),
    })
  } catch (err) {
    fail(Script.exit, err)
  }
}

main()
