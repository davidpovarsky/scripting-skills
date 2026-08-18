// Backward-compatible executable entry. Prefer scripts/query.ts in SKILL.md.
import { Script } from "scripting"
import { execute } from "./lib/transit"
import { TransitRequest } from "./lib/types"
async function main(){ Script.exit(await execute(Script.queryParameters as TransitRequest)) }
void main()
