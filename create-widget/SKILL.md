---
name: create-widget
description: Guide for creating a simple non-interactive widget for the iOS home screen in the Scripting app.
metadata:
  display_name: "Create Widget"
  intent_patterns: "create widget, build widget, simple widget, home screen widget, widget ui"
  required_tools: "scripting_reference, run_shell_command"
---

# Purpose

Use this skill when the user wants to create a simple (non-interactive) widget for the iOS home screen. For widgets with Button or Toggle controls, use the `create-interactive-widget` skill instead.

# Instructions

## Basic Structure
- The widget code must be written in the `widget.tsx` file of the script project.
- Define the widget UI using a function component.
- Use SwiftUI-inspired components such as `VStack`, `HStack`, and `Text`.
- **Do not** use state management (`useState`, `useEffect`, etc.) in widgets.
- Present the widget with:
  ```tsx
  Widget.present(<WidgetView />)
  ```
- You can call `Widget.present` after asynchronously obtaining data if needed:
  ```tsx
  fetch("https://example.com/data")
    .then(res => res.json())
    .then(data => Widget.present(<WidgetView data={data} />))
  ```
- **Important:** Calling `Widget.present()` **does not immediately render the widget**. The widget will only be displayed when added to the iOS home screen.

## Widget UI Example
```tsx
// widget.tsx
import { VStack, Text, Widget } from 'scripting'

function MyWidgetView() {
  return (
    <VStack>
      <Text>Hello world</Text>
    </VStack>
  )
}

// Presenting the widget (only renders when added to home screen)
Widget.present(<MyWidgetView />)
```

## Important API References
- `Widget.displaySize`: Returns the widget's display size, useful for adjusting layouts dynamically.
- `Widget.family`: Indicates the widget family (`systemSmall`, `systemMedium`, `systemLarge`, etc.) to tailor UI accordingly.
- `Widget.parameter`: Retrieves a user-configurable parameter from the iOS widget configuration panel, allowing customization.

## Notes
- Before creating a widget UI, ensure a script project is provided.
- If you want to add Button or Toggle in a widget, you must use the `create-interactive-widget` skill instead.

# Available Tools

When implementing this use case, you can use the following tools:

## scripting_reference (Query API Details)
Use the `scripting_reference` tool with `action: "query_apis"` to look up specific API symbols before generating code. For example, query `Widget`, `VStack`, `HStack`, `Text` to see their full API signatures and available properties.

## scripting-ts widget (Preview Widget)
After generating the code, run `scripting-ts widget "<Script Name>"` (via the `run_shell_command` tool) to preview the widget. Optionally pass `--family <size>` (e.g. `systemSmall`, `systemMedium`) to preview at a specific size, and add `--screenshot` to capture the rendered widget so you can inspect it.

```
scripting-ts widget "<Script Name>" --family systemSmall --screenshot
```

## scripting-ts (Execute TypeScript)
Use `run_shell_command` with `scripting-ts run <file>` to execute a specific TypeScript file, or `scripting-ts eval "<code>"` to run inline code snippets for quick testing.
