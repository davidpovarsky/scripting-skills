import { Script } from "scripting"

const params = Script.queryParameters
const limit = params.limit ? Number(params.limit) : 20
const sortBy = (params.sortBy as string) ?? "title"
const ascending = String(params.ascending) !== "false"

async function main() {
  try {
    const validSortFields = ["title", "artist", "trackCount"]
    const sortField = validSortFields.includes(sortBy) ? sortBy : "title"

    const options: MediaLibrary.AlbumQueryOptions = {
      limit,
      sortBy: sortField as any,
      ascending
    }

    const albums = await MediaLibrary.getAlbums(options)

    const result = albums.map(album => ({
      persistentID: album.persistentID,
      title: album.title,
      artist: album.artist,
      trackCount: album.trackCount
    }))

    Script.exit(result)
  } catch (error: any) {
    Script.exit({ success: false, message: error.message ?? String(error) })
  }
}

main()
