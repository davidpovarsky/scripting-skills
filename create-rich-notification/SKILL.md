---
name: create-rich-notification
description: Guide for creating rich notifications with custom UI in the Scripting app.
metadata:
  display_name: "Create Rich Notification"
  intent_patterns: "rich notification, custom notification, notification ui, notification action, notification button"
  required_tools: "scripting_reference, run_shell_command"
---

# Purpose

Use this skill when the user wants to create a notification with a custom UI that is displayed when the user long-presses or expands the notification.

# Instructions

## 1. Scheduling a Notification with Rich UI
- Use `Notification.schedule()` to create a local notification.
- Set `customUI: true` to enable rich notification rendering in `notification.tsx`.
- Include interactive actions (`NotificationAction[]`) to allow users to respond directly from the notification.

### Example: Scheduling a Notification
```tsx
import { Notification, Script } from "scripting"

Notification.schedule({
  title: "Hydration Reminder",
  body: "Time to drink water!",
  customUI: true, // Enables rich notification UI
  triggerTime: Date.now() + 60000, // Delivers in 1 minute
  actions: [
    {
      title: "I Drank",
      url: Script.createRunURLScheme("Hydration Reminder", { drank: true })
    },
    {
      title: "Ignore",
      url: Script.createRunURLScheme("Hydration Reminder", { drank: false }),
      destructive: true
    }
  ]
})
```

## 2. Implementing Rich Notification UI (`notification.tsx`)
Define a function component to display when the user long-presses or expands the notification.

### Example: Custom UI in `notification.tsx`
```tsx
import { Notification, VStack, Text, Button } from "scripting"

function HydrationNotification() {
  return (
    <VStack>
      <Text>Remember to stay hydrated!</Text>
      <Button title="I Drank" action={() => console.log("User drank water")} />
      <Button title="Ignore" action={() => console.log("User ignored the reminder")} />
    </VStack>
  )
}

// Present the rich notification UI
Notification.present(<HydrationNotification />)
```

## 3. Accessing Notification Data
Use `Notification.current` to retrieve the notification's metadata (title, body, user info). This allows dynamic UI updates based on the notification content.

### Example: Using `Notification.current` in `notification.tsx`
```tsx
const notificationData = Notification.current
if (notificationData) {
  console.log(`Notification received: ${notificationData.title}`)
}
```

## 4. Best Practices
- **Always set `customUI: true`** when scheduling a notification to enable rich UI.
- **Use `Notification.present(<CustomView />)`** inside `notification.tsx` to render the UI.
- **Ensure buttons trigger meaningful actions**, such as updating logs or interacting with external scripts.
- **Use `Script.createRunURLScheme()`** to allow direct responses from notification actions.

# Available Tools

When implementing this use case, you can use the following tools:

## scripting_reference (Query API Details)
Use the `scripting_reference` tool with `action: "query_apis"` to look up specific API symbols before generating code. For example, query `Notification`, `Script.createRunURLScheme` to see their full API signatures and available properties.

## scripting-ts project (Test and Preview)
After generating the code, run `scripting-ts project "<Script Name>"` (via the `run_shell_command` tool) to run the project entry (`index.tsx`) and test the scheduling script.

## scripting-ts (Execute TypeScript)
Use `run_shell_command` with `scripting-ts run <file>` to execute a specific TypeScript file, or `scripting-ts eval "<code>"` to run inline code snippets for quick testing.
