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
      endDate: endDateStr ? new Date(endDateStr) : new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
    } : undefined

    const forecast = await Weather.requestDailyForecast({ latitude, longitude }, options)

    const days = forecast.forecast.map(day => ({
      date: new Date(day.date).toISOString().split("T")[0],
      highTemperature: day.highTemperature.formatted,
      lowTemperature: day.lowTemperature.formatted,
      condition: day.condition,
      symbolName: day.symbolName,
      precipitationChance: `${Math.round(day.precipitationChance * 100)}%`,
      precipitation: day.precipitation,
      wind: {
        compassDirection: day.wind.compassDirection,
        direction: day.wind.direction.formatted
      },
      uvIndex: {
        value: day.uvIndex.value,
        category: day.uvIndex.category
      },
      sun: {
        sunrise: day.sun.sunrise ? new Date(day.sun.sunrise).toISOString() : null,
        sunset: day.sun.sunset ? new Date(day.sun.sunset).toISOString() : null
      },
      moon: {
        moonrise: day.moon.moonrise ? new Date(day.moon.moonrise).toISOString() : null,
        moonset: day.moon.moonset ? new Date(day.moon.moonset).toISOString() : null,
        phase: day.moon.phase
      }
    }))

    Script.exit({
      success: true,
      location: { latitude, longitude },
      count: days.length,
      forecast: days
    })
  } catch (error: any) {
    Script.exit({ success: false, error: error.message ?? String(error) })
  }
}

main()
