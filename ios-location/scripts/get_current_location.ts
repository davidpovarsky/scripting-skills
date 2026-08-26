import { Script } from "scripting"

const params = Script.queryParameters
const accuracy = (params.accuracy as string) ?? "best"
const forceRequest = params.force_request === "true" || String(params.force_request) === "true"

type LocationAccuracy = "best" | "tenMeters" | "hundredMeters" | "kilometer" | "threeKilometers" | "bestForNavigation" | "reduced"

const validAccuracies: LocationAccuracy[] = [
  "best", "tenMeters", "hundredMeters", "kilometer", "threeKilometers", "bestForNavigation", "reduced"
]

async function main() {
  try {
    if (!validAccuracies.includes(accuracy as LocationAccuracy)) {
      Script.exit({
        success: false,
        error: `Invalid accuracy: ${accuracy}. Use: ${validAccuracies.join(", ")}`
      })
      return
    }

    await Location.setAccuracy(accuracy as LocationAccuracy)

    const location = await Location.requestCurrent({ forceRequest })

    if (location) {
      Script.exit({
        success: true,
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: location.timestamp
      })
    } else {
      Script.exit({
        success: false,
        error: "Unable to get current location. Please check location permissions."
      })
    }
  } catch (error: any) {
    Script.exit({ success: false, error: error.message ?? String(error) })
  }
}

main()
