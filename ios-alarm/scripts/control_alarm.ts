import { Script } from "scripting"
import { ensureAvailable, fail, ValidationError } from "./_shared"

type AlarmAction = "cancel" | "stop" | "pause" | "resume" | "start_countdown"
const VALID_ACTIONS: readonly AlarmAction[] = [
  "cancel", "stop", "pause", "resume", "start_countdown",
] as const

const params = (Script.queryParameters ?? {}) as Record<string, any>

async function main() {
  if (!ensureAvailable(Script.exit)) return

  try {
    const allowed = new Set(["id", "action"])
    for (const k of Object.keys(params)) {
      if (!allowed.has(k)) {
        throw new ValidationError(
          "UNKNOWN_PARAM",
          `Unknown parameter '${k}'. Allowed: id, action`,
          k,
        )
      }
    }

    if (typeof params.id !== "string" || !params.id.trim()) {
      throw new ValidationError("MISSING_PARAM", "'id' is required (non-empty string).", "id")
    }
    const id = params.id.trim()

    if (typeof params.action !== "string" || !(VALID_ACTIONS as readonly string[]).includes(params.action)) {
      throw new ValidationError(
        "INVALID_PARAM",
        `'action' must be one of: ${VALID_ACTIONS.join(", ")}`,
        "action",
      )
    }
    const action = params.action as AlarmAction

    let result = false
    try {
      switch (action) {
        case "cancel":          result = await AlarmManager.cancel(id); break
        case "stop":            result = await AlarmManager.stop(id); break
        case "pause":           result = await AlarmManager.pause(id); break
        case "resume":          result = await AlarmManager.resume(id); break
        case "start_countdown": result = await AlarmManager.startCountdown(id); break
      }
    } catch (nativeErr: any) {
      throw new ValidationError(
        "SCHEDULE_REJECTED",
        nativeErr?.message ?? `AlarmKit rejected '${action}' on '${id}'.`,
        "id",
        { action, native: nativeErr?.message ?? String(nativeErr) },
      )
    }

    Script.exit({
      success: result,
      message: result
        ? `Action "${action}" on alarm "${id}" succeeded.`
        : `Action "${action}" on alarm "${id}" failed.`,
    })
  } catch (err) {
    fail(Script.exit, err)
  }
}

main()
