---
name: ios-notifications
description: Manage iOS local notifications — list pending/delivered, schedule new ones, and remove them by identifier.
runtime: node
metadata:
  display_name: "iOS Notifications"
  required_tools: "run_shell_command"
---

# Purpose

This skill provides scripts for managing iOS local notifications through the Scripting TypeScript runtime. Use it when the user wants to fetch pending/delivered notifications, schedule a new local notification, or remove existing ones.

# Available Scripts

All scripts are executed via `run_shell_command` using `scripting-ts run`. Pass parameters as a JSON string with `--queryparameters`.

## get_notifications.ts

Retrieve pending or delivered notifications.

```
scripting-ts run <skill_dir>/scripts/get_notifications.ts --queryparameters '{"type":"pending"}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `type` | `"pending"` \| `"delivered"` | No | Which notifications to fetch. Default: `"pending"`. |

**Output:** JSON array of notification objects with `identifier`, `title`, `body`, and `triggerDate` fields.

## schedule_notification.ts

Schedule a local notification.

```
scripting-ts run <skill_dir>/scripts/schedule_notification.ts --queryparameters '{"title":"Reminder","body":"Time to stretch","trigger_time":"2026-04-02 15:30:00"}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `title` | string | Yes | Notification title. |
| `subtitle` | string | No | Notification subtitle. |
| `body` | string | No | Notification body text. |
| `silent` | boolean | No | Suppress sound. Default: false. |
| `trigger_time` | string | No | Date/time string (e.g. `"2026-04-02 15:30:00"`). If omitted, fires immediately. |
| `repeats_type` | string | No | Repeat interval: `"hourly"`, `"daily"`, `"weekly"`, `"monthly"`. Requires `trigger_time`. |

**Output:** JSON object with `success` and `message` fields.

## remove_notifications.ts

Remove pending or delivered notifications by identifier.

```
scripting-ts run <skill_dir>/scripts/remove_notifications.ts --queryparameters '{"identifiers":["id1","id2"],"type":"pending"}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `identifiers` | string[] | Yes | Array of notification identifiers to remove. |
| `type` | `"pending"` \| `"delivered"` | Yes | Which notification list to remove from. |

**Output:** JSON object with `success` and `message` fields.

# Instructions

1. Determine which script to use based on the user's request.
2. Build the `--queryparameters` JSON from the user's input.
3. Execute via `run_shell_command` with `scripting-ts run <path> --queryparameters '<json>'`.
4. Parse the JSON output and present the result to the user.
5. For scheduling, always confirm the notification details with the user before executing.
