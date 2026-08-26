import { Script } from "scripting"

const params = Script.queryParameters
const repeatMode = params.repeatMode as string | undefined
const shuffleMode = params.shuffleMode as string | undefined

async function main() {
  if (!repeatMode && !shuffleMode) {
    Script.exit({
      success: false,
      message: "At least one parameter required: repeatMode or shuffleMode"
    })
    return
  }

  try {
    const validRepeatModes = ["none", "one", "all"]
    const validShuffleModes = ["off", "songs", "albums"]

    if (repeatMode) {
      if (!validRepeatModes.includes(repeatMode)) {
        Script.exit({
          success: false,
          message: `Invalid repeatMode: ${repeatMode}. Use: ${validRepeatModes.join(", ")}`
        })
        return
      }
      await SystemMusicPlayer.setRepeatMode(repeatMode as SystemMusicPlayer.RepeatMode)
    }

    if (shuffleMode) {
      if (!validShuffleModes.includes(shuffleMode)) {
        Script.exit({
          success: false,
          message: `Invalid shuffleMode: ${shuffleMode}. Use: ${validShuffleModes.join(", ")}`
        })
        return
      }
      await SystemMusicPlayer.setShuffleMode(shuffleMode as SystemMusicPlayer.ShuffleMode)
    }

    const currentRepeat = SystemMusicPlayer.getRepeatMode()
    const currentShuffle = SystemMusicPlayer.getShuffleMode()

    Script.exit({
      success: true,
      message: "Playback mode updated.",
      repeatMode: currentRepeat,
      shuffleMode: currentShuffle
    })
  } catch (error: any) {
    Script.exit({ success: false, message: error.message ?? String(error) })
  }
}

main()
