import { Script } from "scripting"
import { runOtzariaAction } from "../src/core/run"
import { normalizeToolParams } from "../src/core/params"

async function main() {
  const params = normalizeToolParams({ action: "search", query: "קטן אוכל נבלות", limit: 20 })
  const envelope = await runOtzariaAction(params)
  Script.exit(JSON.stringify(envelope.result, null, 2))
}
main()
