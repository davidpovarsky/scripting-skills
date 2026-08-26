---
name: ios-photos
description: Manage iOS Photos — pick photos/videos, capture new media, save images/videos to library, and get latest photos.
runtime: node
metadata:
  display_name: "iOS Photos"
  required_tools: "run_shell_command"
---

# Purpose

This skill provides scripts for managing iOS Photos through the Scripting TypeScript runtime. Use it when the user wants to pick photos/videos from library, capture new photos/videos, save media to Photos app, or retrieve latest photos.

# Available Scripts

All scripts are executed via `run_shell_command` using `scripting-ts run`. Pass parameters as a JSON string with `--queryparameters`.

## pick_photos.ts

Pick photos or videos from the photo library.

```
scripting-ts run <skill_dir>/scripts/pick_photos.ts --queryparameters '{"limit":5,"filter":"images"}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `limit` | number | No | Maximum number of items to pick. Default: 1. |
| `filter` | string | No | Filter type: `"images"`, `"videos"`, `"livePhotos"`, `"screenshots"`, etc. Default: no filter (all media). |
| `mode` | `"default"` \| `"compact"` | No | Picker layout mode. Default: `"default"`. |
| `output_format` | `"path"` \| `"base64"` \| `"tool_output"` | No | Output format for images. `"path"` (default) returns only local file paths; `"base64"` inlines base64 in the JSON payload; `"tool_output"` attaches each picked image as a real image part on the shell tool result (preferred when the caller needs to see the images). |

**Output:** JSON array of picked items with `type`, `path` (or `base64`), and metadata. When `output_format` is `"tool_output"`, the images are attached as structured output parts and the JSON carries only a short summary.

## capture_photo.ts

Capture a new photo using the camera.

```
scripting-ts run <skill_dir>/scripts/capture_photo.ts --queryparameters '{"camera":"front","flash":"auto","allowsEditing":true}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `camera` | `"rear"` \| `"front"` | No | Camera to use. Default: `"rear"`. |
| `flash` | `"auto"` \| `"on"` \| `"off"` | No | Flash mode. Default: `"auto"`. |
| `allowsEditing` | boolean | No | Allow editing after capture. Default: false. |
| `output_format` | `"path"` \| `"base64"` | No | Output format. Default: `"path"`. |

**Output:** JSON object with captured photo information.

## capture_video.ts

Capture a new video using the camera.

```
scripting-ts run <skill_dir>/scripts/capture_video.ts --queryparameters '{"maxDuration":30,"quality":"high"}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `camera` | `"rear"` \| `"front"` | No | Camera to use. Default: `"rear"`. |
| `flash` | `"auto"` \| `"on"` \| `"off"` | No | Flash mode. Default: `"auto"`. |
| `maxDuration` | number | No | Maximum duration in seconds. Default: 600. |
| `quality` | string | No | Video quality: `"low"`, `"medium"`, `"high"`, etc. Default: `"medium"`. |
| `allowsEditing` | boolean | No | Allow editing after capture. Default: false. |

**Output:** JSON object with captured video path and metadata.

## save_photo.ts

Save an image to the Photos app.

```
scripting-ts run <skill_dir>/scripts/save_photo.ts --queryparameters '{"path":"/path/to/image.jpg","fileName":"MyPhoto"}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes* | Path to the image file. |
| `base64` | string | Yes* | Base64-encoded image data (alternative to `path`). |
| `fileName` | string | No | Optional file name. |
| `shouldMove` | boolean | No | Move file instead of copy. Default: false. |

**Output:** JSON object with `success` and `message` fields.

## save_video.ts

Save a video to the Photos app.

```
scripting-ts run <skill_dir>/scripts/save_video.ts --queryparameters '{"path":"/path/to/video.mp4","fileName":"MyVideo"}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | Path to the video file. |
| `fileName` | string | No | Optional file name. |
| `shouldMove` | boolean | No | Move file instead of copy. Default: false. |

**Output:** JSON object with `success` and `message` fields.

## get_latest_photos.ts

Get the latest photos from the photo library.

```
scripting-ts run <skill_dir>/scripts/get_latest_photos.ts --queryparameters '{"count":10,"output_format":"base64"}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `count` | number | No | Number of photos to retrieve. Default: 5. |
| `output_format` | `"path"` \| `"base64"` | No | Output format. Default: `"path"`. |

**Output:** JSON array of photo objects with paths or base64 data.

# Instructions

1. Determine which script to use based on the user's request.
2. Build the `--queryparameters` JSON from the user's input.
3. Execute via `run_shell_command` with `scripting-ts run <path> --queryparameters '<json>'`.
4. Parse the JSON output and present the result to the user.
5. For capture operations, confirm the settings with the user before executing if not explicitly specified.
