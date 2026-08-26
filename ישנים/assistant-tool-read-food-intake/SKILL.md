---
name: assistant-tool-read-food-intake
description: This tool allows you to read food intake data from HealthKit within a specified time range.
---

# Invocation

After reading this file, execute the builtin bridge tool `call_assistant_tool` with:

- `tool_name`: `read_food_intake`
- `tool_arguments`: a JSON object serialized as a string

Build `tool_arguments` from the JSON schema below. `tool_arguments` must match the assistant tool input schema exactly. Do not omit required fields. Do not invent fields, rename fields, or change types. If the tool takes no arguments, pass `{}`.

## call_assistant_tool Example

```json
{
  "tool_name": "read_food_intake",
  "tool_arguments": "{...valid JSON object matching the schema below...}"
}
```

## tool_arguments JSON Schema

```json
{"additionalProperties":false,"properties":{"end_date":{"description":"The end date of the time range (format: yyyy\/MM\/dd hh:mm:ss). Example: 2024\/01\/07 23:59:59","examples":["2024\/01\/07 23:59:59"],"type":"string"},"start_date":{"description":"The start date of the time range (format: yyyy\/MM\/dd hh:mm:ss). Example: 2024\/01\/01 00:00:00","examples":["2024\/01\/01 00:00:00"],"type":"string"}},"required":["start_date","end_date"],"type":"object"}
```