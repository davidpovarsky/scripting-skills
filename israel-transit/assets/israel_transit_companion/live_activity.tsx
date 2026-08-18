import {
  Button,
  DateLabel,
  HStack,
  Image,
  LiveActivity,
  LiveActivityUI,
  LiveActivityUIBuilder,
  LiveActivityUIExpandedBottom,
  LiveActivityUIExpandedCenter,
  LiveActivityUIExpandedLeading,
  LiveActivityUIExpandedTrailing,
  Rectangle,
  Spacer,
  Text,
  TimerIntervalLabel,
  VStack,
} from "scripting"
import { ConfirmTransitTripIntent } from "./app_intents"

export type TripLiveActivityLeg = {
  index: number
  mode: string
  route?: string
  headsign?: string
  color?: string
  from: string
  to: string
  startTime: number
  endTime: number
  boardEta?: number
  alightEta?: number
  boardMinutes?: number
  alightMinutes?: number
  realtime: boolean
  delayMinutes?: number
  vehicleId?: string
  boardingMissed?: boolean
}

export type TripLiveActivityState = {
  fromName: string
  toName: string
  startTime: number
  endTime: number
  estimatedEndTime: number
  activityStartedAt: number
  updatedAt: number
  durationMinutes: number
  transfers: number
  lines: string
  currentStep: string
  currentLegIndex: number
  nextTransitIndex: number
  nextLine?: string
  nextBoardMinutes?: number
  realtimeAvailable: boolean
  journeyConfirmed: boolean
  confirmedAt?: number
  legs: TripLiveActivityLeg[]
}

const ACTIVITY_NAME = "IsraelTransitTrip"

const H = {
  arrive: "\u05d4\u05d2\u05e2\u05d4",
  depart: "\u05d9\u05e6\u05d9\u05d0\u05d4",
  realtime: "\u05d6\u05de\u05df \u05d0\u05de\u05ea",
  scheduled: "\u05de\u05ea\u05d5\u05db\u05e0\u05df",
  to: "\u05d0\u05dc",
  walk: "\u05d4\u05dc\u05d9\u05db\u05d4",
  line: "\u05e7\u05d5",
  busIn: "\u05d4\u05d0\u05d5\u05d8\u05d5\u05d1\u05d5\u05e1 \u05d1\u05e2\u05d5\u05d3",
  boardAt: "\u05e2\u05dc\u05d9\u05d9\u05d4",
  alightAt: "\u05d9\u05e8\u05d9\u05d3\u05d4",
  now: "\u05e2\u05db\u05e9\u05d9\u05d5",
  minutes: "\u05d3\u05e7\u05f3",
  dash: "\u2014",
  dot: "\u00b7",
  boarded: "\u05e2\u05dc\u05d9\u05ea\u05d9",
  locked: "\u05de\u05e1\u05dc\u05d5\u05dc \u05e0\u05e2\u05d5\u05dc",
  refreshing: "\u05de\u05e8\u05e2\u05e0\u05df...",
}

function isWalk(leg: TripLiveActivityLeg) {
  return leg.mode === "WALK"
}

function legIcon(leg: TripLiveActivityLeg) {
  if (isWalk(leg)) return "figure.walk"
  if (leg.mode === "RAIL" || leg.mode === "TRAIN") return "tram.fill"
  return "bus.fill"
}

function legTint(leg: TripLiveActivityLeg) {
  return isWalk(leg) ? "secondaryLabel" : (leg.color || "systemBlue")
}

function boardTarget(leg?: TripLiveActivityLeg) {
  if (!leg || leg.boardingMissed) return undefined
  return leg.boardEta || leg.startTime || undefined
}

function alightTarget(leg?: TripLiveActivityLeg) {
  if (!leg) return undefined
  return leg.alightEta || leg.endTime || undefined
}

function durationMinutes(leg: TripLiveActivityLeg) {
  const value = Math.max(0, Math.round((leg.endTime - leg.startTime) / 60_000))
  return value > 0 ? value : 1
}

