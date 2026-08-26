import { Script } from "scripting"
import {
  ensureAvailable,
  fail,
  validateTopLevelKeys,
  validateCommon,
  buildAttributes,
  buildSchedule,
  parseJsonParam,
  ALARM_PARAM_KEYS,
  ScheduleParams,
  ValidationError,
} from "./_shared"

const params = (Script.queryParameters ?? {}) as Record<string, any>

async function main() {
  if (!ensureAvailable(Script.exit)) return

  try {
    validateTopLevelKeys(params, ALARM_PARAM_KEYS)

    const scheduleParams: ScheduleParams =
      parseJsonParam<ScheduleParams>(params.schedule, "schedule") ?? {
        scheduleType: params.scheduleType ?? null,
        date: params.date ?? null,
        hour: params.hour,
        minute: params.minute,
        weekdays: parseJsonParam<number[]>(params.weekdays, "weekdays"),
      }

    if (!scheduleParams.scheduleType) {
      throw new ValidationError(
        "MISSING_PARAM",
        "scheduleType is required: 'fixed' | 'relative' | 'weekly'.",
        "scheduleType",
      )
    }

    const schedule = buildSchedule(scheduleParams)
    if (!schedule) {
      throw new ValidationError("INVALID_PARAM", "Could not construct a Schedule from inputs.", "schedule")
    }

    const c = validateCommon(params)
    const attributes = buildAttributes(c.attributesParams)  // alarm: NO countdown/paused
    if (!attributes) {
      throw new ValidationError("INTERNAL", "AlarmManager.Attributes.create returned null.")
    }

    const config = AlarmManager.Configuration.alarm({
      schedule,
      attributes,
      sound: c.sound,
      stopIntent: c.stopIntent,
      secondaryIntent: c.secondaryIntent,
    })
    if (!config) {
      throw new ValidationError("INTERNAL", "AlarmManager.Configuration.alarm returned null.")
    }

    let alarm: AlarmManager.Alarm
    try {
      alarm = await AlarmManager.schedule(c.id, config)
    } catch (err: any) {
      throw new ValidationError(
        "SCHEDULE_REJECTED",
        err?.message ?? "AlarmKit rejected the alarm schedule.",
        "schedule",
        { native: err?.message ?? String(err) },
      )
    }

    Script.exit({
      success: true,
      message: `Alarm scheduled (${scheduleParams.scheduleType}).`,
      alarm: {
        id: alarm.id,
        state: alarm.state,
        schedule: {
          type: alarm.schedule?.type ?? null,
          date: alarm.schedule?.date?.toISOString() ?? null,
          hour: alarm.schedule?.hour ?? null,
          minute: alarm.schedule?.minute ?? null,
          weekdays: alarm.schedule?.weekdays ?? null,
        },
      },
    })
  } catch (err) {
    fail(Script.exit, err)
  }
}

main()
