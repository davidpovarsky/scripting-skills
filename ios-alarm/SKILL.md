---
name: ios-alarm
description: Manage iOS alarms and timers via AlarmManager — list active alarms/timers, schedule alarms (fixed/relative/weekly), create countdowns and timers, and control them (cancel, stop, pause, resume, start_countdown).
runtime: node
metadata:
  display_name: "iOS Alarm"
  required_tools: "run_shell_command"
---

# Purpose

This skill exposes the full iOS 26+ `AlarmManager` API through a set of CLI-style scripts. It can:

- List all scheduled alarms/timers and inspect their state.
- Create **timers** (`Configuration.timer`) — simple countdown alarms.
- Create **alarms** (`Configuration.alarm`) — with `fixed` / `relative` / `weekly` schedules.
- Create **countdowns** (`Configuration.countdown`) — with optional `preAlert` / `postAlert` and an optional bound schedule.
- Control any alarm/timer: `cancel` / `stop` / `pause` / `resume` / `start_countdown`.
- Optionally bind `stopIntent` and `secondaryIntent` (AppIntent with `LiveActivityIntent` protocol).

> **Platform note:** `AlarmManager` requires iOS 26+. Each script aborts with a clean error when `AlarmManager.isAvailable` is `false`. `Configuration.alarm()` is currently rejected by AlarmKit with `error 0` on all `Schedule` variants tested (fixed/relative/weekly) — treat that as a system/bridge limitation, not a script bug. A workaround is `schedule_countdown.ts` with an attached `scheduleType`, which exercises the same `Schedule` objects successfully.

## Error model

All scripts return a structured error object on failure:

```jsonc
{
  "success": false,
  "errorCode": "UNAVAILABLE" | "MISSING_PARAM" | "INVALID_PARAM" | "UNKNOWN_PARAM" | "SCHEDULE_REJECTED" | "INTERNAL",
  "param": "offending.path.if.any",
  "message": "human-readable reason",
  "details": { /* optional, e.g. native error text */ }
}
```

- `UNAVAILABLE` — `AlarmManager.isAvailable` is false (iOS < 26).
- `MISSING_PARAM` / `INVALID_PARAM` / `UNKNOWN_PARAM` — strict input validation failed before any native call.
- `SCHEDULE_REJECTED` — AlarmKit itself rejected the operation (invalid alarm id, unsupported configuration, etc.).
- `INTERNAL` — unexpected JS-side error.

# Available Scripts

All scripts are executed via `run_shell_command` using `scripting-ts run`. Pass parameters as a JSON string with `--queryparameters`.

All parameters that accept JSON (e.g. `stopButton`, `metadata`, `weekdays`, `stopIntent`) may be given either as a raw JSON object embedded in the outer JSON, or as a JSON-encoded string.

## get_alarms.ts

List all active alarms/timers. Optionally filter by id.

