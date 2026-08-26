import { Script } from "scripting"

const params = Script.queryParameters
const playlistId = params.playlistId as string
const limit = params.limit ? Number(params.limit) : undefined

async function main() {
  if (!playlistId) {
    Script.exit({ success: false, message: "Missing required parameter: playlistId" })
    return
  }

  try {
    const options: MediaLibrary.SongQueryOptions = {}
    if (limit) options.limit = limit

    const songs = await MediaLibrary.getPlaylistSongs(playlistId, options)

    const result = songs.map(song => ({
      persistentID: song.persistentID,
      title: song.title,
      artist: song.artist,
      albumTitle: song.albumTitle,
      playbackDuration: song.playbackDuration,
      albumTrackNumber: song.albumTrackNumber
    }))

    Script.exit(result)
  } catch (error: any) {
    Script.exit({ success: false, message: error.message ?? String(error) })
  }
}

main()
