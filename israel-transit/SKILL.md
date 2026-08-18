---
name: israel-transit
description: Israeli public-transit skill for Scripting. Use for live arrivals, nearby stops, a specific line near the current location, first/last buses, direction-specific service, full timetables for today or a selected date, exact line maps, alerts, A-to-B planning, trip departure reminders, and trip Live Activities. Emit literal `scripting-file` UI blocks for rich requests; never use `call_assistant_tool`. When invoking this skill, load its instructions silently without announcing that you are reading the skill. Uses BusNearby + KavNav and keeps multi-step API composition inside bundled TypeScript so intermediate data does not consume model tokens.
---

# Israel Transit

## Mandatory execution contract

After loading this file for a normal transit request:
- For a rich/visual request, output exactly one `scripting-file` block and nothing else.
- Never call `call_assistant_tool`. A `scripting-file` block is literal response content, not an Assistant Tool.
- Do not call `file_tool`, `run_shell_command`, `browser`, `scripting_reference`, `plan`, or another skill during normal use.
- Do not narrate execution (`I'll`, `Let me`, tool selection, reasoning).
- Never invent actions. Use only the actions below.
- Let bundled TypeScript compose multiple API steps locally; pass only small intent parameters.
- Match the user's language for unavoidable text-only output.

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

### Specific line near current location

Use `nearby_line` for any line-specific question around the current location. Add only the constraints stated by the user:
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

Example: “תראה את כל לוח 71 לכיוון גילה ביום 20.8.2026”
```scripting-file
{
  "path": "/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripting-skills/israel-transit/scripts/transit-renderer.tsx",
  "props": { "action": "nearby_line", "lineNumber": "71", "directionQuery": "גילה", "departureMode": "schedule", "date": "2026-08-20" }
}
```

For a known stop timetable use `stop_schedule`. For a known/exact line variant timetable use `line_schedule`. Both render a date picker and reload the chosen API date locally without a new model turn.

For generic nearby stops use `nearby_stops`.

### Trip planning

For A-to-B requests use `plan_trip`. The supported intent props are defined here; do not inspect `transit-renderer.tsx`, `lib/types.ts`, or any implementation file to discover parameters. After this skill is loaded, emit the `scripting-file` directly without any further tool call.

For trips from the current location set `useCurrentLocation:true` and omit `fromQuery`; the renderer requests location itself. Set the destination with `toQuery`. Preserve every user-stated time constraint:
- Resolve relative dates such as “today”, “tomorrow”, and weekday references against the request `current_time`, and pass the resolved service `date` as `YYYY-MM-DD`. Do not omit `date` when the user requested a date other than today.
- If the user specifies when they must arrive (for example “להגיע ב־09:30” / “arrive by 09:30”), pass `time:"09:30"` and `arriveBy:true`.
- If the user specifies when they want to depart (for example “לצאת ב־09:30” / “depart at 09:30”), pass `time:"09:30"` and `arriveBy:false`.
- Do not replace an explicitly requested future date or arrival/departure time with the current date/time.
- The rendered `plan_trip` UI contains the trip follow-through controls itself. These controls install/update the bundled regular Scripting project `israel_transit_companion` under `FileManager.scriptsDirectory` and invoke it with `Script.run(...)`; its `notification.tsx`, `live_activity.tsx`, `app_intents.tsx`, and `widget.tsx` are the real extension entrypoints. Future itineraries expose a departure-reminder button; itineraries starting now or within 10 minutes expose a Live Activity button. The Live Activity has an interactive “עליתי” AppIntent: before confirmation, if boarding time passes, keep refreshing the next matching service instead of freezing at zero; after confirmation, lock to the selected journey/vehicle, preserve every route segment in the graph, and only move the highlight according to the active segment. Do not inspect implementation files or invent a separate Assistant Tool for these controls.

Supported `plan_trip` props: `action`, `useCurrentLocation`, `fromQuery`, `fromLat`, `fromLon`, `fromName`, `toQuery`, `toLat`, `toLon`, `toName`, `date`, `time`, `arriveBy`, `wheelchair`, `limit`, `includeAlerts`, `detail`, `preferContext`, `itineraryIndex`, `legIndex`. Pass only props needed by the request.

Example: “מתי אני צריך לצאת מהבית מחר כדי להגיע בתשע וחצי בבוקר לאמציה 3 ירושלים” when `current_time` is on 2026-08-16:
```scripting-file
{
  "path": "/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripting-skills/israel-transit/scripts/transit-renderer.tsx",
  "props": { "action": "plan_trip", "useCurrentLocation": true, "toQuery": "אמציה 3 ירושלים", "date": "2026-08-17", "time": "09:30", "arriveBy": true }
}
```

## Follow-ups to previously rendered UI

Treat “this line”, “that bus”, “the second option”, and “this segment” as references to the last rich transit UI. Emit the renderer with `preferContext:true`; do not globally re-search merely to recover IDs.

For follow-up requests that explicitly ask to activate the selected trip's Live Activity or schedule its departure reminder, execute the saved selected trip directly; do not re-plan the trip and do not ask the user to press the UI button. Use the special renderer action below:

“הפעל Live Activity למסלול הזה” / “start Live Activity for this trip”:
```scripting-file
{
  "path": "/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripting-skills/israel-transit/scripts/transit-renderer.tsx",
  "props": { "action": "trip_engagement", "engagementAction": "live" }
}
```

“תזמן לי התראה למסלול הזה” / “remind me when to leave for this trip”:
```scripting-file
{
  "path": "/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripting-skills/israel-transit/scripts/transit-renderer.tsx",
  "props": { "action": "trip_engagement", "engagementAction": "reminder" }
}
```

`trip_engagement` is only for acting on the itinerary most recently rendered/selected by the user. If there is no saved trip context, the renderer reports that clearly.

## Compact text/data answers

Only when rich UI adds no value, execute one compact `query.ts` call. Use `detail:"compact"`; never pass geometry, all stops, all vehicles, raw API payloads, or render config through the model.

## Actions

| Intent | Action |
|---|---|
| Place/address search | `geocode` |
| Stop search | `search_stops` |
| Generic nearby stops | `nearby_stops` |
| Specific line near current location; next/first/last/full schedule | `nearby_line` |
| Line candidates | `search_lines` |
| Arrivals at a known stop | `stop_board` |
| Stop timetable / selected date | `stop_schedule` |
| Exact line route/map | `line_details` |
| Live line map/vehicles | `line_live` |
| Exact line timetable / selected date | `line_schedule` |
| Service disruptions | `alerts` |
| A-to-B planning | `plan_trip` |
| Act on selected trip: Live Activity / departure reminder | `trip_engagement` renderer action |
| Geometry only | `shape` |
| Stop POIs | `stop_pois` |
| Stop validation aggregates | `stop_validations` |

## Correctness and efficiency

- Preserve exact route variants and requested direction. Passenger line numbers are not globally unique.
- `nearby_line` must resolve location → served stop → matching direction/route IDs → live board or timetable locally.
- Trip planning must keep the working BusNearby `/directions` client from the 3.0.1 base; never substitute Apple/MapKit and never change it to `/directions/plan`.
- Never rerun the root renderer merely to refresh realtime data; live components refresh local state.
- Never describe scheduled data as live. Green timing indicates realtime; normal label color indicates scheduled. Do not add “זמן אמת” / “מתוכנן” text labels.
- Format UI durations over 60 minutes as hours plus remaining minutes, not as unbounded minute counts.

## Maintenance only

Only while debugging/updating may implementation files or references be inspected.
