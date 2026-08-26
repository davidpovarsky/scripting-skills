import { Script } from "scripting"
import {
  ensureAvailable,
  fail,
  validateTopLevelKeys,
  validateCommon,
  buildAttributes,
  requirePositiveSeconds,
  TIMER_PARAM_KEYS,
  ValidationError,
} from "./_shared"

const params = (Script.queryParameters ?? {}) as Record<string, any>

async function main() {
  if (!ensureAvailable(Script.exit)) return

  try {
    validateTopLevelKeys(params, TIMER_PARAM_KEYS)
    const duration = requirePositiveSeconds(params.duration, "duration")
    const c = validateCommon(params)

    const attributes = buildAttributes(c.attributesParams, { includeCountdownPaused: true })
    if (!attributes) {
      throw new ValidationError("INTERNAL", "AlarmManager.Attributes.create returned null.")
    }

    const config = AlarmManager.Configuration.timer({
      duration,
      attributes,
      sound: c.sound,
      stopIntent: c.stopIntent,
      secondaryIntent: c.secondaryIntent,
    })
    if (!config) {
      throw new ValidationError("INTERNAL", "AlarmManager.Configuration.timer returned null.")
    }

    const alarm = await AlarmManager.schedule(c.id, config)
    Script.exit({
      success: true,
      message: `Timer scheduled for ${duration} seconds.`,
      alarm: { id: alarm.id, state: alarm.state },
    })
  } catch (err) {
    fail(Script.exit, err)
  }
}

main()
