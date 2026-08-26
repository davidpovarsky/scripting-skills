import { Script } from "scripting"

const params = Script.queryParameters
const path = params.path as string | undefined
const base64 = params.base64 as string | undefined
const fileName = params.fileName as string | undefined
const shouldMove = params.shouldMove === true || (params.shouldMove as any) === "true"

async function main() {
  if (!path && !base64) {
    Script.exit({ success: false, message: "Missing required parameter: path or base64" })
    return
  }

  try {
    let success = false

    if (path) {
      // Save from file path
      success = await Photos.savePhoto(path, {
        fileName,
        shouldMoveFile: shouldMove
      })
    } else if (base64) {
      // Save from base64 data
      const data = Data.fromBase64String(base64)
      if (!data) {
        Script.exit({ success: false, message: "Invalid base64 data" })
        return
      }

      success = await Photos.savePhoto(data, { fileName })
    }

    Script.exit({
      success,
      message: success
        ? `Photo saved to Photos app${fileName ? ` as "${fileName}"` : ""}`
        : "Failed to save photo"
    })
  } catch (error: any) {
    Script.exit({ success: false, error: error.message ?? String(error) })
  }
}

main()
