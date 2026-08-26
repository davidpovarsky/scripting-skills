# API contracts

## BusNearby (public calls used by this skill)

Base: `https://api.busnearby.co.il`

- `GET /geocode?locale=he&query=...` — address/place/stop geocoding.
- `GET /directions?...` — multimodal trip planning; no session token in the public MCP-compatible endpoint.
- `GET /directions/index/stops?lat&lon&radius&max&locale=he` — nearby stops.
- `GET /directions/index/patterns/byshortname/{line}?locale=he` — line candidates/patterns.
- `GET /directions/index/patterns/{patternId}?locale=he` — ordered pattern details/stops.
- `GET /directions/index/patterns/{patternId}/geometry` — encoded `points6` geometry.

Stop text search is `https://app.busnearby.co.il/stopSearch?query=...&locale=he`.

Do not use BusNearby `/stops/{id}`, `/routes`, `/stoptimes` in this skill: captured behavior shows they require a short-lived session token.

## KavNav

Base: `https://kavnav.com`

- `/api/realtime?stopCode=...` — vehicles serving/approaching a stop. Validate requested stop is in `trip.onwardCalls.calls` before treating it as an arrival.
- `/api/realtime?routeCode=...` — live vehicles for a licensed line code.
- `/api/stopSummary?stopCode=...` — route set, route IDs/codes, directions and alternatives at a stop.
- `/api/stopSchedule?stopCode=...&date=YYYY-MM-DD` — scheduled stop trips.
- `/api/route?routeId=...&date=YYYY-MM-DD` — route direction metadata.
- `/api/routeSchedule?routeId=...&date=YYYY-MM-DD` — route trips and stop times.
- `/api/alerts?stopId=...` / `?routeId=...` — service alerts.
- `/shapes/{shapeId}.json` — route shapes where needed.

These captured calls use ordinary GET requests and no authorization token.
