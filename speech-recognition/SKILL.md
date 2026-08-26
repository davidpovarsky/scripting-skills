---
name: speech-recognition
description: Perform speech recognition — start live recognition from microphone, recognize audio files, get supported locales, and stop recognition.
runtime: node
metadata:
  display_name: "Speech Recognition"
  required_tools: "run_shell_command"
---

# Purpose

This skill provides scripts for performing speech-to-text recognition through the Scripting TypeScript runtime. Use it when the user wants to transcribe speech from microphone input or audio files.

# Available Scripts

All scripts are executed via `run_shell_command` using `scripting-ts run`. Pass parameters as a JSON string with `--queryparameters`.

## get_supported_locales.ts

Get the list of locales supported by the speech recognizer.

```
scripting-ts run <skill_dir>/scripts/get_supported_locales.ts
```

**Parameters:** None

**Output:** JSON array of locale strings (e.g., `["en-US", "zh-CN", ...]`).

## recognize_microphone.ts

Start real-time speech recognition from the device microphone. The script will run until the user stops speaking or a timeout is reached.

```
scripting-ts run <skill_dir>/scripts/recognize_microphone.ts --queryparameters '{"locale":"zh-CN","timeout":10}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `locale` | string | No | Locale for recognition (e.g., `"en-US"`, `"zh-CN"`). Uses device default if omitted. |
| `timeout` | number | No | Max seconds to listen. Default: 30. |
| `addsPunctuation` | boolean | No | Add punctuation to results. Default: true. |
| `taskHint` | string | No | Task type: `"dictation"`, `"search"`, `"confirmation"`, `"unspecified"`. Default: `"dictation"`. |

**Output:** JSON object with `success`, `text` (final transcription), and `isFinal` fields.

## recognize_file.ts

Recognize speech from an audio file.

```
scripting-ts run <skill_dir>/scripts/recognize_file.ts --queryparameters '{"filePath":"/path/to/audio.m4a","locale":"en-US"}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `filePath` | string | Yes | Path to the audio file. |
| `locale` | string | No | Locale for recognition. Uses device default if omitted. |
| `addsPunctuation` | boolean | No | Add punctuation to results. Default: true. |
| `taskHint` | string | No | Task type: `"dictation"`, `"search"`, `"confirmation"`, `"unspecified"`. Default: `"dictation"`. |

**Output:** JSON object with `success`, `text` (final transcription), and `isFinal` fields.

## stop_recognition.ts

Stop any running speech recognition session.

```
scripting-ts run <skill_dir>/scripts/stop_recognition.ts
```

**Parameters:** None

**Output:** JSON object with `success` and `message` fields.

# Instructions

1. Determine which script to use based on the user's request.
2. Build the `--queryparameters` JSON from the user's input.
3. Execute via `run_shell_command` with `scripting-ts run <path> --queryparameters '<json>'`.
4. Parse the JSON output and present the transcription result to the user.
5. For microphone recognition, inform the user that they should speak clearly and the recognition will auto-stop on silence or timeout.
