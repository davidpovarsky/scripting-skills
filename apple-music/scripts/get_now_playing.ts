import { Script } from "scripting"

async function main() {
  try {
    const nowPlaying = SystemMusicPlayer.getNowPlayingItem()
    const playbackState = SystemMusicPlayer.getPlaybackState()
    const currentTime = SystemMusicPlayer.getCurrentPlaybackTime()
    const playbackRate = SystemMusicPlayer.getCurrentPlaybackRate()
    const repeatMode = SystemMusicPlayer.getRepeatMode()
    const shuffleMode = SystemMusicPlayer.getShuffleMode()
    const queueIndex = SystemMusicPlayer.indexOfNowPlayingItem()

    if (!nowPlaying) {
      Script.exit({
        isPlaying: false,
        playbackState,
        nowPlaying: null,
        message: "Nothing is currently playing."
      })
      return
    }

    Script.exit({
      isPlaying: playbackState === "playing",
      playbackState,
      nowPlaying: {
        persistentID: nowPlaying.persistentID,
        title: nowPlaying.title,
        artist: nowPlaying.artist,
        albumTitle: nowPlaying.albumTitle,
        albumArtist: nowPlaying.albumArtist,
        genre: nowPlaying.genre,
        playbackDuration: nowPlaying.playbackDuration
      },
      currentTime,
      playbackRate,
      repeatMode,
      shuffleMode,
      queueIndex
    })
  } catch (error: any) {
    Script.exit({ success: false, message: error.message ?? String(error) })
  }
}

main()
