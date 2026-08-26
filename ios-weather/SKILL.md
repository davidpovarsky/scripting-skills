---
name: ios-weather
description: Query weather data — current conditions, daily forecast, and hourly forecast for any location.
runtime: node
metadata:
  display_name: "iOS Weather"
  required_tools: "run_shell_command"
---

# Purpose

This skill provides scripts for querying weather data through the iOS WeatherKit API. Use it when the user wants to check current weather, daily forecasts, or hourly forecasts for a specific location.

# Available Scripts

All scripts are executed via `run_shell_command` using `scripting-ts run`. Pass parameters as a JSON string with `--queryparameters`.

## get_current_weather.ts

Get current weather conditions for a location.

```
scripting-ts run <skill_dir>/scripts/get_current_weather.ts --queryparameters '{"latitude":39.9042,"longitude":116.4074}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `latitude` | number | Yes | Latitude of the location (-90 to 90). |
| `longitude` | number | Yes | Longitude of the location (-180 to 180). |

**Output:** JSON object with current weather data including temperature, humidity, condition, wind, UV index, etc.

## get_daily_forecast.ts

Get daily weather forecast (up to 10 days).

```
scripting-ts run <skill_dir>/scripts/get_daily_forecast.ts --queryparameters '{"latitude":39.9042,"longitude":116.4074}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `latitude` | number | Yes | Latitude of the location. |
| `longitude` | number | Yes | Longitude of the location. |
| `start_date` | string | No | Start date (ISO 8601 format, e.g. `"2026-04-10"`). Default: today. |
| `end_date` | string | No | End date (ISO 8601 format). Default: 10 days from start. |

**Output:** JSON array of daily forecasts with high/low temperatures, conditions, precipitation chance, sunrise/sunset, etc.

## get_hourly_forecast.ts

Get hourly weather forecast (up to 25 hours by default).

```
scripting-ts run <skill_dir>/scripts/get_hourly_forecast.ts --queryparameters '{"latitude":39.9042,"longitude":116.4074}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `latitude` | number | Yes | Latitude of the location. |
| `longitude` | number | Yes | Longitude of the location. |
| `start_date` | string | No | Start datetime (ISO 8601 format). Default: now. |
| `end_date` | string | No | End datetime (ISO 8601 format). Default: 25 hours from start. |

**Output:** JSON array of hourly forecasts with temperature, humidity, condition, precipitation chance, wind, etc.

# Instructions

1. Determine which script to use based on the user's request.
2. Get the location coordinates (latitude/longitude) from the user or convert a city name to coordinates.
3. Build the `--queryparameters` JSON with the coordinates and optional date range.
4. Execute via `run_shell_command` with `scripting-ts run <path> --queryparameters '<json>'`.
5. Parse the JSON output and present the weather information to the user in a readable format.

# Common City Coordinates

For convenience, here are some common city coordinates:
- Beijing: `39.9042, 116.4074`
- Shanghai: `31.2304, 121.4737`
- Guangzhou: `23.1291, 113.2644`
- Shenzhen: `22.5431, 114.0579`
- Hong Kong: `22.3193, 114.1694`
- Tokyo: `35.6762, 139.6503`
- New York: `40.7128, -74.0060`
- London: `51.5074, -0.1278`
- Paris: `48.8566, 2.3522`
- Sydney: `-33.8688, 151.2093`
