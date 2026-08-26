---
name: create-ios-page
description: Guide for creating a standard iOS-style page using SwiftUI-like components in the Scripting app.
metadata:
  display_name: "Create iOS Page"
  intent_patterns: "create page, create ios page, build a page, standard page, navigation page, list page"
  required_tools: "scripting_reference, run_shell_command"
---

# Purpose

Use this skill when the user wants to create a standard iOS-style page in the Scripting app using SwiftUI-like components. This includes pages with navigation bars, lists, buttons, and other standard iOS UI patterns.

# Instructions

Create a standard iOS-style page for the Scripting app using SwiftUI-like components, follow these requirements:

## Basic Structure
- Use `NavigationStack` as the root container to manage navigation.
- Use `List` for structured content and automatic styling.
- Set a **navigation title** using `navigationTitle`.
- Use `toolbar` to add actions, such as a **Close** button that calls `Navigation.useDismiss()`.
- Present the page using:
  ```typescript
  await Navigation.present(<View />)
  ```
- After the page is dismissed, **call `Script.exit()`** to prevent memory leaks.

## Example
```tsx
import { Script, Navigation, NavigationStack, List, Button, Text } from "scripting"

function View() {
  // Access the dismiss function
  const dismiss = Navigation.useDismiss()

  return (
    <NavigationStack>
      <List
        navigationTitle="Page title"
        navigationBarTitleDisplayMode="inline"
        toolbar={{
          cancellationAction: <Button title="Close" action={dismiss} />
        }}
      >
        <Text>Hello world!</Text>
      </List>
    </NavigationStack>
  )
}

async function run() {
  // Present the page
  await Navigation.present(<View />)
  // Exit script to avoid memory leaks
  Script.exit()
}

run()
```

## Important API References

- `NavigationStack`: The root container for managing iOS-style navigation.
- `List`: A structured list-style container for displaying content.
- `navigationTitle`: Sets the navigation bar title.
- `toolbar`: Defines toolbar actions, such as a Close button.
- `Navigation.useDismiss()`: A hook to get a function for dismissing the page.
- `Navigation.present(<View />)`: Presents the view as a full-screen page.
- `Script.exit()`: Ensures the script exits cleanly after the view is dismissed.

## Notes
- Before creating a page, ensure a script project is provided.
- Always call `Script.exit()` after the page is dismissed to avoid memory leaks.

# Available Tools

When implementing this use case, you can use the following tools:

## scripting_reference (Query API Details)
Use the `scripting_reference` tool with `action: "query_apis"` to look up specific API symbols before generating code. For example, query `NavigationStack`, `List`, `Navigation`, `Script` to see their full API signatures and available properties.

## scripting-ts project / preview_ui (Test and Preview)
After generating the code, run `scripting-ts project "<Script Name>"` (via the `run_shell_command` tool) to run the project entry (`index.tsx`) and show the result to the user. If a page file default-exports a View, you can render it directly with `scripting-ts preview_ui <file.tsx>`; add `--screenshot` to capture the rendered UI so you can inspect it.

```
scripting-ts project "<Script Name>"
scripting-ts preview_ui <file.tsx> --screenshot
```

## scripting-ts (Execute TypeScript)
Use `run_shell_command` with `scripting-ts run <file>` to execute a specific TypeScript file, or `scripting-ts eval "<code>"` to run inline code snippets for quick testing.
