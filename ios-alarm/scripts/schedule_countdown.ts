import { Script } from "scripting"
import {
  ensureAvailable,
  fail,
  validateTopLevelKeys,
  validateCommon,
  buildAttributes,
  buildSchedule,
  parseJsonParam,
  optionalPositiveSeconds,
  COUNTDOWN_PARAM_KEYS,
  ScheduleParams,
  ValidationError,
} from "./_shared"

const params = (Script.queryParameters ?? {}) as Record<string, any>

async function main() {
  if (!ensureAvailable(Script.exit)) return

  try {
    validateTopLevelKeys(params, COUNTDOWN_PARAM_KEYS)

    const preAlert = optionalPositiveSeconds(params.preAlert, "preAlert")
    const postAlert = optionalPositiveSeconds(params.postAlert, "postAlert")
    if (preAlert === null && postAlert === null) {
      throw new ValidationError(
        "MISSING_PARAM",
        "At least one of 'preAlert' or 'postAlert' (positive seconds) is required.",
        "preAlert|postAlert",
      )
    }

    const countdown = AlarmManager.Countdown.create({
      preAlert: preAlert ?? undefined,
      postAlert: postAlert ?? undefined,
    })

    const scheduleParams: ScheduleParams =
      parseJsonParam<ScheduleParams>(params.schedule, "schedule") ?? {
        scheduleType: params.scheduleType ?? null,
        date: params.date ?? null,
        hour: params.hour,
        minute: params.minute,
        weekdays: parseJsonParam<number[]>(params.weekdays, "weekdays"),
      }
    const schedule = scheduleParams.scheduleType ? buildSchedule(scheduleParams) : null

    const c = validateCommon(params)
    const attributes = buildAttributes(c.attributesParams, { includeCountdownPaused: true })
    if (!attributes) {
      throw new ValidationError("INTERNAL", "AlarmManager.Attributes.create returned null.")
    }

    const config = AlarmManager.Configuration.countdown({
      countdown,
      schedule,
      attributes,
      sound: c.sound,
      stopIntent: c.stopIntent,
      secondaryIntent: c.secondaryIntent,
    })
    if (!config) {
      throw new ValidationError("INTERNAL", "AlarmManager.Configuration.countdown returned null.")
    }

    let alarm: AlarmManager.Alarm
    try {
      alarm = await AlarmManager.schedule(c.id, config)
    } catch (err: any) {
      throw new ValidationError(
        "SCHEDULE_REJECTED",
        err?.message ?? "AlarmKit rejected the countdown schedule.",
        "schedule",
        { native: err?.message ?? String(err) },
      )
    }

    Script.exit({
      success: true,
      message: `Countdown scheduled (preAlert=${preAlert ?? "-"}, postAlert=${postAlert ?? "-"}).`,
      alarm: {
        id: alarm.id,
        state: alarm.state,
        countdown: {
          preAlert: alarm.countdownDuration?.preAlert ?? null,
          postAlert: alarm.countdownDuration?.postAlert ?? null,
        },
      },
    })
  } catch (err) {
    fail(Script.exit, err)
  }
}

main()
