import { Script } from "scripting"

async function main() {
  try {
    const defaultCalendar = await Calendar.defaultForEvents()
    const calendars = await Calendar.forEvents()

    const result = calendars.map(cal => ({
      identifier: cal.identifier,
      title: cal.title,
      color: String(cal.color),
      type: cal.type,
      isDefault: defaultCalendar?.identifier === cal.identifier,
      allowsModifications: cal.allowsContentModifications,
      isSubscribed: cal.isSubscribed
    }))

    Script.exit({
      success: true,
      count: result.length,
      calendars: result
    })
  } catch (error: any) {
    Script.exit({ success: false, error: error.message ?? String(error) })
  }
}

main()
