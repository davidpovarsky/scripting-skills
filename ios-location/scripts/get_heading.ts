import { Script } from "scripting"

async function main() {
  try {
    await Location.startUpdatingHeading()
    
    // Wait a moment for heading to be available
    await new Promise<void>(resolve => setTimeout(() => resolve(), 500))
    
    const heading = await Location.requestHeading()
    
    Location.stopUpdatingHeading()

    if (heading) {
      Script.exit({
        success: true,
        trueHeading: heading.trueHeading,
        magneticHeading: heading.magneticHeading,
        headingAccuracy: heading.headingAccuracy,
        timestamp: heading.timestamp.toISOString(),
        rawData: {
          x: heading.x,
          y: heading.y,
          z: heading.z
        }
      })
    } else {
      Script.exit({
        success: false,
        error: "Unable to get heading. Compass may not be available on this device."
      })
    }
  } catch (error: any) {
    Location.stopUpdatingHeading()
    Script.exit({ success: false, error: error.message ?? String(error) })
  }
}

main()
