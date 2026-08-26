import { DateLabel, HStack, Image, Spacer, Text, VStack, Widget } from "scripting"

type TripInfo = {
  fromName?: string
  toName?: string
  startTime?: number
  endTime?: number
  durationMinutes?: number
  transfers?: number
  lines?: string
}

const H = {
  noTrip: "\u05d0\u05d9\u05df \u05de\u05e1\u05dc\u05d5\u05dc \u05e4\u05e2\u05d9\u05dc",
  depart: "\u05d9\u05e6\u05d9\u05d0\u05d4",
  arrive: "\u05d4\u05d2\u05e2\u05d4",
}

const trip = Storage.get<TripInfo>("currentTrip")

function TripWidget() {
  if (!trip) {
    return (
      <VStack spacing={8} padding={12}>
        <Image systemName="bus.fill" font="title2" foregroundStyle="systemBlue" />
        <Text font="headline">{H.noTrip}</Text>
      </VStack>
    )
  }
  return (
    <VStack spacing={8} padding={12} alignment="trailing">
      <HStack spacing={6}>
        <VStack spacing={2} alignment="trailing">
          <Text font="headline" fontWeight="bold" lineLimit={1}>{trip.fromName || "Start"} &#8592; {trip.toName || "End"}</Text>
          <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={1}>{trip.lines || ""}</Text>
        </VStack>
        <Spacer />
        <Image systemName="bus.fill" foregroundStyle="systemBlue" />
      </HStack>
      <HStack spacing={10}>
        <VStack spacing={1} alignment="trailing">
          <Text font="caption2" foregroundStyle="secondaryLabel">{H.depart}</Text>
          {trip.startTime ? <DateLabel date={new Date(trip.startTime)} style="time" /> : null}
        </VStack>
        <Spacer />
        <VStack spacing={1} alignment="trailing">
          <Text font="caption2" foregroundStyle="secondaryLabel">{H.arrive}</Text>
          {trip.endTime ? <DateLabel date={new Date(trip.endTime)} style="time" /> : null}
        </VStack>
      </HStack>
    </VStack>
  )
}

Widget.present(<TripWidget />)
