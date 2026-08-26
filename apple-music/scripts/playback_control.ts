import { Script } from "scripting"

const params = Script.queryParameters
const action = params.action as string
const seekTime = params.seekTime ? Number(params.seekTime) : undefined

async function main() {
  if (!action) {
    Script.exit({ success: false, message: "Missing required parameter: action" })
    return
  }

  const validActions = ["play", "pause", "stop", "next", "previous", "seek"]
  if (!validActions.includes(action)) {
    Script.exit({
      success: false,
      message: `Invalid action: ${action}. Use: ${validActions.join(", ")}`
    })
    return
  }

  try {
    switch (action) {
      case "play":
        await SystemMusicPlayer.play()
        break
      case "pause":
        await SystemMusicPlayer.pause()
        break
      case "stop":
        await SystemMusicPlayer.stop()
        break
      case "next":
        await SystemMusicPlayer.skipToNextItem()
        break
      case "previous":
        await SystemMusicPlayer.skipToPreviousItem()
        break
      case "seek":
        if (seekTime === undefined || isNaN(seekTime)) {
          Script.exit({ success: false, message: "seekTime is required for seek action" })
          return
        }
        await SystemMusicPlayer.seek(seekTime)
        break
    }

    const playbackState = SystemMusicPlayer.getPlaybackState()
    const nowPlaying = SystemMusicPlayer.getNowPlayingItem()

    Script.exit({
      success: true,
      message: `Action "${action}" executed successfully.`,
      playbackState,
      nowPlaying: nowPlaying ? {
        title: nowPlaying.title,
        artist: nowPlaying.artist,
        albumTitle: nowPlaying.albumTitle
      } : null
    })
  } catch (error: any) {
    Script.exit({ success: false, message: error.message ?? String(error) })
  }
}

main()
