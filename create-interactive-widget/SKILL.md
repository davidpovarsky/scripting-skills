---
name: create-interactive-widget
description: Guide for creating interactive widgets and Live Activities with Button/Toggle controls using AppIntents in the Scripting app.
metadata:
  display_name: "Create Interactive Widget"
  intent_patterns: "interactive widget, widget button, widget toggle, app intent, widget action, live activity button"
  required_tools: "scripting_reference, run_shell_command"
---

# Purpose

Use this skill when the user wants to create a widget or Live Activity that includes interactive controls like `Button` or `Toggle`. These require AppIntents to handle user interactions. For simple non-interactive widgets, use the `create-widget` skill instead.

# Instructions

## Understanding AppIntents
AppIntents enable interaction in widgets and Live Activities by linking UI components (`Button` and `Toggle`) to executable actions.

### Supported Intent Types
- `AppIntent` - General-purpose action.
- `AudioPlaybackIntent` - Controls audio playback (play/pause).
- `AudioRecordingIntent` - Manages audio recording (iOS 18+ with LiveActivity).
- `LiveActivityIntent` - Modifies LiveActivity states.

## Registering an AppIntent
Define intents inside `app_intents.tsx` using `AppIntentManager.register`.

### Example: Registering AppIntents
```tsx
// app_intents.tsx
import { AppIntentManager, AppIntentProtocol } from "scripting"

// Intent without parameters
const SimpleIntent = AppIntentManager.register({
  name: "SimpleIntent",
  protocol: AppIntentProtocol.AppIntent,
  perform: async () => {
    console.log("Intent executed")
    Widget.reloadAll() // Refresh the widget
  }
})

// Intent with parameters
const ToggleAudioIntent = AppIntentManager.register({
  name: "ToggleAudio",
  protocol: AppIntentProtocol.AudioPlaybackIntent,
  perform: async (audioName: string) => {
    console.log(`Toggling audio: ${audioName}`)
    Widget.reloadAll()
  }
})
```

## Using AppIntents in a Widget or LiveActivity
Once an intent is registered, it can be attached to interactive components in `widget.tsx` or a LiveActivity UI.

### Example: Interactive Widget UI
```typescript
// widget.tsx
import { VStack, Button, Toggle, Widget } from "scripting"
import { SimpleIntent, ToggleAudioIntent } from "./app_intents"
import { model } from "./model"

function WidgetView() {
  return (
    <VStack>
      <Button title="Tap me" intent={SimpleIntent()} />
      <Toggle
        title="Play Audio"
        value={model.isPlaying}
        intent={ToggleAudioIntent("background_music")}
      />
    </VStack>
  )
}

// Present the widget (renders only when added to home screen)
Widget.present(<WidgetView />)

// Use <Preview.Widget> inside the editor for preview
<Preview.Widget>
```

## Key Concepts & Best Practices
- Widgets do not render immediately after calling `Widget.present()`.
- Call `Widget.reloadAll()` inside `perform()` to update the UI dynamically.
- Define all intents inside `app_intents.tsx` for better code organization.
- Use appropriate intent protocols (`AudioPlaybackIntent`, `LiveActivityIntent`, etc.) based on the functionality.

# Available Tools

When implementing this use case, you can use the following tools:

## scripting_reference (Query API Details)
Use the `scripting_reference` tool with `action: "query_apis"` to look up specific API symbols before generating code. For example, query `AppIntentManager`, `AppIntentProtocol`, `Widget`, `Button`, `Toggle` to see their full API signatures and available properties.

## scripting-ts widget (Preview Widget)
After generating the code, run `scripting-ts widget "<Script Name>"` (via the `run_shell_command` tool) to preview the widget. Optionally pass `--family <size>` (e.g. `systemSmall`, `systemMedium`) to preview at a specific size, and add `--screenshot` to capture the rendered widget so you can inspect it.

```
scripting-ts widget "<Script Name>" --family systemSmall --screenshot
```

## scripting-ts (Execute TypeScript)
Use `run_shell_command` with `scripting-ts run <file>` to execute a specific TypeScript file, or `scripting-ts eval "<code>"` to run inline code snippets for quick testing.
