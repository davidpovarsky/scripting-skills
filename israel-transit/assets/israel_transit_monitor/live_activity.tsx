import {
  HStack,
  Image,
  LiveActivity,
  LiveActivityUI,
  LiveActivityUIBuilder,
  LiveActivityUIExpandedBottom,
  LiveActivityUIExpandedCenter,
  LiveActivityUIExpandedLeading,
  LiveActivityUIExpandedTrailing,
  Spacer,
  Text,
  VStack,
} from "scripting"

export type MonitorLiveItem = {
  key: string
  line?: string
  destination?: string
  minutes?: number
  realtime?: boolean
  title?: string
  detail?: string
}

export type MonitorLiveState = {
  monitorId: string
  title: string
  subtitle?: string
  status: string
  updatedAt: number
  items: MonitorLiveItem[]
  error?: string
}

const ACTIVITY_NAME = "IsraelTransitMonitor"
const H = { noMatches: "אין התאמות כרגע", updated: "עודכן", min: "דק׳" }

function itemText(item: MonitorLiveItem) {
  if (item.title) return item.title
  const left = item.line ? `קו ${item.line}` : ""
  const dest = item.destination ? ` · ${item.destination}` : ""
  const eta = Number.isFinite(item.minutes) ? ` · ${item.minutes} ${H.min}` : ""
  return `${left}${dest}${eta}`.trim() || item.detail || ""
}

function MonitorContent(state: MonitorLiveState) {
  const items = (state.items || []).slice(0, 3)
  return (
    <VStack spacing={5} padding={{ horizontal: 12, vertical: 8 }} alignment="trailing" activityBackgroundTint={{ light: "clear", dark: "clear" }}>
      <HStack spacing={7} frame={{ maxWidth: "infinity" }}>
        <VStack spacing={1} alignment="trailing" layoutPriority={1}>
          <Text font="headline" fontWeight="bold" lineLimit={1}>{state.title}</Text>
          {state.subtitle ? <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}>{state.subtitle}</Text> : null}
        </VStack>
        <Spacer />
        <Image systemName="bell.and.waves.left.and.right.fill" foregroundStyle="systemBlue" symbolEffect={{ effect: "breathePulse", value: state.updatedAt }} />
      </HStack>
      {items.length ? items.map((item, index) => (
        <HStack key={item.key || String(index)} spacing={6} frame={{ maxWidth: "infinity" }}>
          <Image systemName={item.realtime ? "location.fill" : "clock"} foregroundStyle={item.realtime ? "systemGreen" : "secondaryLabel"} font="caption2" />
          <Text font="caption" fontWeight={index === 0 ? "semibold" : "regular"} lineLimit={1}>{itemText(item)}</Text>
          <Spacer />
        </HStack>
      )) : <Text font="caption" foregroundStyle="secondaryLabel">{state.error || H.noMatches}</Text>}
    </VStack>
  )
}

const builder: LiveActivityUIBuilder<MonitorLiveState> = state => {
  const first = state.items?.[0]
  const trailing = Number.isFinite(first?.minutes) ? `${first?.minutes}m` : "•"
  return (
    <LiveActivityUI
      content={<MonitorContent {...state} />}
      compactLeading={<HStack spacing={3}><Image systemName="bus.fill" foregroundStyle="systemBlue"/><Text font="caption2" fontWeight="bold">{first?.line || ""}</Text></HStack>}
      compactTrailing={<Text font="caption2" fontWeight="bold">{trailing}</Text>}
      minimal={<Image systemName="bell.fill" foregroundStyle="systemBlue"/>}
    >
      <LiveActivityUIExpandedLeading><Image systemName="bus.fill" foregroundStyle="systemBlue" /></LiveActivityUIExpandedLeading>
      <LiveActivityUIExpandedTrailing><Text font="caption2">{trailing}</Text></LiveActivityUIExpandedTrailing>
      <LiveActivityUIExpandedCenter><VStack><Text font="headline" fontWeight="bold" lineLimit={1}>{state.title}</Text><Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}>{state.subtitle || state.status}</Text></VStack></LiveActivityUIExpandedCenter>
      <LiveActivityUIExpandedBottom><MonitorContent {...state} /></LiveActivityUIExpandedBottom>
    </LiveActivityUI>
  )
}

export const MonitorLiveActivity = LiveActivity.register(ACTIVITY_NAME, builder)
export const MONITOR_ACTIVITY_NAME = ACTIVITY_NAME
