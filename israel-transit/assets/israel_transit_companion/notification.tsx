import { DateLabel, HStack, Image, Notification, Spacer, Text, VStack } from "scripting"

type TripInfo = {
  fromName?: string
  toName?: string
  startTime?: number
  endTime?: number
  durationMinutes?: number
  transfers?: number
  lines?: string
  legs?: Array<{ mode?: string; route?: string; from?: string; to?: string; startTime?: number }>
}

const H = {
  leave: "\u05d6\u05de\u05df \u05dc\u05e6\u05d0\u05ea",
  depart: "\u05d9\u05e6\u05d9\u05d0\u05d4",
  arrive: "\u05d4\u05d2\u05e2\u05d4",
  line: "\u05e7\u05d5",
  walk: "\u05d4\u05dc\u05d9\u05db\u05d4",
  transfers: "\u05d4\u05d7\u05dc\u05e4\u05d5\u05ea",
}

const info = (Notification.current?.request.content.userInfo || {}) as TripInfo
const legs = Array.isArray(info.legs) ? info.legs.slice(0, 4) : []

function TripNotificationView() {
  return (
    <VStack spacing={10} padding={12} alignment="trailing">
      <HStack spacing={8}>
        <VStack spacing={2} alignment="trailing">
          <Text font="headline" fontWeight="bold">{H.leave}</Text>
          <Text font="subheadline" lineLimit={1}>{info.fromName || "Start"} &#8592; {info.toName || "End"}</Text>
        </VStack>
        <Spacer />
        <Image systemName="bus.fill" foregroundStyle="systemBlue" />
      </HStack>
      <HStack spacing={12}>
        <VStack spacing={1} alignment="trailing">
          <Text font="caption2" foregroundStyle="secondaryLabel">{H.depart}</Text>
          {info.startTime ? <DateLabel date={new Date(info.startTime)} style="time" /> : null}
        </VStack>
        <VStack spacing={1} alignment="trailing">
          <Text font="caption2" foregroundStyle="secondaryLabel">{H.arrive}</Text>
          {info.endTime ? <DateLabel date={new Date(info.endTime)} style="time" /> : null}
        </VStack>
        <Spacer />
        <Text font="caption" foregroundStyle="secondaryLabel">{info.lines || ""}</Text>
      </HStack>
      {legs.map((leg, i) => (
        <HStack key={i} spacing={7}>
          <Image systemName={leg.mode === "WALK" ? "figure.walk" : "bus.fill"} foregroundStyle={leg.mode === "WALK" ? "secondaryLabel" : "systemBlue"} />
          <Text font="caption" fontWeight="semibold">{leg.mode === "WALK" ? H.walk : `${H.line} ${leg.route || ""}`}</Text>
          <Spacer />
          <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}>{leg.from || ""} &#8592; {leg.to || ""}</Text>
        </HStack>
      ))}
      <Text font="caption2" foregroundStyle="tertiaryLabel">{info.durationMinutes || 0} min &#183; {info.transfers || 0} {H.transfers}</Text>
    </VStack>
  )
}

Notification.present(<TripNotificationView />)
