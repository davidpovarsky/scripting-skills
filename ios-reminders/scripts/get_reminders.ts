import { Script } from "scripting"

const params = Script.queryParameters as unknown as Record<string, unknown>
const type = (params.type as string) ?? "incomplete"
const startDateStr = params.start_date as string | undefined
const endDateStr = params.end_date as string | undefined

function serialize(r: Reminder) {
  const dueDate = r.dueDateComponents?.date ?? null
  return {
    identifier: r.identifier,
    title: r.title,
    notes: r.notes,
    isCompleted: r.isCompleted,
    priority: r.priority,
    dueDate: dueDate ? dueDate.toISOString() : null,
    completionDate: r.completionDate ? r.completionDate.toISOString() : null,
    calendarTitle: r.calendar?.title ?? null,
  }
}

function parseDate(s: string | undefined): Date | undefined {
  if (!s) return undefined
  const d = new Date(s)
  if (isNaN(d.getTime())) throw new Error(`Invalid date: ${s}`)
  return d
}

async function main() {
  try {
    const startDate = parseDate(startDateStr)
    const endDate = parseDate(endDateStr)

    let reminders: Reminder[] = []
    if (type === "all") {
      reminders = await Reminder.getAll()
    } else if (type === "completed") {
      reminders = await Reminder.getCompleteds({ startDate, endDate })
    } else if (type === "incomplete") {
      reminders = await Reminder.getIncompletes({ startDate, endDate })
    } else {
      Script.exit({ success: false, message: `Invalid type: ${type}. Use "all" | "incomplete" | "completed".` })
      return
    }

    const results = reminders.map(serialize)
    Script.exit({ success: true, type, count: results.length, reminders: results })
  } catch (error: any) {
    Script.exit({ success: false, message: error.message ?? String(error) })
  }
}

main()
