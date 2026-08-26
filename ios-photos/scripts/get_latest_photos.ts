import { Script } from "scripting"

const params = Script.queryParameters
const count = Number(params.count) || 5
const outputFormat = (params.output_format as string) ?? "path"

async function main() {
  try {
    const images = await Photos.getLatestPhotos(count)

    if (!images || images.length === 0) {
      Script.exit({ success: true, message: "No photos found", photos: [] })
      return
    }

    const photos = images.map((image, index) => {
      const info: any = {
        index,
        width: image.width,
        height: image.height,
        scale: image.scale
      }

      if (outputFormat === "base64") {
        info.base64 = image.toJPEGBase64String(0.8)
      } else {
        // Save to temp file and return path
        const tempPath = `${FileManager.temporaryDirectory}/photo_${Date.now()}_${index}.jpg`
        const jpegData = image.toJPEGData(0.8)
        if (jpegData) {
          FileManager.writeAsDataSync(tempPath, jpegData)
          info.path = tempPath
        }
      }

      return info
    })

    Script.exit({
      success: true,
      count: photos.length,
      photos
    })
  } catch (error: any) {
    Script.exit({ success: false, error: error.message ?? String(error) })
  }
}

main()
