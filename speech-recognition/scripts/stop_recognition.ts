import { Script } from "scripting"

async function main() {
  try {
    await SpeechRecognition.stop()
    
    Script.exit({
      success: true,
      message: "Speech recognition stopped"
    })
  } catch (error: any) {
    Script.exit({
      success: false,
      message: error.message ?? String(error)
    })
  }
}

main()
