import { Button, HStack, Image, Script, Spacer, Text, VStack, useState } from "scripting"
import { InlineLoadingIndicator } from "./loading-view"

type MonitorItem = { key?: string; line?: string; destination?: string; minutes?: number; realtime?: boolean; title?: string; detail?: string }
type Monitor = {
  id: string
  kind?: string
  title?: string
  status?: string
  stopCode?: string
  lineNumber?: string
  pollIntervalSeconds?: number
  minMinutes?: number
  maxMinutes?: number
  arrivalWindowMinutes?: number
  notifyMode?: string
  condition?: string
  delivery?: string
  checks?: number
  lastCheckAt?: number
  lastNotificationAt?: number
  lastError?: string
  lastItems?: MonitorItem[]
  runnerHealthy?: boolean
}

type Props = { message?: string; monitor?: Monitor; monitors?: Monitor[] }
const PROJECT = "israel_transit_monitor"

function time(ms?: number) {
  return ms ? new Date(ms).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : "—"
}
function intervalText(sec?: number) {
  if (!sec) return "—"
  if (sec < 60) return `${sec} שנ׳`
  const min = Math.round(sec / 6) / 10
  return `${min} דק׳`
}
function windowText(m: Monitor) {
  const max = m.maxMinutes ?? m.arrivalWindowMinutes
  if (m.minMinutes !== undefined && max !== undefined && m.minMinutes > 0) return `${m.minMinutes}–${max} דק׳`
  return max !== undefined ? `${max} דק׳` : "—"
}
function itemText(item: MonitorItem) {
  if (item.title) return item.title
  const line = item.line ? `קו ${item.line}` : ""
  const dest = item.destination ? ` · ${item.destination}` : ""
  const eta = Number.isFinite(item.minutes) ? ` · ${item.minutes} דק׳` : ""
  return `${line}${dest}${eta}`.trim() || item.detail || ""
}

function MonitorCard({ initial }: { initial: Monitor }) {
  const [monitor, setMonitor] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [busyAction, setBusyAction] = useState<string | undefined>()
  const [statusText, setStatusText] = useState<string | undefined>()

  async function call(action: string) {
    if (busy) return
    setBusy(true); setBusyAction(action); setStatusText(undefined)
    try {
      const result: any = await Script.run({ name: PROJECT, queryParameters: { action, payload: JSON.stringify({ watchId: monitor.id }) }, singleMode: false })
      if (result?.data?.monitor) setMonitor(result.data.monitor)
      setStatusText(String(result?.message || ""))
      if (action === "resume_monitor") {
        void Script.run({ name: PROJECT, queryParameters: { action: "run_monitors" }, singleMode: true }).catch(() => {})
      }
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : String(error))
    } finally { setBusy(false); setBusyAction(undefined) }
  }
  async function refresh() { await call("get_monitor") }

  const active = monitor.status === "active"
  const paused = monitor.status === "paused"
  const stopped = monitor.status === "cancelled" || monitor.status === "completed"
  const items = (monitor.lastItems || []).slice(0, 4)
  return (
    <VStack spacing={8} padding={12} background="systemGray6" clipShape={{ type: "rect", cornerRadius: 14 }} alignment="trailing">
      <HStack spacing={8}>
        <VStack spacing={1} alignment="trailing" layoutPriority={1}>
          <Text font="headline" fontWeight="bold" lineLimit={1}>{monitor.title || "Transit monitor"}</Text>
          <Text font="caption2" foregroundStyle="secondaryLabel">{monitor.id}</Text>
        </VStack>
        <Spacer />
        <Image systemName={active ? "dot.radiowaves.left.and.right" : paused ? "pause.circle.fill" : "stop.circle.fill"} foregroundStyle={active ? (monitor.runnerHealthy ? "systemGreen" : "systemOrange") : paused ? "systemOrange" : "secondaryLabel"} />
      </HStack>
      <HStack spacing={8} frame={{ maxWidth: "infinity" }}>
        <Text font="caption" foregroundStyle="secondaryLabel">כל {intervalText(monitor.pollIntervalSeconds)}</Text>
        <Text font="caption" foregroundStyle="secondaryLabel">חלון {windowText(monitor)}</Text>
        <Text font="caption" foregroundStyle="secondaryLabel">בדיקה {time(monitor.lastCheckAt)}</Text>
        <Spacer />
      </HStack>
      {items.length ? <VStack spacing={4} alignment="trailing">{items.map((item, index) => <HStack key={item.key || String(index)}><Image systemName={item.realtime ? "location.fill" : "clock"} foregroundStyle={item.realtime ? "systemGreen" : "secondaryLabel"} font="caption2"/><Text font="caption" lineLimit={1}>{itemText(item)}</Text><Spacer/></HStack>)}</VStack> : null}
      {monitor.lastError ? <Text font="caption2" foregroundStyle="systemOrange" lineLimit={2}>{monitor.lastError}</Text> : null}
      <HStack spacing={7}>
        {!stopped && active ? <Button title="השהה" action={() => { void call("pause_monitor") }} disabled={busy} buttonStyle="bordered" controlSize="small"/> : null}
        {!stopped && paused ? <Button title="המשך" action={() => { void call("resume_monitor") }} disabled={busy} buttonStyle="borderedProminent" controlSize="small"/> : null}
        {!stopped ? <Button title="הפסק" role="destructive" action={() => { void call("cancel_monitor") }} disabled={busy} buttonStyle="bordered" controlSize="small"/> : null}
        <Button title="רענן" action={() => { void refresh() }} disabled={busy} buttonStyle="plain" controlSize="small"/>
        <Spacer />
      </HStack>
      {busy ? <HStack frame={{maxWidth:"infinity"}}><InlineLoadingIndicator kind="monitor" text={busyAction==="pause_monitor"?"משהה את המעקב":busyAction==="resume_monitor"?"מחדש את המעקב":busyAction==="cancel_monitor"?"מפסיק את המעקב":"מסנכרן את מצב המעקב"}/><Spacer/></HStack> : null}
      {statusText ? <Text font="caption2" foregroundStyle="secondaryLabel">{statusText}</Text> : null}
    </VStack>
  )
}

export default function MonitorView({ message, monitor, monitors = [] }: Props) {
  const list = monitor ? [monitor, ...monitors.filter(x => x.id !== monitor.id)] : monitors
  return (
    <VStack spacing={10} padding={12} alignment="trailing">
      <HStack><VStack alignment="trailing"><Text font="headline" fontWeight="bold">מעקבי תחבורה</Text>{message ? <Text font="caption" foregroundStyle="secondaryLabel">{message}</Text> : null}</VStack><Spacer/><Image systemName="bell.and.waves.left.and.right.fill" foregroundStyle="systemBlue"/></HStack>
      {list.length ? list.map(item => <MonitorCard key={item.id} initial={item}/>) : <Text font="subheadline" foregroundStyle="secondaryLabel">אין מעקבים להצגה</Text>}
    </VStack>
  )
}
