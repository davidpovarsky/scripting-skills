import { Script } from "scripting"

const params = Script.queryParameters
const camera = (params.camera as "rear" | "front") ?? "rear"
const flash = (params.flash as "auto" | "on" | "off") ?? "auto"
const maxDuration = Number(params.maxDuration) || 600
const quality = (params.quality as "low" | "medium" | "high") ?? "medium"
const allowsEditing = params.allowsEditing === true || (params.allowsEditing as any) === "true"

async function main() {
  try {
    const result = await Photos.capture({
      mode: "video",
      mediaTypes: ["public.movie"],
      cameraDevice: camera,
      cameraFlashMode: flash,
      videoMaximumDuration: maxDuration,
      videoQuality: quality,
      allowsEditing
    })

    if (!result) {
      Script.exit({ success: false, message: "Capture was cancelled" })
      return
    }

    const response: any = {
      success: true,
      mediaType: result.mediaType
    }

    if (result.mediaPath) {
      response.path = result.mediaPath
    }

    if (result.mediaMetadata) {
      response.metadata = result.mediaMetadata
    }

    Script.exit(response)
  } catch (error: any) {
    Script.exit({ success: false, error: error.message ?? String(error) })
  }
}

main()
