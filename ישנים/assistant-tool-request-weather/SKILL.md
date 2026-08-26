---
name: assistant-tool-request-weather
description: Request weather information for any specified location, with support for current, hourly, and daily forecasts. If no location is provided, the user's current location will be used.
---

# Invocation

After reading this file, execute the builtin bridge tool `call_assistant_tool` with:

- `tool_name`: `request_weather`
- `tool_arguments`: a JSON object serialized as a string

Build `tool_arguments` from the JSON schema below. `tool_arguments` must match the assistant tool input schema exactly. Do not omit required fields. Do not invent fields, rename fields, or change types. If the tool takes no arguments, pass `{}`.

## call_assistant_tool Example

```json
{
  "tool_name": "request_weather",
  "tool_arguments": "{...valid JSON object matching the schema below...}"
}
```

## tool_arguments JSON Schema

```json
{"additionalProperties":false,"properties":{"daily_end_date":{"description":"A date in yyyy\/MM\/dd HH:mm:ss format representing the inclusive lower boundary of the time range for the daily forecast. This parameter must be provided together with 'daily_start_date'. Example: 2025\/03\/28 09:12:19","examples":["2025\/03\/28 09:12:19"],"type":"string"},"daily_start_date":{"description":"A date in yyyy\/MM\/dd HH:mm:ss format representing the exclusive upper boundary of the time range for the daily forecast. This parameter must be provided together with 'daily_end_date'. Example: 2025\/03\/27 09:12:19","examples":["2025\/03\/27 09:12:19"],"type":"string"},"hourly_end_date":{"description":"A date in yyyy\/MM\/dd HH:mm:ss format representing the inclusive lower boundary of the time range for the hourly forecast. This parameter must be provided together with 'hourly_start_date'. Example: 2025\/03\/28 09:12:19","examples":["2025\/03\/28 09:12:19"],"type":"string"},"hourly_start_date":{"description":"A date in yyyy\/MM\/dd HH:mm:ss format representing the exclusive upper boundary of the time range for the hourly forecast. This parameter must be provided together with 'hourly_end_date'. Example: 2025\/03\/27 09:12:19","examples":["2025\/03\/27 09:12:19"],"type":"string"},"latitude":{"description":"The latitude of the location to query. If not provided, the user's current location will be used. Example: latitude here","examples":["latitude here"],"type":"number"},"longitude":{"description":"The longitude of the location to query. If not provided, the user's current location will be used. Example: longitude here","examples":["longitude here"],"type":"number"},"query":{"description":"Which information to query. When the value is 'hourly', and no 'hourly_start_date' and 'hourly_end_date' are provided, beginning with the current hour to 25 contiguous hours. When the value is 'daily', and no 'daily_start_date' and 'daily_end_date' are provided, beginning with the current day to 10 contiguous days. Forecasts are available up to 10 days (~240 hours) in the future. Each daily or hourly request will return a maximum of 10 days. To reduce the unneccessary results, you should provide the date parameters. Example: current","enum":["current","hourly","daily"],"examples":["current"],"type":"string"}},"required":["query"],"type":"object"}
```