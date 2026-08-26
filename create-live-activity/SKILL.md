---
name: create-live-activity
description: Guide for creating Live Activities for Dynamic Island and Lock Screen in the Scripting app.
metadata:
  display_name: "Create Live Activity"
  intent_patterns: "live activity, dynamic island, lock screen activity, real-time activity, activity kit"
  required_tools: "scripting_reference, run_shell_command"
---

# Purpose

Use this skill when the user wants to create a Live Activity that displays real-time, dynamic information on the Lock Screen and/or Dynamic Island.

# Instructions

The `LiveActivity` API enables you to display real-time, dynamic information from your script on the Lock Screen and, where supported, in the Dynamic Island on iOS devices. It provides a structured interface to start, update, and end Live Activities, and observe their state throughout their lifecycle.

The API wraps Apple's ActivityKit and brings it into the Scripting environment with a React-style UI building approach.

## 1. Understanding Live Activities

A Live Activity can appear in the following regions:

- Lock Screen
- Dynamic Island (iPhone 14 Pro and later)
- Banner-style presentation on devices without Dynamic Island

In Scripting, each Live Activity consists of:

1. **contentState** (a JSON-serializable object that updates over time)
2. **UI Builder** (a function that produces TSX UI for each state)

## 2. Live Activity State Types

```ts
type LiveActivityState = "active" | "dismissed" | "ended" | "stale"
```

| State     | Description                                                                                 |
| --------- | ------------------------------------------------------------------------------------------- |
| active    | The Live Activity is visible and can receive content updates.                               |
| stale     | The Live Activity is out of date. The system expects an update.                             |
| ended     | The Live Activity ended but may remain visible for up to four hours or a user-defined time. |
| dismissed | The Live Activity is no longer visible.                                                     |

## 3. Live Activity UI Types

### LiveActivityUIProps

```ts
type LiveActivityUIProps = {
  content: VirtualNode
  compactLeading: VirtualNode
  compactTrailing: VirtualNode
  minimal: VirtualNode
  children: VirtualNode | VirtualNode[]
}
```

| Property        | Region                                                |
| --------------- | ----------------------------------------------------- |
| content         | Lock Screen and non-Dynamic Island devices            |
| compactLeading  | Leading area of compact Dynamic Island                |
| compactTrailing | Trailing area of compact Dynamic Island               |
| minimal         | The smallest pill-style display                       |
| children        | The expanded Dynamic Island layout (multiple regions) |

## 4. Registering a Live Activity UI

Live Activities **must** be registered inside a standalone file such as `live_activity.tsx`.

```tsx
import { LiveActivity, LiveActivityUI, LiveActivityUIBuilder } from "scripting"

export type State = {
  mins: number
}

function ContentView(state: State) {
  return (
    <HStack activityBackgroundTint={{ light: "clear", dark: "clear" }}>
      <Image systemName="waterbottle" foregroundStyle="systemBlue" />
      <Text>{state.mins} minutes left until the next drink</Text>
    </HStack>
  )
}

const builder: LiveActivityUIBuilder<State> = (state) => {
  return (
    <LiveActivityUI
      content={<ContentView {...state} />}
      compactLeading={
        <HStack>
          <Image systemName="clock" />
          <Text>{state.mins}m</Text>
        </HStack>
      }
      compactTrailing={<Image systemName="waterbottle" foregroundStyle="systemBlue" />}
      minimal={<Image systemName="clock" />}>
      <LiveActivityUIExpandedCenter>
        <ContentView {...state} />
      </LiveActivityUIExpandedCenter>
    </LiveActivityUI>
  )
}

export const MyLiveActivity = LiveActivity.register("MyLiveActivity", builder)
```

## 5. Using a Live Activity in Your Script

