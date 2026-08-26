---
name: scripting-script-creator
description: Guide for scaffolding a new Scripting app script — project layout, script.json, the index.tsx run entry point and its exit / minimize-resume lifecycle, and the capability files that unlock widgets, Live Activities, notifications, keyboards, intents, Spotlight and translation UI.
metadata:
  display_name: "Create Scripting Script"
  intent_patterns: "create script, new script, scaffold script, script.json, index.tsx, build a scripting app script, script project structure, add a capability to a script"
  required_tools: "scripting_reference, run_shell_command, file_tool"
---

# Purpose

Use this skill when the user wants to create a brand-new script in the Scripting app from scratch, or needs to understand the script project skeleton before adding a feature. This skill is the entry point: it teaches the project structure, then routes each capability (widget, Live Activity, notification, keyboard, intent, Spotlight, translation UI) to the dedicated skill or API reference for that feature.

# Instructions

## Project Layout

A script is a **directory** placed under the scripts directory (`<scripts-dir>/`), named after the script, e.g. `My Script/`.

A script directory has two **required** files:

```
My Script/
├── script.json     (required)  Script descriptor / metadata
├── index.tsx       (required)  Run entry point (tapped in the app)
└── ...             (optional)  Capability files: widget.tsx, intent.tsx, etc.
```

Capability files are optional and added per feature. Any additional `.ts`/`.tsx` files (components, helpers, stores) can also live in the directory and be imported normally.

## script.json — the descriptor

`script.json` describes the script. It **must** contain `name`, `icon`, `color`, and `version`.

| Field | Required | Description |
|-------|----------|-------------|
| `name` | yes | Script name. Should match the directory name. |
| `icon` | yes | An SF Symbol name, e.g. `"house.fill"`, `"magnifyingglass"`, `"keyboard.fill"`. |
| `color` | yes | A color string: `rgba(...)` (e.g. `"rgba(255, 159, 10, 1)"`), hex (`"#FF9F0A"`), or a CSS color name (`"orange"`). |
| `version` | yes | Semantic version string, e.g. `"1.0.0"`. |
| `runInApp` | no | `true` runs the script inside the app instead of as a background/extension run. Defaults to `false`. |
| `iconImage` | no | URL to a remote icon image; overrides `icon` when set. |
| `description` | no | English description shown in the app. |
| `author` | no | `{ "name", "email", "homepage" }`. |
| `contributors` | no | Array of author objects. |
| `intentInputTypes` | no | Input types accepted by `intent.tsx` (texts, images, fileURLs, urls). |
| `remoteResource` | no | `{ "url", "hash", "autoUpdateInterval" }` for scripts synced from a remote zip/git. |
| `localizedNames` | no | Map of language code → localized name, e.g. `{ "zh": "我的脚本" }`. |
| `localizedDescriptions` | no | Map of language code → localized description. |

### Minimal example

```json
{
  "name": "My Script",
  "icon": "sparkles",
  "color": "rgba(10, 132, 255, 1)",
  "version": "1.0.0"
}
```

For a complete real-world example (author, localized names/descriptions, etc.), refer to the bundled `HomeKit DEMO/script.json`.

## index.tsx — the run entry point

`index.tsx` runs when the user taps the script in the app. It can either:

- **Render UI** using the React-like API with SwiftUI-wrapped components (`VStack`, `List`, `NavigationStack`, …) presented via `Navigation.present(...)`, or
- **Run pure logic** with no UI.

### Lifecycle: exit vs. minimize

A script instance keeps running until it is explicitly terminated. You have two ways to manage its lifecycle — pick based on whether the script's job is truly done:

- **`Script.exit()`** — fully terminates the instance and releases its resources. Call this when the script has finished its work and does not need to stay alive. In `index.tsx`, `Script.exit()` takes no argument; pass `Script.exit(value)` only where a result is expected (e.g. `intent.tsx`).
- **`Script.minimize()`** — hides the UI **without** terminating the instance. Runtime state is preserved and the script keeps running in the background. Use this for long-lived scripts (preserve state across hide/show, or keep listening for notification / widget / URL-scheme re-triggers).

When an instance stays alive, handle re-triggers with **`Script.onResume(callback)`** (fires on resume-from-minimized, notification taps, widget/Control Center taps, and `scripting://run/...`). Once `Script.exit()` has been called, those listeners no longer fire — the next trigger creates a fresh instance and re-runs the entry file.

So: **do not blindly call `Script.exit()`.** Exit only when the script is genuinely finished; otherwise minimize and rely on `onResume`. But a script that has nothing left to do and is not staying resident should call `Script.exit()` so it does not leak. See the `Script` documentation topic "Minimize and Resume" for the full model (`Script.supportsMinimization()`, `Script.isMinimized()`, `Script.onMinimize()`, `ResumeEventDetails`).

### Example: finite work, then exit

```tsx
import { Script } from "scripting"

async function run() {
  // ...do work, e.g. fetch data, write files, show a notification...
  Script.exit() // finished — release resources
}

run()
```

### Example: present UI, then exit on dismiss

