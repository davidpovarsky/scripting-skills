import { Script } from "scripting"

const params = Script.queryParameters
const action = params.action as string
const boundary = (params.boundary as SpeechBoundary) ?? "immediate"

async function main() {
  if (!action) {
    Script.exit({ success: false, message: "Missing required parameter: action" })
    return
  }

  const validActions = ["pause", "resume", "stop", "status"]
  if (!validActions.includes(action)) {
    Script.exit({
      success: false,
      message: `Invalid action: ${action}. Use: ${validActions.join(", ")}`
    })
    return
  }

  const validBoundaries = ["immediate", "word"]
  if (!validBoundaries.includes(boundary)) {
    Script.exit({
      success: false,
      message: `Invalid boundary: ${boundary}. Use: ${validBoundaries.join(", ")}`
    })
    return
  }

  try {
    let result: boolean = true
    let message: string = ""

    switch (action) {
      case "pause":
        result = await Speech.pause(boundary)
        message = result ? "Speech paused" : "Failed to pause (not speaking?)"
        break
      case "resume":
        result = await Speech.resume()
        message = result ? "Speech resumed" : "Failed to resume (not paused?)"
        break
      case "stop":
        result = await Speech.stop(boundary)
        message = result ? "Speech stopped" : "Failed to stop (not speaking?)"
        break
      case "status":
        const isSpeaking = await Speech.isSpeaking
        const isPaused = await Speech.isPaused
        Script.exit({
          success: true,
          isSpeaking,
          isPaused,
          message: isPaused ? "Paused" : (isSpeaking ? "Speaking" : "Idle")
        })
        return
    }

    Script.exit({ success: result, message })
  } catch (error: any) {
    Script.exit({ success: false, message: error.message ?? String(error) })
  }
}

main()
