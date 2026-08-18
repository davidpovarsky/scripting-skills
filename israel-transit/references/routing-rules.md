# Routing rules

- Stop name/code lookup: `search_stops`.
- Stop arrival board: `stop_board`; accepts `query` directly and resolves the stop internally.
- Nearby: `nearby_stops`; rich renderer can request current location when lat/lon are omitted.
- Specific line near current location: `nearby_line`; renderer composes location -> nearby stops -> line-service filter -> nearest served stop -> live/scheduled stop board.
- Line lookup: `search_lines`.
- Full line map/stops: `line_details`; accepts `lineNumber` or query such as `קו 71`.
- Vehicles only: `line_live`.
- Stop/line schedules: `stop_schedule`, `line_schedule`; both resolve human identifiers when possible.
- Alerts: may use stop name/code or line number/route ID.
- Trip planning: `plan_trip`; use `useCurrentLocation:true` for origin “מכאן”.

Prefer a direct rich renderer call for visual requests and one compact `query.ts` call for text-only requests.

## Referential follow-ups

When a rich view has already been shown, resolve references through the local context bridge before any global line search. Passenger-facing line numbers are not unique. Context stores only selected itinerary/leg and exact route references; it intentionally excludes geometry, vehicles, alerts, and raw responses.

For normal rich requests, the model must not decompose a composite intent into several tool calls. Prefer one renderer action and no execution narration.
