import { Script } from "scripting"

// Parameter types
interface ImageItem {
  type: "image"
  path: string
  duration: number
  contentMode?: "fit" | "crop"
  fadeIn?: number
  fadeOut?: number
}

interface VideoItem {
  type: "video"
  path: string
  keepAudio?: boolean
  startTime?: number
  duration?: number
  fadeIn?: number
  fadeOut?: number
}

type MediaItem = ImageItem | VideoItem

interface AudioConfig {
  path: string
  volume?: number
  loop?: boolean
  fadeIn?: number
  fadeOut?: number
  startTime?: number
  duration?: number
}

interface Params {
  exportPath: string
  items: MediaItem[]
  audio?: AudioConfig
  renderWidth?: number
  renderHeight?: number
  frameRate?: number
  preset?: MediaComposer.ExportPreset
  scaleMode?: "fit" | "crop"
  globalFadeIn?: number
  globalFadeOut?: number
  overwrite?: boolean
}

// Parse parameters
const params = Script.queryParameters as unknown as Params

function makeMediaTime(seconds: number): MediaTime {
  return MediaTime.make({ seconds, preferredTimescale: 600 })
}

function makeFadeConfig(fadeIn?: number, fadeOut?: number): MediaComposer.FadeConfig | undefined {
  if (fadeIn === undefined && fadeOut === undefined) return undefined
  return {
    fadeInSeconds: fadeIn ?? 0,
    fadeOutSeconds: fadeOut ?? 0
  }
}

function buildVideoItems(items: MediaItem[]): MediaComposer.VideoItem[] {
  return items.map(item => {
    if (item.type === "image") {
      const imageClip: MediaComposer.ImageClip = {
        imagePath: item.path,
        duration: makeMediaTime(item.duration),
        contentMode: item.contentMode ?? "fit",
        fade: makeFadeConfig(item.fadeIn, item.fadeOut)
      }
      return imageClip as MediaComposer.VideoItem
    } else {
      const videoClip: MediaComposer.VideoClip = {
        videoPath: item.path,
        keepOriginalAudio: item.keepAudio ?? false,
        fade: makeFadeConfig(item.fadeIn, item.fadeOut)
      }
      // Add source time range if specified
      if (item.startTime !== undefined || item.duration !== undefined) {
        const start = item.startTime ?? 0
        const duration = item.duration
        if (duration !== undefined) {
          videoClip.sourceTimeRange = {
            start: makeMediaTime(start),
            duration: makeMediaTime(duration)
          }
        }
      }
      return videoClip as MediaComposer.VideoItem
    }
  })
}

function buildAudioClips(audio?: AudioConfig): MediaComposer.AudioClip[] {
  if (!audio) return []

  const audioClip: MediaComposer.AudioClip = {
    path: audio.path,
    volume: audio.volume ?? 1,
    loopToFitVideoDuration: audio.loop ?? false,
    fade: makeFadeConfig(audio.fadeIn, audio.fadeOut)
  }

  // Add source time range if specified
  if (audio.startTime !== undefined || audio.duration !== undefined) {
    const start = audio.startTime ?? 0
    const duration = audio.duration
    if (duration !== undefined) {
      audioClip.sourceTimeRange = {
        start: makeMediaTime(start),
        duration: makeMediaTime(duration)
      }
    }
  }

  return [audioClip]
}

async function main() {
  // Validate required parameters
  if (!params.exportPath) {
    Script.exit({ success: false, message: "Missing required parameter: exportPath" })
    return
  }

  if (!params.items || !Array.isArray(params.items) || params.items.length === 0) {
    Script.exit({ success: false, message: "Missing required parameter: items (must be a non-empty array)" })
    return
  }

  // Validate items
  for (let i = 0; i < params.items.length; i++) {
    const item = params.items[i]
    if (!item.type || !item.path) {
      Script.exit({ success: false, message: `Item ${i}: missing type or path` })
      return
    }
    if (item.type === "image" && !item.duration) {
      Script.exit({ success: false, message: `Item ${i}: image requires duration` })
      return
    }
    if (item.type !== "image" && item.type !== "video") {
      Script.exit({ success: false, message: `Item ${i}: type must be "image" or "video"` })
      return
    }
  }

  try {
    // Build export options
    const exportOptions: MediaComposer.ExportOptions = {
      renderSize: {
        width: params.renderWidth ?? 1080,
        height: params.renderHeight ?? 1920
      },
      frameRate: params.frameRate ?? 30,
      scaleMode: params.scaleMode ?? "fit",
      presetName: params.preset ?? "HighestQuality"
    }

    // Add global fade if specified
    if (params.globalFadeIn !== undefined || params.globalFadeOut !== undefined) {
      exportOptions.globalVideoFade = {
        fadeInSeconds: params.globalFadeIn ?? 0,
        fadeOutSeconds: params.globalFadeOut ?? 0
      }
    }

    // Build timeline
    const videoItems = buildVideoItems(params.items)
    const audioClips = buildAudioClips(params.audio)

    // Compose and export
    const result = await MediaComposer.composeAndExport({
      exportPath: params.exportPath,
      timeline: {
        videoItems,
        audioClips
      },
      exportOptions,
      overwrite: params.overwrite ?? true
    })

    Script.exit({
      success: true,
      exportPath: result.exportPath,
      duration: result.duration.getSeconds(),
      message: `Video exported successfully: ${result.exportPath} (${result.duration.getSeconds().toFixed(2)}s)`
    })
  } catch (error: any) {
    Script.exit({
      success: false,
      message: error.message ?? String(error)
    })
  }
}

main()
