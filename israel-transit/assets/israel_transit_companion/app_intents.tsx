import { AppIntentManager, AppIntentProtocol, LiveActivity, Widget } from "scripting"
import type { TripLiveActivityState } from "./live_activity"

const ACTIVITY_NAME = "IsraelTransitTrip"
const CURRENT_TRIP_KEY = "currentTrip"
const CONFIRMED_KEY = "journeyConfirmed"
const CONFIRMED_AT_KEY = "journeyConfirmedAt"
const CONFIRMED_VEHICLE_KEY = "journeyConfirmedVehicleId"
const CONFIRMED_LEG_KEY = "journeyConfirmedLegIndex"

export const ConfirmTransitTripIntent = AppIntentManager.register({
  name: "ConfirmTransitTripIntent",
  protocol: AppIntentProtocol.LiveActivityIntent,
  perform: async (_params: undefined) => {
    const now = Date.now()
    Storage.set(CONFIRMED_KEY, true)
    Storage.set(CONFIRMED_AT_KEY, now)

    const stored = Storage.get<TripLiveActivityState>(CURRENT_TRIP_KEY)
    const updated = stored
      ? { ...stored, journeyConfirmed: true, confirmedAt: now, updatedAt: now }
      : null

    if (updated) {
      Storage.set(CURRENT_TRIP_KEY, updated)
      const transitIndex = updated.nextTransitIndex >= 0 ? updated.nextTransitIndex : updated.currentLegIndex
      const transitLeg = updated.legs[transitIndex]
      if (transitLeg?.vehicleId) Storage.set(CONFIRMED_VEHICLE_KEY, transitLeg.vehicleId)
      Storage.set(CONFIRMED_LEG_KEY, transitIndex)
    }

    if (updated) {
      const ids = await LiveActivity.getAllActivitiesIds()
      await Promise.all(ids.map(async id => {
        try {
          const activity: any = LiveActivity.from(id, ACTIVITY_NAME)
          const activityState = await activity.getActivityState()
          if (activityState === "active" || activityState === "stale") {
            await activity.update(updated, {
              staleDate: new Date(now + 20_000),
              relevanceScore: 1,
            })
          }
        } catch {}
      }))
    }

    try { Widget.reloadAll() } catch {}
  },
})
