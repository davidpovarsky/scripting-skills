import { HStack, Image, Notification, Spacer, Text, VStack } from "scripting"

type Item = { line?: string; destination?: string; minutes?: number; realtime?: boolean; title?: string; detail?: string; delayMinutes?: number }
type Info = { kind?: string; monitorId?: string; title?: string; subtitle?: string; status?: string; items?: Item[]; message?: string; checkedAt?: number }

const info = (Notification.current?.request.content.userInfo || {}) as Info
const items = Array.isArray(info.items) ? info.items.slice(0, 5) : []

function row(item: Item, index: number) {
  const title = item.title || [item.line ? `קו ${item.line}` : "", item.destination || ""].filter(Boolean).join(" · ") || item.detail || ""
  const eta = Number.isFinite(item.minutes) ? `${item.minutes} דק׳` : ""
  return (
    <HStack key={String(index)} spacing={7}>
      <Image systemName={item.realtime ? "location.fill" : "clock"} foregroundStyle={item.realtime ? "systemGreen" : "secondaryLabel"} font="caption2" />
      <VStack spacing={1} alignment="trailing" layoutPriority={1}>
        <Text font="subheadline" fontWeight="semibold" lineLimit={1}>{title}</Text>
        {item.detail ? <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}>{item.detail}</Text> : null}
      </VStack>
      <Spacer />
      {eta ? <Text font="headline" fontWeight="bold">{eta}</Text> : null}
    </HStack>
  )
}

function MonitorNotificationView() {
  return (
    <VStack spacing={9} padding={12} alignment="trailing">
      <HStack spacing={8}>
        <VStack spacing={2} alignment="trailing" layoutPriority={1}>
          <Text font="headline" fontWeight="bold" lineLimit={1}>{info.title || "Israel Transit"}</Text>
          {info.subtitle ? <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={1}>{info.subtitle}</Text> : null}
        </VStack>
        <Spacer />
        <Image systemName="bell.and.waves.left.and.right.fill" foregroundStyle="systemBlue" />
      </HStack>
      {items.length ? items.map(row) : <Text font="subheadline" foregroundStyle="secondaryLabel">{info.message || "אין התאמות כרגע"}</Text>}
      {info.status ? <Text font="caption2" foregroundStyle="tertiaryLabel">{info.status}</Text> : null}
    </VStack>
  )
}

Notification.present(<MonitorNotificationView />)
