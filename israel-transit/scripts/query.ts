import { Script } from "scripting"
import { execute } from "./lib/transit"
import { TransitRequest } from "./lib/types"
import { maybeAutoUpdate } from "./lib/auto-update"
async function main(){
  await maybeAutoUpdate()
  const req=Script.queryParameters as TransitRequest
  const result=await execute(req)
  Script.exit(result)
}
void main()
