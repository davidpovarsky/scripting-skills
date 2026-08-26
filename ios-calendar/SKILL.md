---
name: ios-calendar
description: Manage iOS calendar events — list calendars, query events, create new events, and remove them by identifier.
runtime: node
metadata:
  display_name: "iOS Calendar"
  required_tools: "run_shell_command"
---

# Purpose

This skill provides scripts for managing iOS calendar events through the Scripting TypeScript runtime. Use it when the user wants to list calendars, query events within a date range, create new calendar events, or remove existing ones.

# Available Scripts

All scripts are executed via `run_shell_command` using `scripting-ts run`. Pass parameters as a JSON string with `--queryparameters`.

## list_calendars.ts

Retrieve all calendars that support events.

```
scripting-ts run <skill_dir>/scripts/list_calendars.ts
```

**Parameters:** None

**Output:** JSON object with `success`, `count`, and `calendars` array. Each calendar has `identifier`, `title`, `color`, `type`, `isDefault`, and `allowsModifications` fields.

## get_events.ts

Query calendar events within a date range.

```
scripting-ts run <skill_dir>/scripts/get_events.ts --queryparameters '{"start_date":"2026-04-10","end_date":"2026-04-17"}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `start_date` | string | Yes | Start date (e.g. `"2026-04-10"` or `"2026-04-10 09:00:00"`). |
| `end_date` | string | Yes | End date (e.g. `"2026-04-17"` or `"2026-04-17 18:00:00"`). |
| `calendar_ids` | string[] | No | Array of calendar identifiers to filter. Default: all calendars. |

**Output:** JSON object with `success`, `count`, and `events` array. Each event has `identifier`, `title`, `startDate`, `endDate`, `isAllDay`, `location`, `notes`, `calendar`, and `hasAlarms` fields.

## create_event.ts

Create a new calendar event.

```
scripting-ts run <skill_dir>/scripts/create_event.ts --queryparameters '{"title":"Meeting","start_date":"2026-04-10 14:00:00","end_date":"2026-04-10 15:00:00"}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `title` | string | Yes | Event title. |
| `start_date` | string | Yes | Start date/time (e.g. `"2026-04-10 14:00:00"`). |
| `end_date` | string | Yes | End date/time (e.g. `"2026-04-10 15:00:00"`). |
| `is_all_day` | boolean | No | All-day event. Default: false. |
| `location` | string | No | Event location. |
| `notes` | string | No | Event notes. |
| `url` | string | No | URL associated with the event. |
| `calendar_id` | string | No | Calendar identifier. Default: default calendar. |
| `alarm_minutes` | number | No | Minutes before event to trigger alarm (e.g. `15` for 15 minutes before). |
| `recurrence` | object | No | Recurrence rule: `{"frequency":"daily"|"weekly"|"monthly"|"yearly", "interval":1, "end_date":"2026-12-31"}` |

**Output:** JSON object with `success`, `message`, and `event` (created event details).

## remove_event.ts

Remove a calendar event by identifier.

```
scripting-ts run <skill_dir>/scripts/remove_event.ts --queryparameters '{"identifier":"ABC123"}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `identifier` | string | Yes | The event identifier to remove. |

**Output:** JSON object with `success` and `message` fields.

# Instructions

1. Determine which script to use based on the user's request.
2. Build the `--queryparameters` JSON from the user's input.
3. Execute via `run_shell_command` with `scripting-ts run <path> --queryparameters '<json>'`.
4. Parse the JSON output and present the result to the user.
5. For creating/removing events, confirm the details with the user before executing.
