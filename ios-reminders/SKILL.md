---
name: ios-reminders
description: Manage iOS Reminders — list incomplete/completed reminders, create new reminders with due dates and priorities, mark them as complete, and remove them.
runtime: node
metadata:
  display_name: "iOS Reminders"
  required_tools: "run_shell_command"
---

# Purpose

This skill provides scripts for managing iOS Reminders through the Scripting TypeScript runtime. Use it when the user wants to fetch reminders (all / incomplete / completed), create a new reminder, update its state (title, notes, due date, priority, completion), or delete reminders.

All reminders are stored in the system Reminders app and, when no calendar is specified, use the user's default reminder list (`Calendar.defaultForReminders()`).

# Available Scripts

All scripts are executed via `run_shell_command` using `scripting-ts run`. Pass parameters as a JSON string with `--queryparameters`.

## get_reminders.ts

Fetch reminders, optionally filtered by completion state and due-date range.

```
scripting-ts run <skill_dir>/scripts/get_reminders.ts --queryparameters '{"type":"incomplete"}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `type` | `"all"` \| `"incomplete"` \| `"completed"` | No | Which reminders to return. Default: `"incomplete"`. |
| `start_date` | string | No | ISO date string. For `incomplete`: lower bound on due date. For `completed`: lower bound on completion date. |
| `end_date` | string | No | ISO date string. Upper bound on due date (incomplete) or completion date (completed). |

**Output:** JSON object `{ success, type, count, reminders }`. Each reminder contains `identifier`, `title`, `notes`, `isCompleted`, `priority`, `dueDate` (ISO or null), `completionDate` (ISO or null), and `calendarTitle`.

## create_reminder.ts

Create a new reminder in the default (or a named) reminder list.

```
scripting-ts run <skill_dir>/scripts/create_reminder.ts --queryparameters '{"title":"Buy milk","due_date":"2026-04-10 18:00:00","priority":5,"notes":"From the corner store"}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `title` | string | Yes | Reminder title. |
| `notes` | string | No | Additional notes. |
| `due_date` | string | No | Date/time string (e.g. `"2026-04-10 18:00:00"` or ISO). If omitted, no due date is set. |
| `date_only` | boolean | No | If true, store only the date portion (no time). Default: false. |
| `priority` | number | No | Integer 0–9. Higher = more important. Default: 0 (none). |
| `calendar_title` | string | No | Title of the target reminder list. If omitted, uses `Calendar.defaultForReminders()`. |

**Output:** JSON object `{ success, identifier, title, message }`.

## update_reminder.ts

Update an existing reminder's fields or mark it complete/incomplete.

```
scripting-ts run <skill_dir>/scripts/update_reminder.ts --queryparameters '{"identifier":"XXX","is_completed":true}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `identifier` | string | Yes | Identifier of the reminder to update. |
| `title` | string | No | New title. |
| `notes` | string | No | New notes. Pass empty string `""` to clear. |
| `due_date` | string \| null | No | New due date/time. Pass `null` to clear. |
| `date_only` | boolean | No | When setting `due_date`, store only the date part. Default: false. |
| `priority` | number | No | New priority 0–9. |
| `is_completed` | boolean | No | Mark complete (`true`) or incomplete (`false`). |

**Output:** JSON object `{ success, identifier, message }`.

## remove_reminders.ts

Remove one or more reminders by identifier.

```
scripting-ts run <skill_dir>/scripts/remove_reminders.ts --queryparameters '{"identifiers":["id1","id2"]}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `identifiers` | string[] | Yes | Array of reminder identifiers to remove. |

**Output:** JSON object `{ success, removed, removedTitles, notFound }`.

# Instructions

1. Determine which script matches the user's request (query / create / update / remove).
2. Build the `--queryparameters` JSON from the user's input. Convert natural-language dates to an ISO-8601 string or `YYYY-MM-DD HH:mm:ss` format.
3. Execute via `run_shell_command` with `scripting-ts run <path> --queryparameters '<json>'`.
4. Parse the JSON output and summarize the result to the user.
5. For destructive actions (update that clears fields, remove), confirm with the user first when intent is ambiguous.
6. When listing reminders, prefer `type: "incomplete"` unless the user explicitly asks for completed or all.
