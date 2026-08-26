---
name: assistant-tool-read-activity-summary
description: This tool allows you to read the user’s daily activity summary from HealthKit.
---

# Invocation

After reading this file, execute the builtin bridge tool `call_assistant_tool` with:

- `tool_name`: `read_activity_summary`
- `tool_arguments`: a JSON object serialized as a string

Build `tool_arguments` from the JSON schema below. `tool_arguments` must match the assistant tool input schema exactly. Do not omit required fields. Do not invent fields, rename fields, or change types. If the tool takes no arguments, pass `{}`.

## call_assistant_tool Example

```json
{
  "tool_name": "read_activity_summary",
  "tool_arguments": "{...valid JSON object matching the schema below...}"
}
```

## tool_arguments JSON Schema

```json
{"additionalProperties":false,"properties":{"end_date":{"description":"The end date of the query range (yyyy\/MM\/DD). Must be provided with start_date. Example: 2023\/01\/31","examples":["2023\/01\/31"],"type":"string"},"start_date":{"description":"The start date of the query range (yyyy\/MM\/DD). Must be provided with end_date. Example: 2023\/01\/01","examples":["2023\/01\/01"],"type":"string"}},"required":[],"type":"object"}
```