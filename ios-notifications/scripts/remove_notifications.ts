import { Notification, Script } from "scripting"

const params = Script.queryParameters
const identifiers = params.identifiers as string[] | undefined
const type = (params.type as string) ?? "pending"

async function main() {
  if (!identifiers || !Array.isArray(identifiers) || identifiers.length === 0) {
    Script.exit({ success: false, message: "Missing required parameter: identifiers (non-empty array)" })
    return
  }

  if (type !== "pending" && type !== "delivered") {
    Script.exit({ success: false, message: 'Parameter type must be "pending" or "delivered"' })
    return
  }

  try {
    if (type === "pending") {
      const all = await Notification.getAllPendings()
      const found = all.filter(n => identifiers.includes(n.identifier))
      const notFound = identifiers.filter(id => !all.some(n => n.identifier === id))

      await Notification.removePendings(found.map(n => n.identifier))

      Script.exit({
        success: true,
        removed: found.length,
        removedTitles: found.map(n => n.content.title || n.identifier),
        notFound
      })
    } else {
      const all = await Notification.getAllDelivereds()
      const found = all.filter(n => identifiers.includes(n.request.identifier))
      const notFound = identifiers.filter(id => !all.some(n => n.request.identifier === id))

      await Notification.removeDelivereds(found.map(n => n.request.identifier))

      Script.exit({
        success: true,
        removed: found.length,
        removedTitles: found.map(n => n.request.content.title || n.request.identifier),
        notFound
      })
    }
  } catch (error: any) {
    Script.exit({ success: false, message: error.message ?? String(error) })
  }
}

main()
