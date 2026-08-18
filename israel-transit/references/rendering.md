# Rendering contract

Normal rich UI uses `scripts/transit-renderer.tsx` via a `scripting-file` response. The model passes request props only; the TSX fetches data internally.

Examples:
- `{action:"stop_board", query:"ארמון הנציב"}`
- `{action:"nearby_stops", max:8}`
- `{action:"line_details", lineNumber:"71"}`
- `{action:"line_live", lineNumber:"71"}`
- `{action:"plan_trip", fromQuery:"תל אביב", toQuery:"ירושלים"}`

The renderer dispatches normalized results to native views for nearby stops, line candidates, stop boards, line/live maps, schedules, alerts, route shapes, and trip planning.

Do not run `query.ts` before rendering. Manual `{config:...}` rendering is supported only as an explicit fallback.

## Interactive route state

- Keep static geometry/stops in the mounted view; refresh only realtime vehicle/ETA state.
- Trip plans use one synchronized selection for itinerary, timeline leg, and map focus.
- Walking geometry uses a dashed map stroke; transit uses a solid route-color stroke.
- Tapping a leg focuses its geometry. Tapping its line action fetches the exact routeId locally and overlays the full line plus live vehicles on the same map.
- Persist only tiny entity references for follow-ups; never persist raw API payloads or geometry as agent context.
