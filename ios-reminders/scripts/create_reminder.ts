import { Script } from "scripting"

const params = Script.queryParameters as unknown as Record<string, unknown>
const title = params.title as string | undefined
const notes = params.notes as string | undefined
const dueDateStr = params.due_date as string | undefined
const dateOnly = params.date_only === true || params.date_only === "true"
const priorityRaw = params.priority
const priority =
  typeof priorityRaw === "number"
    ? priorityRaw
    : typeof priorityRaw === "string" && priorityRaw !== ""
      ? Number(priorityRaw)
      : undefined
const calendarTitle = params.calendar_title as string | undefined

function buildDueComponents(s: string, dateOnly: boolean): DateComponents {
  const d = new Date(s)
  if (isNaN(d.getTime())) throw new Error(`Invalid due_date: ${s}`)
  if (dateOnly) {
    return new DateComponents({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
    })
  }
  return new DateComponents({
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes(),
  })
}

async function resolveCalendar(): Promise<Calendar | null> {
  if (calendarTitle) {
    const all = await Calendar.forReminders()
    const match = all.find(c => c.title === calendarTitle)
    if (match) return match
    throw new Error(`Reminder list not found: ${calendarTitle}`)
  }
  return await Calendar.defaultForReminders()
}

async function main() {
  if (!title) {
    Script.exit({ success: false, message: "Missing required parameter: title" })
    return
  }

  try {
    const calendar = await resolveCalendar()
    if (!calendar) {
      Script.exit({ success: false, message: "No reminder calendar available." })
      return
    }

    const reminder = new Reminder()
    reminder.calendar = calendar
    reminder.title = title
    if (notes !== undefined) reminder.notes = notes
    if (dueDateStr) reminder.dueDateComponents = buildDueComponents(dueDateStr, dateOnly)
    if (priority !== undefined) reminder.priority = priority

    await reminder.save()

    Script.exit({
      success: true,
      identifier: reminder.identifier,
      title: reminder.title,
      message: `Reminder "${reminder.title}" created in "${calendar.title}".`,
    })
  } catch (error: any) {
    Script.exit({ success: false, message: error.message ?? String(error) })
  }
}

main()
