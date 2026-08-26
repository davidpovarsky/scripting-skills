import { Script } from "scripting"

const params = Script.queryParameters as unknown as Record<string, unknown>
const identifier = params.identifier as string | undefined
const title = params.title as string | undefined
const notes = params.notes as string | undefined
const dueDateField = Object.prototype.hasOwnProperty.call(params, "due_date")
const dueDateRaw = params.due_date as string | null | undefined
const dateOnly = params.date_only === true || params.date_only === "true"
const priorityRaw = params.priority
const priority =
  typeof priorityRaw === "number"
    ? priorityRaw
    : typeof priorityRaw === "string" && priorityRaw !== ""
      ? Number(priorityRaw)
      : undefined
const isCompletedRaw = params.is_completed
const isCompleted: boolean | undefined =
  isCompletedRaw === true || isCompletedRaw === "true"
    ? true
    : isCompletedRaw === false || isCompletedRaw === "false"
      ? false
      : undefined

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

async function main() {
  if (!identifier) {
    Script.exit({ success: false, message: "Missing required parameter: identifier" })
    return
  }

  try {
    const reminder = await Reminder.get(identifier)
    if (!reminder) {
      Script.exit({ success: false, message: `Reminder not found: ${identifier}` })
      return
    }

    const changes: string[] = []

    if (title !== undefined) {
      reminder.title = title
      changes.push("title")
    }
    if (notes !== undefined) {
      reminder.notes = notes === "" ? null : notes
      changes.push("notes")
    }
    if (dueDateField) {
      if (dueDateRaw === null || dueDateRaw === "") {
        reminder.dueDateComponents = null
      } else if (typeof dueDateRaw === "string") {
        reminder.dueDateComponents = buildDueComponents(dueDateRaw, dateOnly)
      }
      changes.push("dueDate")
    }
    if (priority !== undefined) {
      reminder.priority = priority
      changes.push("priority")
    }
    if (isCompleted !== undefined) {
      reminder.isCompleted = isCompleted
      changes.push(isCompleted ? "completed" : "reopened")
    }

    if (changes.length === 0) {
      Script.exit({ success: false, message: "No fields to update." })
      return
    }

    await reminder.save()

    Script.exit({
      success: true,
      identifier: reminder.identifier,
      message: `Reminder updated: ${changes.join(", ")}.`,
    })
  } catch (error: any) {
    Script.exit({ success: false, message: error.message ?? String(error) })
  }
}

main()