```tsx
import { Script, Navigation, NavigationStack, List, Text } from "scripting"

function View() {
  return (
    <NavigationStack>
      <List
        navigationTitle="My Script"
        navigationBarTitleDisplayMode="inline"
      >
        <Text>Hello world!</Text>
      </List>
    </NavigationStack>
  )
}

async function run() {
  await Navigation.present(<View />)
  // Reached after the page is dismissed — terminate the instance.
  Script.exit()
}

run()
```

### Example: long-lived script that minimizes and resumes

```tsx
import { Script, Navigation, NavigationStack, List, Button, Text } from "scripting"

function View() {
  return (
    <NavigationStack>
      <List navigationTitle="My Script">
        <Text>Running…</Text>
        {Script.supportsMinimization() ? (
          <Button title="Hide" action={() => Script.minimize()} />
        ) : null}
      </List>
    </NavigationStack>
  )
}

// Keep the instance alive and react to re-triggers instead of exiting.
Script.onResume(details => {
  console.log("Resumed:", details.resumeFromMinimized, details.queryParameters)
})

Navigation.present(<View />)
// Note: no Script.exit() here — the script stays resident.
```

For full iOS-style page patterns (toolbars, navigation, lists, forms), use the `create-ios-page` skill.

## Capability files — one file per feature

A single script can expose many capabilities, each backed by a specific file. Each file maps to a `Script.env` value at runtime, so the same project can detect where it is running. Add only the files for the features the user needs, and invoke the matching skill for detailed guidance.

| File | Capability | Skill / reference to consult |
|------|------------|------------------------------|
| `widget.tsx` | Home Screen widget UI | `create-widget` (static widget); `create-interactive-widget` (widgets with `Button`/`Toggle`) |
| `live_activity.tsx` | Live Activity & Dynamic Island UI | `create-live-activity` |
| `notification.tsx` | Rich notification UI shown on long-press / expand | `create-rich-notification` |
| `intent.tsx` | Handler invoked by the Shortcuts app or Share Sheet | `create-intent` |
| `keyboard.tsx` | Custom keyboard extension UI | No dedicated skill — query `Keyboard` via `scripting_reference`; study the bundled `Custom Keyboard Demo` |
| `translation_ui_provider.tsx` | Custom system Translation UI provider | No dedicated skill — query `scripting_reference` for the translation UI APIs |
| `spotlight.tsx` | Callback run when a Spotlight result registered by the script is tapped | No dedicated skill — query `Spotlight` via `scripting_reference`; study the bundled `Spotlight DEMO` |

### Other entry points

The following additional entry-point files also exist and map to their own `Script.env` values; reach for them only when the user explicitly needs them, and query `scripting_reference` for details:

- `control_widget_button.tsx` / `control_widget_toggle.tsx` — Control Center / control widgets.
- `app_intents.tsx` — App Intents exposed to the system.
- `assistant_tool.tsx` — a tool exposed to the in-app Assistant.

## Recommended Workflow

1. Decide the script name (this is both the directory name and `script.json` `name`).
2. Create the script directory under the scripts directory.
3. Write `script.json` with at least `name`, `icon`, `color`, `version`.
4. Write `index.tsx` — render UI and/or run logic. End it correctly: call `Script.exit()` when the work is finished, or use `Script.minimize()` + `Script.onResume()` if the script should stay alive.
5. For each requested capability, add the matching file from the table above and invoke the corresponding skill.
6. Verify by running `scripting-ts` via the `run_shell_command` tool (`scripting-ts project "<Script Name>"` to run `index.tsx`, or `scripting-ts widget` / `scripting-ts run_intent` to preview widgets/intents).

## Notes

- `script.json` and `index.tsx` are mandatory; everything else is opt-in.
- Manage the lifecycle deliberately: `Script.exit()` to terminate when finished, or `Script.minimize()` + `Script.onResume()` to stay resident. `intent.tsx` always exits with a result via `Script.exit(value)`.
- Widgets render only when added to the Home Screen — `Widget.present()` does not render immediately.
- `intent.tsx` and the extension entry points generally cannot be tested through tools; the user must trigger them from the system (Shortcuts, Share Sheet, keyboard, Spotlight, etc.).

# Available Tools

When implementing this use case, you can use the following tools:

## scripting_reference (Query API Details)
Use the `scripting_reference` tool with `action: "query_apis"` to look up symbols before generating code — e.g. `Script` (including `Script.exit`, `Script.minimize`, `Script.onResume` and the "Minimize and Resume" topic), `Navigation`, `Widget`, `Spotlight`, `Keyboard`, and any component you plan to use.

## file_tool (Create Files)
Use file tools to create the script directory, `script.json`, `index.tsx`, and any capability files.

## scripting-ts (Run / Preview / Execute TypeScript)
Run `scripting-ts` via the `run_shell_command` tool to run and preview the script:

- `scripting-ts project "<Script Name>"` — run the project entry (`index.tsx`).
- `scripting-ts widget "<Script Name>" [--family <size>] [--screenshot]` — preview a widget.
- `scripting-ts run_intent "<Script Name>" [--params '<json>']` — test an intent.
- `scripting-ts preview_ui <file.tsx> [--props '<json>'] [--screenshot]` — render a file that default-exports a View.
- `scripting-ts run <file.tsx>` — execute a specific TypeScript file; `scripting-ts eval "<code>"` runs inline code snippets.

Add `--screenshot` to capture the rendered UI so you can inspect it.