function legProgress(leg: TripLiveActivityLeg, state: TripLiveActivityState) {
  if (!state.journeyConfirmed && leg.index === state.currentLegIndex && !isWalk(leg)) return 0
  if (leg.index < state.currentLegIndex) return 1
  if (leg.index > state.currentLegIndex) return 0
  const start = isWalk(leg) ? leg.startTime : (leg.boardEta || leg.startTime)
  const end = isWalk(leg) ? leg.endTime : (leg.alightEta || leg.endTime)
  if (!start || !end || end <= start) return 0
  return Math.max(0, Math.min(1, (state.updatedAt - start) / (end - start)))
}


function LiveCountdown({ target, state, compact = false }: { target?: number; state: TripLiveActivityState; compact?: boolean }) {
  if (!target) return <Text font={compact ? "caption2" : "subheadline"}>{H.dash}</Text>
  if (target <= state.updatedAt + 1_000) return <Text font={compact ? "caption2" : "subheadline"} fontWeight="bold">{H.now}</Text>
  return (
    <TimerIntervalLabel
      from={Math.min(state.updatedAt, target - 1)}
      to={target}
      countsDown={true}
      showsHours={!compact}
      font={compact ? "caption2" : "headline"}
      fontWeight="bold"
    />
  )
}

function Connector({ leg, state, compact }: { leg: TripLiveActivityLeg; state: TripLiveActivityState; compact: boolean }) {
  const width = compact ? 12 : 18
  const progress = legProgress(leg, state)
  const filled = Math.max(0, Math.min(width, width * progress))
  return (
    <HStack spacing={0} frame={{ width, height: 3 }}>
      {filled > 0 ? (
        <Rectangle
          frame={{ width: filled, height: 3 }}
          fill={legTint(leg)}
        />
      ) : null}
      {filled < width ? <Rectangle frame={{ width: width - filled, height: 2 }} fill="systemGray4" /> : null}
    </HStack>
  )
}

function RouteNode({ leg, state, compact }: { leg: TripLiveActivityLeg; state: TripLiveActivityState; compact: boolean }) {
  const active = leg.index === state.currentLegIndex
  const completed = state.journeyConfirmed && leg.index < state.currentLegIndex
  const target = boardTarget(leg)
  const nodeSize = active ? (compact ? 23 : 27) : (compact ? 20 : 23)
  const nodeTint = active ? legTint(leg) : completed ? "systemGray2" : "systemGray3"
  return (
    <VStack spacing={1} frame={{ minWidth: compact ? 27 : 34 }}>
      <HStack
        frame={{ width: nodeSize, height: nodeSize }}
        background={nodeTint}
        clipShape="circle"
      >
        <Spacer />
        <Image
          systemName={completed ? "checkmark" : legIcon(leg)}
          font="caption2"
          foregroundStyle="white"
          symbolEffect={active ? { effect: "breathePulse", value: state.updatedAt } : undefined}
        />
        <Spacer />
      </HStack>
      <Text font="caption2" fontWeight={active ? "bold" : "semibold"} foregroundStyle={active ? "label" : "secondaryLabel"} lineLimit={1}>
        {isWalk(leg) ? H.walk : (leg.route || H.line)}
      </Text>
      {!compact ? (
        isWalk(leg)
          ? <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}>{durationMinutes(leg)} {H.minutes}</Text>
          : target
            ? <DateLabel date={new Date(target)} style="time" font="caption2" foregroundStyle={leg.realtime ? "systemGreen" : "secondaryLabel"} />
            : <Text font="caption2" foregroundStyle="secondaryLabel">{leg.boardingMissed ? H.refreshing : H.dash}</Text>
      ) : null}
    </VStack>
  )
}
function RouteGraph({ state, compact = false }: { state: TripLiveActivityState; compact?: boolean }) {
  const legs = state.legs
  return (
    <HStack spacing={compact ? 1 : 2} frame={{ maxWidth: "infinity" }}>
      <Spacer />
      {legs.flatMap((leg, i) => {
        const node = <RouteNode key={`n${leg.index}`} leg={leg} state={state} compact={compact} />
        if (i === legs.length - 1) return [node]
        return [node, <Connector key={`c${leg.index}`} leg={leg} state={state} compact={compact} />]
      })}
      <Spacer />
    </HStack>
  )
}
function TripTimes({ state, compact = false }: { state: TripLiveActivityState; compact?: boolean }) {
  const departureFuture = state.startTime > state.updatedAt + 1_000
  return (
    <HStack spacing={compact ? 10 : 16}>
      <VStack spacing={0} alignment="trailing">
        <Text font="caption2" foregroundStyle="secondaryLabel">{H.depart}</Text>
        <DateLabel date={new Date(state.startTime)} style="time" font={compact ? "caption" : "subheadline"} fontWeight="semibold" />
        {!compact && departureFuture ? <LiveCountdown target={state.startTime} state={state} compact={true} /> : null}
      </VStack>
      <VStack spacing={0} alignment="trailing">
        <Text font="caption2" foregroundStyle="secondaryLabel">{H.arrive}</Text>
        <DateLabel date={new Date(state.estimatedEndTime)} style="time" font={compact ? "caption" : "subheadline"} fontWeight="semibold" />
      </VStack>
    </HStack>
  )
}

