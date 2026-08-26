# Realtime semantics

KavNav `/api/realtime?stopCode=` can include vehicles associated with routes that serve the stop even when a specific vehicle is no longer approaching it. A vehicle is a valid live arrival only when the target stop code appears in `vehicle.trip.onwardCalls.calls`; use that call's `eta`.

Merge policy for stop boards:

1. Build the scheduled set from `stopSchedule[].trips`.
2. Index live vehicles by GTFS trip ID where available.
3. Replace/display prediction time when a matching live vehicle has an ETA to the target stop.
4. Keep scheduled departures without a live match, clearly marked `realtime: false`.
5. Add live trips not present in the bounded schedule response.
6. Sort by effective time (predicted if live, otherwise scheduled).
7. Surface `lastReported`, confidence and delay where available.

Never infer “live” from a realtime endpoint alone; require a concrete vehicle/ETA match.

## Segment travel-time measurement

For `line_segment`, realtime duration is valid only when the same live vehicle/trip exposes ETA calls for both requested stops in the requested order. Choose the nearest upcoming origin ETA.

Historical "actual" segment durations must come from locally observed realtime traversal history matched by stable `tripId`/`vehicleId`; do not relabel schedule samples as actual history. A background collector may infer each passage within its polling interval from the final ETA/stop-disappearance transition, and the UI must surface the polling precision. If fewer than three completed traversals exist, show the available count and that history is still being collected.
