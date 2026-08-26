import { Script } from "scripting"

const params = Script.queryParameters
const latitude = Number(params.latitude)
const longitude = Number(params.longitude)

async function main() {
  try {
    if (isNaN(latitude) || isNaN(longitude)) {
      throw new Error("latitude and longitude are required and must be numbers")
    }

    if (latitude < -90 || latitude > 90) {
      throw new Error("latitude must be between -90 and 90")
    }

    if (longitude < -180 || longitude > 180) {
      throw new Error("longitude must be between -180 and 180")
    }

    const weather = await Weather.requestCurrent({ latitude, longitude })

    const result = {
      date: new Date(weather.date).toISOString(),
      temperature: weather.temperature.formatted,
      apparentTemperature: weather.apparentTemperature.formatted,
      condition: weather.condition,
      symbolName: weather.symbolName,
      isDaylight: weather.isDaylight,
      humidity: `${Math.round(weather.humidity * 100)}%`,
      dewPoint: weather.dewPoint.formatted,
      pressure: weather.pressure.formatted,
      pressureTrend: weather.pressureTrend,
      wind: {
        compassDirection: weather.wind.compassDirection,
        direction: weather.wind.direction.formatted
      },
      uvIndex: {
        value: weather.uvIndex.value,
        category: weather.uvIndex.category
      },
      visibility: weather.visibility.formatted,
      cloudCover: `${Math.round(weather.cloudCover * 100)}%`,
      precipitationIntensity: weather.precipitationIntensity.formatted
    }

    Script.exit({ success: true, location: { latitude, longitude }, current: result })
  } catch (error: any) {
    Script.exit({ success: false, error: error.message ?? String(error) })
  }
}

main()
