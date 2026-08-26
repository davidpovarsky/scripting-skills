import { Script } from "scripting"

const params = Script.queryParameters
const title = params.title as string
const startDateStr = params.start_date as string
const endDateStr = params.end_date as string
const isAllDay = params.is_all_day === "true"
const location = params.location as string | undefined
const notes = params.notes as string | undefined
const url = params.url as string | undefined
const calendarId = params.calendar_id as string | undefined
const alarmMinutes = params.alarm_minutes ? Number(params.alarm_minutes) : undefined
const recurrence = params.recurrence as unknown as {
  frequency?: string
  interval?: number
  end_date?: string
  count?: number
} | undefined

async function main() {
  if (!title) {
    Script.exit({ success: false, error: "Missing required parameter: title" })
    return
  }
  if (!startDateStr) {
    Script.exit({ success: false, error: "Missing required parameter: start_date" })
    return
  }
  if (!endDateStr) {
    Script.exit({ success: false, error: "Missing required parameter: end_date" })
    return
  }

  const startDate = new Date(startDateStr)
  const endDate = new Date(endDateStr)

  if (isNaN(startDate.getTime())) {
    Script.exit({ success: false, error: `Invalid start_date: ${startDateStr}` })
    return
  }
  if (isNaN(endDate.getTime())) {
    Script.exit({ success: false, error: `Invalid end_date: ${endDateStr}` })
    return
  }

  try {
    // Get the target calendar
    let calendar: Calendar | null = null
    if (calendarId) {
      const allCalendars = await Calendar.forEvents()
      calendar = allCalendars.find(cal => cal.identifier === calendarId) ?? null
      if (!calendar) {
        Script.exit({ success: false, error: `Calendar not found: ${calendarId}` })
        return
      }
    } else {
      calendar = await Calendar.defaultForEvents()
    }

    if (!calendar) {
      Script.exit({ success: false, error: "No calendar available" })
      return
    }

    // Create event directly using constructor
    const event = new CalendarEvent()
    event.title = title
    event.startDate = startDate
    event.endDate = endDate
    event.isAllDay = isAllDay
    event.calendar = calendar

    if (location) event.location = location
    if (notes) event.notes = notes
    if (url) event.url = url

    // Add alarm if specified
    if (alarmMinutes !== undefined && alarmMinutes > 0) {
      const alarm = EventAlarm.fromRelativeOffset(-alarmMinutes * 60)
      event.addAlarm(alarm)
    }

    // Add recurrence rule if specified
    if (recurrence && recurrence.frequency) {
      const freqMap: Record<string, RecurrenceFrequency> = {
        daily: "daily",
        weekly: "weekly",
        monthly: "monthly",
        yearly: "yearly"
      }
      const freq = freqMap[recurrence.frequency.toLowerCase()]
      if (freq) {
        let recurrenceEnd: RecurrenceEnd | undefined
        if (recurrence.end_date) {
          const endRecurDate = new Date(recurrence.end_date)
          if (!isNaN(endRecurDate.getTime())) {
            recurrenceEnd = RecurrenceEnd.fromDate(endRecurDate)
          }
        } else if (recurrence.count && recurrence.count > 0) {
          recurrenceEnd = RecurrenceEnd.fromCount(recurrence.count)
        }

        const rule = RecurrenceRule.create({
          frequency: freq,
          interval: recurrence.interval ?? 1,
          end: recurrenceEnd
        })

        if (rule) {
          event.addRecurrenceRule(rule)
        }
      }
    }

    await event.save()

    Script.exit({
      success: true,
      message: `Event "${title}" created successfully.`,
      event: {
        identifier: event.identifier,
        title: event.title,
        startDate: event.startDate.toISOString(),
        endDate: event.endDate.toISOString(),
        isAllDay: event.isAllDay,
        location: event.location,
        calendar: event.calendar?.title,
        hasAlarms: event.hasAlarm,
        hasRecurrence: event.hasRecurrenceRules
      }
    })
  } catch (error: any) {
    Script.exit({ success: false, error: error.message ?? String(error) })
  }
}

main()
