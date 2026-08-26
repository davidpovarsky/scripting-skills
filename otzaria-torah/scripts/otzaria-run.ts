import { Script } from "scripting"
import { ACTIONS } from "../src/core/config"
import { runOtzariaAction } from "../src/core/run"
import { safe, toJson } from "../src/core/text"
import { normalizeToolParams } from "../src/core/params"

function missingParamsResult(rawParams: any) {
  return {
    success: false,
    tool: "otzaria_torah",
    error: "missing_or_invalid_action",
    message: [
      "חסרים פרמטרים ל־Otzaria Torah. אין להריץ את הסקריפט ריק.",
      "דוגמאות תקינות:",
      '{"action":"search","query":"חולה בשבת","limit":5}',
      '{"action":"read_ref","ref":"בראשית א, א","limit":5}',
      '{"action":"find_book","query":"רמבם","limit":5}',
      '{"action":"db_status"}',
      "הפרמטרים שהתקבלו:",
      safe(JSON.stringify(rawParams ?? {}))
    ].join("\n")
  }
}

async function main() {
  const rawParams = Script.queryParameters ?? {}
  try {
    const params = normalizeToolParams(rawParams)
    const action = safe(params.action)

    if (!action || !ACTIONS.includes(action)) {
      Script.exit(missingParamsResult(rawParams))
      return
    }

    const envelope = await runOtzariaAction(params)
    Script.exit({
      success: true,
      tool: "otzaria_torah",
      action: envelope.action,
      dbPath: envelope.dbPath,
      result: envelope.result,
      envelope
    })
  } catch (error) {
    Script.exit({
      success: false,
      tool: "otzaria_torah",
      message: "Otzaria Torah script failed: " + safe(error),
      rawParams: toJson(rawParams)
    })
  }
}

main()
