import { Script } from "scripting"

const params = Script.queryParameters
const limit = Number(params.limit) || 1
const filterType = params.filter as string | undefined
const mode = (params.mode as "default" | "compact") ?? "default"
// - "path":        return only local file paths (default, cheapest)
// - "base64":      return base64 strings inside the JSON payload (legacy)
// - "tool_output": return images as structured OutputParts the caller
//                  renders as real media instead of base64 text
const outputFormat = (params.output_format as string) ?? "path"

type PickedItem =
  | { type: "image"; path: string; base64?: string }
  | { type: "video"; path: string }
  | { type: "unknown"; path: null; error: string }

async function main() {
  try {
    // Build filter
    let filter: PHPickerFilter | undefined
    if (filterType) {
      const filterMap: Record<string, () => PHPickerFilter> = {
        images: () => PHPickerFilter.images(),
        videos: () => PHPickerFilter.videos(),
        livePhotos: () => PHPickerFilter.livePhotos(),
        screenshots: () => PHPickerFilter.screenshots(),
        panoramas: () => PHPickerFilter.panoramas(),
        bursts: () => PHPickerFilter.bursts(),
        cinematicVideos: () => PHPickerFilter.cinematicVideos(),
        depthEffectPhotos: () => PHPickerFilter.depthEffectPhotos(),
        screenRecordings: () => PHPickerFilter.screenRecordings(),
        slomoVideos: () => PHPickerFilter.slomoVideos(),
        timelapseVideos: () => PHPickerFilter.timelapseVideos()
      }

      if (filterMap[filterType]) {
        filter = filterMap[filterType]()
      } else {
        Script.exit({
          success: false,
          message: `Unknown filter type: ${filterType}. Available: ${Object.keys(filterMap).join(", ")}`
        })
        return
      }
    }

    // Pick photos
    const results = await Photos.pick({ mode, filter, limit })

    if (!results || results.length === 0) {
      Script.exit({ success: true, message: "No items selected", items: [] })
      return
    }

    // Process results
    const items: PickedItem[] = await Promise.all(
      results.map(async (result): Promise<PickedItem> => {
        try {
          const imagePath = await result.imagePath()
          if (imagePath) {
            // "tool_output" needs the base64 to build the OutputPart below;
            // "base64" inlines it into the JSON the LLM sees.
            if (outputFormat === "base64" || outputFormat === "tool_output") {
              const image = UIImage.fromFile(imagePath)
              const base64 = image?.toJPEGBase64String(0.8) ?? undefined
              return {
                type: "image",
                base64,
                path: imagePath
              }
            }
            return {
              type: "image",
              path: imagePath
            }
          }
        } catch (e) {
          // Not an image, try video
        }

        try {
          const videoPath = await result.videoPath()
          if (videoPath) {
            return {
              type: "video",
              path: videoPath
            }
          }
        } catch (e) {
          // Not a video either
        }

        return {
          type: "unknown",
          path: null,
          error: "Unable to process this item"
        }
      })
    )

    if (outputFormat === "tool_output") {
      // Attach each picked image as a real image OutputPart so the caller
      // (e.g. an agent) renders it as media instead of base64 text.
      //
      // Videos remain as textual path references — there is no video part
      // type, and embedding their bytes would blow past the 10MB/20MB limits
      // almost immediately.
      const content = items.flatMap((item) => {
        if (item.type === "image" && item.base64) {
          return [{
            type: "image" as const,
            mimeType: "image/jpeg",
            base64: item.base64,
          }]
        }
        return []
      })
      const videoPaths = items
        .filter((item): item is Extract<PickedItem, { type: "video" }> => item.type === "video")
        .map((item) => item.path)
      const summary = [
        `Picked ${items.length} item(s): ${content.length} image(s)` +
          (videoPaths.length > 0 ? `, ${videoPaths.length} video(s)` : ""),
        videoPaths.length > 0
          ? `Video paths:\n${videoPaths.map((p) => `  - ${p}`).join("\n")}`
          : undefined,
      ]
        .filter((line): line is string => !!line)
        .join("\n\n")

      Script.exit({
        structuredOutput: true,
        text: summary,
        content,
      })
      return
    }

    Script.exit({
      success: true,
      count: items.length,
      items
    })
  } catch (error: any) {
    Script.exit({ success: false, error: error.message ?? String(error) })
  }
}

main()