```tsx
import {
  Button, Text, VStack, Navigation, NavigationStack,
  useMemo, useState, LiveActivityState, BackgroundKeeper,
} from "scripting"

import { MyLiveActivity } from "./live_activity"

function Example() {
  const dismiss = Navigation.useDismiss()
  const [state, setState] = useState<LiveActivityState>()

  const activity = useMemo(() => {
    const instance = MyLiveActivity()
    instance.addUpdateListener((s) => {
      setState(s)
      if (s === "dismissed") {
        BackgroundKeeper.stop()
      }
    })
    return instance
  }, [])

  return (
    <NavigationStack>
      <VStack
        navigationTitle="Live Activity Example"
        navigationBarTitleDisplayMode="inline"
        toolbar={{
          cancellationAction: <Button title="Done" action={dismiss} />,
        }}>
        <Text>Activity State: {state ?? "-"}</Text>
        <Button
          title="Start Live Activity"
          disabled={state != null}
          action={() => {
            let count = 5
            BackgroundKeeper.keepAlive()
            activity.start({ mins: count })
            function tick() {
              setTimeout(() => {
                count -= 1
                if (count === 0) {
                  activity.end({ mins: 0 })
                  BackgroundKeeper.stop()
                } else {
                  activity.update({ mins: count })
                  tick()
                }
              }, 60000)
            }
            tick()
          }}
        />
      </VStack>
    </NavigationStack>
  )
}

async function run() {
  await Navigation.present(<Example />)
  Script.exit()
}

run()
```

## 6. LiveActivity API Reference

### start(contentState, options?)
```ts
start(contentState: T, options?: LiveActivityOptions): Promise<boolean>
```
- **staleDate**: Timestamp(ms) or Date object at which the activity becomes stale
- **relevanceScore**: Determines which Live Activity is prioritized in the Dynamic Island

### update(contentState, options?)
```ts
update(contentState: T, options?: LiveActivityUpdateOptions)
```
Options include `staleDate`, `relevanceScore`, and `alert` (with `title` and `body` for Apple Watch).

### end(contentState, options?)
```ts
end(contentState: T, options?: LiveActivityEndOptions)
```
- **dismissTimeInterval**: Not provided = default system retention (up to 4 hours) <= 0 = remove immediately > 0 = remove after interval

### State Management
```ts
getActivityState(): Promise<LiveActivityState | null>
addUpdateListener(listener)
removeUpdateListener(listener)
```

### Static Methods
```ts
static areActivitiesEnabled(): Promise<boolean>
static getAllActivities(): Promise<LiveActivityDetail[]>
static getAllActivitiesIds(): Promise<string[]>
static getActivityState(activityId: string)
static from(activityId, name)
static endAllActivities(options?)
```

## 7. UI Components for Expanded Layout

| Component                      | Description                       |
| ------------------------------ | --------------------------------- |
| LiveActivityUI                 | Root layout container             |
| LiveActivityUIExpandedLeading  | Leading region of expanded layout |
| LiveActivityUIExpandedTrailing | Trailing region                   |
| LiveActivityUIExpandedCenter   | Center region                     |
| LiveActivityUIExpandedBottom   | Bottom region                     |

## 8. Best Practices

- **contentState must be JSON-serializable** - no functions, Date objects, class instances
- **Live Activity registration must be in a standalone file** (e.g., `live_activity.tsx`)
- **Live Activities survive script termination** - use `BackgroundKeeper.keepAlive()` if the script needs to keep running
- Live Activity cannot access documents and iCloud directories. Save files to `FileManager.appGroupDocumentsDirectory` for file/image access.
- Live Activity can access the Storage data shared with the app.

# Available Tools

When implementing this use case, you can use the following tools:

## scripting_reference (Query API Details)
Use the `scripting_reference` tool with `action: "query_apis"` to look up specific API symbols before generating code. For example, query `LiveActivity`, `LiveActivityUI`, `LiveActivityUIBuilder`, `BackgroundKeeper` to see their full API signatures.

## scripting-ts project (Test and Preview)
After generating the code, run `scripting-ts project "<Script Name>"` (via the `run_shell_command` tool) to run the project entry (`index.tsx`) and test the script.

## scripting-ts (Execute TypeScript)
Use `run_shell_command` with `scripting-ts run <file>` to execute a specific TypeScript file, or `scripting-ts eval "<code>"` to run inline code snippets for quick testing.
