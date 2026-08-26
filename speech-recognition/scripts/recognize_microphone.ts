import { Script } from "scripting"

const params = Script.queryParameters
const locale = params.locale as string | undefined
const timeout = Number(params.timeout) || 30
const addsPunctuation = params.addsPunctuation !== "false"
const taskHint = (params.taskHint as RecognitionTaskHint) || "dictation"

async function main() {
  try {
    // Check if already recognizing
    if (SpeechRecognition.isRecognizing) {
      await SpeechRecognition.stop()
    }

    let finalResult: SpeechRecognitionResult | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const resultPromise = new Promise<SpeechRecognitionResult>((resolve, reject) => {
      // Set timeout
      timeoutId = setTimeout(async () => {
        await SpeechRecognition.stop()
        if (finalResult) {
          resolve(finalResult)
        } else {
          reject(new Error(`Recognition timeout after ${timeout} seconds`))
        }
      }, timeout * 1000)

      SpeechRecognition.start({
        locale,
        partialResults: true,
        addsPunctuation,
        taskHint,
        onResult: (result) => {
          finalResult = result
          if (result.isFinal) {
            if (timeoutId) clearTimeout(timeoutId)
            resolve(result)
          }
        }
      }).then((started) => {
        if (!started) {
          if (timeoutId) clearTimeout(timeoutId)
          reject(new Error("Failed to start speech recognition"))
        }
      })
    })

    const result = await resultPromise

    Script.exit({
      success: true,
      text: result.text,
      isFinal: result.isFinal
    })
  } catch (error: any) {
    Script.exit({
      success: false,
      message: error.message ?? String(error)
    })
  }
}

main()
