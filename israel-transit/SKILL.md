---
name: israel-transit
description: Israeli public-transit skill for Scripting. Use for live arrivals, nearby stops, stop/line timetables, exact line variants and maps, travel time on a specific line between two stops, service alerts, A-to-B planning, trip reminders/Live Activities, and recurring transit monitoring. For every normal transit request, including short factual questions, emit one literal `scripting-file` block and never use `call_assistant_tool`; bundled TypeScript performs API calls, resolution, filtering, calculations, monitoring, and rendering locally.
---

# Israel Transit

## Mandatory execution contract

After this file has been loaded for a normal transit request, the **next assistant response is the execution**:
- Output exactly one literal `scripting-file` block and nothing else. This applies even to simple questions that could be answered in one sentence.
- Do **not** call any tool after reading this file. In particular, never call `call_assistant_tool`, `file_tool`, `shell`, `browser`, `scripting_reference`, `plan`, or another skill.
- A `scripting-file` block is response content, **not** an Assistant Tool call. The renderer itself performs the network/API work locally after the block is rendered.
- Do not emit analysis, planning, narration, or a prose preface before the block. Any text outside the single block is a contract violation.
- Never try to execute `query.ts` from the Assistant. `query.ts` exists only for backward-compatible/manual script execution and maintenance.
- Never invent actions or implementation steps. Use only the actions and parameters documented here.
- Pass only compact intent parameters; bundled TypeScript resolves stops/lines, calls APIs, filters data, computes durations, monitors state, and renders results.
- If the request truly cannot be expressed with a documented action, answer briefly that it is unsupported; do not inspect files or improvise a tool workflow.

### Fast routing — decide without another file/tool read

| User intent | Emit action |
|---|---|
| “How long does line X take from stop A to stop B?” | `line_segment` |
| A-to-B journey / “how do I get from A to B?” | `plan_trip` |
| Arrivals at a stop | `stop_board` |
| Specific line near current location | `nearby_line` |
| Full line route/map | `line_details` |
| Line timetable | `line_schedule` |
| Stop timetable | `stop_schedule` |
| Service disruptions | `alerts` |
| Any recurring check/notification | matching `*_watch` action |

For a line travel-time question, use `line_segment`; do not substitute `plan_trip` and do not calculate the duration in the model. The renderer compares three local statistics when available: (1) the nearest upcoming live vehicle using the same vehicle/trip ETA at both stops, (2) the last three completed segment traversals observed locally from realtime polling and matched by trip/vehicle ID, and (3) the scheduled duration for the same/nearest planned trip. Never call schedule-only data realtime, and never fabricate the three completed traversals when local history has not accumulated yet. Example:
```scripting-file
{
  "path": "/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripting-skills/israel-transit/scripts/transit-renderer.tsx",
  "props": { "action": "line_segment", "lineNumber": "90", "fromStopQuery": "טשרניחובסקי הרצוג", "toStopQuery": "בניני האומה" }
}
```

If the user says “this stop/this line” in a follow-up, reuse the explicit line/stop named in the immediately preceding conversation when it is available. Use `preferContext:true` only when referring to a previously rendered rich transit UI.

Renderer:
`/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripting-skills/israel-transit/scripts/transit-renderer.tsx`

## Rich requests

Current-location requests omit coordinates; the renderer requests location itself.

Generic stop board:
```scripting-file
{
  "path": "/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripting-skills/israel-transit/scripts/transit-renderer.tsx",
  "props": { "action": "stop_board", "query": "ארמון הנציב" }
}
```

### Snapshot filters

For `stop_board` and next-arrival `nearby_line`, express filtering in props instead of filtering returned results in the model:
- `withinMinutes` or `maxMinutes`: only arrivals up to that many minutes away.
- `minMinutes`: lower bound, for ranges such as 5–10 minutes.
- `maxResults`: return only the first N matching arrivals.
- `lineNumber` / `lineNumbers`: one or more passenger-facing lines.
- `destinationQuery` or `directionQuery`: requested destination/direction.
- `realtimeOnly:true`: exclude schedule-only arrivals.
- `accessibleOnly:true`: only departures positively marked accessible by the source.

Example: “מה מגיע לתחנה 1076 בשלוש הדקות הקרובות?”
```scripting-file
{
  "path": "/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripting-skills/israel-transit/scripts/transit-renderer.tsx",
  "props": { "action": "stop_board", "stopCode": "1076", "withinMinutes": 3 }
}
```

