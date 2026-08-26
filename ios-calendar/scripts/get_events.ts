import { Script } from "scripting"

const params = Script.queryParameters
const startDateStr = params.start_date as string
const endDateStr = params.end_date as string
const calendarIds = params.calendar_ids as unknown as string[] | undefined

async function main() {
  if (!startDateStr || !endDateStr) {
    Script.exit({ success: false, error: "Missing required parameters: start_date and end_date" })
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
    let calendars: Calendar[] | undefined

    if (calendarIds && calendarIds.length > 0) {
      const allCalendars = await Calendar.forEvents()
      calendars = allCalendars.filter(cal => calendarIds.includes(cal.identifier))
    }

    const events = await CalendarEvent.getAll(startDate, endDate, calendars)

    const result = events.map(event => ({
      identifier: event.identifier,
      title: event.title,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate.toISOString(),
      isAllDay: event.isAllDay,
      location: event.location,
      notes: event.notes,
      url: event.url,
      calendar: event.calendar ? {
        identifier: event.calendar.identifier,
        title: event.calendar.title
      } : null,
      hasAlarms: event.hasAlarm,
      hasRecurrence: event.hasRecurrenceRules,
      availability: event.availability
    }))

    Script.exit({
      success: true,
      count: result.length,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      events: result
    })
  } catch (error: any) {
    Script.exit({ success: false, error: error.message ?? String(error) })
  }
}

main()
