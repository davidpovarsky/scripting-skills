import { ScrollView, VStack, Text, useEffect, useMemo, useState } from "scripting"
import { ACTIONS } from "../src/core/config"
import { runOtzariaAction } from "../src/core/run"
import { safe } from "../src/core/text"
import { ToolEnvelope } from "../src/core/types"
import { normalizeToolParams } from "../src/core/params"
import { OtzariaResultsView } from "../src/ui/OtzariaResultsView"

type RenderState = {
  loading: boolean
  envelope: ToolEnvelope | null
  error: string
}

function loadKey(props: Record<string, any>) {
  try { return JSON.stringify(props ?? {}) } catch { return String(Date.now()) }
}

function InlineMessage({ title, message, detail }: { title: string; message: string; detail?: string }) {
  return (
    <ScrollView>
      <VStack spacing={12} padding={16}>
        <Text font="title2" fontWeight="bold">{title}</Text>
        <VStack spacing={8} padding={12} background="systemGray6" clipShape={{ type: "rect", cornerRadius: 12 }}>
          <Text>{message}</Text>
          {detail ? <Text font="caption" foregroundStyle="secondaryLabel">{detail}</Text> : null}
        </VStack>
      </VStack>
    </ScrollView>
  )
}

export default function OtzariaRenderer(props: Record<string, any>) {
  const key = useMemo(() => loadKey(props), [props])
  const params = useMemo(() => normalizeToolParams(props), [key])
  const [state, setState] = useState({ loading: true, envelope: null, error: "" } as RenderState)

  async function run() {
    const action = safe(params.action)
    if (!action || !ACTIONS.includes(action)) {
      setState({
        loading: false,
        envelope: null,
        error: "חסרה פעולה תקינה. יש להעביר action כגון search, read_ref, read_context, find_book, get_links, get_toc או db_status."
      })
      return
    }

    setState({ loading: true, envelope: null, error: "" })
    try {
      const envelope = await runOtzariaAction(params)
      setState({ loading: false, envelope, error: "" })
    } catch (error) {
      setState({ loading: false, envelope: null, error: safe(error) })
    }
  }

  useEffect(() => {
    run()
  }, [key])

  if (state.loading) {
    return <InlineMessage title="אוצריא" message="מחפש במסד הנתונים..." />
  }

  if (state.error) {
    return <InlineMessage title="שגיאה באוצריא" message={state.error} detail="בדוק שה־DB מוגדר וזמין לאפליקציה." />
  }

  if (!state.envelope) {
    return <InlineMessage title="אוצריא" message="לא התקבלה תוצאה." />
  }

  return <OtzariaResultsView envelope={state.envelope} onRefresh={run} />
}
