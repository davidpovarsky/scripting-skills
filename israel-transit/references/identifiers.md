# Transit identifiers

- `stopCode`: public passenger-facing stop code; use it for KavNav realtime/summary/schedule.
- `stopId`: GTFS/internal numeric stop ID. BusNearby often prefixes it with `1:`; KavNav uses the numeric portion.
- `lineNumber`: passenger-facing short line number such as `71`.
- `routeId`: direction/variant-specific GTFS route ID. BusNearby may expose `1:34118`; normalize to `34118` for KavNav.
- `routeCode` / BusNearby `motLineId` / KavNav route `code`: licensed line code such as `17071`; required for route-level realtime.
- `patternId`: BusNearby pattern identifier such as `1:34118:1:01`; it identifies an ordered stop pattern and geometry.
- `shapeId`: GTFS shape identifier from trips/realtime.

Never ask the user for internal IDs if line number + contextual place/direction can resolve them.
