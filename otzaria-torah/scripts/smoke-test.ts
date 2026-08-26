import { runOtzariaAction } from "../src/core/run"
import { toJson } from "../src/core/text"

async function main() {
  const tests = [
    { action: "db_status" },
    { action: "find_book", query: "בראשית", limit: 5 },
    { action: "read_ref", ref: "בראשית א, א", limit: 5 },
    { action: "search", query: "חולה בשבת", limit: 5 }
  ]

  for (const test of tests) {
    console.log("\n---", test.action, "---")
    try {
      const result = await runOtzariaAction(test as any)
      console.log(toJson(result))
    } catch (error) {
      console.error(String(error))
    }
  }
}

main()
