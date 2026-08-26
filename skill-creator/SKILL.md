---
name: skill-creator
description: Create new agent skills with proper structure, front matter, and scripts.
---

# Purpose

Use this skill when the user asks you to create a new skill package. This document defines the complete specification for skill packages in Scripting.

# Skill Package Structure

A skill is a directory inside `skills/` with the following layout:

```
skills/
└── my-skill/
    ├── SKILL.md          (required)  Skill manifest and instructions
    ├── skill.json        (optional)  Icon and color metadata for the UI
    ├── schema.json       (optional)  JSON Schema for input validation
    └── scripts/          (optional)  Executable script files
        ├── main.ts
        └── helper.py
```

# SKILL.md Format

Every skill **must** have a `SKILL.md` file with YAML front matter between `---` delimiters:

```markdown
---
name: my-skill
description: A short description of what this skill does.
runtime: node
entry: scripts/main.ts
metadata:
  display_name: "My Skill"
  intent_patterns: "generate report, create summary"
  required_tools: "run_shell_command, file_tool"
  input_schema_file: "schema.json"
---

# Purpose
Describe when the agent should use this skill.

# Instructions
Step-by-step instructions for the agent.
```

## Required Front Matter Fields

| Field | Description |
|-------|-------------|
| `name` | Unique identifier. Lowercase, alphanumeric, hyphens only. Used as the skill ID. |
| `description` | Short description shown in the skill list and provided to the LLM. |

## Optional Front Matter Fields

| Field | Description |
|-------|-------------|
| `runtime` | Preferred runtime: `node` (TypeScript via scripting-ts), `python`, `scripting-script` |
| `entry` | Relative path to the main script file, e.g. `scripts/main.ts` |

## Optional Metadata Fields (under `metadata:`)

| Field | Description |
|-------|-------------|
| `display_name` | Human-readable name. Defaults to humanized version of `name`. |
| `intent_patterns` | Comma-separated phrases that hint when this skill should be used. |
| `required_tools` | Comma-separated capability IDs the skill depends on. |
| `input_schema_json` | Inline JSON Schema string for structured input. |
| `input_schema_file` | Path to external JSON Schema file (e.g. `schema.json`). |
| `tool_name` | Legacy assistant tool name for bridge invocation. |

# skill.json Format

Optional file to configure the skill's appearance in the UI:

```json
{
  "icon": "hammer",
  "color": "systemOrange",
  "iconImage": null
}
```

| Field | Description |
|-------|-------------|
| `icon` | SF Symbol name (e.g. `"bell.badge"`, `"waveform"`, `"doc.text"`) |
| `color` | System color name: `systemRed`, `systemBlue`, `systemGreen`, `systemOrange`, `systemPurple`, `systemIndigo`, `systemTeal`, `systemPink`, `systemYellow`, `systemGray` |
| `iconImage` | Optional URL to a remote icon image. Overrides SF Symbol when set. |

# Supported Script Runtimes

## TypeScript / TSX (via scripting-ts)

Execute with `run_shell_command`:

```
scripting-ts run /path/to/scripts/main.ts --queryparameters '{"key":"value"}' --timeout 30
```

- Access parameters via `Script.queryParameters` in the script.
- Has access to the full Scripting API (Notification, Calendar, Reminder, HTTP, FileManager, etc.).
- Use `--check` flag to validate syntax without executing.
- **Return results via `Script.exit(result)`**:
  - Strings / numbers / booleans are printed as-is in the shell output.
  - Objects and arrays are serialised as JSON (so the caller can parse them reliably).
  - To attach **images or documents** so the caller renders them as real media instead of base64 text, use the structured-output convention below.
- `console.log()` output also appears in stdout but is less structured. Prefer `Script.exit()` for the final result.

### Returning images / documents via structured output

When the skill needs to hand back binary content (screenshots, chart PNGs, generated PDFs, etc.), opt into the structured-output convention. The shell tool extracts `content` items into native output parts and shows a short summary text to the LLM.

```typescript
import { Script } from "scripting"

// Imagine you generated a PNG on disk and a small PDF in memory:
const pngBase64 = UIImage.fromFile("/path/to/chart.png")?.toPNGBase64String()
const pdfBase64 = /* your pdf bytes, base64-encoded */ ""

Script.exit({
  structuredOutput: true,            // required marker — without this the
                                     // object is just JSON-stringified
  text: "Generated 1 chart + 1 report.",  // optional summary the LLM sees
  content: [
    { type: "text",     text: "Chart shows weekly active users." },
    { type: "image",    mimeType: "image/png",       base64: pngBase64 ?? "" },
    { type: "document", mimeType: "application/pdf", base64: pdfBase64, name: "weekly-report.pdf" },
  ],
})
```

Accepted content item types:

| `type` | Required fields | Notes |
|---|---|---|
| `text` | `text` | Plain text part. |
| `image` | `mimeType`, `base64` | `mimeType` must be one of `image/png`, `image/jpeg`, `image/webp`, `image/gif`. |
| `document` | `mimeType`, `base64`; `name` optional | `mimeType` must be one of `application/pdf`, `text/plain`, `text/markdown`, `text/csv`, `application/json`. |

Limits:
- Up to **8 parts** per call.
- Up to **10 MB** per individual part (decoded size).
- Up to **20 MB** combined (decoded size).
- Anything over the limit or outside the allowlist is silently dropped and surfaced in the text output as `[rejected] …` so the script keeps running. Keep payloads small (down-sample images, compress with JPEG 0.7–0.8, etc.).

If you omit `structuredOutput: true`, the object is still returned — just stringified as JSON like any other result. No backwards-incompatible behaviour.

## Python (via python3)

Execute with `run_shell_command`:

```
python3 /path/to/scripts/main.py arg1 arg2
```

- Use `sys.argv` for arguments or `json.loads(sys.argv[1])` for structured input.
- Only standard library modules are guaranteed. Use `pip3 install` for additional packages.
- Output is captured from stdout. Use `print()`.

# Instructions for Creating a Skill

1. Determine the skill name (lowercase, hyphens). Example: `weather-report`
2. Create the directory: `skills/weather-report/`
3. Write `SKILL.md` with front matter (`name`, `description`) and instructions for the agent.
4. If the skill needs scripts, create `scripts/` and add `.ts` or `.py` files.
5. Optionally create `skill.json` for a custom icon and color.
6. Optionally create `schema.json` for input validation.

# Example: Creating a "word-count" Skill

## Directory Structure

```
skills/word-count/
├── SKILL.md
├── skill.json
└── scripts/
    └── count.ts
```

## SKILL.md

```markdown
---
name: word-count
description: Count words in a text file.
runtime: node
entry: scripts/count.ts
metadata:
  display_name: "Word Counter"
  required_tools: "run_shell_command"
---

# Purpose
Count the number of words in a given file.

# Instructions
1. Use `run_shell_command` to execute: `scripting-ts run <skill_dir>/scripts/count.ts --queryparameters '{"path":"/path/to/file.txt"}'`
2. The script returns a JSON object with `wordCount` and `lineCount`.
```

## scripts/count.ts

```typescript
import { Script, FileManager } from "scripting"

const params = Script.queryParameters
const path = params.path as string

if (!path) {
  Script.exit({ error: "Missing 'path' parameter" })
} else {
  const content = FileManager.readAsString(path)
  const words = content.split(/\s+/).filter(w => w.length > 0)
  Script.exit({
    wordCount: words.length,
    lineCount: content.split("\n").length
  })
}
```

## skill.json

```json
{
  "icon": "text.word.spacing",
  "color": "systemBlue"
}
```