function NextTransitCard({ state }: { state: TripLiveActivityState }) {
  const idx = state.nextTransitIndex >= 0 ? state.nextTransitIndex : state.currentLegIndex
  const leg = state.legs[idx]
  if (!leg || isWalk(leg)) {
    return <Text font="subheadline" fontWeight="semibold" lineLimit={1}>{state.currentStep}</Text>
  }
  const board = boardTarget(leg)
  const alight = alightTarget(leg)
  return (
    <HStack spacing={8} frame={{ maxWidth: "infinity" }}>
      <HStack frame={{ width: 34, height: 34 }} background={legTint(leg)} clipShape="circle">
        <Spacer />
        <Image systemName={legIcon(leg)} foregroundStyle="white" symbolEffect={{ effect: "breathePulse", value: state.updatedAt }} />
        <Spacer />
      </HStack>
      <VStack spacing={1} alignment="trailing" layoutPriority={1}>
        <Text font="headline" fontWeight="bold" lineLimit={1}>{`${H.line} ${leg.route || ""}`}</Text>
        <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}>{leg.headsign || `${leg.from} \u2192 ${leg.to}`}</Text>
        <HStack spacing={4}>
          <Text font="caption2" foregroundStyle="secondaryLabel">{H.boardAt}</Text>
          {board ? <DateLabel date={new Date(board)} style="time" font="caption2" /> : <Text font="caption2">{H.dash}</Text>}
          <Text font="caption2" foregroundStyle="secondaryLabel">{H.dot} {H.alightAt}</Text>
          {alight ? <DateLabel date={new Date(alight)} style="time" font="caption2" /> : <Text font="caption2">{H.dash}</Text>}
        </HStack>
      </VStack>
      <Spacer />
      <VStack spacing={1} alignment="trailing">
        <Text font="caption2" foregroundStyle="secondaryLabel">{H.busIn}</Text>
        <LiveCountdown target={board} state={state} />
        <Text font="caption2" foregroundStyle={leg.realtime ? "systemGreen" : "secondaryLabel"}>{leg.realtime ? H.realtime : H.scheduled}</Text>
      </VStack>
    </HStack>
  )
}

function JourneyConfirmation({ state, compact = false }: { state: TripLiveActivityState; compact?: boolean }) {
  if (state.journeyConfirmed) {
    return (
      <HStack spacing={3}>
        <Image systemName="checkmark.circle.fill" foregroundStyle="systemGreen" font="caption2" />
        <Text font="caption2" foregroundStyle="secondaryLabel">{H.locked}</Text>
      </HStack>
    )
  }
  return (
    <Button
      title={H.boarded}
      systemImage="checkmark.circle.fill"
      intent={ConfirmTransitTripIntent(undefined)}
      buttonStyle="borderedProminent"
          />
  )
}

