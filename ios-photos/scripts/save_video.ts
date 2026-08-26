import { Script } from "scripting"

const params = Script.queryParameters
const path = params.path as string
const fileName = params.fileName as string | undefined
const shouldMove = params.shouldMove === true || (params.shouldMove as any) === "true"

async function main() {
  if (!path) {
    Script.exit({ success: false, message: "Missing required parameter: path" })
    return
  }

  try {
    const success = await Photos.saveVideo(path, {
      fileName,
      shouldMoveFile: shouldMove
    })

    Script.exit({
      success,
      message: success
        ? `Video saved to Photos app${fileName ? ` as "${fileName}"` : ""}`
        : "Failed to save video"
    })
  } catch (error: any) {
    Script.exit({ success: false, error: error.message ?? String(error) })
  }
}

main()
