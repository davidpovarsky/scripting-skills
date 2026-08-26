import { Script } from "scripting"

const params = Script.queryParameters
const persistentIDs = params.persistentIDs as string[] | string
const startItemID = params.startItemID as string | undefined
const startTime = params.startTime ? Number(params.startTime) : undefined
const autoPlay = String(params.autoPlay) !== "false"

async function main() {
  if (!persistentIDs) {
    Script.exit({ success: false, message: "Missing required parameter: persistentIDs" })
    return
  }

  // Handle both array and comma-separated string
  let ids: string[]
  if (Array.isArray(persistentIDs)) {
    ids = persistentIDs
  } else if (typeof persistentIDs === "string") {
    ids = persistentIDs.split(",").map(id => id.trim())
  } else {
    Script.exit({ success: false, message: "persistentIDs must be an array or comma-separated string" })
    return
  }

  if (ids.length === 0) {
    Script.exit({ success: false, message: "persistentIDs array is empty" })
    return
  }

  try {
    const options: SystemMusicPlayer.SetQueueByPersistentIDsOptions = {
      persistentIDs: ids
    }
    if (startItemID) options.startItemID = startItemID
    if (startTime !== undefined && !isNaN(startTime)) options.startTime = startTime

    await SystemMusicPlayer.setQueueByPersistentIDs(options)

    if (autoPlay) {
      await SystemMusicPlayer.play()
    }

    Script.exit({
      success: true,
      message: `Queue set with ${ids.length} song(s).${autoPlay ? " Playback started." : ""}`,
      queueSize: ids.length
    })
  } catch (error: any) {
    Script.exit({ success: false, message: error.message ?? String(error) })
  }
}

main()
