import { Script } from "scripting"
import { execute } from "./lib/transit"
import { TransitRequest } from "./lib/types"

async function main(){
  const req=Script.queryParameters as TransitRequest
  const result=await execute(req)
  Script.exit(result)
}
void main()