Example: “רק קווים 18 ו־74 בין 5 ל־10 דקות”
```scripting-file
{
  "path": "/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripting-skills/israel-transit/scripts/transit-renderer.tsx",
  "props": { "action": "stop_board", "stopCode": "1076", "lineNumbers": ["18", "74"], "minMinutes": 5, "maxMinutes": 10 }
}
```

### Specific line near current location

Use `nearby_line` for a line-specific snapshot around the current location. Add only user-stated constraints:
- next arrival: omit `departureMode` or use `next`
- last service: `departureMode:"last"`
- first service: `departureMode:"first"`
- full timetable: `departureMode:"schedule"`
- requested direction/destination: `directionQuery`
- requested service date: `date` (`YYYY-MM-DD`); omit for today

Example: “מתי ה־71 האחרון היום מהמיקום שלי לכיוון גילה”
```scripting-file
{
  "path": "/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripting-skills/israel-transit/scripts/transit-renderer.tsx",
  "props": { "action": "nearby_line", "lineNumber": "71", "directionQuery": "גילה", "departureMode": "last" }
}
```

For a known stop timetable use `stop_schedule`. For a known/exact line variant timetable use `line_schedule`. Both render a local date picker and reload the chosen API date without another model turn.

For generic nearby stops use `nearby_stops`.

## Monitoring and notifications

Monitoring is first-class. Never use a generic notification skill, repeated model turns, external automation, or ad-hoc code for these requests. The renderer installs/updates the bundled `israel_transit_monitor` Scripting project automatically and the monitor project performs polling and notification delivery locally.

Monitoring defaults:
- If the user gives a polling cadence, pass `pollIntervalSeconds` exactly.
- If the user gives an arrival window, pass `arrivalWindowMinutes` or `maxMinutes`.
- If no ending is stated, the watch remains active until cancelled or iOS stops background execution.
- `delivery` defaults to `notification`; use `live_activity` or `both` only when the user asks for a persistent live display.
- Background execution is best-effort on iOS; never promise guaranteed indefinite polling.

### Stop monitoring — `stop_watch`

Use for recurring checks of a known stop, the nearest current-location stop, or several known stop codes, optionally filtered by lines/destination/realtime/accessibility. For the nearest current-location stop use `useCurrentLocation:true`; add `followLocation:true` only when the user explicitly wants the selected stop to change as they move.

Example: “תחנה 1076, כל שלוש דקות תבדוק אילו קווים מגיעים בשלוש הדקות הקרובות ותתריע”
```scripting-file
{
  "path": "/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripting-skills/israel-transit/scripts/transit-renderer.tsx",
  "props": {
    "action": "stop_watch",
    "stopCode": "1076",
    "pollIntervalSeconds": 180,
    "arrivalWindowMinutes": 3,
    "notifyMode": "when_matches"
  }
}
```

Useful stop-watch props: `stopCode`, `stopCodes`, `query`, `lineNumber`, `lineNumbers`, `directionQuery`, `destinationQuery`, `departureMode`, `date`, `pollIntervalSeconds`, `arrivalWindowMinutes`, `minMinutes`, `maxMinutes`, `maxResults`, `realtimeOnly`, `accessibleOnly`, `notifyMode`, `watchCondition`, `delayAtLeastMinutes`, `etaChangeMinutes`, `stopAfterFirstMatch`, `durationMinutes`, `until`, `maxChecks`, `delivery`.

For one watch covering several known stop codes, use `stopCodes:[...]`; the local monitor merges and labels matching arrivals from all of them. Do not create one model turn per stop.

For “remind me before the first/last service”, use `departureMode:"first"` or `departureMode:"last"`, the requested `date` when stated, a lead window via `maxMinutes`/`arrivalWindowMinutes`, `notifyMode:"once"`, and `stopAfterFirstMatch:true`. The monitor selects the first/last service before applying the lead-time window, so ordinary earlier departures cannot trigger a last-service reminder.

### Line monitoring — `line_watch`

Use for a line either at a particular stop, near the current location, or as a live line/vehicle watch.

At a known stop, set `lineNumber` plus `stopCode` or `stopQuery`.

Near the current location, set `useCurrentLocation:true`. The renderer resolves the nearest served stop locally. If the user explicitly asks the watch to move with them, also set `followLocation:true`; otherwise the selected stop is locked when the watch starts.

Example: “תודיע לי כשקו 18 בתחנה 1076 יהיה עד חמש דקות”
```scripting-file
{
  "path": "/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripting-skills/israel-transit/scripts/transit-renderer.tsx",
  "props": {
    "action": "line_watch",
    "lineNumber": "18",
    "stopCode": "1076",
    "maxMinutes": 5,
    "pollIntervalSeconds": 60,
    "notifyMode": "once",
    "watchCondition": "matches",
    "stopAfterFirstMatch": true
  }
}
```

