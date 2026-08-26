---
name: assistant-tool-query-calendar-events
description: Query calendar events based on start and end times.
---

# Invocation

After reading this file, execute the builtin bridge tool `call_assistant_tool` with:

- `tool_name`: `query_calendar_events`
- `tool_arguments`: a JSON object serialized as a string

Build `tool_arguments` from the JSON schema below. `tool_arguments` must match the assistant tool input schema exactly. Do not omit required fields. Do not invent fields, rename fields, or change types. If the tool takes no arguments, pass `{}`.

## call_assistant_tool Example

```json
{
  "tool_name": "query_calendar_events",
  "tool_arguments": "{...valid JSON object matching the schema below...}"
}
```

## tool_arguments JSON Schema

```json
{"additionalProperties":false,"properties":{"end_date":{"description":"End Time Example: yyyy\/MM\/dd HH:mm:ss","examples":["yyyy\/MM\/dd HH:mm:ss"],"type":"string"},"start_date":{"description":"Start Time Example: yyyy\/MM\/dd HH:mm:ss","examples":["yyyy\/MM\/dd HH:mm:ss"],"type":"string"}},"required":["start_date","end_date"],"type":"object"}
```