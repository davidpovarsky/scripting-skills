import { ScrollView, VStack, Text, useEffect, useMemo, useState } from "scripting"
import { ACTIONS } from "../src/core/config"
import { normalizeToolParams } from "../src/core/params"
import { runOtzariaAction } from "../src/core/run"
import { safe } from "../src/core/text"
import { OtzariaProgressEvent, ToolEnvelope } from "../src/core/types"
import { SourceCard } from "../src/ui/SourceCard"

type Step = {
  id: string
  title: string
  detail: string
  phase: string
  error?: boolean
}

type LiveState = {
  running: boolean
  stage: string
  steps: Step[]
  partialResults: any[]
  envelope: ToolEnvelope | null
  error: string
}

function loadKey(props: Record<string, any>) {
  try { return JSON.stringify(props ?? {}) } catch { return String(Date.now()) }
}

function eventToStep(event: OtzariaProgressEvent, index: number): Step {
  return {
    id: `${Date.now()}-${index}-${event.phase}`,
    title: event.title,
    detail: event.detail || event.match || event.query || "",
    phase: event.phase,
    error: event.phase === "error" || event.phase === "search_attempt_error"
  }
}

function trimSteps(steps: Step[]): Step[] {
  return steps.length > 18 ? steps.slice(steps.length - 18) : steps
}

function Panel({ title, children }: { title: string; children: any }) {
  return (
    <VStack spacing={8} padding={12} background="systemGray6" clipShape={{ type: "rect", cornerRadius: 12 }}>
      <Text font="headline" fontWeight="semibold">{title}</Text>
      {children}
    </VStack>
  )
}

function renderResults(results: any[]) {
  if (results.length === 0) {
    return <Panel title="תוצאות חיות">
      <Text>עדיין אין תוצאות להצגה.</Text>
    </Panel>
  }

  return results.slice(0, 20).map((line, index) => <SourceCard
    key={`${line.lineId ?? index}`}
    bookTitle={safe(line.bookTitle)}
    heRef={line.heRef ?? null}
    text={safe(line.cleanContent || line.text)}
  />)
}

export default function OtzariaLiveSearch(props: Record<string, any>) {
  const key = useMemo(() => loadKey(props), [props])
  const params = useMemo(() => {
    const next = normalizeToolParams(props)
    if (!next.action && next.query) next.action = "search"
    return next
  }, [key])

  const [state, setState] = useState<LiveState>({
    running: true,
    stage: "מכין חיפוש...",
    steps: [],
    partialResults: [],
    envelope: null,
    error: ""
  })

  async function run() {
    const action = safe(params.action || "search")
    const query = safe(params.query).trim()

    if (!action || !ACTIONS.includes(action)) {
      setState({
        running: false,
        stage: "חסרה פעולה תקינה",
        steps: [],
        partialResults: [],
        envelope: null,
        error: "יש להעביר action תקין. לחיפוש חי השתמש ב־action: search וב־query."
      })
      return
    }

    if (action !== "search") {
      setState({
        running: false,
        stage: "פעולה לא נתמכת בתצוגת חיפוש חי",
        steps: [],
        partialResults: [],
        envelope: null,
        error: "otzaria-live-search.tsx מיועד לחיפוש חי בלבד. לפעולות אחרות השתמש ב־otzaria-renderer.tsx."
      })
      return
    }

    if (!query) {
      setState({
        running: false,
        stage: "חסר טקסט לחיפוש",
        steps: [],
        partialResults: [],
        envelope: null,
        error: "יש להעביר query לחיפוש."
      })
      return
    }

    let counter = 0
    setState({
      running: true,
      stage: `מחפש: ${query}`,
      steps: [],
      partialResults: [],
      envelope: null,
      error: ""
    })

    try {
      const envelope = await runOtzariaAction(params, (event) => {
        const step = eventToStep(event, counter++)
        setState(prev => ({
          ...prev,
          running: event.phase !== "action_complete" && event.phase !== "error",
          stage: event.title,
          steps: trimSteps([...prev.steps, step]),
          partialResults: Array.isArray(event.results) ? event.results : prev.partialResults,
          error: event.error || prev.error
        }))
      })

      const finalResults = Array.isArray(envelope.result?.results) ? envelope.result.results : []
      setState(prev => ({
        ...prev,
        running: false,
        stage: `החיפוש הסתיים · ${finalResults.length} תוצאות`,
        partialResults: finalResults,
        envelope,
        error: ""
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        running: false,
        stage: "החיפוש נכשל",
        envelope: null,
        error: safe(error)
      }))
    }
  }

  useEffect(() => {
    run()
  }, [key])

  const resultCount = state.partialResults.length

  return (
    <ScrollView>
      <VStack spacing={12} padding={16}>
        <Text font="title2" fontWeight="bold">אוצריא — חיפוש חי</Text>

        <Panel title="חיפוש חי באוצריא">
          <Text>שאילתה: {safe(params.query)}</Text>
          <Text font="caption" foregroundStyle="secondaryLabel">מצב: {state.stage}</Text>
          <Text font="caption" foregroundStyle="secondaryLabel">תוצאות שנאספו עד עכשיו: {resultCount}</Text>
          {state.running ? <Text font="caption" foregroundStyle="secondaryLabel">החיפוש עדיין רץ ומתעדכן...</Text> : <Text font="caption" foregroundStyle="secondaryLabel">החיפוש הסתיים.</Text>}
        </Panel>

        {state.error ? <Panel title="שגיאה">
          <Text>{state.error}</Text>
        </Panel> : null}

        <Panel title="מה קורה עכשיו">
          {state.steps.length === 0 ? <Text font="caption" foregroundStyle="secondaryLabel">ממתין להתחלת החיפוש...</Text> : null}
          {state.steps.map(step => <Text key={step.id} font="caption" foregroundStyle={step.error ? "systemRed" : "secondaryLabel"}>{step.error ? "⚠︎ " : "• "}{step.title}{step.detail ? ` — ${step.detail}` : ""}</Text>)}
        </Panel>

        {renderResults(state.partialResults)}

        {state.envelope ? <Panel title="אבחון קצר">
          <Text font="caption" foregroundStyle="secondaryLabel">פעולה: {safe(state.envelope.action)}</Text>
          <Text font="caption" foregroundStyle="secondaryLabel">כלי: {safe(state.envelope.tool)}</Text>
          <Text font="caption" foregroundStyle="secondaryLabel">תוצאות: {Array.isArray(state.envelope.result?.results) ? state.envelope.result.results.length : 0}</Text>
          <Text font="caption" foregroundStyle="secondaryLabel">ניסיונות חיפוש: {Array.isArray(state.envelope.result?.attempts) ? state.envelope.result.attempts.length : 0}</Text>
        </Panel> : null}
      </VStack>
    </ScrollView>
  )
}
