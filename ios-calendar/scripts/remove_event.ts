import { Script } from "scripting"

const params = Script.queryParameters
const identifier = params.identifier as string

async function main() {
  if (!identifier) {
    Script.exit({ success: false, error: "Missing required parameter: identifier" })
    return
  }

  try {
    const event = await CalendarEvent.get(identifier)

    if (!event) {
      Script.exit({ success: false, error: `Event not found: ${identifier}` })
      return
    }

    const eventTitle = event.title
    await event.remove()

    Script.exit({
      success: true,
      message: `Event "${eventTitle}" removed successfully.`,
      removedIdentifier: identifier
    })
  } catch (error: any) {
    Script.exit({ success: false, error: error.message ?? String(error) })
  }
}

main()
