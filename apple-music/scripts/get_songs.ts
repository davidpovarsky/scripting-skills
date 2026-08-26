import { Script } from "scripting"

const params = Script.queryParameters
const title = params.title as string | undefined
const artist = params.artist as string | undefined
const albumTitle = params.albumTitle as string | undefined
const genre = params.genre as string | undefined
const limit = params.limit ? Number(params.limit) : 20
const sortBy = (params.sortBy as string) ?? "title"
const ascending = String(params.ascending) !== "false"

async function main() {
  try {
    const filter: MediaLibrary.SongFilter = {}
    if (title) filter.title = title
    if (artist) filter.artist = artist
    if (albumTitle) filter.albumTitle = albumTitle
    if (genre) filter.genre = genre

    const validSortFields = ["title", "artist", "albumTitle", "playbackDuration", "albumTrackNumber"]
    const sortField = validSortFields.includes(sortBy) ? sortBy : "title"

    const options: MediaLibrary.SongQueryOptions = {
      limit,
      sortBy: sortField as any,
      ascending
    }

    const songs = await MediaLibrary.getSongs(
      Object.keys(filter).length > 0 ? filter : undefined,
      options
    )

    const result = songs.map(song => ({
      persistentID: song.persistentID,
      title: song.title,
      artist: song.artist,
      albumTitle: song.albumTitle,
      albumArtist: song.albumArtist,
      genre: song.genre,
      playbackDuration: song.playbackDuration,
      albumTrackNumber: song.albumTrackNumber,
      isCloudItem: song.isCloudItem
    }))

    Script.exit(result)
  } catch (error: any) {
    Script.exit({ success: false, message: error.message ?? String(error) })
  }
}

main()