function LockScreenView(state: TripLiveActivityState) {
  return (
    <VStack spacing={6} padding={{ horizontal: 12, vertical: 8 }} alignment="trailing" activityBackgroundTint={{ light: "clear", dark: "clear" }}>
      <HStack spacing={8} frame={{ maxWidth: "infinity" }}>
        <VStack spacing={1} alignment="trailing" layoutPriority={1}>
          <Text font="headline" fontWeight="bold" lineLimit={1}>{H.to} {state.toName}</Text>
          <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}>{state.currentStep}</Text>
        </VStack>
        <Spacer />
        <TripTimes state={state} compact={true} />
      </HStack>
      <NextTransitCard state={state} />
      <HStack frame={{ maxWidth: "infinity" }}><Spacer /><JourneyConfirmation state={state} /></HStack>
      <RouteGraph state={state} />
    </VStack>
  )
}

const builder: LiveActivityUIBuilder<TripLiveActivityState> = (state) => {
  const next = state.legs[state.nextTransitIndex >= 0 ? state.nextTransitIndex : state.currentLegIndex]
  const nextBoard = boardTarget(next)
  return (
    <LiveActivityUI
      content={<LockScreenView {...state} />}
      compactLeading={
        <HStack spacing={3}>
          <Image
            systemName={next ? legIcon(next) : "bus.fill"}
            foregroundStyle={next ? legTint(next) : "systemBlue"}
            symbolEffect={{ effect: "breathePulse", value: state.updatedAt }}
          />
          <Text font="caption2" fontWeight="bold" lineLimit={1}>{next && !isWalk(next) ? next.route : H.walk}</Text>
        </HStack>
      }
      compactTrailing={<LiveCountdown target={nextBoard} state={state} compact={true} />}
      minimal={<Image systemName={next ? legIcon(next) : "bus.fill"} foregroundStyle={next ? legTint(next) : "systemBlue"} symbolEffect={{ effect: "breathePulse", value: state.updatedAt }} />}
    >
      <LiveActivityUIExpandedLeading>
        <VStack spacing={1} alignment="leading">
          <Text font="caption2" foregroundStyle="secondaryLabel">{next?.realtime ? H.realtime : H.scheduled}</Text>
          <Text font="headline" fontWeight="bold">{next && !isWalk(next) ? `${H.line} ${next.route || ""}` : H.walk}</Text>
          {nextBoard ? <DateLabel date={new Date(nextBoard)} style="time" font="caption2" /> : null}
        </VStack>
      </LiveActivityUIExpandedLeading>
      <LiveActivityUIExpandedTrailing>
        <VStack spacing={1} alignment="trailing">
          <Text font="caption2" foregroundStyle="secondaryLabel">{H.busIn}</Text>
          <LiveCountdown target={nextBoard} state={state} compact={true} />
        </VStack>
      </LiveActivityUIExpandedTrailing>
      <LiveActivityUIExpandedCenter>
        <VStack spacing={2} alignment="center">
          <Text font="headline" fontWeight="bold" lineLimit={1}>{H.to} {state.toName}</Text>
          <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}>{state.currentStep}</Text>
        </VStack>
      </LiveActivityUIExpandedCenter>
      <LiveActivityUIExpandedBottom>
        <VStack spacing={3} frame={{ maxWidth: "infinity" }}>
          <RouteGraph state={state} compact={true} />
          <HStack frame={{ maxWidth: "infinity" }}><TripTimes state={state} compact={true} /><Spacer /><JourneyConfirmation state={state} compact={true} /></HStack>
        </VStack>
      </LiveActivityUIExpandedBottom>
    </LiveActivityUI>
  )
}

export const TripLiveActivity = LiveActivity.register(ACTIVITY_NAME, builder)
