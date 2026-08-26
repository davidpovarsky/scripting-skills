import { Script } from "scripting"

const params = Script.queryParameters
const latitude = Number(params.latitude)
const longitude = Number(params.longitude)
const startDateStr = params.start_date as string | undefined
const endDateStr = params.end_date as string | undefined

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

    const options = startDateStr || endDateStr ? {
      startDate: startDateStr ? new Date(startDateStr) : new Date(),
      endDate: endDateStr ? new Date(endDateStr) : new Date(Date.now() + 25 * 60 * 60 * 1000)
    } : undefined

    const forecast = await Weather.requestHourlyForecast({ latitude, longitude }, options)

    const hours = forecast.forecast.map(hour => ({
      date: new Date(hour.date).toISOString(),
      temperature: hour.temperature.formatted,
      apparentTemperature: hour.apparentTemperature.formatted,
      condition: hour.condition,
      symbolName: hour.symbolName,
      isDaylight: hour.isDaylight,
      humidity: `${Math.round(hour.humidity * 100)}%`,
      dewPoint: hour.dewPoint.formatted,
      pressure: hour.pressure.formatted,
      pressureTrend: hour.pressureTrend,
      cloudCover: `${Math.round(hour.cloudCover * 100)}%`,
      visibility: hour.visibility.formatted,
      uvIndex: {
        value: hour.uvIndex.value,
        category: hour.uvIndex.category
      },
      wind: {
        compassDirection: hour.wind.compassDirection,
        direction: hour.wind.direction.formatted
      },
      precipitationChance: `${Math.round(hour.precipitationChance * 100)}%`,
      precipitation: hour.precipitation,
      precipitationAmount: hour.precipitationAmount.formatted
    }))

    Script.exit({
      success: true,
      location: { latitude, longitude },
      count: hours.length,
      forecast: hours
    })
  } catch (error: any) {
    Script.exit({ success: false, error: error.message ?? String(error) })
  }
}

main()
