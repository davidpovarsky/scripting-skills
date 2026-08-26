import { Script } from "scripting"

async function main() {
  try {
    const location = await Location.pickFromMap()

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
        error: "User cancelled location selection."
      })
    }
  } catch (error: any) {
    Script.exit({ success: false, error: error.message ?? String(error) })
  }
}

main()
