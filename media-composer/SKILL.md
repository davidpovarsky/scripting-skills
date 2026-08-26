---
name: media-composer
description: Compose videos from images and video clips with background audio, fade effects, and custom export settings.
runtime: node
metadata:
  display_name: "Media Composer"
  required_tools: "run_shell_command"
---

# Purpose

This skill provides scripts for composing videos from images and video clips using the MediaComposer API. Use it when the user wants to create slideshow videos from images, merge video clips, add background music, or apply fade effects.

# Available Scripts

All scripts are executed via `run_shell_command` using `scripting-ts run`. Pass parameters as a JSON string with `--queryparameters`.

## compose_video.ts

Compose a video from images and/or video clips with optional background audio.

```
scripting-ts run <skill_dir>/scripts/compose_video.ts --queryparameters '<json>'
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `exportPath` | string | Yes | Output video file path (e.g. `/path/to/output.mp4`) |
| `items` | array | Yes | Array of video/image items (see below) |
| `audio` | object | No | Background audio configuration (see below) |
| `renderWidth` | number | No | Output width in pixels. Default: 1080 |
| `renderHeight` | number | No | Output height in pixels. Default: 1920 |
| `frameRate` | number | No | Frame rate. Default: 30 |
| `preset` | string | No | Export preset. Default: `HighestQuality` |
| `scaleMode` | `"fit"` \| `"crop"` | No | Video scale mode. Default: `fit` |
| `globalFadeIn` | number | No | Global fade in seconds for all clips |
| `globalFadeOut` | number | No | Global fade out seconds for all clips |
| `overwrite` | boolean | No | Overwrite existing file. Default: true |

**Item Object (image):**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `type` | `"image"` | Yes | Item type |
| `path` | string | Yes | Image file path |
| `duration` | number | Yes | Duration in seconds |
| `contentMode` | `"fit"` \| `"crop"` | No | Image content mode. Default: `fit` |
| `fadeIn` | number | No | Fade in seconds |
| `fadeOut` | number | No | Fade out seconds |

**Item Object (video):**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `type` | `"video"` | Yes | Item type |
| `path` | string | Yes | Video file path |
| `keepAudio` | boolean | No | Keep original audio. Default: false |
| `startTime` | number | No | Source start time in seconds |
| `duration` | number | No | Source duration in seconds |
| `fadeIn` | number | No | Fade in seconds |
| `fadeOut` | number | No | Fade out seconds |

**Audio Object:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | Audio file path |
| `volume` | number | No | Volume (0-1). Default: 1 |
| `loop` | boolean | No | Loop to fit video duration. Default: false |
| `fadeIn` | number | No | Fade in seconds |
| `fadeOut` | number | No | Fade out seconds |
| `startTime` | number | No | Source start time in seconds |
| `duration` | number | No | Source duration in seconds |

**Output:** JSON object with `success`, `exportPath`, `duration`, and `message` fields.

**Example - Create slideshow from images:**

```json
{
  "exportPath": "/path/to/slideshow.mp4",
  "items": [
    { "type": "image", "path": "/path/to/img1.jpg", "duration": 3 },
    { "type": "image", "path": "/path/to/img2.jpg", "duration": 3 },
    { "type": "image", "path": "/path/to/img3.jpg", "duration": 3 }
  ],
  "audio": {
    "path": "/path/to/music.mp3",
    "volume": 0.8,
    "loop": true
  },
  "globalFadeIn": 0.5,
  "globalFadeOut": 0.5
}
```

**Example - Merge video clips:**

```json
{
  "exportPath": "/path/to/merged.mp4",
  "items": [
    { "type": "video", "path": "/path/to/clip1.mp4", "keepAudio": true },
    { "type": "video", "path": "/path/to/clip2.mp4", "startTime": 5, "duration": 10 }
  ],
  "renderWidth": 1920,
  "renderHeight": 1080
}
```

# Instructions

1. Determine what the user wants to create (slideshow, merged video, etc.).
2. Collect all media file paths from the user.
3. Build the `--queryparameters` JSON with items, audio, and export settings.
4. Execute via `run_shell_command` with `scripting-ts run <path> --queryparameters '<json>'`.
5. Parse the JSON output and present the result (including output path and duration).
6. For large compositions, warn the user that export may take time.
