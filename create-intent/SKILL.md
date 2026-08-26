---
name: create-intent
description: Guide for creating intent scripts for Shortcuts app and Share Sheet integration in the Scripting app.
metadata:
  display_name: "Create Intent"
  intent_patterns: "create intent, shortcuts integration, share sheet, intent script, siri shortcut"
  required_tools: "scripting_reference, run_shell_command"
---

# Purpose

Use this skill when the user wants to create an intent script (`intent.tsx`) that can be triggered from the iOS Shortcuts app or Share Sheet.

# Instructions

## 1. Setting Up an Intent Script
- Create an `intent.tsx` file in a script project.
- Configure supported input types in **Intent Settings** (texts, images, file URLs, or URLs).

## 2. Accessing Input Data
Use the `Intent` API to retrieve input parameters based on their type:
- `Intent.shortcutParameter` - The primary input from Shortcuts (text, URL, file, etc.).
- `Intent.textsParameter` - An array of text inputs.
- `Intent.imagesParameter` - An array of images.
- `Intent.fileURLsParameter` - An array of file URLs.
- `Intent.urlsParameter` - An array of URLs.

## 3. Returning a Result
Use `Script.exit(value)` to return results to the Shortcuts app or Share Sheet. The result can be:
- Text: `Script.exit(Intent.text("Result text"))`
- URL: `Script.exit(Intent.url("https://example.com"))`
- JSON: `Script.exit(Intent.json({ key: "value" }))`
- File: `Script.exit(Intent.file("/path/to/file"))`

### Example: Returning Text
```tsx
import { Script, Intent } from "scripting"

// Return a processed text result
const inputText = Intent.shortcutParameter?.type === "text" ? Intent.shortcutParameter.value : "No input"
Script.exit(Intent.text(`Processed: ${inputText}`))
```

## 4. Displaying a UI Before Returning a Result
To show a UI before exiting, present a SwiftUI-like component using `Navigation.present()`.
After UI dismissal, call `Script.exit()` to return a result and avoid memory leaks.

### Example: Displaying a UI and Returning a Result
```tsx
import { Intent, Script, Navigation, VStack, Text } from "scripting"

function MyIntentView() {
  return (
    <VStack>
      <Text>{Intent.textsParameter?.[0] ?? "No input"}</Text>
    </VStack>
  )
}

async function run() {
  await Navigation.present({ element: <MyIntentView /> })
  Script.exit(Intent.text("User viewed the intent UI"))
}

run()
```

## 5. Important Notes
- **Always call `Script.exit()`** after executing logic to return a result.
- **Use `Navigation.present()`** only if a UI is needed before returning a result.
- **Check `Intent.shortcutParameter.type`** before accessing its value.
- **Use `Intent.fileURLsParameter`** carefully for large files - prefer "Run Script in App" to avoid memory issues.
- The `intent.tsx` script is **not testable** through tools - the user must test it manually via Shortcuts or Share Sheet.

# Available Tools

When implementing this use case, you can use the following tools:

## scripting_reference (Query API Details)
Use the `scripting_reference` tool with `action: "query_apis"` to look up specific API symbols before generating code. For example, query `Intent`, `Script`, `Navigation` to see their full API signatures and available properties.

## scripting-ts run_intent (Test Intent)
Run `scripting-ts run_intent "<Script Name>"` (via the `run_shell_command` tool) to test the intent script (`intent.tsx`) with mock parameters. Pass `--params '<json>'` to simulate input.

```
scripting-ts run_intent "<Script Name>" --params '{"key":"value"}'
```

## scripting-ts (Execute TypeScript)
Use `run_shell_command` with `scripting-ts run <file>` to execute a specific TypeScript file, or `scripting-ts eval "<code>"` to run inline code snippets for quick testing.