Without a stop/location, `line_watch` monitors the resolved exact line variant's live vehicle set. Preserve requested direction/variant through `directionQuery`, `routeId`, `routeCode`, or `alternative` when known.

### Service-alert monitoring — `alerts_watch`

Use to watch a stop or line for new/changed service disruptions. Default to `notifyMode:"new_matches"` and `watchCondition:"new_alerts"`.

Example: “תודיע לי אם יוצאת התראה חדשה לקו 71”
```scripting-file
{
  "path": "/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripting-skills/israel-transit/scripts/transit-renderer.tsx",
  "props": { "action": "alerts_watch", "lineNumber": "71", "pollIntervalSeconds": 300 }
}
```

### Trip monitoring — `trip_watch`

Use only for the most recently rendered/selected trip. It watches upcoming transit legs and compares live ETA/delay state locally.

For transfer-risk requests use `watchCondition:"connection_risk"` and optionally `connectionBufferMinutes` (default 4). The monitor compares the previous leg's live arrival with the next leg's live/scheduled departure and includes intervening walking time; the model must not calculate transfer risk itself.

Example: “עקוב אחרי המסלול הזה ותודיע אם משהו משתנה”
```scripting-file
{
  "path": "/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripting-skills/israel-transit/scripts/transit-renderer.tsx",
  "props": { "action": "trip_watch", "pollIntervalSeconds": 30, "notifyMode": "on_change", "watchCondition": "any_change" }
}
```

### Monitor conditions and notification policy

Use `watchCondition` for what counts as a trigger:
- `matches`: matching arrivals/items exist.
- `no_arrivals`: no matching arrivals in the requested window.
- `service_resumed`: matches return after a previous empty check.
- `delay`: an item reaches `delayAtLeastMinutes`.
- `eta_change`: ETA changes by at least `etaChangeMinutes`.
- `disappeared`: a previously seen matching vehicle/trip disappears.
- `any_change`: the monitored snapshot changes materially.
- `new_alerts`: a previously unseen service alert appears.
- `vehicle_change`: the live vehicle set changes.
- `connection_risk`: a selected trip connection has too little remaining transfer margin; tune with `connectionBufferMinutes`.

Use `notifyMode` for delivery frequency:
- `every_check`: notify after every poll, including an empty result.
- `when_matches`: notify whenever the condition is true.
- `on_change`: notify only when the condition is true and the snapshot changed.
- `new_matches`: establish the first successful poll as a baseline, then notify only for matching item IDs that appear later. `new_alerts` follows the same baseline rule.
- `once`: notify once on the first trigger.

Use `stopAfterFirstMatch:true` when the request is explicitly “tell me when X happens, then stop”.

End conditions can be expressed with `durationMinutes`, ISO `until`, or `maxChecks`. If none is stated, do not invent one.

### Monitor management — `watch_control`

Use for “what are you monitoring?”, status, update, pause, resume, stop, or stop all monitors.

`watchAction` values: `list`, `status`, `update`, `pause`, `resume`, `cancel`, `cancel_all`.

If the user refers to “this monitor” and no `watchId` is known, omit it; the monitor project resolves the most recently relevant active watch. If the user names a stop/line, pass `stopCode` or `lineNumber` as the selector.

Examples:
```scripting-file
{
  "path": "/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripting-skills/israel-transit/scripts/transit-renderer.tsx",
  "props": { "action": "watch_control", "watchAction": "list" }
}
```

```scripting-file
{
  "path": "/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripting-skills/israel-transit/scripts/transit-renderer.tsx",
  "props": { "action": "watch_control", "watchAction": "cancel", "stopCode": "1076" }
}
```

```scripting-file
{
  "path": "/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripting-skills/israel-transit/scripts/transit-renderer.tsx",
  "props": { "action": "watch_control", "watchAction": "update", "lineNumber": "18", "pollIntervalSeconds": 60, "maxMinutes": 10 }
}
```

## Trip planning

For A-to-B requests use `plan_trip`. Do not inspect implementation files to discover parameters.

For trips from current location set `useCurrentLocation:true` and omit `fromQuery`; set destination with `toQuery`. Preserve every user-stated time constraint:
- Resolve relative dates against request `current_time` and pass future service `date` as `YYYY-MM-DD`.
- For “arrive by 09:30”, pass `time:"09:30"`, `arriveBy:true`.
- For “depart at 09:30”, pass `time:"09:30"`, `arriveBy:false`.
- Never replace an explicitly requested future date/time with current date/time.

