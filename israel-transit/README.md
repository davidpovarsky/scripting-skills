# Israel Transit for Scripting — V4.3.0

A native Scripting skill for Israeli public transport.

## Runtime architecture

There is no Assistant Tool. Rich UI follows the same pattern as `rich-maps`:

1. The model emits a `scripting-file` block pointing to `scripts/transit-renderer.tsx`.
2. Props contain only the transit request (for example `{action:"stop_board", query:"ארמון הנציב"}`).
3. The TSX performs API calls and normalization internally and renders the appropriate native view.
4. Heavy geometry/realtime data never passes through the model context.

For text-only reasoning, `scripts/query.ts` returns a compact `{ok, action, summary, facts, warnings, sources}` object.

## Automatic GitHub updates

The `main` branch of `davidpovarsky/scripting-skills`, under `israel-transit/`, is the source of truth for the complete skill.

- `scripts/lib/auto-update.ts` checks the remote `skill.json` before normal rich and compact transit requests.
- Checks are throttled to once every six hours so normal transit usage does not repeatedly hit GitHub.
- When the remote `skill.json.version` is newer, the updater downloads the complete `israel-transit/` subtree first and only then writes the installed files.
- The bundled `assets/israel_transit_companion/` files are mirrored at the same time into `FileManager.scriptsDirectory/israel_transit_companion`, so the Skill and its regular Scripting companion stay on the same release.
- `skill.json` and the companion `script.json` are written last. If a filesystem write fails midway, the old version remains visible and a later invocation retries.
- Update failures are best-effort and never replace a transit answer with an updater error.

Every distributable change must bump `skill.json.version`. When companion files change, also bump `assets/israel_transit_companion/script.json.version`.

> Bootstrap note: an installation that predates 4.3.0 does not yet contain the updater itself. Install/sync 4.3.0 once; subsequent version bumps can be pulled automatically on use.

## Sources

- BusNearby: geocoding, stop/line catalog, nearby stops, route geometry, trip planning.
- KavNav: realtime vehicles/ETAs, stop summaries/schedules, route schedules, alerts, shapes, POIs and validation aggregates.

## Key behavior

- Natural stop names are resolved automatically for stop actions.
- Natural line numbers are resolved automatically for line actions.
- `nearby_stops` rich UI requests current device location inside the renderer when coordinates are omitted.
- `nearby_line` composes current location, nearby-stop discovery, line filtering, nearest served stop selection, and a line-filtered live stop board in one renderer request.
- `plan_trip` can use current location with `useCurrentLocation:true`.
- Realtime arrivals are only attached when the target stop appears in the vehicle onward calls.

## 3.0.1 runtime fix

**Preserved planner endpoint:** trip planning continues to use the 3.0.1 BusNearby `/directions` endpoint. The later `/directions/plan` + auth experiment is intentionally not included.

- `Location` is a Scripting global API and is no longer imported from `"scripting"`.
- `MapUtils` is used as a Scripting global, matching the official MapKit examples; only view components/hooks are imported from `"scripting"`.

## Recent UI behavior

- nearby_line supports next/first/last/full schedule plus directionQuery and date.
- Schedule cards support local date selection using KavNav minDate/maxDate.
- Arrival ETAs use relative minutes only below one hour; from one hour onward they show the arrival clock time.
- Realtime vs scheduled timing is color-only in arrival cards.
- Line-filtered arrival tiles contain only the time; line/destination metadata stays in the header.
- Full line/day schedules use a compact three-column time grid instead of repeating line and destination on every row.
