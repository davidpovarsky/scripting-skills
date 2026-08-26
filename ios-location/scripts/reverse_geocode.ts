import { Script } from "scripting"

const params = Script.queryParameters
const latitude = Number(params.latitude)
const longitude = Number(params.longitude)
const locale = params.locale as string | undefined

async function main() {
  if (isNaN(latitude) || isNaN(longitude)) {
    Script.exit({
      success: false,
      error: "Missing or invalid required parameters: latitude, longitude"
    })
    return
  }

  try {
    const results = await Location.reverseGeocode({
      latitude,
      longitude,
      locale
    })

    if (results && results.length > 0) {
      const placemarks = results.map(p => ({
        name: p.name,
        thoroughfare: p.thoroughfare,
        subThoroughfare: p.subThoroughfare,
        locality: p.locality,
        subLocality: p.subLocality,
        administrativeArea: p.administrativeArea,
        subAdministrativeArea: p.subAdministrativeArea,
        postalCode: p.postalCode,
        country: p.country,
        isoCountryCode: p.isoCountryCode,
        timeZone: p.timeZone,
        region: p.region,
        inlandWater: p.inlandWater,
        ocean: p.ocean,
        areasOfInterest: p.areasOfInterest
      }))

      Script.exit({
        success: true,
        count: placemarks.length,
        placemarks
      })
    } else {
      Script.exit({
        success: false,
        error: `No address found for coordinates: ${latitude}, ${longitude}`
      })
    }
  } catch (error: any) {
    Script.exit({ success: false, error: error.message ?? String(error) })
  }
}

main()
