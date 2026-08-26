import { Script } from "scripting"

const params = Script.queryParameters
const address = params.address as string
const locale = params.locale as string | undefined

async function main() {
  if (!address) {
    Script.exit({ success: false, error: "Missing required parameter: address" })
    return
  }

  try {
    const results = await Location.geocodeAddress({
      address,
      locale
    })

    if (results && results.length > 0) {
      const placemarks = results.map(p => ({
        location: p.location ? {
          latitude: p.location.latitude,
          longitude: p.location.longitude,
          timestamp: p.location.timestamp
        } : null,
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
        timeZone: p.timeZone
      }))

      Script.exit({
        success: true,
        count: placemarks.length,
        placemarks
      })
    } else {
      Script.exit({
        success: false,
        error: `No results found for address: ${address}`
      })
    }
  } catch (error: any) {
    Script.exit({ success: false, error: error.message ?? String(error) })
  }
}

main()