```
scripting-ts run <skill_dir>/scripts/get_alarms.ts
scripting-ts run <skill_dir>/scripts/get_alarms.ts --queryparameters '{"id":"<uuid>"}'
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | string | No | If set, only return the matching alarm. |

**Output:**
```jsonc
{
  "success": true,
  "count": 1,
  "alarms": [{
    "id": "…",
    "state": "scheduled" | "countdown" | "paused" | "alerting",
    "schedule": {
      "type": "fixed" | "relative" | "weekly",
      "date": "ISO string or null",
      "hour": 7, "minute": 0,
      "weekdays": [2,3,4,5,6],
      "weekdaysText": ["Mon","Tue","Wed","Thu","Fri"]
    } | null,
    "countdown": { "preAlert": 1500, "postAlert": null } | null
  }]
}
```

## schedule_timer.ts

Create a simple countdown timer (`Configuration.timer`).

```
scripting-ts run <skill_dir>/scripts/schedule_timer.ts --queryparameters '{"title":"Eggs Ready","duration":180}'
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | string | No | Custom id. Default: generated UUID. |
| `title` | string | No | Alert title. Default: `"Timer"`. |
| `duration` | number | Yes | Countdown duration in seconds (>0). |
| `sound` | string | No | Sound resource name. Falls back to default. |
| `tintColor` | string | No | Hex (`#RRGGBB`), rgba, or keyword (e.g. `systemOrange`). |
| `stopButtonTitle` / `stopButtonSystemImage` / `stopButtonTextColor` | string | No | Stop-button shorthand. |
| `stopButton` | object | No | Full `{title,systemImageName,textColor}`. Overrides the shorthand. |
| `secondaryButtonTitle` / `secondaryButtonSystemImage` | string | No | Secondary-button shorthand. |
| `secondaryButton` | object | No | Full `{title,systemImageName,textColor}`. |
| `secondaryBehavior` | string | No | `"countdown"` (default) \| `"custom"` \| `"none"`. `"none"` drops the secondary button. |
| `countdownTitle` / `pausedTitle` | string | No | Titles for CountdownPresentation / PausedPresentation. Default: `title`. |
| `metadata` | object | No | Arbitrary string-keyed metadata attached to the alarm. |
| `stopIntent` | object | No | `{script, name, params?}` — see "AppIntent binding". |
| `secondaryIntent` | object | No | Same shape as `stopIntent`. |

## schedule_alarm.ts

Create an alarm with a `fixed` / `relative` / `weekly` schedule (`Configuration.alarm`).

```
# Fixed date-time
scripting-ts run <skill_dir>/scripts/schedule_alarm.ts --queryparameters '{"title":"Doctor","scheduleType":"fixed","date":"2026-04-20T09:00:00+08:00"}'

# Relative time-of-day
scripting-ts run <skill_dir>/scripts/schedule_alarm.ts --queryparameters '{"title":"Wake Up","scheduleType":"relative","hour":7,"minute":30}'

# Weekly recurrence (Apple weekday numbering: 1=Sun, 2=Mon, …, 7=Sat)
scripting-ts run <skill_dir>/scripts/schedule_alarm.ts --queryparameters '{"title":"Workdays","scheduleType":"weekly","hour":7,"minute":30,"weekdays":[2,3,4,5,6]}'
```

**Schedule parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `scheduleType` | string | Yes | `"fixed"` \| `"relative"` \| `"weekly"`. |
| `date` | string (ISO) | Yes if `fixed` | Absolute datetime. |
| `hour` | number 0-23 | Yes if `relative`/`weekly` | |
| `minute` | number 0-59 | Yes if `relative`/`weekly` | |
| `weekdays` | number[] | Yes if `weekly` | Apple weekday numbers. **1=Sun … 7=Sat**. |
| `schedule` | object | No | Shortcut: provide the whole schedule payload as one JSON object instead of the flat keys above. |

All other parameters are identical to `schedule_timer.ts` (buttons, sound, intents, metadata, tintColor …). Default `secondaryBehavior` is `"countdown"` with a `"Snooze"` label.

## schedule_countdown.ts

Create a countdown-style alarm (`Configuration.countdown`) with optional `preAlert`/`postAlert` and an optional schedule.

```
# Simple countdown (must be started manually via control_alarm start_countdown, unless schedule-bound)
scripting-ts run <skill_dir>/scripts/schedule_countdown.ts --queryparameters '{"title":"Workout","preAlert":1500,"postAlert":300}'

# Schedule-bound countdown
scripting-ts run <skill_dir>/scripts/schedule_countdown.ts --queryparameters '{"title":"Morning","preAlert":600,"scheduleType":"relative","hour":7,"minute":0}'
```

**Countdown parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `preAlert` | number | At least one of pre/post | Seconds before the main alert. |
| `postAlert` | number | At least one of pre/post | Seconds after the main alert continues. |
| `scheduleType` (+ schedule fields) | — | No | Same shape as `schedule_alarm.ts`. When omitted, start the countdown manually. |

Shares all button/sound/intent/metadata/tintColor params with the other schedulers.

