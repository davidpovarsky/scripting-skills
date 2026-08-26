import { Notification, Script } from "scripting"

const params = Script.queryParameters
const title = params.title as string
const subtitle = (params.subtitle as string) ?? undefined
const body = (params.body as string) ?? undefined
const silent = params.silent === true || params.silent === "true"
const triggerTime = params.trigger_time as string | undefined
const repeatsType = params.repeats_type as string | undefined

async function main() {
  if (!title) {
    Script.exit({ success: false, message: "Missing required parameter: title" })
    return
  }

  try {
    let trigger: CalendarNotificationTrigger | undefined

    if (triggerTime) {
      const date = new Date(triggerTime)
      if (isNaN(date.getTime())) {
        Script.exit({ success: false, message: `Invalid trigger_time: ${triggerTime}` })
        return
      }

      let dateMatching = DateComponents.fromDate(date)
      let repeats = false

      if (repeatsType) {
        const validTypes = ["hourly", "daily", "weekly", "monthly"]
        if (!validTypes.includes(repeatsType)) {
          Script.exit({
            success: false,
            message: `Invalid repeats_type: ${repeatsType}. Use: ${validTypes.join(", ")}`
          })
          return
        }
        repeats = true
        switch (repeatsType) {
          case "hourly": dateMatching = DateComponents.forHourly(date); break
          case "daily": dateMatching = DateComponents.forDaily(date); break
          case "weekly": dateMatching = DateComponents.forWeekly(date); break
          case "monthly": dateMatching = DateComponents.forMonthly(date); break
        }
      }

      trigger = new CalendarNotificationTrigger({ dateMatching, repeats })
    }

    const scheduled = await Notification.schedule({
      title,
      subtitle,
      body,
      silent,
      trigger: trigger ?? null,
      tapAction: "none"
    })

    Script.exit({
      success: scheduled,
      message: scheduled
        ? `Notification "${title}" scheduled successfully.`
        : "Failed to schedule notification."
    })
  } catch (error: any) {
    Script.exit({ success: false, message: error.message ?? String(error) })
  }
}

main()
