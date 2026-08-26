import { Notification, Script } from "scripting"

const params = Script.queryParameters
const type = (params.type as string) ?? "pending"

async function getPending() {
  const notifications = await Notification.getAllPendings()
  return notifications.map(n => ({
    identifier: n.identifier,
    title: n.content.title,
    subtitle: n.content.subtitle,
    body: n.content.body,
    triggerDate: (() => {
      if (n.trigger instanceof LocationNotificationTrigger) return null
      const date = n.trigger?.nextTriggerDate()
      return date ? date.toISOString() : null
    })()
  }))
}

async function getDelivered() {
  const notifications = await Notification.getAllDelivereds()
  return notifications.map(n => ({
    identifier: n.request.identifier,
    title: n.request.content.title,
    subtitle: n.request.content.subtitle,
    body: n.request.content.body,
    triggerDate: n.date ? n.date.toISOString() : null
  }))
}

async function main() {
  try {
    const results = type === "delivered" ? await getDelivered() : await getPending()
    Script.exit({ success: true, type, count: results.length, notifications: results })
  } catch (error: any) {
    Script.exit({ success: false, error: error.message ?? String(error) })
  }
}

main()
