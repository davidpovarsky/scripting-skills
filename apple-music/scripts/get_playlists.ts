import { Script } from "scripting"

const params = Script.queryParameters
const limit = params.limit ? Number(params.limit) : 20
const sortBy = (params.sortBy as string) ?? "name"
const ascending = String(params.ascending) !== "false"

async function main() {
  try {
    const validSortFields = ["name", "trackCount"]
    const sortField = validSortFields.includes(sortBy) ? sortBy : "name"

    const options: MediaLibrary.PlaylistQueryOptions = {
      limit,
      sortBy: sortField as any,
      ascending
    }

    const playlists = await MediaLibrary.getPlaylists(options)

    const result = playlists.map(playlist => ({
      persistentID: playlist.persistentID,
      name: playlist.name,
      trackCount: playlist.trackCount
    }))

    Script.exit(result)
  } catch (error: any) {
    Script.exit({ success: false, message: error.message ?? String(error) })
  }
}

main()