The rendered trip UI installs/updates the bundled `israel_transit_companion` project for departure reminders and trip Live Activities. Do not inspect its implementation during normal use.

Example: “מתי אני צריך לצאת מהבית מחר כדי להגיע בתשע וחצי בבוקר לאמציה 3 ירושלים”
```scripting-file
{
  "path": "/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripting-skills/israel-transit/scripts/transit-renderer.tsx",
  "props": { "action": "plan_trip", "useCurrentLocation": true, "toQuery": "אמציה 3 ירושלים", "date": "2026-08-17", "time": "09:30", "arriveBy": true }
}
```

## Follow-ups to previously rendered UI

Treat “this line”, “that bus”, “the second option”, and “this segment” as references to the last rich transit UI. Emit the renderer with `preferContext:true`; do not globally re-search merely to recover IDs.

For the selected trip's existing follow-through controls:

Start Live Activity:
```scripting-file
{
  "path": "/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripting-skills/israel-transit/scripts/transit-renderer.tsx",
  "props": { "action": "trip_engagement", "engagementAction": "live" }
}
```

Schedule departure reminder:
```scripting-file
{
  "path": "/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripting-skills/israel-transit/scripts/transit-renderer.tsx",
  "props": { "action": "trip_engagement", "engagementAction": "reminder" }
}
```

`trip_engagement` is a renderer-only action and is not part of the transit query schema.

## No Assistant-side text execution path

Normal transit requests always use the renderer via one `scripting-file` block, including compact factual questions. Never execute `query.ts` or route a Skill name through `call_assistant_tool`.

## Actions

| Intent | Action |
|---|---|
| Place/address search | `geocode` |
| Stop search | `search_stops` |
| Generic nearby stops | `nearby_stops` |
| Specific line near current location; next/first/last/full schedule | `nearby_line` |
| Line candidates | `search_lines` |
| Filtered/current arrivals at a known stop | `stop_board` |
| Stop timetable / selected date | `stop_schedule` |
| Exact line route/map | `line_details` |
| Live line map/vehicles | `line_live` |
| Exact line timetable / selected date | `line_schedule` |
| Travel time on one specific line between two stops | `line_segment` |
| Current service disruptions | `alerts` |
| A-to-B planning | `plan_trip` |
| Recurring stop arrival monitoring | `stop_watch` |
| Recurring line/vehicle or line-at-stop monitoring | `line_watch` |
| Recurring service-alert monitoring | `alerts_watch` |
| Recurring monitoring of selected trip | `trip_watch` |
| List/status/update/pause/resume/cancel watches | `watch_control` |
| Act on selected trip: Live Activity / departure reminder | `trip_engagement` renderer action |
| Geometry only | `shape` |
| Stop POIs | `stop_pois` |
| Stop validation aggregates | `stop_validations` |

## Correctness and efficiency

- Preserve exact route variants and requested direction. Passenger line numbers are not globally unique.
- `nearby_line` and location-based `line_watch` must resolve location → served stop → matching direction/route IDs locally.
- Trip planning must keep the working BusNearby `/directions` client; never substitute Apple/MapKit and never change it to `/directions/plan`.
- Never rerun the root renderer merely to refresh realtime data; live components and monitor runners refresh local state.
- Never describe schedule-only data as live. Green timing indicates realtime; normal label color indicates scheduled.
- Monitoring must use stable vehicle/trip/alert IDs for deduplication when available.
- A transient API error must not immediately kill a watch. The bundled runner retries, stores consecutive failures, and surfaces health/status locally.
- If realtime disappears temporarily, do not infer cancellation from absence alone; schedule data remains a fallback for stop-arrival watches unless `realtimeOnly:true`.
- Multiple monitors may coexist. Do not assume there can be only one active watch.
- Do not promise that BackgroundKeeper guarantees indefinite execution; iOS may suspend or terminate background scripts.

## Maintenance only

Only while debugging/updating may implementation files or references be inspected.

The canonical source is `davidpovarsky/scripting-skills`, branch `main`, subtree `israel-transit/`.
- Native Skill updates remain configured in `skill.json`.
- `israel_transit_companion` and `israel_transit_monitor` are bundled under `assets/` and installed/updated into `FileManager.scriptsDirectory` on demand by version-aware installer code.
- Let Scripting fetch/apply Skill updates; do not add GitHub-download logic to runtime query/render files.
- Bump `skill.json.version` for every Skill release. Bump a companion's `script.json.version` whenever that companion's bundled files change.
