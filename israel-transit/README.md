# Israel Transit for Scripting — V5.2.1

A native Scripting skill for Israeli public transport, including live arrivals, timetables, route maps, trip planning, notifications, Live Activities, and persistent best-effort transit monitoring.

## Runtime architecture

There is no Assistant Tool.

1. The model emits a `scripting-file` block pointing to `scripts/transit-renderer.tsx`.
2. Props contain only compact intent parameters such as `{action:"stop_board", stopCode:"1076", withinMinutes:3}` or `{action:"stop_watch", stopCode:"1076", pollIntervalSeconds:180, arrivalWindowMinutes:3}`.
3. Bundled TypeScript performs API calls, route/stop resolution, filtering, polling, comparison, deduplication, and rendering locally.
4. Large geometry/realtime payloads and monitor state never pass through the model context.

For compact text-only reasoning, `scripts/query.ts` returns `{ok, action, summary, facts, warnings, sources}`.

## Bundled Scripting companions

The Skill contains version-aware installer code. Required Scripting projects are copied automatically into `FileManager.scriptsDirectory` when first needed and updated when the bundled `script.json` version changes.

- `assets/israel_transit_companion/` — departure reminders, trip Live Activity, widget and rich trip notifications.
- `assets/israel_transit_monitor/` — recurring stop/line/alert/trip monitoring, persistence, notifications and monitor Live Activities.

No manual copy into the Scripts directory is required.

## Monitoring

V5 adds first-class monitoring actions:

- `stop_watch` — repeatedly check one stop, the nearest stop, or several stop codes, with time-window, first/last-service, line, destination, realtime and accessibility filters.
- `line_watch` — monitor a line at a stop/current location or watch the exact route variant's live vehicles.
- `alerts_watch` — notify on new service disruptions for a stop or line.
- `trip_watch` — monitor the most recently selected trip's upcoming legs, live ETA/delay state, and transfer-risk conditions.
- `watch_control` — list, inspect, update, pause, resume or cancel watches.

The monitor runner stores each watch under its own ID, supports multiple watches, retries transient failures, deduplicates by stable trip/vehicle/alert IDs, establishes a baseline before `new_matches`/`new_alerts`, supports `every_check`, `when_matches`, `on_change`, `new_matches`, and `once`, and can stop by duration, deadline, check count, or first match. User control changes win over in-flight polling results, so a late API response cannot revive a paused or cancelled watch.

Background execution uses Scripting `BackgroundKeeper`. This is best-effort: iOS may still suspend or terminate the app. Monitor state, last-check time, error state and runner health remain visible so the UI does not falsely claim that a suspended watch is still actively polling.

## Line-segment resolver reliability

`line_segment` resolves both endpoint names to concrete stop IDs/codes first, scans every returned line pattern (with bounded local concurrency rather than a 20-pattern cutoff), requires origin-before-destination order, and falls back to fuzzy name matching only when no ID/code-matched pattern exists. When several valid variants remain, realtime is checked across them with cached upstream payloads so the active upcoming vehicle can select the relevant variant. This work stays inside bundled TypeScript and is not returned to the language model.

## Line-segment travel-time statistics

`line_segment` now keeps the model out of travel-time arithmetic and renders three independently labelled statistics:

- **Current live vehicle** — chooses the nearest vehicle that has not yet passed the origin and requires both origin and destination ETA calls on the same exact route/trip/vehicle before calculating the segment duration.
- **Last three observed traversals** — the monitor companion silently collects realtime observations in local `Storage`, keyed by exact route + stop pair and matched by `tripId`/`vehicleId`. A traversal is counted only after that same trip has been observed through both stops. Until enough traversals exist, the UI explicitly says history is still being collected; scheduled data is never substituted as fake actual history. The collector polls every 30 seconds by default and remains best-effort under iOS background limits.
- **Scheduled duration** — prefers the same scheduled `tripId` as the current live vehicle, otherwise the nearest planned trip, then a daily schedule median; BusNearby directions is only a final planning fallback.

The card also compares the current live duration with the scheduled duration when both are available.

## Snapshot filtering

`stop_board` and next-arrival `nearby_line` now support local filtering via `withinMinutes`, `minMinutes`, `maxMinutes`, `maxResults`, `lineNumber`, `lineNumbers`, `destinationQuery`, `realtimeOnly`, and `accessibleOnly`.

## Sources

- BusNearby: geocoding, stop/line catalog, nearby stops, route geometry, trip planning.
- KavNav: realtime vehicles/ETAs, stop summaries/schedules, route schedules, alerts, shapes, POIs and validation aggregates.

## Important preserved behavior

- Natural stop names and passenger line numbers are resolved locally.
- Exact route variants and requested directions are preserved.
- `nearby_line` and location-based `line_watch` compose location → nearby stops → served route → exact direction locally.
- `plan_trip` continues to use the working BusNearby `/directions` endpoint; it is not replaced by `/directions/plan` or Apple/MapKit routing.
- Schedule-only arrivals are never mislabeled as realtime.
- Skill updates remain configured through `skill.json.remoteResource`; companions are refreshed from the bundled Skill assets by their version-aware installer.
