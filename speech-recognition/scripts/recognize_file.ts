import { Script } from "scripting"

const params = Script.queryParameters
const filePath = params.filePath as string
const locale = params.locale as string | undefined
const addsPunctuation = params.addsPunctuation !== "false"
const taskHint = (params.taskHint as RecognitionTaskHint) || "dictation"

async function main() {
  if (!filePath) {
    Script.exit({
      success: false,
      message: "Missing required parameter: filePath"
    })
    return
  }

  try {
    let finalResult: SpeechRecognitionResult | null = null

    const resultPromise = new Promise<SpeechRecognitionResult>((resolve, reject) => {
      SpeechRecognition.recognizeFile({
        filePath,
        locale,
        partialResults: true,
        addsPunctuation,
        taskHint,
        onResult: (result) => {
          finalResult = result
          if (result.isFinal) {
            resolve(result)
          }
        }
      }).then((started) => {
        if (!started) {
          reject(new Error("Failed to start file recognition"))
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