## control_alarm.ts

Issue a lifecycle action against an existing alarm/timer.

```
scripting-ts run <skill_dir>/scripts/control_alarm.ts --queryparameters '{"id":"<uuid>","action":"pause"}'
```

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | string | Yes | Alarm/timer id. |
| `action` | string | Yes | `"cancel"` \| `"stop"` \| `"pause"` \| `"resume"` \| `"start_countdown"`. |

**Action semantics:**
- `cancel` — remove the alarm entirely.
- `stop` — stop an alarm that is currently alerting.
- `pause` — pause an active countdown.
- `resume` — resume a paused countdown.
- `start_countdown` — manually start a countdown that was scheduled without a bound schedule.

# AppIntent binding (`stopIntent` / `secondaryIntent`)

You can wire a button to an `AppIntent` created elsewhere in the Scripting app. The intent **must** conform to the `LiveActivityIntent` protocol (`AppIntentProtocol.LiveActivityIntent`). This skill builds the `AlarmAppIntent` object for you — you only provide the reference:

```jsonc
{
  "stopIntent": {
    "script": "MyIntentsScript",   // Scripting script name that hosts the intent
    "name":   "StopAlarmIntent",   // the intent's exported name
    "params": { "alarmId": "abc" } // optional params, plain JSON-serializable
  }
}
```

If the referenced script/intent does not exist, the alarm still schedules, but pressing the button will fail silently. Tested intents should already exist in the Scripting app before being referenced.

# Instructions

1. **Pre-flight:** every script checks `AlarmManager.isAvailable`. iOS 26+ required.
2. **Pick the right script:**
   - Enumerate / inspect → `get_alarms.ts` (optionally with `id`).
   - Simple countdown timer → `schedule_timer.ts`.
   - Alarm at a specific clock time / weekly → `schedule_alarm.ts`.
   - Countdown with pre/post alerts or a schedule-bound countdown → `schedule_countdown.ts`.
   - Control lifecycle → `control_alarm.ts`.
3. **Build the `--queryparameters` JSON** from the user's request. Flat keys and nested objects both work for buttons/schedule.
4. **Capture the returned `id`.** Tell the user so they can control or cancel it later.
5. **Weekdays are Apple-style: 1=Sun, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri, 7=Sat.**
6. **Listener APIs** (`addAlarmUpdateListener` / `removeAlarmUpdateListener`) are not exposed by this skill: they only make sense inside a long-running script in the Scripting app, not in one-shot CLI invocations. Use `get_alarms.ts` for polling instead.

# Examples

**5-minute Pomodoro break:**
```
scripting-ts run <skill_dir>/scripts/schedule_timer.ts --queryparameters '{"title":"Break","duration":300,"tintColor":"systemOrange"}'
```

**Weekday wake-up at 07:30 with Snooze:**
```
scripting-ts run <skill_dir>/scripts/schedule_alarm.ts --queryparameters '{"title":"Wake Up","scheduleType":"weekly","hour":7,"minute":30,"weekdays":[2,3,4,5,6],"secondaryButtonTitle":"Snooze","secondaryBehavior":"countdown"}'
```

**Countdown with 25 min focus + 5 min wind-down:**
```
scripting-ts run <skill_dir>/scripts/schedule_countdown.ts --queryparameters '{"title":"Focus","preAlert":1500,"postAlert":300}'
# then start it manually:
scripting-ts run <skill_dir>/scripts/control_alarm.ts --queryparameters '{"id":"<uuid>","action":"start_countdown"}'
```

**Pause / resume / cancel:**
```
scripting-ts run <skill_dir>/scripts/control_alarm.ts --queryparameters '{"id":"<uuid>","action":"pause"}'
scripting-ts run <skill_dir>/scripts/control_alarm.ts --queryparameters '{"id":"<uuid>","action":"resume"}'
scripting-ts run <skill_dir>/scripts/control_alarm.ts --queryparameters '{"id":"<uuid>","action":"cancel"}'
```
