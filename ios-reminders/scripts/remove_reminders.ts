import { Script } from "scripting"

const params = Script.queryParameters as unknown as Record<string, unknown>
const identifiers = params.identifiers as string[] | undefined

async function main() {
  if (!identifiers || !Array.isArray(identifiers) || identifiers.length === 0) {
    Script.exit({
      success: false,
      message: "Missing required parameter: identifiers (non-empty array)",
    })
    return
  }

  try {
    const removedTitles: string[] = []
    const notFound: string[] = []

    for (const id of identifiers) {
      const reminder = await Reminder.get(id)
      if (!reminder) {
        notFound.push(id)
        continue
      }
      removedTitles.push(reminder.title || id)
      await reminder.remove()
    }

    Script.exit({
      success: true,
      removed: removedTitles.length,
      removedTitles,
      notFound,
    })
  } catch (error: any) {
    Script.exit({ success: false, message: error.message ?? String(error) })
  }
}

main()
