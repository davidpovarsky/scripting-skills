---
name: ios-speech
description: Text-to-speech synthesis — speak text aloud, list available voices, synthesize to audio files, and control playback (pause/resume/stop).
runtime: node
metadata:
  display_name: "iOS Speech"
  required_tools: "run_shell_command"
---

# Purpose

This skill provides scripts for iOS text-to-speech (TTS) synthesis through the Scripting TypeScript runtime. Use it when the user wants to speak text aloud, list available voices, synthesize speech to audio files, or control speech playback.

# Available Scripts

All scripts are executed via `run_shell_command` using `scripting-ts run`. Pass parameters as a JSON string with `--queryparameters`.

## speak.ts

Speak text aloud using the speech synthesizer.

```
scripting-ts run <skill_dir>/scripts/speak.ts --queryparameters '{"text":"Hello, world!"}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `text` | string | Yes | Text to speak. |
| `rate` | number | No | Speech rate (0.0-1.0). Default: system default. |
| `pitch` | number | No | Voice pitch (0.5-2.0). Default: 1.0. |
| `volume` | number | No | Volume (0.0-1.0). Default: 1.0. |
| `voice_identifier` | string | No | Specific voice identifier. |
| `voice_language` | string | No | Language code (e.g., "en-US", "zh-CN"). |
| `is_markdown` | boolean | No | Treat text as markdown. Default: false. |

**Output:** JSON object with `success` and `message` fields.

## get_voices.ts

List available speech synthesis voices.

```
scripting-ts run <skill_dir>/scripts/get_voices.ts --queryparameters '{}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `language` | string | No | Filter by language (partial match, e.g., "en", "zh"). |
| `quality` | `"default"` \| `"premium"` \| `"enhanced"` | No | Filter by voice quality. |
| `gender` | `"male"` \| `"female"` \| `"unspecified"` | No | Filter by gender. |

**Output:** JSON object with `success`, `currentLanguage`, `count`, and `voices` array. Each voice has `identifier`, `name`, `language`, `quality`, and `gender`.

## synthesize_to_file.ts

Synthesize speech to an audio file (CAF format).

```
scripting-ts run <skill_dir>/scripts/synthesize_to_file.ts --queryparameters '{"text":"Hello, world!","filename":"greeting.caf"}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `text` | string | Yes | Text to synthesize. |
| `filename` | string | No | Output filename. Default: `speech_<timestamp>.caf`. |
| `rate` | number | No | Speech rate (0.0-1.0). |
| `pitch` | number | No | Voice pitch (0.5-2.0). |
| `volume` | number | No | Volume (0.0-1.0). |
| `voice_identifier` | string | No | Specific voice identifier. |
| `voice_language` | string | No | Language code (e.g., "en-US", "zh-CN"). |
| `is_markdown` | boolean | No | Treat text as markdown. Default: false. |

**Output:** JSON object with `success`, `message`, and `filePath` fields.

## control.ts

Control speech playback (pause, resume, stop, or get status).

```
scripting-ts run <skill_dir>/scripts/control.ts --queryparameters '{"action":"pause"}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `action` | `"pause"` \| `"resume"` \| `"stop"` \| `"status"` | Yes | Control action. |
| `boundary` | `"immediate"` \| `"word"` | No | When to pause/stop. Default: `"immediate"`. |

**Output:** JSON object with `success` and `message` fields. For `status` action, also includes `isSpeaking` and `isPaused` booleans.

# Notes

- The `speak.ts` and `synthesize_to_file.ts` scripts automatically initialize `SharedAudioSession` with `playback` category and `voicePrompt` mode before synthesis.
- The `control.ts` script does not initialize audio session as it only controls existing playback.

# Instructions

1. Determine which script to use based on the user's request.
2. Build the `--queryparameters` JSON from the user's input.
3. Execute via `run_shell_command` with `scripting-ts run <path> --queryparameters '<json>'`.
4. Parse the JSON output and present the result to the user.
5. For voice selection, use `get_voices.ts` first to find available voices, then use the `voice_identifier` or `voice_language` parameter in `speak.ts`.

# Examples

**Speak text in Chinese:**
```
scripting-ts run <skill_dir>/scripts/speak.ts --queryparameters '{"text":"你好世界","voice_language":"zh-CN"}'
```

**List English voices:**
```
scripting-ts run <skill_dir>/scripts/get_voices.ts --queryparameters '{"language":"en"}'
```

**Save speech to file:**
```
scripting-ts run <skill_dir>/scripts/synthesize_to_file.ts --queryparameters '{"text":"This will be saved as audio","filename":"my_audio.caf"}'
```

**Stop current speech:**
```
scripting-ts run <skill_dir>/scripts/control.ts --queryparameters '{"action":"stop"}'
```
