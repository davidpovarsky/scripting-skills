import { Script } from "scripting"

const params = Script.queryParameters
const camera = (params.camera as "rear" | "front") ?? "rear"
const flash = (params.flash as "auto" | "on" | "off") ?? "auto"
const allowsEditing = params.allowsEditing === true || (params.allowsEditing as any) === "true"
const outputFormat = (params.output_format as string) ?? "path"

async function main() {
  try {
    const result = await Photos.capture({
      mode: "photo",
      mediaTypes: ["public.image"],
      cameraDevice: camera,
      cameraFlashMode: flash,
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

    // Try to get image path or save image to temp
    let imagePath = result.imagePath
    if (!imagePath && (result.editedImage || result.originalImage)) {
      const image = result.editedImage || result.originalImage
      const tempPath = `${FileManager.temporaryDirectory}/captured_photo_${Date.now()}.jpg`
      const jpegData = image!.toJPEGData(0.9)
      if (jpegData) {
        FileManager.writeAsDataSync(tempPath, jpegData)
        imagePath = tempPath
      }
    }

    if (imagePath) {
      response.path = imagePath
      
      if (outputFormat === "base64") {
        const image = UIImage.fromFile(imagePath)
        response.base64 = image?.toJPEGBase64String(0.8)
      }
    }

    if (result.editedImage) {
      response.hasEditedImage = true
      if (outputFormat === "base64") {
        response.editedBase64 = result.editedImage.toJPEGBase64String(0.8)
      }
    }

    if (result.cropRect) {
      response.cropRect = result.cropRect
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
