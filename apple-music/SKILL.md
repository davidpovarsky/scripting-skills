---
name: apple-music
description: Control Apple Music playback and browse the media library — search songs, play music, control playback, and manage queues.
runtime: node
metadata:
  display_name: "Apple Music"
  required_tools: "run_shell_command"
---

# Purpose

This skill provides scripts for controlling Apple Music playback and browsing the iOS media library through the Scripting TypeScript runtime. Use it when the user wants to search for songs, play music, control playback (play/pause/skip), or manage the playback queue.

# Available Scripts

All scripts are executed via `run_shell_command` using `scripting-ts run`. Pass parameters as a JSON string with `--queryparameters`.

## get_songs.ts

Search and retrieve songs from the media library.

```
scripting-ts run <skill_dir>/scripts/get_songs.ts --queryparameters '{"artist":"Taylor Swift","limit":10}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `title` | string | No | Filter by song title. |
| `artist` | string | No | Filter by artist name. |
| `albumTitle` | string | No | Filter by album title. |
| `genre` | string | No | Filter by genre. |
| `limit` | number | No | Maximum number of results. Default: 20. |
| `sortBy` | string | No | Sort field: `"title"`, `"artist"`, `"albumTitle"`, `"playbackDuration"`. Default: `"title"`. |
| `ascending` | boolean | No | Sort direction. Default: true. |

**Output:** JSON array of song objects with `persistentID`, `title`, `artist`, `albumTitle`, `playbackDuration`, etc.

## get_albums.ts

Retrieve albums from the media library.

```
scripting-ts run <skill_dir>/scripts/get_albums.ts --queryparameters '{"limit":10}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `limit` | number | No | Maximum number of results. Default: 20. |
| `sortBy` | string | No | Sort field: `"title"`, `"artist"`, `"trackCount"`. Default: `"title"`. |
| `ascending` | boolean | No | Sort direction. Default: true. |

**Output:** JSON array of album objects with `title`, `artist`, `persistentID`, `trackCount`.

## get_playlists.ts

Retrieve playlists from the media library.

```
scripting-ts run <skill_dir>/scripts/get_playlists.ts --queryparameters '{"limit":10}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `limit` | number | No | Maximum number of results. Default: 20. |
| `sortBy` | string | No | Sort field: `"name"`, `"trackCount"`. Default: `"name"`. |
| `ascending` | boolean | No | Sort direction. Default: true. |

**Output:** JSON array of playlist objects with `persistentID`, `name`, `trackCount`.

## get_playlist_songs.ts

Retrieve songs from a specific playlist.

```
scripting-ts run <skill_dir>/scripts/get_playlist_songs.ts --queryparameters '{"playlistId":"12345"}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `playlistId` | string | Yes | The playlist's persistentID. |
| `limit` | number | No | Maximum number of results. |

**Output:** JSON array of song objects in the playlist.

## playback_control.ts

Control music playback (play, pause, stop, skip, seek).

```
scripting-ts run <skill_dir>/scripts/playback_control.ts --queryparameters '{"action":"play"}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `action` | string | Yes | Action to perform: `"play"`, `"pause"`, `"stop"`, `"next"`, `"previous"`, `"seek"`. |
| `seekTime` | number | No | Time in seconds for seek action. |

**Output:** JSON object with `success`, `message`, and current playback state.

## get_now_playing.ts

Get information about the currently playing track.

```
scripting-ts run <skill_dir>/scripts/get_now_playing.ts
```

**Parameters:** None

**Output:** JSON object with current track info (`title`, `artist`, `albumTitle`, `playbackDuration`, `currentTime`, `playbackState`, etc.) or `null` if nothing is playing.

## set_queue.ts

Set the playback queue with specific songs.

```
scripting-ts run <skill_dir>/scripts/set_queue.ts --queryparameters '{"persistentIDs":["id1","id2"],"autoPlay":true}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `persistentIDs` | string[] | Yes | Array of song persistentIDs to queue. |
| `startItemID` | string | No | ID of the song to start playing from. |
| `startTime` | number | No | Start time in seconds. |
| `autoPlay` | boolean | No | Automatically start playback. Default: true. |

**Output:** JSON object with `success` and `message` fields.

## set_playback_mode.ts

Set repeat and shuffle modes.

```
scripting-ts run <skill_dir>/scripts/set_playback_mode.ts --queryparameters '{"repeatMode":"all","shuffleMode":"songs"}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `repeatMode` | string | No | Repeat mode: `"none"`, `"one"`, `"all"`. |
| `shuffleMode` | string | No | Shuffle mode: `"off"`, `"songs"`, `"albums"`. |

**Output:** JSON object with `success`, `message`, and current modes.

# Instructions

1. Determine which script to use based on the user's request.
2. Build the `--queryparameters` JSON from the user's input.
3. Execute via `run_shell_command` with `scripting-ts run <path> --queryparameters '<json>'`.
4. Parse the JSON output and present the result to the user.
5. For playing specific songs, first use `get_songs.ts` to find the persistentIDs, then use `set_queue.ts` to play them.
6. Use `get_now_playing.ts` to check current playback status before giving playback info.
