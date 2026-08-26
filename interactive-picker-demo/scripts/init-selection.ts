import { Script } from "scripting"

async function main() {
  const query = Script.queryParameters
  const resultPath = query["resultPath"] as string

  // Create an empty selection file
  FileManager.writeAsStringSync(resultPath, JSON.stringify({
    selected: false,
    choice: null,
    timestamp: null,
  }, null, 2))

  Script.exit("Selection file created at: " + resultPath)
}

await main()
