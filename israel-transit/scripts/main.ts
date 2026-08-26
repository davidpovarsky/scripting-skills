// Backward-compatible executable entry for manual/legacy execution. Normal Assistant requests render scripts/transit-renderer.tsx directly.
import { Script } from "scripting"
import { execute } from "./lib/transit"
import { TransitRequest } from "./lib/types"
async function main(){ Script.exit(await execute(Script.queryParameters as TransitRequest)) }
void main()
