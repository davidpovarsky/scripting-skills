---
name: native-api-coding-guide
description: Guide for writing TypeScript code that calls iOS native APIs (Device, Notification, Calendar, Location, etc.) in the Scripting app.
metadata:
  display_name: "Native API Coding Guide"
  intent_patterns: "native api, ios api, device info, calendar api, location api, notification api, speech api, clipboard, photos, reminder, storage"
  required_tools: "scripting_reference, run_shell_command"
---

# Purpose

Use this skill when the user wants to write TypeScript code that calls iOS native APIs provided by the Scripting app (e.g., Device, Notification, Calendar, Location, Speech, etc.). This skill provides the coding patterns and API catalog for native capability access.

# Instructions

## Import Rules
- If an API's module is `scripting`, import the API using:
  ```ts
  import { APIName } from "scripting"
  ```
- If an API's module is `global`, the API is globally available and does not require an import.

## List of iOS Native Capabilities

| API | Module | Description |
|-----|--------|-------------|
| Device | `scripting` | Retrieves device information and manages device capabilities (screen orientation, battery status). |
| Notification | `scripting` | Manages local notifications. |
| Safari | `global` | Opens URLs within the app or via the default browser. |
| Speech | `global` | Converts text to speech. |
| SpeechRecognition | `global` | Manages the speech recognition process. |
| Calendar | `global` | Interacts with iOS calendars. |
| CalendarEvent | `global` | Creates and manages calendar events. |
| Reminder | `global` | Creates, edits, and manages reminders. |
| Location | `global` | Retrieves the current device location. |
| Storage | `global` | Provides persistent storage for simple data. |
| Photos | `global` | Manages access and changes to the user's photo library. |
| DocumentPicker | `global` | Allows picking files from the Files app. |
| Clipboard | `global` | Reads and sets clipboard content. |

## Code Structure Requirements
- Include all necessary import statements.
- Organize your code logic using functions or asynchronous functions (using `async/await`).
- Use the `Script.exit()` method to return results or error messages.
- Provide clear comments in the code.

## Code Format Reference

```ts
import { Notification, Script } from "scripting"

async function run() {
  try {
    const list = await Notification.getAllPendings()
    Script.exit(`There are ${list.length} pending notifications.`)
  } catch (error) {
    Script.exit(`An error occurred: ${error}`)
  }
}

run()
```

## Important
Before using any API in your code, you **must** use the `scripting_reference` tool with `action: "query_apis"` to query the API documentation to ensure that the API's methods, parameters, and types are used correctly.

# Available Tools

When implementing this use case, you can use the following tools:

## scripting_reference (Query API Details)
Use the `scripting_reference` tool with `action: "query_apis"` to look up specific API symbols before generating code. For example, query `Device`, `Notification`, `Calendar`, `Location`, `Speech` etc. to see their full API signatures, methods, and parameters. **Always query APIs before generating code to ensure correctness.**

## scripting-ts project / run (Test and Preview)
After generating the code, run `scripting-ts project "<Script Name>"` (via the `run_shell_command` tool) to run the project entry (`index.tsx`) and see the result. To run a specific file directly, use `scripting-ts run <file.tsx>`.

## scripting-ts (Execute TypeScript)
Use `run_shell_command` with `scripting-ts run <file>` to execute a specific TypeScript file, or `scripting-ts eval "<code>"` to run inline code snippets for quick testing.
